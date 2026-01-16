import { useState, useEffect } from "react";
import { Mail, Phone, MessageSquare, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import FadeInSection from "../FadeInSection";
import SectionHeader from "./SectionHeader";

interface ContactSectionProps {
    siteContent: any;
    uid: string | undefined;
    basePadding?: string;
}

export default function ContactSection({ siteContent, uid, basePadding = "py-6 md:py-10" }: ContactSectionProps) {
    const [contactForm, setContactForm] = useState({ name: "", email: "", message: "", botField: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);
    const [captcha, setCaptcha] = useState({ a: 0, b: 0, userValue: "" });

    const generateCaptcha = () => {
        setCaptcha({
            a: Math.floor(Math.random() * 10) + 1,
            b: Math.floor(Math.random() * 10) + 1,
            userValue: ""
        });
    };

    useEffect(() => {
        generateCaptcha();
    }, []);

    const handleContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uid) return;

        // Bot detection
        if (contactForm.botField) {
            setSubmitStatus('success'); // Fake success for bots
            return;
        }

        // Captcha validation
        if (parseInt(captcha.userValue) !== captcha.a + captcha.b) {
            setSubmitStatus('error');
            setTimeout(() => setSubmitStatus(null), 3000);
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            // 1. Save to Supabase (Database backup)
            try {
                const { error } = await (supabase.from('messages') as any).insert([{
                    user_id: uid,
                    name: contactForm.name,
                    email: contactForm.email,
                    message: contactForm.message
                }]);
                if (error) console.warn("Database log failed (table might be missing), but continuing with email...");
            } catch (dbErr) {
                console.warn("Database log failed:", dbErr);
            }

            // 2. Forward to Email (Web3Forms)
            if (siteContent.web3FormsKey) {
                const response = await fetch("https://api.web3forms.com/submit", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        access_key: siteContent.web3FormsKey,
                        from_name: contactForm.name,
                        subject: `New Message from ${contactForm.name}`,
                        name: contactForm.name,
                        email: contactForm.email,
                        message: contactForm.message,
                    }),
                });

                if (!response.ok) throw new Error("Email provider error");
            }

            setSubmitStatus('success');
            setContactForm({ name: "", email: "", message: "", botField: "" });
            generateCaptcha();
        } catch (err) {
            console.error("Failed to send message:", err);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setSubmitStatus(null), 5000);
        }
    };

    return (
        <section key="contact" id="contact" className={`${basePadding} px-6 scroll-mt-28`}>
            <FadeInSection className="container mx-auto max-w-4xl px-4">
                <SectionHeader title="Contact" icon={<Mail />} />

                {siteContent.showCartoon && siteContent.profileCartoon && (
                    <div className="flex justify-center -mt-6 mb-8">
                        <img src={siteContent.profileCartoon} className="w-24 h-24 object-contain bounce-subtle" alt="Avatar" />
                    </div>
                )}

                <div className="flex flex-col gap-12 items-center">
                    {/* Basic Contact Info Area */}
                    <div className="flex flex-col items-center gap-4 w-full">
                        <a
                            href={`mailto:${siteContent.contactEmail}`}
                            className="flex items-center gap-4 px-8 py-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-[var(--theme-primary)]/30 transition-all group w-full max-w-2xl"
                        >
                            <div className="p-3 bg-slate-50 rounded-xl group-hover:text-[var(--theme-primary)] transition-colors">
                                <Mail className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</span>
                                <span className="font-semibold text-slate-800 text-xs sm:text-sm md:text-lg whitespace-nowrap">{siteContent.contactEmail}</span>
                            </div>
                        </a>

                        {siteContent.contactPhone && (
                            <a
                                href={`tel:${siteContent.contactPhone.replace(/[^0-9+]/g, '')}`}
                                className="flex items-center gap-4 px-8 py-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-[var(--theme-primary)]/30 transition-all group w-full max-w-2xl"
                            >
                                <div className="p-3 bg-slate-50 rounded-xl group-hover:text-[var(--theme-primary)] transition-colors">
                                    <Phone className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</span>
                                    <span className="font-semibold text-slate-800 text-xs sm:text-sm md:text-lg whitespace-nowrap">{siteContent.contactPhone}</span>
                                </div>
                            </a>
                        )}
                    </div>

                    {/* Contact Form Area */}
                    {siteContent.showContactForm && (
                        <div className="w-full max-w-2xl glass-card p-8 md:p-12 rounded-3xl relative overflow-hidden bg-white border border-slate-100 shadow-xl shadow-slate-200/50">

                            <div className="relative z-10 text-center mb-10">
                                <h3 className="text-3xl font-bold mb-3 text-slate-900">Send a Message</h3>
                            </div>

                            <form onSubmit={handleContactSubmit} className="relative z-10 space-y-4">
                                {/* Honeypot field */}
                                <input
                                    type="text"
                                    name="botField"
                                    style={{ display: 'none' }}
                                    tabIndex={-1}
                                    autoComplete="off"
                                    value={contactForm.botField}
                                    onChange={e => setContactForm({ ...contactForm, botField: e.target.value })}
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Your Name</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="John Doe"
                                            value={contactForm.name}
                                            onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[var(--theme-primary)]/10 focus:border-[var(--theme-primary)] transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                        <input
                                            required
                                            type="email"
                                            placeholder="john@example.com"
                                            value={contactForm.email}
                                            onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[var(--theme-primary)]/10 focus:border-[var(--theme-primary)] transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Message</label>
                                    <textarea
                                        required
                                        rows={4}
                                        placeholder="Tell me about your project..."
                                        value={contactForm.message}
                                        onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[var(--theme-primary)]/10 focus:border-[var(--theme-primary)] transition-all resize-none"
                                    ></textarea>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Human Verification</label>
                                    <div className="flex items-center gap-4">
                                        <div className="px-5 py-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-700 select-none">
                                            {captcha.a} + {captcha.b} =
                                        </div>
                                        <input
                                            required
                                            type="number"
                                            placeholder="?"
                                            value={captcha.userValue}
                                            onChange={e => setCaptcha({ ...captcha, userValue: e.target.value })}
                                            className="w-24 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-[var(--theme-primary)]/10 focus:border-[var(--theme-primary)] transition-all"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-[var(--theme-primary)] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[var(--theme-primary)]/25 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>Send Message <MessageSquare size={18} /></>
                                    )}
                                </button>

                                <AnimatePresence>
                                    {submitStatus === 'success' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className="p-4 bg-green-50 text-green-700 rounded-2xl border border-green-100 text-sm font-medium flex items-center gap-2"
                                        >
                                            <Check size={18} /> Message sent successfully!
                                        </motion.div>
                                    )}
                                    {submitStatus === 'error' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-sm font-medium flex items-center gap-2"
                                        >
                                            <X size={18} /> Failed to send message.
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </form>
                        </div>
                    )}
                </div>
            </FadeInSection>
        </section>
    );
}
