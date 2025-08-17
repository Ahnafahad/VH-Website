'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-lg border-b border-vh-beige/30 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 lg:h-24">
          {/* Logo Section */}
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex-shrink-0 group">
              <Image
                src="/vh-logo.png"
                alt="VH Beyond the Horizons"
                width={160}
                height={80}
                className="h-14 lg:h-16 w-auto transition-transform group-hover:scale-105"
                priority
              />
            </Link>
            <div className="hidden lg:block">
              <Image
                src="/vh-parent-logo.png"
                alt="VH Parent Company"
                width={48}
                height={48}
                className="h-12 w-12 transition-transform hover:scale-110"
              />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            <Link
              href="/"
              className="relative px-4 py-2 text-gray-800 hover:text-vh-red font-semibold transition-all duration-300 group"
            >
              Home
              <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-vh-red transition-all duration-300 group-hover:w-full group-hover:left-0"></span>
            </Link>
            <Link
              href="/eligibility-checker"
              className="relative px-4 py-2 text-gray-800 hover:text-vh-red font-semibold transition-all duration-300 group"
            >
              Eligibility Checker
              <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-vh-red transition-all duration-300 group-hover:w-full group-hover:left-0"></span>
            </Link>
            <Link
              href="/du-fbs-course"
              className="relative px-4 py-2 text-gray-800 hover:text-vh-red font-semibold transition-all duration-300 group"
            >
              DU FBS Course
              <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-vh-red transition-all duration-300 group-hover:w-full group-hover:left-0"></span>
            </Link>
            <div className="ml-4">
              <a
                href="https://forms.fillout.com/t/iCXMk5dbQsus"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-3 rounded-full font-bold text-sm uppercase tracking-wide hover:shadow-lg hover:shadow-vh-red/25 transform hover:-translate-y-1 transition-all duration-300"
              >
                Register Now
              </a>
            </div>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-3 rounded-xl text-gray-800 hover:text-vh-red hover:bg-vh-beige/20 transition-all duration-300"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden">
            <div className="px-2 pt-4 pb-6 space-y-2 bg-white border-t border-vh-beige/30 shadow-lg rounded-b-2xl">
              <Link
                href="/"
                className="block px-4 py-3 text-gray-800 hover:text-vh-red hover:bg-vh-beige/10 font-semibold rounded-xl transition-all duration-300"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/eligibility-checker"
                className="block px-4 py-3 text-gray-800 hover:text-vh-red hover:bg-vh-beige/10 font-semibold rounded-xl transition-all duration-300"
                onClick={() => setIsMenuOpen(false)}
              >
                Eligibility Checker
              </Link>
              <Link
                href="/du-fbs-course"
                className="block px-4 py-3 text-gray-800 hover:text-vh-red hover:bg-vh-beige/10 font-semibold rounded-xl transition-all duration-300"
                onClick={() => setIsMenuOpen(false)}
              >
                DU FBS Course
              </Link>
              <div className="pt-4">
                <a
                  href="https://forms.fillout.com/t/iCXMk5dbQsus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mx-2 bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-6 py-4 rounded-2xl font-bold text-center uppercase tracking-wide hover:shadow-lg transition-all duration-300"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Register Now
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;