import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { createWalletClient, custom, getAddress, type Address } from 'viem';
import { ticketChain, ticketRPC } from './ticketChain';
type SignMessageArgs = {
    message: string;
};
export type WalletAccount = {
    address: Address;
    signMessage: (args: SignMessageArgs) => Promise<`0x${string}`>;
};
type Eip1193Provider = {
    request: (args: {
        method: string;
        params?: unknown[] | Record<string, unknown>;
    }) => Promise<unknown>;
};
const TICKET_CHAIN_ID = ticketChain.id;
const TICKET_CHAIN_HEX = `0x${TICKET_CHAIN_ID.toString(16)}`;
function getProvider(): Eip1193Provider {
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No EVM wallet found. Please install or open this page in a wallet-enabled browser.');
    }
    return window.ethereum as unknown as Eip1193Provider;
}
async function switchToTicketChain(provider: Eip1193Provider) {
    try {
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: TICKET_CHAIN_HEX }]
        });
    }
    catch (error: any) {
        if (error?.code !== 4902) {
            throw error;
        }
        await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
                    chainId: TICKET_CHAIN_HEX,
                    chainName: ticketChain.name,
                    nativeCurrency: ticketChain.nativeCurrency,
                    rpcUrls: [ticketRPC],
                    blockExplorerUrls: [ticketChain.blockExplorers.default.url]
                }]
        });
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: TICKET_CHAIN_HEX }] });
    }
}
class BrowserWallet {
    private account: WalletAccount | null = null;
    async connect(): Promise<WalletAccount> {
        const provider = getProvider();
        const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
        await switchToTicketChain(provider);
        const address = getAddress(accounts?.[0] || '');
        const walletClient = createWalletClient({
            account: address,
            chain: ticketChain,
            transport: custom(provider)
        });
        this.account = {
            address,
            signMessage: (_props0) => walletClient.signMessage({ account: address, get message() {
                    return _props0["message"];
                } })
        };
        localStorage.setItem('fxv_wallet_connected', 'true');
        return this.account;
    }
    async autoConnect(): Promise<WalletAccount | null> {
        if (typeof window === 'undefined' || !window.ethereum)
            return null;
        if (localStorage.getItem('fxv_wallet_connected') !== 'true')
            return null;
        const provider = getProvider();
        const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
        if (!accounts?.[0])
            return null;
        await switchToTicketChain(provider);
        const address = getAddress(accounts[0]);
        const walletClient = createWalletClient({
            account: address,
            chain: ticketChain,
            transport: custom(provider)
        });
        this.account = {
            address,
            signMessage: (_props1) => walletClient.signMessage({ account: address, get message() {
                    return _props1["message"];
                } })
        };
        return this.account;
    }
    getAccount(): WalletAccount | null {
        return this.account;
    }
    async disconnect() {
        this.account = null;
        localStorage.removeItem('fxv_wallet_connected');
    }
}
export const appWallet = new BrowserWallet();
export async function connectWallet() {
    return appWallet.connect();
}
export async function autoConnectWallet() {
    return appWallet.autoConnect();
}
export async function getOrConnectWallet() {
    return appWallet.getAccount() || await appWallet.connect();
}
