package store

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

func (s *MemgraphStore) DisputeSyncCandidates(ctx context.Context, binding string, limit int) ([]DisputeSyncRecord, error) {
	if limit < 2 || limit > 32 {
		return nil, errors.New("invalid booking batch limit")
	}
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) { return batchCandidates(ctx, tx, binding, limit) })
	if err != nil {
		return nil, err
	}
	return result.([]DisputeSyncRecord), nil
}

type batchReader interface {
	Run(context.Context, string, map[string]any) (neo4j.ResultWithContext, error)
}

func batchCandidates(ctx context.Context, reader batchReader, binding string, limit int) ([]DisputeSyncRecord, error) {
	rows, err := reader.Run(ctx, `MATCH(r:DisputeSyncRecord {binding:$binding}) WHERE r.state<>'finalized'
 RETURN r.json AS json ORDER BY r.sequence LIMIT $limit`, map[string]any{"binding": binding, "limit": int64(limit)})
	if err != nil {
		return nil, err
	}
	records := []DisputeSyncRecord{}
	for rows.Next(ctx) {
		v, _ := rows.Record().Get("json")
		var r DisputeSyncRecord
		if err = json.Unmarshal([]byte(v.(string)), &r); err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	return records, rows.Err()
}

// Freeze the entire group atomically, before any wallet is locked or transaction signed.
func (s *MemgraphStore) DisputeSyncCreateBatch(ctx context.Context, binding string, expected []DisputeSyncRecord, plan json.RawMessage) (*DisputeSyncRecord, error) {
	if len(expected) < 2 || len(expected) > 32 || !json.Valid(plan) {
		return nil, errors.New("invalid batch claim")
	}
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	result, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if err := batchLock(ctx, tx, binding); err != nil {
			return nil, err
		}
		actual, err := batchCandidates(ctx, tx, binding, len(expected))
		if err != nil {
			return nil, err
		}
		if len(actual) != len(expected) {
			return nil, errors.New("booking batch candidates changed")
		}
		leader := actual[0]
		leader.BatchMembers = []string{}
		leader.BatchEvents = []json.RawMessage{}
		for i, r := range actual {
			if r.ID != expected[i].ID || r.Sequence != expected[i].Sequence || r.Sequence != leader.Sequence+int64(i) || !bytes.Equal(r.Event, expected[i].Event) ||
				r.State != "queued" || r.Step != 0 || len(r.Plan) != 0 || r.Raw != "" || r.Hash != "" || r.BatchLeader != "" || len(r.BatchMembers) != 0 {
				return nil, errors.New("booking batch candidate no longer untouched")
			}
			leader.BatchMembers = append(leader.BatchMembers, r.ID)
			leader.BatchEvents = append(leader.BatchEvents, r.Event)
		}
		leader.BatchLeader = leader.ID
		leader.Plan = plan
		leader.BatchState = "queued"
		leader.State = "review"
		for i, r := range actual {
			r.BatchLeader = leader.ID
			r.State = "review"
			r.BatchState = "blocked"
			if i == 0 {
				r = leader
			}
			if err = batchWrite(ctx, tx, binding, r); err != nil {
				return nil, err
			}
		}
		return leader, nil
	})
	if err != nil {
		return nil, err
	}
	r := result.(DisputeSyncRecord)
	return &r, nil
}
func batchLock(ctx context.Context, tx neo4j.ManagedTransaction, binding string) error {
	r, err := tx.Run(ctx, `MATCH(c:DisputeSyncCursor {id:$id}) SET c.write=coalesce(c.write,0)+1 RETURN c.id`, map[string]any{"id": binding})
	if err != nil {
		return err
	}
	if !r.Next(ctx) {
		return errors.New("booking batch binding missing")
	}
	return r.Err()
}
func batchWrite(ctx context.Context, tx neo4j.ManagedTransaction, binding string, r DisputeSyncRecord) error {
	b, err := json.Marshal(r)
	if err != nil {
		return err
	}
	result, err := tx.Run(ctx, `MATCH(r:DisputeSyncRecord {id:$id,binding:$binding}) SET r.json=$json,r.state=$state RETURN r.id`, map[string]any{"id": r.ID, "binding": binding, "json": string(b), "state": r.State})
	if err != nil {
		return err
	}
	if !result.Next(ctx) {
		return errors.New("booking batch member missing")
	}
	return result.Err()
}

