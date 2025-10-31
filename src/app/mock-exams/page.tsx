'use client';

import { Calendar, Clock, TrendingUp, Award, ArrowRight, CheckCircle, Sparkles, Target, Users, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function MockExamsPage() {
  const duIbaMocks = [
    { no: 1, date: 'Nov 3, 2025', day: 'Monday', time: '12:00 PM – 2:00 PM', isFree: true },
    { no: 2, date: 'Nov 6, 2025', day: 'Thursday', time: '11:00 AM – 1:00 PM' },
    { no: 3, date: 'Nov 7, 2025', day: 'Friday', time: '11:00 AM – 1:00 PM' },
    { no: 4, date: 'Nov 10, 2025', day: 'Monday', time: '12:00 PM – 2:00 PM' },
    { no: 5, date: 'Nov 13, 2025', day: 'Thursday', time: '11:00 AM – 1:00 PM' },
    { no: 6, date: 'Nov 14, 2025', day: 'Friday', time: '11:00 AM – 1:00 PM' },
    { no: 7, date: 'Nov 17, 2025', day: 'Monday', time: '12:00 PM – 2:00 PM' },
    { no: 8, date: 'Nov 20, 2025', day: 'Thursday', time: '11:00 AM – 1:00 PM' },
    { no: 9, date: 'Nov 21, 2025', day: 'Friday', time: '11:00 AM – 1:00 PM' },
    { no: 10, date: 'Nov 24, 2025', day: 'Monday', time: '12:00 PM – 2:00 PM' },
  ];

  const duFbsMocks = [
    { no: 1, date: 'Nov 9, 2025', day: 'Sunday', time: '11:00 AM – 1:00 PM', isFree: true },
    { no: 2, date: 'Nov 11, 2025', day: 'Tuesday', time: '1:00 PM – 3:00 PM' },
    { no: 3, date: 'Nov 16, 2025', day: 'Sunday', time: '11:00 AM – 1:00 PM' },
    { no: 4, date: 'Nov 18, 2025', day: 'Tuesday', time: '1:00 PM – 3:00 PM' },
    { no: 5, date: 'Nov 23, 2025', day: 'Sunday', time: '11:00 AM – 1:00 PM' },
    { no: 6, date: 'Nov 30, 2025', day: 'Sunday', time: '11:00 AM – 1:00 PM' },
    { no: 7, date: 'Dec 2, 2025', day: 'Tuesday', time: '1:00 PM – 3:00 PM' },
    { no: 8, date: 'Dec 4, 2025', day: 'Thursday', time: '2:00 PM – 4:00 PM' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5">

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-vh-red via-vh-dark-red to-vh-dark-red overflow-hidden py-20 md:py-28 lg:py-32">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-vh-beige rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative max-w-7xl 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20 mb-8">
              <Sparkles className="w-5 h-5 text-vh-beige" />
              <span className="text-white/90 font-medium">Premium Mock Test Series 2025</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl 2xl:text-9xl font-black leading-tight mb-8 text-white">
              VH Mock Exams
              <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-6xl 2xl:text-7xl bg-gradient-to-r from-vh-beige via-white to-vh-beige bg-clip-text text-transparent mt-4">
                Your Path to Success
              </span>
            </h1>

            <p className="text-xl md:text-2xl lg:text-3xl 2xl:text-4xl mb-8 text-white/90 font-light max-w-4xl mx-auto">
              Complete mock test series for DU IBA, DU FBS, BUP IBA & BUP FBS admissions
            </p>

            {/* Free First Mock Highlight */}
            <div className="inline-block bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 px-8 py-4 rounded-2xl font-black text-xl md:text-2xl mb-12 shadow-2xl transform hover:scale-105 transition-all duration-300">
              🎉 First Mock is 100% FREE!
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/mock-exams#register"
                className="group bg-white text-vh-red px-10 py-5 rounded-2xl font-bold text-lg hover:bg-vh-beige hover:text-white hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 inline-flex items-center justify-center min-h-[44px]"
              >
                <Target className="mr-3 w-6 h-6" />
                Register for Free Mock
                <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </Link>

              <Link
                href="/mocksample"
                className="group border-2 border-white/30 backdrop-blur-xl text-white px-10 py-5 rounded-2xl font-bold text-lg hover:border-white hover:bg-white/10 transition-all duration-300 inline-flex items-center justify-center min-h-[44px]"
              >
                <BarChart3 className="mr-3 w-6 h-6" />
                View Sample Analytics
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-gradient-to-br from-vh-red/5 to-transparent rounded-2xl border border-vh-red/10">
              <div className="w-16 h-16 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Advanced Analytics</h3>
              <p className="text-gray-600">Detailed performance insights, percentile rankings, and improvement tracking</p>
            </div>

            <div className="text-center p-6 bg-gradient-to-br from-vh-beige/20 to-transparent rounded-2xl border border-vh-beige/30">
              <div className="w-16 h-16 bg-gradient-to-br from-vh-beige to-vh-dark-beige rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Real Exam Format</h3>
              <p className="text-gray-600">Authentic question patterns matching actual university admission tests</p>
            </div>

            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-transparent rounded-2xl border border-green-100">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Class Rankings</h3>
              <p className="text-gray-600">Compare your performance with peers and top scorers</p>
            </div>
          </div>
        </div>
      </section>

      {/* DU IBA Mock Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-gray-50 to-white" id="du-iba">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-vh-red/10 px-4 py-2 rounded-full border border-vh-red/20 mb-4">
              <Calendar className="w-5 h-5 text-vh-red" />
              <span className="text-vh-red font-semibold">10 Mock Tests</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
              DU IBA Mock Test Series
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Complete preparation for Dhaka University Institute of Business Administration
            </p>
          </div>

          {/* Mock Schedule Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {duIbaMocks.map((mock) => (
              <div
                key={mock.no}
                className={`relative group bg-white rounded-2xl p-6 border-2 transition-all duration-300 hover:shadow-xl ${
                  mock.isFree
                    ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-white'
                    : 'border-gray-200 hover:border-vh-red/30'
                }`}
              >
                {mock.isFree && (
                  <div className="absolute -top-3 -right-3">
                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 px-3 py-1 rounded-full text-sm font-black shadow-lg">
                      FREE
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="text-4xl font-black text-vh-red">#{mock.no}</div>
                  <CheckCircle className={`w-6 h-6 ${mock.isFree ? 'text-yellow-500' : 'text-gray-300'}`} />
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-vh-red" />
                    <span className="font-semibold">{mock.date}</span>
                  </div>
                  <div className="text-sm text-gray-600">{mock.day}</div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4 text-vh-red" />
                    <span className="text-sm">{mock.time}</span>
                  </div>
                </div>

                {mock.isFree && (
                  <Link
                    href="/mock-exams#register"
                    className="block w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 text-center py-3 rounded-xl font-bold hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300"
                  >
                    Register Now - FREE
                  </Link>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/mock-exams#register"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 min-h-[44px]"
            >
              <Target className="w-6 h-6" />
              Register for DU IBA Mocks
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </section>

      {/* DU FBS Mock Section */}
      <section className="py-16 md:py-24 bg-white" id="du-fbs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-vh-beige/20 px-4 py-2 rounded-full border border-vh-beige/30 mb-4">
              <Calendar className="w-5 h-5 text-vh-dark-beige" />
              <span className="text-vh-dark-beige font-semibold">8 Mock Tests</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
              DU FBS Mock Test Series
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Complete preparation for Dhaka University Faculty of Business Studies
            </p>
          </div>

          {/* Mock Schedule Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {duFbsMocks.map((mock) => (
              <div
                key={mock.no}
                className={`relative group bg-white rounded-2xl p-6 border-2 transition-all duration-300 hover:shadow-xl ${
                  mock.isFree
                    ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-white'
                    : 'border-gray-200 hover:border-vh-beige/50'
                }`}
              >
                {mock.isFree && (
                  <div className="absolute -top-3 -right-3">
                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 px-3 py-1 rounded-full text-sm font-black shadow-lg">
                      FREE
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="text-4xl font-black text-vh-dark-beige">#{mock.no}</div>
                  <CheckCircle className={`w-6 h-6 ${mock.isFree ? 'text-yellow-500' : 'text-gray-300'}`} />
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-vh-dark-beige" />
                    <span className="font-semibold">{mock.date}</span>
                  </div>
                  <div className="text-sm text-gray-600">{mock.day}</div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4 text-vh-dark-beige" />
                    <span className="text-sm">{mock.time}</span>
                  </div>
                </div>

                {mock.isFree && (
                  <Link
                    href="/mock-exams#register"
                    className="block w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 text-center py-3 rounded-xl font-bold hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300"
                  >
                    Register Now - FREE
                  </Link>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/mock-exams#register"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-vh-beige to-vh-dark-beige text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 min-h-[44px]"
            >
              <Target className="w-6 h-6" />
              Register for DU FBS Mocks
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </section>

      {/* BUP FBS Mock Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-blue-50 to-white" id="bup-fbs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-100 px-4 py-2 rounded-full border border-blue-200 mb-4">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="text-blue-600 font-semibold">8 Mock Tests</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
              BUP FBS Mock Test Series
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Complete preparation for Bangladesh University of Professionals Faculty of Business Studies
            </p>

            {/* Coming Soon Banner */}
            <div className="max-w-2xl mx-auto bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-8 mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Clock className="w-8 h-8" />
                <h3 className="text-2xl font-black">Coming in December</h3>
              </div>
              <p className="text-blue-100 text-lg mb-6">
                Schedule and timings will be announced soon. Register now to get notified!
              </p>
              <div className="bg-white/20 backdrop-blur-xl rounded-xl p-4">
                <p className="text-sm font-semibold text-white">
                  ✓ 8 comprehensive mock tests<br />
                  ✓ First mock is FREE<br />
                  ✓ Advanced analytics included
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/mock-exams#register"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 min-h-[44px]"
            >
              <Target className="w-6 h-6" />
              Pre-Register for BUP FBS Mocks
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </section>

      {/* BUP IBA Mock Section */}
      <section className="py-16 md:py-24 bg-white" id="bup-iba">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-purple-100 px-4 py-2 rounded-full border border-purple-200 mb-4">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span className="text-purple-600 font-semibold">8 Mock Tests</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
              BUP IBA Mock Test Series
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Complete preparation for Bangladesh University of Professionals Institute of Business Administration
            </p>

            {/* Coming Soon Banner */}
            <div className="max-w-2xl mx-auto bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl p-8 mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Clock className="w-8 h-8" />
                <h3 className="text-2xl font-black">Coming in December</h3>
              </div>
              <p className="text-purple-100 text-lg mb-6">
                Schedule and timings will be announced soon. Register now to get notified!
              </p>
              <div className="bg-white/20 backdrop-blur-xl rounded-xl p-4">
                <p className="text-sm font-semibold text-white">
                  ✓ 8 comprehensive mock tests<br />
                  ✓ First mock is FREE<br />
                  ✓ Advanced analytics included
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/mock-exams#register"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 min-h-[44px]"
            >
              <Target className="w-6 h-6" />
              Pre-Register for BUP IBA Mocks
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </section>

      {/* Sample Analytics Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-vh-red/5 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-vh-red/20">
            <div className="bg-gradient-to-r from-vh-red to-vh-dark-red p-8 md:p-12 text-white">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-10 h-10" />
                <h2 className="text-3xl md:text-4xl font-black">Advanced Analytics Dashboard</h2>
              </div>
              <p className="text-xl text-white/90 mb-6">
                Get comprehensive insights into your performance with our premium analytics system
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-vh-beige" />
                  <span>Percentile rankings & class position</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-vh-beige" />
                  <span>Subject-wise performance breakdown</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-vh-beige" />
                  <span>Progress tracking across tests</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-vh-beige" />
                  <span>Top questions analysis</span>
                </div>
              </div>
            </div>

            <div className="p-8 md:p-12">
              <div className="text-center mb-8">
                <p className="text-gray-600 text-lg mb-6">
                  See how our analytics can help you identify strengths, weaknesses, and improvement areas
                </p>
                <Link
                  href="/mocksample"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 min-h-[44px]"
                >
                  <Sparkles className="w-6 h-6" />
                  View Sample Analytics
                  <ArrowRight className="w-6 h-6" />
                </Link>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">💡</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">Sample Results Preview</h3>
                    <p className="text-gray-600 text-sm">
                      Click the button above to see a real example of how your test results will be presented with detailed analytics, charts, and performance insights.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Registration CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-gray-900 via-gray-800 to-vh-dark-red text-white" id="register">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20 mb-6">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <span className="text-white/90 font-medium">Limited Seats Available</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-6">
            Ready to Excel in Your Admission Test?
          </h2>

          <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-2xl mx-auto">
            Join hundreds of successful students who prepared with VH Mock Exams
          </p>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 mb-8 border border-white/20">
            <h3 className="text-2xl font-bold mb-4">What's Included:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold">First Mock Test FREE</div>
                  <div className="text-sm text-white/70">Try before you commit</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold">Detailed Analytics</div>
                  <div className="text-sm text-white/70">Track every metric</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold">Expert Question Patterns</div>
                  <div className="text-sm text-white/70">Real exam simulation</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold">Competitive Rankings</div>
                  <div className="text-sm text-white/70">Compare with peers</div>
                </div>
              </div>
            </div>
          </div>

          <Link
            href="/registration"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 px-12 py-6 rounded-2xl font-black text-xl hover:shadow-2xl hover:shadow-yellow-500/25 transform hover:-translate-y-1 transition-all duration-300 min-h-[44px]"
          >
            <Target className="w-7 h-7" />
            Register for Free Mock Now
            <ArrowRight className="w-7 h-7" />
          </Link>

          <p className="text-sm text-white/60 mt-6">
            Program pricing details will be provided upon registration
          </p>
        </div>
      </section>

    </div>
  );
}
