# Registration Email Notification Setup Guide

This guide explains how to set up email notifications for course and mock registrations.

## Overview

When a student registers for any course or mock exam, an automated email notification is sent to:
- ahnaf816@gmail.com
- hasanxsarower@gmail.com
- ahnafahad16@gmail.com

## Email Service: Resend

We use [Resend](https://resend.com/) for sending server-side email notifications. Resend is a modern email API designed for developers.

### Why Resend?

- **Simple API**: Easy to integrate and use
- **Generous Free Tier**: 100 emails/day (3,000/month) for free
- **Reliable**: Built for transactional emails
- **Great for Next.js**: Officially recommended by Vercel

## Setup Instructions

### Step 1: Create a Resend Account

1. Go to [https://resend.com/](https://resend.com/)
2. Sign up for a free account
3. Verify your email address

### Step 2: Get Your API Key

1. Log in to your Resend dashboard
2. Go to **API Keys** section
3. Click **Create API Key**
4. Give it a name (e.g., "VH Website Production")
5. Copy the API key (you'll only see it once!)

### Step 3: Configure Environment Variables

#### For Local Development

Add to your `.env.local` file:
```bash
RESEND_API_KEY=re_your_actual_api_key_here
```

#### For Production (Vercel)

1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Your Resend API key
   - **Environment**: Select Production, Preview, and Development
5. Click **Save**
6. Redeploy your application

### Step 4: Test the Setup

1. Make sure your application is running (local or production)
2. Go to the registration page
3. Fill out and submit a registration form
4. Check the three admin email addresses for the notification email

## Email Details

### From Address

By default, emails are sent from `onboarding@resend.dev`. This is Resend's default sender address for testing.

### Custom Domain (Optional)

To use a custom email address (e.g., `noreply@vh-beyondthehorizons.org`):

1. Go to Resend dashboard → **Domains**
2. Click **Add Domain**
3. Enter your domain name
4. Add the required DNS records to your domain
5. Wait for verification (usually a few minutes)
6. Update the `from` field in `src/lib/email.ts`:
   ```typescript
   from: 'VH Registration <noreply@your-domain.com>'
   ```

## Email Content

The notification emails include:

### Student Information
- Name
- Email
- Phone
- Education Type (HSC/A-Levels)

### Program Details
- Program Mode (Mocks/Full Course)
- Selected Programs
- Mock Intent (if applicable)
- Pricing Information (if applicable)

### Referral Information (if provided)
- Referrer Name
- Institution
- Batch

## Troubleshooting

### Emails Not Being Sent

1. **Check API Key**: Ensure `RESEND_API_KEY` is set correctly in your environment variables
2. **Check Logs**: Look for error messages in your application logs
3. **Verify Resend Status**: Check [Resend Status Page](https://status.resend.com/)
4. **API Limits**: Ensure you haven't exceeded the free tier limits (100/day)

### Emails Going to Spam

1. **Verify Domain**: Set up a custom domain with proper SPF, DKIM, and DMARC records
2. **Improve Content**: Ensure email content doesn't trigger spam filters
3. **Test Score**: Use tools like [Mail-Tester](https://www.mail-tester.com/) to check your email score

### Wrong Recipients

To change the recipient email addresses, edit the `ADMIN_EMAILS` array in `src/lib/email.ts`:

```typescript
const ADMIN_EMAILS = [
  'email1@example.com',
  'email2@example.com',
  'email3@example.com'
];
```

## Technical Details

### Files Modified

1. **`src/lib/email.ts`**: Email service with notification function
2. **`src/app/api/registrations/route.ts`**: Registration endpoint with email integration
3. **`.env.example`**: Example environment variables
4. **`.env.local.example`**: Local example environment variables
5. **`.env.production`**: Production environment variables template

### Dependencies

- **`resend`**: NPM package for Resend API integration

### Error Handling

- Email sending is **non-blocking**: Registration will succeed even if email fails
- Errors are logged but don't prevent registration completion
- Multiple recipients: If one email fails, others will still be attempted

## Cost Considerations

### Free Tier
- 100 emails per day
- 3,000 emails per month
- Perfect for getting started

### Paid Plans
If you exceed the free tier:
- **Pay-as-you-go**: $0.001 per email (after free tier)
- **Pro Plan**: $20/month for 50,000 emails

## Support

- **Resend Documentation**: [https://resend.com/docs](https://resend.com/docs)
- **Resend Support**: [support@resend.com](mailto:support@resend.com)
- **VH Website Issues**: Contact the development team

## Security Notes

- **Keep API Key Secret**: Never commit `.env.local` to git
- **Use Environment Variables**: Always use env vars, never hardcode
- **Rotate Keys**: If exposed, immediately revoke and create new key
- **Limit Permissions**: Use Resend's API key permissions when available

---

**Setup Date**: 2025-11-11
**Last Updated**: 2025-11-11
**Maintained By**: VH Development Team
