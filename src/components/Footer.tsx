import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, Phone, MapPin, ExternalLink, Facebook, Instagram } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gradient-to-br from-vh-dark-red via-vh-red to-vh-light-red text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-20 h-20 border border-white/20 rounded-full"></div>
        <div className="absolute top-32 right-20 w-16 h-16 border border-white/20 rounded-full"></div>
        <div className="absolute bottom-20 left-1/3 w-12 h-12 border border-white/20 rounded-full"></div>
        <div className="absolute bottom-32 right-10 w-24 h-24 border border-white/20 rounded-full"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Company Info Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-6 mb-8">
              <Image
                src="/vh-logo.png"
                alt="VH Beyond the Horizons"
                width={140}
                height={70}
                className="h-14 w-auto"
              />
              <Image
                src="/vh-parent-logo.png"
                alt="VH Parent Company"
                width={48}
                height={48}
                className="h-12 w-12"
              />
            </div>
            
            <h3 className="text-2xl font-bold mb-4">Beyond the Horizons</h3>
            <p className="text-white/90 mb-6 text-lg leading-relaxed max-w-md">
              Your gateway to prestigious business schools. Expert preparation for IBA, BUP, and DU FBS admissions with proven results and exceptional success rates.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3 group">
                <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-all duration-300">
                  <Mail size={20} />
                </div>
                <div>
                  <div className="text-sm text-white/70">Email Us</div>
                  <a 
                    href="mailto:ahnafahad@vh-beyondthehorizons.org" 
                    className="font-semibold hover:text-vh-beige transition-colors"
                  >
                    ahnafahad@vh-beyondthehorizons.org
                  </a>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 group">
                <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-all duration-300">
                  <Phone size={20} />
                </div>
                <div>
                  <div className="text-sm text-white/70">Contact</div>
                  <a 
                    href="tel:+8801915424939" 
                    className="font-semibold hover:text-vh-beige transition-colors"
                  >
                    +880 1915424939
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xl font-bold mb-6">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { href: '/', label: 'Home' },
                { href: '/eligibility-checker', label: 'Eligibility Checker' },
                { href: '/du-fbs-course', label: 'DU FBS Course' },
                { href: '/registration', label: 'Registration' }
              ].map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href} 
                    className="flex items-center group text-white/90 hover:text-white transition-all duration-300"
                  >
                    <ExternalLink size={16} className="mr-2 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                    <span className="group-hover:translate-x-2 transition-transform duration-300">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Programs & Services */}
          <div>
            <h4 className="text-xl font-bold mb-6">Our Programs</h4>
            <ul className="space-y-3 text-white/90">
              <li className="flex items-start">
                <div className="w-2 h-2 bg-vh-beige rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span>IBA DU Preparation</span>
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 bg-vh-beige rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span>BUP Admission Course</span>
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 bg-vh-beige rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span>DU FBS Program</span>
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 bg-vh-beige rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span>Mock Examinations</span>
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 bg-vh-beige rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span>Expert Instruction</span>
              </li>
            </ul>

            {/* Social Media */}
            <div className="mt-8">
              <h5 className="font-semibold mb-4">Follow Us</h5>
              <div className="flex space-x-3">
                <a 
                  href="https://www.facebook.com/verticalhorizon.edu" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-all duration-300 group"
                >
                  <Facebook size={20} className="group-hover:scale-110 transition-transform" />
                </a>
                <a 
                  href="https://www.instagram.com/vhforlife/?hl=en" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-all duration-300 group"
                >
                  <Instagram size={20} className="group-hover:scale-110 transition-transform" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/20 pt-8 mt-8">
          <div className="flex flex-col lg:flex-row justify-between items-center space-y-4 lg:space-y-0">
            <div className="text-center lg:text-left">
              <p className="text-white/80">
                © 2025 VH Beyond the Horizons. All rights reserved.
              </p>
              <p className="text-white/60 text-sm mt-1">
                Preparing students for excellence in business education since 2024.
              </p>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-white/70">
              <a href="mailto:ahnafahad@vh-beyondthehorizons.org" className="hover:text-white transition-colors">Contact Us</a>
              <a href="tel:+8801915424939" className="hover:text-white transition-colors">Call Us</a>
              <a href="https://forms.fillout.com/t/iCXMk5dbQsus" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Register</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;