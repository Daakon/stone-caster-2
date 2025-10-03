# Authentication Testing Guide

## 🎯 Current Status

### ✅ **Local Development - WORKING**
- Backend running on `http://localhost:3000` with updated CORS configuration
- Frontend automatically detects localhost and uses local backend
- OAuth endpoint returns proper CORS headers
- Tabbed authentication UI implemented with routing

### ⚠️ **Production - NEEDS DEPLOYMENT**
- Frontend tries to call `https://api.stonecaster.ai`
- Backend not deployed to production (502 Bad Gateway)
- CORS configuration ready for production deployment

## 🧪 **Testing Instructions**

### **1. Local Testing (Recommended)**

#### **Start Both Servers:**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

#### **Test Authentication Flow:**
1. **Visit**: `http://localhost:5173/auth/signin`
2. **Click**: "Continue with Google" button
3. **Expected**: Should redirect to Google OAuth (no CORS error)
4. **Console**: Should show successful OAuth URL generation

#### **Test Tabbed Interface:**
1. **Visit**: `http://localhost:5173/auth` (defaults to signup)
2. **Click**: "Sign In" tab
3. **Expected**: URL changes to `/auth/signin`
4. **Click**: "Sign Up" tab  
5. **Expected**: URL changes to `/auth/signup`

### **2. Production Testing (After Deployment)**

#### **Deploy Backend:**
The backend needs to be deployed to `https://api.stonecaster.ai` with the updated CORS configuration.

#### **Test Production Flow:**
1. **Visit**: `https://stonecaster.ai/auth/signin`
2. **Click**: "Continue with Google" button
3. **Expected**: Should redirect to Google OAuth (no CORS error)

## 🔧 **Configuration Details**

### **Frontend Auto-Detection:**
The frontend now automatically detects the environment:

```typescript
// Automatically uses localhost for development, api.stonecaster.ai for production
const apiBaseUrl = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : 'https://api.stonecaster.ai';
```

### **Backend CORS Configuration:**
```typescript
// Allows multiple origins
const allowedOrigins = [
  'http://localhost:5173',  // Local development
  'http://localhost:3000',  // Local development (alternative port)
  'https://stonecaster.ai', // Production frontend
  'https://www.stonecaster.ai', // Production frontend with www
];
```

## 🐛 **Troubleshooting**

### **CORS Error in Production:**
```
Access to fetch at 'https://api.stonecaster.ai/api/auth/oauth/google/start' 
from origin 'https://stonecaster.ai' has been blocked by CORS policy
```

**Solution**: Deploy the backend with updated CORS configuration to `https://api.stonecaster.ai`

### **CORS Error in Local Development:**
```
Access to fetch at 'http://localhost:3000/api/auth/oauth/google/start' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution**: 
1. Ensure backend is running on port 3000
2. Check that CORS configuration includes `http://localhost:5173`
3. Restart backend server

### **"Page Not Found" for /auth:**
**Solution**: The tabbed interface now uses `/auth/signin` and `/auth/signup` routes

### **OAuth Redirect Issues:**
**Solution**: Ensure Supabase is properly configured with OAuth provider credentials

## 📋 **Current Implementation Status**

### ✅ **Completed:**
- [x] Tabbed authentication UI with routing
- [x] CORS configuration for multiple origins
- [x] Auto-detection of development vs production
- [x] Deep link support for auth modes
- [x] Local development testing setup
- [x] Console logging for debugging

### 🔄 **In Progress:**
- [ ] Production backend deployment
- [ ] Production OAuth testing

### 📝 **Next Steps:**
1. **Deploy backend** to `https://api.stonecaster.ai`
2. **Test production OAuth flow**
3. **Configure Supabase OAuth providers** (if not already done)
4. **Test guest-to-user account linking**

## 🎉 **Success Criteria**

### **Local Development:**
- [x] No CORS errors when clicking "Continue with Google"
- [x] Tabbed interface works with proper routing
- [x] Console shows successful OAuth URL generation
- [x] Deep links work for `/auth/signin` and `/auth/signup`

### **Production:**
- [ ] No CORS errors when clicking "Continue with Google"
- [ ] OAuth flow redirects to Google successfully
- [ ] Authentication completes and redirects to return URL
- [ ] Guest-to-user account linking works

## 🚀 **Ready for Testing**

The authentication system is now ready for local testing! The tabbed interface provides a much better user experience, and the CORS configuration is properly set up for both development and production environments.

**Start testing locally now** - the OAuth flow should work without CORS errors on `http://localhost:5173`!
