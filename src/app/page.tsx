'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle, Trophy, Star, Clock, Target, BookOpen, Award, TrendingUp, ChevronRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useRef } from 'react';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5 }
  }
};

export default function Home() {
  const { scrollY } = useScroll();
  const statsRef = useRef(null);
  const universitiesRef = useRef(null);

  const statsInView = useInView(statsRef, { once: true, margin: "-100px" });
  const universitiesInView = useInView(universitiesRef, { once: true, margin: "-100px" });

  const heroY = useTransform(scrollY, [0, 500], [0, 150]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  return (
    <div className="min-h-screen bg-white">
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-vh-red-600 via-vh-red-800 to-gray-950 text-white overflow-hidden">
        {/* Sophisticated Background Elements */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-vh-beige/5 to-transparent rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-l from-white/5 to-transparent rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full">
            {/* Mobile: Fewer elements for better performance */}
            <div className="grid lg:hidden grid-cols-6 gap-8 opacity-5 transform rotate-12">
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} className="h-1 bg-white rounded animate-pulse motion-reduce:animate-none" style={{ animationDelay: `${i * 100}ms` }}></div>
              ))}
            </div>
            {/* Desktop: Full decorative grid */}
            <div className="hidden lg:grid grid-cols-12 gap-4 opacity-5 transform rotate-12">
              {Array.from({ length: 144 }).map((_, i) => (
                <div key={i} className="h-1 bg-white rounded animate-pulse motion-reduce:animate-none" style={{ animationDelay: `${i * 100}ms` }}></div>
              ))}
            </div>
          </div>
        </div>

        <motion.div
          className="relative max-w-7xl 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-20"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          <div className="text-center">
            {/* Main Headline */}
            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl 2xl:text-9xl font-black leading-tight mb-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <span className="block">Beyond the</span>
              <span className="block bg-gradient-to-r from-vh-beige via-white to-vh-beige bg-clip-text text-transparent">
                Horizons
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="text-2xl md:text-3xl lg:text-4xl 2xl:text-5xl mb-6 text-white/90 font-light"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              IBA/BUP Admission Program 2026
            </motion.p>

            {/* Description */}
            <motion.p
              className="text-lg md:text-xl mb-16 text-white/70 max-w-4xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Get into prestigious business schools with our expert guidance and proven methodology.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-6 justify-center mb-20"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/eligibility-checker"
                  className="group relative bg-gradient-to-r from-white to-vh-beige text-vh-dark-red px-12 py-5 rounded-2xl font-bold text-xl hover:shadow-2xl hover:shadow-white/25 transition-all duration-500 overflow-hidden inline-flex items-center"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-vh-beige to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <span className="relative flex items-center">
                    Check Your Eligibility
                    <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
                  </span>
                </Link>
              </motion.div>

              <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
                <a
                  href="https://forms.fillout.com/t/iCXMk5dbQsus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group border-2 border-white/30 backdrop-blur-xl text-white px-12 py-5 rounded-2xl font-bold text-xl hover:border-white hover:bg-white/10 transition-all duration-500 inline-flex items-center justify-center"
                >
                  <Target className="mr-3 w-6 h-6" />
                  Register Now
                </a>
              </motion.div>
            </motion.div>

            {/* Key Statistics */}
            <motion.div
              ref={statsRef}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3 gap-6 md:gap-8 2xl:gap-10 max-w-6xl 2xl:max-w-7xl mx-auto"
              variants={staggerContainer}
              initial="hidden"
              animate={statsInView ? "visible" : "hidden"}
            >
              <motion.div className="relative group" variants={scaleIn} whileHover={{ scale: 1.05 }}>
                <div className="absolute inset-0 bg-gradient-to-r from-vh-beige-400/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <Card variant="filled" padding="lg" className="relative bg-white/5 backdrop-blur-xl border-white/10 text-center hover:bg-white/10 transition-all duration-500 h-full">
                  <div className="text-5xl font-black mb-4 bg-gradient-to-r from-vh-beige-300 to-white bg-clip-text text-transparent">1.2%</div>
                  <div className="text-lg font-semibold mb-2 text-white">IBA Acceptance Rate</div>
                  <div className="text-sm text-white/60">More selective than Harvard at 3.5%</div>
                </Card>
              </motion.div>

              <motion.div className="relative group" variants={scaleIn} whileHover={{ scale: 1.05 }}>
                <div className="absolute inset-0 bg-gradient-to-r from-vh-beige-400/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <Card variant="filled" padding="lg" className="relative bg-white/5 backdrop-blur-xl border-white/10 text-center hover:bg-white/10 transition-all duration-500 h-full">
                  <div className="text-5xl font-black mb-4 bg-gradient-to-r from-vh-beige-300 to-white bg-clip-text text-transparent">46.7%</div>
                  <div className="text-lg font-semibold mb-2 text-white">Our Success Rate</div>
                  <div className="text-sm text-white/60">14 out of 30 students got into top universities</div>
                </Card>
              </motion.div>

              <motion.div className="relative group" variants={scaleIn} whileHover={{ scale: 1.05 }}>
                <div className="absolute inset-0 bg-gradient-to-r from-vh-beige-400/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <Card variant="filled" padding="lg" className="relative bg-white/5 backdrop-blur-xl border-white/10 text-center hover:bg-white/10 transition-all duration-500 h-full">
                  <div className="text-5xl font-black mb-4 bg-gradient-to-r from-vh-beige-300 to-white bg-clip-text text-transparent">4-5</div>
                  <div className="text-lg font-semibold mb-2 text-white">Months Duration</div>
                  <div className="text-sm text-white/60">Intensive program</div>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* About Universities Section */}
      <section ref={universitiesRef} className="py-12 md:py-20 lg:py-28 xl:py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-vh-beige/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-vh-red/3 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12 md:mb-16 lg:mb-20"
            variants={fadeInUp}
            initial="hidden"
            animate={universitiesInView ? "visible" : "hidden"}
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-black text-gray-900 mb-6 md:mb-8">
              About the <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Universities</span>
            </h2>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              IBA and BUP are top business schools providing world-class education and career opportunities.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16"
            variants={staggerContainer}
            initial="hidden"
            animate={universitiesInView ? "visible" : "hidden"}
          >
            {/* IBA Card */}
            <motion.div className="group relative" variants={scaleIn} whileHover={{ y: -8 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red-600/20 to-vh-red-800/20 rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl group-hover:border-vh-red-200 transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-vh-red-600 to-vh-red-800 rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">IBA, Dhaka University</h3>
                    <Badge variant="solid" colorScheme="primary" size="md" className="mt-2">Institute of Business Administration</Badge>
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
                      <div className="w-6 h-6 bg-vh-red-600 rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* BUP Card */}
            <motion.div className="group relative" variants={scaleIn} whileHover={{ y: -8 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-vh-beige-700/20 to-vh-beige-400/20 rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl group-hover:border-vh-beige-300 transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-vh-beige-700 to-vh-beige-500 rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                    <Award className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">BUP</h3>
                    <Badge variant="solid" colorScheme="secondary" size="md" className="mt-2">Bangladesh University of Professionals</Badge>
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
                      <div className="w-6 h-6 bg-vh-beige-700 rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Course Details Section */}
      <section className="py-12 md:py-20 lg:py-28 xl:py-32 bg-white relative overflow-hidden">
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
          <div className="text-center mb-12 md:mb-16 lg:mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-black text-gray-900 mb-6 md:mb-8">
              Course <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Details</span>
            </h2>
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto">
              4-5 months intensive program covering all aspects of admission preparation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8 md:gap-10 lg:gap-12">
            {/* Schedule */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red-600/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <Card variant="filled" padding="lg" className="relative bg-gray-50 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500">
                <div className="w-16 h-16 bg-gradient-to-br from-vh-red-600 to-vh-red-800 rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-xl">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-8 text-center">Class Schedule</h3>
                <div className="space-y-4">
                  {[
                    { day: "Sunday", time: "2:00 PM - 4:00 PM" },
                    { day: "Monday", time: "3:00 PM - 5:00 PM" },
                    { day: "Thursday", time: "2:00 PM - 4:00 PM" }
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red-200 transition-all duration-300">
                      <span className="font-bold text-gray-900">{item.day}</span>
                      <span className="text-gray-600 font-medium">{item.time}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* What's Included */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-beige-700/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <Card variant="filled" padding="lg" className="relative bg-gray-50 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500">
                <div className="w-16 h-16 bg-gradient-to-br from-vh-beige-700 to-vh-beige-500 rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-xl">
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
                      <div className="w-6 h-6 bg-vh-red-600 rounded-full flex items-center justify-center mr-4">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Test Structure */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-beige-400/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <Card variant="filled" padding="lg" className="relative bg-gray-50 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500">
                <div className="w-16 h-16 bg-gradient-to-br from-vh-beige-500 to-vh-beige-700 rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-xl">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-8 text-center">Test Structure</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red-200 transition-all duration-300">
                    <div className="font-bold text-gray-900">1.5 hours MCQ + 30 minutes written</div>
                    <div className="text-gray-600 text-sm">+1 correct, -0.25 wrong answers</div>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red-200 transition-all duration-300">
                    <div className="font-bold text-gray-900">Mathematics: 25 questions (need 10)</div>
                    <div className="text-gray-600 text-sm">English: 30 questions (need 12)</div>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red-200 transition-all duration-300">
                    <div className="font-bold text-gray-900">Analytical: 15 questions (need 6)</div>
                    <div className="text-gray-600 text-sm">Written: 30 marks (need 12), Interview: 20 marks (need 12)</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Instructor Profiles */}
      <section className="py-12 md:py-20 lg:py-28 xl:py-32 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-vh-red/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-vh-beige/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16 lg:mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-black text-gray-900 mb-6 md:mb-8">
              Instructor <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Profiles</span>
            </h2>
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto">
              Learn from top achievers with proven track records and expert instruction methods.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16">
            {/* Instructor 1 */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red-600/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl group-hover:border-vh-red-200 transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-vh-red-600 to-vh-red-800 rounded-3xl flex items-center justify-center text-white text-3xl font-black mr-8 shadow-2xl">
                    MH
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">Md Hasan Sarower</h3>
                    <Badge variant="solid" colorScheme="primary" size="md" className="mt-2">Mathematics + Analytical</Badge>
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
                      <div className="w-10 h-10 bg-vh-beige-100 rounded-xl flex items-center justify-center text-vh-red-600 mr-4 group-hover/item:bg-vh-red-600 group-hover/item:text-white transition-all duration-300">
                        {item.icon}
                      </div>
                      <span className="text-gray-700 font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Instructor 2 */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-vh-beige-700/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl group-hover:border-vh-beige-300 transition-all duration-700">
                <div className="flex items-center mb-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-vh-beige-700 to-vh-beige-500 rounded-3xl flex items-center justify-center text-white text-3xl font-black mr-8 shadow-2xl">
                    AA
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">Ahnaf Ahad</h3>
                    <Badge variant="solid" colorScheme="secondary" size="md" className="mt-2">English + Analytical</Badge>
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
                      <div className="w-10 h-10 bg-vh-beige-100 rounded-xl flex items-center justify-center text-vh-beige-700 mr-4 group-hover/item:bg-vh-beige-700 group-hover/item:text-white transition-all duration-300">
                        {item.icon}
                      </div>
                      <span className="text-gray-700 font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories Section */}
      <section className="py-12 md:py-20 lg:py-28 xl:py-32 bg-white relative overflow-hidden">
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
          <div className="text-center mb-12 md:mb-16 lg:mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-black text-gray-900 mb-6 md:mb-8">
              Success <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Stories</span>
            </h2>
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto">
              Last batch results: 30 students total with outstanding achievements.
            </p>
          </div>

          {/* Main Success Rate */}
          <div className="mb-12 md:mb-16 lg:mb-20">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-vh-red/20 to-vh-dark-red/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-700"></div>
              <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-3xl p-8 md:p-12 lg:p-14 xl:p-16 border border-gray-200 shadow-2xl text-center">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8 md:gap-10 lg:gap-12">
            {[
              { number: "2", title: "IBA Admissions", subtitle: "Students got into IBA" },
              { number: "5", title: "BUP Admissions", subtitle: "Students got into BUP" },
              { number: "7", title: "DU FBS Admissions", subtitle: "Students got into DU FBS" }
            ].map((item, index) => (
              <div key={index} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-vh-red/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500 motion-reduce:transition-none"></div>
                <div className="relative bg-gray-50 rounded-3xl p-6 md:p-8 lg:p-10 border border-gray-200 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500 text-center">
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
      <section className="py-12 md:py-20 lg:py-28 xl:py-32 bg-gradient-to-br from-gray-900 via-gray-950 to-vh-red-800 text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-vh-red/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-l from-vh-beige/10 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-black mb-6 md:mb-8">
            Ready to <span className="bg-gradient-to-r from-vh-beige to-white bg-clip-text text-transparent">Begin?</span>
          </h2>
          <p className="text-2xl text-gray-300 mb-16 max-w-4xl mx-auto leading-relaxed">
            Take the first step toward your academic success with our comprehensive admission preparation program.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link href="/eligibility-checker">
              <Button
                variant="solid"
                colorScheme="primary"
                size="lg"
                leftIcon={<Target className="w-6 h-6" />}
                rightIcon={<ArrowRight className="w-6 h-6" />}
                className="group w-full sm:w-auto text-lg px-12"
              >
                Check Eligibility
              </Button>
            </Link>
            <Link href="/du-fbs-course">
              <Button
                variant="outline"
                colorScheme="gray"
                size="lg"
                leftIcon={<BookOpen className="w-6 h-6" />}
                className="w-full sm:w-auto text-lg px-12 border-white text-white hover:bg-white hover:text-gray-900"
              >
                DU FBS Course
              </Button>
            </Link>
            <a
              href="https://forms.fillout.com/t/iCXMk5dbQsus"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="solid"
                colorScheme="secondary"
                size="lg"
                leftIcon={<ChevronRight className="w-6 h-6" />}
                className="group w-full sm:w-auto text-lg px-12 bg-gradient-to-r from-vh-beige-500 to-vh-beige-700 hover:shadow-2xl hover:shadow-vh-beige-300/25 transform hover:-translate-y-1"
              >
                Register Now
              </Button>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}