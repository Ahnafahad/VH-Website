'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hidden Sample Results Page
 *
 * This page showcases the IBA Mock Test 4 results for demonstration purposes.
 * It automatically redirects to the test detail page for Mahmud Rahman (Rank 3).
 *
 * Access: /mocksample (hidden, no navigation links)
 * Student: Mahmud Rahman (ID: 166388)
 * Test: IBA Mock Test 4
 * Rank: 3/20
 */
export default function MockSamplePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the actual test results page using the dynamic route
    // This uses the existing test detail page with the IBA Mock Test 4 data
    router.push('/results/test/IBA%20Mock%20Test%204');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-vh-red/20 border-t-vh-red rounded-full animate-spin mx-auto mb-6"></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Sample Results</h2>
        <p className="text-gray-600">Redirecting to IBA Mock Test 4 results...</p>
        <p className="text-sm text-gray-500 mt-4">Student: Mahmud Rahman | Rank: 3/20</p>
      </div>
    </div>
  );
}
