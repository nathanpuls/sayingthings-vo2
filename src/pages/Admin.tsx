import { useState, useEffect, useRef, useCallback, ReactNode, ChangeEvent } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import {
    Trash2, Edit2, Save, X, LogOut, LogIn, UploadCloud,
    Home, Music, Video, Mic, Users, Scissors, Play, Pause, FastForward, Rewind,
    MessageSquare, Contact, Info, Settings, Share2, GripVertical, Mail, Globe, CheckCircle, AlertCircle, Copy, Eye, EyeOff, RefreshCw, Check
} from "lucide-react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { getUserCustomDomains, addCustomDomain, verifyDomainOwnership } from "../lib/domains";
import { fonts, applyFont, loadAllFonts } from "../lib/fonts";
import { Database } from "../lib/database.types";
import { User as SupabaseUser } from "@supabase/supabase-js";

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
}

// const authorizedEmail = "natepuls@gmail.com";
const authorizedEmail = ""; // Disabled for multi-user support

// Helper Component Props
interface FormInputProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    textarea?: boolean;
    type?: string;
    containerClass?: string;
}

// Global utility for audio URLs
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

// Move FormInput/FileUploader/Toggle/SectionReorder/ItemList definitions later or type them inline if they are in this file.
// Assuming they are defined at bottom of file. Need to update their signatures.

export default function Admin() {
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("demos");
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        favicon: ""
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
                favicon: settings.favicon || ""
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
                redirectTo: window.location.origin + '/admin'
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
                favicon: siteContent.favicon
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
                    <div className="px-3 h-8 rounded-lg flex items-center justify-center text-white font-bold italic shadow-lg shadow-black/5 bg-[var(--theme-primary)]">B</div>
                    <span className="font-bold text-slate-800 tracking-tight text-lg hidden md:block">Admin</span>
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
                    <Link to={user ? `/u/${user.id}` : "/"} className="flex items-center justify-center md:justify-start gap-3 px-3 py-3 md:px-4 md:py-3 text-sm font-medium text-slate-500 hover:text-[var(--theme-primary)] transition-colors mb-2" title="View Site">
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
                                            <Field label="Hero Title" value={siteContent.heroTitle} onChange={v => setSiteContent({ ...siteContent, heroTitle: v })} />
                                            <Field label="Hero Subtitle" value={siteContent.heroSubtitle} onChange={v => setSiteContent({ ...siteContent, heroSubtitle: v })} />
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
                                                <input
                                                    type="color"
                                                    value={siteContent.themeColor || "#4f46e5"}
                                                    onChange={e => setSiteContent({ ...siteContent, themeColor: e.target.value })}
                                                    className="h-12 w-24 p-1 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                                                />
                                                <div>
                                                    <label className="block text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-tight">Primary Brand Color</label>
                                                    <p className="text-sm text-slate-500">Pick a color for buttons and highlights.</p>
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
                                                    accept="image/x-icon,image/png,image/svg+xml"
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

interface FileUploaderProps {
    onUploadComplete: (url: string) => void;
    folder?: string;
    accept?: string;
}

function FileUploader({ onUploadComplete, folder = "misc", accept = "*" }: FileUploaderProps) {
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            const file = e.target.files?.[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${folder}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('uploads')
                .getPublicUrl(filePath);

            onUploadComplete(publicUrl);
        } catch (error: any) {
            console.error("Upload error:", error);
            alert("Upload failed: " + error.message + "\n\nMake sure you have a public 'uploads' bucket in Supabase Storage with proper policies.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <label className="cursor-pointer flex items-center justify-center gap-2 p-3 text-slate-500 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5 rounded-xl transition-all border border-dashed border-slate-300 hover:border-[var(--theme-primary)] h-[46px]">
            {uploading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--theme-primary)] border-t-transparent"></div>
            ) : (
                <UploadCloud size={20} />
            )}
            <span className="text-sm font-semibold">{uploading ? "Uploading..." : "Upload File"}</span>
            <input type="file" className="hidden" onChange={handleFileChange} disabled={uploading} accept={accept} />
        </label>
    );
}

