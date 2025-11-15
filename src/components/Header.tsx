'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, ChevronDown, Gamepad2, BarChart3, Calendar, ClipboardList, Users } from 'lucide-react';
import LoginButton from './LoginButton';
import Drawer from './ui/Drawer';
import { useSession } from 'next-auth/react';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGamesDropdownOpen, setIsGamesDropdownOpen] = useState(false);
  const { data: session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!session?.user?.email) {
        setIsAdmin(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/check-admin');
        const data = await response.json();
        setIsAdmin(data.isAdmin);
      } catch (error) {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [session]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (isGamesDropdownOpen) setIsGamesDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isGamesDropdownOpen]);

  const NavLink: React.FC<{ href: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ href, icon, children }) => (
    <Link
      href={href}
      className="relative px-4 py-3 text-gray-800 hover:text-vh-red font-semibold transition-all duration-300 group min-h-[44px] flex items-center gap-2"
    >
      {icon}
      {children}
      <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-vh-red transition-all duration-300 group-hover:w-full group-hover:left-0"></span>
    </Link>
  );

  return (
    <header className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-[1020] backdrop-blur-lg bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20 lg:h-24">
          {/* Logo Section */}
          <div className="flex items-center space-x-4 md:space-x-6">
            <Link href="/" className="flex-shrink-0 group">
              <Image
                src="/vh-logo.png"
                alt="VH Beyond the Horizons"
                width={160}
                height={80}
                className="h-12 md:h-14 lg:h-16 w-auto transition-transform group-hover:scale-105"
                priority
              />
            </Link>
            <div className="hidden lg:block">
              <Image
                src="/vh-parent-logo.png"
                alt="VH Parent Company"
                width={48}
                height={48}
                className="h-10 md:h-12 w-10 md:w-12 transition-transform hover:scale-110"
              />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/eligibility-checker">Eligibility Checker</NavLink>
            <NavLink href="/du-fbs-course">DU FBS Course</NavLink>
            <NavLink href="/mock-exams" icon={<Calendar size={16} />}>Mock Exams</NavLink>

            {session && (
              <>
                <NavLink href="/results" icon={<BarChart3 size={16} />}>Results</NavLink>

                {isAdmin && (
                  <>
                    <NavLink href="/admin/registrations" icon={<ClipboardList size={16} />}>
                      Registrations
                    </NavLink>
                    <NavLink href="/admin/users" icon={<Users size={16} />}>
                      Manage Users
                    </NavLink>
                  </>
                )}

                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsGamesDropdownOpen(!isGamesDropdownOpen);
                    }}
                    className="relative px-4 py-3 text-gray-800 hover:text-vh-red font-semibold transition-all duration-300 group flex items-center gap-2 min-h-[44px]"
                  >
                    <Gamepad2 size={16} />
                    Games
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isGamesDropdownOpen ? 'rotate-180' : ''}`} />
                    <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-vh-red transition-all duration-300 group-hover:w-full group-hover:left-0"></span>
                  </button>

                  {isGamesDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[1000] animate-in fade-in slide-in-from-top-2 duration-200">
                      <Link
                        href="/games/vocab-quiz"
                        className="block px-4 py-3 text-gray-700 hover:text-vh-red hover:bg-vh-red/5 transition-all duration-200 min-h-[44px] flex items-center font-medium"
                        onClick={() => setIsGamesDropdownOpen(false)}
                      >
                        Vocabulary Quiz
                      </Link>
                      <Link
                        href="/games/mental-math"
                        className="block px-4 py-3 text-gray-700 hover:text-vh-red hover:bg-vh-red/5 transition-all duration-200 min-h-[44px] flex items-center font-medium"
                        onClick={() => setIsGamesDropdownOpen(false)}
                      >
                        Mental Math Trainer
                      </Link>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="ml-4 flex items-center space-x-3">
              <LoginButton />
              {!session && (
                <Link
                  href="/registration"
                  className="inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-vh-red/30 px-6 py-3 text-base gap-2 min-h-[44px] bg-vh-red text-white hover:bg-vh-light-red active:bg-vh-dark-red shadow-sm hover:shadow-md"
                >
                  Register Now
                </Link>
              )}
            </div>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-3 rounded-xl text-gray-800 hover:text-vh-red hover:bg-gray-100 transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <Drawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        position="right"
        size="md"
        title="Menu"
      >
        <nav className="flex flex-col gap-2">
          <Link
            href="/"
            className="block px-4 py-3 text-gray-800 hover:text-vh-red hover:bg-gray-50 font-semibold rounded-xl transition-all duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Home
          </Link>
          <Link
            href="/eligibility-checker"
            className="block px-4 py-3 text-gray-800 hover:text-vh-red hover:bg-gray-50 font-semibold rounded-xl transition-all duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Eligibility Checker
          </Link>
          <Link
            href="/du-fbs-course"
            className="block px-4 py-3 text-gray-800 hover:text-vh-red hover:bg-gray-50 font-semibold rounded-xl transition-all duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            DU FBS Course
          </Link>
          <Link
            href="/mock-exams"
            className="block px-4 py-3 text-gray-800 hover:text-vh-red hover:bg-gray-50 font-semibold rounded-xl transition-all duration-200 flex items-center gap-2"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Calendar size={16} />
            Mock Exams
          </Link>

          {session && (
            <>
              <Link
                href="/results"
                className="block px-4 py-3 text-gray-800 hover:text-vh-red hover:bg-gray-50 font-semibold rounded-xl transition-all duration-200 flex items-center gap-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <BarChart3 size={16} />
                Results
              </Link>

              {isAdmin && (
                <>
                  <Link
                    href="/admin/registrations"
                    className="block px-4 py-3 text-gray-800 hover:text-vh-red hover:bg-gray-50 font-semibold rounded-xl transition-all duration-200 flex items-center gap-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <ClipboardList size={16} />
                    Registrations
                  </Link>
                  <Link
                    href="/admin/users"
                    className="block px-4 py-3 text-gray-800 hover:text-vh-red hover:bg-gray-50 font-semibold rounded-xl transition-all duration-200 flex items-center gap-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Users size={16} />
                    Manage Users
                  </Link>
                </>
              )}

              <div className="mt-2 border-t border-gray-200 pt-4">
                <div className="px-4 py-2 text-gray-600 font-semibold flex items-center gap-2 text-sm">
                  <Gamepad2 size={16} />
                  Games
                </div>
                <Link
                  href="/games/vocab-quiz"
                  className="block px-8 py-2 text-gray-700 hover:text-vh-red hover:bg-gray-50 rounded-xl transition-all duration-200 ml-4"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Vocabulary Quiz
                </Link>
                <Link
                  href="/games/mental-math"
                  className="block px-8 py-2 text-gray-700 hover:text-vh-red hover:bg-gray-50 rounded-xl transition-all duration-200 ml-4"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Mental Math Trainer
                </Link>
              </div>
            </>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
            <LoginButton />
            {!session && (
              <Link
                href="/registration"
                className="w-full inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-vh-red/30 px-8 py-4 text-lg gap-3 min-h-[52px] bg-vh-red text-white hover:bg-vh-light-red active:bg-vh-dark-red shadow-sm hover:shadow-md"
              >
                Register Now
              </Link>
            )}
          </div>
        </nav>
      </Drawer>
    </header>
  );
};

export default Header;
