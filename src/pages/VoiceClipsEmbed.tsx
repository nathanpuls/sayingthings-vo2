import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { resolveUser } from '../lib/users';
import VoiceClipsPlayer from '../components/VoiceClipsPlayer';
import { Mic } from 'lucide-react';



interface SiteSettings {
    theme_color: string;
    site_name: string;
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
                .select('theme_color, site_name')
                .eq('user_id', resolvedId)
                .single();

            if (settingsData) {
                setSettings(settingsData);
            }

            if (demosData) {
                // Transform demos into tracks with clips
                const transformedTracks = demosData.map((demo: any) => {
                    // Parse segments if it's a string, otherwise use as-is
                    let segments: any[] = [];

                    if (demo.segments) {
                        if (typeof demo.segments === 'string') {
                            try {
                                segments = JSON.parse(demo.segments);
                            } catch (e) {
                                console.error('Failed to parse segments:', e);
                            }
                        } else if (Array.isArray(demo.segments)) {
                            segments = demo.segments;
                        }
                    }

                    console.log('Track:', demo.name, 'Clips:', segments);

                    // Transform segments to clips with proper structure
                    let clips;

                    if (segments.length === 0) {
                        // If no clips, create one clip that plays the entire track
                        clips = [{
                            name: demo.name,
                            start: 0,
                            end: 999999 // Very large number to play until end
                        }];
                    } else {
                        clips = segments.map((seg: any, index: number) => {
                            const startTime = Number(seg.startTime) || 0;
                            // End time is the start of the next clip, or a large number for the last clip
                            const endTime = index < segments.length - 1
                                ? Number(segments[index + 1].startTime) || startTime + 10
                                : startTime + 300; // Default 5 minutes for last clip

                            return {
                                name: seg.label || seg.name || 'Untitled Clip',
                                start: startTime,
                                end: endTime
                            };
                        });
                    }

                    console.log('Track:', demo.name, 'Final clips:', clips);

                    return {
                        id: demo.id,
                        name: demo.name,
                        url: demo.url,
                        clips: clips
                    };
                });

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
                    <Mic size={48} className="text-indigo-600 animate-pulse" />
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
            />
        </div>
    );
}
