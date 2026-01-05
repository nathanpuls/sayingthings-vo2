import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import {
    Trash2, Edit2, Plus, Save, X, LogOut, LogIn, UploadCloud,
    Home, ArrowUp, ArrowDown, Music, Video, Mic, Users,
    MessageSquare, Contact, Info, Settings, RefreshCcw, Database, Share2, Type, GripVertical
} from "lucide-react";
import { Reorder } from "framer-motion";
import { db as firebaseDb } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { demos as staticDemos } from "../content/demos";
import { fonts, applyFont, loadAllFonts } from "../lib/fonts";

// const authorizedEmail = "natepuls@gmail.com";
const authorizedEmail = ""; // Disabled for multi-user support

export default function Admin() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("demos");
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Data States
    const [demos, setDemos] = useState([]);
    const [videos, setVideos] = useState([]);
    const [studio, setStudio] = useState([]);
    const [clients, setClients] = useState([]);
    const [reviews, setReviews] = useState([]);
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
        themeColor: "#4f46e5",
        sectionOrder: ["demos", "projects", "studio", "clients", "reviews", "about", "contact"],
        font: "Outfit"
    });

    // Form States
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Create Form States
    const [newDemo, setNewDemo] = useState({ name: "", url: "" });
    const [newVideo, setNewVideo] = useState({ youtubeId: "", title: "" });
    const [newStudio, setNewStudio] = useState({ name: "", url: "" });
    const [newClient, setNewClient] = useState({ url: "" });
    const [newReview, setNewReview] = useState({ text: "", author: "" });
    const [fetchingTitle, setFetchingTitle] = useState(false);

    // Fetch YouTube video title
    const fetchYouTubeTitle = async (videoIdOrUrl) => {
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
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Data Fetcher
    const fetchData = async () => {
        if (!user) return;

        // Fetch ordered lists
        const fetchTable = async (table) => {
            const { data, error } = await supabase.from(table).select('*').order('order', { ascending: true });
            if (error) console.error(`Error fetching ${table}:`, error);
            return data || [];
        };

        setDemos(await fetchTable('demos'));
        setVideos(await fetchTable('videos'));
        setStudio(await fetchTable('studio_gear')); // note table name mapping
        setClients(await fetchTable('clients'));
        setReviews(await fetchTable('reviews'));

        // Fetch settings - singular row per user
        const { data: settings } = await supabase.from('site_settings').select('*').single();
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
                themeColor: settings.theme_color || "#4f46e5",
                sectionOrder: settings.section_order || ["demos", "projects", "studio", "clients", "reviews", "about", "contact"],
                font: settings.font || "Outfit"
            });
            // Apply font immediately just in case
            applyFont(settings.font || "Outfit");
        }
    };

    // Fetch data when user changes
    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    // ------------------------------------------------------------
    // Hash‑based routing for admin tabs (single source of truth)
    // ------------------------------------------------------------
    const tabs = [
        { id: "demos", name: "Demos", icon: <Music size={18} /> },
        { id: "videos", name: "Projects", icon: <Video size={18} /> },
        { id: "studio", name: "Studio", icon: <Mic size={18} /> },
        { id: "clients", name: "Clients", icon: <Users size={18} /> },
        { id: "reviews", name: "Reviews", icon: <MessageSquare size={18} /> },
        { id: "content", name: "Site Content", icon: <Settings size={18} /> },
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
    const handleTabClick = (tabId) => {
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
    const addItem = async (collName, data, resetter) => {
        setUploading(true);
        try {
            // Map logic names to DB table names if needed
            const tableName = collName === 'studio' ? 'studio_gear' : collName;

            // Get current list size for ordering
            const list = collName === "demos" ? demos : collName === "videos" ? videos : collName === "studio" ? studio : collName === "clients" ? clients : reviews;

            let finalData = { ...data, order: list.length, user_id: user.id };

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
            const dbPayload = {
                user_id: user.id,
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
            if (collName === 'clients') {
                // clients only has url
                delete dbPayload.name;
            }

            const { error } = await supabase.from(tableName).insert([dbPayload]);
            if (error) throw error;

            console.log(`✅ ${collName} item added successfully!`);
            resetter();
            fetchData(); // Refresh UI
        } catch (error) {
            console.error(`❌ Error adding ${collName}:`, error);
            showToast(`Error adding item: ` + error.message, "error");
        } finally {
            setUploading(false);
        }
    };

    const deleteItem = async (collName, id) => {
        if (!confirm("Are you sure?")) return;
        const tableName = collName === 'studio' ? 'studio_gear' : collName;
        try {
            const { error } = await supabase.from(tableName).delete().eq('id', id);
            if (error) throw error;
            fetchData();
        }
        catch (error) { showToast("Error deleting: " + error.message, "error"); }
    };

    const handleReorder = async (collName, newItems) => {
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

            const { error } = await supabase.from(tableName).upsert(updates);
            if (error) throw error;
        } catch (error) {
            console.error("Reorder failed:", error);
            showToast("Error saving order: " + error.message, "error");
            fetchData(); // Revert on error
        }
    };

    const updateItem = async (collName, id) => {
        setUploading(true);
        try {
            const { id: _, ...raw } = editForm;
            const tableName = collName === 'studio' ? 'studio_gear' : collName;

            // Map keys
            const dbPayload = {};
            if (collName === 'videos') {
                if (raw.title) dbPayload.title = raw.title;
                if (raw.youtubeId) dbPayload.youtube_id = raw.youtubeId;
            } else if (collName === 'reviews') {
                if (raw.text) dbPayload.text = raw.text;
                if (raw.author) dbPayload.author = raw.author;
            } else {
                if (raw.name) dbPayload.name = raw.name;
                if (raw.url) dbPayload.url = raw.url;
            }

            const { error } = await supabase.from(tableName).update(dbPayload).eq('id', id);
            if (error) throw error;

            setEditingId(null);
            fetchData();
        } catch (error) {
            showToast("Error updating: " + error.message, "error");
        } finally {
            setUploading(false);
        }
    };

    const saveSettings = async (e) => {
        if (e) e.preventDefault();
        setUploading(true);
        try {
            const payload = {
                user_id: user.id,
                hero_title: siteContent.heroTitle,
                hero_subtitle: siteContent.heroSubtitle,
                about_title: siteContent.aboutTitle,
                about_text: siteContent.aboutText,
                contact_email: siteContent.contactEmail,
                contact_phone: siteContent.contactPhone,
                site_name: siteContent.siteName,
                profile_image: siteContent.profileImage,
                profile_cartoon: siteContent.profileCartoon,
                theme_color: siteContent.themeColor,
                section_order: siteContent.sectionOrder,
                font: siteContent.font
            };

            const { error } = await supabase.from('site_settings').upsert(payload, { onConflict: 'user_id' });
            if (error) throw error;

            showToast("Site content saved successfully!");
        } catch (error) {
            console.error("Save failed:", error);
            showToast("Error saving settings: " + error.message, "error");
        } finally {
            setUploading(false);
        }
    };

    const handleRestoreAll = async () => {
        if (!confirm("This will overwrite your site settings and add initial demos, projects, reviews, and gear. Continue?")) return;

        console.log("🔄 Starting content restoration...");
        setUploading(true);

        try {
            // Check authentication
            if (!user) {
                throw new Error("You must be logged in to restore content");
            }

            console.log("✅ User authenticated:", user.email);

            // Helpers
            const clearTable = async (table) => {
                await supabase.from(table).delete().eq('user_id', user.id);
            };
            const insertMany = async (table, items) => {
                const { error } = await supabase.from(table).insert(items);
                if (error) throw error;
            };

            // 1. Demos
            await clearTable('demos');
            const demoRows = staticDemos.map((d, i) => ({
                user_id: user.id, name: d.name, url: d.url, order: i
            }));
            await insertMany('demos', demoRows);

            // 2. Videos
            await clearTable('videos');
            const videoRows = [
                { youtube_id: "lskrj62JbNI", title: "Freeletics Commercial" },
                { youtube_id: "C-GdK49QZVs", title: "Getinge Medical" },
                { youtube_id: "QVTGS9ZAk60", title: "Florida State Parks" },
                { youtube_id: "friJGg6UDvo", title: "FarmersOnly.com" }
            ].map((v, i) => ({ ...v, user_id: user.id, order: i }));
            await insertMany('videos', videoRows);

            // 3. Studio
            await clearTable('studio_gear');
            const studioRows = [
                { name: "Neumann TLM 103", url: "/studio-images/neumann-tlm-103.png" },
                { name: "Rode NTG-3", url: "/studio-images/rode-ntg-3.jpg" },
                { name: "Macbook Pro", url: "/studio-images/macbook-pro.png" },
                { name: "Apogee Duet", url: "/studio-images/apogee-duet.png" },
                { name: "Logic Pro X", url: "/studio-images/logic-pro-x.jpeg" },
                { name: "Source Connect", url: "/studio-images/source-connect.jpeg" },
            ].map((s, i) => ({ ...s, user_id: user.id, order: i }));
            await insertMany('studio_gear', studioRows);

            // 4. Clients
            await clearTable('clients');
            const clientRows = [
                "/client-images/apple.jpeg", "/client-images/farmers-only.jpeg", "/client-images/florida-state-parks.jpeg",
                "/client-images/freeletics.jpeg", "/client-images/gatorade.png", "/client-images/hp.jpeg",
                "/client-images/ziploc.jpeg", "/client-images/lavazza.jpeg", "/client-images/smart-design.jpeg",
                "/client-images/waste-management.jpeg"
            ].map((url, i) => ({ url, user_id: user.id, order: i }));
            await insertMany('clients', clientRows);

            // 5. Reviews
            await clearTable('reviews');
            const reviewRows = [
                { text: "Nathan is a joy to work with.", author: "BookheadEd Learning" },
                { text: "Above and beyond.", author: "Segal Benz" },
                { text: "Never thought of putting an accent on my recording.", author: "Mr. Wizard, Inc" },
                { text: "Fast delivery, followed direction perfectly!", author: "Sonya Fernandes" },
                { text: "Great flexibility and quality.", author: "Jasper Dekker / Smart Design" },
            ].map((r, i) => ({ ...r, user_id: user.id, order: i }));
            await insertMany('reviews', reviewRows);

            // 6. Settings
            const settingsPayload = {
                user_id: user.id,
                hero_title: "Saying Things",
                hero_subtitle: "Professional Voice Over services tailored to bring your script to life.",
                about_title: "It all started with acting in Los Angeles.",
                about_text: "Now, with over a decade of experience in voice over and improv comedy I'm excited to bring your script to life! Currently based in the vibrant city of Houston, I'm ready to collaborate with you to create something truly amazing.",
                contact_email: "nathan@sayingthings.com",
                contact_phone: "323-395-8384",
                site_name: "Nathan Puls",
                profile_image: "/images/profile.jpeg",
                profile_cartoon: "/images/profile-cartoon-no-bg.png",
                theme_color: "#4f46e5",
                section_order: ["demos", "projects", "studio", "clients", "reviews", "about", "contact"],
                font: "Outfit"
            };
            await supabase.from('site_settings').upsert(settingsPayload);

            showToast("✅ Site content restored successfully!");
            fetchData(); // refresh

        } catch (error) {
            console.error("❌ Restoration failed:", error);
            showToast("❌ Restoration Error: " + error.message, "error");
        } finally {
            setUploading(false);
        }
    };

    const handleMigrateLegacy = async () => {
        if (!confirm("This will import data from your OLD Firebase database into your new account. Continue?")) return;

        setUploading(true);
        console.log("🚀 Starting migration from Firebase...");

        try {
            const collectionsToMigrate = ["demos", "videos", "studio", "clients", "reviews"]; // studio was 'studio' in FB, 'studio_gear' in Supabase
            let totalMoved = 0;

            // 1. Migrate Collections
            for (const colName of collectionsToMigrate) {
                console.log(`📦 Fetching ${colName} from Firebase...`);
                const snapshot = await getDocs(collection(firebaseDb, colName));

                if (!snapshot.empty) {
                    const fbItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); // Get all items

                    // Map to Supabase format
                    const sbItems = fbItems.map((item, i) => {
                        const payload = {
                            user_id: user.id,
                            order: item.order ?? i // Keep order or default
                        };

                        // Column Mapping
                        if (colName === 'videos') {
                            payload.youtube_id = item.youtubeId;
                            payload.title = item.title;
                        } else if (colName === 'reviews') {
                            payload.text = item.text;
                            payload.author = item.author;
                        } else if (colName === 'clients') {
                            payload.url = item.url;
                        } else {
                            // demos, studio
                            payload.name = item.name;
                            payload.url = item.url;
                        }
                        return payload;
                    });

                    const targetTable = colName === 'studio' ? 'studio_gear' : colName;

                    // Clear existing? Maybe not, duplicate risk. 
                    // Let's just insert.
                    const { error } = await supabase.from(targetTable).insert(sbItems);
                    if (error) throw error;

                    totalMoved += sbItems.length;
                }
            }

            // 2. Settings? 
            // Previous code fetched doc(db, "settings", "siteContent").
            // Let's try that.
            // ... actually let's skip settings for now unless requested, as it's complex single doc mapping.
            // ... actually let's skip settings for now unless requested, as it's complex single doc mapping.
            // Typically users care about their lists.

            showToast(`✅ Migration Complete! Imported ${totalMoved} items from Firebase.`);
            fetchData();

        } catch (error) {
            console.error("Migration failed:", error);
            showToast("Migration failed: " + error.message, "error");
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
                    <button onClick={logout} className="flex items-center justify-center gap-2 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition-all">
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </div>
        );
    }

    const currentTabTitle = tabs.find(t => t.id === activeTab)?.name;

    return (
        <div className="min-h-screen bg-slate-50 flex" style={{ '--theme-primary': siteContent.themeColor || '#4f46e5' }}>
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full shadow-sm">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold italic shadow-lg shadow-black/5 bg-[var(--theme-primary)]">S</div>
                    <span className="font-bold text-slate-800 tracking-tight text-lg">Admin</span>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.id
                                ? "text-white shadow-md shadow-black/10 bg-[var(--theme-primary)]"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                }`}
                        >
                            {tab.icon}
                            {tab.name}
                        </button>
                    ))}
                    <div className="pt-4 mt-4 border-t border-slate-50">
                        <button onClick={handleRestoreAll} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5 transition-all">
                            <RefreshCcw size={18} /> Restore Initial
                        </button>
                        <button onClick={handleMigrateLegacy} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-all mt-1">
                            <Database size={18} /> Import from Firebase
                        </button>

                    </div>
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400 px-4 mb-2 truncate font-medium" title={user?.email}>
                        Signed in as: {user?.email}
                    </p>
                    <Link to={user ? `/u/${user.id}` : "/"} target="_blank" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-500 hover:text-[var(--theme-primary)] transition-colors mb-2">
                        <Home size={18} /> View Site
                    </Link>
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-10 min-h-screen overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    {/* Setup Mode Banner */}
                    {!loading && demos.length === 0 && videos.length === 0 && (
                        <div className="mb-8 border p-8 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm bg-[var(--theme-primary)]/5 border-[var(--theme-primary)]/20">
                            <div>
                                <h3 className="font-extrabold text-2xl mb-2 text-slate-900">🚀 Welcome to your Admin Panel!</h3>
                                <p className="font-medium text-slate-600">Your database is currently empty. Click the button to import your initial content.</p>
                            </div>
                            <button
                                onClick={handleRestoreAll}
                                className="flex items-center gap-2 text-white py-4 px-8 rounded-2xl font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-xl bg-[var(--theme-primary)] shadow-[var(--theme-primary)]/30 hover:opacity-90"
                            >
                                <RefreshCcw size={24} /> Restore Initial Content
                            </button>
                        </div>
                    )}

                    <header className="mb-10 flex justify-between items-end">
                        <div>
                            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">{currentTabTitle}</h1>
                            <p className="text-slate-500 font-medium">Manage your {currentTabTitle}.</p>
                        </div>
                    </header>

                    {/* Demos Tab */}
                    {activeTab === "demos" && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <form onSubmit={(e) => { e.preventDefault(); addItem("demos", newDemo, () => setNewDemo({ name: "", url: "" })); }} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <FormInput label="Demo Name" placeholder="e.g. Commercial" value={newDemo.name} onChange={v => setNewDemo({ ...newDemo, name: v })} />
                                <FormInput label="Audio URL" placeholder="https://..." value={newDemo.url} onChange={v => setNewDemo({ ...newDemo, url: v })} />
                                <button type="submit" disabled={uploading || !newDemo.name || !newDemo.url} className="text-white py-3 px-6 rounded-xl font-bold transition-all disabled:opacity-50 bg-[var(--theme-primary)] hover:opacity-90 shadow-lg shadow-[var(--theme-primary)]/30">Add Demo</button>
                            </form>
                            <ItemList items={demos} collName="demos" onReorder={(newItems) => handleReorder("demos", newItems)} onDelete={deleteItem} editingId={editingId} setEditingId={setEditingId} editForm={editForm} setEditForm={setEditForm} onSave={updateItem} onCancel={() => setEditingId(null)} fields={[{ key: 'name', label: 'Name' }, { key: 'url', label: 'Audio URL' }]} />
                        </div>
                    )}

                    {/* Videos Tab */}
                    {activeTab === "videos" && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">


                            <form onSubmit={(e) => { e.preventDefault(); addItem("videos", newVideo, () => setNewVideo({ youtubeId: "", title: "" })); }} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                                <div className="space-y-4">
                                    <div>
                                        <FormInput
                                            label="YouTube Video ID or URL"
                                            placeholder="Paste YouTube URL (title will auto-fetch)"
                                            value={newVideo.youtubeId}
                                            onChange={v => setNewVideo({ ...newVideo, youtubeId: v })}
                                        />

                                    </div>
                                    <FormInput
                                        label="Video Title (optional - auto-fetched)"
                                        placeholder="Will be fetched automatically or enter custom title"
                                        value={newVideo.title}
                                        onChange={v => setNewVideo({ ...newVideo, title: v })}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={uploading || !newVideo.youtubeId || fetchingTitle}
                                    className="text-white py-3 px-8 rounded-xl font-bold transition-all disabled:opacity-50 bg-[var(--theme-primary)] hover:opacity-90 shadow-lg shadow-[var(--theme-primary)]/30"
                                >
                                    {fetchingTitle ? 'Fetching Title...' : 'Add Project'}
                                </button>
                            </form>
                            <ItemList items={videos} collName="videos" onReorder={(newItems) => handleReorder("videos", newItems)} onDelete={deleteItem} editingId={editingId} setEditingId={setEditingId} editForm={editForm} setEditForm={setEditForm} onSave={updateItem} onCancel={() => setEditingId(null)} fields={[{ key: 'title', label: 'Title' }, { key: 'youtube_id', label: 'YouTube ID' }]} />
                        </div>
                    )}

                    {/* Studio Tab */}
                    {activeTab === "studio" && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <form onSubmit={(e) => { e.preventDefault(); addItem("studio", newStudio, () => setNewStudio({ name: "", url: "" })); }} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <FormInput label="Gear Name" placeholder="e.g. Neumann TLM 103" value={newStudio.name} onChange={v => setNewStudio({ ...newStudio, name: v })} />
                                <FormInput label="Image URL" placeholder="https://..." value={newStudio.url} onChange={v => setNewStudio({ ...newStudio, url: v })} />
                                <button type="submit" disabled={uploading || !newStudio.name || !newStudio.url} className="text-white py-3 px-6 rounded-xl font-bold transition-all disabled:opacity-50 bg-[var(--theme-primary)] hover:opacity-90 shadow-lg shadow-[var(--theme-primary)]/30">Add Gear</button>
                            </form>
                            <ItemList items={studio} collName="studio" onReorder={(newItems) => handleReorder("studio", newItems)} onDelete={deleteItem} editingId={editingId} setEditingId={setEditingId} editForm={editForm} setEditForm={setEditForm} onSave={updateItem} onCancel={() => setEditingId(null)} fields={[{ key: 'name', label: 'Gear Name' }, { key: 'url', label: 'Image URL' }]} />
                        </div>
                    )}

                    {/* Clients Tab */}
                    {activeTab === "clients" && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <form onSubmit={(e) => { e.preventDefault(); addItem("clients", newClient, () => setNewClient({ url: "" })); }} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-end">
                                <FormInput label="Client Logo URL" placeholder="https://..." value={newClient.url} onChange={v => setNewClient({ url: v })} containerClass="flex-1" />
                                <button type="submit" disabled={uploading || !newClient.url} className="text-white py-3 px-6 rounded-xl font-bold transition-all disabled:opacity-50 bg-[var(--theme-primary)] hover:opacity-90 shadow-lg shadow-[var(--theme-primary)]/30">Add Client</button>
                            </form>
                            <ItemList items={clients} collName="clients" onReorder={(newItems) => handleReorder("clients", newItems)} onDelete={deleteItem} editingId={editingId} setEditingId={setEditingId} editForm={editForm} setEditForm={setEditForm} onSave={updateItem} onCancel={() => setEditingId(null)} fields={[{ key: 'url', label: 'Logo URL' }]} />
                        </div>
                    )}

                    {/* Reviews Tab */}
                    {activeTab === "reviews" && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <form onSubmit={(e) => { e.preventDefault(); addItem("reviews", newReview, () => setNewReview({ text: "", author: "" })); }} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 grid gap-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormInput label="Review Text" textarea value={newReview.text} onChange={v => setNewReview({ ...newReview, text: v })} />
                                    <FormInput label="Author Name" value={newReview.author} onChange={v => setNewReview({ ...newReview, author: v })} />
                                </div>
                                <button type="submit" disabled={uploading || !newReview.text || !newReview.author} className="text-white py-3 px-8 rounded-xl font-bold transition-all self-end disabled:opacity-50 bg-[var(--theme-primary)] hover:opacity-90 shadow-lg shadow-[var(--theme-primary)]/30">Add Review</button>
                            </form>
                            <ItemList items={reviews} collName="reviews" onReorder={(newItems) => handleReorder("reviews", newItems)} onDelete={deleteItem} editingId={editingId} setEditingId={setEditingId} editForm={editForm} setEditForm={setEditForm} onSave={updateItem} onCancel={() => setEditingId(null)} fields={[{ key: 'text', label: 'Review' }, { key: 'author', label: 'Author' }]} />
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
                                        <div className="space-y-4">
                                            <p className="text-sm text-slate-500">Rearrange the order of sections on your home page.</p>
                                            <div className="space-y-2">
                                                <Reorder.Group axis="y" values={siteContent.sectionOrder} onReorder={(newOrder) => setSiteContent({ ...siteContent, sectionOrder: newOrder })}>
                                                    {siteContent.sectionOrder.map((section) => (
                                                        <Reorder.Item key={section} value={section}>
                                                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 mb-2 cursor-move hover:bg-slate-100 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-slate-300">
                                                                        <GripVertical size={18} />
                                                                    </div>
                                                                    <span className="font-medium text-slate-700 capitalize">{section}</span>
                                                                </div>
                                                            </div>
                                                        </Reorder.Item>
                                                    ))}
                                                </Reorder.Group>
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="Theme & Appearance" icon={<Settings size={18} />}>
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="color"
                                                    value={siteContent.themeColor || "#4f46e5"}
                                                    onChange={e => setSiteContent({ ...siteContent, themeColor: e.target.value })}
                                                    className="h-12 w-24 p-1 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                                                />
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-tight">Primary Brand Color</label>
                                                    <p className="text-sm text-slate-500">Pick a color for buttons, icons, and highlights.</p>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-tight">Website Font</label>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {fonts.map(f => (
                                                        <button
                                                            key={f.value}
                                                            type="button"
                                                            onClick={() => {
                                                                setSiteContent({ ...siteContent, font: f.value });
                                                                applyFont(f.value);
                                                            }}
                                                            className={`p-3 rounded-lg border text-sm text-center transition-all ${siteContent.font === f.value
                                                                ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/5 text-[var(--theme-primary)] font-semibold ring-2 ring-[var(--theme-primary)]/20'
                                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                                                            style={{ fontFamily: f.value }}
                                                        >
                                                            {f.name}
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="text-sm text-slate-500 pt-1">Select a font to preview it instantly.</p>
                                            </div>
                                        </div>
                                    </Section>
                                    <Section title="About & Images" icon={<Info size={18} />}>
                                        <div className="space-y-6">
                                            <Field label="About Title" value={siteContent.aboutTitle} onChange={v => setSiteContent({ ...siteContent, aboutTitle: v })} />
                                            <Field label="About Text" textarea value={siteContent.aboutText} onChange={v => setSiteContent({ ...siteContent, aboutText: v })} />
                                            <Field label="Profile Image URL" value={siteContent.profileImage} onChange={v => setSiteContent({ ...siteContent, profileImage: v })} />
                                            <Field label="Cartoon Profile URL" value={siteContent.profileCartoon} onChange={v => setSiteContent({ ...siteContent, profileCartoon: v })} />
                                        </div>
                                    </Section>
                                    <Section title="Contact Info" icon={<Contact size={18} />}>
                                        <div className="space-y-6">
                                            <Field label="Email Address" value={siteContent.contactEmail} onChange={v => setSiteContent({ ...siteContent, contactEmail: v })} />
                                            <Field label="Phone Number" value={siteContent.contactPhone} onChange={v => setSiteContent({ ...siteContent, contactPhone: v })} />
                                        </div>
                                    </Section>
                                </div>

                                <button
                                    type="button"
                                    onClick={saveSettings}
                                    disabled={uploading}
                                    className="fixed bottom-8 right-8 z-50 flex items-center gap-2 text-white py-3 px-6 rounded-full font-bold text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ring-4 ring-white bg-[var(--theme-primary)] hover:opacity-90 shadow-2xl shadow-[var(--theme-primary)]/30"
                                >
                                    <Save size={20} /> {uploading ? "Saving..." : "Save Changes"}
                                </button>
                                {/* Spacer for the fixed button */}
                                <div className="h-20"></div>
                            </form>
                        </div>
                    )
                    }
                    {toast && (
                        <Toast
                            message={toast.message}
                            type={toast.type}
                            onClose={() => setToast(null)}
                        />
                    )}
                </div >
            </main >
        </div >
    );
}

