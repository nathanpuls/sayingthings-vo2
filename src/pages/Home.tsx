import { useRef, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getSingleTenantUser } from "../lib/users";
import { applyFont } from "../lib/fonts";
import { getPlayableUrl, normalizeClips } from "../lib/audio";
import { Database } from "../lib/database.types";

import Landing from "../components/home/Landing";
import HomeNav from "../components/home/HomeNav";
import ProjectsSection from "../components/home/ProjectsSection";
import StudioSection from "../components/home/StudioSection";
import ClientsSection from "../components/home/ClientsSection";
import ReviewsSection from "../components/home/ReviewsSection";
import AboutSection from "../components/home/AboutSection";
import ContactSection from "../components/home/ContactSection";
import MiniPlayer from "../components/home/MiniPlayer";
import VoiceClipsPlayer from "../components/VoiceClipsPlayer";

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
  favicon: string;
  playerStyle: string;
  username?: string;
  ownerId?: string;
  showHeroTitle: boolean;
  showHeroSubtitle: boolean;
}

export default function Home() {
  const { uid } = useParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [showLanding, setShowLanding] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  // Scroll State
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  // Audio State
  const [demos, setDemos] = useState<Demo[]>([]);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Audio Handlers
  const currentAudioTrack = demos[currentAudioIndex];

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

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      if (isAudioPlaying) audioRef.current.play().catch(() => setIsAudioPlaying(false));
    }
  };

  const handleAudioEnded = () => {
    setCurrentAudioIndex(prev => (prev + 1) % demos.length);
  };


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
    showContactForm: true,
    favicon: "",
    playerStyle: "default",
    username: "",
    ownerId: "",
    showHeroTitle: true,
    showHeroSubtitle: true
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);

    const fetchData = async () => {
      // Also check if current viewer is logged in
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Check if we're on a custom domain first
      let userId: string | null | undefined = null;

      // Fetch the single tenant user directly
      userId = await getSingleTenantUser();

      // If we are on a legacy route with a username, redirect to clean home URL
      // (This handles cases where the user navigates to /u/some-username or the * route matches a subpath)
      const currentPath = window.location.pathname;
      if (currentPath !== '/' && !currentPath.startsWith('/admin') && !currentPath.startsWith('/embed')) {
        window.history.replaceState({}, '', '/');
      }

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
          showContactForm: settings.show_contact_form !== false,
          favicon: settings.favicon || "",
          playerStyle: settings.player_style || "default",
          username: settings.username || "",
          ownerId: userId, // userId is available in the scope
          showHeroTitle: settings.show_hero_title !== false,
          showHeroSubtitle: settings.show_hero_subtitle !== false
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

  // Apply Favicon
  useEffect(() => {
    if (siteContent.favicon) {
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = siteContent.favicon;
    }
  }, [siteContent.favicon]);

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

  // Update favicon
  useEffect(() => {
    if (!showLanding && siteContent.favicon) {
      // Remove existing favicon links to force refresh
      const existingLinks = document.querySelectorAll("link[rel*='icon']");
      existingLinks.forEach(link => link.remove());

      // Create new link
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = siteContent.favicon;
      document.head.appendChild(newLink);
    }
  }, [showLanding, siteContent.favicon]);

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

  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-white">
      <div
        className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: '#418fe1', borderTopColor: 'transparent' }}
      />
    </div>
  );

  if (showLanding) {
    return <Landing handleLogin={handleLogin} currentUser={currentUser} isScrolled={isScrolled} />
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <audio
        ref={audioRef}
        src={currentAudioTrack ? getPlayableUrl(currentAudioTrack.url) : undefined}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onEnded={handleAudioEnded}
      />
      <style>{`
        :root {
          --theme-primary: ${siteContent.themeColor || '#6366f1'};
        }
  `}</style>

      <HomeNav
        isScrolled={isScrolled}
        siteName={siteContent.siteName}
        navLinks={navLinks}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {siteContent.sectionOrder
        .filter(section => !(siteContent.hiddenSections || []).includes(section))
        .map((section, index) => {
          const isFirst = index === 0;
          const basePadding = isFirst ? "pt-32 pb-4 md:pt-40 md:pb-10" : "py-4 md:py-10";

          switch (section) {
            case 'demos':
              return (
                <div key="demos" id="demos" className={basePadding}>
                  <div className="container mx-auto px-4">
                    {siteContent.showHeroTitle && siteContent.heroTitle && (
                      <h2 className="text-3xl font-bold text-center mb-8">{siteContent.heroTitle}</h2>
                    )}

                    {/* Description / Subtitle */}
                    {siteContent.showHeroSubtitle && siteContent.heroSubtitle && (
                      <p className="text-lg text-slate-500 text-center mb-8 max-w-2xl mx-auto">
                        {siteContent.heroSubtitle}
                      </p>
                    )}

                    <VoiceClipsPlayer
                      tracks={demos.map(demo => ({
                        id: demo.id,
                        name: demo.name,
                        url: getPlayableUrl(demo.url),
                        clips: normalizeClips(demo.segments)
                      }))}
                      themeColor={siteContent.themeColor}
                      shareConfig={{
                        publicUrl: window.location.href,
                        embedUrl: `${window.location.origin} /embed/voiceclips / ${siteContent.username || siteContent.ownerId} `
                      }}
                    />
                  </div>
                </div>
              );
            case 'projects':
              return (
                <ProjectsSection
                  key="projects"
                  activeVideo={activeVideo}
                  videos={videos}
                  isPlayingVideo={isPlayingVideo}
                  handleVideoToggle={handleVideoToggle}
                  basePadding={basePadding}
                  videoRef={videoRef as React.RefObject<HTMLIFrameElement>}
                />
              );
            case 'studio':
              return (
                <StudioSection
                  key="studio"
                  studioGear={studioGear}
                  basePadding={basePadding}
                />
              );
            case 'clients':
              return (
                <ClientsSection
                  key="clients"
                  clients={clients}
                  siteContent={siteContent}
                  basePadding={basePadding}
                />
              );
            case 'reviews':
              return (
                <ReviewsSection
                  key="reviews"
                  reviews={reviews}
                  basePadding={basePadding}
                />
              );
            case 'about':
              return (
                <AboutSection
                  key="about"
                  siteContent={siteContent}
                  basePadding={basePadding}
                />
              );
            case 'contact':
              return (
                <ContactSection
                  key="contact"
                  siteContent={siteContent}
                  uid={uid}
                  basePadding={basePadding}
                />
              );
            default:
              return null;
          }
        })}

      <MiniPlayer
        showMiniPlayer={false}
        currentAudioTrack={currentAudioTrack}
        activeVideo={activeVideo}
        isPlayingVideo={isPlayingVideo}
        isAudioPlaying={isAudioPlaying}
        onTogglePlay={() => {
          if (isPlayingVideo && activeVideo) {
            handleVideoToggle(activeVideo);
          } else {
            toggleAudioPlay();
          }
        }}
        demos={demos}
        videos={videos}
        currentAudioIndex={currentAudioIndex}
        onSelectAudio={(i) => {
          setCurrentAudioIndex(i);
          setIsAudioPlaying(true);
          setIsPlayingVideo(false);
        }}
        onSelectVideo={(vid) => {
          setActiveVideo(vid);
          setIsPlayingVideo(false);
          setIsAudioPlaying(false);
          document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      <div className="py-8 bg-slate-50 flex justify-center">
        <a href="/admin" className="text-slate-300 hover:text-slate-400 transition-colors p-2">
          <Lock size={16} />
        </a>
      </div>
    </div>
  );
}
