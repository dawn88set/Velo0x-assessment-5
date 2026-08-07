import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiMenu, FiX } from 'react-icons/fi';

import ConnectWalletButton from '../wallet/ConnectWalletButton';

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close on navigation, so a browser back/forward can't leave the overlay up.
  useEffect(() => setIsOpen(false), [location.pathname]);

  // While the overlay is up: Escape closes it, and the page behind must not
  // scroll, otherwise the backdrop sits still while content slides underneath.
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Properties', href: '/properties' },
    { name: 'About', href: '/about' },
    { name: 'FAQ', href: '/faq' },
    { name: 'Blog', href: '/blog' },
  ];

  return (
    <nav className="glass-nav sticky top-0 z-50">
      <div className="container">
        <div className="flex justify-between items-center h-16 gap-2">
          <div className="flex min-w-0">
            <Link to="/" className="flex items-center min-w-0">
              <svg
                width="30"
                height="35"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="flex-shrink-0"
                aria-hidden="true"
              >
                <circle cx="15" cy="20" r="10" stroke="#2660d3" />
                <circle cx="15" cy="20" r="6" stroke="#2660d3" strokeWidth="3" />
              </svg>
              <span className="text-xl sm:text-2xl font-bold text-primary-600 mt-1.5 truncate">
                GoldenProp
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-4 lg:space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="text-sapphire-700 hover:text-primary-600 px-2 lg:px-3 py-2 text-sm font-medium transition-colors duration-300 relative group whitespace-nowrap"
              >
                {item.name}
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary-500 to-primary-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></span>
              </Link>
            ))}
            {/* Right-aligned: this button sits against the right gutter, so a
                centred tooltip would hang off the edge of the viewport. */}
            <ConnectWalletButton tooltipAlign="right" />
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              type="button"
              className="text-secondary-600 hover:text-primary-600 p-2 -mr-2"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
            >
              {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation. An overlay rather than part of the flow, so opening it
          floats over the page instead of pushing the content down. */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-x-0 bottom-0 top-16 z-40 bg-sapphire-900/30 backdrop-blur-sm md:hidden"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />

            <motion.div
              id="mobile-menu"
              className="absolute inset-x-0 top-full z-50 md:hidden"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {/* Full-bleed and fully opaque, like a native sheet. Anything less
                  than opaque let the dark hero card behind it show through and
                  made the links hard to read. */}
              <div className="border-b border-platinum-200 bg-white pb-3 pt-1 shadow-glass-lg">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="block border-b border-platinum-100 px-5 py-3.5 text-base font-medium text-sapphire-700 transition-colors duration-200 hover:bg-platinum-50 hover:text-primary-600 active:bg-platinum-100"
                    onClick={() => setIsOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                <div className="px-4 pt-4">
                  <ConnectWalletButton fullWidth className="btn px-3 py-2.5 text-base font-medium" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}

export default Navbar;
