# VH Beyond the Horizons - Deployment Guide

## 🚀 Quick Deploy to Vercel

### Option 1: Direct Deploy (Recommended)

1. **Fork/Clone this repository**
2. **Visit [Vercel](https://vercel.com/new)**
3. **Import your repository**
4. **Configure environment variables**:
   ```
   NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
   NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_template_id  
   NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
   MONGODB_URI=your_mongodb_connection_string
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=your_production_url
   GOOGLE_CLIENT_ID=your_google_oauth_client_id
   GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
   ```
5. **Deploy!**

### Option 2: Manual Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd vh-website
vercel --prod
```

## 📧 EmailJS Setup (Required)

### 1. Create EmailJS Account
- Go to [emailjs.com](https://www.emailjs.com/)
- Sign up for free account

### 2. Create Email Service
- Add a new service (Gmail recommended)
- Connect your email account
- Copy the **Service ID**

### 3. Create Email Template
Create a template with these variables:
```
Subject: New Registration - {{from_name}}

Dear VH Team,

You have received a new course registration from {{from_name}}.

Contact Details:
- Email: {{from_email}}
- Message: {{message}}

Best regards,
VH Website Registration System
```

### 4. Configure Variables
In Vercel dashboard → Settings → Environment Variables:
```
NEXT_PUBLIC_EMAILJS_SERVICE_ID = your_service_id_here
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID = your_template_id_here
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY = your_public_key_here
MONGODB_URI = your_mongodb_connection_string
NEXTAUTH_SECRET = your_nextauth_secret
NEXTAUTH_URL = https://your-domain.vercel.app
GOOGLE_CLIENT_ID = your_google_oauth_client_id
GOOGLE_CLIENT_SECRET = your_google_oauth_client_secret
```

## 🎮 Mental Math Trainer Setup

The application now includes a Mental Math Trainer game with MongoDB leaderboards that requires additional configuration:

### MongoDB Database Setup
- **Database**: Uses MongoDB Atlas for storing game scores and leaderboards
- **Collection**: `mathscores` with proper indexes for performance
- **Connection**: Configured via `MONGODB_URI` environment variable

### Authentication Setup  
- **Provider**: Google OAuth via NextAuth
- **Required**: For accessing the mental math trainer and saving scores
- **Authorized Users**: Configured in `src/data/authorizedEmails.ts`

## 🔧 Build Configuration

The project is configured with:
- **Framework**: Next.js 15.4.6
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

## 📊 Performance Metrics

Current build sizes:
- Home page: 103 kB total
- Registration: 108 kB total  
- Eligibility Checker: 109 kB total
- DU FBS Course: 103 kB total

All pages are statically generated for optimal performance.

## 🌐 Custom Domain (Optional)

1. **In Vercel Dashboard**:
   - Go to your project
   - Settings → Domains
   - Add your custom domain

2. **DNS Configuration**:
   ```
   Type: CNAME
   Name: www (or @)
   Value: your-vercel-url.vercel.app
   ```

## 🔒 Security Headers

The project includes security headers via `vercel.json`:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options

## 📱 Mobile Optimization

- Mobile-first responsive design
- Touch-friendly navigation
- Optimized form inputs
- Fast loading on all devices

## 🧪 Testing Checklist

Before going live, test:

### ✅ Functionality
- [ ] Home page loads correctly
- [ ] Navigation works on all pages
- [ ] Eligibility checker calculates correctly
- [ ] Registration form submits successfully
- [ ] Email notifications arrive

### ✅ Responsive Design
- [ ] Mobile view (320px+)
- [ ] Tablet view (768px+)
- [ ] Desktop view (1024px+)
- [ ] Navigation menu on mobile

### ✅ Performance
- [ ] Page load speed < 3 seconds
- [ ] Images load properly
- [ ] No console errors
- [ ] Forms validate correctly

## 🚨 Troubleshooting

### Build Fails
- Check Node.js version (18+ required)
- Run `npm ci` to clean install dependencies
- Check TypeScript errors

### Email Not Working
- Verify EmailJS environment variables
- Check email service connection
- Test template variables
- Check browser console for errors

### Styling Issues
- Ensure Tailwind CSS is building correctly
- Check custom color variables
- Verify responsive breakpoints

## 📞 Support

For deployment support:
- **Email**: ahnafahad@vh-beyondthehorizons.org
- **GitHub Issues**: [Report issues here]

## 🔄 Updates

To update the website:
1. Make changes to your repository
2. Push to main branch  
3. Vercel auto-deploys
4. Check deployment status in dashboard

---

**Last Updated**: 2025-01-15
**Version**: 1.0.0
**Status**: Production Ready ✅