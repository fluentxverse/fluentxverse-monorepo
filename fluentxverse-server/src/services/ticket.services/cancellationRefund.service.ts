import { getAddress, type Hash } from 'viem';
import { ticketChain, ticketPublicClient as client } from '../../config/ticketChain';
import { getDriver } from '../../db/memgraph';
import { invalidateCache } from '../../db/redis';
import { REFUND_POLICY } from '../../config/constant';
import { gmrEngine, GmrEngineRequestError, type EngineTransaction } from '../web3.services/gmrEngine.service';
import type { TicketTransaction } from './ticket.service';

const completed = (status: string) => ['confirmed', 'mined'].includes(status.toLowerCase());
const failed = (status: string) => ['failed', 'errored'].includes(status.toLowerCase());
const number = (value: any) => value?.toNumber?.() ?? Number(value);

export class CancellationRefundService {
  constructor(private engine = gmrEngine,
    private receipt: (hash: Hash) => Promise<{ status: 'success' | 'reverted' }> = hash => client.getTransactionReceipt({ hash })) {}

  async process(bookingId: string): Promise<TicketTransaction | null> {
    const db = getDriver().session();
    try {
      const intent = await db.executeWrite(async tx => {
        const locked = await tx.run(`MATCH (b:Booking {bookingId: $bookingId})
          WHERE b.status = 'cancelled' OR (b.refundApprovedBy IS NOT NULL AND b.status IN ['confirmed', 'completed'])
          SET b.refundWriteVersion = coalesce(b.refundWriteVersion, 0) + 1 RETURN b`, { bookingId });
        const b = locked.records[0]?.get('b').properties;
        if (!b) throw new Error('A refund requires a cancelled booking');
        const cancelledAt = b.cancelledAt?.toStandardDate?.()?.getTime();
        const startsAt = b.slotDateTime?.toStandardDate?.()?.getTime();
        if (b.status !== 'cancelled' && Date.now() < startsAt + (Number(b.durationMinutes) || 25) * 60000) throw new Error('Support refunds require an ended lesson');
        if ((!Number.isFinite(cancelledAt) && !b.refundApprovedBy) || !Number.isFinite(startsAt)) {
          await tx.run("MATCH (b:Booking {bookingId: $bookingId}) SET b.refundStatus = 'review', b.refundError = 'Missing cancellation or lesson time'", { bookingId });
          return null;
        }
        if (!b.refundApprovedBy && startsAt - cancelledAt < REFUND_POLICY.NO_REFUND_HOURS * 3600_000) {
          await tx.run("MATCH (b:Booking {bookingId: $bookingId}) SET b.refundStatus = 'not_required'", { bookingId });
          return null;
        }
        const originals = await tx.run(`MATCH (o:TicketTransaction {bookingId: $bookingId, type: 'booking', status: 'completed'})
          OPTIONAL MATCH (s:Student {id: $studentId})
          RETURN o, coalesce(s.externalWalletAddress, s.smartWalletAddress, o.studentWallet) AS wallet`,
          { bookingId, studentId: b.studentId });
        const original = originals.records[0]?.get('o').properties;
        if (!original) {
          await tx.run("MATCH (b:Booking {bookingId: $bookingId}) SET b.refundStatus = 'not_required'", { bookingId });
          return null;
        }
        const refundId = `cancellation-refund-${bookingId}`;
        const legacy = await tx.run(`MATCH (r:TicketTransaction {bookingId: $bookingId, type: 'cancellation'})
          WHERE r.id <> $refundId RETURN r ORDER BY r.createdAt DESC LIMIT 1`, { bookingId, refundId });
        const previous = legacy.records[0]?.get('r').properties;
        if (previous) {
          await tx.run(`MATCH (b:Booking {bookingId: $bookingId}) SET b.refundStatus = $status,
            b.refunded = $refunded`, { bookingId, status: previous.status === 'completed' ? 'completed' : 'review', refunded: previous.status === 'completed' });
          return { ...previous, refundPhase: previous.status === 'completed' ? 'completed' : 'review' };
        }
        // Old cancellations have no durable dispatch record; their transfer outcome is unknown.
        if (number(b.cancellationRefundVersion) !== 1) {
          const error = 'Historical cancellation has no refund dispatch record. Verify its transfer history before issuing a refund.';
          await tx.run(`MATCH (b:Booking {bookingId: $bookingId}) SET b.refundStatus = 'review', b.refundError = $error
            MERGE (n:Notification {id: $id}) ON CREATE SET n.userId = 'admin', n.userType = 'admin',
              n.type = 'system', n.title = 'Cancellation refund needs review', n.message = $error,
              n.timestamp = $now, n.isRead = false, n.data = $data`, {
            bookingId, id: `${refundId}-review-notification`, error, now: new Date().toISOString(),
            data: JSON.stringify({ bookingId, errorMessage: error, link: '/tickets' }) });
          return null;
        }
        const result = await tx.run(`MATCH (b:Booking {bookingId: $bookingId}), (o:TicketTransaction {id: $originalId})
          MERGE (r:TicketTransaction {id: $refundId})
          ON CREATE SET r.bookingId = $bookingId, r.studentId = $studentId, r.studentWallet = $wallet,
            r.tokenId = $tokenId, r.tier = $tier, r.quantity = $quantity, r.type = 'cancellation',
            r.status = 'pending', r.refundPhase = 'queued', r.createdAt = $now,
            r.originalTransactionId = $originalId, r.reason = coalesce(b.refundApprovalReason, b.cancellationReason)
          MERGE (r)-[:REFUNDS]->(o)
          SET b.cancellationRefundVersion = 1, b.refundStatus = coalesce(b.refundStatus, 'pending'),
            r.studentWallet = CASE WHEN r.refundPhase = 'queued' THEN $wallet ELSE r.studentWallet END
          RETURN r`, { bookingId, refundId, studentId: b.studentId,
          wallet: originals.records[0]?.get('wallet') || '', tokenId: original.tokenId,
          tier: original.tier, quantity: number(original.quantity), originalId: original.id, now: new Date().toISOString() });
        return result.records[0]!.get('r').properties;
      });
      if (!intent) return null;
      if (intent.status === 'completed') { await this.finish(bookingId, intent.id, intent.transferTxId); return this.dto(intent); }
      if (intent.refundPhase === 'review') {
        await this.holdForReview(bookingId, intent.id, intent.lastError || 'An earlier refund needs verification before retrying.');
        return this.dto(intent);
      }
      if (!intent.refundPhase) return this.dto(intent);
      if (intent.refundPhase === 'dispatching') {
        if (!Number.isFinite(Date.parse(intent.leaseUntil || '')) || Date.parse(intent.leaseUntil) < Date.now()) await this.holdForReview(bookingId, intent.id, 'Transfer submission was interrupted; verify its outcome before retrying.');
        return this.dto(intent);
      }
      if (Date.parse(intent.nextAttemptAt || '') > Date.now()) return this.dto(intent);
      if (intent.refundPhase === 'submitted') {
        try {
          const result = await this.engine.transaction(intent.engineTransactionId);
          if (completed(result.status)) {
            await this.finish(bookingId, intent.id, result.transactionHash || result.id);
            return this.dto({ ...intent, status: 'completed', transferTxId: result.transactionHash || result.id });
          }
          if (failed(result.status)) {
            if (!result.transactionHash) {
              await this.holdForReview(bookingId, intent.id, result.error || 'Transfer failed without a verifiable on-chain receipt.');
              return this.dto({ ...intent, refundPhase: 'review' });
            }
            const receipt = await this.receipt(result.transactionHash as Hash);
            if (receipt.status === 'reverted') await this.retryLater(bookingId, intent.id, result.error || 'Transfer reverted', 'submitted');
            else {
              await this.finish(bookingId, intent.id, result.transactionHash);
              return this.dto({ ...intent, status: 'completed', transferTxId: result.transactionHash });
            }
          } else await db.run("MATCH (r:TicketTransaction {id: $id}) SET r.nextAttemptAt = $next", { id: intent.id, next: new Date(Date.now() + 30_000).toISOString() });
        } catch (error) {
          // Status lookup failures never trigger another transfer submission.
          await db.run("MATCH (r:TicketTransaction {id: $id}) SET r.lastError = $error, r.nextAttemptAt = $next", {
            id: intent.id, error: (error as Error).message, next: new Date(Date.now() + 30_000).toISOString() });
        }
        return this.dto(intent);
      }
      let args: string[], vault: string;
      try {
        if (!this.engine.configured()) throw new Error('Refund transfer service is not configured');
        if (!process.env.TICKET_CONTRACT_ADDRESS) throw new Error('Refund ticket contract is not configured on this network');
        vault = getAddress(process.env.VAULT_WALLET_ADDRESS || '');
        args = [vault, getAddress(intent.studentWallet), BigInt(intent.tokenId).toString(), String(number(intent.quantity)), '0x'];
      } catch (error) {
        await this.retryLater(bookingId, intent.id, (error as Error).message, 'queued');
        return this.dto(intent);
      }
      const claimed = await db.executeWrite(async tx => {
        await tx.run('MATCH (b:Booking {bookingId: $bookingId}) SET b.refundWriteVersion = coalesce(b.refundWriteVersion, 0) + 1', { bookingId });
        return tx.run(`MATCH (r:TicketTransaction {id: $id, refundPhase: 'queued'})
          WHERE r.nextAttemptAt IS NULL OR r.nextAttemptAt <= $now
          SET r.refundPhase = 'dispatching', r.leaseUntil = $lease, r.lastAttemptAt = $now RETURN r`,
          { id: intent.id, now: new Date().toISOString(), lease: new Date(Date.now() + 120_000).toISOString() });
      });
      if (!claimed.records.length) return this.dto(intent);
      let transfer: EngineTransaction;
      try {
        transfer = await this.engine.contractWrite({ abi: [{ type: 'function', name: 'safeTransferFrom', stateMutability: 'nonpayable',
          inputs: [{name:'from',type:'address'}, {name:'to',type:'address'}, {name:'id',type:'uint256'}, {name:'value',type:'uint256'}, {name:'data',type:'bytes'}], outputs: [] }],
          args, chainId: ticketChain.id,
          contractAddress: process.env.TICKET_CONTRACT_ADDRESS!, functionName: 'safeTransferFrom', walletAddress: vault });
      } catch (error) {
        if (error instanceof GmrEngineRequestError && [400, 401, 403, 404, 422, 429].includes(error.status)) {
          await this.retryLater(bookingId, intent.id, error.message, 'dispatching');
          return this.dto(intent);
        }
        await this.holdForReview(bookingId, intent.id, `Transfer outcome is uncertain: ${(error as Error).message}`);
        return this.dto({ ...intent, refundPhase: 'review' });
      }
      if (!transfer.id) {
        await this.holdForReview(bookingId, intent.id, 'Transfer response has no transaction identifier');
        return this.dto({ ...intent, refundPhase: 'review' });
      }
      await db.run(`MATCH (r:TicketTransaction {id: $id}) SET r.refundPhase = 'submitted',
        r.engineTransactionId = $engineId, r.engineTransactionIds = coalesce(r.engineTransactionIds, []) + [$engineId],
        r.transferTxId = $transferId REMOVE r.nextAttemptAt, r.lastError`, {
        id: intent.id, engineId: transfer.id, transferId: transfer.transactionHash || transfer.id });
      if (completed(transfer.status)) {
        await this.finish(bookingId, intent.id, transfer.transactionHash || transfer.id);
        return this.dto({ ...intent, status: 'completed', transferTxId: transfer.transactionHash || transfer.id });
      }
      return this.dto({ ...intent, transferTxId: transfer.id });
    } finally { await db.close(); }
  }

