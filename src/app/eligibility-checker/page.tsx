'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import EligibilityChecker from '@/components/EligibilityChecker';
import type { Metadata } from 'next';

// export const metadata: Metadata = {
//   title: "Eligibility Checker - VH Beyond the Horizons",
//   description: "Check your eligibility for IBA DU, BUP, DU Science, DU Business, and BUET admissions. Interactive tool to verify qualification requirements.",
// };

export default function EligibilityCheckerPage() {
  const [eligibilityResults, setEligibilityResults] = useState<{
    activeTab: string;
    results: any;
  } | null>(null);

  const handleEligibilityUpdate = useCallback((activeTab: string, results: any) => {
    setEligibilityResults({ activeTab, results });
  }, []);

  const shouldShowCTA = eligibilityResults && 
    eligibilityResults.results.eligible && 
    ['IBA', 'BUP', 'DU Business'].includes(eligibilityResults.activeTab);

  const getRecommendedPage = () => {
    if (!eligibilityResults) return null;
    
    const { activeTab } = eligibilityResults;
    if (activeTab === 'IBA' || activeTab === 'BUP') {
      return {
        title: 'Get Preparation Guidance',
        href: 'https://forms.fillout.com/t/iCXMk5dbQsus',
        description: 'Need help preparing for the admission test? Our experienced instructors can guide you through the process'
      };
    } else if (activeTab === 'DU Business') {
      return {
        title: 'Learn About DU FBS Preparation',
        href: '/du-fbs-course',
        description: 'Want guidance for DU FBS admission? Learn about our specialized preparation approach'
      };
    }
    return null;
  };

  const recommendedPage = getRecommendedPage();

  return (
    <div className="min-h-screen bg-white">
      {/* Page Header */}
      <div className="bg-white shadow-lg border-b border-vh-beige/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="group flex items-center text-vh-red hover:text-vh-dark-red transition-all duration-300 font-semibold"
            >
              <ArrowLeft className="mr-3 w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-vh-red via-vh-dark-red to-black text-white overflow-hidden">
        {/* Sophisticated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-vh-beige/5 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-l from-white/5 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full">
            <div className="grid grid-cols-12 gap-4 opacity-5 transform rotate-12">
              {Array.from({ length: 144 }).map((_, i) => (
                <div key={i} className="h-1 bg-white rounded animate-pulse" style={{ animationDelay: `${i * 100}ms` }}></div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-tight mb-8">
              Eligibility Checker
              <span className="block text-4xl md:text-5xl lg:text-6xl bg-gradient-to-r from-vh-beige via-white to-vh-beige bg-clip-text text-transparent mt-4">
                2025 Admissions
              </span>
            </h1>
            
            <p className="text-2xl md:text-3xl mb-6 text-white/90 font-light">
              Check Your University Eligibility
            </p>
            
            <p className="text-lg md:text-xl mb-16 text-white/70 max-w-4xl mx-auto leading-relaxed">
              Verify your qualification requirements for IBA DU, BUP, DU Science, DU Business, and BUET
            </p>
          </div>
        </div>
      </section>

      {/* Eligibility Checker Component */}
      <section className="py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-vh-beige/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-vh-red/3 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative">
          <EligibilityChecker onEligibilityUpdate={handleEligibilityUpdate} />
        </div>
      </section>

      {/* Conditional CTA Section */}
      {shouldShowCTA && recommendedPage && (
        <section className="py-16 bg-gray-50 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-5">
              <div className="grid grid-cols-8 gap-8">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div key={i} className="aspect-square border border-vh-red/20 rounded-full"></div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-white rounded-2xl p-8 shadow-lg border border-gray-200 group-hover:shadow-xl group-hover:border-vh-red/20 transition-all duration-300 text-center">
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
                  You're eligible for <span className="text-vh-red">{eligibilityResults.activeTab}</span>
                </h2>
                <p className="text-lg text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                  {recommendedPage.description}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href={recommendedPage.href}
                    target={recommendedPage.href.startsWith('http') ? '_blank' : '_self'}
                    rel={recommendedPage.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="group text-vh-red hover:text-vh-dark-red font-semibold text-lg px-6 py-3 rounded-xl hover:bg-vh-red/5 transition-all duration-300 inline-flex items-center justify-center"
                  >
                    {recommendedPage.title} →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* General Information Section - Always visible */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Questions About Eligibility?</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Our admission counselors are available to help clarify eligibility requirements and guide you through the application process.
            </p>
            <a
              href="https://forms.fillout.com/t/iCXMk5dbQsus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-vh-red hover:text-vh-dark-red font-semibold transition-colors"
            >
              Contact Our Counselors →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}