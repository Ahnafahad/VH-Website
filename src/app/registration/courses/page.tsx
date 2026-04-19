'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, CheckCircle, Sparkles, GraduationCap, Calendar, Target, Users, Home } from 'lucide-react';

type EducationType = 'hsc' | 'alevels' | null;
type ProgramMode = 'mocks' | 'full' | null;
type MockProgram = 'du-iba' | 'bup-iba' | 'du-fbs' | 'bup-fbs' | 'fbs-detailed';
type FullCourse = 'du-iba-full' | 'bup-iba-fbs-full';
type MockIntent = 'trial' | 'full' | null;

// Mock program prices - defined outside component to avoid re-creation
const MOCK_PRICES: Record<MockProgram, number> = {
  'du-iba': 3000,
  'bup-iba': 2200,
  'du-fbs': 2500,
  'bup-fbs': 2000,
  'fbs-detailed': 6500,
};

export default function RegistrationPage() {
  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  // Step 1: Personal Information
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2: Educational Background
  const [educationType, setEducationType] = useState<EducationType>(null);
  const [hscYear, setHscYear] = useState('');
  const [sscYear, setSscYear] = useState('');
  const [aLevelYear, setALevelYear] = useState('');
  const [oLevelYear, setOLevelYear] = useState('');

  // Step 3: Program Selection
  const [programMode, setProgramMode] = useState<ProgramMode>(null);
  const [selectedMocks, setSelectedMocks] = useState<MockProgram[]>([]);
  const [selectedFullCourses, setSelectedFullCourses] = useState<FullCourse[]>([]);
  const [mockIntent, setMockIntent] = useState<MockIntent>(null);

  // Referral Information (optional, for mocks only)
  const [referralName, setReferralName] = useState('');
  const [referralInstitution, setReferralInstitution] = useState('');
  const [referralBatch, setReferralBatch] = useState('');

  // Calculate pricing
  const { subtotal, discount, finalPrice } = useMemo(() => {
    if (programMode !== 'mocks') return { subtotal: 0, discount: 0, finalPrice: 0 };

    const subtotal = selectedMocks.reduce((sum, program) => sum + MOCK_PRICES[program], 0);
    const count = selectedMocks.length;

    let discountRate = 0;
    if (count >= 4) discountRate = 0.25;
    else if (count === 3) discountRate = 0.15;
    else if (count === 2) discountRate = 0.05;

    const discount = subtotal * discountRate;
    const finalPrice = subtotal - discount;

    return { subtotal, discount, finalPrice };
  }, [selectedMocks, programMode]);

  // Validation
  const canProceedStep1 = name.trim() && email.includes('@') && phone.trim();
  const canProceedStep2 = educationType &&
    ((educationType === 'hsc' && hscYear && sscYear) ||
     (educationType === 'alevels' && aLevelYear && oLevelYear));
  const canProceedStep3 =
    (programMode === 'full' && selectedFullCourses.length > 0) ||
    (programMode === 'mocks' && selectedMocks.length > 0 && mockIntent);

  // Handle mock selection with constraints
  const toggleMock = (program: MockProgram) => {
    setMockIntent(null);
    setSelectedMocks(prev => {
      let newSelection = prev.includes(program)
        ? prev.filter(p => p !== program)
        : [...prev, program];

      // If FBS Detailed is selected, remove individual FBS mocks
      if (program === 'fbs-detailed' && newSelection.includes('fbs-detailed')) {
        newSelection = newSelection.filter(p => p !== 'du-fbs' && p !== 'bup-fbs');
      }

      // If individual FBS mock is selected, remove FBS Detailed
      if ((program === 'du-fbs' || program === 'bup-fbs') && !prev.includes(program)) {
        newSelection = newSelection.filter(p => p !== 'fbs-detailed');
      }

      return newSelection;
    });
  };

  const toggleFullCourse = (course: FullCourse) => {
    setSelectedFullCourses(prev =>
      prev.includes(course) ? prev.filter(c => c !== course) : [...prev, course]
    );
  };

  const handleSubmit = async () => {
    const payload = {
      name,
      email,
      phone,
      educationType,
      years: educationType === 'hsc'
        ? { hscYear, sscYear }
        : { aLevelYear, oLevelYear },
      programMode,
      ...(programMode === 'mocks' ? {
        selectedMocks,
        mockIntent,
        pricing: { subtotal, discount, finalPrice },
        ...(referralName && referralInstitution && referralBatch ? {
          referral: {
            name: referralName,
            institution: referralInstitution,
            batch: referralBatch
          }
        } : {})
      } : {
        selectedFullCourses
      })
    };

    try {
      const response = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit registration');
      }

      // Show success screen
      setSubmitted(true);
    } catch (error) {
      console.error('Registration error:', error);
      alert('Failed to submit registration. Please try again or contact us directly at +880 1915424939.');
    }
  };

  // Success confirmation screen
  if (submitted) {
    const programLabel = programMode === 'mocks'
      ? (selectedMocks.length ? selectedMocks.join(' · ') : 'Mock Test Program')
      : (selectedFullCourses.length ? selectedFullCourses.join(' · ') : 'Full Course Program');

    return (
      <div className="min-h-screen bg-[#FAF5EF] text-[#1A0507] flex items-center justify-center px-4 py-16 relative overflow-hidden">
        {/* editorial atmospheric glow */}
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,176,148,0.18), transparent 60%)',
          }}
        />

        <div className="relative max-w-3xl w-full">
          {/* Chapter mark */}
          <div className="font-sans text-[11px] tracking-[0.3em] uppercase text-[#A86E58] mb-6 flex items-center gap-3">
            <span className="w-8 h-px bg-[#A86E58]" />
            Chapter Six / The Beginning
          </div>

          {/* Headline */}
          <h1 className="font-heading text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em] font-light text-[#1A0507] mb-6">
            Thank you,{' '}
            <em className="font-extralight text-[#760F13]">{name.split(' ')[0] || 'friend'}</em>.
            <br />
            Your seat is{' '}
            <em className="font-extralight text-[#760F13]">held</em>.
          </h1>

          {/* Recap */}
          <div className="border-t border-b border-[#D4B094]/30 py-6 my-10 space-y-3">
            <div className="flex items-baseline gap-4">
              <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] w-24 shrink-0">Program</span>
              <span className="font-heading text-lg text-[#1A0507]">{programLabel}</span>
            </div>
            {finalPrice > 0 && (
              <div className="flex items-baseline gap-4">
                <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] w-24 shrink-0">Rate</span>
                <span className="font-heading text-lg text-[#1A0507]">{finalPrice.toLocaleString()} BDT</span>
              </div>
            )}
            <div className="flex items-baseline gap-4">
              <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] w-24 shrink-0">Contact</span>
              <span className="font-sans text-sm text-[#1A0507]/80">{email} · {phone}</span>
            </div>
          </div>

          {/* Early-bird callout */}
          <div className="relative rounded-2xl border border-[#D4B094]/40 bg-white/70 backdrop-blur-sm p-6 sm:p-8 mb-10 overflow-hidden">
            <span className="absolute top-4 left-4 w-4 h-px bg-[#A86E58]/50" />
            <span className="absolute top-4 left-4 w-px h-4 bg-[#A86E58]/50" />
            <span className="absolute bottom-4 right-4 w-4 h-px bg-[#A86E58]/50" />
            <span className="absolute bottom-4 right-4 w-px h-4 -translate-y-4 bg-[#A86E58]/50" />

            <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#760F13] mb-3">Early-bird advantage — unlocked</div>
            <p className="font-heading text-xl sm:text-2xl leading-snug text-[#1A0507] font-light">
              You&rsquo;ve locked in current rates and first access to the 2026 cohort.
              Expect a call on <strong className="font-medium">{phone}</strong> within 24 hours.
            </p>
          </div>

          {/* WhatsApp group — QR + link */}
          <div className="relative rounded-2xl border border-[#D4B094]/30 bg-[#1A0507] text-[#FAF5EF] p-6 sm:p-10 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
              {/* QR */}
              <div className="shrink-0 p-3 bg-white rounded-xl shadow-lg">
                <img
                  src="/whatsapp-qr.png"
                  alt="Scan to join VH WhatsApp group"
                  className="w-40 h-40 sm:w-44 sm:h-44 block"
                />
              </div>

              {/* Text + CTA */}
              <div className="flex-1">
                <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094] mb-3">Stay connected</div>
                <h3 className="font-heading text-2xl sm:text-3xl font-light leading-tight mb-3 text-[#FAF5EF]">
                  Join the group. Don&rsquo;t miss the update.
                </h3>
                <p className="font-sans text-sm text-[#FAF5EF]/70 leading-relaxed mb-6 max-w-md">
                  Scan the QR or tap below. This is where we share the Early-bird advantage, course updates, and cohort announcements first.
                </p>
                <a
                  href="https://chat.whatsapp.com/LBdtaxyUP6w1S7npTrFli6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 rounded-full bg-[#FAF5EF] text-[#1A0507] px-7 py-3.5 font-sans text-sm font-medium tracking-wide transition-all duration-500 hover:bg-[#D4B094] hover:shadow-[0_10px_40px_-10px_rgba(212,176,148,0.5)]"
                >
                  Open WhatsApp group
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Return */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-3 font-sans text-sm text-[#760F13] hover:text-[#1A0507] transition-colors group"
            >
              <span className="w-6 h-px bg-current transition-all duration-300 group-hover:w-12" />
              Return home
            </Link>
            <div className="font-sans text-xs text-[#A86E58]/70 tracking-wide">
              Questions? <a href="tel:+8801915424939" className="underline decoration-[#D4B094]/50 underline-offset-4">+880 1915424939</a>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-vh-red/10 px-4 py-2 rounded-full border border-vh-red/20 mb-4">
            <Sparkles className="w-5 h-5 text-vh-red" />
            <span className="text-vh-red font-semibold">Premium Admission Preparation</span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            Program Registration
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Begin your journey to excellence with VH Beyond the Horizons
            <span className="block mt-2 text-vh-red font-semibold">Available in both Online & Offline modes</span>
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                    currentStep >= step
                      ? 'bg-vh-red text-white shadow-lg'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
                </div>
                {step < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all duration-300 ${
                      currentStep > step ? 'bg-vh-red' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-4 text-sm text-gray-600">
            Step {currentStep} of 4
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="p-8 md:p-12">

            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
                    <p className="text-gray-600">Let us know who you are</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setCurrentStep(2)}
                    disabled={!canProceedStep1}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[44px]"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Educational Background */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-vh-beige to-vh-dark-beige rounded-2xl flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Educational Background</h2>
                    <p className="text-gray-600">Tell us about your academic journey</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Select Your Educational Track *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setEducationType('hsc')}
                      className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                        educationType === 'hsc'
                          ? 'border-vh-red bg-vh-red/5 shadow-lg'
                          : 'border-gray-200 hover:border-vh-red/50 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold text-gray-900">HSC Track</h3>
                        {educationType === 'hsc' && (
                          <CheckCircle className="w-6 h-6 text-vh-red" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">SSC → HSC</p>
                    </button>

                    <button
                      onClick={() => setEducationType('alevels')}
                      className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                        educationType === 'alevels'
                          ? 'border-vh-red bg-vh-red/5 shadow-lg'
                          : 'border-gray-200 hover:border-vh-red/50 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold text-gray-900">A Levels Track</h3>
                        {educationType === 'alevels' && (
                          <CheckCircle className="w-6 h-6 text-vh-red" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">O Level → A Level</p>
                    </button>
                  </div>
                </div>

                {/* HSC Years */}
                {educationType === 'hsc' && (
                  <div className="bg-gradient-to-br from-vh-red/5 to-transparent rounded-2xl p-6 border border-vh-red/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-5 h-5 text-vh-red" />
                      <h3 className="font-bold text-gray-900">HSC Track Details</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          HSC Passing Year *
                        </label>
                        <input
                          type="text"
                          value={hscYear}
                          onChange={(e) => setHscYear(e.target.value)}
                          placeholder="e.g., 2025"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          SSC Passing Year *
                        </label>
                        <input
                          type="text"
                          value={sscYear}
                          onChange={(e) => setSscYear(e.target.value)}
                          placeholder="e.g., 2023"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* A Levels Years */}
                {educationType === 'alevels' && (
                  <div className="bg-gradient-to-br from-vh-red/5 to-transparent rounded-2xl p-6 border border-vh-red/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-5 h-5 text-vh-red" />
                      <h3 className="font-bold text-gray-900">A Levels Track Details</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          A Level Passing Year *
                        </label>
                        <input
                          type="text"
                          value={aLevelYear}
                          onChange={(e) => setALevelYear(e.target.value)}
                          placeholder="e.g., 2025"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          O Level Passing Year *
                        </label>
                        <input
                          type="text"
                          value={oLevelYear}
                          onChange={(e) => setOLevelYear(e.target.value)}
                          placeholder="e.g., 2023"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="inline-flex items-center gap-2 border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all duration-300 min-h-[44px]"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </button>
                  <button
                    onClick={() => setCurrentStep(3)}
                    disabled={!canProceedStep2}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[44px]"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Program Selection */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Program Selection</h2>
                    <p className="text-gray-600">Choose your preparation path</p>
                  </div>
                </div>

                {/* Program Mode Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Select Program Type *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => {
                        setProgramMode('mocks');
                        setSelectedFullCourses([]);
                      }}
                      className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                        programMode === 'mocks'
                          ? 'border-vh-red bg-vh-red/5 shadow-lg'
                          : 'border-gray-200 hover:border-vh-red/50 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold text-gray-900">Mock Test Programs</h3>
                        {programMode === 'mocks' && (
                          <CheckCircle className="w-6 h-6 text-vh-red" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Comprehensive mock test series</p>
                      <div className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
                        <Sparkles className="w-3 h-3" />
                        First mock FREE
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setProgramMode('full');
                        setSelectedMocks([]);
                        setMockIntent(null);
                      }}
                      className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                        programMode === 'full'
                          ? 'border-vh-red bg-vh-red/5 shadow-lg'
                          : 'border-gray-200 hover:border-vh-red/50 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold text-gray-900">Full Courses</h3>
                        {programMode === 'full' && (
                          <CheckCircle className="w-6 h-6 text-vh-red" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">Complete preparation with classes & guidance</p>
                    </button>
                  </div>
                </div>

                {/* Mock Programs */}
                {programMode === 'mocks' && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-blue-50 to-transparent rounded-2xl p-6 border border-blue-200">
                      <h3 className="font-bold text-gray-900 mb-4">Available Mock Programs</h3>
                      <div className="space-y-3">

                        {/* DU IBA Mocks */}
                        <button
                          onClick={() => toggleMock('du-iba')}
                          className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                            selectedMocks.includes('du-iba')
                              ? 'border-vh-red bg-vh-red/5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-gray-900">DU IBA Mock Test Series</div>
                              <div className="text-sm text-gray-600">10 comprehensive mocks • First mock free</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-vh-red">Tk 3,000</div>
                              <div className="text-xs text-gray-500">
                                {selectedMocks.includes('du-iba') ? '✓ Selected' : 'Select'}
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* BUP IBA Mocks */}
                        <button
                          onClick={() => toggleMock('bup-iba')}
                          className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                            selectedMocks.includes('bup-iba')
                              ? 'border-vh-red bg-vh-red/5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-gray-900">BUP IBA Mock Test Series</div>
                              <div className="text-sm text-gray-600">8 comprehensive mocks • First mock free</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-vh-red">Tk 2,200</div>
                              <div className="text-xs text-gray-500">
                                {selectedMocks.includes('bup-iba') ? '✓ Selected' : 'Select'}
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* FBS Programs - Only show for A Levels */}
                        {educationType === 'alevels' && (
                          <>
                            {/* DU FBS Mocks */}
                            <button
                              onClick={() => toggleMock('du-fbs')}
                              disabled={selectedMocks.includes('fbs-detailed')}
                              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                selectedMocks.includes('du-fbs')
                                  ? 'border-vh-red bg-vh-red/5'
                                  : selectedMocks.includes('fbs-detailed')
                                  ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-bold text-gray-900">DU FBS Mock Test Series</div>
                                  <div className="text-sm text-gray-600">8 comprehensive mocks • First mock free</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-vh-red">Tk 2,500</div>
                                  <div className="text-xs text-gray-500">
                                    {selectedMocks.includes('du-fbs') ? '✓ Selected' : 'Select'}
                                  </div>
                                </div>
                              </div>
                            </button>

                            {/* BUP FBS Mocks */}
                            <button
                              onClick={() => toggleMock('bup-fbs')}
                              disabled={selectedMocks.includes('fbs-detailed')}
                              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                selectedMocks.includes('bup-fbs')
                                  ? 'border-vh-red bg-vh-red/5'
                                  : selectedMocks.includes('fbs-detailed')
                                  ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-bold text-gray-900">BUP FBS Mock Test Series</div>
                                  <div className="text-sm text-gray-600">8 comprehensive mocks • First mock free</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-vh-red">Tk 2,000</div>
                                  <div className="text-xs text-gray-500">
                                    {selectedMocks.includes('bup-fbs') ? '✓ Selected' : 'Select'}
                                  </div>
                                </div>
                              </div>
                            </button>

                            {/* FBS Detailed Guidance Package */}
                            <button
                              onClick={() => toggleMock('fbs-detailed')}
                              disabled={selectedMocks.includes('du-fbs') || selectedMocks.includes('bup-fbs')}
                              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                selectedMocks.includes('fbs-detailed')
                                  ? 'border-yellow-500 bg-yellow-50'
                                  : (selectedMocks.includes('du-fbs') || selectedMocks.includes('bup-fbs'))
                                  ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                  : 'border-yellow-300 hover:border-yellow-400 bg-yellow-50/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-5 h-5 text-yellow-600" />
                                <span className="text-xs font-bold text-yellow-700 bg-yellow-200 px-2 py-1 rounded">PREMIUM PACKAGE</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-bold text-gray-900">Detailed Guidance for FBS</div>
                                  <div className="text-sm text-gray-600">Complete FBS preparation with:</div>
                                  <ul className="text-xs text-gray-600 mt-2 space-y-1">
                                    <li>• Expert instructor guidance & classes</li>
                                    <li>• Comprehensive study notes</li>
                                    <li>• DU FBS Mock Test Series (8 mocks)</li>
                                    <li>• BUP FBS Mock Test Series (8 mocks)</li>
                                  </ul>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="font-bold text-yellow-700 text-xl">Tk 6,500</div>
                                  <div className="text-xs text-gray-500">
                                    {selectedMocks.includes('fbs-detailed') ? '✓ Selected' : 'Select'}
                                  </div>
                                </div>
                              </div>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Pricing Summary */}
                    {selectedMocks.length > 0 && (
                      <div className="bg-gradient-to-r from-vh-red to-vh-dark-red text-white rounded-2xl p-6">
                        <h3 className="font-bold text-xl mb-4">Pricing Summary</h3>
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between">
                            <span>Programs Selected:</span>
                            <span className="font-bold">{selectedMocks.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-bold">Tk {subtotal.toLocaleString()}</span>
                          </div>
                          {discount > 0 && (
                            <div className="flex justify-between text-yellow-300">
                              <span>Discount ({selectedMocks.length >= 4 ? '25' : selectedMocks.length === 3 ? '15' : '5'}%):</span>
                              <span className="font-bold">- Tk {discount.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="border-t border-white/30 pt-2 mt-2"></div>
                          <div className="flex justify-between text-2xl">
                            <span className="font-black">Total:</span>
                            <span className="font-black">Tk {finalPrice.toLocaleString()}</span>
                          </div>
                        </div>
                        {selectedMocks.length >= 2 && (
                          <div className="bg-white/20 rounded-lg p-3 text-sm">
                            🎉 You're saving Tk {discount.toLocaleString()} with our multi-program discount!
                          </div>
                        )}
                      </div>
                    )}

                    {/* Intent Selection */}
                    {selectedMocks.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                        <h3 className="font-bold text-gray-900 mb-3">Choose Your Registration Path</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          <strong>Important:</strong> Registration does not require immediate payment. You can start with our complimentary first mock test with no financial commitment.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={() => setMockIntent('trial')}
                            className={`p-5 rounded-xl border-2 transition-all text-left ${
                              mockIntent === 'trial'
                                ? 'border-blue-500 bg-blue-50 shadow-lg'
                                : 'border-gray-300 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="w-5 h-5 text-blue-600" />
                              <span className="font-bold text-gray-900">Experience First, Decide Later</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              Begin with our complimentary first mock test and evaluate the program quality before committing
                            </p>
                            <div className="text-xs text-blue-600 font-semibold">
                              ✓ No payment required • ✓ Zero commitment
                            </div>
                          </button>

                          <button
                            onClick={() => setMockIntent('full')}
                            className={`p-5 rounded-xl border-2 transition-all text-left ${
                              mockIntent === 'full'
                                ? 'border-vh-red bg-vh-red/5 shadow-lg'
                                : 'border-gray-300 hover:border-vh-red/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Target className="w-5 h-5 text-vh-red" />
                              <span className="font-bold text-gray-900">Secure Your Place</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              Reserve your spot in our complete program and gain access to premium preparation resources
                            </p>
                            <div className="text-xs text-vh-red font-semibold">
                              ✓ Full program access • ✓ Priority support
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Full Courses */}
                {programMode === 'full' && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-purple-50 to-transparent rounded-2xl p-6 border border-purple-200">
                      <h3 className="font-bold text-gray-900 mb-4">Available Full Courses</h3>
                      <div className="space-y-3">

                        {/* DU IBA Full Course */}
                        <button
                          onClick={() => toggleFullCourse('du-iba-full')}
                          className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                            selectedFullCourses.includes('du-iba-full')
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-gray-900 text-lg">DU IBA Complete Course</div>
                              <div className="text-sm text-gray-600 mt-1">
                                Full preparation with classes, notes, mock tests & instructor guidance
                              </div>
                            </div>
                            <div>
                              <CheckCircle className={`w-6 h-6 ${
                                selectedFullCourses.includes('du-iba-full') ? 'text-purple-500' : 'text-gray-300'
                              }`} />
                            </div>
                          </div>
                        </button>

                        {/* BUP IBA & FBS Full Course */}
                        {educationType === 'alevels' && (
                          <button
                            onClick={() => toggleFullCourse('bup-iba-fbs-full')}
                            className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                              selectedFullCourses.includes('bup-iba-fbs-full')
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-bold text-gray-900 text-lg">BUP IBA & FBS Complete Course</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  Comprehensive preparation for both BUP programs with full support
                                </div>
                              </div>
                              <div>
                                <CheckCircle className={`w-6 h-6 ${
                                  selectedFullCourses.includes('bup-iba-fbs-full') ? 'text-purple-500' : 'text-gray-300'
                                }`} />
                              </div>
                            </div>
                          </button>
                        )}

                        {/* HSC Only Option */}
                        {educationType === 'hsc' && (
                          <button
                            onClick={() => toggleFullCourse('bup-iba-fbs-full')}
                            className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                              selectedFullCourses.includes('bup-iba-fbs-full')
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-bold text-gray-900 text-lg">BUP IBA Complete Course</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  Full preparation with classes, notes, mock tests & instructor guidance
                                </div>
                              </div>
                              <div>
                                <CheckCircle className={`w-6 h-6 ${
                                  selectedFullCourses.includes('bup-iba-fbs-full') ? 'text-purple-500' : 'text-gray-300'
                                }`} />
                              </div>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>

                    {selectedFullCourses.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                          <div>
                            <h4 className="font-bold text-gray-900 mb-2">Personalized Course Details</h4>
                            <p className="text-sm text-gray-600">
                              Our admissions team will contact you within 24 hours to discuss course details, scheduling, and pricing tailored to your selected programs.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="inline-flex items-center gap-2 border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all duration-300 min-h-[44px]"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </button>
                  <button
                    onClick={() => setCurrentStep(4)}
                    disabled={!canProceedStep3}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[44px]"
                  >
                    Review & Submit
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Summary & Confirmation */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Review & Confirm</h2>
                    <p className="text-gray-600">Please verify your information before submitting</p>
                  </div>
                </div>

                {/* Referral Section - Only for Mock Programs */}
                {programMode === 'mocks' && (
                  <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl border-2 border-purple-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Users className="w-6 h-6 text-purple-600" />
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Referral (Optional)</h3>
                        <p className="text-sm text-gray-600">
                          Know someone who referred you? Add their details below
                        </p>
                      </div>
                    </div>

                    {/* Eligibility Conditions */}
                    <div className="bg-purple-100 border border-purple-300 rounded-xl p-4 mb-4">
                      <p className="text-sm font-semibold text-purple-900 mb-2">
                        <strong>Eligible Referrals:</strong>
                      </p>
                      <ul className="text-xs text-purple-800 space-y-1">
                        <li>• Current students of BUP FBS, BUP IBA, IBA DU, and DU FBS</li>
                        <li>• Current or ex-students of Beyond the Horizon Program</li>
                        <li>• Alumni of Beyond the Horizon Program</li>
                        <li className="text-purple-900 font-semibold mt-2">⚠ Individuals not belonging to these categories will not be eligible for referrals</li>
                      </ul>
                    </div>

                    {/* Referral Form */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Referral Name
                        </label>
                        <input
                          type="text"
                          value={referralName}
                          onChange={(e) => setReferralName(e.target.value)}
                          placeholder="Enter referral's full name"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Institution
                          </label>
                          <select
                            value={referralInstitution}
                            onChange={(e) => setReferralInstitution(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all bg-white"
                          >
                            <option value="">Select institution...</option>
                            <option value="BUP FBS">BUP FBS</option>
                            <option value="BUP IBA">BUP IBA</option>
                            <option value="IBA DU">IBA DU</option>
                            <option value="DU FBS">DU FBS</option>
                            <option value="Beyond the Horizon Alumni">Beyond the Horizon Alumni</option>
                            <option value="Beyond the Horizon Current Student">Beyond the Horizon Current Student</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Batch
                          </label>
                          <input
                            type="text"
                            value={referralBatch}
                            onChange={(e) => setReferralBatch(e.target.value)}
                            placeholder="e.g., 2024, Spring 2023"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                          />
                        </div>
                      </div>

                      {referralName && referralInstitution && referralBatch && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          <p className="text-sm text-green-800">
                            Referral information added successfully!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Summary Card */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-gray-200 p-6 space-y-4">

                  {/* Personal Info */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Personal Information</h3>
                    <div className="space-y-1">
                      <p className="text-gray-900"><span className="font-semibold">Name:</span> {name}</p>
                      <p className="text-gray-900"><span className="font-semibold">Email:</span> {email}</p>
                      <p className="text-gray-900"><span className="font-semibold">Phone:</span> {phone}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200"></div>

                  {/* Education */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Educational Background</h3>
                    <div className="space-y-1">
                      <p className="text-gray-900">
                        <span className="font-semibold">Track:</span>{' '}
                        {educationType === 'hsc' ? 'HSC Track' : 'A Levels Track'}
                      </p>
                      {educationType === 'hsc' ? (
                        <p className="text-gray-900">
                          <span className="font-semibold">Years:</span> SSC {sscYear}, HSC {hscYear}
                        </p>
                      ) : (
                        <p className="text-gray-900">
                          <span className="font-semibold">Years:</span> O Level {oLevelYear}, A Level {aLevelYear}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-200"></div>

                  {/* Referral Information (if provided) */}
                  {programMode === 'mocks' && referralName && referralInstitution && referralBatch && (
                    <>
                      <div className="border-t border-gray-200"></div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Referral Information</h3>
                        <div className="space-y-1">
                          <p className="text-gray-900">
                            <span className="font-semibold">Referred by:</span> {referralName}
                          </p>
                          <p className="text-gray-900">
                            <span className="font-semibold">Institution:</span> {referralInstitution}
                          </p>
                          <p className="text-gray-900">
                            <span className="font-semibold">Batch:</span> {referralBatch}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="border-t border-gray-200"></div>

                  {/* Program Selection */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Selected Program</h3>
                    {programMode === 'mocks' ? (
                      <div className="space-y-2">
                        <p className="text-gray-900 font-semibold">Mock Test Programs:</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-700">
                          {selectedMocks.map(mock => (
                            <li key={mock}>
                              {mock === 'du-iba' && 'DU IBA Mock Test Series (Tk 3,000)'}
                              {mock === 'bup-iba' && 'BUP IBA Mock Test Series (Tk 2,200)'}
                              {mock === 'du-fbs' && 'DU FBS Mock Test Series (Tk 2,500)'}
                              {mock === 'bup-fbs' && 'BUP FBS Mock Test Series (Tk 2,000)'}
                              {mock === 'fbs-detailed' && 'Detailed Guidance for FBS (Tk 6,500)'}
                            </li>
                          ))}
                        </ul>
                        <div className="bg-vh-red/10 rounded-lg p-4 mt-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-700">Subtotal:</span>
                            <span className="font-bold text-gray-900">Tk {subtotal.toLocaleString()}</span>
                          </div>
                          {discount > 0 && (
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-green-700">Discount ({selectedMocks.length >= 4 ? '25' : selectedMocks.length === 3 ? '15' : '5'}%):</span>
                              <span className="font-bold text-green-700">- Tk {discount.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between items-center">
                            <span className="text-xl font-bold text-gray-900">Total:</span>
                            <span className="text-2xl font-black text-vh-red">Tk {finalPrice.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
                          <p className="text-sm text-blue-900">
                            <strong>Registration Intent:</strong>{' '}
                            {mockIntent === 'trial'
                              ? 'Experience first, decide later (Complimentary first mock)'
                              : 'Full program registration (Premium preparation)'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-gray-900 font-semibold">Full Courses:</p>
                        <ul className="list-disc list-inside space-y-1 text-gray-700">
                          {selectedFullCourses.includes('du-iba-full') && <li>DU IBA Complete Course</li>}
                          {selectedFullCourses.includes('bup-iba-fbs-full') && (
                            <li>{educationType === 'hsc' ? 'BUP IBA Complete Course' : 'BUP IBA & FBS Complete Course'}</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Full Course Message */}
                {programMode === 'full' && (
                  <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl p-6">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="text-xl font-bold mb-2">Next Steps</h3>
                        <p className="text-green-50">
                          Thank you for your interest in our full course programs! Our dedicated admissions team will contact you within 24 hours to discuss:
                        </p>
                        <ul className="mt-3 space-y-2 text-green-50">
                          <li>• Detailed course curriculum and structure</li>
                          <li>• Personalized scheduling options</li>
                          <li>• Program pricing and payment plans</li>
                          <li>• Admission requirements and next steps</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mock Program WhatsApp */}
                {programMode === 'mocks' && (
                  <div className="bg-gradient-to-br from-green-50 to-white border-2 border-green-200 rounded-2xl p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Join Our Community</h3>
                        <p className="text-gray-600 mb-4">
                          Stay connected with our exclusive WhatsApp community for important announcements, study materials, and peer support throughout your preparation journey.
                        </p>
                        <Link
                          href="https://chat.whatsapp.com/LBdtaxyUP6w1S7npTrFli6"
                          target="_blank"
                          className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 min-h-[44px]"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Join WhatsApp Community
                          <ArrowRight className="w-5 h-5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Important Note */}
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-bold text-gray-900 mb-2">Important Information</h4>
                      <ul className="text-sm text-gray-700 space-y-2">
                        {programMode === 'mocks' && (
                          <>
                            <li>• <strong>No payment required at registration</strong> - You can register without any financial commitment</li>
                            <li>• <strong>First mock test is complimentary</strong> - Experience our quality before deciding</li>
                            <li>• Payment details will be shared separately if you choose to continue</li>
                          </>
                        )}
                        {programMode === 'full' && (
                          <>
                            <li>• Our team will contact you within 24 hours</li>
                            <li>• Course details and pricing will be discussed personally</li>
                            <li>• Flexible scheduling options available</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Early-bird advantage ribbon */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-vh-red/30 bg-gradient-to-r from-vh-red/5 via-white to-vh-beige/10 p-5">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-vh-red/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="relative flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-vh-red flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-vh-red font-bold mb-1">Early-bird advantage</div>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        Register now to lock in current rates and get first access to the 2026 cohort before seats fill up.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all duration-300 min-h-[44px]"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                  </button>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href="/"
                      className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all duration-300 min-h-[44px]"
                    >
                      <Home className="w-5 h-5" />
                      Home
                    </Link>
                    <button
                      onClick={handleSubmit}
                      className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 min-h-[44px]"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Submit Registration
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Help Text */}
        <div className="text-center mt-8 text-sm text-gray-600">
          Need assistance? Contact us at{' '}
          <a href="tel:+8801915424939" className="text-vh-red hover:text-vh-dark-red font-semibold">
            +880 1915424939
          </a>
        </div>
      </div>
    </div>
  );
}