// Receipt, every member's final state, and nonce release commit together, including on retries.
func (s *MemgraphStore) DisputeSyncFinalizeBatch(ctx context.Context, binding string, leader DisputeSyncRecord, project, wallet, lockID, blockHash string) error {
	if len(leader.BatchMembers) < 2 || len(leader.BatchMembers) > 32 || len(leader.BatchEvents) != len(leader.BatchMembers) || leader.BatchLeader != leader.ID || leader.Hash == "" || blockHash == "" {
		return errors.New("invalid batch finality")
	}
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if err := batchLock(ctx, tx, binding); err != nil {
			return nil, err
		}
		members := make([]DisputeSyncRecord, len(leader.BatchMembers))
		already := false
		for i, id := range leader.BatchMembers {
			rows, err := tx.Run(ctx, `MATCH(r:DisputeSyncRecord {binding:$binding,id:$id}) RETURN r.json AS json`, map[string]any{"binding": binding, "id": id})
			if err != nil {
				return nil, err
			}
			if !rows.Next(ctx) {
				return nil, errors.New("booking batch member disappeared")
			}
			v, _ := rows.Record().Get("json")
			if err = json.Unmarshal([]byte(v.(string)), &members[i]); err != nil {
				return nil, err
			}
			r := members[i]
			if i == 0 {
				already = r.State == "finalized"
				if !already && (r.Hash != leader.Hash || r.Raw != leader.Raw || r.Wallet != leader.Wallet || !bytes.Equal(r.Plan, leader.Plan)) {
					return nil, errors.New("batch signed journal changed")
				}
				if len(r.BatchMembers) != len(leader.BatchMembers) || len(r.BatchEvents) != len(leader.BatchEvents) {
					return nil, errors.New("batch membership changed")
				}
				for j := range r.BatchMembers {
					if r.BatchMembers[j] != leader.BatchMembers[j] || !bytes.Equal(r.BatchEvents[j], leader.BatchEvents[j]) {
						return nil, errors.New("batch membership changed")
					}
				}
			}
			if r.ID != id || r.BatchLeader != leader.ID || !bytes.Equal(r.Event, leader.BatchEvents[i]) || r.Sequence != leader.Sequence+int64(i) ||
				(already && (r.State != "finalized" || r.BatchHash != leader.Hash)) || (!already && r.State != "review") {
				return nil, errors.New("booking batch member changed")
			}
		}
		if !already {
			locks, err := tx.Run(ctx, `MATCH(l:EngineWalletLock {appId:$project,walletAddress:$wallet,transactionId:$lock}) RETURN l.transactionId`, map[string]any{"project": project, "wallet": strings.ToLower(wallet), "lock": lockID})
			if err != nil {
				return nil, err
			}
			if !locks.Next(ctx) {
				return nil, errors.New("booking batch nonce reservation missing")
			}
		}
		receipt, err := tx.Run(ctx, `MERGE(r:DisputeSyncReceipt {id:$id}) ON CREATE SET r.binding=$binding,r.hash=$hash,r.blockHash=$block,r.recordedAt=timestamp()
   RETURN r.binding AS binding,r.hash AS hash,r.blockHash AS block`, map[string]any{"id": lockID, "binding": binding, "hash": leader.Hash, "block": blockHash})
		if err != nil {
			return nil, err
		}
		if !receipt.Next(ctx) {
			return nil, errors.New("booking batch receipt missing")
		}
		row := receipt.Record()
		b, _ := row.Get("binding")
		h, _ := row.Get("hash")
		bh, _ := row.Get("block")
		if b != binding || h != leader.Hash || bh != blockHash {
			return nil, errors.New("booking batch receipt changed")
		}
		if already {
			return nil, nil
		}
		for _, r := range members {
			r.State = "finalized"
			r.BatchState = "finalized"
			r.BatchHash = leader.Hash
			r.BlockHash = blockHash
			r.Step = 1
			r.Raw = ""
			r.Hash = ""
			r.Wallet = ""
			r.Error = ""
			if err = batchWrite(ctx, tx, binding, r); err != nil {
				return nil, err
			}
		}
		_, err = tx.Run(ctx, `MATCH(l:EngineWalletLock {appId:$project,walletAddress:$wallet,transactionId:$lock}) DETACH DELETE l`, map[string]any{"project": project, "wallet": strings.ToLower(wallet), "lock": lockID})
		return nil, err
	})
	return err
}
