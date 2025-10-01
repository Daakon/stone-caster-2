# Layer 0.1: Fix Build & Test Infrastructure - Setup Guide

## Overview

This guide provides step-by-step instructions to set up and test Layer 0.1 of the Stone Caster application. The goal is to fix E2E test failures, add missing dependencies, and ensure the application runs correctly locally.

## Prerequisites

- Node.js 20+ installed
- npm or yarn package manager
- Supabase account (free tier is fine)
- OpenAI API key (for AI features)
- Git installed

## Step-by-Step Setup

### 1. Clone and Checkout Branch

```bash
# Clone the repository (if not already done)
git clone https://github.com/Daakon/stone-caster-2.git
cd stone-caster-2

# Checkout the Layer 0.1 branch
git checkout layer-0.1/fix-build-test-infrastructure
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Set Up Supabase

1. Go to [Supabase](https://supabase.com) and create a new project
2. Note down your project URL and API keys
3. Go to the SQL Editor in your Supabase dashboard
4. Execute the following migrations in order:

**Migration 1: Initial Schema**
```sql
-- Copy and paste the contents of supabase/migrations/001_initial_schema.sql
-- This creates the basic tables: characters, world_templates, game_saves
```

**Migration 2: Config Tables**
```sql
-- Copy and paste the contents of supabase/migrations/002_config_tables.sql
-- This creates the configuration spine tables
```

**Migration 3: Config Seed Data**
```sql
-- Copy and paste the contents of supabase/migrations/003_config_seed.sql
-- This seeds the configuration with baseline values
```

### 4. Set Up Environment Variables

**Backend Environment (.env in backend/ directory):**
```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-key
PRIMARY_AI_MODEL=gpt-4-turbo-preview
SESSION_SECRET=your-random-session-secret-here
CORS_ORIGIN=http://localhost:5173
```

**Frontend Environment (.env in frontend/ directory):**
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3000
```

### 5. Add Missing Dependencies

```bash
# Add Tailwind CSS and related packages
npm install --workspace=frontend tailwindcss @tailwindcss/forms @tailwindcss/typography

# Add shadcn/ui dependencies
npm install --workspace=frontend @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install --workspace=frontend class-variance-authority clsx tailwind-merge

# Add form handling
npm install --workspace=frontend react-hook-form @hookform/resolvers

# Add accessibility testing
npm install --workspace=frontend @axe-core/playwright

# Add crypto utilities for backend
npm install --workspace=backend crypto-js
npm install --workspace=backend @types/crypto-js
```

### 5.1 Third-Party Wrappers (Required)

**Third-Party Wrappers (Required)**
- Create `backend/src/wrappers/ai.ts`, `backend/src/wrappers/auth.ts`, `backend/src/wrappers/payments.ts`.
- All vendor SDK calls must be confined to these files. Feature code imports the wrapper API only.
- Add a unit test that fails if vendor imports are detected elsewhere (e.g., using a lint rule or grep in tests).

### 6. Configure Tailwind CSS

```bash
# Initialize Tailwind CSS
npx tailwindcss init -p --workspace=frontend
```

This will create `frontend/tailwind.config.js` and `frontend/postcss.config.js`. Update the Tailwind config:

```javascript
// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
}
```

### 7. Update CSS Files

Replace the contents of `frontend/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### 8. Start Development Servers

```bash
# Start both frontend and backend
npm run dev
```

This will start:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### 9. Test the Application

#### 9.1 Basic Functionality Test

1. **Open Frontend**: Navigate to http://localhost:5173
2. **Check Homepage**: Verify the homepage loads correctly
3. **Test Navigation**: Click on navigation links
4. **Test Mobile View**: Resize browser to 375×812 pixels
5. **Test Responsive**: Resize to different viewport sizes

#### 9.2 Backend API Test

1. **Health Check**: Visit http://localhost:3000/health
2. **Config Endpoint**: Visit http://localhost:3000/api/config
3. **Verify Response**: Check that endpoints return proper JSON

**Config ETag Caching Test**
- First request: `curl -i http://localhost:3000/api/config` (note the `ETag` header)
- Second request: `curl -i http://localhost:3000/api/config -H "If-None-Match: <ETAG_FROM_PREV>"`
- Expected: `304 Not Modified`

**DTO Redaction Test**
- Call representative endpoints (e.g., `GET /api/games/:id` when available)
- Verify responses DO NOT include internal fields such as `state_snapshot`, prompt text, internal IDs, or audit data.

#### 9.3 Mobile Testing

1. **Open DevTools**: F12 or right-click → Inspect
2. **Toggle Device Toolbar**: Click device icon
3. **Set Viewport**: 375×812 (iPhone X)
4. **Test All Pages**: Navigate through all pages
5. **Test Touch**: Verify touch targets are appropriate size

### 10. Run Tests

```bash
# Run unit tests
npm test

# Run config unit tests (ETag, hot-reload, type safety, public DTO redaction)
npm test --workspace=backend -- -t "@config"

# Run E2E tests
npm run test:e2e --workspace=frontend

# Run linting
npm run lint --workspaces

# Run type checking
npm run type-check --workspaces
```

### 11. Expected Results

After completing this setup, you should see:

✅ **Frontend loads correctly** at http://localhost:5173
✅ **Backend responds** at http://localhost:3000/health
✅ **Mobile viewport works** at 375×812
✅ **All tests pass** (unit and E2E)
✅ **No linting errors**
✅ **No TypeScript errors**
✅ **Tailwind CSS working** (utility classes applied)
✅ **No hard-coded numbers in services or routes**: pricing/limits read only via the config module and `/api/config` returns the public subset

### 12. Troubleshooting

#### Common Issues:

**E2E Tests Failing:**
- Ensure frontend is running on port 5173
- Check that backend is running on port 3000
- Verify environment variables are set correctly

**Frontend Not Loading:**
- Check browser console for errors
- Verify Vite is running without errors
- Ensure all dependencies are installed

**Backend Not Responding:**
- Check backend console for errors
- Verify Supabase connection
- Ensure environment variables are correct

**Mobile Viewport Issues:**
- Clear browser cache
- Check CSS media queries
- Verify Tailwind CSS is working

#### Getting Help:

1. Check the browser console for errors
2. Check the terminal for build errors
3. Verify all environment variables are set
4. Ensure Supabase migrations ran successfully
5. Check that all dependencies are installed

### 13. Next Steps

Once Layer 0.1 is working correctly:

1. **Review the implementation** to ensure it meets your expectations
2. **Test all functionality** thoroughly
3. **Verify mobile experience** is smooth
4. **Check accessibility** with screen reader if available
5. **Approve the layer** before moving to Layer 0.2

## Success Criteria

Layer 0.1 is complete when:

- ✅ Application loads and runs locally without errors
- ✅ All E2E tests pass
- ✅ Frontend works correctly on mobile (375×812)
- ✅ Backend API endpoints respond correctly
- ✅ No linting or TypeScript errors
- ✅ Tailwind CSS is properly configured
- ✅ All existing functionality works as expected

This foundation must be solid before proceeding to Layer 0.2 (Tailwind CSS + shadcn/ui implementation).