function ItemList({ items, collName, onReorder, onDelete, editingId, setEditingId, editForm, setEditForm, onSave, onCancel, fields }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
            {items.length === 0 && (
                <div className="p-16 text-center text-slate-400 font-medium">
                    No items found in this section.
                </div>
            )}
            <Reorder.Group axis="y" values={items} onReorder={onReorder}>
                {items.map((item, index) => (
                    <Reorder.Item key={item.id} value={item} className="bg-white">
                        <div className="p-6 flex items-start gap-4 group hover:bg-slate-50/50 transition-colors">
                            <div className="flex flex-col gap-1 border-r border-slate-100 pr-3 mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                                <GripVertical size={20} />
                            </div>

                            {/* Preview Column - for videos, studio, and clients */}
                            {(collName === 'videos' || collName === 'studio' || collName === 'clients') && (
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
                                            onError={(e) => { e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-xs">No preview</div>'; }}
                                        />
                                    )}
                                    {collName === 'clients' && item.url && (
                                        <img
                                            src={item.url}
                                            alt="Client logo"
                                            className="w-full h-full object-contain p-2"
                                            onError={(e) => { e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-xs">No preview</div>'; }}
                                        />
                                    )}
                                </div>
                            )}

                            <div className="flex-1 min-w-0">
                                {editingId === item.id ? (
                                    <div className="space-y-3">
                                        {fields.map(f => (
                                            <div key={f.key}>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{f.label}</label>
                                                <input
                                                    type="text"
                                                    value={editForm[f.key] || ""}
                                                    onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 focus:border-[var(--theme-primary)]"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-1">
                                        {/* Special display for videos - show YouTube title */}
                                        {collName === 'videos' && item.youtubeId ? (
                                            <>
                                                <div className="font-bold text-slate-800 text-base mb-1">
                                                    {item.title || 'YouTube Video'}
                                                </div>
                                                <div className="text-xs text-slate-400 font-mono">
                                                    ID: {item.youtubeId}
                                                </div>
                                                <a
                                                    href={`https://youtube.com/watch?v=${item.youtubeId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs hover:text-[var(--theme-primary)] underline mt-1 inline-block text-[var(--theme-primary)]/80"
                                                >
                                                    View on YouTube →
                                                </a>
                                            </>
                                        ) : (
                                            /* Default display for other types */
                                            fields.map((f, i) => (
                                                <div key={f.key} className={i === 0 ? "font-bold text-slate-800 text-lg truncate" : "text-sm text-slate-400 truncate mt-0.5"}>
                                                    {item[f.key]}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-1 pt-1">
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

function Section({ title, icon, children }) {
    return (
        <div className="space-y-6">
            <h3 className="flex items-center gap-3 text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-3">
                <span className="p-1.5 rounded-lg text-[var(--theme-primary)] bg-[var(--theme-primary)]/10">{icon}</span> {title}
            </h3>
            {children}
        </div>
    );
}

function Field({ label, value, onChange, textarea }) {
    return (
        <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-tight">{label}</label>
            {textarea ? (
                <textarea value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-[var(--theme-primary)]/10 focus:border-[var(--theme-primary)] outline-none transition-all h-40 leading-relaxed" />
            ) : (
                <input type="text" value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-[var(--theme-primary)]/10 focus:border-[var(--theme-primary)] outline-none transition-all" />
            )}
        </div>
    );
}

function FormInput({ label, value, onChange, placeholder, textarea, containerClass = "" }) {
    return (
        <div className={containerClass}>
            <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-tight">{label}</label>
            {textarea ? (
                <textarea placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white outline-none transition-all h-20" />
            ) : (
                <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white outline-none transition-all" />
            )}
        </div>
    )
}

function Toast({ message, type, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 ${type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`}>
            <span className="font-bold">{message}</span>
            <button onClick={onClose} className="opacity-80 hover:opacity-100"><X size={18} /></button>
        </div>
    );
}
