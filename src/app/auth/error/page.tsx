'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, RefreshCw, Home, ArrowLeft } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  }
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
  }
}

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  let errorMessage = 'An error occurred during authentication.'
  let errorTitle = 'Authentication Error'

  if (error === 'AccessDenied') {
    errorTitle = 'Access Denied'
    errorMessage = 'Your email is not authorized to access this application. Please contact an administrator if you believe this is an error.'
  } else if (error === 'Configuration') {
    errorTitle = 'Configuration Error'
    errorMessage = 'There is a problem with the server configuration. Please contact support.'
  } else if (error === 'Verification') {
    errorTitle = 'Verification Error'
    errorMessage = 'The verification token has expired or has already been used. Please try signing in again.'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-20 right-20 w-72 h-72 bg-error-600/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 left-20 w-96 h-96 bg-vh-beige/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
      </div>

      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="max-w-md w-full"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          {/* Error Icon */}
          <div className="text-center mb-8">
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-error-500 to-error-700 rounded-3xl mb-6 shadow-2xl"
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <AlertCircle className="w-10 h-10 text-white" />
            </motion.div>

            <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              {errorTitle}
            </h1>

            <Badge variant="solid" colorScheme="error" size="md" className="inline-flex">
              <AlertCircle className="w-4 h-4 mr-2" />
              Authentication Failed
            </Badge>
          </div>

          {/* Error Card */}
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
          >
            <Card variant="elevated" padding="xl" className="relative group hover:shadow-2xl transition-all duration-500 border-error-200">
              <div className="absolute inset-0 bg-gradient-to-br from-error-50/50 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              <div className="relative space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900 mb-3">
                    What happened?
                  </h2>
                  <p className="text-gray-700 leading-relaxed">
                    {errorMessage}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200 space-y-3">
                  <Link href="/auth/signin" className="block">
                    <Button
                      variant="solid"
                      colorScheme="primary"
                      size="lg"
                      className="w-full group"
                    >
                      <RefreshCw className="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                      Try Again
                    </Button>
                  </Link>

                  <Link href="/" className="block">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full group"
                    >
                      <Home className="w-5 h-5 mr-2" />
                      Return to Home
                    </Button>
                  </Link>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 text-center">
                    Need help? Contact us at{' '}
                    <a
                      href="tel:+8801915424939"
                      className="text-vh-red-600 hover:text-vh-red-800 font-semibold"
                    >
                      +880 1915424939
                    </a>
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Footer Text */}
          <motion.div
            className="text-center mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-sm text-gray-500">
              VH Beyond the Horizons - Empowering Future Leaders
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-vh-red-600 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-gray-900">Loading...</h2>
        </motion.div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}