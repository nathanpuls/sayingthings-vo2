import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function testEdgeFunction() {
    console.log("Testing Edge Function 'add-domain'...");

    // We need a session to call the function since it checks for user
    // This script might fail if RLS or auth is required (which it is)
    // But we can check the error message returned.

    const { data, error } = await supabase.functions.invoke('add-domain', {
        body: { domain: 'sayingthings.com' }
    });

    if (error) {
        console.error("❌ Function Error:", error);
        if (error.context) {
            const text = await error.context.text();
            console.log("Response Body:", text);
        }
    } else {
        console.log("✅ Function Success:", data);
    }
}

testEdgeFunction();
