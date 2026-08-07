/**
 * EIP-1193 provider vocabulary.
 *
 * These are all strings and numbers defined by the spec, not by us, so they are
 * collected here rather than typed out at each call site. The event names in
 * particular get written twice (once to subscribe, once to unsubscribe) and a
 * typo in the second one leaks the listener without failing anything.
 */

/** JSON-RPC methods we call on the provider. */
export const RPC_METHOD = {
  /** Prompts the user with the MetaMask approval popup. */
  REQUEST_ACCOUNTS: 'eth_requestAccounts',
  /** Silent counterpart: returns already-authorised accounts, never prompts. */
  ACCOUNTS: 'eth_accounts',
  CHAIN_ID: 'eth_chainId',
};

/** Provider events we subscribe to. */
export const WALLET_EVENT = {
  ACCOUNTS_CHANGED: 'accountsChanged',
  CHAIN_CHANGED: 'chainChanged',
};

/** EIP-1193 error codes. */
export const PROVIDER_ERROR = {
  /** The user clicked Cancel on the connection prompt. */
  USER_REJECTED: 4001,
  /** A prompt is already open and awaiting the user. */
  REQUEST_PENDING: -32002,
};

export const METAMASK_DOWNLOAD_URL = 'https://metamask.io/download/';

/** User-facing copy for the failures we can recognise. */
export const WALLET_ERROR_MESSAGE = {
  NOT_INSTALLED: 'MetaMask is not installed.',
  REJECTED: 'Connection request rejected.',
  PENDING: 'A connection request is already pending. Open the MetaMask extension.',
  FALLBACK: 'Could not connect to MetaMask.',
};
