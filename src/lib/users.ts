import { supabase } from './supabase';

export async function resolveUser(idOrUsername: string): Promise<string | null> {
    // 1. Check if it's a valid UUID (User ID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idOrUsername)) {
        return idOrUsername;
    }

    // 2. Treat as username -> Lookup user_id from site_settings
    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('user_id')
            .eq('username', idOrUsername)
            .single();

        if (error || !data) {
            console.log('Username lookup failed:', error);
            return null;
        }

        return (data as any).user_id;

    } catch (err) {
        console.error('Error resolving user:', err);
        return null;
    }
}

export async function checkUsernameAvailability(username: string, currentUserId: string): Promise<boolean> {
    if (username.length < 3) return false;

    // Check if taken by ANYONE ELSE
    const { data, error } = await supabase
        .from('site_settings')
        .select('user_id')
        .eq('username', username)
        .neq('user_id', currentUserId) // It's available if it's OURS
        .maybeSingle();


    if (error) return false;
    return !data; // If no data, it's available
}

export async function getSingleTenantUser(): Promise<string | null> {
    try {
        console.log('Single Tenant: Fetching first user from DB...');
        const { data, error } = await supabase
            .from('site_settings')
            .select('user_id')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Single Tenant Error:', error);
            return null;
        }

        const userId = (data as any)?.user_id || null;
        console.log('Single Tenant: Found user ID:', userId);
        return userId;
    } catch (err) {
        console.error('Error in getSingleTenantUser:', err);
        return null;
    }
}
