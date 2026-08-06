import { useEffect, useRef, useState } from 'react';
import { FaWallet } from 'react-icons/fa';
import { FiCheck, FiCopy, FiLogOut } from 'react-icons/fi';

import { METAMASK_DOWNLOAD_URL, formatAddress, useWallet } from '../../context/WalletContext';

/**
 * The single Connect / connected-address control, used in the navbar (desktop and
 * mobile) and in the homepage CTA. `className` lets each site restyle it without
 * duplicating the behaviour.
 */
function ConnectWalletButton({ className = 'btn', fullWidth = false, showIcon = true }) {
  const { account, isConnected, isConnecting, error, hasProvider, connect, disconnect } = useWallet();

  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);

  // Close the account menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied — not worth interrupting the user over.
    }
  };

  const widthClass = fullWidth ? 'w-full justify-center' : '';

  if (isConnected) {
    return (
      <div ref={containerRef} className={`relative ${fullWidth ? 'w-full' : ''}`}>
        <button
          type="button"
          className={`${className} ${widthClass}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Connected wallet ${account}. Open account menu.`}
        >
          <span
            className="mr-2 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-green-400"
            aria-hidden="true"
          />
          <span className="font-mono">{formatAddress(account)}</span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-platinum-200 bg-white shadow-luxe"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center px-4 py-2 text-sm text-sapphire-700 hover:bg-platinum-50"
              onClick={copyAddress}
            >
              {copied ? <FiCheck className="mr-2 text-green-600" /> : <FiCopy className="mr-2" />}
              {copied ? 'Copied' : 'Copy address'}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center px-4 py-2 text-sm text-sapphire-700 hover:bg-platinum-50"
              onClick={() => {
                disconnect();
                setMenuOpen(false);
              }}
            >
              <FiLogOut className="mr-2" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={fullWidth ? 'w-full' : 'relative'}>
      <button
        type="button"
        className={`${className} ${widthClass} disabled:cursor-not-allowed disabled:opacity-60`}
        onClick={connect}
        disabled={isConnecting}
        aria-busy={isConnecting}
      >
        {showIcon && <FaWallet className="mr-2 flex-shrink-0" aria-hidden="true" />}
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>

      {error && (
        <p role="alert" className="mt-2 max-w-[16rem] text-xs text-red-600">
          {error}
          {!hasProvider && (
            <>
              {' '}
              <a
                href={METAMASK_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Install MetaMask
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}

export default ConnectWalletButton;
