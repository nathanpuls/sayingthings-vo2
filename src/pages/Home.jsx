import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { demos as staticDemos } from "../content/demos";
import { applyFont } from "../lib/fonts";
import AudioPlayer from "../components/AudioPlayer";
import VideoCard from "../components/VideoCard";
import { Mic, Music, Video, Users, MessageSquare, User, Mail, Phone, Menu, X, Play, Pause, Settings, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import FadeInSection from "../components/FadeInSection";

export default function Home() {
  const { uid } = useParams();
  const [loading, setLoading] = useState(true);
  // Scroll State
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Contact Form State
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "", botField: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error'
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
  const [demos, setDemos] = useState([]);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [miniPlayerOpen, setMiniPlayerOpen] = useState(false);
  const audioRef = useRef(null);
  const miniPlayerRef = useRef(null);

  // Audio Handlers
  const currentAudioTrack = demos[currentAudioIndex];

  // Close mini player dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (miniPlayerRef.current && !miniPlayerRef.current.contains(event.target)) {
        setMiniPlayerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [miniPlayerRef]);

  // Utility to convert various link types (like Google Drive) to direct play links
  const getPlayableUrl = (url) => {
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

  const handleAudioSeek = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setAudioCurrentTime(time);
    }
  };

  const nextTrack = () => setCurrentAudioIndex(prev => (prev + 1) % demos.length);
  const prevTrack = () => setCurrentAudioIndex(prev => (prev - 1 + demos.length) % demos.length);

  // Firestore Data States
  const [studioGear, setStudioGear] = useState([]);
  const [clients, setClients] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const videoRef = useRef(null);

  // Set initial active video when videos load
  useEffect(() => {
    if (videos.length > 0 && !activeVideo) {
      setActiveVideo(videos[0]);
      setIsPlayingVideo(false);
    }
  }, [videos]);

  const handleVideoToggle = (vid) => {
    // Stop audio when playing video
    setIsAudioPlaying(false);

    if (activeVideo?.id === vid.id) {
      // Toggle current
      const action = isPlayingVideo ? 'pauseVideo' : 'playVideo';
      if (videoRef.current) {
        videoRef.current.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: action,
          args: []
        }), '*');
        setIsPlayingVideo(!isPlayingVideo);
      }
    } else {
      // Switch video
      setActiveVideo(vid);
      setIsPlayingVideo(true);
    }
  };

  const [siteContent, setSiteContent] = useState({
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
      // Small delay prevents flash if loading is too fast, but ensured consistent state
      if (!uid) { setLoading(false); return; }

      const fetchTable = async (table) => {
        const { data, error } = await supabase.from(table).select('*').eq('user_id', uid).order('order', { ascending: true });
        if (error) console.error(`Error fetching ${table}:`, error);
        return data || [];
      };

      setDemos(await fetchTable('demos'));
      setStudioGear(await fetchTable('studio_gear'));
      setClients(await fetchTable('clients'));
      setReviews(await fetchTable('reviews'));
      setVideos(await fetchTable('videos'));
      const { data: settings } = await supabase.from('site_settings').select('*').eq('user_id', uid).single();
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
          sectionOrder: settings.section_order || ["demos", "projects", "studio", "clients", "reviews", "about", "contact"],
          font: settings.font || "Outfit",
          web3FormsKey: settings.web3_forms_key || "",
          showContactForm: settings.show_contact_form !== false
        });

        applyFont(settings.font || "Outfit");
      }
      setLoading(false);
    };

    fetchData();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
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

  const navLinkDetails = {
    demos: "Demos",
    projects: "Projects",
    studio: "Studio",
    clients: "Clients",
    reviews: "Reviews",
    about: "About",
    contact: "Contact"
  };

  const navLinks = siteContent.sectionOrder.map(id => ({
    name: navLinkDetails[id] || id.charAt(0).toUpperCase() + id.slice(1),
    href: `#${id}`
  }));

  const handleContactSubmit = async (e) => {
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
        const { error } = await supabase.from('messages').insert([{
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

  if (loading) return <div className="min-h-screen bg-white" />;

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
          --theme-primary: ${siteContent.themeColor || '#4f46e5'};
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
              <span className="text-2xl font-bold bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary)] bg-clip-text text-transparent group-hover:opacity-80 transition">
                {siteContent.siteName}
              </span>
            </a>

            {/* Mini Player */}
            <div className={`hidden md:flex items-center gap-4 transition-all duration-500 ${showMiniPlayer && (currentAudioTrack || activeVideo) ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"}`}>
              <div ref={miniPlayerRef} className="relative flex items-center gap-3">
                <button
                  onClick={isPlayingVideo ? () => handleVideoToggle(activeVideo) : toggleAudioPlay}
                  className="p-1.5 bg-[var(--theme-primary)] rounded-full text-white hover:brightness-110 shadow-sm transition-all active:scale-95"
                >
                  {(isAudioPlaying && !isPlayingVideo) || isPlayingVideo ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                </button>

                <button
                  onClick={() => setMiniPlayerOpen(!miniPlayerOpen)}
                  className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-[var(--theme-primary)] transition-colors group"
                >
                  <span className="max-w-[200px] truncate">
                    {isPlayingVideo && activeVideo ? activeVideo.title : currentAudioTrack?.name || "Select media"}
                  </span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${miniPlayerOpen ? "rotate-180 text-[var(--theme-primary)]" : "text-slate-400 group-hover:text-[var(--theme-primary)]"}`} />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {miniPlayerOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-4 w-72 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 max-h-96 overflow-y-auto"
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
                              {i === currentAudioIndex && isAudioPlaying && !isPlayingVideo && (
                                <div className="flex-shrink-0">
                                  <div className="w-3 h-3 bg-[var(--theme-primary)] rounded-full animate-pulse" />
                                </div>
                              )}
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
                                setIsPlayingVideo(true);
                                setIsAudioPlaying(false);
                                setMiniPlayerOpen(false);
                                // Scroll to projects section
                                document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-slate-50 transition-colors ${activeVideo?.id === vid.id && isPlayingVideo ? "text-[var(--theme-primary)] font-medium bg-[var(--theme-primary)]/5" : "text-slate-600"}`}
                            >
                              <Video size={16} className="flex-shrink-0" />
                              <span className="truncate flex-1">{vid.title}</span>
                              {activeVideo?.id === vid.id && isPlayingVideo && (
                                <div className="flex-shrink-0">
                                  <div className="w-3 h-3 bg-[var(--theme-primary)] rounded-full animate-pulse" />
                                </div>
                              )}
                            </button>
                          ))}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
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
      {siteContent.sectionOrder.map((section, index) => {
        const isFirst = index === 0;
        const basePadding = isFirst ? "pt-32 pb-8 md:pt-40 md:pb-12" : "py-8 md:py-12";

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
                            tabIndex="-1"
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
                              rows="4"
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

      <footer className="pt-2 pb-12 text-center text-slate-400 text-sm bg-slate-50 relative flex justify-center items-center">
        <p>Designed by <a href="https://nathanpuls.com" className="hover:text-[var(--theme-primary)] text-slate-500 transition-colors">Nathan Puls</a></p>
        <a href="/admin" className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity p-2" title="Admin Settings">
          <Settings size={16} />
        </a>
      </footer>
    </div>
  );
}

function SectionHeader({ title, icon }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-12">
      <span className="p-3 bg-slate-100 rounded-full text-[var(--theme-primary)] shadow-sm">{icon}</span>
      <h2 className="text-3xl md:text-4xl font-bold text-slate-900">{title}</h2>
    </div>
  )
}