  private dto(record: any): TicketTransaction { return { ...record, quantity: number(record.quantity) }; }

  private async retryLater(bookingId: string, id: string, error: string, phase: string) {
    const db = getDriver().session();
    try {
      await db.run(`MATCH (b:Booking {bookingId: $bookingId}), (r:TicketTransaction {id: $id, refundPhase: $phase})
        SET b.refundStatus = 'pending', b.refundError = $error, r.refundPhase = 'queued', r.lastError = $error,
          r.nextAttemptAt = $next`, { bookingId, id, phase, error, next: new Date(Date.now() + 60_000).toISOString() });
    } finally { await db.close(); }
  }

  private async holdForReview(bookingId: string, id: string, error: string) {
    const db = getDriver().session();
    try {
      await db.executeWrite(async tx => {
        await tx.run(`MATCH (b:Booking {bookingId: $bookingId}), (r:TicketTransaction {id: $id})
          SET b.refundStatus = 'review', b.refundError = $error, r.refundPhase = 'review', r.lastError = $error,
            r.reason = 'Cancellation refund needs review: ' + $error`, { bookingId, id, error });
        await tx.run(`MERGE (n:Notification {id: $id}) ON CREATE SET n.userId = 'admin', n.userType = 'admin',
          n.type = 'system', n.title = 'Cancellation refund needs review', n.message = $error,
          n.timestamp = $now, n.isRead = false, n.data = $data`, {
          id: `${id}-review-notification`, now: new Date().toISOString(), error,
          data: JSON.stringify({ bookingId, transactionId: id, errorMessage: error, link: '/tickets' }) });
      });
    } finally { await db.close(); }
  }

