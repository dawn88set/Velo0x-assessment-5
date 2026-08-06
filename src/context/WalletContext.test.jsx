import { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { click } from '../test-utils/interactions';

import { WalletProvider, formatAddress, useWallet } from './WalletContext';

const ACCOUNT = '0x1234567890abcdef1234567890abcdef12345678';

/** Minimal EIP-1193 stub with a recorded listener registry. */
function createProvider({ requestAccounts } = {}) {
  const listeners = {};

  return {
    isMetaMask: true,
    listeners,
    on: jest.fn((event, handler) => {
      listeners[event] = [...(listeners[event] || []), handler];
    }),
    removeListener: jest.fn((event, handler) => {
      listeners[event] = (listeners[event] || []).filter((h) => h !== handler);
    }),
    emit(event, payload) {
      (listeners[event] || []).forEach((handler) => handler(payload));
    },
    request: jest.fn(({ method }) => {
      switch (method) {
        case 'eth_accounts':
          return Promise.resolve([]);
        case 'eth_requestAccounts':
          return requestAccounts ? requestAccounts() : Promise.resolve([ACCOUNT]);
        case 'eth_chainId':
          return Promise.resolve('0x1');
        default:
          return Promise.reject(new Error(`Unhandled method ${method}`));
      }
    }),
  };
}

/** Renders the context's state as text so tests can assert on it. */
function WalletProbe() {
  const { account, isConnected, error, connect } = useWallet();
  return (
    <div>
      <button type="button" onClick={connect}>Connect</button>
      <span data-testid="account">{account || 'none'}</span>
      <span data-testid="connected">{String(isConnected)}</span>
      <span data-testid="error">{error || 'none'}</span>
    </div>
  );
}

const renderWallet = () =>
  render(
    <WalletProvider>
      <WalletProbe />
    </WalletProvider>,
  );

afterEach(() => {
  delete window.ethereum;
  jest.clearAllMocks();
});

describe('formatAddress', () => {
  it('truncates the middle of an address', () => {
    expect(formatAddress(ACCOUNT)).toBe('0x1234…5678');
  });

  it('returns an empty string when there is no address', () => {
    expect(formatAddress(null)).toBe('');
  });
});

describe('WalletProvider', () => {
  it('connects and exposes the account', async () => {
    window.ethereum = createProvider();
    renderWallet();

    await click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent(ACCOUNT));
    expect(screen.getByTestId('connected')).toHaveTextContent('true');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
  });

  it('reports a friendly message when the user rejects the request (EIP-1193 4001)', async () => {
    const rejection = Object.assign(new Error('User rejected the request.'), { code: 4001 });
    window.ethereum = createProvider({ requestAccounts: () => Promise.reject(rejection) });
    renderWallet();

    await click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('Connection request rejected.'),
    );
    expect(screen.getByTestId('connected')).toHaveTextContent('false');
  });

  it('reports a pending request (EIP-1193 -32002)', async () => {
    const pending = Object.assign(new Error('Already processing'), { code: -32002 });
    window.ethereum = createProvider({ requestAccounts: () => Promise.reject(pending) });
    renderWallet();

    await click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent(/already pending/i),
    );
  });

  it('tells the user when MetaMask is not installed', async () => {
    // No window.ethereum at all.
    renderWallet();

    await click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('MetaMask is not installed.'),
    );
  });

  it('ignores a non-MetaMask injected provider', async () => {
    window.ethereum = { isMetaMask: false, request: jest.fn() };
    renderWallet();

    await click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('MetaMask is not installed.'),
    );
    expect(window.ethereum.request).not.toHaveBeenCalled();
  });

  it('picks MetaMask out of a multi-wallet providers array', async () => {
    const metamask = createProvider();
    window.ethereum = {
      isMetaMask: false,
      providers: [{ isCoinbaseWallet: true, request: jest.fn() }, metamask],
      request: jest.fn(),
    };
    renderWallet();

    await click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent(ACCOUNT));
  });

  it('restores an already-authorised account without prompting', async () => {
    const provider = createProvider();
    provider.request = jest.fn(({ method }) =>
      method === 'eth_accounts'
        ? Promise.resolve([ACCOUNT])
        : Promise.resolve('0x1'),
    );
    window.ethereum = provider;

    renderWallet();

    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent(ACCOUNT));
    // The silent path must never call the popup-triggering method.
    expect(provider.request).not.toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
  });

  it('switches account when the wallet emits accountsChanged', async () => {
    const provider = createProvider();
    window.ethereum = provider;
    renderWallet();

    await click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent(ACCOUNT));

    const nextAccount = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    act(() => provider.emit('accountsChanged', [nextAccount]));

    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent(nextAccount));
  });

  it('clears state when accountsChanged reports an empty list (wallet locked)', async () => {
    const provider = createProvider();
    window.ethereum = provider;
    renderWallet();

    await click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('true'));

    act(() => provider.emit('accountsChanged', []));

    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('false'));
    expect(screen.getByTestId('account')).toHaveTextContent('none');
  });

  it('subscribes to accountsChanged even when MetaMask injects after mount', async () => {
    // Regression: the listener effect used to read the provider once at mount and
    // bail out if it was absent. MetaMask normally injects window.ethereum before
    // React mounts, but when it is late the listeners were never attached, so
    // every subsequent account switch was silently ignored for the page lifetime.
    renderWallet(); // no window.ethereum yet

    const provider = createProvider();
    window.ethereum = provider;

    await click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent(ACCOUNT));

    const nextAccount = '0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed';
    act(() => provider.emit('accountsChanged', [nextAccount]));

    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent(nextAccount));
  });

  it('removes its listeners on unmount', async () => {
    const provider = createProvider();
    window.ethereum = provider;
    const { unmount } = renderWallet();

    await waitFor(() => expect(provider.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function)));

    unmount();

    expect(provider.removeListener).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
    expect(provider.removeListener).toHaveBeenCalledWith('chainChanged', expect.any(Function));
  });
});
