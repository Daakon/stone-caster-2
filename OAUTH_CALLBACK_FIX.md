# OAuth Callback URL Fix for Production

## 🚨 Problem
OAuth authentication in production is redirecting to `http://localhost:3000` instead of production URLs, causing the error:
```
http://localhost:3000/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+callback+with+invalid+state
```

## 🔧 Root Cause
The backend is using environment variables `FRONTEND_URL` and `API_URL` for OAuth callback URLs, but these are not set in production, so they default to localhost.

## ✅ Solution

### 1. Set Environment Variables in Production

Run the updated deployment script to set the correct URLs:

```powershell
# Run the updated set-fly-secrets.ps1 script
./set-fly-secrets.ps1
```

This will set:
- `FRONTEND_URL="https://stonecaster.ai"`
- `API_URL="https://api.stonecaster.ai"`

### 2. Configure OAuth Providers in Supabase

For each OAuth provider (Google, GitHub, Discord), you need to update the callback URLs in their respective dashboards:

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Find your OAuth 2.0 Client ID
4. Add to **Authorized redirect URIs**:
   - `https://api.stonecaster.ai/api/auth/oauth/google/callback`

#### GitHub OAuth
1. Go to [GitHub Settings](https://github.com/settings/developers)
2. Navigate to OAuth Apps
3. Find your app and click "Edit"
4. Update **Authorization callback URL**:
   - `https://api.stonecaster.ai/api/auth/oauth/github/callback`

#### Discord OAuth
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to OAuth2 → General
4. Add to **Redirects**:
   - `https://api.stonecaster.ai/api/auth/oauth/discord/callback`

### 3. Update Supabase OAuth Configuration

In your Supabase project:
1. Go to Authentication → Providers
2. For each enabled provider, ensure the **Redirect URL** is set to:
   - `https://api.stonecaster.ai/api/auth/oauth/{provider}/callback`

### 4. Verify Configuration

After making these changes:

1. **Redeploy the backend** to pick up the new environment variables
2. **Test OAuth flow** in production
3. **Check browser console** for any remaining errors

## 🔍 How It Works

The OAuth flow uses these URLs:

1. **OAuth Start**: Frontend calls `https://api.stonecaster.ai/api/auth/oauth/{provider}/start`
2. **Provider Redirect**: User is redirected to Google/GitHub/Discord
3. **Provider Callback**: Provider redirects to `https://api.stonecaster.ai/api/auth/oauth/{provider}/callback`
4. **Final Redirect**: Backend redirects to `https://stonecaster.ai/auth/success`

## 🚨 Important Notes

- **Never use localhost URLs in production OAuth configurations**
- **All OAuth providers must have the correct callback URLs**
- **Environment variables must be set before deploying**
- **Test thoroughly after making changes**

## 🧪 Testing

To test the fix:

1. Try OAuth authentication in production
2. Verify the callback URL in the browser address bar
3. Check that you're redirected to `stonecaster.ai` (not localhost)
4. Confirm successful authentication

## 📝 Environment Variables Reference

Required environment variables for production:

```bash
FRONTEND_URL=https://stonecaster.ai
API_URL=https://api.stonecaster.ai
CORS_ORIGIN=https://stonecaster.ai
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

The OAuth callback URLs are constructed from these variables in the backend code.
