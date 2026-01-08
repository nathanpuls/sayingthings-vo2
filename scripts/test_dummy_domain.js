import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function testEdgeFunction() {
    console.log("Testing Edge Function with a dummy domain...");

    // Call the function without a token
    const { data, error } = await supabase.functions.invoke('add-domain', {
        body: { domain: 'test-debug-' + Date.now() + '.com' }
    });

    if (error) {
        console.error("❌ Function Error Status:", error.status);
        if (error.context) {
            const text = await error.context.text();
            console.log("Response Body:", text);
        }
    } else {
        console.log("✅ Function Success:", data);
    }
}

testEdgeFunction();
