import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { resolveUser } from '../lib/users';
import { normalizeClips } from '../lib/audio';
import VoiceClipsPlayer from '../components/VoiceClipsPlayer';
import { Mic } from 'lucide-react';



interface SiteSettings {
    theme_color: string;
    site_name: string;
    username?: string;
}

export default function VoiceClipsEmbed() {
    const { uid } = useParams<{ uid: string }>();
    const [tracks, setTracks] = useState<any[]>([]);
    const [settings, setSettings] = useState<SiteSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            if (!uid) {
                setLoading(false);
                return;
            }

            // Resolve username or UUID to user_id
            const resolvedId = await resolveUser(uid);
            if (!resolvedId) {
                setLoading(false);
                return;
            }

            // Fetch demos (tracks)
            const { data: demosData } = await supabase
                .from('demos')
                .select('*')
                .eq('user_id', resolvedId)
                .order('order', { ascending: true });

            // Fetch site settings
            const { data: settingsData } = await supabase
                .from('site_settings')
                .select('theme_color, site_name, username')
                .eq('user_id', resolvedId)
                .single();

            if (settingsData) {
                setSettings(settingsData);
            }

            if (demosData) {
                // Transform demos into tracks with clips using shared helper
                const transformedTracks = demosData.map((demo: any) => ({
                    id: demo.id,
                    name: demo.name,
                    url: demo.url,
                    clips: normalizeClips(demo.segments) || [{
                        name: demo.name,
                        start: 0,
                        end: 999999 // Play until end
                    }]
                }));

                console.log('Transformed tracks:', transformedTracks);
                setTracks(transformedTracks);
            }

            setLoading(false);
        };

        init();
    }, [uid]);

    if (loading) {
        return (
            <div className="min-h-screen bg-transparent p-6 flex flex-col items-center">
                <div className="w-full max-w-[380px] mx-auto flex items-center justify-center mt-32">
                    <div
                        className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: settings?.theme_color || '#6366f1', borderTopColor: 'transparent' }}
                    />
                </div>
            </div>
        );
    }

    if (tracks.length === 0) {
        return (
            <div className="min-h-screen bg-transparent p-6 flex items-center justify-center">
                <div className="w-full max-w-[380px] mx-auto flex items-center justify-center h-96">
                    <p className="text-slate-400">No tracks available</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent p-6">
            <VoiceClipsPlayer
                tracks={tracks}
                themeColor={settings?.theme_color || '#6366f1'}
                shareConfig={{
                    publicUrl: `${window.location.origin}/u/${settings?.username || uid}`,
                    embedUrl: window.location.href
                }}
            />
        </div>
    );
}