interface ItemListProps {
    items: any[];
    collName: string;
    onReorder: (newItems: any[]) => void;
    onDelete: (collName: string, id: string) => void;
    editingId: string | null;
    setEditingId: (id: string | null) => void;
    editForm: any;
    setEditForm: (form: any) => void;
    onSave: (collName: string, id: string, payload?: any) => void;
    onCancel: () => void;
    fields: { key: string; label: string; type?: string }[];
    extraActions?: (item: any) => ReactNode;
}

function ItemList({ items, collName, onReorder, onDelete, editingId, setEditingId, editForm, setEditForm, onSave, onCancel, fields, extraActions }: ItemListProps) {
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const toggleAudio = (id: string, url: string) => {
        if (playingId === id) {
            audioRef.current?.pause();
            setPlayingId(null);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = getPlayableUrl(url);
            } else {
                audioRef.current = new Audio(getPlayableUrl(url));
                audioRef.current.onended = () => setPlayingId(null);
            }
            audioRef.current.play();
            setPlayingId(id);
        }
    };

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            {items.length === 0 && (
                <div className="p-16 text-center text-slate-400 font-medium">
                    No items found in this section.
                </div>
            )}
            <Reorder.Group axis="y" values={items} onReorder={onReorder}>
                {items.map((item) => (
                    <Reorder.Item key={item.id} value={item} className="bg-white" layout="position">
                        <div className="p-4 flex items-center gap-3 group hover:bg-slate-50/50 transition-colors">
                            <div className="flex flex-col gap-1 border-r border-slate-100 pr-3 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                                <GripVertical size={20} />
                            </div>

                            {/* Preview Column - for videos, studio, clients, and demos */}
                            {(collName === 'videos' || collName === 'studio' || collName === 'clients' || collName === 'demos') && (
                                <div className="w-24 h-16 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
                                    {collName === 'videos' && (item.youtubeId || item.youtube_id) && (
                                        <img
                                            src={`https://img.youtube.com/vi/${item.youtubeId || item.youtube_id}/mqdefault.jpg`}
                                            alt="Video thumbnail"
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                    {collName === 'studio' && item.url && (
                                        <img
                                            src={item.url}
                                            alt={item.name}
                                            className="w-full h-full object-contain p-2"
                                            onError={(e) => { e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-xs">No preview</div>'; }}
                                        />
                                    )}
                                    {collName === 'clients' && item.url && (
                                        <img
                                            src={item.url}
                                            alt="Client logo"
                                            className="w-full h-full object-contain p-2"
                                            onError={(e) => { e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-xs">No preview</div>'; }}
                                        />
                                    )}
                                    {collName === 'demos' && item.url && (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-50 transition-colors">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); toggleAudio(item.id, item.url); }}
                                                className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-[var(--theme-primary)] hover:scale-110 transition-all border border-slate-100"
                                            >
                                                {playingId === item.id ? <Pause size={16} fill="currentColor" /> : <Play size={16} className="ml-0.5" fill="currentColor" />}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex-1 min-w-0">
                                <AnimatePresence mode="wait">
                                    {editingId === item.id ? (
                                        <motion.div
                                            key="edit"
                                            initial={{ opacity: 0, scale: 0.98, y: -4 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.98, y: -4 }}
                                            transition={{ duration: 0.2 }}
                                            className="space-y-4 py-2"
                                        >
                                            {fields.map(f => (
                                                <div key={f.key}>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase block mb-1">{f.label}</label>
                                                    {f.type === 'boolean' ? (
                                                        <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 w-fit">
                                                            <span className="text-xs font-medium text-slate-600">On / Off</span>
                                                            <Toggle
                                                                checked={editForm[f.key]}
                                                                onChange={(checked) => setEditForm({ ...editForm, [f.key]: checked })}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={editForm[f.key] || ""}
                                                            onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)] text-xs"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="display"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="py-1"
                                        >
                                            {/* Special display for videos - show YouTube title */}
                                            {collName === 'videos' && (item.youtubeId || item.youtube_id) ? (
                                                <div className="font-medium text-slate-800 text-sm">
                                                    {item.title || 'YouTube Video'}
                                                </div>
                                            ) : (
                                                /* Default display for other types */
                                                fields.map((f, i) => {
                                                    if (i > 0) return null;
                                                    let displayValue = item[f.key];
                                                    if (collName === 'clients' && f.key === 'url' && displayValue) {
                                                        let fileName = displayValue.split('/').pop().split('?')[0];
                                                        // Remove timestamp prefix if it follows the pattern 123456789_
                                                        fileName = fileName.replace(/^\d+_/, '');
                                                        // Remove extension
                                                        fileName = fileName.split('.').slice(0, -1).join('.');
                                                        // Replace hyphens and underscores with spaces, then capitalize
                                                        displayValue = fileName.split(/[-_]/).map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                                    }
                                                    return (
                                                        <div key={f.key} className="flex items-center gap-2">
                                                            {f.type === 'boolean' ? (
                                                                <>
                                                                    <Toggle
                                                                        checked={item[f.key]}
                                                                        onChange={(checked) => onSave(collName, item.id, { ...item, [f.key]: checked })}
                                                                    />
                                                                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">
                                                                        {item[f.key] ? "Black & White" : "Original Color"}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <div className="font-medium text-slate-800 text-sm truncate">{displayValue}</div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="flex gap-1">
                                {extraActions && !editingId && extraActions(item)}
                                {editingId === item.id ? (
                                    <>
                                        <button onClick={() => onSave(collName, item.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-all"><Save size={20} /></button>
                                        <button onClick={onCancel} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"><X size={20} /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => { setEditingId(item.id); setEditForm(item); }} className="p-2 text-slate-300 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Edit2 size={18} /></button>
                                        <button onClick={() => onDelete(collName, item.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </div>
    );
}

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 ${checked ? 'bg-[var(--theme-primary)]' : 'bg-slate-200'}`}
        >
            <motion.div
                animate={{ x: checked ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-1 left-0 w-3 h-3 bg-white rounded-full shadow-sm"
            />
        </button>
    );
}


interface SectionProps {
    title: string;
    icon: ReactNode;
    children: ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
    return (
        <div className="space-y-3">
            <h3 className="flex items-center gap-3 text-sm font-medium text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">
                <span className="p-1.5 rounded-lg text-[var(--theme-primary)] bg-[var(--theme-primary)]/10">{icon}</span> {title}
            </h3>
            {children}
        </div>
    );
}

interface FieldProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    textarea?: boolean;
}

function Field({ label, value, onChange, textarea }: FieldProps) {
    return (
        <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-tight">{label}</label>
            {textarea ? (
                <textarea value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-[var(--theme-primary)]/10 focus:border-[var(--theme-primary)] outline-none transition-all h-40 leading-relaxed text-sm" />
            ) : (
                <input type="text" value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-[var(--theme-primary)]/10 focus:border-[var(--theme-primary)] outline-none transition-all text-sm" />
            )}
        </div>
    );
}

function FormInput({ label, value, onChange, placeholder, textarea, containerClass = "" }: FormInputProps) {
    return (
        <div className={containerClass}>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-tight">{label}</label>
            {textarea ? (
                <textarea placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white outline-none transition-all h-20 text-sm" />
            ) : (
                <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white outline-none transition-all text-sm" />
            )}
        </div>
    )
}


interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    itemName?: string;
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm }: DeleteConfirmModalProps) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-100 scale-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Item?</h3>
                <p className="text-slate-500 mb-6 text-sm">Are you sure you want to delete this item? This action cannot be undone.</p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg shadow-lg shadow-red-500/30 transition-all">Delete</button>
                </div>
            </div>
        </div>
    );
}

interface ToastProps {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
    // Timer is handled by the parent component now

    return (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl shadow-black/10 transition-all animate-in slide-in-from-top-5 fade-in duration-300 ${type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`}>
            <span className="font-medium">{message}</span>
            {type === 'error' && (
                <button
                    onClick={() => navigator.clipboard.writeText(message)}
                    className="p-1 hover:bg-white/20 rounded-md transition-colors opacity-80 hover:opacity-100"
                    title="Copy error to clipboard"
                >
                    <Copy size={16} />
                </button>
            )}
            <button onClick={onClose} className="opacity-80 hover:opacity-100"><X size={18} /></button>
        </div>
    );
}

interface ClipModalProps {
    isOpen: boolean;
    demo: Demo | null;
    onClose: () => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
    waveformCache: Map<string, AudioBuffer>;
}

function ClipModal({ isOpen, demo, onClose, showToast, waveformCache }: ClipModalProps) {
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
    const [bulkLabels, setBulkLabels] = useState("");
    const [showBulk, setShowBulk] = useState(false);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);

    // Sync bulk labels when opening the panel
    useEffect(() => {
        if (showBulk && clips) {
            setBulkLabels(clips.map(s => s.label).join('\n'));
        }
    }, [showBulk]);

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
        ctx.strokeStyle = '#6366f1'; // Indigo 500
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
                            <canvas
                                ref={canvasRef}
                                className="w-full h-full opacity-80 mix-blend-multiply"
                            />
                        </div>

                        {/* Progress Overlay */}
                        <div
                            className="absolute top-0 left-0 bottom-0 bg-[var(--theme-primary)]/20 pointer-events-none"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                        />

                        {/* Actual Scrubber Input */}
                        <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            step="0.01"
                            value={currentTime}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setCurrentTime(val);
                                if (audioRef.current) audioRef.current.currentTime = val;
                            }}
                            className="admin-scrubber absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer outline-none"
                            onMouseDown={() => setDraggingIdx(null)}
                        />
                    </div>

                    <button
                        onClick={addClipAtCurrentTime}
                        className="w-full py-4 bg-white/50 hover:bg-white border border-slate-200 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-3 hover:border-[var(--theme-primary)]/50 group text-slate-700 shadow-sm"
                    >
                        <Scissors size={20} className="text-[var(--theme-primary)] group-hover:scale-110 transition-transform" />
                        ADD CLIP AT <span className="text-[var(--theme-primary)]">{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}.{(currentTime % 1).toFixed(2).split('.')[1]}</span>
                        <span className="text-[10px] opacity-40 font-mono ml-2">(PRESS 'A')</span>
                    </button>
                </div>

                <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        {(Array.isArray(clips) ? clips : []).length} Clips Defined
                    </label>
                    <button
                        onClick={() => setShowBulk(!showBulk)}
                        className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 ${showBulk ? 'bg-[var(--theme-primary)] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        <Copy size={12} /> {showBulk ? 'Close Paste' : 'Bulk Paste Labels'}
                    </button>
                </div>

                {showBulk && (
                    <div className="mb-6 animate-in slide-in-from-top-2 duration-200">
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Paste tracklist / labels (One per line)</label>
                            <textarea
                                className="w-full h-32 bg-white border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none resize-none font-medium text-slate-800"
                                value={bulkLabels}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setBulkLabels(val);
                                    const lines = val.split('\n').filter(l => l.trim() !== "");
                                    setClips(prev => {
                                        // Sync the number of clips to match the number of lines
                                        return lines.map((line, i) => {
                                            if (prev[i]) {
                                                return { ...prev[i], label: line };
                                            }
                                            return { label: line, startTime: 0 };
                                        });
                                    });
                                }}
                            />
                            <p className="text-[10px] text-slate-400 mt-2 italic">Names will be applied to clips 1, 2, 3... in order.</p>
                        </div>
                    </div>
                )}

                <div className="flex justify-end items-center pt-6 border-t border-slate-100">
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 text-slate-500 font-semibold hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-8 py-2.5 bg-[var(--theme-primary)] hover:opacity-90 text-white font-bold rounded-xl shadow-lg shadow-[var(--theme-primary)]/20 transition-all active:scale-[0.98]"
                        >
                            {saving ? "Saving..." : "Save Clips"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
