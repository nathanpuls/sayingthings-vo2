import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { motion } from "framer-motion";

import { supabase } from "../lib/supabase";
import { Database } from "../lib/database.types";

type Demo = Database['public']['Tables']['demos']['Row'];

interface AudioPlayerProps {
    tracks?: Demo[];
    currentTrackIndex?: number;
    isPlaying?: boolean;
    onPlayPause?: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onSeek?: (time: number) => void;
    currentTime?: number;
    duration?: number;
    onTrackSelect?: (index: number) => void;
    ownerName?: string;
}

export default function AudioPlayer({
    tracks: propTracks,
    currentTrackIndex: propIndex,
    isPlaying: propIsPlaying,
    onPlayPause,
    onNext,
    onPrev,
    onSeek,
    currentTime: propCurrentTime,
    duration: propDuration,
    onTrackSelect,
    ownerName
}: AudioPlayerProps) {
    const { uid } = useParams();
    const [localTracks, setLocalTracks] = useState<Demo[]>([]);
    const [localIndex, setLocalIndex] = useState(0);
    const [localIsPlaying, setLocalIsPlaying] = useState(false);

    // Use props if provided (Controlled mode), otherwise local state (Uncontrolled mode)
    const isControlled = propTracks !== undefined;

    const tracks = (isControlled ? propTracks : localTracks) || [];
    const currentTrackIndex = (isControlled ? propIndex : localIndex) || 0;
    const isPlaying = isControlled ? propIsPlaying : localIsPlaying;
    const currentTime = (isControlled ? propCurrentTime : 0) || 0;
    const duration = (isControlled ? propDuration : 0) || 0;

    // For local audio handling (legacy support if not controlled)
    const audioRef = useRef<HTMLAudioElement>(null);
    const [localCurrentTime, setLocalCurrentTime] = useState(0);
    const [localDuration, setLocalDuration] = useState(0);

    const effectiveCurrentTime = (isControlled ? propCurrentTime : localCurrentTime) || 0;
    const effectiveDuration = (isControlled ? propDuration : localDuration) || 0;

    useEffect(() => {
        if (isControlled || !uid) return;

        const fetchTracks = async () => {
            const { data, error } = await supabase.from('demos').select('*').eq('user_id', uid).order('order', { ascending: true });
            if (error) {
                console.error("Error fetching demos:", error);
            } else if (data && data.length > 0) {
                setLocalTracks(data);
            }
        };

        fetchTracks();
    }, [uid, isControlled]);

    // Utility to convert various link types (like Google Drive) to direct play links
    const getPlayableUrl = (url: string) => {
        if (!url) return "";
        // 1. Google Drive Conversion
        const driveMatch = url.match(/\/file\/d\/([^\/]+)/) || url.match(/id=([^\&]+)/);
        if (driveMatch && (url.includes("drive.google.com") || url.includes("docs.google.com"))) {
            return `https://docs.google.com/uc?id=${driveMatch[1]}`;
        }
        // 2. DropBox Conversion
        if (url.includes("dropbox.com") && url.includes("dl=0")) {
            return url.replace("dl=0", "raw=1");
        }
        return url;
    };

    // Legacy local logic
    const currentTrack = tracks[currentTrackIndex] || {};

    useEffect(() => {
        if (isControlled) return;
        if (audioRef.current) {
            if (localIsPlaying) {
                audioRef.current.play().catch(() => setLocalIsPlaying(false));
            } else {
                audioRef.current.pause();
            }
        }
    }, [localIsPlaying, currentTrackIndex, isControlled]);

    const togglePlay = () => {
        if (isControlled && onPlayPause) onPlayPause();
        else setLocalIsPlaying(!localIsPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setLocalCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setLocalDuration(audioRef.current.duration);
            if (localIsPlaying) audioRef.current.play().catch(() => setLocalIsPlaying(false));
        }
    };

    const handleEnded = () => {
        if (isControlled && onNext) onNext();
        else nextTrack();
    };

    const nextTrack = () => {
        if (isControlled && onNext) onNext();
        else setLocalIndex((prev) => (prev + 1) % tracks.length);
    };

    const prevTrack = () => {
        if (isControlled && onPrev) onPrev();
        else setLocalIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (isControlled && onSeek) {
            onSeek(time);
        } else {
            if (audioRef.current) {
                audioRef.current.currentTime = time;
                setLocalCurrentTime(time);
            }
        }
    };

    return (
        <div className="w-full max-w-md mx-auto p-4 bg-white rounded-2xl border border-slate-200 shadow-xl">
            {!isControlled && (
                <audio
                    ref={audioRef}
                    src={getPlayableUrl(currentTrack.url)}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={handleEnded}
                />
            )}

            <div className="flex flex-col gap-4">
                <div className="text-center">
                    <h3 className="text-lg font-bold bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary)] bg-clip-text text-transparent truncate px-2">
                        {currentTrack.name || (tracks.length === 0 ? "Loading demos..." : "Unknown Track")}
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">{ownerName || "Voice Over Artist"}</p>

                    {/* Clips Display */}
                    {currentTrack.segments && (currentTrack.segments as any[]).length > 0 && (
                        <div className="flex flex-wrap justify-center gap-1.5 mt-3 px-2">
                            {((currentTrack.segments as any[]) || []).map((clip, idx) => {
                                const segments = (currentTrack.segments as any[]) || [];
                                const isActive = (currentTime || effectiveCurrentTime) >= clip.startTime &&
                                    (idx === segments.length - 1 ||
                                        (currentTime || effectiveCurrentTime) < segments[idx + 1].startTime);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            if (isControlled && onSeek) onSeek(clip.startTime);
                                            else if (audioRef.current) {
                                                audioRef.current.currentTime = clip.startTime;
                                                setLocalCurrentTime(clip.startTime);
                                                if (!localIsPlaying) {
                                                    setLocalIsPlaying(true);
                                                    audioRef.current.play();
                                                }
                                            }
                                        }}
                                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${isActive
                                            ? "bg-[var(--theme-primary)] text-white border-[var(--theme-primary)] shadow-sm"
                                            : "bg-slate-50 text-slate-500 border-slate-200 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]"
                                            }`}
                                    >
                                        {clip.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 w-8 text-right">{formatTime(currentTime || effectiveCurrentTime)}</span>
                    <input
                        type="range"
                        min="0"
                        max={(duration || effectiveDuration) || 0}
                        value={currentTime || effectiveCurrentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary)]"
                    />
                    <span className="text-[10px] text-slate-500 w-8">{formatTime(duration || effectiveDuration)}</span>
                </div>

                <div className="flex items-center justify-center gap-4">
                    <button onClick={prevTrack} className="p-1.5 text-slate-400 hover:text-[var(--theme-primary)] transition">
                        <SkipBack size={20} />
                    </button>

                    <button
                        onClick={togglePlay}
                        className={`p-2.5 bg-[var(--theme-primary)] hover:brightness-90 rounded-full text-white transition-all transform ${isPlaying ? "shadow-md shadow-slate-300 scale-105" : ""}`}
                    >
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                    </button>

                    <button onClick={nextTrack} className="p-1.5 text-slate-400 hover:text-[var(--theme-primary)] transition">
                        <SkipForward size={20} />
                    </button>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-1">
                    <div className="space-y-1">
                        {tracks.map((track, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    if (isControlled && onTrackSelect) {
                                        onTrackSelect(i);
                                    } else {
                                        setLocalIndex(i);
                                        setLocalIsPlaying(true);
                                    }
                                }}
                                className={`w-full flex items-center justify-between p-2 rounded-md text-sm transition-all ${currentTrackIndex === i && isPlaying
                                    ? "bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]"
                                    : "hover:bg-slate-50 text-slate-600 hover:text-[var(--theme-primary)]"
                                    }`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <span className="font-medium truncate text-xs sm:text-sm">{track.name}</span>
                                </div>
                                {currentTrackIndex === i && isPlaying && (
                                    <div className="flex gap-0.5 ml-2">
                                        {[1, 2, 3].map((bar) => (
                                            <motion.div
                                                key={bar}
                                                animate={{ height: [3, 10, 3] }}
                                                transition={{ duration: 0.5, repeat: Infinity, delay: bar * 0.1 }}
                                                className="w-0.5 bg-[var(--theme-primary)] rounded-full"
                                            />
                                        ))}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatTime(seconds: number | undefined) {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
}
