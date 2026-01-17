import { useState, useEffect, useRef, useCallback } from "react";
import { X, Rewind, Pause, Play, FastForward, Trash2, Check } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getPlayableUrl } from "../../lib/audio";
import { Database } from "../../lib/database.types";

type Demo = Database['public']['Tables']['demos']['Row'];

interface ClipModalProps {
    isOpen: boolean;
    demo: Demo | null;
    onClose: () => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
    waveformCache: Map<string, AudioBuffer>;
}

export default function ClipModal({ isOpen, demo, onClose, showToast, waveformCache }: ClipModalProps) {
    const [clips, setClips] = useState<{ label: string; startTime: number }[]>([]);
    const [saving, setSaving] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [loadingWaveform, setLoadingWaveform] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const waveformRef = useRef<HTMLDivElement>(null);
    const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);



    useEffect(() => {
        if (demo && isOpen) {
            const initialClips = (demo as any).segments;
            setClips(Array.isArray(initialClips) ? initialClips : []);
        }
    }, [demo?.id, isOpen]);

    useEffect(() => {
        const fetchAudio = async () => {
            if (!demo || !isOpen) return;

            // Check Cache first
            if (waveformCache.has(demo.id)) {
                setAudioBuffer(waveformCache.get(demo.id)!);
                return;
            }

            setLoadingWaveform(true);
            try {
                const url = getPlayableUrl(demo.url);
                let response;
                try {
                    response = await fetch(url);
                    if (!response.ok) throw new Error();
                } catch (e) {
                    try {
                        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                        response = await fetch(proxyUrl);
                        if (!response.ok) throw new Error();
                    } catch (e2) {
                        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                        response = await fetch(proxyUrl);
                    }
                }

                if (!response || !response.ok) return;
                const arrayBuffer = await response.arrayBuffer();
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const buffer = await audioCtx.decodeAudioData(arrayBuffer);
                setAudioBuffer(buffer);
                waveformCache.set(demo.id, buffer);
            } catch (error) {
                console.error("Waveform error:", error);
            } finally {
                setLoadingWaveform(false);
            }
        };

        if (isOpen) fetchAudio();
        else {
            setAudioBuffer(null);
            setIsPlaying(false);
        }
    }, [demo?.id, isOpen, getPlayableUrl]);

    // Draw Waveform
    useEffect(() => {
        if (!audioBuffer || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * dpr;
        canvas.height = canvas.offsetHeight * dpr;
        ctx.scale(dpr, 1);

        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        const data = audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-primary').trim();
        ctx.strokeStyle = themeColor || '#6366f1';
        ctx.lineWidth = 1;

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.moveTo(i, (1 + min) * amp);
            ctx.lineTo(i, (1 + max) * amp);
        }
        ctx.stroke();
    }, [audioBuffer]);

    const addClipAtCurrentTime = useCallback(() => {
        if (audioRef.current) {
            const time = Math.round(audioRef.current.currentTime * 100) / 100;
            setClips(prev => {
                const newClips = [...prev, { label: `Clip ${prev.length + 1}`, startTime: time }];
                return [...newClips].sort((a, b) => a.startTime - b.startTime);
            });
        }
    }, [audioRef]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            // Don't trigger if user is typing in a TEXT input or textarea
            if (e.target instanceof HTMLTextAreaElement) return;
            if (e.target instanceof HTMLInputElement && (e.target.type === "text" || e.target.type === "number")) {
                return;
            }

            if (e.code === "Space") {
                e.preventDefault();
                if (audioRef.current) {
                    if (audioRef.current.paused) {
                        audioRef.current.play();
                        setIsPlaying(true);
                    } else {
                        audioRef.current.pause();
                        setIsPlaying(false);
                    }
                }
            }

            if (e.key === "Enter") {
                e.preventDefault();
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                    setCurrentTime(0);
                    setIsPlaying(false);
                }
            }

            if (e.key === "ArrowLeft") {
                e.preventDefault();
                if (audioRef.current) {
                    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 0.5);
                    setCurrentTime(audioRef.current.currentTime);
                }
            }

            if (e.key === "ArrowRight") {
                e.preventDefault();
                if (audioRef.current) {
                    audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 0.5);
                    setCurrentTime(audioRef.current.currentTime);
                }
            }

            if (e.key.toLowerCase() === "a") {
                e.preventDefault();
                addClipAtCurrentTime();
            }

            if (e.key === "Escape") {
                if (editingIdx !== null) {
                    setEditingIdx(null);
                } else {
                    onClose();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, duration, addClipAtCurrentTime, editingIdx]);

    if (!isOpen || !demo) return null;



    const handleWaveformMouseMove = (e: React.MouseEvent) => {
        if (draggingIdx === null || !waveformRef.current || !duration) return;

        const rect = waveformRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const newTime = Math.round((x / rect.width) * duration * 100) / 100;

        const newClips = [...clips];
        newClips[draggingIdx].startTime = newTime;
        setClips(newClips);
    };

    const handleWaveformMouseUp = () => {
        if (draggingIdx !== null) {
            const newClips = [...clips];
            newClips.sort((a, b) => a.startTime - b.startTime);
            setClips(newClips);
            setDraggingIdx(null);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await (supabase.from('demos') as any).update({
                segments: clips
            }).eq('id', demo.id);

            if (error) throw error;
            showToast("Clips saved successfully!");
            onClose();
        } catch (error: any) {
            console.error("Failed to save clips:", error);
            alert(`Failed to save clips: ${error.message || error.error_description || JSON.stringify(error)}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-6xl w-full border border-slate-100 flex flex-col max-h-[90vh] scale-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-800">{demo.name} Clips</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                </div>

                {/* Manual Clipper Control */}
                <div className="bg-slate-50 rounded-2xl p-6 mb-6 text-slate-900 shadow-inner border border-slate-200">
                    <audio
                        ref={audioRef}
                        src={getPlayableUrl(demo.url)}
                        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
                        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
                    />

                    <div className="flex items-center justify-between mb-4">
                        <div className="text-xs font-mono text-slate-500">
                            {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}.<span className="text-[10px] opacity-70">{(currentTime % 1).toFixed(2).split('.')[1]}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={() => audioRef.current && (audioRef.current.currentTime -= 5)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors"><Rewind size={20} /></button>
                            <button
                                onClick={() => {
                                    if (audioRef.current?.paused) { audioRef.current.play(); setIsPlaying(true); }
                                    else { audioRef.current?.pause(); setIsPlaying(false); }
                                }}
                                className="w-12 h-12 bg-[var(--theme-primary)] rounded-full flex items-center justify-center text-white hover:scale-105 transition-all shadow-lg shadow-[var(--theme-primary)]/40"
                            >
                                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                            </button>
                            <button onClick={() => audioRef.current && (audioRef.current.currentTime += 5)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors"><FastForward size={20} /></button>
                        </div>
                        <div className="text-xs font-mono text-slate-500">
                            {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                        </div>
                    </div>

                    <div
                        ref={waveformRef}
                        className="relative h-32 my-10 group select-none"
                        onMouseMove={handleWaveformMouseMove}
                        onMouseUp={handleWaveformMouseUp}
                        onMouseLeave={handleWaveformMouseUp}
                    >
                        <style>{`
                            .admin-scrubber { z-index: 10; relative; }
                            .admin-scrubber::-webkit-slider-thumb {
                                appearance: none;
                                width: 4px;
                                height: 144px;
                                background: white;
                                border: 1px solid #EAB308;
                                border-radius: 2px;
                                cursor: ew-resize;
                                box-shadow: 0 0 15px rgba(234, 179, 8, 0.8), 0 0 5px rgba(0,0,0,0.5);
                                transition: all 0.1s;
                                margin-top: -8px;
                            }
                            .admin-scrubber::-moz-range-thumb {
                                width: 4px;
                                height: 144px;
                                background: white;
                                border: 1px solid #EAB308;
                                border-radius: 2px;
                                cursor: ew-resize;
                                box-shadow: 0 0 15px rgba(234, 179, 8, 0.8), 0 0 5px rgba(0,0,0,0.5);
                            }
                        `}</style>

                        {/* Visual Markers on Waveform */}
                        {(Array.isArray(clips) ? clips : []).map((clip, i) => {
                            const isTop = i % 2 === 0;
                            const isEditing = editingIdx === i;

                            return (
                                <div
                                    key={i}
                                    className={`absolute top-0 bottom-0 w-1.5 -ml-0.75 cursor-ew-resize z-20 group/marker transition-colors ${draggingIdx === i ? 'bg-yellow-400' : 'bg-[var(--theme-primary)]'}`}
                                    style={{ left: `${(clip.startTime / (duration || 1)) * 100}%` }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setDraggingIdx(i);
                                    }}
                                >
                                    {/* Handle Line */}
                                    <div className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ${draggingIdx === i ? 'bg-yellow-400' : 'bg-white/50'}`} />

                                    {/* Interactive Segment Label */}
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingIdx(i);
                                            if (audioRef.current) audioRef.current.currentTime = clip.startTime;
                                        }}
                                        className={`absolute left-1/2 -translate-x-1/2 bg-[var(--theme-primary)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap z-30 cursor-pointer border border-white/20 hover:scale-110 transition-transform ${isTop ? 'bottom-full mb-3' : 'top-full mt-3'} ${isEditing ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : ''}`}
                                    >
                                        {clip.label}
                                    </div>

                                    {/* Inline Popup Editor */}
                                    {isEditing && (
                                        <div
                                            className={`absolute left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl p-4 w-56 z-50 border border-slate-100 flex flex-col gap-3 animate-in zoom-in-95 duration-150 ${isTop ? 'bottom-full mb-12' : 'top-full mt-12'}`}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Edit Clip</span>
                                                <button
                                                    onClick={() => {
                                                        setClips(clips.filter((_, idx) => idx !== i));
                                                        setEditingIdx(null);
                                                    }}
                                                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                    title="Remove Clip"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Label</label>
                                                <input
                                                    autoFocus
                                                    value={clip.label}
                                                    onChange={(e) => {
                                                        const next = [...clips];
                                                        next[i].label = e.target.value;
                                                        setClips(next);
                                                    }}
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs font-medium focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none text-slate-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Start Time (sec)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={clip.startTime}
                                                    onChange={(e) => {
                                                        const next = [...clips];
                                                        next[i].startTime = parseFloat(e.target.value);
                                                        next.sort((a, b) => a.startTime - b.startTime);
                                                        setClips(next);
                                                        // Keep index synced after sort
                                                        const newIdx = next.findIndex(s => s === clip);
                                                        if (newIdx !== -1) setEditingIdx(newIdx);
                                                    }}
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs font-mono focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none text-slate-800"
                                                />
                                            </div>
                                            <button
                                                onClick={() => setEditingIdx(null)}
                                                className="mt-2 w-full py-2.5 flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] font-bold uppercase transition-all active:scale-95 shadow-lg shadow-black/10"
                                            >
                                                <Check size={14} /> Done
                                            </button>
                                            {/* Connector arrow */}
                                            <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-slate-100 rotate-[45deg] ${isTop ? 'bottom-[-9px]' : 'top-[-9px] rotate-[225deg]'}`} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Waveform Canvas & Scrubber Background */}
                        <div className="absolute inset-0 rounded-xl overflow-hidden bg-slate-200/50 border border-slate-300/50 pointer-events-none">
                            {loadingWaveform && (
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">
                                    Loading Waveform...
                                </div>
                            )}
                            <canvas ref={canvasRef} className="w-full h-full opacity-60" />
                        </div>

                        {/* Current Time Indicator Scrubber */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div
                                className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
                                style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                        <p>Tips: Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-700 mx-1">Space</kbd> to Play/Pause, arrows to seek</p>
                        <button
                            onClick={addClipAtCurrentTime}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-lg active:scale-95 font-bold"
                        >
                            <span className="text-lg leading-none mb-0.5">+</span> Add Clip Here
                        </button>
                    </div>
                </div>

                <div className="mt-auto flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <button onClick={onClose} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors text-sm">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 bg-[var(--theme-primary)] hover:opacity-90 text-white font-bold rounded-xl shadow-lg shadow-[var(--theme-primary)]/30 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <>Saving...</>
                        ) : (
                            <>Save All Changes</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
