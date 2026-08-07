import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  METAMASK_DOWNLOAD_URL,
  PROVIDER_ERROR,
  RPC_METHOD,
  WALLET_ERROR_MESSAGE,
  WALLET_EVENT,
} from '../constants/ethereum';

const WalletContext = createContext(null);

// Re-exported so consumers of the wallet can reach it without also importing the
// constants module.
export { METAMASK_DOWNLOAD_URL };

/**
 * Resolve the MetaMask provider specifically.
 *
 * When several wallet extensions are installed they all race to set
 * `window.ethereum`, and the winner may not be MetaMask. EIP-5749 wallets expose
 * the full list on `window.ethereum.providers`, so prefer that.
 */
export function getMetaMaskProvider() {
  if (typeof window === 'undefined' || !window.ethereum) return null;

  const { ethereum } = window;

  if (Array.isArray(ethereum.providers)) {
    return ethereum.providers.find((p) => p.isMetaMask) || null;
  }

  return ethereum.isMetaMask ? ethereum : null;
}

/** 0x1234…9abc */
export function formatAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Map an EIP-1193 error onto something a user can act on. */
function toFriendlyError(err) {
  switch (err?.code) {
    case PROVIDER_ERROR.USER_REJECTED:
      return WALLET_ERROR_MESSAGE.REJECTED;
    case PROVIDER_ERROR.REQUEST_PENDING:
      return WALLET_ERROR_MESSAGE.PENDING;
    default:
      return err?.message || WALLET_ERROR_MESSAGE.FALLBACK;
  }
}

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Guards against setting state after unmount (the eager-connect effect and the
  // connect() promise both resolve asynchronously).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Held in state, not read ad hoc, so the listener effect below re-runs if the
  // provider only becomes available after mount. MetaMask usually injects
  // window.ethereum before React mounts, but not always, and if we only looked
  // once at mount, a late injection would leave `accountsChanged` unsubscribed
  // for the lifetime of the page, silently ignoring every account switch.
  const [provider, setProvider] = useState(getMetaMaskProvider);
  const hasProvider = Boolean(provider);

  const disconnect = useCallback(() => {
    // MetaMask exposes no programmatic disconnect. A dapp can only forget the
    // account on its side. Revoking access is done from the extension itself.
    setAccount(null);
    setChainId(null);
    setError(null);
  }, []);

  const connect = useCallback(async () => {
    // Re-resolve rather than trusting the mounted value: this is the moment a
    // late-injected provider gets picked up and published to the listener effect.
    const active = getMetaMaskProvider();

    if (!active) {
      // Clear the cached provider too, otherwise `hasProvider` stays true from
      // mount and the UI withholds the "Install MetaMask" link while telling the
      // user MetaMask is missing.
      setProvider(null);
      setError(WALLET_ERROR_MESSAGE.NOT_INSTALLED);
      return;
    }

    setProvider(active);
    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await active.request({ method: RPC_METHOD.REQUEST_ACCOUNTS });
      const currentChain = await active.request({ method: RPC_METHOD.CHAIN_ID });

      if (!mounted.current) return;

      setAccount(accounts?.[0] ?? null);
      setChainId(currentChain ?? null);
    } catch (err) {
      if (mounted.current) setError(toFriendlyError(err));
    } finally {
      if (mounted.current) setIsConnecting(false);
    }
  }, []);

  // Restore an already-authorised account on mount. `eth_accounts` is the silent
  // counterpart to `eth_requestAccounts`: it never opens the MetaMask popup, so a
  // page refresh keeps the connected state without nagging the user.
  useEffect(() => {
    if (!provider) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const accounts = await provider.request({ method: RPC_METHOD.ACCOUNTS });
        if (cancelled || !accounts?.length) return;

        const currentChain = await provider.request({ method: RPC_METHOD.CHAIN_ID });
        if (cancelled) return;

        setAccount(accounts[0]);
        setChainId(currentChain ?? null);
      } catch {
        // Silent path. Never surface an error the user did not ask for.
      }
    })();

    return () => { cancelled = true; };
  }, [provider]);

  // Keep in sync with the wallet: account switches, locking, and network changes.
  useEffect(() => {
    if (!provider?.on) return undefined;

    const handleAccountsChanged = (accounts) => {
      if (!accounts || accounts.length === 0) {
        // Emitted when the user locks MetaMask or revokes this site's access.
        setAccount(null);
        setChainId(null);
      } else {
        setAccount(accounts[0]);
        setError(null);
      }
    };

    const handleChainChanged = (nextChainId) => setChainId(nextChainId);

    provider.on(WALLET_EVENT.ACCOUNTS_CHANGED, handleAccountsChanged);
    provider.on(WALLET_EVENT.CHAIN_CHANGED, handleChainChanged);

    return () => {
      provider.removeListener?.(WALLET_EVENT.ACCOUNTS_CHANGED, handleAccountsChanged);
      provider.removeListener?.(WALLET_EVENT.CHAIN_CHANGED, handleChainChanged);
    };
  }, [provider]);

  const value = useMemo(
    () => ({
      account,
      chainId,
      isConnecting,
      error,
      hasProvider,
      isConnected: Boolean(account),
      connect,
      disconnect,
      clearError: () => setError(null),
    }),
    [account, chainId, isConnecting, error, hasProvider, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a <WalletProvider>');
  }
  return context;
}
