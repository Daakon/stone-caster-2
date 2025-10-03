# Authentication Configuration Guide

## 🔧 Current Issue
The authentication is failing because Supabase is not properly configured. The frontend is running in demo mode with placeholder credentials.

## 🚀 Quick Fix

### 1. Create Environment File
Create a `.env` file in the `frontend/` directory with your Supabase credentials:

```bash
# frontend/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_URL=http://localhost:3000
```

### 2. Get Supabase Credentials
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project or select existing project
3. Go to Settings → API
4. Copy the Project URL and anon/public key

### 3. Configure OAuth Providers (Optional)
In your Supabase project:
1. Go to Authentication → Providers
2. Enable Google, GitHub, and/or Discord
3. Add your OAuth app credentials

## 🧪 Testing Without Supabase

If you want to test the UI without setting up Supabase:

1. **Continue as Guest**: Click "Continue as Guest" to bypass authentication
2. **Demo Mode**: The app will show helpful error messages explaining demo mode
3. **Console Logs**: Check browser console for detailed logging

## 📝 Console Logging Added

I've added comprehensive console logging to help debug authentication issues:

- `[AuthStore]` - Auth store initialization and operations
- `[AuthPage]` - OAuth and email/password authentication attempts
- `[AuthSuccessPage]` - OAuth callback handling

## 🔍 Debugging Steps

1. **Open Browser Console** (F12 → Console tab)
2. **Try OAuth**: Click "Continue with Google" and check console logs
3. **Check Network Tab**: Look for failed API requests
4. **Verify Environment**: Check if Supabase URL is configured

## 🎯 Expected Behavior

### With Supabase Configured:
- OAuth buttons work and redirect to providers
- Email/password authentication works
- Users can sign up and sign in

### In Demo Mode:
- OAuth buttons show "not available in demo mode" message
- Email/password shows "not available in demo mode" message
- "Continue as Guest" works normally
- Console shows demo mode warnings

## 🚨 Current Error Explanation

The error "Unexpected token '<', "<!doctype "... is not valid JSON" occurs because:

1. Frontend calls `/api/auth/oauth/google/start`
2. Backend returns HTML error page (likely 404 or 500)
3. Frontend expects JSON but gets HTML
4. JSON.parse() fails on HTML content

This happens when:
- Backend API is not running
- OAuth endpoints are not properly configured
- Supabase is not configured in backend
- CORS issues between frontend and backend

## 🔧 Backend Configuration

The backend also needs Supabase configuration. Check:
- `backend/.env` file exists
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- OAuth providers are configured in Supabase dashboard

## 📞 Next Steps

1. **Set up Supabase project** with OAuth providers
2. **Create environment files** for both frontend and backend
3. **Test OAuth flow** with real credentials
4. **Check console logs** for detailed debugging info

The authentication UI is working correctly - it just needs proper Supabase configuration to function fully.
