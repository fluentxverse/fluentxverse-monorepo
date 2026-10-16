import { expect, test } from 'bun:test';
import { selectTicketChain, ticketChain, ticketRPC } from '../src/config/ticketChain';

test('wallets and transactions default to the same Base Sepolia network', () => {
  expect(ticketChain.id).toBe(84532);
  expect(ticketRPC).toBe('https://sepolia.base.org');
  expect(selectTicketChain(84532).blockExplorers.default.url).toContain('sepolia');
  expect(selectTicketChain(421614).id).toBe(421614);
  expect(() => selectTicketChain(8453)).toThrow();
});
