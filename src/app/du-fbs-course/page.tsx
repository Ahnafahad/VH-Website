'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Trophy, ArrowRight, Award, BookOpen, Target, TrendingUp } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';

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
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5 }
  }
};

export default function DUFBSCoursePage() {
  const { scrollY } = useScroll();
  const aboutRef = useRef(null);
  const courseRef = useRef(null);
  const instructorRef = useRef(null);

  const aboutInView = useInView(aboutRef, { once: true, margin: "-100px" });
  const courseInView = useInView(courseRef, { once: true, margin: "-100px" });
  const instructorInView = useInView(instructorRef, { once: true, margin: "-100px" });

  const heroY = useTransform(scrollY, [0, 500], [0, 150]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <div className="min-h-screen bg-white">
      {/* Page Header */}
      <motion.div
        className="bg-white shadow-lg border-b border-vh-beige/30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
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
      </motion.div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-vh-red via-vh-dark-red to-black text-white overflow-hidden">
        {/* Animated Background Elements */}
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
            <div className="grid grid-cols-12 gap-4 opacity-5 transform rotate-12">
              {Array.from({ length: 144 }).map((_, i) => (
                <div key={i} className="h-1 bg-white rounded animate-pulse" style={{ animationDelay: `${i * 100}ms` }}></div>
              ))}
            </div>
          </div>
        </div>

        <motion.div
          className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          <div className="text-center">
            <motion.h1
              className="text-5xl md:text-7xl lg:text-8xl font-black leading-tight mb-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              DU FBS Admission Program
              <span className="block text-4xl md:text-5xl lg:text-6xl bg-gradient-to-r from-vh-beige via-white to-vh-beige bg-clip-text text-transparent mt-4">
                2025
              </span>
            </motion.h1>

            <motion.h2
              className="text-2xl md:text-3xl mb-6 text-white/90 font-light"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Faculty of Business Studies - University of Dhaka
            </motion.h2>

            <motion.p
              className="text-lg md:text-xl mb-16 text-white/70 max-w-4xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Specialized preparation for one of Bangladesh's most prestigious business faculties
            </motion.p>

            {/* Key Statistics */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.div className="relative group" variants={scaleIn} whileHover={{ scale: 1.05 }}>
                <div className="absolute inset-0 bg-gradient-to-r from-vh-beige/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <Card variant="filled" padding="lg" className="relative bg-white/5 backdrop-blur-xl border-white/10 text-center hover:bg-white/10 transition-all duration-500 h-full">
                  <div className="text-5xl font-black mb-4 bg-gradient-to-r from-vh-beige to-white bg-clip-text text-transparent">2%</div>
                  <div className="text-lg font-semibold mb-2">DU FBS Acceptance Rate</div>
                  <div className="text-sm text-white/60">(50,000 applicants, 1,050 seats)</div>
                </Card>
              </motion.div>

              <motion.div className="relative group" variants={scaleIn} whileHover={{ scale: 1.05 }}>
                <div className="absolute inset-0 bg-gradient-to-r from-vh-beige/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <Card variant="filled" padding="lg" className="relative bg-white/5 backdrop-blur-xl border-white/10 text-center hover:bg-white/10 transition-all duration-500 h-full">
                  <div className="text-5xl font-black mb-4 bg-gradient-to-r from-vh-beige to-white bg-clip-text text-transparent">23.3%</div>
                  <div className="text-lg font-semibold mb-2">Our Success Rate</div>
                  <div className="text-sm text-white/60">(7 out of 30 students from last batch)</div>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* About DU FBS Section */}
      <section ref={aboutRef} className="py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-vh-beige/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-vh-red/3 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-20"
            variants={fadeInUp}
            initial="hidden"
            animate={aboutInView ? "visible" : "hidden"}
          >
            <h2 className="text-6xl lg:text-7xl font-black text-gray-900 mb-8">
              About DU <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Faculty of Business Studies</span>
            </h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-16"
            variants={staggerContainer}
            initial="hidden"
            animate={aboutInView ? "visible" : "hidden"}
          >
            {/* Prestigious Institution */}
            <motion.div className="group relative" variants={scaleIn} whileHover={{ y: -8 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red/20 to-vh-dark-red/20 rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl group-hover:border-vh-red/20 transition-all duration-700 h-full">
                <div className="flex items-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">Prestigious Institution</h3>
                  </div>
                </div>

                <p className="text-gray-700 mb-8 text-lg leading-relaxed">
                  The Faculty of Business Studies at Dhaka University is one of the most respected
                  business education institutions in Bangladesh, offering world-class education
                  across 8 specialized departments.
                </p>

                <div className="space-y-4">
                  {[
                    "8 specialized business departments",
                    "1,050 seats available annually",
                    "Strong industry connections"
                  ].map((item, index) => (
                    <div key={index} className="flex items-center group/item">
                      <div className="w-6 h-6 bg-vh-red rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Career Opportunities */}
            <motion.div className="group relative" variants={scaleIn} whileHover={{ y: -8 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-vh-dark-beige/20 to-vh-beige/20 rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl group-hover:border-vh-dark-beige/20 transition-all duration-700 h-full">
                <div className="flex items-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-vh-dark-beige to-vh-beige rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                    <Award className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">Career Opportunities</h3>
                  </div>
                </div>

                <p className="text-gray-700 mb-8 text-lg leading-relaxed">
                  Graduates from DU FBS are highly sought after by top companies and have
                  excellent prospects in both local and international markets.
                </p>

                <div className="space-y-4">
                  {[
                    "Top corporate positions",
                    "International job opportunities",
                    "Entrepreneurship support"
                  ].map((item, index) => (
                    <div key={index} className="flex items-center group/item">
                      <div className="w-6 h-6 bg-vh-dark-beige rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                        <Trophy className="w-4 h-4 text-white" />
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

      {/* Exam Structure Section */}
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
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-6xl lg:text-7xl font-black text-gray-900 mb-8">
              DU FBS <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Exam Structure</span>
            </h2>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto">
              Understanding the specific format and requirements for DU FBS admission
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-12"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {/* Test Format */}
            <motion.div className="group relative" variants={scaleIn}>
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <Card variant="filled" padding="xl" className="relative bg-gray-50 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-xl">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-8 text-center">Test Format</h3>
                <div className="space-y-4">
                  {[
                    { label: "Total Duration:", value: "1 hour 30 minutes" },
                    { label: "MCQ Section:", value: "45 minutes" },
                    { label: "Written Section:", value: "45 minutes" },
                    { label: "Total Marks:", value: "100 (60 MCQ + 40 Written)" },
                    { label: "Scoring:", value: "+1 correct, -0.25 wrong" }
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red/20 transition-all duration-300">
                      <span className="font-medium text-gray-700">{item.label}</span>
                      <span className="font-bold text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Subject Requirements */}
            <motion.div className="group relative" variants={scaleIn}>
              <div className="absolute inset-0 bg-gradient-to-br from-vh-beige/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <Card variant="filled" padding="xl" className="relative bg-gray-50 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-vh-beige to-vh-dark-beige rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-xl">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-8 text-center">Subject Requirements</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red/20 transition-all duration-300">
                    <div className="font-bold text-gray-900">English (Mandatory)</div>
                    <div className="text-gray-600 text-sm">Basic English: 5/16 required</div>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red/20 transition-all duration-300">
                    <div className="font-bold text-gray-900">Choose from:</div>
                    <div className="text-gray-600 text-sm">Math, Economics, Business Studies, Accounting, Statistics</div>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-gray-100 group-hover:border-vh-red/20 transition-all duration-300">
                    <div className="font-bold text-gray-900">Pass Requirements:</div>
                    <div className="text-gray-600 text-sm">MCQ: 24/60, Written: 11/40</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Course Offerings Section */}
      <section ref={courseRef} className="py-32 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-vh-red/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-vh-beige/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-20"
            variants={fadeInUp}
            initial="hidden"
            animate={courseInView ? "visible" : "hidden"}
          >
            <h2 className="text-6xl lg:text-7xl font-black text-gray-900 mb-8">
              Our DU FBS <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Course Offerings</span>
            </h2>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto">
              Comprehensive preparation from September to exam date
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-16"
            variants={staggerContainer}
            initial="hidden"
            animate={courseInView ? "visible" : "hidden"}
          >
            {/* What's Included */}
            <motion.div className="group relative" variants={scaleIn} whileHover={{ y: -8 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl group-hover:border-vh-red/20 transition-all duration-700 h-full">
                <h3 className="text-3xl font-black text-gray-900 mb-8">What's Included</h3>
                <div className="space-y-4">
                  {[
                    "10 comprehensive mock examinations",
                    "Topic-wise discussions for all subjects",
                    "Study notes for core subjects",
                    "September to exam date duration",
                    "Same class schedule as IBA/BUP program"
                  ].map((item, index) => (
                    <div key={index} className="flex items-center group/item">
                      <div className="w-10 h-10 bg-vh-beige/20 rounded-xl flex items-center justify-center text-vh-red mr-4 group-hover/item:bg-vh-red group-hover/item:text-white transition-all duration-300">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <span className="text-gray-700 font-medium text-lg">{item}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Lead Instructor Achievements */}
            <motion.div className="group relative" variants={scaleIn} whileHover={{ y: -8 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-vh-dark-beige/20 to-transparent rounded-3xl blur-2xl group-hover:blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
              <Card variant="elevated" padding="xl" className="relative group-hover:shadow-4xl group-hover:border-vh-dark-beige/20 transition-all duration-700 h-full">
                <div className="flex items-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl flex items-center justify-center mr-6 shadow-xl">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">Md Hasan Sarower</h3>
                    <p className="text-vh-red font-bold text-lg">Lead Mathematics Instructor</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { icon: <Trophy className="w-5 h-5" />, text: "O Levels: 12 A* + 0 A" },
                    { icon: <Award className="w-5 h-5" />, text: "A Levels: 4 A* + 2 A" }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center group/item">
                      <div className="w-10 h-10 bg-vh-beige/20 rounded-xl flex items-center justify-center text-vh-red mr-4 group-hover/item:bg-vh-red group-hover/item:text-white transition-all duration-300">
                        {item.icon}
                      </div>
                      <span className="text-gray-700 font-medium text-lg">{item.text}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Instructor Profiles Section */}
      <section ref={instructorRef} className="py-32 bg-white relative overflow-hidden">
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
          <motion.div
            className="text-center mb-20"
            variants={fadeInUp}
            initial="hidden"
            animate={instructorInView ? "visible" : "hidden"}
          >
            <h2 className="text-6xl lg:text-7xl font-black text-gray-900 mb-8">
              DU FBS Specialist <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Instructors</span>
            </h2>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto">
              Learn from experts who understand the DU FBS exam pattern
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-12"
            variants={staggerContainer}
            initial="hidden"
            animate={instructorInView ? "visible" : "hidden"}
          >
            {/* Instructor 1 */}
            <motion.div className="group relative" variants={scaleIn} whileHover={{ y: -8 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-vh-red/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <Card variant="filled" padding="xl" className="relative bg-gray-50 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500 text-center h-full">
                <div className="w-20 h-20 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-full flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 shadow-xl">
                  AA
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3">Ahnaf Ahad</h3>
                <p className="text-vh-red font-bold text-lg mb-4">English + Business</p>
                <div className="space-y-2 text-sm text-gray-700">
                  <div>DU FBS Rank 11</div>
                  <div>IBA DU Rank 9</div>
                  <div>BBA General from BUP</div>
                </div>
              </Card>
            </motion.div>

            {/* Instructor 2 */}
            <motion.div className="group relative" variants={scaleIn} whileHover={{ y: -8 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-vh-dark-beige/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <Card variant="filled" padding="xl" className="relative bg-gray-50 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500 text-center h-full">
                <div className="w-20 h-20 bg-gradient-to-br from-vh-dark-beige to-vh-beige rounded-full flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 shadow-xl">
                  RT
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3">Rahmi Tasnim</h3>
                <p className="text-vh-red font-bold text-lg mb-4">Economics & Business Studies</p>
                <div className="space-y-2 text-sm text-gray-700">
                  <div>DU FBS-IB specialist</div>
                  <div>Expert in Economics</div>
                  <div>Business Studies focus</div>
                </div>
              </Card>
            </motion.div>

            {/* Instructor 3 */}
            <motion.div className="group relative" variants={scaleIn} whileHover={{ y: -8 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-vh-light-red/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <Card variant="filled" padding="xl" className="relative bg-gray-50 group-hover:bg-white group-hover:shadow-2xl transition-all duration-500 text-center h-full">
                <div className="w-20 h-20 bg-gradient-to-br from-vh-light-red to-vh-red rounded-full flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 shadow-xl">
                  MH
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3">Md Hasan Sarower</h3>
                <p className="text-vh-red font-bold text-lg mb-4">Mathematics</p>
                <div className="space-y-2 text-sm text-gray-700">
                  <div>IBA DU Rank 41</div>
                  <div>Expert in advanced mathematics</div>
                  <div>12 A* in O Levels</div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Success Stories Section */}
      <section className="py-32 bg-gradient-to-br from-vh-beige/10 to-vh-dark-beige/10 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-vh-beige/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-vh-red/3 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-6xl lg:text-7xl font-black text-gray-900 mb-8">
              DU FBS <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Success Stories</span>
            </h2>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto">
              Our students' achievements in DU FBS admissions
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Card variant="elevated" padding="none" className="overflow-hidden">
              <div className="p-16 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-vh-beige/10 rounded-full -translate-y-16 translate-x-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-vh-red/10 rounded-full translate-y-12 -translate-x-12"></div>

                <div className="relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                    <motion.div
                      className="group text-center"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="w-24 h-24 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-full flex items-center justify-center text-white text-4xl font-black mx-auto mb-6 shadow-xl">
                        7
                      </div>
                      <h3 className="text-3xl font-black text-gray-900 mb-3">Students Accepted</h3>
                      <p className="text-gray-600 text-lg">From our last batch of 30 students</p>
                    </motion.div>
                    <motion.div
                      className="group text-center"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center justify-center mb-6">
                        <TrendingUp className="w-16 h-16 text-vh-red mr-4" />
                        <div className="text-6xl font-black text-vh-red">23.3%</div>
                      </div>
                      <h3 className="text-3xl font-black text-gray-900 mb-3">Success Rate</h3>
                      <p className="text-gray-600 text-lg">Significantly higher than general acceptance rate</p>
                    </motion.div>
                  </div>

                  <div className="bg-gradient-to-r from-vh-beige/20 to-vh-dark-beige/20 rounded-2xl p-8">
                    <h4 className="text-2xl font-black text-gray-900 mb-4">Exceptional Performance</h4>
                    <p className="text-gray-700 text-lg leading-relaxed max-w-3xl mx-auto">
                      Our success rate is more than 10 times higher than the general DU FBS acceptance rate,
                      demonstrating the effectiveness of our specialized preparation approach.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Registration Section */}
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

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-6xl lg:text-7xl font-black text-gray-900 mb-8">
              Join Our DU FBS <span className="bg-gradient-to-r from-vh-red to-vh-dark-red bg-clip-text text-transparent">Program</span>
            </h2>
            <p className="text-2xl text-gray-600 mb-16 max-w-3xl mx-auto">
              Same comprehensive course structure with specialized DU FBS focus
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card variant="filled" padding="xl" className="bg-gradient-to-br from-vh-red to-vh-dark-red text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>

              <div className="relative text-center">
                <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
                  <a
                    href="https://forms.fillout.com/t/iCXMk5dbQsus"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center bg-white text-vh-red px-12 py-4 rounded-2xl font-bold text-xl hover:shadow-2xl hover:shadow-white/25 transition-all duration-300 mb-6"
                  >
                    Register for DU FBS Course
                    <ArrowRight className="ml-3 w-6 h-6" />
                  </a>
                </motion.div>

                <div className="text-center">
                  <Link
                    href="/eligibility-checker"
                    className="text-white/80 hover:text-white font-medium text-lg transition-colors"
                  >
                    Check your eligibility first →
                  </Link>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