  private async finish(bookingId: string, id: string, transferId?: string) {
    const db = getDriver().session();
    try {
      await db.executeWrite(async tx => {
        await tx.run(`MATCH (b:Booking {bookingId: $bookingId}), (r:TicketTransaction {id: $id})
          SET b.refunded = true, b.refundStatus = 'completed', r.status = 'completed',
            r.refundPhase = 'completed', r.transferTxId = $transferId, r.completedAt = coalesce(r.completedAt, $now)
          REMOVE b.refundError, r.lastError, r.nextAttemptAt`, { bookingId, id, transferId: transferId || null, now: new Date().toISOString() });
        await tx.run(`MATCH (b:Booking {bookingId: $bookingId})
          MERGE (n:Notification {id: $id}) ON CREATE SET n.userId = b.studentId, n.userType = 'student',
            n.type = 'system', n.title = 'Lesson ticket refunded', n.message = 'Your lesson ticket has been returned.',
            n.timestamp = $now, n.isRead = false, n.data = $data`,
          { bookingId, id: `${id}-notification`, now: new Date().toISOString(), data: JSON.stringify({ bookingId, link: '/schedule' }) });
      });
      const owner = await db.run('MATCH (b:Booking {bookingId: $bookingId}) RETURN b.studentId AS studentId', { bookingId });
      const studentId = owner.records[0]?.get('studentId');
      if (studentId) await invalidateCache(`student:*:${studentId}*`).catch(() => {});
    } finally { await db.close(); }
  }

  async reconcile(bookingIds?: string[]) {
    const db = getDriver().session();
    try {
      const result = await db.run(`MATCH (b:Booking) WHERE (b.status = 'cancelled' OR b.refundApprovedBy IS NOT NULL) AND coalesce(b.refunded, false) = false
        AND coalesce(b.refundStatus, '') IN ['', 'pending'] AND ($ids IS NULL OR b.bookingId IN $ids)
        AND ($ids IS NOT NULL OR b.testFixture IS NULL)
        OPTIONAL MATCH (r:TicketTransaction {id: 'cancellation-refund-' + b.bookingId})
        WITH b, r WHERE r.nextAttemptAt IS NULL OR r.nextAttemptAt <= $now
        RETURN b.bookingId AS id ORDER BY b.cancelledAt LIMIT 25`, { ids: bookingIds || null, now: new Date().toISOString() });
      for (const row of result.records) {
        try { await this.process(row.get('id')); }
        catch (error) { console.error('Cancellation refund reconciliation failed:', row.get('id'), (error as Error).message); }
      }
    } finally { await db.close(); }
  }
}

export const cancellationRefundService = new CancellationRefundService();
