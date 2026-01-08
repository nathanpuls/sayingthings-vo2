// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Authenticate user
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            return new Response("Unauthorized", { status: 401, headers: corsHeaders })
        }

        const { domain } = await req.json()
        if (!domain) {
            return new Response("Missing domain", { status: 400, headers: corsHeaders })
        }

        // 2. Call Cloudflare API to add Custom Hostname
        const cfToken = Deno.env.get('CLOUDFLARE_API_TOKEN')
        const cfZoneId = Deno.env.get('CLOUDFLARE_ZONE_ID')

        const isMisconfigured = !cfToken || !cfZoneId ||
            cfToken === 'your_real_token' || cfZoneId === 'your_real_zone_id' ||
            cfToken === 'your_token_here' || cfZoneId === 'your_zone_id_here';

        if (isMisconfigured) {
            // Predictable mock token based on domain so it doesn't change every re-add
            const mockToken = `built-verify-${domain.split('.').join('-')}`;
            const { error: dbError } = await supabaseClient
                .from('custom_domains')
                .insert({
                    user_id: user.id,
                    domain: domain,
                    verification_token: mockToken,
                    ownership_type: 'txt',
                    ownership_name: `_cf-custom-hostname.${domain}`,
                    ownership_value: mockToken,
                    verified: false
                })

            if (dbError) throw dbError

            return new Response(JSON.stringify({
                success: true,
                verification_token: mockToken,
                message: "Mock Mode"
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // Real Cloudflare Implementation
        console.log(`Checking Cloudflare for domain: ${domain} (Zone: ${cfZoneId})`);

        // 2a. Check if hostname already exists
        let checkCfData;
        try {
            const checkCfResponse = await fetch(
                `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames?hostname=${domain}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${cfToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            )
            checkCfData = await checkCfResponse.json()
            console.log("Cloudflare GET Search Response:", JSON.stringify(checkCfData, null, 2));
        } catch (fetchErr) {
            console.error("Cloudflare GET Fetch Error:", fetchErr);
            throw new Error(`Failed to contact Cloudflare: ${fetchErr.message}`);
        }

        let hostnameResult = null;

        if (checkCfData && checkCfData.success && Array.isArray(checkCfData.result) && checkCfData.result.length > 0) {
            // Already exists, use this one
            hostnameResult = checkCfData.result[0];
            console.log("Found existing hostname record");
        } else {
            console.log("Hostname not found in search or search failed, attempting to create...");
            // Not found, create it
            const cfResponse = await fetch(
                `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${cfToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        hostname: domain,
                        ssl: {
                            method: 'txt',
                            type: 'dv',
                        },
                    }),
                }
            )

            const cfData = await cfResponse.json()
            console.log("Cloudflare POST Response:", JSON.stringify(cfData, null, 2));

            if (!cfData || !cfData.success) {
                console.error("Cloudflare Error:", cfData?.errors)
                return new Response(JSON.stringify({ error: cfData?.errors?.[0]?.message || "Cloudflare Error" }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }
            hostnameResult = cfData.result;
        }

        console.log("Cloudflare Result:", JSON.stringify(hostnameResult, null, 2));

        if (!hostnameResult) {
            throw new Error("Cloudflare returned no result");
        }

        // Ownership verification
        const ownership = hostnameResult.ownership_verification || {};
        const ownershipType = ownership.type || 'txt';
        const ownershipName = ownership.name || `_cf-custom-hostname.${domain}`;
        const ownershipValue = ownership.value || '';

        // SSL verification
        const ssl = hostnameResult.ssl || {};
        const sslRecords = ssl.validation_records || [];
        const sslName = sslRecords[0]?.txt_name || '';
        const sslValue = sslRecords[0]?.txt_value || '';

        console.log("Final Records to Save:", { ownershipName, ownershipValue, sslName, sslValue });

        // 3. Upsert into Supabase
        console.log("Upserting domain record...");
        const { error: dbError } = await supabaseClient
            .from('custom_domains')
            .upsert({
                user_id: user.id,
                domain: domain,
                verification_token: ownershipValue,
                ownership_type: ownershipType,
                ownership_name: ownershipName,
                ownership_value: ownershipValue,
                ssl_name: sslName,
                ssl_value: sslValue,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'domain'
            })

        if (dbError) {
            console.error("Database Upsert Error:", dbError);
            throw dbError
        }

        return new Response(JSON.stringify({
            success: true,
            data: hostnameResult
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Global Catch Error:", error)
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack,
            details: error
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
