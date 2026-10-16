import { arbitrumSepolia, baseSepolia } from 'viem/chains';

export function selectTicketChain(id: number) {
  const chain = [baseSepolia, arbitrumSepolia].find(chain => chain.id === id);
  if (!chain) throw new Error(`Unsupported ticket chain ${id}`);
  return chain;
}

export const ticketChain = selectTicketChain(Number(import.meta.env?.VITE_TICKET_CHAIN_ID || baseSepolia.id));
// Browser RPCs are public; authenticated Alchemy access stays in GMR Engine.
export const ticketRPC = import.meta.env?.VITE_TICKET_RPC_URL || ticketChain.rpcUrls.default.http[0];
