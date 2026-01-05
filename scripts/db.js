import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Client } = pg;

async function runSQL(sql) {
    if (!process.env.SUPABASE_DB_URL) {
        console.error('❌ Error: SUPABASE_DB_URL is not defined in .env');
        return;
    }

    const client = new Client({
        connectionString: process.env.SUPABASE_DB_URL,
        ssl: {
            rejectUnauthorized: false // Required for Supabase in many environments
        }
    });

    try {
        await client.connect();
        console.log('🔗 Connected to Supabase Postgres');
        const res = await client.query(sql);
        console.log('✅ SQL executed successfully');
        return res;
    } catch (err) {
        console.error('❌ Error executing SQL:', err.message);
        throw err;
    } finally {
        await client.end();
    }
}

// If run directly
if (process.argv[1].endsWith('db.js')) {
    const rawSql = process.argv.slice(2).join(' ');
    if (rawSql) {
        runSQL(rawSql).catch(() => process.exit(1));
    } else {
        console.log('Usage: node scripts/db.js "YOUR SQL HERE"');

        // Default action: Add the grayscale column if no SQL provided
        const defaultSql = 'ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS clients_grayscale BOOLEAN DEFAULT FALSE;';
        console.log('Running default migration: ' + defaultSql);
        runSQL(defaultSql).catch(() => process.exit(1));
    }
}

export { runSQL };
