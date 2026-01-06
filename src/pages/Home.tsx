import { useState, useEffect, useRef, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getUserIdFromDomain } from "../lib/domains";
import { applyFont } from "../lib/fonts";
import AudioPlayer from "../components/AudioPlayer";
import { Mic, Video, Users, MessageSquare, User, Mail, Phone, Menu, X, Play, Pause, Check, Settings, ChevronDown, LogIn, Sparkles, Zap, Globe, Layout, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import FadeInSection from "../components/FadeInSection";
import { Database } from "../lib/database.types";


// Types
type Demo = Database['public']['Tables']['demos']['Row'];
type VideoItem = Database['public']['Tables']['videos']['Row'];
type StudioGear = Database['public']['Tables']['studio_gear']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];
type Review = Database['public']['Tables']['reviews']['Row'];
type SiteSettings = Database['public']['Tables']['site_settings']['Row'];

interface SiteContent {
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutText: string;
  contactEmail: string;
  contactPhone: string;
  siteName: string;
  profileImage: string;
  profileCartoon: string;
  showCartoon: boolean;
  clientsGrayscale: boolean;
  themeColor: string;
  sectionOrder: string[];
  hiddenSections: string[];
  font: string;
  web3FormsKey: string;
  showContactForm: boolean;
}

export default function Home() {
  const { uid } = useParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [showLanding, setShowLanding] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  // Scroll State
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Contact Form State
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

  // Audio State
  const [demos, setDemos] = useState<Demo[]>([]);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [miniPlayerOpen, setMiniPlayerOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const miniPlayerRef = useRef<HTMLDivElement>(null);

  // Audio Handlers
  const currentAudioTrack = demos[currentAudioIndex];

  // Close mini player dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (miniPlayerRef.current && !miniPlayerRef.current.contains(event.target as Node)) {
        setMiniPlayerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [miniPlayerRef]);

  // Utility to convert various link types (like Google Drive) to direct play links
  const getPlayableUrl = (url: string) => {
    if (!url) return "";
    const driveMatch = url.match(/\/file\/d\/([^\/]+)/) || url.match(/id=([^\&]+)/);
    if (driveMatch && (url.includes("drive.google.com") || url.includes("docs.google.com"))) {
      return `https://docs.google.com/uc?id=${driveMatch[1]}`;
    }
    if (url.includes("dropbox.com") && url.includes("dl=0")) {
      return url.replace("dl=0", "raw=1");
    }
    return url;
  };

  useEffect(() => {
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.play().catch(e => {
          console.error("Play error:", e);
          setIsAudioPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isAudioPlaying, currentAudioIndex]);

  const toggleAudioPlay = () => setIsAudioPlaying(!isAudioPlaying);

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) setAudioCurrentTime(audioRef.current.currentTime);
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
      if (isAudioPlaying) audioRef.current.play().catch(() => setIsAudioPlaying(false));
    }
  };

  const handleAudioEnded = () => {
    setCurrentAudioIndex(prev => (prev + 1) % demos.length);
  };

  const handleAudioSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setAudioCurrentTime(time);
    }
  };

  const nextTrack = () => setCurrentAudioIndex(prev => (prev + 1) % demos.length);
  const prevTrack = () => setCurrentAudioIndex(prev => (prev - 1 + demos.length) % demos.length);

  // Firestore Data States
  const [studioGear, setStudioGear] = useState<StudioGear[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const videoRef = useRef<HTMLIFrameElement>(null);

  // Set initial active video when videos load
  useEffect(() => {
    if (videos.length > 0 && !activeVideo) {
      setActiveVideo(videos[0]);
      setIsPlayingVideo(false);
    }
  }, [videos]);

  const handleVideoToggle = (vid: VideoItem) => {
    // Stop audio when playing video
    setIsAudioPlaying(false);

    if (activeVideo?.id === vid.id) {
      // Toggle current video
      const action = isPlayingVideo ? 'pauseVideo' : 'playVideo';
      if (videoRef.current) {
        videoRef.current.contentWindow?.postMessage(JSON.stringify({
          event: 'command',
          func: action,
          args: []
        }), '*');
        setIsPlayingVideo(!isPlayingVideo);
      }
    } else {
      // Switch to new video - don't autoplay, let user click play
      setActiveVideo(vid);
      setIsPlayingVideo(false);
    }
  };

  const [siteContent, setSiteContent] = useState<SiteContent>({
    heroTitle: "",
    heroSubtitle: "",
    aboutTitle: "",
    aboutText: "",
    contactEmail: "",
    contactPhone: "",
    siteName: "",
    profileImage: "",
    profileCartoon: "",
    showCartoon: true,
    clientsGrayscale: false,
    themeColor: "#6366f1",
    sectionOrder: ["demos", "projects", "studio", "clients", "reviews", "about", "contact"],
    hiddenSections: [],
    font: "Outfit",
    web3FormsKey: "",
    showContactForm: true
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      setShowMiniPlayer(window.scrollY > 500); // Only show after scrolling past demos
    };
    window.addEventListener("scroll", handleScroll);

    const fetchData = async () => {
      // Also check if current viewer is logged in
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Check if we're on a custom domain first
      let userId: string | null | undefined = uid;

      if (!userId) {
        // Try to get user ID from custom domain
        userId = await getUserIdFromDomain();
      }

      // If still no user ID, show the landing page for 'Built'
      if (!userId) {
        setShowLanding(true);
        setLoading(false);
        return;
      }

      const fetchTable = async <T extends keyof Database['public']['Tables']>(table: T) => {
        const { data, error } = await supabase.from(table).select('*').eq('user_id' as any, userId! as any).order('order', { ascending: true });
        if (error) console.error(`Error fetching ${table}:`, error);
        return data || [];
      };

      // Fetch settings first (critical for initial render/background/colors)
      const { data: settingsData } = await supabase.from('site_settings').select('*').eq('user_id', userId).single();
      const settings = settingsData as SiteSettings | null;
      if (settings) {
        setSiteContent({
          heroTitle: settings.hero_title || "",
          heroSubtitle: settings.hero_subtitle || "",
          aboutTitle: settings.about_title || "",
          aboutText: settings.about_text || "",
          contactEmail: settings.contact_email || "",
          contactPhone: settings.contact_phone || "",
          siteName: settings.site_name || "",
          profileImage: settings.profile_image || "",
          profileCartoon: settings.profile_cartoon || "",
          showCartoon: settings.show_cartoon !== false,
          clientsGrayscale: !!settings.clients_grayscale,
          themeColor: settings.theme_color || "#6366f1",
          sectionOrder: (settings.section_order as any) || ["demos", "projects", "studio", "clients", "reviews", "about", "contact"],
          hiddenSections: (settings.hidden_sections as any) || [],
          font: settings.font || "Outfit",
          web3FormsKey: settings.web3_forms_key || "",
          showContactForm: settings.show_contact_form !== false
        });
        if (settings.font) applyFont(settings.font);
      }

      // Hide loader as soon as settings are in (so user sees the site structure)
      setLoading(false);

      // Fetch non-critical content in parallel
      Promise.all([
        fetchTable('demos'),
        fetchTable('studio_gear'),
        fetchTable('clients'),
        fetchTable('reviews'),
        fetchTable('videos')
      ]).then(([demosData, studioData, clientsData, reviewsData, videosData]) => {
        setDemos(demosData);
        setStudioGear(studioData);
        setClients(clientsData);
        setReviews(reviewsData);
        setVideos(videosData);
      });
    };

    fetchData();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [uid]);

  // Handle Hash Scrolling
  useEffect(() => {
    if (!loading) {
      const handleHashScroll = () => {
        const hash = window.location.hash;
        if (hash) {
          const id = hash.replace('#', '');
          const element = document.getElementById(id);
          if (element) {
            setTimeout(() => {
              element.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }
        }
      };

      // Handle initial load hash
      handleHashScroll();

      // Listen for hash changes
      window.addEventListener('hashchange', handleHashScroll);
      return () => window.removeEventListener('hashchange', handleHashScroll);
    }
  }, [loading]);

  // Update document title
  useEffect(() => {
    if (showLanding) {
      document.title = "Built.at";
    } else if (siteContent.siteName) {
      document.title = siteContent.siteName;
    }
  }, [showLanding, siteContent.siteName]);

  const navLinkDetails = {
    demos: "Demos",
    projects: "Projects",
    studio: "Studio",
    clients: "Clients",
    reviews: "Reviews",
    about: "About",
    contact: "Contact"
  };

  const navLinks = siteContent.sectionOrder
    .filter(id => !(siteContent.hiddenSections || []).includes(id))
    .map(id => ({
      name: navLinkDetails[id as keyof typeof navLinkDetails] || id.charAt(0).toUpperCase() + id.slice(1),
      href: `#${id}`
    }));

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/admin'
      }
    });
    if (error) console.error("Login failed:", error.message);
  };

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

  if (loading) return <div className="min-h-screen grid place-items-center bg-white"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;

  if (showLanding) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
        {/* Navbar */}
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-white/80 backdrop-blur-md shadow-sm py-4 border-b border-slate-200" : "bg-transparent py-6"}`}>
          <div className="container mx-auto px-6 flex justify-between items-center">
            <div className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                <Sparkles size={24} fill="currentColor" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">Built</span>
            </div>
            <div className="flex items-center gap-4">
              {currentUser ? (
                <a href="/admin" className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100">
                  Dashboard <ChevronRight size={18} />
                </a>
              ) : (
                <button onClick={handleLogin} className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition shadow-sm">
                  <LogIn size={18} /> Sign In
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative pt-40 pb-20 px-6 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-50/50 rounded-full blur-3xl -z-10" />
          <FadeInSection className="container mx-auto text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold mb-8 animate-bounce">
              <Zap size={16} fill="currentColor" /> Now in Open Beta
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-slate-900 mb-8 tracking-tighter leading-[0.9]">
              The Portfolio Platform <br />
              <span className="text-indigo-600">for Creatives.</span>
            </h1>
            <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed">
              Launch your professional portfolio in minutes with dynamic content, custom domains, and blazing fast performance. Designed by creatives, for creatives.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleLogin}
                className="w-full sm:w-auto px-10 py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 hover:-translate-y-1 flex items-center justify-center gap-3"
              >
                Get Started for Free <ChevronRight size={22} />
              </button>
              <button className="w-full sm:w-auto px-10 py-5 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all">
                View Showcase
              </button>
            </div>
          </FadeInSection>
        </section>

        {/* Features Grid */}
        <section className="py-20 px-6 bg-white">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-10 rounded-3xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 transition-all">
                <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Layout size={28} />
                </div>
                <h3 className="text-2xl font-bold mb-4">Dynamic CMS</h3>
                <p className="text-slate-500 leading-relaxed">
                  Easily manage your demos, projects, gallery, and reviews from a powerful admin dashboard. Changes reflect instantly.
                </p>
              </div>
              <div className="p-10 rounded-3xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 transition-all">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Globe size={28} />
                </div>
                <h3 className="text-2xl font-bold mb-4">Custom Domains</h3>
                <p className="text-slate-500 leading-relaxed">
                  Connect your own domain name with free SSL. Build your brand on a foundation that you truly own.
                </p>
              </div>
              <div className="p-10 rounded-3xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 transition-all">
                <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Zap size={28} />
                </div>
                <h3 className="text-2xl font-bold mb-4">Blazing Performance</h3>
                <p className="text-slate-500 leading-relaxed">
                  Optimized for speed and SEO. Your portfolio loads in milliseconds, ensuring you never miss an opportunity.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <section className="py-32 px-6 relative overflow-hidden text-center">
          <div className="absolute inset-0 bg-indigo-600 -z-10" />
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_white_0%,_transparent_70%)] opacity-10 -z-10" />
          <FadeInSection className="container mx-auto max-w-3xl">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tight">
              Ready to elevate <br /> your online presence?
            </h2>
            <button
              onClick={handleLogin}
              className="px-12 py-6 bg-white text-indigo-600 rounded-2xl font-black text-xl hover:bg-slate-50 transition-all shadow-2xl shadow-black/20 hover:-translate-y-1 flex items-center justify-center gap-3 mx-auto"
            >
              Start Building Now
            </button>
          </FadeInSection>
        </section>

        <footer className="py-12 bg-slate-900 text-slate-500 text-center">
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-center gap-2 mb-6 opacity-50">
              <Sparkles size={20} fill="currentColor" />
              <span className="text-xl font-bold tracking-tight text-white">Built</span>
            </div>
            <p className="text-sm">© {new Date().getFullYear()} Built Platform. All rights reserved.</p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <audio
        ref={audioRef}
        src={currentAudioTrack ? getPlayableUrl(currentAudioTrack.url) : ""}
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onEnded={handleAudioEnded}
      />
      <style>{`
        :root {
          --theme-primary: ${siteContent.themeColor || '#6366f1'};
        }
      `}</style>
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-white/80 backdrop-blur-md shadow-sm py-4 border-b border-slate-200" : "bg-transparent py-6"
          }`}
      >
        <div className="container mx-auto px-6 flex justify-between items-center relative">
          <div className="flex items-center gap-6">
            <a href="#" className="flex items-center gap-2 group z-10 relative">
              <span className="text-2xl font-semibold bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary)] bg-clip-text text-transparent group-hover:opacity-80 transition">
                {siteContent.siteName}
              </span>
            </a>


          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex gap-8 z-10 relative">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-[var(--theme-primary)] transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-slate-600 hover:text-indigo-600 z-10 relative"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-white border-b border-slate-200 overflow-hidden shadow-lg"
            >
              <div className="flex flex-col gap-4 p-6">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-lg font-medium text-slate-600 hover:text-indigo-600"
                  >
                    {link.name}
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      {siteContent.sectionOrder
        .filter(section => !(siteContent.hiddenSections || []).includes(section))
        .map((section, index) => {
          const isFirst = index === 0;
          const basePadding = isFirst ? "pt-32 pb-6 md:pt-40 md:pb-10" : "py-6 md:py-10";

          switch (section) {
            case 'demos':
              return (
                <section key="demos" id="demos" className={`${basePadding} px-6 relative overflow-hidden scroll-mt-28`}>
                  <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-slate-50 -z-10" />
                  <FadeInSection className="container mx-auto max-w-4xl text-center mb-12">
                    <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-slate-900">
                      {siteContent.heroTitle.split(' ').map((word, i) => (
                        <span key={i}>{i === 1 ? <span className="text-[var(--theme-primary)]">{word}</span> : word}{' '}</span>
                      ))}
                    </h1>
                    <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto">
                      {siteContent.heroSubtitle}
                    </p>
                    <AudioPlayer
                      tracks={demos}
                      currentTrackIndex={currentAudioIndex}
                      isPlaying={isAudioPlaying}
                      onPlayPause={toggleAudioPlay}
                      onNext={nextTrack}
                      onPrev={prevTrack}
                      onSeek={handleAudioSeek}
                      currentTime={audioCurrentTime}
                      duration={audioDuration}
                      onTrackSelect={(i) => {
                        setCurrentAudioIndex(i);
                        setIsAudioPlaying(true);
                      }}
                      ownerName={siteContent.siteName}
                    />
                  </FadeInSection>
                </section>
              );
            case 'projects':
              return (
                <section key="projects" id="projects" className={`${basePadding} px-6 scroll-mt-28`}>
                  <FadeInSection className="container mx-auto">
                    <SectionHeader title="Projects" icon={<Video />} />
                    {activeVideo && (
                      <div className="mb-2 max-w-6xl mx-auto">
                        <h3 className="text-2xl font-bold text-slate-800">{activeVideo.title}</h3>
                      </div>
                    )}
                    <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto">
                      {/* Main Player */}
                      <div className="flex-1">
                        {activeVideo ? (
                          <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-200 bg-black aspect-video">
                            <iframe
                              ref={videoRef}
                              width="100%"
                              height="100%"
                              src={`https://www.youtube.com/embed/${activeVideo.youtube_id}?rel=0&autoplay=${isPlayingVideo ? 1 : 0}&enablejsapi=1`}
                              title={activeVideo.title}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="w-full h-full"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video bg-slate-200 rounded-xl flex items-center justify-center text-slate-400">
                            Select a video
                          </div>
                        )}
                      </div>

                      {/* Playlist Sidebar */}
                      <div className="lg:w-1/3 flex flex-col gap-3 h-[500px] overflow-y-auto pr-2">
                        {videos.map((vid) => (
                          <button
                            key={vid.id}
                            onClick={() => handleVideoToggle(vid)}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left border ${activeVideo?.id === vid.id && isPlayingVideo
                              ? "bg-[var(--theme-primary)]/10 border-slate-100"
                              : "bg-white border-slate-100 hover:border-[var(--theme-primary)]/50 hover:bg-slate-50"
                              }`}
                          >
                            <div className="relative w-24 aspect-video rounded-md overflow-hidden flex-shrink-0 bg-slate-200 group-hover:opacity-90 transition">
                              <img
                                src={`https://img.youtube.com/vi/${vid.youtube_id}/mqdefault.jpg`}
                                alt={vid.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-sm font-semibold truncate ${activeVideo?.id === vid.id && isPlayingVideo ? "text-[var(--theme-primary)]" : "text-slate-700"}`}>
                                {vid.title}
                              </h4>
                            </div>
                            <div className={`p-2 rounded-full ${activeVideo?.id === vid.id && isPlayingVideo ? "bg-[var(--theme-primary)] text-white" : "text-slate-400 group-hover:text-[var(--theme-primary)]"}`}>
                              {activeVideo?.id === vid.id && isPlayingVideo ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </FadeInSection>
                </section>
              );
            case 'studio':
              return (
                <section key="studio" id="studio" className={`${basePadding} px-6 scroll-mt-28`}>
                  <FadeInSection className="container mx-auto">
                    <SectionHeader title="Studio" icon={<Mic />} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                      {studioGear.map((item) => (
                        <div key={item.id} className="glass-card rounded-xl p-6 flex flex-col items-center gap-4 text-center group bg-white shadow-sm hover:shadow-md transition-all border border-slate-100">
                          <div className="h-32 flex items-center justify-center p-2">
                            <img src={item.url} alt={item.name} className="max-h-full max-w-full object-contain filter transition group-hover:scale-105" />
                          </div>
                          <h3 className="font-semibold text-slate-800">{item.name}</h3>
                        </div>
                      ))}
                    </div>
                  </FadeInSection>
                </section>
              );
            case 'clients':
              return (
                <section key="clients" id="clients" className={`${basePadding} px-6 scroll-mt-28`}>
                  <FadeInSection className="container mx-auto">
                    <SectionHeader title="Clients" icon={<Users />} />
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-8 max-w-5xl mx-auto items-center">
                      {clients.map((client) => (
                        <div key={client.id} className="bg-white rounded-lg p-4 h-24 flex items-center justify-center hover:scale-105 transition-transform duration-300 shadow-sm hover:shadow-md border border-slate-100">
                          <img
                            src={client.url}
                            alt="Client Logo"
                            className={`max-h-full max-w-full object-contain transition-all ${siteContent.clientsGrayscale
                              ? "grayscale hover:grayscale-0 opacity-80 hover:opacity-100"
                              : "grayscale-0 opacity-100"
                              }`}
                          />
                        </div>
                      ))}
                    </div>
                  </FadeInSection>
                </section>
              );
            case 'reviews':
              return (
                <section key="reviews" id="reviews" className={`${basePadding} px-6 scroll-mt-28`}>
                  <FadeInSection className="container mx-auto">
                    <SectionHeader title="Reviews" icon={<MessageSquare />} />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                      {reviews.map((review) => (
                        <div key={review.id} className="glass-card p-8 rounded-xl relative bg-white border border-slate-100 shadow-sm">
                          <p className="text-lg italic text-slate-600 mb-6 font-serif leading-relaxed">"{review.text}"</p>
                          <div className="text-sm font-semibold text-[var(--theme-primary)]">{review.author}</div>
                        </div>
                      ))}
                    </div>
                  </FadeInSection>
                </section>
              );
            case 'about':
              return (
                <section key="about" id="about" className={`${basePadding} px-6 scroll-mt-28`}>
                  <FadeInSection className="container mx-auto max-w-4xl">
                    <SectionHeader title="About" icon={<User />} />
                    <div className="flex flex-col md:flex-row items-center gap-12">
                      <div className="w-full md:w-1/2">
                        <img src={siteContent.profileImage} alt={siteContent.siteName} className="rounded-2xl shadow-xl border border-slate-200 w-full" />
                      </div>
                      <div className="w-full md:w-1/2 text-lg text-slate-600 leading-relaxed">
                        <p className="mb-6 font-semibold text-xl text-slate-800">{siteContent.aboutTitle}</p>
                        <p className="whitespace-pre-line">
                          {siteContent.aboutText}
                        </p>
                      </div>
                    </div>
                  </FadeInSection>
                </section>
              );
            case 'contact':
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
                      <div className="flex flex-wrap justify-center gap-6 w-full">
                        <a
                          href={`mailto:${siteContent.contactEmail}`}
                          className="flex items-center gap-4 px-8 py-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-[var(--theme-primary)]/30 transition-all group min-w-fit"
                        >
                          <div className="p-3 bg-slate-50 rounded-xl group-hover:text-[var(--theme-primary)] transition-colors">
                            <Mail className="w-6 h-6" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</span>
                            <span className="font-semibold text-slate-800 text-lg break-all">{siteContent.contactEmail}</span>
                          </div>
                        </a>

                        {siteContent.contactPhone && (
                          <a
                            href={`tel:${siteContent.contactPhone.replace(/[^0-9+]/g, '')}`}
                            className="flex items-center gap-4 px-8 py-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-[var(--theme-primary)]/30 transition-all group min-w-fit"
                          >
                            <div className="p-3 bg-slate-50 rounded-xl group-hover:text-[var(--theme-primary)] transition-colors">
                              <Phone className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</span>
                              <span className="font-semibold text-slate-800 text-lg">{siteContent.contactPhone}</span>
                            </div>
                          </a>
                        )}
                      </div>

                      {/* Contact Form Area */}
                      {siteContent.showContactForm && (
                        <div className="w-full max-w-2xl glass-card p-8 md:p-12 rounded-3xl relative overflow-hidden bg-white border border-slate-100 shadow-xl shadow-slate-200/50">

                          <div className="relative z-10 text-center mb-10">
                            <h3 className="text-3xl font-bold mb-3 text-slate-900">Send a Message</h3>
                            <p className="text-slate-500">I'll get back to you as soon as possible.</p>
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
            default:
              return null;
          }
        })}

      {/* Sticky Bottom Mini Player Bar */}
      <AnimatePresence>
        {showMiniPlayer && (currentAudioTrack || activeVideo) && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl"
          >
            <div className="container mx-auto px-6 py-4">
              <div ref={miniPlayerRef} className="flex items-center justify-between gap-4">
                {/* Left: Play/Pause Button */}
                <button
                  onClick={isPlayingVideo && activeVideo ? () => handleVideoToggle(activeVideo) : toggleAudioPlay}
                  className="p-3 bg-[var(--theme-primary)] rounded-full text-white hover:brightness-110 shadow-lg transition-all active:scale-95 flex-shrink-0"
                  aria-label={isAudioPlaying || isPlayingVideo ? "Pause" : "Play"}
                >
                  {(isAudioPlaying && !isPlayingVideo) || isPlayingVideo ? (
                    <Pause size={20} fill="currentColor" />
                  ) : (
                    <Play size={20} fill="currentColor" className="ml-0.5" />
                  )}
                </button>

                {/* Right: Track Info & Dropdown */}
                <div className="flex-1 relative">
                  <button
                    onClick={() => setMiniPlayerOpen(!miniPlayerOpen)}
                    className="w-full flex items-center gap-2 text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate flex items-center gap-2">
                        <span className="truncate">{isPlayingVideo && activeVideo ? activeVideo.title : currentAudioTrack?.name || "Select media"}</span>
                        <ChevronDown
                          size={16}
                          className={`flex-shrink-0 transition-transform duration-200 ${miniPlayerOpen ? "rotate-180 text-[var(--theme-primary)]" : "text-slate-400 group-hover:text-[var(--theme-primary)]"}`}
                        />
                      </div>
                      <div className="text-xs text-slate-500">
                        {isPlayingVideo ? "Project" : "Demo"}
                      </div>
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {miniPlayerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full left-0 right-0 mb-4 bg-white rounded-xl shadow-xl border border-slate-100 py-2 max-h-[600px] overflow-y-auto"
                      >
                        {/* Audio Demos Section */}
                        {demos.length > 0 && (
                          <>
                            <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Demos</div>
                            {demos.map((demo, i) => (
                              <button
                                key={demo.id}
                                onClick={() => {
                                  setCurrentAudioIndex(i);
                                  setIsAudioPlaying(true);
                                  setIsPlayingVideo(false);
                                  setMiniPlayerOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-slate-50 transition-colors ${i === currentAudioIndex && isAudioPlaying && !isPlayingVideo ? "text-[var(--theme-primary)] font-medium bg-[var(--theme-primary)]/5" : "text-slate-600"}`}
                              >
                                <Mic size={16} className="flex-shrink-0" />
                                <span className="truncate flex-1">{demo.name}</span>
                              </button>
                            ))}
                          </>
                        )}

                        {/* Videos Section */}
                        {videos.length > 0 && (
                          <>
                            <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mt-2 border-t border-slate-100">Projects</div>
                            {videos.map((vid) => (
                              <button
                                key={vid.id}
                                onClick={() => {
                                  setActiveVideo(vid);
                                  setIsPlayingVideo(false);
                                  setIsAudioPlaying(false);
                                  setMiniPlayerOpen(false);
                                  // Scroll to projects section
                                  document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-slate-50 transition-colors ${activeVideo?.id === vid.id && isPlayingVideo ? "text-[var(--theme-primary)] font-medium bg-[var(--theme-primary)]/5" : "text-slate-600"}`}
                              >
                                <Video size={16} className="flex-shrink-0" />
                                <span className="truncate flex-1">{vid.title}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Far Right: Admin Settings */}
                <a href="/admin" className="p-2 text-slate-400 hover:text-[var(--theme-primary)] transition-colors flex-shrink-0" title="Admin Settings">
                  <Settings size={20} />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="pt-2 pb-32 text-center text-slate-400 text-sm bg-slate-50 relative flex justify-center items-center">
        <p>Designed by <a href="https://nathanpuls.com" className="hover:text-[var(--theme-primary)] text-slate-500 transition-colors">Nathan Puls</a></p>
      </footer>
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-12">
      <span className="p-3 bg-slate-100 rounded-full text-[var(--theme-primary)] shadow-sm">{icon}</span>
      <h2 className="text-3xl md:text-4xl font-bold text-slate-900">{title}</h2>
    </div>
  )
}
