# Authentication Configuration Guide

This document describes the required environment variables and configuration for OAuth authentication in both development and production environments.

## Environment Variables

### Production

Set these in Fly.io secrets (for backend) and Cloudflare Workers vars (for frontend):

```bash
# Backend (Fly.io secrets)
WEB_BASE_URL=https://stonecaster.ai
API_BASE_URL=https://api.stonecaster.ai
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NODE_ENV=production

# Frontend (Cloudflare Workers vars / wrangler.toml)
VITE_WEB_BASE_URL=https://stonecaster.ai
VITE_API_BASE_URL=https://api.stonecaster.ai
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### Development

The app provides sensible defaults for development, but **Supabase variables are required** for OAuth to work.

Create `.env` files in the respective workspace directories:

```bash
# Frontend (.env in frontend/ directory)
VITE_WEB_BASE_URL=http://localhost:5173  # Optional: defaults to window.location
VITE_API_BASE_URL=http://localhost:3000  # Optional: defaults to http://localhost:3000
VITE_SUPABASE_URL=https://<project-ref>.supabase.co  # REQUIRED for OAuth
VITE_SUPABASE_ANON_KEY=<your-anon-key>  # REQUIRED for OAuth

# Backend (.env.local in backend/ directory)
WEB_BASE_URL=http://localhost:5173  # Optional: defaults to http://localhost:5173
API_BASE_URL=http://localhost:3000  # Optional: defaults to http://localhost:3000
SUPABASE_URL=https://<project-ref>.supabase.co  # REQUIRED
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>  # REQUIRED
NODE_ENV=development
```

**Note**: If Supabase variables are not set, the app will still load but OAuth will not work. You'll see warnings in the console.

## Validation Rules

- **Production**: `WEB_BASE_URL` and `API_BASE_URL` must:
  - Use `https://` protocol
  - Not contain `localhost`
  - Be valid URLs

- **Development**: `localhost` and `http://` are allowed

- **Missing Variables**: Application will fail fast with a clear error message if any required variable is missing

## Google OAuth Configuration

### Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Find your OAuth 2.0 Client ID
4. Click **Edit**

#### Authorized JavaScript origins:
```
https://stonecaster.ai
http://localhost:5173
```

#### Authorized redirect URIs:
```
https://<project-ref>.supabase.co/auth/v1/callback
```

Note: The actual Google → Supabase callback uses Supabase's domain. We control where Supabase redirects after authentication via the `redirectTo` parameter.

## Supabase Configuration

### Authentication > URL Configuration

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** > **URL Configuration**

#### Site URL:
```
https://stonecaster.ai
```

#### Redirect URLs:
```
https://stonecaster.ai/*
https://api.stonecaster.ai/api/auth/oauth/google/callback
http://localhost:5173/*
http://localhost:3000/api/auth/oauth/google/callback
```

## OAuth Flow

### Frontend Flow (Default)

1. User clicks "Sign in with Google"
2. Frontend calls `supabase.auth.signInWithOAuth()` with `redirectTo: ${VITE_WEB_BASE_URL}/auth/callback`
3. User authenticates with Google
4. Google redirects to Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`
5. Supabase redirects to: `${VITE_WEB_BASE_URL}/auth/callback`
6. Frontend handles the callback and completes authentication

### Backend Flow (API Destination)

1. Client calls `/api/auth/oauth/google/start?destination=api`
2. Backend builds `redirectTo: ${API_BASE_URL}/api/auth/oauth/google/callback`
3. Backend returns OAuth URL from Supabase
4. User authenticates with Google
5. Google redirects to Supabase callback
6. Supabase redirects to: `${API_BASE_URL}/api/auth/oauth/google/callback`
7. Backend handles callback and redirects to frontend success page

## Logging

Backend logs OAuth start requests with:
```
[auth] OAuth start: redirectTo=<value>, env=<NODE_ENV>, provider=<provider>
```

To view in production:
```bash
flyctl logs -a stonecaster-api | grep "OAuth start: redirectTo"
```

## Troubleshooting

### OAuth redirects to localhost in production

- Check that `WEB_BASE_URL` and `API_BASE_URL` are set correctly in Fly.io secrets
- Verify environment variables don't contain `localhost` in production
- Check backend logs for the computed `redirectTo` value

### Missing environment variables

The application will fail to start with a clear error message listing all missing variables. Check:
- Fly.io secrets are set correctly
- Cloudflare Workers vars are configured
- `.env` files exist for local development

### OAuth callback fails

- Verify Supabase redirect URLs include your production domains
- Check Google OAuth redirect URI is set to Supabase callback URL
- Ensure `redirectTo` parameter matches a URL in Supabase's allowed redirect URLs

## Legacy Variables

The following legacy environment variables are still supported but deprecated:
- `FRONTEND_URL` → Use `WEB_BASE_URL` instead
- `API_URL` → Use `API_BASE_URL` instead

These will be removed in a future version.

