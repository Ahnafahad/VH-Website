# VH Website - Educational Platform

A comprehensive Next.js educational platform featuring AI-powered vocabulary quiz, mental math trainer, university admission tools, and secure user authentication system.

## 🎯 Overview

The VH Website is a modern, full-stack educational application designed to help students improve their academic skills through interactive games and provide university admission guidance with advanced eligibility checking tools.

## 🚀 Key Features

### 🎮 Educational Games
- **Vocabulary Quiz**: AI-generated questions from 10 vocabulary sections (1000+ words total)
- **Mental Math Trainer**: Multi-operation practice with 4 difficulty levels and advanced scoring
- **Real-time Performance Tracking**: Comprehensive analytics and competitive leaderboards
- **AI Content Generation**: Google Gemini API for dynamic question creation

### 🔐 Authentication & User Management
- **Google OAuth Integration**: Secure sign-in with NextAuth.js
- **Role-Based Access Control**: Admin, student, and super admin permissions
- **Build-time Access Control Generation**: Optimized for serverless deployment
- **Session Management**: Secure JWT-based authentication

### 🏛️ University Tools
- **Eligibility Checker**: Calculate admission probabilities for multiple universities (IBA, BUP, DU, BUET)
- **Course Information**: Detailed program descriptions and requirements
- **Registration System**: Comprehensive form validation and email integration

### 🎨 Modern Design System
- **VH Brand Colors**: Custom Tailwind CSS theme with professional aesthetics
- **Responsive Design**: Mobile-first approach with excellent UX
- **Accessibility**: WCAG AA compliant with full keyboard navigation

## 🛠 Tech Stack

- **Framework**: Next.js 15.4.6 with App Router & TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: NextAuth.js with Google OAuth
- **Styling**: Tailwind CSS v4 with custom design system
- **AI Integration**: Google Gemini API for content generation
- **Email**: EmailJS for form submissions
- **Deployment**: Vercel with automated CI/CD

## 📦 Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/Ahnafahad/VH-Website.git
   cd vh-website
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```

   Configure required environment variables:
   ```bash
   # Authentication
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-nextauth-secret
   GOOGLE_CLIENT_ID=your-google-oauth-client-id
   GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

   # Database
   MONGODB_URI=your-mongodb-connection-string

   # AI Integration
   GOOGLE_GEMINI_API_KEY=your-gemini-api-key

   # Email Service
   NEXT_PUBLIC_EMAILJS_SERVICE_ID=your-emailjs-service-id
   NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your-emailjs-template-id
   NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your-emailjs-public-key
   ```

3. **Generate access control and run development server:**
   ```bash
   npm run generate:access-control
   npm run dev
   ```

## 🌐 Application Structure

### Public Pages
- `/` - Landing page with feature overview and navigation
- `/registration` - Course registration form
- `/du-fbs-course` - DU FBS specialized course information
- `/eligibility-checker` - University admission eligibility calculator

### Protected Pages (Requires Authentication)
- `/games/vocab-quiz` - AI-powered vocabulary learning game
- `/games/mental-math` - Mental math trainer with multiple difficulty levels

### Authentication Pages
- `/auth/signin` - Google OAuth sign-in page
- `/auth/error` - Authentication error handling

## 📚 Documentation

Comprehensive system documentation is available in the `claude-docs/` folder:

- **[System Architecture](./claude-docs/system-architecture.md)** - High-level overview with diagrams
- **[Authentication System](./claude-docs/authentication-system.md)** - NextAuth.js, OAuth, access control
- **[Games System](./claude-docs/games-system.md)** - AI integration, scoring, leaderboards
- **[Design System](./claude-docs/design-system.md)** - VH brand colors, Tailwind patterns
- **[Pages & Routing](./claude-docs/pages-and-routing.md)** - Next.js App Router structure
- **[Component Library](./claude-docs/components.md)** - Reusable UI components
- **[Deployment Guide](./claude-docs/deployment.md)** - Production setup and maintenance

**Start here**: [Documentation Index](./claude-docs/README.md)

## 📧 EmailJS Setup

1. Sign up at [EmailJS](https://www.emailjs.com/)
2. Create an email service (Gmail, Outlook, etc.)
3. Create an email template with these variables:
   - `{{to_email}}`
   - `{{from_name}}`
   - `{{from_email}}`
   - `{{subject}}`
   - `{{message}}`
4. Add credentials to `.env.local`

## 🎨 Brand Colors

- **Primary Red**: #760F13 (`vh-red`)
- **Light Beige**: #D4B094 (`vh-beige`) 
- **Dark Beige**: #A86E58 (`vh-dark-beige`)
- **Light Red**: #9A1B20 (`vh-light-red`)
- **Dark Red**: #5A0B0F (`vh-dark-red`)

## 📊 Key Statistics

- **IBA Acceptance Rate**: 1.2% (more selective than Harvard at 3.5%)
- **Our Success Rate**: 46.7% (14 out of 30 students from last batch)
- **Course Duration**: 4-5 months intensive program

## 👨‍🏫 Instructors

- **Md Hasan Sarower**: Mathematics + Analytical (IBA DU Rank 41)
- **Ahnaf Ahad**: English + Analytical (IBA DU Rank 9, DU FBS Rank 11)

## 🚀 Deployment

### Vercel (Recommended)

1. Connect repository to Vercel
2. Configure environment variables in Vercel dashboard:
   - All variables from the installation section above
   - Set `NODE_ENV=production`
3. The build process automatically runs `generate:access-control` before building
4. Deploy automatically on push to main branch

### Manual Build

```bash
npm run generate:access-control
npm run build
npm start
```

## 📊 System Statistics

- **26 Total Users**: 2 admins, 24 students
- **10 Vocabulary Sections**: 1000+ vocabulary words
- **4 Math Difficulty Levels**: Easy to extreme challenges
- **5 Universities Supported**: IBA, BUP, DU Science, DU Business, BUET
- **Dual Leaderboards**: Individual and accumulated scoring systems

## 🏆 Educational Impact

- **Comprehensive Vocabulary Learning**: AI-generated contextual questions
- **Mental Math Mastery**: Advanced scoring with speed bonuses
- **University Guidance**: Accurate eligibility calculations
- **Performance Analytics**: Detailed progress tracking and insights

## 🔧 Development

```bash
# Generate access control (required before build)
npm run generate:access-control

# Development server
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Database Setup

1. **MongoDB Atlas** (Recommended):
   - Create a MongoDB Atlas cluster
   - Add your IP address to the whitelist
   - Create a database user
   - Copy connection string to `MONGODB_URI`

2. **Local MongoDB**:
   - Install MongoDB locally
   - Start MongoDB service
   - Use connection string: `mongodb://localhost:27017/vh-website`

### User Management

User access is controlled through `access-control.json`. To add users:

1. Edit `access-control.json` to add admin or student users
2. Run `npm run generate:access-control` to rebuild access control
3. Restart the development server

## 📞 Contact

**Email**: ahnafahad@vh-beyondthehorizons.org

## 📄 License

© 2026 VH Beyond the Horizons. All rights reserved.
