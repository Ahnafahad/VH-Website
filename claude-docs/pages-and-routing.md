# VH Website Pages and Routing Documentation

## Overview

The VH Website is built on **Next.js 15 App Router** architecture, providing a modern, performant routing system with **file-based routing**, **server components**, and **advanced features** like parallel routes and intercepting routes.

## App Router Structure

### Directory Layout
```
src/app/
├── layout.tsx                 # Root layout with providers
├── page.tsx                   # Homepage
├── globals.css                # Global styles and theme
├── auth/
│   ├── signin/
│   │   └── page.tsx          # Custom sign-in page
│   └── error/
│       └── page.tsx          # Authentication error page
├── games/
│   ├── vocab-quiz/
│   │   └── page.tsx          # Vocabulary quiz game
│   └── mental-math/
│       └── page.tsx          # Mental math trainer
├── registration/
│   └── page.tsx              # Registration form
├── eligibility-checker/
│   └── page.tsx              # University admission checker
├── du-fbs-course/
│   └── page.tsx              # Course details page
└── api/                      # API routes
    ├── auth/
    ├── vocab-quiz/
    └── mental-math/
```

## Root Layout (`src/app/layout.tsx`)

### Core Structure
```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <AuthProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  )
}
```

### Key Features
- **Font Integration**: Geist Sans and Geist Mono with CSS variables
- **Authentication Provider**: NextAuth session management
- **Global Components**: Header and Footer on every page
- **Metadata Configuration**: SEO-optimized meta tags
- **Theme Integration**: CSS custom properties for theming

### Metadata Configuration
```tsx
export const metadata: Metadata = {
  title: "VH Website - Educational Platform",
  description: "Advanced educational tools and university admission guidance",
  keywords: ["education", "university", "admission", "games", "vocabulary", "math"],
  authors: [{ name: "VH Team" }],
  openGraph: {
    title: "VH Website",
    description: "Educational platform with games and admission tools",
    type: "website",
  }
}
```

## Page Components

### 1. Homepage (`src/app/page.tsx`)

#### Purpose
- **Landing page** for the VH Website
- **Navigation hub** to all major features
- **Brand introduction** and value proposition

#### Design Features
- **Hero section** with animated backgrounds
- **Feature cards** for main functionalities
- **Call-to-action** buttons for user engagement
- **Responsive grid** layout for content organization

#### Navigation Links
```tsx
// Key navigation paths from homepage
- /games/vocab-quiz      // Vocabulary learning game
- /games/mental-math     // Math training game
- /eligibility-checker   // University admission tool
- /registration         // Registration form
- /du-fbs-course       // Course information
```

### 2. Authentication Pages

#### Sign-In Page (`src/app/auth/signin/page.tsx`)
```tsx
// Route: /auth/signin
export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Custom Google OAuth integration */}
      <GoogleSignInButton />
      {/* Brand-consistent design */}
    </div>
  )
}
```

**Features:**
- **Custom Google OAuth** integration with NextAuth
- **Brand-consistent styling** with VH colors
- **Error handling** for authentication failures
- **Automatic redirects** after successful login

#### Error Page (`src/app/auth/error/page.tsx`)
```tsx
// Route: /auth/error?error=AccessDenied
export default function AuthErrorPage({
  searchParams
}: {
  searchParams: { error: string }
}) {
  // Handle different error types
  const errorType = searchParams.error;
  return <ErrorDisplay errorType={errorType} />;
}
```

**Error Types Handled:**
- **AccessDenied** - User not in authorized list
- **OAuthSignin** - Google authentication issues
- **OAuthCallback** - OAuth flow problems
- **Default** - Generic authentication errors

### 3. Game Pages

#### Vocabulary Quiz (`src/app/games/vocab-quiz/page.tsx`)
```tsx
// Route: /games/vocab-quiz
export default function VocabQuizPage() {
  return (
    <ProtectedRoute>
      <VocabularyQuizApp />
    </ProtectedRoute>
  )
}
```

**Game States & Routing:**
- **Setup Screen** - Section selection and configuration
- **Quiz Screen** - Active question answering
- **Results Screen** - Performance analytics and explanations
- **Leaderboard Screen** - Competitive rankings

#### Mental Math Trainer (`src/app/games/mental-math/page.tsx`)
```tsx
// Route: /games/mental-math
export default function MentalMathPage() {
  return (
    <ProtectedRoute>
      <MentalMathApp />
    </ProtectedRoute>
  )
}
```

**Game Flow States:**
- **Setup** - Operation and difficulty selection
- **Playing** - Active mathematical problem solving
- **Finished** - Results and score calculation
- **Leaderboard** - Individual and accumulated rankings

### 4. Utility Pages

#### Registration Form (`src/app/registration/page.tsx`)
```tsx
// Route: /registration
export default function RegistrationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <RegistrationForm />
    </div>
  )
}
```

**Features:**
- **Form validation** with real-time feedback
- **Email integration** for form submissions
- **Responsive design** for all devices
- **Success/error handling** for form processing

#### Eligibility Checker (`src/app/eligibility-checker/page.tsx`)
```tsx
// Route: /eligibility-checker
export default function EligibilityCheckerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <EligibilityChecker />
    </div>
  )
}
```

**Functionality:**
- **University admission** probability calculations
- **Multiple university** support (DU, BUET, BUP, IBA)
- **Dynamic calculations** based on user input
- **Results visualization** with progress indicators

#### Course Details (`src/app/du-fbs-course/page.tsx`)
```tsx
// Route: /du-fbs-course
export default function DUFBSCoursePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <CourseInformation />
    </div>
  )
}
```

