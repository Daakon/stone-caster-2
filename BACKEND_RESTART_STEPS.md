# Backend Restart Verification Steps

## The Problem
Backend is running old code that doesn't set `world_id`. The new build exists but isn't running.

## Steps to Fix

### 1. Kill ALL Node Processes
```powershell
# In PowerShell - Kill ALL node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Verify nothing is listening on port 3000
netstat -ano | findstr :3000
# Should return NOTHING
```

### 2. Verify the Build is Recent
```powershell
cd "C:\Dev\Stone Caster\stone-caster-2\backend"
Get-Item dist\index.js | Select-Object LastWriteTime
# Should show a timestamp from the last few minutes
```

### 3. Start Fresh
```powershell
cd "C:\Dev\Stone Caster\stone-caster-2\backend"
npm run start:local
```

### 4. Verify New Code is Running
You should see in the startup logs:
- No errors
- Server starting on port 3000

### 5. Create a New Character
When you create a character, you MUST see these logs:
```
[CHARACTER_CREATE_DATA] { id: '...', world_slug: 'mystika', world_id: '65103459-...' }
[CHARACTER_CREATED_DB_ROW] { id: '...', world_id: '65103459-...' }
```

If you DON'T see those logs, the backend is STILL running old code!

### 6. Try Starting Game
After creating the fresh character, try starting the game. Should work!

## Why This is Happening

The old backend process is still running, even though you rebuilt. Node doesn't automatically reload.

You MUST:
1. Kill the old process
2. Start a new one
3. Verify it's the new code by seeing the new logs

