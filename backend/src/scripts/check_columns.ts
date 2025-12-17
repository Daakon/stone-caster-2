
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectColumns() {
    console.log('Inspecting chimera_stories columns...');
    // Only way to inspect columns via client is to try selecting * limit 0 or query specialized view if available.
    // We can try to just select one row.
    const { data, error } = await supabase
        .from('chimera_stories')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching stories:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found based on first row keys:', Object.keys(data[0]));
    } else {
        console.log('No stories found, cannot infer columns easily without admin access to info_schema.');
    }
}

inspectColumns();
