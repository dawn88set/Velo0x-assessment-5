import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const WalletContext = createContext(null);

export const METAMASK_DOWNLOAD_URL = 'https://metamask.io/download/';

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
    case 4001:
      return 'Connection request rejected.';
    case -32002:
      return 'A connection request is already pending — open the MetaMask extension.';
    default:
      return err?.message || 'Could not connect to MetaMask.';
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

  const hasProvider = useMemo(() => Boolean(getMetaMaskProvider()), []);

  const disconnect = useCallback(() => {
    // MetaMask exposes no programmatic disconnect — a dapp can only forget the
    // account on its side. Revoking access is done from the extension itself.
    setAccount(null);
    setChainId(null);
    setError(null);
  }, []);

  const connect = useCallback(async () => {
    const provider = getMetaMaskProvider();

    if (!provider) {
      setError('MetaMask is not installed.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const currentChain = await provider.request({ method: 'eth_chainId' });

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
    const provider = getMetaMaskProvider();
    if (!provider) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const accounts = await provider.request({ method: 'eth_accounts' });
        if (cancelled || !accounts?.length) return;

        const currentChain = await provider.request({ method: 'eth_chainId' });
        if (cancelled) return;

        setAccount(accounts[0]);
        setChainId(currentChain ?? null);
      } catch {
        // Silent path — never surface an error the user did not ask for.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Keep in sync with the wallet: account switches, locking, and network changes.
  useEffect(() => {
    const provider = getMetaMaskProvider();
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

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, []);

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
