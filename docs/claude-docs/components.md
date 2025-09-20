# VH Website Component Documentation

## Overview

The VH Website features a comprehensive component library built with React, TypeScript, and Tailwind CSS. This document details the key UI components, their usage patterns, and design guidelines.

## Component Architecture

### Component Categories

#### 1. Layout Components
- **Root Layout** - Global page structure
- **Header** - Navigation and branding
- **Footer** - Site information and links
- **Protected Route** - Authentication wrapper

#### 2. Form Components
- **Input Fields** - Text, number, and select inputs
- **Buttons** - Primary, secondary, and icon buttons
- **Form Containers** - Structured form layouts

#### 3. Game Components
- **Quiz Interface** - Question display and interaction
- **Score Display** - Results and performance metrics
- **Leaderboard** - Ranking displays
- **Timer Components** - Countdown and progress indicators

#### 4. UI Elements
- **Cards** - Content containers
- **Modals** - Overlay dialogs
- **Loading States** - Progress indicators
- **Navigation** - Menu and link components

## Core Components

### 1. Header Component (`src/components/Header.tsx`)

#### Purpose
- Global navigation across the site
- Authentication status display
- Responsive mobile menu
- Brand identity presentation

#### Design Pattern
```tsx
<header className="bg-gradient-to-r from-vh-red via-vh-dark-red to-vh-red">
  <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center h-20">
      {/* Logo Section */}
      <div className="flex items-center space-x-4">
        <Logo />
        <BrandText />
      </div>

      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center space-x-8">
        <NavigationLinks />
      </div>

      {/* Authentication Section */}
      <div className="flex items-center space-x-4">
        <AuthenticationStatus />
      </div>

      {/* Mobile Menu Button */}
      <MobileMenuButton />
    </div>
  </nav>

  {/* Mobile Navigation Panel */}
  <MobileNavigation />
</header>
```

#### Key Features
- **Brand Gradient Background** - VH red gradient for visual impact
- **Responsive Navigation** - Desktop menu with mobile hamburger
- **Dynamic Authentication** - Login/logout based on session
- **Active State Highlighting** - Current page indication

#### Usage Examples
```tsx
// Automatic inclusion in root layout
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
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

### 2. ProtectedRoute Component (`src/components/ProtectedRoute.tsx`)

#### Purpose
- Wrap components requiring authentication
- Handle loading and error states
- Redirect unauthorized users
- Provide seamless user experience

#### Implementation Pattern
```tsx
export default function ProtectedRoute({
  children
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-vh-red" size={48} />
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <Shield className="mx-auto mb-6 text-vh-red" size={64} />
          <h2 className="text-3xl font-black text-gray-900 mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-8">
            Please sign in to access this content.
          </p>
          <Link href="/auth/signin">
            <button className="bg-gradient-to-r from-vh-red to-vh-dark-red text-white px-8 py-3 rounded-2xl font-bold">
              Sign In
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

#### Usage Examples
```tsx
// Protecting game pages
export default function VocabQuizPage() {
  return (
    <ProtectedRoute>
      <VocabularyQuizApp />
    </ProtectedRoute>
  )
}

// Protecting admin features
export default function AdminDashboard() {
  return (
    <ProtectedRoute>
      <AdminInterface />
    </ProtectedRoute>
  )
}
```

### 3. Button Component System

#### Primary Button Pattern
```tsx
export const PrimaryButton = ({
  children,
  onClick,
  disabled = false,
  icon,
  className = ""
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      group bg-gradient-to-r from-vh-red to-vh-dark-red text-white
      px-12 py-4 rounded-2xl font-bold text-lg
      hover:from-vh-dark-red hover:to-vh-red
      transition-all duration-300 shadow-2xl
      hover:shadow-vh-red/25 transform hover:-translate-y-1
      disabled:opacity-50 disabled:cursor-not-allowed
      ${className}
    `}
  >
    <div className="flex items-center justify-center gap-3">
      {icon && <span className="transition-transform group-hover:scale-110">{icon}</span>}
      {children}
    </div>
  </button>
);
```

#### Secondary Button Pattern
```tsx
export const SecondaryButton = ({ children, onClick, icon, className = "" }) => (
  <button
    onClick={onClick}
    className={`
      group border-2 border-vh-red text-vh-red px-12 py-4
      rounded-2xl font-bold text-lg hover:bg-vh-red hover:text-white
      transition-all duration-300 shadow-lg
      ${className}
    `}
  >
    <div className="flex items-center justify-center gap-3">
      {icon && <span className="transition-transform group-hover:scale-110">{icon}</span>}
      {children}
    </div>
  </button>
);
```

#### Usage Examples
```tsx
// Primary action buttons
<PrimaryButton
  onClick={startQuiz}
  icon={<Play size={24} />}
