import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';

import ConnectWalletButton from '../wallet/ConnectWalletButton';

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

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
            <ConnectWalletButton />
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

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden" id="mobile-menu">
            <div className="pt-2 pb-3 space-y-1 bg-glass backdrop-blur-xl rounded-b-2xl border-t border-glass">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="block px-3 py-2 text-base font-medium text-sapphire-700 hover:text-primary-600 hover:bg-glass-light rounded-xl mx-2 transition-all duration-300"
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="px-2 pt-2">
                <ConnectWalletButton fullWidth className="btn px-3 py-2 text-base font-medium" />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
