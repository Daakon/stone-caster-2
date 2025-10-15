# OpenAI API Setup Guide

## Problem
The AI service is generating prompts correctly but not sending them to the AI because the OpenAI API key is not configured.

## Solution

### 1. Get an OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key (it starts with `sk-`)

### 2. Configure the API Key

#### Option A: Environment Variable (Recommended)
Set the environment variable in your system:
```bash
# Windows (PowerShell)
$env:OPENAI_API_KEY="sk-your-actual-api-key-here"

# Windows (Command Prompt)
set OPENAI_API_KEY=sk-your-actual-api-key-here

# Linux/Mac
export OPENAI_API_KEY="sk-your-actual-api-key-here"
```

#### Option B: .env File
Create a `.env` file in the project root:
```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

#### Option C: Development Environment
For development, you can also set it in your IDE or terminal session.

### 3. Verify Configuration
After setting the API key, restart your development server and check the logs. You should see:
```
[AI_SERVICE] OpenAI service initialized successfully
```

### 4. Test the AI Service
Once configured, the AI service will:
1. Generate prompts correctly (as it does now)
2. Send prompts to OpenAI API
3. Return actual AI-generated responses instead of fallback responses

## Current Behavior
- ✅ Prompts are generated correctly
- ❌ AI service uses fallback responses due to missing API key
- ❌ No actual AI processing occurs

## Expected Behavior After Setup
- ✅ Prompts are generated correctly
- ✅ AI service sends prompts to OpenAI
- ✅ Real AI responses are returned
- ✅ Game continues with AI-generated content

## Troubleshooting

### Error: "OpenAI service not available"
- Check that OPENAI_API_KEY is set correctly
- Verify the API key is valid and has credits
- Check that the key doesn't include placeholder text like "your_ope"

### Error: "API key not configured"
- Ensure the environment variable is set before starting the server
- Restart the server after setting the environment variable
- Check that the .env file is in the correct location

### Still Not Working?
1. Check server logs for detailed error messages
2. Verify the API key format (should start with `sk-`)
3. Test the API key directly with OpenAI's API
4. Check your OpenAI account for usage limits or billing issues




