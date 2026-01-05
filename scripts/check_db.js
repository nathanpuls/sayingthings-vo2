import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkDb() {
    console.log("Checking Supabase connection...");

    // Check messages table
    const { data: mData, error: mError } = await supabase.from('messages').select('id').limit(1);
    if (mError) {
        console.log("❌ messages table check failed:", mError.message);
    } else {
        console.log("✅ messages table exists.");
    }

    // Check site_settings column
    const { data: sData, error: sError } = await supabase.from('site_settings').select('web3_forms_key').limit(1);
    if (sError) {
        console.log("❌ site_settings column check failed:", sError.message);
    } else {
        console.log("✅ web3_forms_key column exists.");
    }
}

checkDb();
