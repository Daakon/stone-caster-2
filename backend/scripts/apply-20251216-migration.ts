
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { Client } = pg;

// Default local Supabase connection string
const DEFAULT_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
const connectionString = process.env.DATABASE_URL || DEFAULT_DB_URL;

console.log(`Connecting to database... (URL provided: ${!!process.env.DATABASE_URL})`);

const client = new Client({
    connectionString,
});

async function run() {
    try {
        await client.connect();
        console.log('Connected.');

        // Migration SQL
        const sql = `
      ALTER TABLE chimera_stories 
      ADD COLUMN IF NOT EXISTS primary_image_url TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT;
    `;

        console.log('Applying migration...');
        await client.query(sql);
        console.log('Migration applied.');

        console.log('Reloading PostgREST schema cache...');
        await client.query("NOTIFY pgrst, 'reload schema'");
        console.log('Schema cache reload notified.');

    } catch (err) {
        console.error('Error applying migration:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
