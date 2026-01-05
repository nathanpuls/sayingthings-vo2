import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { motion } from "framer-motion";
import { demos as staticDemos } from "../content/demos";
import { supabase } from "../lib/supabase";

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
    onTrackSelect
}) {
    const { uid } = useParams();
    const [localTracks, setLocalTracks] = useState(staticDemos);
    const [localIndex, setLocalIndex] = useState(0);
    const [localIsPlaying, setLocalIsPlaying] = useState(false);

    // Use props if provided (Controlled mode), otherwise local state (Uncontrolled mode)
    const isControlled = propTracks !== undefined;

    const tracks = isControlled ? propTracks : localTracks;
    const currentTrackIndex = isControlled ? propIndex : localIndex;
    const isPlaying = isControlled ? propIsPlaying : localIsPlaying;
    const currentTime = isControlled ? propCurrentTime : 0; // Local implementation below needs fix if we want full local support without props, but for now we focus on the transition.
    const duration = isControlled ? propDuration : 0;

    // For local audio handling (legacy support if not controlled)
    const audioRef = useRef(null);
    const [localCurrentTime, setLocalCurrentTime] = useState(0);
    const [localDuration, setLocalDuration] = useState(0);

    const effectiveCurrentTime = isControlled ? propCurrentTime : localCurrentTime;
    const effectiveDuration = isControlled ? propDuration : localDuration;

    useEffect(() => {
        if (isControlled || !uid) return;

        const fetchTracks = async () => {
            const { data, error } = await supabase.from('demos').select('*').eq('user_id', uid).order('order', { ascending: true });
            if (error) {
                console.error("Error fetching demos:", error);
            } else if (data && data.length > 0) {
                setLocalTracks(data); // Supabase returns array of objects, similar structure to what we expect
            }
        };

        fetchTracks();
    }, [uid, isControlled]);

    // Utility to convert various link types (like Google Drive) to direct play links
    const getPlayableUrl = (url) => {
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

    // If not controlled, we need these. If controlled, they are ignored or passed in.
    // const [isPlaying, setIsPlaying] = useState(false); -> handled above

    // Legacy local logic
    const currentTrack = tracks[currentTrackIndex] || {}; // Safety check

    useEffect(() => {
        if (isControlled) return;
        if (localIsPlaying) {
            audioRef.current.play().catch(() => setLocalIsPlaying(false));
        } else {
            audioRef.current.pause();
        }
    }, [localIsPlaying, currentTrackIndex, isControlled]);

    const togglePlay = () => {
        if (isControlled) onPlayPause();
        else setLocalIsPlaying(!localIsPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setLocalCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        setLocalDuration(audioRef.current.duration);
        if (localIsPlaying) audioRef.current.play().catch(() => setLocalIsPlaying(false));
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

    const handleSeek = (e) => {
        const time = parseFloat(e.target.value);
        if (isControlled && onSeek) {
            onSeek(time);
        } else {
            audioRef.current.currentTime = time;
            setLocalCurrentTime(time);
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
                        {currentTrack.name}
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">Nathan Puls Voice Over</p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 w-8 text-right">{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary)]"
                    />
                    <span className="text-[10px] text-slate-500 w-8">{formatTime(duration)}</span>
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

function formatTime(seconds) {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
}
