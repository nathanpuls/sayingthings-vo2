import { supabase } from './supabase';

/**
 * Get the user ID based on the current domain
 * @returns {Promise<string|null>} User ID or null
 */
export async function getUserIdFromDomain() {
    const hostname = window.location.hostname;

    // List of your main domains (add your production domain here)
    const mainDomains = [
        'localhost',
        'sayingthings.com',
        'www.sayingthings.com',
        // Add your Vercel/Netlify domains here
    ];

    // If on main domain, return null (will use URL-based routing)
    if (mainDomains.some(domain => hostname.includes(domain))) {
        return null;
    }

    // Check if this is a custom domain
    try {
        const { data, error } = await supabase
            .from('custom_domains')
            .select('user_id')
            .eq('domain', hostname)
            .eq('verified', true)
            .single();

        if (error) {
            console.error('Error fetching custom domain:', error);
            return null;
        }

        return data?.user_id || null;
    } catch (err) {
        console.error('Error in getUserIdFromDomain:', err);
        return null;
    }
}

/**
 * Check if the current domain is a custom domain
 * @returns {boolean}
 */
export function isCustomDomain() {
    const hostname = window.location.hostname;
    const mainDomains = [
        'localhost',
        'built.at',
        'app.sayingthings.com',
    ];

    return !mainDomains.some(domain => hostname.includes(domain));
}

/**
 * Generate a verification token for domain ownership
 * @returns {string}
 */
export function generateVerificationToken() {
    return `built-verify-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Verify domain ownership via DNS TXT record
 * @param {string} domain - Domain to verify
 * @param {string} token - Verification token
 * @returns {Promise<boolean>}
 */
export async function verifyDomainOwnership(domain, token) {
    try {
        // Check using Cloudflare DNS over HTTPS (works in browser!)
        const checkDns = async (provider) => {
            const hostname = `_built-verify.${domain}`;
            const url = `${provider}?name=${hostname}&type=TXT`;

            const res = await fetch(url, {
                headers: { 'Accept': 'application/dns-json' }
            });
            const data = await res.json();

            if (data.Answer) {
                // Check if any TXT record contains the token
                // Records are usually quoted like "token-value"
                return data.Answer.some(record => record.data.includes(token));
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

/**
 * Add a custom domain for the current user
 * @param {string} domain - Domain to add
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
export async function addCustomDomain(domain) {
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        // Clean the domain
        const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');

        // Generate verification token
        const verificationToken = generateVerificationToken();

        const { data, error } = await supabase
            .from('custom_domains')
            .insert([{
                user_id: user.id,
                domain: cleanDomain,
                verification_token: verificationToken,
                verified: false
            }])
            .select()
            .single();

        if (error) {
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        return { success: false, error: err };
    }
}

/**
 * Remove a custom domain
 * @param {string} domainId - Domain ID to remove
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export async function removeCustomDomain(domainId) {
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

/**
 * Get all custom domains for the current user
 * @returns {Promise<Array>}
 */
export async function getUserCustomDomains() {
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
