import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import {
    Trash2, Save, LogOut, LogIn,
    Home, Music, Video, Mic, Users, Scissors,
    MessageSquare, Settings, Mail, Globe,
    Copy, Info, Contact, Share2, GripVertical, Eye, EyeOff, AlertCircle, CheckCircle, RefreshCw
} from "lucide-react";
import { Reorder } from "framer-motion";
import { getUserCustomDomains, addCustomDomain, verifyDomainOwnership } from "../lib/domains";
import { fonts, applyFont, loadAllFonts } from "../lib/fonts";
import { Database } from "../lib/database.types";
import { User as SupabaseUser } from "@supabase/supabase-js";
import Toast from "../components/admin/Toast";
import DeleteConfirmModal from "../components/admin/DeleteConfirmModal";
import ClipModal from "../components/admin/ClipModal";
import FileUploader from "../components/admin/FileUploader";
import ItemList from "../components/admin/ItemList";
import Section from "../components/admin/Section";
import Toggle from "../components/admin/Toggle";
import FormInput from "../components/admin/FormInput";
import Field from "../components/admin/Field";

// Type Alias
type Demo = Database['public']['Tables']['demos']['Row'];
type VideoItem = Database['public']['Tables']['videos']['Row'];
type StudioGear = Database['public']['Tables']['studio_gear']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];
type Review = Database['public']['Tables']['reviews']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];
// type CustomDomain = Database['public']['Tables']['custom_domains']['Row'];

// Note: site_settings is an object, not array
type SiteSettings = Database['public']['Tables']['site_settings']['Row'];

interface SiteContentState {
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
    username: string;
    playerStyle: string;
    showHeroTitle: boolean;
    showHeroSubtitle: boolean;
}

// const authorizedEmail = "natepuls@gmail.com";
const authorizedEmail = ""; // Disabled for multi-user support

// Move FormInput/FileUploader/Toggle/SectionReorder/ItemList definitions later or type them inline if they are in this file.
// Assuming they are defined at bottom of file. Need to update their signatures.

