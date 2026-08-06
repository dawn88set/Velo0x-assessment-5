import { render, screen, waitFor } from '@testing-library/react';

import { click } from '../../test-utils/interactions';
import {
  METAMASK_DOWNLOAD_URL,
  PROVIDER_ERROR,
  RPC_METHOD,
  WALLET_ERROR_MESSAGE,
} from '../../constants/ethereum';

import ConnectWalletButton from './ConnectWalletButton';
import { WalletProvider } from '../../context/WalletContext';

const ACCOUNT = '0x1234567890abcdef1234567890abcdef12345678';

function mockMetaMask({ requestAccounts } = {}) {
  window.ethereum = {
    isMetaMask: true,
    on: jest.fn(),
    removeListener: jest.fn(),
    request: jest.fn(({ method }) => {
      if (method === RPC_METHOD.ACCOUNTS) return Promise.resolve([]);
      if (method === RPC_METHOD.CHAIN_ID) return Promise.resolve('0x1');
      if (method === RPC_METHOD.REQUEST_ACCOUNTS) {
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
    expect(alert).toHaveTextContent(WALLET_ERROR_MESSAGE.NOT_INSTALLED);
    expect(screen.getByRole('link', { name: /install metamask/i }))
      .toHaveAttribute('href', METAMASK_DOWNLOAD_URL);
  });

  it('still offers the install link when the wallet disappears after mount', async () => {
    // Regression: hasProvider was captured at mount, so if the extension was
    // present then and gone by the time Connect was clicked, the UI said
    // "MetaMask is not installed" while withholding the install link.
    mockMetaMask();
    renderButton();

    delete window.ethereum;
    await click(screen.getByRole('button', { name: /connect wallet/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(WALLET_ERROR_MESSAGE.NOT_INSTALLED);
    expect(screen.getByRole('link', { name: /install metamask/i })).toBeInTheDocument();
  });

  it('dismisses the error tooltip via its close button', async () => {
    renderButton();

    await click(screen.getByRole('button', { name: /connect wallet/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await click(screen.getByRole('button', { name: /dismiss/i }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('surfaces a rejection as an alert and stays disconnected', async () => {
    const rejection = Object.assign(new Error('User rejected'), { code: PROVIDER_ERROR.USER_REJECTED });
    mockMetaMask({ requestAccounts: () => Promise.reject(rejection) });
    renderButton();

    await click(screen.getByRole('button', { name: /connect wallet/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(WALLET_ERROR_MESSAGE.REJECTED);
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
