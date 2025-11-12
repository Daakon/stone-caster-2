# OAuth Production Setup Guide

## Overview
This guide explains how to configure OAuth authentication (Google, GitHub, Discord) to work correctly in production.

## Problem
OAuth redirects are currently pointing to `localhost` instead of production URLs. This happens because the backend environment variables (`API_URL` and `FRONTEND_URL`) are not set correctly in production.

## Solution

### 1. Set Fly.io Environment Variables

Run the following commands to set the production URLs:

```powershell
# Set frontend URL (where users are redirected after OAuth)
flyctl secrets set FRONTEND_URL="https://stonecaster.ai" -a stonecaster-api

# Set API URL (OAuth callback endpoint)
flyctl secrets set API_URL="https://api.stonecaster.ai" -a stonecaster-api

# Also set CORS origin (if not already set)
flyctl secrets set CORS_ORIGIN="https://stonecaster.ai" -a stonecaster-api
```

Or use the provided script:
```powershell
.\fix-prod-config.ps1
```

### 2. Verify Secrets Are Set

```powershell
flyctl secrets list -a stonecaster-api
```

You should see:
- `FRONTEND_URL=https://stonecaster.ai`
- `API_URL=https://api.stonecaster.ai`
- `CORS_ORIGIN=https://stonecaster.ai`

### 3. Redeploy Backend

After setting secrets, redeploy the backend to pick up the new environment variables:

```powershell
flyctl deploy --remote-only --app stonecaster-api
```

### 4. Update Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Find your OAuth 2.0 Client ID
4. Click **Edit**
5. Under **Authorized redirect URIs**, add:
   ```
   https://api.stonecaster.ai/api/auth/oauth/google/callback
   ```
6. **Save** the changes

### 5. Update Supabase OAuth Configuration

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** > **URL Configuration**
4. Under **Redirect URLs**, add:
   ```
   https://api.stonecaster.ai/api/auth/oauth/google/callback
   https://api.stonecaster.ai/api/auth/oauth/github/callback
   https://api.stonecaster.ai/api/auth/oauth/discord/callback
   ```
5. Set **Site URL** to:
   ```
   https://stonecaster.ai
   ```
6. **Save** the changes

### 6. Test OAuth Flow

1. Navigate to `https://stonecaster.ai`
2. Click "Sign In" or "Sign Up"
3. Click "Continue with Google"
4. Complete the OAuth flow
5. You should be redirected back to `https://stonecaster.ai/auth/success` (not localhost)

## How It Works

The OAuth flow uses these URLs:

1. **OAuth Start**: User clicks "Continue with Google" → Frontend calls `/api/auth/oauth/google/start`
2. **OAuth Provider Redirect**: Backend generates OAuth URL with `redirectTo: ${API_URL}/api/auth/oauth/google/callback`
3. **OAuth Callback**: Google redirects to `https://api.stonecaster.ai/api/auth/oauth/google/callback`
4. **Final Redirect**: Backend redirects user to `${FRONTEND_URL}/auth/success` (i.e., `https://stonecaster.ai/auth/success`)

## Environment Variables Reference

| Variable | Production Value | Purpose |
|----------|-----------------|---------|
| `FRONTEND_URL` | `https://stonecaster.ai` | Where users are redirected after successful OAuth |
| `API_URL` | `https://api.stonecaster.ai` | OAuth callback endpoint URL |
| `CORS_ORIGIN` | `https://stonecaster.ai` | Allowed CORS origin for API requests |

## Troubleshooting

### OAuth still redirects to localhost

1. **Verify secrets are set**: `flyctl secrets list -a stonecaster-api`
2. **Restart backend**: `flyctl deploy --remote-only --app stonecaster-api`
3. **Check backend logs**: `flyctl logs -a stonecaster-api`
4. **Verify OAuth provider settings**: Make sure the redirect URI is exactly `https://api.stonecaster.ai/api/auth/oauth/google/callback`

### 400 Error: redirect_uri_mismatch

This means the redirect URI in your OAuth provider (Google/GitHub/Discord) doesn't match what the backend is sending. Make sure:
- The redirect URI in the provider matches exactly: `https://api.stonecaster.ai/api/auth/oauth/{provider}/callback`
- The backend has `API_URL=https://api.stonecaster.ai` set as a secret

### CORS errors

Make sure `CORS_ORIGIN=https://stonecaster.ai` is set in Fly.io secrets.

## Related Files

- `backend/src/routes/auth.ts` - OAuth route handlers
- `backend/src/services/config.service.ts` - Environment variable loading
- `fix-prod-config.ps1` - Script to set production environment variables
- `fix-oauth-callbacks.ps1` - Script specifically for OAuth callback URLs

