import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.gksbxdajrnjktxcninxr:yo9VQO3zwDlSP4eu@db.gksbxdajrnjktxcninxr.supabase.co:6543/postgres";

async function runSql() {
    const client = new Client({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        await client.query("ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS clients_grayscale BOOLEAN DEFAULT FALSE;");
        console.log("SQL executed successfully: Added clients_grayscale column.");

        const result = await client.query("SELECT clients_grayscale FROM site_settings LIMIT 1;");
        console.log("Current value in DB:", result.rows[0]);

    } catch (err) {
        console.error("Error executing SQL:", err.message);
    } finally {
        await client.end();
    }
}

runSql();
