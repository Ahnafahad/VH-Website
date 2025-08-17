import Link from 'next/link';
import { ArrowRight, CheckCircle, Trophy, Star, Clock, Users, Target, BookOpen, Award, TrendingUp, Zap, Shield, Play, ChevronRight, Quote } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      
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
            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-tight mb-8">
              <span className="block">Beyond the</span>
              <span className="block bg-gradient-to-r from-vh-beige via-white to-vh-beige bg-clip-text text-transparent">
                Horizons
              </span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-2xl md:text-3xl mb-6 text-white/90 font-light">
              IBA/BUP Admission Program 2026
            </p>
            
            {/* Description */}
            <p className="text-lg md:text-xl mb-16 text-white/70 max-w-4xl mx-auto leading-relaxed">
              Get into prestigious business schools with our expert guidance and proven methodology.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20">
              <Link
                href="/eligibility-checker"
                className="group relative bg-gradient-to-r from-white to-vh-beige text-vh-dark-red px-12 py-5 rounded-2xl font-bold text-xl hover:shadow-2xl hover:shadow-white/25 transform hover:-translate-y-3 transition-all duration-500 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-vh-beige to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <span className="relative flex items-center">
                  Check Your Eligibility
                  <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
                </span>
              </Link>
              
              <a
                href="https://forms.fillout.com/t/iCXMk5dbQsus"
                target="_blank"
                rel="noopener noreferrer"
                className="group border-2 border-white/30 backdrop-blur-xl text-white px-12 py-5 rounded-2xl font-bold text-xl hover:border-white hover:bg-white/10 transition-all duration-500 inline-flex items-center justify-center"
              >
                <Target className="mr-3 w-6 h-6" />
                Register Now
              </a>
            </div>

            {/* Key Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-vh-beige/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center hover:bg-white/10 transition-all duration-500">
                  <div className="text-5xl font-black mb-4 bg-gradient-to-r from-vh-beige to-white bg-clip-text text-transparent">1.2%</div>
                  <div className="text-lg font-semibold mb-2">IBA Acceptance Rate</div>
                  <div className="text-sm text-white/60">More selective than Harvard at 3.5%</div>
                </div>
              </div>

              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-vh-beige/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center hover:bg-white/10 transition-all duration-500">
                  <div className="text-5xl font-black mb-4 bg-gradient-to-r from-vh-beige to-white bg-clip-text text-transparent">46.7%</div>
                  <div className="text-lg font-semibold mb-2">Our Success Rate</div>
                  <div className="text-sm text-white/60">14 out of 30 students got into top universities</div>
                </div>
              </div>

              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-vh-beige/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center hover:bg-white/10 transition-all duration-500">
                  <div className="text-5xl font-black mb-4 bg-gradient-to-r from-vh-beige to-white bg-clip-text text-transparent">4-5</div>
                  <div className="text-lg font-semibold mb-2">Months Duration</div>
                  <div className="text-sm text-white/60">Intensive program</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Universities Section */}
      <section className="py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-vh-beige/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-vh-red/3 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-6xl lg:text-7xl font-black text-gray-900 mb-8">
              About the <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Universities</span>
            </h2>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              IBA and BUP are top business schools providing world-class education and career opportunities.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* IBA Card */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red/20 to-vh-dark-red/20 rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <div className="relative bg-white rounded-3xl p-12 shadow-2xl border border-gray-100 group-hover:shadow-4xl group-hover:border-vh-red/20 transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">IBA, Dhaka University</h3>
                    <p className="text-vh-red font-bold text-lg">Institute of Business Administration</p>
                  </div>
                </div>
                
                <p className="text-gray-700 mb-8 text-lg leading-relaxed">
                  Top business school producing Financial Analysts, Management Consultants, and future CEOs with notable alumni in leadership positions at major companies.
                </p>
                
                <div className="space-y-4">
                  {[
                    "Financial Analyst career opportunities",
                    "Management Consultant positions",
                    "CEO and leadership roles preparation"
                  ].map((item, index) => (
                    <div key={index} className="flex items-center group/item">
                      <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* BUP Card */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-dark-beige/20 to-vh-beige/20 rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <div className="relative bg-white rounded-3xl p-12 shadow-2xl border border-gray-100 group-hover:shadow-4xl group-hover:border-vh-dark-beige/20 transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-vh-dark-beige to-vh-beige rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                    <Award className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">BUP</h3>
                    <p className="text-vh-red font-bold text-lg">Bangladesh University of Professionals</p>
                  </div>
                </div>
                
                <p className="text-gray-700 mb-8 text-lg leading-relaxed">
                  Premier business education with career opportunities in management, consulting, and executive positions across major corporations.
                </p>
                
                <div className="space-y-4">
                  {[
                    "Management career pathways",
                    "Corporate leadership positions",
                    "Business consulting opportunities"
                  ].map((item, index) => (
                    <div key={index} className="flex items-center group/item">
                      <div className="w-6 h-6 bg-vh-dark-beige rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Course Details Section */}
      <section className="py-32 bg-white relative overflow-hidden">
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
          <div className="text-center mb-20">
            <h2 className="text-6xl lg:text-7xl font-black text-gray-900 mb-8">
              Course <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Details</span>
            </h2>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto">
              4-5 months intensive program covering all aspects of admission preparation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Schedule */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-gray-50 rounded-3xl p-10 border border-gray-200 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500">
                <div className="w-16 h-16 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-xl">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-8 text-center">Class Schedule</h3>
                <div className="space-y-4">
                  {[
                    { day: "Sunday", time: "2:00 PM - 4:00 PM" },
                    { day: "Monday", time: "3:00 PM - 5:00 PM" },
                    { day: "Thursday", time: "2:00 PM - 4:00 PM" }
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red/20 transition-all duration-300">
                      <span className="font-bold text-gray-900">{item.day}</span>
                      <span className="text-gray-600 font-medium">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* What's Included */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-dark-beige/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-gray-50 rounded-3xl p-10 border border-gray-200 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500">
                <div className="w-16 h-16 bg-gradient-to-br from-vh-dark-beige to-vh-beige rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-xl">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-8 text-center">What's Included</h3>
                <div className="space-y-4">
                  {[
                    "2-3 monthly class tests",
                    "3-5 pre-mock examinations",
                    "4-5 BUP-pattern mock tests",
                    "8-10 IBA-pattern mock tests",
                    "Expert instruction in Math, English, and Analytical reasoning"
                  ].map((item, index) => (
                    <div key={index} className="flex items-center">
                      <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center mr-4">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Test Structure */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-beige/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-gray-50 rounded-3xl p-10 border border-gray-200 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500">
                <div className="w-16 h-16 bg-gradient-to-br from-vh-beige to-vh-dark-beige rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-xl">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-8 text-center">Test Structure</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red/20 transition-all duration-300">
                    <div className="font-bold text-gray-900">1.5 hours MCQ + 30 minutes written</div>
                    <div className="text-gray-600 text-sm">+1 correct, -0.25 wrong answers</div>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red/20 transition-all duration-300">
                    <div className="font-bold text-gray-900">Mathematics: 25 questions (need 10)</div>
                    <div className="text-gray-600 text-sm">English: 30 questions (need 12)</div>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red/20 transition-all duration-300">
                    <div className="font-bold text-gray-900">Analytical: 15 questions (need 6)</div>
                    <div className="text-gray-600 text-sm">Written: 30 marks (need 12), Interview: 20 marks (need 12)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Instructor Profiles */}
      <section className="py-32 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-vh-red/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-vh-beige/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-6xl lg:text-7xl font-black text-gray-900 mb-8">
              Instructor <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Profiles</span>
            </h2>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto">
              Learn from top achievers with proven track records and expert instruction methods.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Instructor 1 */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <div className="relative bg-white rounded-3xl p-12 shadow-2xl border border-gray-200 group-hover:shadow-4xl group-hover:border-vh-red/20 transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-3xl flex items-center justify-center text-white text-3xl font-black mr-8 shadow-2xl">
                    MH
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">Md Hasan Sarower</h3>
                    <p className="text-vh-red font-bold text-lg">Mathematics + Analytical</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {[
                    { icon: <Star className="w-5 h-5" />, text: "From Mastermind School" },
                    { icon: <Trophy className="w-5 h-5" />, text: "O Levels: 12 A*, A Levels: 4 A* + 2 A" },
                    { icon: <Award className="w-5 h-5" />, text: "IBA DU Rank 41" },
                    { icon: <CheckCircle className="w-5 h-5" />, text: "Valedictorian and highest A* achiever in South Asia 2022" }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center group/item">
                      <div className="w-10 h-10 bg-vh-beige/20 rounded-xl flex items-center justify-center text-vh-red mr-4 group-hover/item:bg-vh-red group-hover/item:text-white transition-all duration-300">
                        {item.icon}
                      </div>
                      <span className="text-gray-700 font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Instructor 2 */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-dark-beige/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <div className="relative bg-white rounded-3xl p-12 shadow-2xl border border-gray-200 group-hover:shadow-4xl group-hover:border-vh-dark-beige/20 transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-vh-dark-beige to-vh-beige rounded-3xl flex items-center justify-center text-white text-3xl font-black mr-8 shadow-2xl">
                    AA
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">Ahnaf Ahad</h3>
                    <p className="text-vh-red font-bold text-lg">English + Analytical</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {[
                    { icon: <Star className="w-5 h-5" />, text: "From South Breeze School" },
                    { icon: <Trophy className="w-5 h-5" />, text: "O Levels: 6 A* + 2 A, A Levels: 4 A" },
                    { icon: <Award className="w-5 h-5" />, text: "IBA DU Rank 9, BBA General from BUP, DU FBS Rank 11" },
                    { icon: <CheckCircle className="w-5 h-5" />, text: "Expert in English and Analytical reasoning" }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center group/item">
                      <div className="w-10 h-10 bg-vh-beige/20 rounded-xl flex items-center justify-center text-vh-dark-beige mr-4 group-hover/item:bg-vh-dark-beige group-hover/item:text-white transition-all duration-300">
                        {item.icon}
                      </div>
                      <span className="text-gray-700 font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories Section */}
      <section className="py-32 bg-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-5">
            <div className="grid grid-cols-6 gap-12">
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} className="aspect-square bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-6xl lg:text-7xl font-black text-gray-900 mb-8">
              Success <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Stories</span>
            </h2>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto">
              Last batch results: 30 students total with outstanding achievements.
            </p>
          </div>

          {/* Main Success Rate */}
          <div className="mb-20">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-vh-red/20 to-vh-dark-red/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-700"></div>
              <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-3xl p-16 border border-gray-200 shadow-2xl text-center">
                <div className="flex items-center justify-center mb-8">
                  <TrendingUp className="w-16 h-16 text-vh-red mr-6" />
                  <div>
                    <div className="text-7xl font-black text-gray-900 mb-2">46.7%</div>
                    <div className="text-2xl font-bold text-vh-red">Success Rate</div>
                  </div>
                </div>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                  14 out of 30 students from last batch got into top universities of Bangladesh.
                </p>
              </div>
            </div>
          </div>

          {/* Individual Results */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { number: "2", title: "IBA Admissions", subtitle: "Students got into IBA" },
              { number: "5", title: "BUP Admissions", subtitle: "Students got into BUP" },
              { number: "7", title: "DU FBS Admissions", subtitle: "Students got into DU FBS" }
            ].map((item, index) => (
              <div key={index} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-vh-red/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-gray-50 rounded-3xl p-10 border border-gray-200 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-full flex items-center justify-center text-white text-4xl font-black mx-auto mb-6 shadow-xl">
                    {item.number}
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3">{item.title}</h3>
                  <p className="text-gray-600 font-medium">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Call-to-Action Section */}
      <section className="py-32 bg-gradient-to-br from-gray-900 via-black to-vh-dark-red text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-vh-red/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-l from-vh-beige/10 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-6xl lg:text-7xl font-black mb-8">
            Ready to <span className="bg-gradient-to-r from-vh-beige to-white bg-clip-text text-transparent">Begin?</span>
          </h2>
          <p className="text-2xl text-gray-300 mb-16 max-w-4xl mx-auto leading-relaxed">
            Take the first step toward your academic success with our comprehensive admission preparation program.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              href="/eligibility-checker"
              className="group bg-vh-red hover:bg-vh-dark-red text-white px-12 py-4 rounded-2xl font-bold text-lg transition-all duration-300 inline-flex items-center justify-center"
            >
              <Target className="mr-3 w-6 h-6" />
              Check Eligibility
              <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/du-fbs-course"
              className="border-2 border-white text-white hover:bg-white hover:text-gray-900 px-12 py-4 rounded-2xl font-bold text-lg transition-all duration-300 inline-flex items-center justify-center"
            >
              <BookOpen className="mr-3 w-6 h-6" />
              DU FBS Course
            </Link>
            <a
              href="https://forms.fillout.com/t/iCXMk5dbQsus"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-gradient-to-r from-vh-beige to-vh-dark-beige text-white px-12 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-vh-beige/25 transform hover:-translate-y-1 transition-all duration-300 inline-flex items-center justify-center"
            >
              <ChevronRight className="mr-3 w-6 h-6" />
              Register Now
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}