**Content:**
- **Course curriculum** overview
- **Admission requirements** and procedures
- **Career prospects** and opportunities
- **Faculty information** and expertise

## API Routes Structure

### Authentication APIs
```
src/app/api/auth/
└── [...nextauth]/
    └── route.ts              # NextAuth.js handler
```

### Game APIs
```
src/app/api/
├── vocab-quiz/
│   ├── scores/
│   │   └── route.ts          # POST: Save quiz scores
│   └── leaderboard/
│       └── route.ts          # GET: Fetch leaderboard data
└── mental-math/
    ├── scores/
    │   └── route.ts          # POST: Save game scores
    └── leaderboard/
        └── route.ts          # GET: Fetch leaderboard data
```

### API Route Pattern
```tsx
// Standard API route structure
export async function POST(request: NextRequest) {
  // 1. Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Authorization check
  const isAuthorized = isEmailAuthorized(session.user.email.toLowerCase());
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // 3. Business logic
  const data = await request.json();
  const result = await processData(data);

  // 4. Response
  return NextResponse.json(result);
}
```

## Protected Route System

### ProtectedRoute Component (`src/components/ProtectedRoute.tsx`)
```tsx
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthenticationRequired />;
  }

  return <>{children}</>;
}
```

### Usage Pattern
```tsx
// Wrap any page that requires authentication
export default function GamePage() {
  return (
    <ProtectedRoute>
      <GameContent />
    </ProtectedRoute>
  )
}
```

### Protection Levels
- **Public Routes** - Homepage, course info, registration
- **Protected Routes** - Games, user dashboards
- **Admin Routes** - Administrative functions (future)

## Navigation System

### Header Component (`src/components/Header.tsx`)

#### Desktop Navigation
```tsx
<nav className="hidden md:flex items-center space-x-8">
  <Link href="/games/vocab-quiz">Vocabulary Quiz</Link>
  <Link href="/games/mental-math">Mental Math</Link>
  <Link href="/eligibility-checker">Eligibility Checker</Link>
  <Link href="/registration">Registration</Link>
</nav>
```

#### Mobile Navigation
- **Hamburger menu** for mobile devices
- **Slide-out navigation** panel
- **Touch-optimized** interaction areas

#### Authentication Integration
```tsx
{session ? (
  <div className="flex items-center gap-4">
    <UserProfile user={session.user} />
    <LogoutButton />
  </div>
) : (
  <LoginButton />
)}
```

### Dynamic Navigation
- **Authentication-aware** menu items
- **Role-based** content visibility
- **Active state** highlighting for current page

## Routing Patterns

### Client-Side Navigation
```tsx
// Next.js Link component for optimal performance
import Link from 'next/link';

<Link href="/games/vocab-quiz" className="transition-colors hover:text-vh-red">
  Start Vocabulary Quiz
</Link>
```

### Programmatic Navigation
```tsx
import { useRouter } from 'next/navigation';

const router = useRouter();

// Navigate after form submission
const handleSubmit = async (data) => {
  await submitForm(data);
  router.push('/success');
};

// Navigate with authentication check
const navigateToGame = () => {
  if (!session) {
    router.push('/auth/signin');
  } else {
    router.push('/games/vocab-quiz');
  }
};
```

### Search Parameters
```tsx
// Handle URL search parameters
export default function ErrorPage({
  searchParams
}: {
  searchParams: { error?: string; callbackUrl?: string }
}) {
  const error = searchParams.error;
  const returnUrl = searchParams.callbackUrl || '/';

  return <ErrorHandler error={error} returnUrl={returnUrl} />;
}
```

## Performance Optimizations

### Code Splitting
- **Automatic route-based** code splitting
- **Dynamic imports** for heavy components
- **Lazy loading** for non-critical features

### Server Components
```tsx
// Server component for static content
export default async function CoursePage() {
  // Server-side data fetching
  const courseData = await getCourseInformation();

  return <CourseDisplay data={courseData} />;
}
```

### Client Components
```tsx
'use client';  // Explicit client component

// Interactive components that need browser APIs
export default function InteractiveGame() {
  const [gameState, setGameState] = useState('setup');
  return <GameInterface />;
}
```

### Loading States
```tsx
// loading.tsx files for route-level loading UI
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}
```

## SEO and Meta Management

### Dynamic Metadata
```tsx
// Generate metadata for each page
export async function generateMetadata({ params }): Promise<Metadata> {
  return {
    title: `${pageTitle} - VH Website`,
    description: pageDescription,
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      images: ['/og-image.jpg'],
    },
  };
}
```

### Structured Data
- **JSON-LD** for educational content
- **OpenGraph** tags for social sharing
- **Twitter Cards** for enhanced link previews

## Error Handling

### Error Boundaries
```tsx
// error.tsx files for route-level error handling
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

### Not Found Pages
```tsx
// not-found.tsx for 404 handling
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2>Page Not Found</h2>
        <Link href="/">Return Home</Link>
      </div>
    </div>
  );
}
```

## Deployment Considerations

### Static vs Dynamic Routes
- **Static routes** - Course pages, about pages
- **Dynamic routes** - User dashboards, game results
- **API routes** - All server-side functionality

### Edge Runtime Support
```tsx
// Configure edge runtime for performance
export const runtime = 'edge';
```

### International Routing
- **Prepared for i18n** with Next.js 15 features
- **Language detection** capabilities
- **Locale-based routing** structure ready

This routing system provides a scalable, performant foundation that supports the current feature set while being extensible for future enhancements.