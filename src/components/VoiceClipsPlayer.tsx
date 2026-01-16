import { useState, useRef, useEffect } from 'react';
import { Play, Pause, ChevronDown } from 'lucide-react';
import ClipsList from './voice-clips/ClipsList';
import ShareModal from './voice-clips/ShareModal';

interface Clip {
    name: string;
    start: number;
    end: number;
}

interface Track {
    id: string;
    name: string;
    url: string;
    clips: Clip[];
}

interface VoiceClipsPlayerProps {
    tracks: Track[];
    themeColor?: string;
    shareConfig?: { // Optional config for share links
        publicUrl: string;
        embedUrl: string;
    };
}

export default function VoiceClipsPlayer({ tracks, themeColor = '#6366f1', shareConfig }: VoiceClipsPlayerProps) {
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(tracks.length > 0 ? tracks[0] : null);
    const [currentClipIndex, setCurrentClipIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    // Derived state for immediate rendering to prevent flash
    const rawActiveTrack = selectedTrack;

    // Ensure there is always at least one clip (the full track) so UI doesn't break
    const activeTrack = rawActiveTrack ? {
        ...rawActiveTrack,
        clips: (rawActiveTrack.clips && rawActiveTrack.clips.length > 0)
            ? rawActiveTrack.clips
            : [{ name: rawActiveTrack.name, start: 0, end: 999999 }]
    } : null;

    const audioRef = useRef<HTMLAudioElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };

        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

    // Auto-select track when tracks load
    useEffect(() => {
        if (!selectedTrack && tracks.length > 0) {
            setSelectedTrack(tracks[0]);
        }
    }, [tracks]);

    // Track first load to prevent autoplay
    const hasLoadedRef = useRef(false);

    // Load track when selected
    useEffect(() => {
        if (activeTrack && audioRef.current && activeTrack.clips.length > 0) {
            const audio = audioRef.current;

            // Avoid reloading if it's the same track ID and we are already setup
            // This handles the reference instability of props passed from parent
            const currentSrc = audio.getAttribute('data-track-id');
            if (currentSrc === activeTrack.id) {
                return;
            }

            console.log('Loading track:', activeTrack.name, 'URL:', activeTrack.url);
            audio.src = activeTrack.url;
            audio.setAttribute('data-track-id', activeTrack.id);

            // Auto-play behavior
            audio.onloadedmetadata = () => {
                const firstClip = activeTrack.clips[0];
                console.log('Audio loaded, starting clip:', firstClip.name, 'at', firstClip.start);
                setCurrentClipIndex(0);
                audio.currentTime = firstClip.start;

                // Only autoplay if it's NOT the first load of the component
                // OR if the user deliberately selected this track (we can assume selectedTrack implies intent if we set hasLoadedRef)

                if (hasLoadedRef.current) {
                    audio.play().then(() => {
                        console.log('Playback started');
                        setIsPlaying(true);
                    }).catch(err => {
                        console.log('Auto-play prevented:', err);
                    });
                } else {
                    // First load - do not play, just prep
                    hasLoadedRef.current = true;
                    setIsPlaying(false);
                }
            };
        }
    }, [activeTrack?.id]); // Only trigger when ID changes, not object reference

    // Spacebar to play/pause
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            // Only handle spacebar
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault(); // Prevent page scroll

                const audio = audioRef.current;
                if (!audio || !activeTrack || activeTrack.clips.length === 0) return;

                if (isPlaying) {
                    audio.pause();
                    setIsPlaying(false);
                } else {
                    // If no clip is selected, start from the first one
                    if (currentClipIndex === null) {
                        setCurrentClipIndex(0);
                        audio.currentTime = activeTrack.clips[0].start;
                    }
                    audio.play();
                    setIsPlaying(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isPlaying, currentClipIndex, activeTrack]);

    const playClip = (index: number) => {
        const audio = audioRef.current;
        if (!audio || !activeTrack) return;

        const clip = activeTrack.clips[index];

        // If clicking the currently playing clip, pause it
        if (currentClipIndex === index && isPlaying) {
            audio.pause();
            setIsPlaying(false);
            return;
        }

        // Play the clip
        setCurrentClipIndex(index);
        audio.currentTime = clip.start;
        audio.volume = 1; // Ensure volume is up

        console.log('Attempting to play clip:', clip.name, 'Time:', audio.currentTime, 'Volume:', audio.volume, 'Paused:', audio.paused);

        // Use a promise to ensure smooth transition
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('Playback started successfully');
                setIsPlaying(true);
            }).catch(error => {
                console.error('Playback error:', error);
            });
        }
    };

    // Smooth progress updates using requestAnimationFrame
    useEffect(() => {
        let animationFrameId: number;

        const updateProgress = () => {
            const audio = audioRef.current;
            if (audio && currentClipIndex !== null && activeTrack && isPlaying) {
                const clip = activeTrack.clips[currentClipIndex];
                setCurrentTime(audio.currentTime);

                // Auto-advance to next clip when current one ends
                // For clips with huge end times (999999), check if audio actually ended
                const effectiveEnd = clip.end > 10000 && audio.duration
                    ? audio.duration
                    : clip.end;

                if (audio.currentTime >= effectiveEnd - 0.2 || audio.ended) {
                    if (currentClipIndex < activeTrack.clips.length - 1) {
                        const nextClip = activeTrack.clips[currentClipIndex + 1];
                        setCurrentClipIndex(currentClipIndex + 1);
                        audio.currentTime = nextClip.start;
                    } else {
                        audio.pause();
                        setIsPlaying(false);
                        setCurrentClipIndex(null);
                        return;
                    }
                }
            }

            animationFrameId = requestAnimationFrame(updateProgress);
        };

        if (isPlaying) {
            animationFrameId = requestAnimationFrame(updateProgress);
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [isPlaying, currentClipIndex, activeTrack]);

    // Skeleton loading state if no tracks available yet
    if (tracks.length === 0) {
        return (
            <div className="relative w-full max-w-[380px] mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="p-4 space-y-3 animate-pulse">
                    {/* Fake Dropdown */}
                    <div className="h-[46px] bg-slate-100 rounded-xl w-full" />

                    {/* Fake Controls */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full" />
                        <div className="w-10 h-10 bg-slate-200 rounded-full" />
                        <div className="w-10 h-10 bg-slate-100 rounded-full" />
                    </div>

                    {/* Fake List */}
                    <div className="space-y-2 pt-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-10 bg-slate-50 rounded-lg w-full" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="relative w-full max-w-[380px] mx-auto bg-white rounded-2xl shadow-lg border border-slate-200"
            style={{ '--theme-color': themeColor } as React.CSSProperties}
        >
            <style>{`
                .voiceclips-clip-button:active,
                .voiceclips-clip-button:focus,
                .voiceclips-clip-button:focus-visible {
                    outline: none !important;
                    border-color: rgb(226 232 240) !important;
                }
            `}</style>
            <audio ref={audioRef} />

            <div className="p-4 space-y-3">
                {/* Track Selector Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-100 transition-colors"
                    >
                        <span className="font-semibold text-slate-900">
                            {activeTrack?.name || 'Select a track'}
                        </span>
                        <ChevronDown size={20} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {dropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
                            {tracks.map((track) => (
                                <button
                                    key={track.id}
                                    onClick={() => {
                                        setSelectedTrack(track);
                                        setDropdownOpen(false);
                                    }}
                                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${activeTrack?.id === track.id ? 'bg-[var(--theme-color)]/10 text-[var(--theme-color)] font-semibold' : 'text-slate-700'
                                        }`}
                                >
                                    {track.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Playback Controls */}
                {activeTrack && activeTrack.clips.length > 0 && (
                    <div className="flex items-center justify-start gap-3">
                        <button
                            onClick={() => {
                                if (currentClipIndex !== null && currentClipIndex > 0) {
                                    playClip(currentClipIndex - 1);
                                }
                            }}
                            disabled={currentClipIndex === null || currentClipIndex === 0}
                            className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                            </svg>
                        </button>

                        <button
                            onClick={() => {
                                if (currentClipIndex !== null) {
                                    playClip(currentClipIndex);
                                } else if (activeTrack.clips.length > 0) {
                                    playClip(0);
                                }
                            }}
                            className="w-10 h-10 rounded-full bg-[var(--theme-color)] text-white flex items-center justify-center hover:opacity-90 transition-all shadow-md"
                        >
                            {isPlaying ? (
                                <Pause size={18} fill="currentColor" />
                            ) : (
                                <Play size={18} fill="currentColor" className="ml-0.5" />
                            )}
                        </button>

                        <button
                            onClick={() => {
                                if (currentClipIndex !== null && activeTrack && currentClipIndex < activeTrack.clips.length - 1) {
                                    playClip(currentClipIndex + 1);
                                }
                            }}
                            disabled={currentClipIndex === null || (activeTrack && currentClipIndex === activeTrack.clips.length - 1)}
                            className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                            </svg>
                        </button>
                    </div>
                )}


                {/* Clips List */}
                {activeTrack && activeTrack.clips.length > 0 && (
                    <ClipsList
                        selectedTrack={activeTrack}
                        currentClipIndex={currentClipIndex}
                        isPlaying={isPlaying}
                        themeColor={themeColor}
                        audioRef={audioRef as React.RefObject<HTMLAudioElement>}
                        currentTime={currentTime}
                        setIsPlaying={setIsPlaying}
                        setCurrentClipIndex={setCurrentClipIndex}
                    />
                )}
            </div>

            {/* Share Modal */}
            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                themeColor={themeColor}
                shareConfig={shareConfig}
            />
        </div>
    );
}