>
  Start Quiz
</PrimaryButton>

// Secondary action buttons
<SecondaryButton
  onClick={viewLeaderboard}
  icon={<Trophy size={24} />}
>
  View Leaderboard
</SecondaryButton>
```

### 4. Card Component System

#### Standard Card Pattern
```tsx
export const Card = ({
  children,
  hover = true,
  className = ""
}) => (
  <div className={`group relative mb-12 ${className}`}>
    {/* Animated background blur */}
    <div className="absolute inset-0 bg-gradient-to-br from-vh-red/10 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>

    {/* Main card content */}
    <div className={`
      relative bg-white rounded-3xl shadow-2xl p-10 border border-gray-100
      ${hover ? 'group-hover:shadow-4xl' : ''}
      transition-all duration-500
    `}>
      {children}
    </div>
  </div>
);
```

#### Feature Card Pattern
```tsx
export const FeatureCard = ({
  title,
  description,
  icon,
  link,
  onClick
}) => (
  <Card hover={true}>
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-vh-red to-vh-dark-red rounded-2xl mb-6">
        <span className="text-white">{icon}</span>
      </div>

      <h3 className="text-2xl font-black text-gray-900 mb-4">
        {title}
      </h3>

      <p className="text-gray-600 text-lg mb-8 leading-relaxed">
        {description}
      </p>

      <PrimaryButton onClick={onClick || (() => router.push(link))}>
        Get Started
      </PrimaryButton>
    </div>
  </Card>
);
```

### 5. Form Input Components

#### Input Field Pattern
```tsx
export const InputField = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  error,
  className = ""
}) => (
  <div className={`mb-6 ${className}`}>
    <label className="block text-lg font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-vh-red">*</span>}
    </label>

    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className={`
        w-full p-4 border-2 rounded-2xl outline-none transition-all
        ${error
          ? 'border-red-500 focus:ring-2 focus:ring-red-500'
          : 'border-gray-200 focus:ring-2 focus:ring-vh-red focus:border-vh-red'
        }
      `}
    />

    {error && (
      <p className="mt-2 text-red-600 text-sm flex items-center gap-2">
        <AlertCircle size={16} />
        {error}
      </p>
    )}
  </div>
);
```

#### Select Dropdown Pattern
```tsx
export const SelectField = ({
  label,
  value,
  onChange,
  options,
  required = false,
  className = ""
}) => (
  <div className={`mb-6 ${className}`}>
    <label className="block text-lg font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-vh-red">*</span>}
    </label>

    <select
      value={value}
      onChange={onChange}
      required={required}
      className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-vh-red focus:border-vh-red font-medium text-lg bg-gradient-to-r from-gray-50 to-white"
    >
      <option value="">Choose an option...</option>
      {options.map((option, index) => (
        <option key={index} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);
```

### 6. Game-Specific Components

#### Question Display Component
```tsx
export const QuestionDisplay = ({
  question,
  onAnswer,
  selectedAnswer,
  showResult = false
}) => (
  <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8">
    <div className="text-center mb-8">
      <h3 className="text-2xl font-bold text-gray-900 leading-relaxed">
        {question.sentence}
      </h3>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {question.wordBank.map((word, index) => (
        <button
          key={index}
          onClick={() => onAnswer(word)}
          disabled={showResult}
          className={`
            p-4 rounded-2xl font-medium text-lg transition-all duration-300
            ${selectedAnswer === word
              ? (word === question.correctAnswer
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white')
              : 'bg-gray-100 hover:bg-vh-red hover:text-white'
            }
            ${showResult && word === question.correctAnswer
              ? 'bg-green-500 text-white ring-4 ring-green-200'
              : ''
            }
          `}
        >
          {word}
        </button>
      ))}
    </div>
  </div>
);
```

#### Score Display Component
```tsx
export const ScoreDisplay = ({
  score,
  accuracy,
  questionsAnswered,
  questionsCorrect
}) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
    <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
      <div className="text-3xl font-black text-vh-red mb-2">
        {score}
      </div>
      <div className="text-gray-600 font-medium">
        Final Score
      </div>
    </div>

    <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
      <div className="text-3xl font-black text-green-600 mb-2">
        {Math.round(accuracy)}%
      </div>
      <div className="text-gray-600 font-medium">
        Accuracy
      </div>
    </div>

    <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
      <div className="text-3xl font-black text-blue-600 mb-2">
        {questionsCorrect}
      </div>
      <div className="text-gray-600 font-medium">
        Correct
      </div>
    </div>

    <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
      <div className="text-3xl font-black text-gray-600 mb-2">
        {questionsAnswered}
      </div>
      <div className="text-gray-600 font-medium">
        Total
      </div>
    </div>
  </div>
);
```

### 7. Leaderboard Components

#### Leaderboard Table Pattern
```tsx
export const LeaderboardTable = ({
  data,
  title,
  columns
}) => (
  <Card>
    <h3 className="text-3xl font-black text-gray-900 mb-8 text-center">
      {title}
    </h3>

    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-200">
            {columns.map((column, index) => (
              <th key={index} className="text-left py-4 px-4 font-bold text-gray-700">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row, index) => (
            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              {columns.map((column, colIndex) => (
                <td key={colIndex} className="py-4 px-4">
                  {column.render ? column.render(row, index) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);
```

#### Rank Badge Component
```tsx
export const RankBadge = ({ rank }) => {
  const getRankStyle = (rank) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
    if (rank === 2) return "bg-gradient-to-r from-gray-400 to-gray-600 text-white";
    if (rank === 3) return "bg-gradient-to-r from-orange-400 to-orange-600 text-white";
    return "bg-gradient-to-r from-vh-red to-vh-dark-red text-white";
  };

  return (
    <span className={`
      inline-flex items-center justify-center w-10 h-10
      rounded-full font-bold text-lg ${getRankStyle(rank)}
    `}>
      {rank}
    </span>
  );
};
```

## Component Design Principles

### 1. Consistency
- **Unified Design Language** - All components follow VH brand guidelines
- **Consistent Spacing** - Standardized padding and margin patterns
- **Color Consistency** - VH red and beige color palette throughout

### 2. Accessibility
- **Keyboard Navigation** - All interactive elements support keyboard access
- **Screen Reader Support** - Semantic HTML and ARIA labels
- **Color Contrast** - WCAG AA compliant color combinations
- **Touch Targets** - Minimum 44px touch areas for mobile

### 3. Performance
- **Optimized Rendering** - React.memo for expensive components
- **Lazy Loading** - Dynamic imports for heavy components
- **Efficient Updates** - Proper dependency arrays in useEffect

### 4. Responsive Design
- **Mobile-First** - Components designed for mobile, then enhanced for desktop
- **Flexible Layouts** - CSS Grid and Flexbox for adaptive layouts
- **Breakpoint Consistency** - Tailwind breakpoints used throughout

## Usage Guidelines

### Best Practices
1. **Component Composition** - Build complex UIs from simple components
2. **Props Interface** - Clear, typed props for better developer experience
3. **Error Boundaries** - Graceful error handling in component trees
4. **Loading States** - Always provide feedback during async operations

### Common Patterns
```tsx
// Loading state pattern
{isLoading ? (
  <LoadingSpinner />
) : (
  <ActualContent />
)}

// Error state pattern
{error ? (
  <ErrorMessage error={error} onRetry={handleRetry} />
) : (
  <NormalContent />
)}

// Conditional rendering pattern
{user?.isAdmin && (
  <AdminOnlyComponent />
)}
```

### Performance Tips
1. **Memoization** - Use React.memo for components with expensive renders
2. **Callback Optimization** - Use useCallback for event handlers
3. **State Colocation** - Keep state close to where it's used
4. **Bundle Splitting** - Dynamic imports for large components

This component library provides a solid foundation for building consistent, accessible, and performant user interfaces across the VH Website.