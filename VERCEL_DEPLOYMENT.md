# Vercel Deployment - Email Notifications Setup

## 📋 Pre-Deployment Checklist

- [x] Resend API key tested locally
- [x] Email function integrated in `/api/registrations`
- [x] Non-blocking email sending implemented
- [x] Error handling in place

## 🚀 Deploy to Vercel

### Step 1: Add Environment Variable

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Select your project (VH Website)
3. Go to **Settings** → **Environment Variables**
4. Add the following variable:

```
Name: RESEND_API_KEY
Value: re_gEJfccMx_PvGhkJ5xDSYR23uyMMc7pR89
Environments: ✓ Production ✓ Preview ✓ Development
```

5. Click **Save**

### Step 2: Redeploy

After adding the environment variable, you need to redeploy for changes to take effect:

**Option A: Trigger from Git**
- Push any commit to your repository
- Vercel will automatically redeploy

**Option B: Manual Redeploy**
- Go to **Deployments** tab
- Click the **⋯** menu on the latest deployment
- Select **Redeploy**

### Step 3: Test in Production

After deployment, test the email functionality:

1. Visit: `https://your-domain.vercel.app/registration`
2. Fill out the registration form completely
3. Submit the form
4. Check these admin emails for notification:
   - ahnaf816@gmail.com
   - hasanxsarower@gmail.com
   - ahnafahad16@gmail.com

## 🧪 Testing Checklist

### Test Registration Flow
- [ ] Visit registration page
- [ ] Fill all required fields
- [ ] Submit form
- [ ] Verify success message appears
- [ ] Check database for new registration
- [ ] **Check all 3 admin emails for notification**
- [ ] Check spam folders if not received

### Verify Email Content
Email should include:
- [ ] Student name, email, phone
- [ ] Education type (HSC/A-Levels)
- [ ] Program mode (Mocks/Full Course)
- [ ] Selected programs
- [ ] Pricing information (if mocks)
- [ ] Referral info (if provided)

## 🔍 Troubleshooting

### If emails don't arrive:

1. **Check Vercel Logs**
   ```
   Vercel Dashboard → Project → Deployments → Click deployment → Runtime Logs
   ```
   Look for: `"Registration notification sent"` or email errors

2. **Check Spam Folders**
   - Gmail: Check "Spam" and "Promotions" tabs
   - Outlook: Check "Junk Email"

3. **Verify Environment Variable**
   ```
   Settings → Environment Variables → Ensure RESEND_API_KEY is set
   ```

4. **Check Resend Dashboard**
   - Visit: https://resend.com/emails
   - Login to see sent email history and delivery status

### Common Issues:

**Issue**: "Missing API key" error in logs
**Solution**: Environment variable not set or typo in variable name

**Issue**: Emails not received
**Solutions**:
- Check spam folders
- Verify recipient emails in code match actual admin emails
- Check Resend quota (100/day free tier)
- Verify emails are being sent in Resend dashboard

**Issue**: Registration succeeds but no email
**Solution**: This is expected behavior - email is non-blocking. Check logs for email errors.

## 📊 Monitoring

### Check Email Delivery Status

Visit Resend Dashboard: https://resend.com/emails
- View all sent emails
- Check delivery status
- See bounce/complaint rates
- Monitor daily/monthly quota

### Quota Limits (Free Tier)
- Daily: 100 emails
- Monthly: 3,000 emails
- Rate: 2 emails per second

## 🎯 Production Recommendations

1. **Monitor Email Quota**
   - Current: Free tier (100/day)
   - Upgrade if exceeding limits

2. **Add Custom Domain** (Optional)
   - Replace `onboarding@resend.dev` with your domain
   - Better deliverability and branding
   - Steps: https://resend.com/docs/dashboard/domains/introduction

3. **Set up Email Alerts**
   - Configure Vercel to send alerts on errors
   - Monitor registration API failures

4. **Test Email Templates**
   - Send test registrations periodically
   - Verify email formatting on different clients

## 📧 Email Recipients

Current admin emails receiving notifications:
- ahnaf816@gmail.com
- hasanxsarower@gmail.com
- ahnafahad16@gmail.com

To update recipients, edit: `src/lib/email.ts` (line 6-10)

---

**Status**: ✅ Ready for deployment
**Last Updated**: 2025-11-15
