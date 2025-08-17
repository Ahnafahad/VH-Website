'use client';

import { useEffect } from 'react';

export default function RegistrationPage() {
  useEffect(() => {
    // Redirect to external form
    window.location.href = 'https://forms.fillout.com/t/iCXMk5dbQsus';
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      {/* Loading/Redirect Message */}
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-vh-red border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Redirecting to Registration Form...</h1>
        <p className="text-gray-600">
          If you're not redirected automatically, 
          <a 
            href="https://forms.fillout.com/t/iCXMk5dbQsus" 
            className="text-vh-red hover:text-vh-dark-red font-semibold ml-1"
          >
            click here
          </a>
        </p>
      </div>
    </div>
  );
}