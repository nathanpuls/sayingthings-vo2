import { supabase } from './supabase';

export async function getUserIdFromDomain(): Promise<string | null> {
    const hostname = window.location.hostname;

    // List of your main domains (add your production domain here)
    const mainDomains = [
        'localhost',
        'built.at',
        'www.built.at',
    ];

    // If on main domain, return null (will use URL-based routing)
    if (mainDomains.includes(hostname)) {
        return null;
    }

    // Check if this is a custom domain
    try {
        const domainsToCheck = [hostname];
        if (hostname.startsWith('www.')) {
            domainsToCheck.push(hostname.replace('www.', ''));
        } else {
            domainsToCheck.push(`www.${hostname}`);
        }

        const { data, error } = await (supabase
            .from('custom_domains' as any) as any)
            .select('user_id, domain, verified')
            .in('domain', domainsToCheck)
            .eq('verified', true)
            .maybeSingle();

        console.log("🔍 DOMAIN DEBUG:", {
            hostname,
            checking: domainsToCheck,
            found: data,
            error
        });

        if (error) {
            console.error('Error fetching custom domain:', error);
            return null;
        }

        return (data as any)?.user_id || null;
    } catch (err) {
        console.error('Error in getUserIdFromDomain:', err);
        return null;
    }
}

export function isCustomDomain(): boolean {
    const hostname = window.location.hostname;
    const mainDomains = [
        'localhost',
        'built.at',
        'www.built.at',
    ];

    return !mainDomains.includes(hostname);
}

export function generateVerificationToken(): string {
    return `builtat-verify-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
}

export async function verifyDomainOwnership(domain: string, token: string, customName?: string): Promise<boolean> {
    try {
        // Check using Cloudflare DNS over HTTPS (works in browser!)
        const checkDns = async (provider: string) => {
            let hostname = customName || `_built-verify.${domain}`;

            // If the hostname doesn't contain the domain, append it
            // This handles cases where backend might store just the subdomain part
            if (hostname && !hostname.includes(domain)) {
                hostname = `${hostname}.${domain}`;
            }

            const url = `${provider}?name=${hostname}&type=TXT`;

            const res = await fetch(url, {
                headers: { 'Accept': 'application/dns-json' }
            });
            const data = await res.json();

            if (data.Answer) {
                // Check if any TXT record contains the token
                // Records are usually quoted like "token-value"
                return data.Answer.some((record: any) => record.data.includes(token));
            }
            return false;
        };

        // Try Cloudflare first
        let verified = await checkDns('https://cloudflare-dns.com/dns-query');

        // Backup: Google DNS
        if (!verified) {
            verified = await checkDns('https://dns.google/resolve');
        }

        return verified;
    } catch (err) {
        console.error('Error verifying domain:', err);
        return false;
    }
}

export async function addCustomDomain(domain: string): Promise<{ success: boolean; data?: any; error?: any }> {
    try {
        // Clean the domain
        const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');

        // Call the Edge Function to handle Cloudflare provisioning + DB insert
        const { data, error: _error } = await supabase.functions.invoke('add-domain', {
            body: { domain: cleanDomain }
        });

        console.log("Edge Function Response Data:", data);

        if (data && data.success === false) {
            return { success: false, error: data.error || "Failed to add domain" };
        }

        if (data && data.error) throw new Error(data.error);

        return { success: true, data };
    } catch (err: any) {
        console.error("Add domain error (FULL OBJECT):", err);

        let message = err.message || (typeof err === 'string' ? err : "An unknown error occurred");

        if (err.context && typeof err.context.clone === 'function') {
            try {
                // Clone the response first so we don't lock the stream
                const res = err.context.clone();
                const textBody = await res.text();
                // Log the raw text so we can see it in the console no matter what format it is
                console.error("Add domain error (RESPONSE TEXT):", textBody);

                try {
                    const jsonBody = JSON.parse(textBody);
                    if (jsonBody.error) message = jsonBody.error;
                    else if (jsonBody.message) message = jsonBody.message;
                } catch (parseErr) {
                    // content is not JSON, that's fine, we logged the text
                }
            } catch (readErr) {
                console.error("Could not read error body:", readErr);
            }
        }

        return { success: false, error: message };
    }
}

export async function removeCustomDomain(domainId: string): Promise<{ success: boolean; error?: any }> {
    try {
        const { error } = await supabase
            .from('custom_domains')
            .delete()
            .eq('id', domainId);

        if (error) {
            return { success: false, error };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err };
    }
}

export async function getUserCustomDomains(): Promise<any[]> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('custom_domains')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching custom domains:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Error in getUserCustomDomains:', err);
        return [];
    }
}

