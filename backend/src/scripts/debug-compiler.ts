import { Compiler } from '../services/compiler/Compiler.js';
import dotenv from 'dotenv';
import path from 'path';

// Construct path to .env file relative to this script
// Assumes running from project root or backend root
dotenv.config();

const STORY_ID = '97af18c8-79fc-422c-a830-7cac257685a7'; // Hardcoded ID from user

async function run() {
    console.log('==================================================');
    console.log(`[Debug] Manually triggering compilation for Story: ${STORY_ID}`);
    console.log('==================================================');

    console.log(`[Debug] CWD: ${process.cwd()}`);
    console.log(`[Debug] SUPABASE_URL present: ${!!process.env.SUPABASE_URL}`);
    console.log(`[Debug] SUPABASE_SERVICE_KEY present: ${!!process.env.SUPABASE_SERVICE_KEY}`);

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_KEY missing.');
        // Try loading from .env in parent directory ?? 
        // Note: script is in backend/src/scripts. backend/ is root.
        process.exit(1);
    }

    try {
        await Compiler.compileStory(STORY_ID);
        console.log('==================================================');
        console.log('[Success] Compilation completed without error.');
        console.log('Check `chimera_compiled_stories` table for the new record.');
        console.log('==================================================');
    } catch (error: any) {
        console.error('==================================================');
        console.error('[Error] Compilation Failed:');
        console.error(error);
        console.error('==================================================');
    }
}

run();
