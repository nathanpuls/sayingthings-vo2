import { Sparkles, ChevronRight, LogIn, Zap, Layout, Globe } from "lucide-react";
import FadeInSection from "../FadeInSection";

interface LandingProps {
    handleLogin: () => void;
    currentUser: any;
    isScrolled: boolean;
}

export default function Landing({ handleLogin, currentUser, isScrolled }: LandingProps) {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
            {/* Navbar */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-white/80 backdrop-blur-md shadow-sm py-4 border-b border-slate-200" : "bg-transparent py-6"}`}>
                <div className="container mx-auto px-6 flex justify-between items-center">
                    <div className="flex items-center gap-2 group">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                            <Sparkles size={24} fill="currentColor" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-slate-900">Studio</span>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Auth buttons removed per request */}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-40 pb-20 px-6 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-50/50 rounded-full blur-3xl -z-10" />
                <FadeInSection className="container mx-auto text-center max-w-4xl">
                    <h1 className="text-6xl md:text-8xl font-black text-slate-900 mb-8 tracking-tighter leading-[0.9]">
                        The Portfolio Platform <br />
                        <span className="text-indigo-600">for Voice Actors.</span>
                    </h1>
                    <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed">
                        A simple, dedicated website builder designed specifically for voice talent. Manage your demos, videos, and credits in one place.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => currentUser ? window.location.href = '/admin' : handleLogin()}
                            className="w-full sm:w-auto px-10 py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 hover:-translate-y-1 flex items-center justify-center gap-3"
                        >
                            Enter Studio <ChevronRight size={22} />
                        </button>
                    </div>
                </FadeInSection>
            </section>




        </div>
    );
}