export default function Admin() {
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("demos");
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Check if user is on mobile device
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
            const isMobileDevice = mobileRegex.test(userAgent.toLowerCase());
            const isSmallScreen = window.innerWidth < 768;
            setIsMobile(isMobileDevice || isSmallScreen);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        setToast({ message, type });
        // Keep errors for 10 seconds, success messages for 3 seconds
        toastTimeoutRef.current = setTimeout(() => {
            setToast(null);
            toastTimeoutRef.current = null;
        }, type === 'error' ? 10000 : 3000);
    };

    // Data States
    const [demos, setDemos] = useState<Demo[]>([]);
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [studio, setStudio] = useState<StudioGear[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [customDomains, setCustomDomains] = useState<any[]>([]); // Using any for customDomains as type might differ slightly from DB
    const [siteContent, setSiteContent] = useState<SiteContentState>({
        username: "",
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
        showHeroTitle: true,
        showHeroSubtitle: true
    });




    // Form States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<any>({});

    // Create Form States
    const [newDemo, setNewDemo] = useState({ name: "", url: "" });
    const [newVideo, setNewVideo] = useState({ youtubeId: "", title: "" });
    const [newStudio, setNewStudio] = useState({ name: "", url: "" });
    const [newClient, setNewClient] = useState({ url: "" });
    const [newReview, setNewReview] = useState({ text: "", author: "" });
    const [newDomain, setNewDomain] = useState("");
    const [fetchingTitle, setFetchingTitle] = useState(false);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; collName: string | null; id: string | null }>({ isOpen: false, collName: null, id: null });
    const [clipModal, setClipModal] = useState<{ isOpen: boolean; demo: Demo | null }>({ isOpen: false, demo: null });
    const waveformCache = useRef<Map<string, AudioBuffer>>(new Map());

    // Fetch YouTube video title
    const fetchYouTubeTitle = async (videoIdOrUrl: string) => {
        try {
            setFetchingTitle(true);

            // Extract ID if it's a URL
            let videoId = videoIdOrUrl;
            if (videoIdOrUrl.includes('youtube.com') || videoIdOrUrl.includes('youtu.be')) {
                const patterns = [
                    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\/\s]+)/,
                    /youtube\.com\/watch\?.*v=([^&?\/\s]+)/
                ];

                for (const pattern of patterns) {
                    const match = videoIdOrUrl.match(pattern);
                    if (match && match[1]) {
                        videoId = match[1];
                        break;
                    }
                }
            }

            // Fetch title using YouTube oEmbed API (no API key needed!)
            const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Fetched YouTube title:', data.title);
                setNewVideo(prev => ({ ...prev, title: data.title, youtubeId: videoId }));
            } else {
                console.warn('⚠️ Could not fetch title, using ID as-is');
                setNewVideo(prev => ({ ...prev, youtubeId: videoId }));
            }
        } catch (error) {
            console.error('❌ Error fetching YouTube title:', error);
            // Still set the ID even if title fetch fails
            setNewVideo(prev => ({ ...prev, youtubeId: videoIdOrUrl }));
        } finally {
            setFetchingTitle(false);
        }
    };

    // Automatically fetch YouTube title when the ID or URL changes
    useEffect(() => {
        if (newVideo.youtubeId && !newVideo.title && !fetchingTitle) {
            fetchYouTubeTitle(newVideo.youtubeId);
        }
    }, [newVideo.youtubeId]);

    // Check Auth Session
    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (!currentUser) {
                setLoading(false);
            }
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (!currentUser) {
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Data Fetcher
    const fetchData = async () => {
        if (!user) return;

        // Fetch ordered lists
        const fetchTable = async <T extends keyof Database['public']['Tables']>(table: T) => {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .eq('user_id' as any, user!.id as any)
                .order('order', { ascending: true });
            if (error) console.error(`Error fetching ${table}:`, error);
            return data || [];
        };

        // Fetch settings first (critical for layout/branding)
        const { data: settingsData } = await supabase.from('site_settings').select('*').eq('user_id', user.id).single();
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
                font: settings.font || "Outfit",
                web3FormsKey: settings.web3_forms_key || "",
                showContactForm: settings.show_contact_form !== false,
                hiddenSections: (settings.hidden_sections as any) || [],
                favicon: settings.favicon || "",
                username: settings.username || "",
                playerStyle: settings.player_style || "default",
                showHeroTitle: settings.show_hero_title !== false,
                showHeroSubtitle: settings.show_hero_subtitle !== false
            });
            if (settings.font) applyFont(settings.font);
        }

        // Now that settings are loaded, we can show the UI shell
        setLoading(false);

        // Fetch remaining data in parallel without blocking the UI
        Promise.all([
            fetchTable('demos'),
            fetchTable('videos'),
            fetchTable('studio_gear'),
            fetchTable('clients'),
            fetchTable('reviews'),
            getUserCustomDomains(),
            supabase.from('messages').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        ]).then(([demosData, videosData, studioData, clientsData, reviewsData, domainsData, msgsData]) => {
            setDemos(demosData);
            setVideos(videosData);
            setStudio(studioData);
            setClients(clientsData);
            setReviews(reviewsData);
            setCustomDomains(domainsData);
            setMessages((msgsData as any).data || []);
        });
    };

    // Fetch data when user changes
    useEffect(() => {
        if (user) {
            setLoading(true);
            fetchData().finally(() => setLoading(false));
        }
    }, [user]);

    // Update document title
    useEffect(() => {
        if (siteContent.siteName) {
            document.title = `${siteContent.siteName} | Admin`;
        } else {
            document.title = "Admin | Built.at";
        }
    }, [siteContent.siteName]);

    // ------------------------------------------------------------
    // Hash‑based routing for admin tabs (single source of truth)
    // ------------------------------------------------------------
    const tabs = [
        { id: "demos", name: "Demos", icon: <Music size={18} /> },
        { id: "videos", name: "Projects", icon: <Video size={18} /> },
        { id: "studio", name: "Studio", icon: <Mic size={18} /> },
        { id: "clients", name: "Clients", icon: <Users size={18} /> },
        { id: "reviews", name: "Reviews", icon: <MessageSquare size={18} /> },
        { id: "messages", name: "Messages", icon: <Mail size={18} /> },
        { id: "content", name: "Site Content", icon: <Settings size={18} /> },
        { id: "domains", name: "Custom Domains", icon: <Globe size={18} /> },
    ];

    // Sync active tab with URL hash on mount and when hash changes
    useEffect(() => {
        // Load all fonts so previews work in the UI
        loadAllFonts();

        const syncTabWithHash = () => {
            const hash = window.location.hash.replace(/^#/, "");
            if (hash && tabs.find(t => t.id === hash)) {
                setActiveTab(hash);
            }
        };
        // Initial sync
        syncTabWithHash();
        // Listen for future hash changes (e.g., manual URL edits)
        window.addEventListener("hashchange", syncTabWithHash);
        return () => {
            window.removeEventListener("hashchange", syncTabWithHash);
        };
    }, []);

    // Click handler that also updates the URL hash for bookmarking
    const handleTabClick = (tabId: string) => {
        setActiveTab(tabId);
        setEditingId(null);
        window.location.hash = tabId;
    };

    const handleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.hostname === 'vo.built.at'
                    ? 'https://vo.built.at/admin'
                    : window.location.origin + '/admin'
            }
        });
        if (error) console.error("Login failed:", error.message);
    };

    const logout = async () => {
        await supabase.auth.signOut();
    };

    // Generic Handlers
    const addItem = async (collName: string, data: any, resetter: () => void) => {
        setUploading(true);
        try {
            // Map logic names to DB table names if needed
            let tableName = collName === 'studio' ? 'studio_gear' : collName;

            // Get current list size for ordering
            const list = collName === "demos" ? demos : collName === "videos" ? videos : collName === "studio" ? studio : collName === "clients" ? clients : reviews;

            let finalData = { ...data, order: list.length, user_id: user!.id };

            // Auto-extract YouTube ID from URL if needed
            if (collName === "videos" && finalData.youtubeId) {
                // ... (rename field to match DB snake_case if we want, or keep camelCase if DB columns match. 
                // Plan said snake_case for DB columns. Let's map them.)
                // Actually, let's keep it simple: mapped below.
            }
            // Youtube Logic Reuse...
            if (collName === "videos" && finalData.youtubeId) {
                const youtubeId = finalData.youtubeId;
                if (youtubeId.includes('youtube.com') || youtubeId.includes('youtu.be')) {
                    const patterns = [
                        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\/\s]+)/,
                        /youtube\.com\/watch\?.*v=([^&?\/\s]+)/
                    ];
                    for (const pattern of patterns) {
                        const match = youtubeId.match(pattern);
                        if (match && match[1]) {
                            finalData.youtubeId = match[1];
                            break;
                        }
                    }
                }
            }

            if (collName === "demos" && finalData.url) {
                const driveMatch = finalData.url.match(/\/file\/d\/([^\/]+)/) || finalData.url.match(/id=([^\&]+)/);
                if (driveMatch && (finalData.url.includes("drive.google.com") || finalData.url.includes("docs.google.com"))) {
                    finalData.url = `https://docs.google.com/uc?id=${driveMatch[1]}`;
                }
                if (finalData.url.includes("dropbox.com") && finalData.url.includes("dl=0")) {
                    finalData.url = finalData.url.replace("dl=0", "raw=1");
                }
            }

            // DB Column Mapping
            const dbPayload: any = {
                user_id: user!.id,
                order: list.length
            };
            if (collName === 'videos') {
                dbPayload.youtube_id = finalData.youtubeId;
                dbPayload.title = finalData.title;
            } else if (collName === 'reviews') {
                dbPayload.text = finalData.text;
                dbPayload.author = finalData.author;
            } else {
                dbPayload.name = finalData.name; // demos, studio
                dbPayload.url = finalData.url;   // demos, studio, clients (clients has no name)
            }
            tableName = collName === 'videos' ? 'videos' :
                collName === 'studio' ? 'studio_gear' :
                    collName === 'clients' ? 'clients' :
                        collName === 'reviews' ? 'reviews' : 'demos';

            const { error } = await (supabase.from(tableName as any) as any).insert([dbPayload]);
            if (error) throw error;

            console.log(`✅ ${collName} item added successfully!`);
            resetter();
            fetchData(); // Refresh UI
        } catch (error: any) {
            console.error(`❌ Error adding ${collName}:`, error);
            showToast(`Error adding item: ` + (error.message || 'Unknown error'), "error");
        } finally {
            setUploading(false);
        }
    };

    const deleteItem = async (collName: string, id: string) => {
        setDeleteModal({ isOpen: true, collName, id });
    };

    const confirmDelete = async () => {
        const { collName, id } = deleteModal;
        setDeleteModal({ ...deleteModal, isOpen: false });
        const tableName = collName === 'studio' ? 'studio_gear' : collName;
        try {
            const { error } = await (supabase.from(tableName as any) as any).delete().eq('id', id);
            if (error) throw error;
            fetchData();
        }
        catch (error: any) { showToast("Error deleting: " + (error.message || 'Unknown error'), "error"); }
    };

    const handleReorder = async (collName: string, newItems: any[]) => {
        // 1. Optimistic Update
        if (collName === "demos") setDemos(newItems);
        else if (collName === "videos") setVideos(newItems);
        else if (collName === "studio") setStudio(newItems);
        else if (collName === "clients") setClients(newItems);
        else if (collName === "reviews") setReviews(newItems);

        // 2. Persist to DB
        try {
            const tableName = collName === 'studio' ? 'studio_gear' : collName;

            // Prepare payload: use all existing fields but update 'order'
            const updates = newItems.map((item, index) => ({
                ...item,
                order: index
            }));

            const { error } = await (supabase.from(tableName as any) as any).upsert(updates);
            if (error) throw error;
        } catch (error: any) {
            console.error("Reorder failed:", error);
            showToast("Error saving order: " + (error.message || 'Unknown error'), "error");
            fetchData(); // Revert on error
        }
    };

    const updateItem = async (collName: string, id: string, directPayload: any = null) => {
        setUploading(true);
        try {
            const raw = directPayload || editForm;
            const { id: _ } = raw;
            const tableName = collName === 'studio' ? 'studio_gear' : collName;

            // Map keys
            const dbPayload: any = {};
            if (collName === 'videos') {
                if (raw.title) dbPayload.title = raw.title;
                if (raw.title !== undefined) dbPayload.title = raw.title;
                if (raw.youtubeId !== undefined) dbPayload.youtube_id = raw.youtubeId;
            } else if (collName === 'reviews') {
                if (raw.text !== undefined) dbPayload.text = raw.text;
                if (raw.author !== undefined) dbPayload.author = raw.author;
            } else {
                if (raw.name !== undefined) dbPayload.name = raw.name;
                if (raw.url !== undefined) dbPayload.url = raw.url;
            }

            const { error } = await (supabase.from(tableName as any) as any).update(dbPayload).eq('id', id);
            if (error) throw error;

            setEditingId(null);
            fetchData();
        } catch (error: any) {
            showToast("Error updating: " + (error.message || 'Unknown error'), "error");
        } finally {
            setUploading(false);
        }
    };



    const saveSettings = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setUploading(true);
        try {
            const payload = {
                user_id: user!.id,
                hero_title: siteContent.heroTitle,
                hero_subtitle: siteContent.heroSubtitle,
                about_title: siteContent.aboutTitle,
                about_text: siteContent.aboutText,
                contact_email: siteContent.contactEmail,
                contact_phone: siteContent.contactPhone,
                site_name: siteContent.siteName,
                profile_image: siteContent.profileImage,
                profile_cartoon: siteContent.profileCartoon,
                show_cartoon: siteContent.showCartoon,
                clients_grayscale: siteContent.clientsGrayscale,
                theme_color: siteContent.themeColor,
                section_order: siteContent.sectionOrder,
                font: siteContent.font,
                web3_forms_key: siteContent.web3FormsKey,
                show_contact_form: siteContent.showContactForm,
                hidden_sections: siteContent.hiddenSections,
                favicon: siteContent.favicon,
                username: siteContent.username || null,
                player_style: siteContent.playerStyle,
                show_hero_title: siteContent.showHeroTitle,
                show_hero_subtitle: siteContent.showHeroSubtitle
            };

            const { error } = await (supabase.from('site_settings' as any) as any).upsert(payload, { onConflict: 'user_id' });
            if (error) throw error;

            showToast("Site content saved successfully!");
        } catch (error: any) {
            console.error("Save failed:", error);
            showToast("Error saving settings: " + (error.message || 'Unknown error'), "error");
        } finally {
            setUploading(false);
        }
    };

    const handleAddDomain = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDomain) return;
        setUploading(true);
        try {
            const result = await addCustomDomain(newDomain);
            if (result.success) {
                showToast("Domain added! Please verify ownership.", "success");
                setNewDomain("");
                setCustomDomains(await getUserCustomDomains());
            } else {
                throw result.error;
            }
        } catch (error: any) {
            console.error("Add domain failed:", error);
            showToast(error.message || "Failed to add domain", "error");
        } finally {
            setUploading(false);
        }
    };



    const handleCheckVerification = async (domain: any) => {
        setUploading(true);
        try {
            // 1. Check Ownership Record
            let verified = await verifyDomainOwnership(
                domain.domain,
                domain.ownership_value || domain.verification_token,
                domain.ownership_name
            );

            // 2. Backup: Check SSL Record if ownership failed
            if (!verified && domain.ssl_name && domain.ssl_value) {
                verified = await verifyDomainOwnership(
                    domain.domain,
                    domain.ssl_value,
                    domain.ssl_name
                );
            }

            if (verified) {
                await (supabase.from('custom_domains' as any) as any).update({ verified: true }).eq('id', domain.id);
                showToast("Domain verified successfully!", "success");
                setCustomDomains(await getUserCustomDomains());
            } else {
                showToast("Verification failed. DNS records not found yet.", "error");
            }
        } catch (error) {
            console.error("Verification error:", error);
            showToast("Verification check failed", "error");
        } finally {
            setUploading(false);
        }
    };





    if (loading) return <div className="min-h-screen grid place-items-center bg-slate-50 font-medium">Loading...</div>;

    // Block mobile access
    if (isMobile) {
        return (
            <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center border border-slate-100 max-w-md w-full">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Settings size={32} className="text-indigo-600" />
                    </div>
                    <h1 className="text-2xl font-bold mb-4 text-slate-800">Desktop Only</h1>
                    <p className="text-slate-600 mb-6 leading-relaxed">
                        The admin panel is optimized for desktop use. Please access this page from a desktop or laptop computer for the best experience.
                    </p>
                    <a
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                    >
                        <Home size={18} /> Go to Home
                    </a>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center border border-slate-100 max-w-sm w-full">
                    <h1 className="text-2xl font-bold mb-6 text-slate-800">Admin Login</h1>
                    <button onClick={handleLogin} className="flex items-center justify-center gap-3 w-full text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg bg-slate-900 hover:bg-black shadow-slate-200">
                        <LogIn size={20} /> Sign in with Google
                    </button>
                </div>
            </div>
        );
    }

    if (user.email !== authorizedEmail && authorizedEmail !== "") {
        return (
            <div className="min-h-screen grid place-items-center bg-slate-50 p-4 font-medium">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center border border-red-100 max-w-sm w-full">
                    <h1 className="text-xl font-bold mb-4 text-red-600">Unauthorized</h1>
                    <p className="text-slate-600 mb-6">Access denied for {user.email}</p>
                    <button onClick={logout} className="w-full flex items-center gap-2 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition-all">
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </div>
        );
    }

    const currentTabTitle = tabs.find(t => t.id === activeTab)?.name;

    return (
        <div className="min-h-screen bg-slate-50 flex" style={{ '--theme-primary': siteContent.themeColor || '#6366f1' } as any}>
            {/* Sidebar */}
            <aside className="w-20 md:w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full shadow-sm z-[50]">
                <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-center md:justify-start gap-3">
                    <span className="font-bold text-slate-800 tracking-tight text-lg">Admin</span>
                </div>

                <nav className="flex-1 p-2 md:p-4 space-y-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab.id)}
                            className={`w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 md:px-4 md:py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.id
                                ? "text-white shadow-md shadow-black/10 bg-[var(--theme-primary)]"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                }`}
                            title={tab.name}
                        >
                            <span className="flex-shrink-0">{tab.icon}</span>
                            <span className="hidden md:block truncate">{tab.name}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-2 md:p-4 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 px-4 mb-2 truncate font-medium hidden md:block" title={user?.email}>
                        Signed in as: {user?.email}
                    </p>
                    <Link to="/" className="flex items-center justify-center md:justify-start gap-3 px-3 py-3 md:px-4 md:py-3 text-sm font-medium text-slate-500 hover:text-[var(--theme-primary)] transition-colors mb-2" title="View Site">
                        <Home size={18} /> <span className="hidden md:block">View Site</span>
                    </Link>
                    <button onClick={logout} className="w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 md:px-4 md:py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Sign Out">
                        <LogOut size={18} /> <span className="hidden md:block">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-20 md:ml-64 p-4 md:p-8 min-h-screen overflow-y-auto w-full overflow-x-hidden">
                <div className="max-w-4xl mx-auto">
                    <header className="mb-3 flex justify-between items-end">
                        <div>
                            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{currentTabTitle}</h1>
                        </div>
                    </header>

                    {/* Demos Tab */}
                    {activeTab === "demos" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <form onSubmit={(e) => { e.preventDefault(); addItem("demos", newDemo, () => setNewDemo({ name: "", url: "" })); }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <FormInput label="Demo Name" placeholder="e.g. Commercial" value={newDemo.name} onChange={v => setNewDemo({ ...newDemo, name: v })} />
                                <div className="flex gap-2 items-end">
                                    <FormInput label="Audio URL" placeholder="https://..." value={newDemo.url} onChange={v => setNewDemo({ ...newDemo, url: v })} containerClass="flex-1" />
                                    <FileUploader folder="demos" accept="audio/*" onUploadComplete={(url) => setNewDemo(prev => ({ ...prev, url }))} />
                                </div>
                                <button type="submit" disabled={uploading || !newDemo.name || !newDemo.url} className="text-white py-3 px-6 rounded-xl font-semibold transition-all disabled:opacity-50 bg-[var(--theme-primary)] hover:opacity-90 shadow-lg shadow-[var(--theme-primary)]/30">Add Demo</button>
                            </form>

                            <ItemList items={demos} collName="demos" onReorder={(newItems) => handleReorder("demos", newItems)} onDelete={deleteItem} editingId={editingId} setEditingId={setEditingId} editForm={editForm} setEditForm={setEditForm} onSave={updateItem} onCancel={() => setEditingId(null)} fields={[{ key: 'name', label: 'Name' }, { key: 'url', label: 'Audio URL' }]}
                                extraActions={(item) => (
                                    <button
                                        onClick={() => setClipModal({ isOpen: true, demo: item })}
                                        className="p-2 text-slate-300 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        title="Manage Clips"
                                    >
                                        <Scissors size={18} />
                                    </button>
                                )}
                            />

                        </div>
                    )}

                    {/* Videos Tab */}
                    {activeTab === "videos" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <form onSubmit={(e) => { e.preventDefault(); addItem("videos", newVideo, () => setNewVideo({ youtubeId: "", title: "" })); }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                                <div className="space-y-4">
                                    <FormInput
                                        label="YouTube Video ID or URL"
                                        placeholder="Paste YouTube URL (title will auto-fetch)"
                                        value={newVideo.youtubeId}
                                        onChange={v => setNewVideo({ ...newVideo, youtubeId: v })}
                                    />
                                    <FormInput
                                        label="Video Title (auto-fetched)"
                                        placeholder="Will be fetched automatically"
                                        value={newVideo.title}
                                        onChange={v => setNewVideo({ ...newVideo, title: v })}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={uploading || !newVideo.youtubeId || fetchingTitle}
                                    className="text-white py-3 px-8 rounded-xl font-semibold transition-all disabled:opacity-50 bg-[var(--theme-primary)] hover:opacity-90 shadow-lg shadow-[var(--theme-primary)]/30"
                                >
                                    {fetchingTitle ? 'Fetching Title...' : 'Add Project'}
                                </button>
                            </form>
                            <ItemList items={videos} collName="videos" onReorder={(newItems) => handleReorder("videos", newItems)} onDelete={deleteItem} editingId={editingId} setEditingId={setEditingId} editForm={editForm} setEditForm={setEditForm} onSave={updateItem} onCancel={() => setEditingId(null)} fields={[{ key: 'title', label: 'Title' }, { key: 'youtube_id', label: 'YouTube ID' }]} />
                        </div>
                    )}

                    {/* Studio Tab */}
                    {activeTab === "studio" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <form onSubmit={(e) => { e.preventDefault(); addItem("studio", newStudio, () => setNewStudio({ name: "", url: "" })); }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <FormInput label="Gear Name" placeholder="e.g. Neumann TLM 103" value={newStudio.name} onChange={v => setNewStudio({ ...newStudio, name: v })} />
                                <div className="flex gap-2 items-end">
                                    <FormInput label="Image URL" placeholder="https://..." value={newStudio.url} onChange={v => setNewStudio({ ...newStudio, url: v })} containerClass="flex-1" />
                                    <FileUploader folder="studio" accept="image/*" onUploadComplete={(url) => setNewStudio(prev => ({ ...prev, url }))} />
                                </div>
                                <button type="submit" disabled={uploading || !newStudio.name || !newStudio.url} className="text-white py-3 px-6 rounded-xl font-semibold transition-all disabled:opacity-50 bg-[var(--theme-primary)] hover:opacity-90 shadow-lg shadow-[var(--theme-primary)]/30">Add Gear</button>
                            </form>
                            <ItemList items={studio} collName="studio" onReorder={(newItems) => handleReorder("studio", newItems)} onDelete={deleteItem} editingId={editingId} setEditingId={setEditingId} editForm={editForm} setEditForm={setEditForm} onSave={updateItem} onCancel={() => setEditingId(null)} fields={[{ key: 'name', label: 'Gear Name' }, { key: 'url', label: 'Image URL' }]} />
                        </div>
                    )}

                    {/* Clients Tab */}
                    {activeTab === "clients" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <form onSubmit={(e) => { e.preventDefault(); addItem("clients", newClient, () => setNewClient({ url: "" })); }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 items-end">
                                <div className="flex-1 flex gap-4 items-end w-full">
                                    <FormInput label="Client Logo URL" placeholder="https://..." value={newClient.url} onChange={v => setNewClient({ ...newClient, url: v })} containerClass="flex-1" />
                                    <FileUploader folder="clients" accept="image/*" onUploadComplete={(url) => setNewClient(prev => ({ ...prev, url }))} />
                                </div>
                                <button type="submit" disabled={uploading || !newClient.url} className="text-white py-3 px-8 rounded-xl font-semibold transition-all disabled:opacity-50 bg-[var(--theme-primary)] hover:opacity-90 shadow-lg shadow-[var(--theme-primary)]/30 w-full md:w-auto">Add Client</button>
                            </form>

                            <div className="flex items-center justify-between px-6 py-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                <div className="flex items-center gap-2">
                                    <Settings size={14} className="text-slate-400" />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Logo Filter</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-tight cursor-pointer">All Grayscale</label>
                                    <Toggle
                                        checked={siteContent.clientsGrayscale}
                                        onChange={async (checked) => {
                                            // 1. Update local state immediately
                                            setSiteContent(prev => ({ ...prev, clientsGrayscale: checked }));

                                            // 2. Persist to DB
                                            try {
                                                const { error } = await (supabase.from('site_settings' as any) as any).upsert({
                                                    user_id: user!.id,
                                                    clients_grayscale: checked
                                                }, { onConflict: 'user_id' });

                                                if (error) throw error;
                                                showToast("Global filter updated", "success");
                                            } catch (err) {
                                                console.error("Failed to save global grayscale:", err);
                                                showToast("Fix: You might need to run the SQL migration for 'clients_grayscale'.", "error");
                                                // Revert local state on error
                                                fetchData();
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            <ItemList
                                items={clients}
                                collName="clients"
                                onReorder={(newItems) => handleReorder("clients", newItems)}
                                onDelete={deleteItem}
                                editingId={editingId}
                                setEditingId={setEditingId}
                                editForm={editForm}
                                setEditForm={setEditForm}
                                onSave={updateItem}
                                onCancel={() => setEditingId(null)}
                                fields={[
                                    { key: 'url', label: 'Logo URL' }
                                ]}
                            />
                        </div>
                    )}

                    {/* Reviews Tab */}
                    {activeTab === "reviews" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <form onSubmit={(e) => { e.preventDefault(); addItem("reviews", newReview, () => setNewReview({ text: "", author: "" })); }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 grid gap-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormInput label="Review Text" textarea value={newReview.text} onChange={v => setNewReview({ ...newReview, text: v })} />
                                    <FormInput label="Author Name" value={newReview.author} onChange={v => setNewReview({ ...newReview, author: v })} />
                                </div>
                                <button type="submit" disabled={uploading || !newReview.text || !newReview.author} className="text-white py-3 px-8 rounded-xl font-semibold transition-all self-end disabled:opacity-50 bg-[var(--theme-primary)] hover:opacity-90 shadow-lg shadow-[var(--theme-primary)]/30">Add Review</button>
                            </form>
                            <ItemList items={reviews} collName="reviews" onReorder={(newItems) => handleReorder("reviews", newItems)} onDelete={deleteItem} editingId={editingId} setEditingId={setEditingId} editForm={editForm} setEditForm={setEditForm} onSave={updateItem} onCancel={() => setEditingId(null)} fields={[{ key: 'text', label: 'Review' }, { key: 'author', label: 'Author' }]} />
                        </div>
                    )}

                    {/* Messages Tab */}
                    {activeTab === "messages" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                                {messages.length === 0 ? (
                                    <div className="p-16 text-center text-slate-400 font-medium">
                                        No messages yet.
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <div key={msg.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-lg">{msg.name}</h3>
                                                    <a href={`mailto:${msg.email}`} className="text-sm text-[var(--theme-primary)] hover:underline font-medium">{msg.email}</a>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs text-slate-400 font-medium">{new Date(msg.created_at).toLocaleDateString()}</span>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm("Delete this message?")) {
                                                                const { error } = await supabase.from('messages').delete().eq('id', msg.id);
                                                                if (error) showToast("Error deleting: " + error.message, "error");
                                                                else fetchData();
                                                            }
                                                        }}
                                                        className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                                                {msg.message}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Custom Domains Tab */}
                    {activeTab === "domains" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                                <h2 className="text-xl font-bold text-slate-900 mb-2">Connect Your Domain</h2>
                                <p className="text-slate-500 mb-6">Use your own domain (e.g., yourname.com) for your site.</p>

                                <form onSubmit={handleAddDomain} className="flex gap-4 items-end mb-8">
                                    <FormInput
                                        label="Domain Name"
                                        placeholder="e.g. example.com"
                                        value={newDomain}
                                        onChange={setNewDomain}
                                        containerClass="flex-1"
                                    />
                                    <button
                                        type="submit"
                                        disabled={uploading || !newDomain}
                                        className="bg-[var(--theme-primary)] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-[var(--theme-primary)]/20"
                                    >
                                        Add Domain
                                    </button>
                                </form>

                                <div className="space-y-4">
                                    {customDomains.length === 0 ? (
                                        <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                                            No custom domains connected yet.
                                        </div>
                                    ) : (
                                        customDomains.map(domain => (
                                            <div key={domain.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Globe size={18} className="text-slate-400" />
                                                        <span className="font-bold text-slate-700">{domain.domain}</span>
                                                        {domain.verified ? (
                                                            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                                                <CheckCircle size={12} /> Verified
                                                            </span>
                                                        ) : (
                                                            <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                                                <AlertCircle size={12} /> Unverified
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    setUploading(true);
                                                                    const result = await addCustomDomain(domain.domain);
                                                                    if (result.success) {
                                                                        if (result.data?.warning) {
                                                                            showToast(`Saved, but: ${result.data.warning}`, "error");
                                                                        } else {
                                                                            showToast("Domain status refreshed", "success");
                                                                        }
                                                                        fetchData();
                                                                    } else {
                                                                        const errMsg = result.error instanceof Error ? result.error.message : (typeof result.error === 'string' ? result.error : "Failed to refresh");
                                                                        showToast(errMsg, "error");
                                                                    }
                                                                } catch (err: any) {
                                                                    showToast(err.message || "An unexpected error occurred", "error");
                                                                } finally {
                                                                    setUploading(false);
                                                                }
                                                            }}
                                                            className="text-xs font-bold text-slate-500 hover:text-[var(--theme-primary)] px-3 py-2 flex items-center gap-1"
                                                            disabled={uploading}
                                                        >
                                                            <RefreshCw size={12} className={uploading ? "animate-spin" : ""} /> Refresh Status
                                                        </button>
                                                        {!domain.verified && (
                                                            <button
                                                                onClick={() => handleCheckVerification(domain)}
                                                                className="text-xs font-bold text-[var(--theme-primary)] hover:underline px-3 py-2"
                                                            >
                                                                Check Verification
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => deleteItem('custom_domains', domain.id)}
                                                            className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {!domain.verified && (
                                                    <div className="p-4 bg-white space-y-4">
                                                        <div className="text-sm text-slate-600">
                                                            {(domain.ownership_value || domain.verification_token) ? (
                                                                <>To verify ownership, add these records to your DNS provider (e.g. <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-[var(--theme-primary)] hover:underline font-medium">Cloudflare</a>, GoDaddy).</>
                                                            ) : (
                                                                <span className="text-amber-600 flex items-center gap-2">
                                                                    <AlertCircle size={16} />
                                                                    <span>
                                                                        <b>Manual Setup Required:</b> We couldn't generate automatic verification tokens.
                                                                        Please add the CNAME record below. If it doesn't verify within 24 hours (or if your site doesn't load), please contact support.
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {/* CNAME RECORD */}
                                                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                                                                <div>
                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                                                                        <span>CNAME Record</span>
                                                                        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium normal-case">DNS Only</span>
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        <div className="space-y-1">
                                                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Host</span>
                                                                            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-100 group">
                                                                                <span className="font-mono text-xs text-slate-800">@</span>
                                                                                <button onClick={() => { navigator.clipboard.writeText("@"); showToast("Copied Host", "success"); }} className="text-slate-300 hover:text-[var(--theme-primary)] transition-colors opacity-0 group-hover:opacity-100"><Copy size={14} /></button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Target</span>
                                                                            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-100 group">
                                                                                <span className="font-mono text-xs text-slate-800">built.at</span>
                                                                                <button onClick={() => { navigator.clipboard.writeText("built.at"); showToast("Copied Target", "success"); }} className="text-slate-300 hover:text-[var(--theme-primary)] transition-colors opacity-0 group-hover:opacity-100"><Copy size={14} /></button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* OWNERSHIP TXT RECORD */}
                                                            {(domain.ownership_value || domain.verification_token) && (
                                                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                                                                    <div>
                                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ownership TXT</div>
                                                                        <div className="space-y-3">
                                                                            <div className="space-y-1">
                                                                                <span className="text-[10px] text-slate-400 uppercase font-bold">Name</span>
                                                                                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-100 group">
                                                                                    <span className="font-mono text-[11px] text-slate-800 truncate pr-2">{domain.ownership_name || `_cf-custom-hostname`}</span>
                                                                                    <button onClick={() => { navigator.clipboard.writeText(domain.ownership_name || `_cf-custom-hostname`); showToast("Copied Name", "success"); }} className="text-slate-300 hover:text-[var(--theme-primary)] transition-colors opacity-0 group-hover:opacity-100 shrink-0"><Copy size={14} /></button>
                                                                                </div>
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <span className="text-[10px] text-slate-400 uppercase font-bold">Value</span>
                                                                                <div className="flex items-start justify-between bg-white px-3 py-2 rounded-lg border border-slate-100 group min-h-[60px]">
                                                                                    <span className="font-mono text-[10px] text-slate-600 break-all leading-relaxed">
                                                                                        {domain.ownership_value || domain.verification_token}
                                                                                    </span>
                                                                                    <button onClick={() => { navigator.clipboard.writeText(domain.ownership_value || domain.verification_token); showToast("Copied Value", "success"); }} className="text-slate-300 hover:text-[var(--theme-primary)] transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"><Copy size={14} /></button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* SSL RECORD (TXT or CNAME) */}
                                                            {domain.ssl_name && (domain.ownership_value || domain.verification_token) && (
                                                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                                                                    <div>
                                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                                                                            <span>SSL Validation {domain.ssl_value?.includes('.cloudflare.com') ? 'CNAME' : 'TXT'}</span>
                                                                            {domain.ssl_value?.includes('.cloudflare.com') && (
                                                                                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium normal-case">CNAME</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="space-y-3">
                                                                            <div className="space-y-1">
                                                                                <span className="text-[10px] text-slate-400 uppercase font-bold">Name</span>
                                                                                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-100 group">
                                                                                    <span className="font-mono text-[11px] text-slate-800 truncate pr-2">{domain.ssl_name}</span>
                                                                                    <button onClick={() => { navigator.clipboard.writeText(domain.ssl_name); showToast("Copied Name", "success"); }} className="text-slate-300 hover:text-[var(--theme-primary)] transition-colors opacity-0 group-hover:opacity-100 shrink-0"><Copy size={14} /></button>
                                                                                </div>
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <span className="text-[10px] text-slate-400 uppercase font-bold">Value</span>
                                                                                <div className="flex items-start justify-between bg-white px-3 py-2 rounded-lg border border-slate-100 group min-h-[60px]">
                                                                                    <span className="font-mono text-[10px] text-slate-600 break-all leading-relaxed">
                                                                                        {domain.ssl_value}
                                                                                    </span>
                                                                                    <button onClick={() => { navigator.clipboard.writeText(domain.ssl_value); showToast("Copied Value", "success"); }} className="text-slate-300 hover:text-[var(--theme-primary)] transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"><Copy size={14} /></button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-400 italic">
                                                            Note: DNS changes can take up to 48 hours to propagate, though it's usually much faster.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Site Content Tab */}
                    {activeTab === "content" && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <form onSubmit={saveSettings} className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <Section title="Hero Section" icon={<Settings size={18} />}>
                                        <div className="space-y-6">

                                            <Field label="Site Name" value={siteContent.siteName} onChange={v => setSiteContent({ ...siteContent, siteName: v })} />
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Hero Title</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={siteContent.heroTitle || ""}
                                                        onChange={(e) => setSiteContent({ ...siteContent, heroTitle: e.target.value })}
                                                        className="flex-1 h-11 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)] transition-all font-medium text-slate-700 bg-slate-50 placeholder:text-slate-300"
                                                        placeholder="e.g. Saying Things"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setSiteContent({ ...siteContent, showHeroTitle: !(siteContent.showHeroTitle !== false) })}
                                                        className={`w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 transition-colors ${siteContent.showHeroTitle !== false ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-50' : 'bg-slate-100 text-slate-400'}`}
                                                        title={siteContent.showHeroTitle !== false ? "Hide Title" : "Show Title"}
                                                    >
                                                        {siteContent.showHeroTitle !== false ? <Eye size={20} /> : <EyeOff size={20} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Hero Subtitle</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={siteContent.heroSubtitle || ""}
                                                        onChange={(e) => setSiteContent({ ...siteContent, heroSubtitle: e.target.value })}
                                                        className="flex-1 h-11 px-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)] transition-all font-medium text-slate-700 bg-slate-50 placeholder:text-slate-300"
                                                        placeholder="e.g. Bring your script to life"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setSiteContent({ ...siteContent, showHeroSubtitle: !(siteContent.showHeroSubtitle !== false) })}
                                                        className={`w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 transition-colors ${siteContent.showHeroSubtitle !== false ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-50' : 'bg-slate-100 text-slate-400'}`}
                                                        title={siteContent.showHeroSubtitle !== false ? "Hide Subtitle" : "Show Subtitle"}
                                                    >
                                                        {siteContent.showHeroSubtitle !== false ? <Eye size={20} /> : <EyeOff size={20} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="Layout Order" icon={<Share2 size={18} />}>
                                        <div className="space-y-3">
                                            <p className="text-sm text-slate-500">Rearrange the order of sections on your home page.</p>
                                            <div className="space-y-2">
                                                <Reorder.Group axis="y" values={siteContent.sectionOrder} onReorder={(newOrder) => setSiteContent({ ...siteContent, sectionOrder: newOrder })}>
                                                    {siteContent.sectionOrder.map((section) => (
                                                        <Reorder.Item key={section} value={section}>
                                                            <div className={`flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 mb-2 cursor-move hover:bg-slate-100 transition-colors ${(siteContent.hiddenSections || []).includes(section) ? 'opacity-60 border-dashed bg-slate-100' : ''}`}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-slate-300"><GripVertical size={18} /></div>
                                                                    <span className="font-medium text-slate-700 capitalize">{section}</span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = siteContent.hiddenSections || [];
                                                                        const newHidden = current.includes(section)
                                                                            ? current.filter(s => s !== section)
                                                                            : [...current, section];
                                                                        setSiteContent({ ...siteContent, hiddenSections: newHidden });
                                                                    }}
                                                                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 transition-colors"
                                                                    title={(siteContent.hiddenSections || []).includes(section) ? "Show section" : "Hide section"}
                                                                >
                                                                    {(siteContent.hiddenSections || []).includes(section) ? <EyeOff size={18} /> : <Eye size={18} />}
                                                                </button>
                                                            </div>
                                                        </Reorder.Item>
                                                    ))}
                                                </Reorder.Group>
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="Theme & Appearance" icon={<Settings size={18} />}>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={siteContent.themeColor || "#4f46e5"}
                                                        onChange={e => setSiteContent({ ...siteContent, themeColor: e.target.value })}
                                                        className="h-12 w-12 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={siteContent.themeColor || "#4f46e5"}
                                                        onChange={e => setSiteContent({ ...siteContent, themeColor: e.target.value })}
                                                        placeholder="#000000"
                                                        className="h-12 w-28 px-3 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-700 outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-tight">Primary Brand Color</label>
                                                    <p className="text-sm text-slate-500">Pick a color or enter hex code.</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-tight">Website Font</label>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {fonts.map(f => (
                                                        <button
                                                            key={f.value}
                                                            type="button"
                                                            onClick={() => { setSiteContent({ ...siteContent, font: f.value }); applyFont(f.value); }}
                                                            className={`p-3 rounded-lg border text-sm text-center transition-all ${siteContent.font === f.value ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/5 text-[var(--theme-primary)] font-semibold ring-2 ring-[var(--theme-primary)]/20' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                                                            style={{ fontFamily: f.value }}
                                                        >
                                                            {f.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>



                                            <div className="space-y-4 pt-4 border-t border-slate-50">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <label className="block text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-tight">Custom Favicon</label>
                                                        <p className="text-xs text-slate-500">The small icon in the browser tab (.ico, .png)</p>
                                                    </div>
                                                    {siteContent.favicon && (
                                                        <img src={siteContent.favicon} alt="Favicon" className="w-8 h-8 rounded-md bg-slate-50 border border-slate-200 object-contain" />
                                                    )}
                                                </div>
                                                <FileUploader
                                                    onUploadComplete={(url) => setSiteContent({ ...siteContent, favicon: url })}
                                                    folder="favicons"
                                                    accept="image/x-icon,image/png,image/svg+xml,image/jpeg,image/jpg"
                                                />
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="About & Images" icon={<Info size={18} />}>
                                        <div className="space-y-6">
                                            <Field label="About Title" value={siteContent.aboutTitle} onChange={v => setSiteContent({ ...siteContent, aboutTitle: v })} />
                                            <Field label="About Text" textarea value={siteContent.aboutText} onChange={v => setSiteContent({ ...siteContent, aboutText: v })} />
                                            <div className="flex flex-col gap-8 pt-2">
                                                <div className="space-y-3">
                                                    <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-tight">Profile Photo</label>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-24 h-24 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                                                            {siteContent.profileImage ? <img src={siteContent.profileImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Users size={32} /></div>}
                                                        </div>
                                                        <div className="flex-1">
                                                            <FileUploader folder="images" accept="image/*" onUploadComplete={(url) => setSiteContent(prev => ({ ...prev, profileImage: url }))} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-tight">Cartoon Avatar</label>
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-[10px] font-medium text-slate-500 cursor-pointer">Show on site</label>
                                                            <Toggle checked={siteContent.showCartoon} onChange={(checked) => setSiteContent({ ...siteContent, showCartoon: checked })} />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-200 flex-shrink-0 p-3">
                                                            {siteContent.profileCartoon ? <img src={siteContent.profileCartoon} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Mic size={32} /></div>}
                                                        </div>
                                                        <div className="flex-1">
                                                            <FileUploader folder="images" accept="image/*" onUploadComplete={(url) => setSiteContent(prev => ({ ...prev, profileCartoon: url }))} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="Contact Info" icon={<Contact size={18} />}>
                                        <div className="space-y-3">
                                            <Field label="Email Address" value={siteContent.contactEmail} onChange={v => setSiteContent({ ...siteContent, contactEmail: v })} />
                                            <Field label="Phone Number" value={siteContent.contactPhone} onChange={v => setSiteContent({ ...siteContent, contactPhone: v })} />
                                            <div className="pt-4 border-t border-slate-50 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Contact Form</label>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">Show contact form on your site</p>
                                                    </div>
                                                    <Toggle checked={siteContent.showContactForm} onChange={(checked) => setSiteContent({ ...siteContent, showContactForm: checked })} />
                                                </div>
                                                {siteContent.showContactForm && (
                                                    <div>
                                                        <Field label="Email Notification Key (Web3Forms)" value={siteContent.web3FormsKey} onChange={v => setSiteContent({ ...siteContent, web3FormsKey: v })} />
                                                        <p className="text-[10px] text-slate-400 mt-1">Get a free key at <a href="https://web3forms.com" target="_blank" className="text-[var(--theme-primary)] hover:underline">web3forms.com</a> to receive form submissions via email.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Section>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button type="button" onClick={saveSettings} disabled={uploading} className="w-full flex items-center justify-center gap-2 text-white py-4 px-6 rounded-2xl font-medium text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 bg-[var(--theme-primary)] shadow-lg shadow-[var(--theme-primary)]/20">
                                        <Save size={20} /> {uploading ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                                <div className="h-20"></div>
                            </form>
                        </div>
                    )
                    }
                </div >
            </main >

            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                onConfirm={confirmDelete}
            />

            <ClipModal
                isOpen={clipModal.isOpen}
                demo={clipModal.demo}
                onClose={() => {
                    setClipModal({ ...clipModal, isOpen: false });
                    fetchData(); // Refresh to get updated clips
                }}
                showToast={showToast}
                waveformCache={waveformCache.current}
            />

            {
                toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )
            }
        </div >
    );
}
