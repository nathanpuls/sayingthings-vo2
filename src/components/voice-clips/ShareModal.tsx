import { useState } from 'react';
import { X, Check, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    themeColor: string;
    shareConfig?: {
        publicUrl: string;
        embedUrl: string;
    };
}

export default function ShareModal({ isOpen, onClose, themeColor, shareConfig }: ShareModalProps) {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        const handleSuccess = () => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(handleSuccess);
        } else {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            handleSuccess();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 z-50 bg-white/98 backdrop-blur-md p-6 flex flex-col justify-center border border-slate-200 rounded-2xl"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>

                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-slate-800">Share Player</h3>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium tracking-tight uppercase">Copy link or embed code</p>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                                    Public Link
                                </label>
                                <div className="group relative flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={shareConfig?.publicUrl || window.location.href}
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-500 outline-none focus:border-[var(--theme-color)] transition-colors font-medium"
                                        style={{ borderColor: copiedId === 'url' ? 'var(--theme-color)' : undefined }}
                                    />
                                    <button
                                        onClick={() => copyToClipboard(shareConfig?.publicUrl || window.location.href, 'url')}
                                        className={`w-12 rounded-xl transition-all flex items-center justify-center flex-shrink-0 ${copiedId === 'url' ? 'bg-green-500 text-white shadow-green-200' : 'bg-[var(--theme-color)] text-white hover:opacity-90 shadow-sm'} shadow-md`}
                                        title="Copy link"
                                        style={{ backgroundColor: copiedId === 'url' ? undefined : themeColor }}
                                    >
                                        {copiedId === 'url' ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                                    Embed Code
                                </label>
                                <div className="group relative flex gap-2">
                                    <textarea
                                        readOnly
                                        rows={2}
                                        value={`<iframe src="${shareConfig?.embedUrl || window.location.href}" width="100%" height="600" frameborder="0" allow="autoplay" style="border-radius: 1rem;"></iframe>`}
                                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] text-slate-500 outline-none resize-none font-mono leading-relaxed focus:border-[var(--theme-color)] transition-colors"
                                        style={{ borderColor: copiedId === 'embed' ? 'var(--theme-color)' : undefined }}
                                    />
                                    <button
                                        onClick={() => copyToClipboard(`<iframe src="${shareConfig?.embedUrl || window.location.href}" width="100%" height="600" frameborder="0" allow="autoplay" style="border-radius: 1rem;"></iframe>`, 'embed')}
                                        className={`w-12 rounded-xl transition-all flex items-center justify-center flex-shrink-0 self-stretch ${copiedId === 'embed' ? 'bg-green-500 text-white shadow-green-200' : 'bg-[var(--theme-color)] text-white hover:opacity-90 shadow-sm'} shadow-md`}
                                        title="Copy embed code"
                                        style={{ backgroundColor: copiedId === 'embed' ? undefined : themeColor }}
                                    >
                                        {copiedId === 'embed' ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-all shadow-lg active:scale-[0.98]"
                        >
                            Back to Clips
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
