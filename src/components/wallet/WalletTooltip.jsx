import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle, FiX } from 'react-icons/fi';

/**
 * A small popover anchored under the wallet button, used to surface connection
 * errors without pushing the surrounding layout around.
 *
 * Positioned absolutely, so the parent must be `relative`. `align` decides which
 * edge it hangs from — the navbar button sits hard against the right gutter, so
 * centring it there would push the panel off-screen on narrow viewports.
 */

const ALIGNMENT = {
  center: { panel: 'left-1/2 -translate-x-1/2', arrow: 'left-1/2 -translate-x-1/2' },
  right: { panel: 'right-0', arrow: 'right-6' },
  left: { panel: 'left-0', arrow: 'left-6' },
};

function WalletTooltip({ children, open, onClose, align = 'center' }) {
  // Escape closes it, matching the account menu's behaviour.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const position = ALIGNMENT[align] || ALIGNMENT.center;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          // role="alert" keeps this announced by screen readers, which the plain
          // red paragraph it replaced also did.
          role="alert"
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.96 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className={`absolute top-full z-[60] mt-3 w-max max-w-[min(20rem,calc(100vw-2rem))] ${position.panel}`}
        >
          {/* Arrow. Rotated square tucked under the panel's top edge. */}
          <div
            className={`absolute -top-1.5 h-3 w-3 rotate-45 rounded-[2px] bg-sapphire-900 ring-1 ring-white/10 ${position.arrow}`}
            aria-hidden="true"
          />

          <div className="relative flex items-start gap-2.5 rounded-xl bg-sapphire-900 px-3.5 py-3 text-left shadow-glass-lg ring-1 ring-white/10">
            <FiAlertCircle
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400"
              aria-hidden="true"
            />

            <div className="min-w-0 text-sm leading-snug text-white/90">{children}</div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Dismiss"
                className="-mr-1 -mt-1 flex-shrink-0 rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <FiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default WalletTooltip;
