# 🚀 Deploy Email Notifications to Vercel

## Quick Start (5 minutes)

### Step 1: Add Environment Variable to Vercel

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Login if needed

2. **Select Your Project**
   - Find and click on your VH Website project

3. **Navigate to Settings**
   - Click **Settings** tab at the top
   - Click **Environment Variables** in the left sidebar

4. **Add the API Key**
   - Click **Add New** button
   - Fill in:
     ```
     Name: RESEND_API_KEY
     Value: re_gEJfccMx_PvGhkJ5xDSYR23uyMMc7pR89
     ```
   - Select environments:
     - ☑️ Production
     - ☑️ Preview
     - ☑️ Development
   - Click **Save**

### Step 2: Redeploy Your Site

**Option A: Push a Commit (Recommended)**
```bash
git add .
git commit -m "Add Resend email notifications"
git push
```
Vercel will automatically redeploy.

**Option B: Manual Redeploy**
1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the **⋮** (three dots) menu
4. Select **Redeploy**
5. Confirm the redeploy

### Step 3: Test in Production

1. **Visit your registration page:**
   ```
   https://your-site.vercel.app/registration
   ```

2. **Fill out the form with test data:**
   - Name: Test User
   - Email: test@example.com
   - Phone: +8801234567890
   - Select any program
   - Fill all required fields

3. **Submit the form**

4. **Check admin emails for notification:**
   - ahnaf816@gmail.com
   - hasanxsarower@gmail.com
   - ahnafahad16@gmail.com

   ⚠️ **Also check SPAM folders!**

## ✅ Verification Steps

### Check Vercel Logs
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click **Runtime Logs** or **Functions** tab
4. Look for:
   ```
   Registration notification sent: 3 successful, 0 failed
   ```

### Check Resend Dashboard
1. Visit: https://resend.com/emails
2. Login with your Resend account
3. You should see the sent emails listed
4. Check delivery status

## 🐛 Troubleshooting

### ❌ No Environment Variable Found
**Error in logs:** `RESEND_API_KEY not configured`

**Solution:**
1. Verify variable is added in Settings → Environment Variables
2. Variable name must be exactly: `RESEND_API_KEY`
3. Redeploy after adding the variable

### ❌ Emails Not Received
**Possible causes:**

1. **Check Spam Folders**
   - Gmail: Check "Spam" and "Promotions" tabs
   - Look for emails from "VH Registration System"

2. **Verify Email Sent**
   - Check Vercel logs for "Registration notification sent"
   - Check Resend dashboard: https://resend.com/emails

3. **Free Tier Limits**
   - Daily limit: 100 emails
   - Check if limit exceeded in Resend dashboard

### ❌ Registration Works But No Email
This is **EXPECTED** behavior! Email sending is non-blocking.

**To diagnose:**
1. Check Vercel logs for email errors
2. Look for: `Failed to send registration notification email:`
3. Check Resend dashboard for delivery issues

## 📊 Monitor Email Delivery

### Resend Dashboard
Visit: https://resend.com/emails

**What to check:**
- ✅ Emails are being sent
- ✅ Delivery status (delivered/bounced)
- ✅ Daily/monthly quota usage
- ✅ Any error messages

### Vercel Logs
**Access logs:**
1. Deployments → Click deployment → Runtime Logs
2. Or use Vercel CLI:
   ```bash
   vercel logs
   ```

**What to look for:**
```
✅ "Registration notification sent: 3 successful, 0 failed"
❌ "Failed to send registration notification email:"
```

## 🎯 Expected Behavior

### When Registration is Submitted:

1. **Frontend:**
   - Form submits to `/api/registrations`
   - Shows success message
   - Resets form

2. **Backend:**
   - Validates registration data
   - Saves to database
   - Sends email notification (non-blocking)
   - Returns success response

3. **Email:**
   - 3 emails sent simultaneously
   - One to each admin email
   - Contains full registration details
   - Sent from: `onboarding@resend.dev`

### Email Should Contain:
- 📝 Student Information (name, email, phone, education type)
- 📚 Program Details (mocks/full course, selections)
- 💰 Pricing (if applicable)
- 👥 Referral Info (if provided)

## 🔄 Testing Workflow

### Create Test Registration

**Test Data:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+8801712345678",
  "educationType": "hsc",
  "years": {"hsc": true, "alevels": false},
  "programMode": "mocks",
  "selectedMocks": ["IBA Mock Test"],
  "mockIntent": "trial",
  "pricing": {
    "subtotal": 5000,
    "discount": 500,
    "finalPrice": 4500
  }
}
```

**Expected Result:**
1. Registration saved in database
2. 3 emails sent to admins
3. Success message shown
4. No errors in Vercel logs

### Verify in Admin Panel

1. Login as admin
2. Go to: `/admin/registrations`
3. Verify test registration appears
4. Status should be "pending"

## 🚨 Important Notes

1. **Email is Non-Blocking**
   - Registration succeeds even if email fails
   - Check logs for email errors

2. **From Address**
   - Currently: `onboarding@resend.dev`
   - For better deliverability, add custom domain
   - See: https://resend.com/docs/dashboard/domains/introduction

3. **Rate Limits**
   - Free tier: 100 emails/day
   - 2 emails per second
   - Each registration sends 3 emails

4. **Spam Filtering**
   - Emails from `onboarding@resend.dev` may be flagged
   - Check spam folders during testing
   - Consider custom domain for production

## 📧 Update Admin Email List

To change admin email recipients:

1. Edit: `src/lib/email.ts`
2. Update `ADMIN_EMAILS` array (line 6-10):
   ```typescript
   const ADMIN_EMAILS = [
     'email1@example.com',
     'email2@example.com',
     'email3@example.com'
   ];
   ```
3. Commit and push changes
4. Vercel will redeploy automatically

## ✨ Success Criteria

✅ Environment variable added to Vercel
✅ Site redeployed after adding variable
✅ Test registration submitted successfully
✅ 3 admin emails received notification
✅ Email contains correct registration details
✅ No errors in Vercel logs
✅ Resend dashboard shows sent emails

---

**Need help?** Check Vercel logs first, then Resend dashboard.
**Status:** Ready for deployment ✅
