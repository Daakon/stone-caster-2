
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

// Load env
dotenv.config();

// Fallback for local dev if not in env
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';

const migrationFile = process.argv[2];

if (!migrationFile) {
    console.error('Please provide a migration file path.');
    process.exit(1);
}

const filePath = path.resolve(process.cwd(), migrationFile);

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const sql = fs.readFileSync(filePath, 'utf-8');

console.log(`Applying migration: ${path.basename(filePath)}`);
console.log(`Target DB: ${DATABASE_URL.split('@')[1]}`); // Mask credentials

const client = new Client({
    connectionString: DATABASE_URL,
});

async function run() {
    try {
        await client.connect();
        await client.query(sql);
        console.log('Migration applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
