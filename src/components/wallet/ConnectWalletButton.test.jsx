import { render, screen, waitFor } from '@testing-library/react';

import { click } from '../../test-utils/interactions';

import ConnectWalletButton from './ConnectWalletButton';
import { WalletProvider } from '../../context/WalletContext';

const ACCOUNT = '0x1234567890abcdef1234567890abcdef12345678';

function mockMetaMask({ requestAccounts } = {}) {
  window.ethereum = {
    isMetaMask: true,
    on: jest.fn(),
    removeListener: jest.fn(),
    request: jest.fn(({ method }) => {
      if (method === 'eth_accounts') return Promise.resolve([]);
      if (method === 'eth_chainId') return Promise.resolve('0x1');
      if (method === 'eth_requestAccounts') {
        return requestAccounts ? requestAccounts() : Promise.resolve([ACCOUNT]);
      }
      return Promise.reject(new Error(`Unhandled ${method}`));
    }),
  };
  return window.ethereum;
}

const renderButton = (props) =>
  render(
    <WalletProvider>
      <ConnectWalletButton {...props} />
    </WalletProvider>,
  );

afterEach(() => {
  delete window.ethereum;
  jest.clearAllMocks();
});

describe('ConnectWalletButton', () => {
  it('shows "Connect Wallet" before connecting', () => {
    mockMetaMask();
    renderButton();

    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('displays the truncated address once connected', async () => {
    mockMetaMask();
    renderButton();

    await click(screen.getByRole('button', { name: /connect wallet/i }));

    await waitFor(() => expect(screen.getByText('0x1234…5678')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
  });

  it('offers a MetaMask install link when no wallet is present', async () => {
    renderButton();

    await click(screen.getByRole('button', { name: /connect wallet/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('MetaMask is not installed.');
    expect(screen.getByRole('link', { name: /install metamask/i }))
      .toHaveAttribute('href', 'https://metamask.io/download/');
  });

  it('surfaces a rejection as an alert and stays disconnected', async () => {
    const rejection = Object.assign(new Error('User rejected'), { code: 4001 });
    mockMetaMask({ requestAccounts: () => Promise.reject(rejection) });
    renderButton();

    await click(screen.getByRole('button', { name: /connect wallet/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Connection request rejected.');
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeEnabled();
  });

  it('disables the button while a connection is in flight', async () => {
    let resolveAccounts;
    mockMetaMask({ requestAccounts: () => new Promise((r) => { resolveAccounts = r; }) });
    renderButton();

    await click(screen.getByRole('button', { name: /connect wallet/i }));

    const button = await screen.findByRole('button', { name: /connecting/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    resolveAccounts([ACCOUNT]);
    await waitFor(() => expect(screen.getByText('0x1234…5678')).toBeInTheDocument());
  });

  it('disconnects from the account menu', async () => {
    mockMetaMask();
    renderButton();

    await click(screen.getByRole('button', { name: /connect wallet/i }));
    await waitFor(() => expect(screen.getByText('0x1234…5678')).toBeInTheDocument());

    await click(screen.getByText('0x1234…5678'));
    await click(screen.getByRole('menuitem', { name: /disconnect/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument(),
    );
  });
});
