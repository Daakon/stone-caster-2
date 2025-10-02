# StoneCaster Deployment Guide

This guide covers deploying the StoneCaster application to production using Cloudflare Workers (frontend) and Fly.io (backend).

## Architecture

- **Frontend**: React + Vite app deployed to Cloudflare Workers
- **Backend**: Node.js + Express API deployed to Fly.io
- **Database**: Supabase (PostgreSQL + Auth)
- **Domain**: stonecaster.ai

## Prerequisites

1. **Cloudflare Account** with Workers enabled
2. **Fly.io Account** with CLI installed
3. **Supabase Project** with database and auth configured
4. **Domain configured** to point to Cloudflare Workers

## Configuration Files

### Frontend (Cloudflare Workers)
- `wrangler.toml` - Cloudflare Workers configuration
- `frontend/src/worker.ts` - Worker entry point

### Backend (Fly.io)
- `fly.toml` - Fly.io app configuration (root level)
- `backend/fly.toml` - Alternative Fly.io configuration

## Deployment Steps

### 1. Set Up Secrets

Before deploying, set all required secrets on Fly.io:

```powershell
.\set-fly-secrets.ps1
```

This script sets:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key
- `PRIMARY_AI_MODEL` - AI model to use
- `CORS_ORIGIN` - Allowed origin for CORS
- `SESSION_SECRET` - Session encryption secret
- `STRIPE_SECRET_KEY` - Stripe secret key (if using payments)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `ANTHROPIC_API_KEY` - Anthropic API key (if using Claude)

### 2. Deploy Backend

Deploy the Node.js API to Fly.io:

```powershell
.\deploy-server.ps1
```

Or deploy from the backend directory:
```powershell
cd backend
flyctl deploy
```

### 3. Deploy Frontend

Deploy the React app to Cloudflare Workers:

```powershell
.\deploy-client.ps1
```

### 4. Deploy Both (Full Deployment)

Deploy both frontend and backend:

```powershell
.\deploy.ps1
```

## Environment Variables

### Frontend Build Environment
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anonymous key
- `VITE_API_BASE_URL` - Backend API URL (defaults to stonecaster-api.fly.dev)

### Backend Runtime Environment
All secrets are set via Fly.io secrets (see set-fly-secrets.ps1)

## Health Checks

After deployment, verify the services are running:

- **Backend Health**: https://stonecaster-api.fly.dev/health
- **Frontend**: https://stonecaster.ai

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Ensure all dependencies are installed: `npm install`
   - Check that TypeScript compilation passes: `npm run type-check`

2. **Deployment Failures**
   - Verify secrets are set: `flyctl secrets list -a stonecaster-api`
   - Check Fly.io app status: `flyctl status -a stonecaster-api`

3. **CORS Issues**
   - Ensure `CORS_ORIGIN` secret matches your frontend domain
   - Check that the backend is accessible from the frontend domain

### Logs

View logs for debugging:

```bash
# Backend logs
flyctl logs -a stonecaster-api

# Frontend logs (Cloudflare Workers)
# Check Cloudflare dashboard for Workers logs
```

## Security Considerations

- Never commit secrets to version control
- Use environment variables for all sensitive configuration
- Ensure Supabase RLS policies are properly configured
- Verify CORS origins are restricted to your domains

## CI/CD Integration

For automated deployments, ensure:

1. All secrets are available in your CI environment
2. Use non-interactive flags for all commands
3. Run tests before deployment
4. Use proper error handling and rollback procedures

## Monitoring

- Monitor Fly.io app health and performance
- Set up Cloudflare Workers analytics
- Configure Supabase monitoring and alerts
- Use proper logging and error tracking
