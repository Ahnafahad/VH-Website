# EmailJS Setup Guide

To enable the contact form functionality, you need to set up EmailJS and configure environment variables.

## 1. Create EmailJS Account

1. Go to [EmailJS.com](https://www.emailjs.com/)
2. Sign up for a free account
3. Verify your email address

## 2. Create an Email Service

1. In your EmailJS dashboard, go to "Email Services"
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions to connect your email
5. Note down the **Service ID**

## 3. Create an Email Template

1. Go to "Email Templates" in your dashboard
2. Click "Create New Template"
3. Set up your template with these variables:
   - `{{to_email}}` - Recipient email
   - `{{from_name}}` - Sender name
   - `{{from_email}}` - Sender email
   - `{{subject}}` - Email subject
   - `{{message}}` - Email body

Example template:
```
To: {{to_email}}
From: {{from_name}} <{{from_email}}>
Subject: {{subject}}

{{message}}
```

4. Save the template and note down the **Template ID**

## 4. Get Your Public Key

1. Go to "Account" in your dashboard
2. Find "API Keys" section
3. Note down your **Public Key**

## 5. Set Up Environment Variables

1. Create a `.env.local` file in your project root
2. Add these variables:

```
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_actual_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_actual_template_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_actual_public_key
```

3. Replace the placeholder values with your actual EmailJS credentials
4. Restart your development server

## 6. Test the Form

1. Go to the registration page
2. Fill out and submit the form
3. Check that emails are being sent to `ahnaf816@gmail.com`

## Troubleshooting

- Make sure all environment variables are set correctly
- Check that your EmailJS service is active
- Verify your email template includes all required variables
- Check the browser console for detailed error messages