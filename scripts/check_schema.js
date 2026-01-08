import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSchema() {
    console.log("Checking custom_domains schema...");
    const { data, error } = await supabase
        .from('custom_domains')
        .select('*')
        .limit(1);

    if (error) {
        console.error("❌ Error accessing custom_domains:", error.message);
        if (error.message.includes("column")) {
            console.log("Possible missing column error.");
        }
    } else {
        console.log("✅ custom_domains table is accessible.");
        if (data && data.length > 0) {
            console.log("Columns found in first row:", Object.keys(data[0]));
        } else {
            console.log("Table is empty, trying to fetch columns via RPC or introspection is harder here.");
            // Try to select specific columns to see if they exist
            const columns = ['ownership_name', 'ownership_value', 'ssl_name', 'ssl_value'];
            for (const col of columns) {
                const { error: colError } = await supabase.from('custom_domains').select(col).limit(1);
                if (colError) {
                    console.log(`❌ Column '${col}' check failed:`, colError.message);
                } else {
                    console.log(`✅ Column '${col}' exists.`);
                }
            }
        }
    }
}

checkSchema();
