# VH Beyond the Horizons - University Admission Website

A comprehensive Next.js website for VH Beyond the Horizons university admission preparation program.

## 🎯 Overview

This website provides information about IBA/BUP admission preparation courses with expert instructors and proven results.

## 🚀 Features

- **Home Page**: Complete course information, instructor profiles, success stories
- **Eligibility Checker**: Interactive tool for checking university admission eligibility
- **DU FBS Course**: Specialized program information for Dhaka University Faculty of Business Studies
- **Registration Form**: EmailJS-powered registration with comprehensive form validation
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **VH Branding**: Custom color scheme (#760F13 red, #D4B094 beige)

## 🛠 Tech Stack

- **Framework**: Next.js 15.4.6 with TypeScript
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Email**: EmailJS for form submissions
- **Deployment**: Vercel

## 📦 Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your EmailJS credentials:
   - `NEXT_PUBLIC_EMAILJS_SERVICE_ID`
   - `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`
   - `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`

3. **Run development server:**
   ```bash
   npm run dev
   ```

## 🌐 Pages Structure

- `/` - Home page with complete course information
- `/eligibility-checker` - University admission eligibility tool
- `/du-fbs-course` - DU FBS specialized course information  
- `/registration` - Course registration form

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
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Build

```bash
npm run build
npm start
```

## 📝 Content Management

Key content sections that may need updates:
- Course schedules and batch dates
- Pricing and discount offers  
- Success stories and achievements
- Instructor information

## 🔧 Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 📞 Contact

**Email**: ahnafahad@vh-beyondthehorizons.org

## 📄 License

© 2026 VH Beyond the Horizons. All rights reserved.
