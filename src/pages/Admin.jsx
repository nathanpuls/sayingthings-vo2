import { useState, useEffect } from "react";
import { auth, loginWithGoogle, logout, db, storage } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useLocation, Link } from "react-router-dom";
import { Trash2, Edit2, Plus, Save, X, LogOut, LogIn, UploadCloud, Settings, Home } from "lucide-react";
import { demos as staticDemos } from "../content/demos";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export default function Admin() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [demos, setDemos] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [newDemo, setNewDemo] = useState({ name: "", file: null, url: "" });
    const [uploading, setUploading] = useState(false);
    const [uploadMode, setUploadMode] = useState("file"); // 'file' or 'url'
    const [editForm, setEditForm] = useState({ name: "", url: "" });

    // AWS Config State
    const [showAwsConfig, setShowAwsConfig] = useState(false);
    const [awsConfig, setAwsConfig] = useState({
        accessKeyId: localStorage.getItem("aws_access_key") || "",
        secretAccessKey: localStorage.getItem("aws_secret_key") || "",
        bucketName: "sayingthings",
        region: "us-east-1",
        folder: "vo-audio" // Add folder prefix
    });

    const authorizedEmail = "natepuls@gmail.com"; // Change to your email or make this a list

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;

        // Real-time listener for demos
        const q = query(collection(db, "demos"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedDemos = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            // Sort manually to be safe or use orderBy if index exists
            setDemos(fetchedDemos.sort((a, b) => (a.order || 0) - (b.order || 0)));
        }, (error) => {
            console.error("Firestore listener error:", error);
            alert("Error syncing data: " + error.message);
        });

        return () => unsubscribe();
    }, [user]);

    const fetchDemos = async () => {
        // fetchDemos is now mostly obsolete because of onSnapshot, 
        // but we'll keep the function signature for compatibility if needed.
    };

    const handleLogin = async () => {
        try {
            await loginWithGoogle();
        } catch (error) {
            console.error("Login failed", error);
        }
    };

    const saveAwsConfig = (e) => {
        e.preventDefault();
        localStorage.setItem("aws_access_key", awsConfig.accessKeyId);
        localStorage.setItem("aws_secret_key", awsConfig.secretAccessKey);
        setShowAwsConfig(false);
        alert("AWS Config Saved (locally)");
    };

    const handleAdd = async (e) => {
        e.preventDefault();

        // Validate based on mode
        if (!newDemo.name || newDemo.name.trim() === "") {
            alert("Please enter a demo name.");
            return;
        }

        if (uploadMode === "file" && !newDemo.file) {
            alert("Please select a file to upload.");
            return;
        }

        if (uploadMode === "url" && !newDemo.url) {
            alert("Please paste a URL.");
            return;
        }

        setUploading(true);
        try {
            let finalUrl = newDemo.url;

            if (uploadMode === "url") {
                // Auto-convert Google Drive links to direct play links
                const driveMatch = finalUrl.match(/\/file\/d\/([^\/]+)/) || finalUrl.match(/id=([^\&]+)/);
                if (driveMatch && (finalUrl.includes("drive.google.com") || finalUrl.includes("docs.google.com"))) {
                    finalUrl = `https://docs.google.com/uc?id=${driveMatch[1]}`;
                }

                // DropBox conversion
                if (finalUrl.includes("dropbox.com") && finalUrl.includes("dl=0")) {
                    finalUrl = finalUrl.replace("dl=0", "raw=1");
                }
            }

            if (uploadMode === "file") {
                // If AWS keys exist, act as S3 uploader
                if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
                    console.log("Using S3 for upload...");
                    const s3 = new S3Client({
                        region: awsConfig.region,
                        credentials: {
                            accessKeyId: awsConfig.accessKeyId,
                            secretAccessKey: awsConfig.secretAccessKey,
                        },
                    });

                    const fileName = `${awsConfig.folder}/${Date.now()}_${newDemo.file.name.replace(/\s+/g, "_")}`;
                    await s3.send(new PutObjectCommand({
                        Bucket: awsConfig.bucketName,
                        Key: fileName,
                        Body: newDemo.file,
                        ContentType: newDemo.file.type || 'audio/mpeg',
                    }));

                    finalUrl = `https://${awsConfig.bucketName}.s3.amazonaws.com/${fileName}`;
                } else {
                    console.log("AWS keys missing, falling back to Firebase Storage...");
                    // Fallback to Firebase Storage
                    // 1. Upload file to Storage
                    const storageRef = ref(storage, `vo-audio/${Date.now()}_${newDemo.file.name}`);
                    await uploadBytes(storageRef, newDemo.file);
                    finalUrl = await getDownloadURL(storageRef);
                }
            }

            // 2. Add document to Firestore
            await addDoc(collection(db, "demos"), {
                name: newDemo.name,
                url: finalUrl,
                order: demos.length,
                createdAt: new Date(),
            });

            setNewDemo({ name: "", file: null, url: "" });
            // Reset file input manually
            if (document.getElementById("fileInput")) document.getElementById("fileInput").value = "";
            // UI will update automatically via onSnapshot
        } catch (error) {
            console.error("Error adding demo", error);
            alert("Error adding demo: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this demo?")) return;
        try {
            await deleteDoc(doc(db, "demos", id));
            // UI will update automatically via onSnapshot
        } catch (error) {
            console.error("Error deleting demo", error);
            alert("Error deleting demo: " + error.message);
        }
    };

    const startEdit = (demo) => {
        setEditingId(demo.id);
        setEditForm({ name: demo.name, url: demo.url });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({ name: "", url: "" });
    };

    const saveEdit = async (id) => {
        try {
            await updateDoc(doc(db, "demos", id), {
                name: editForm.name,
                url: editForm.url,
            });
            setEditingId(null);
            // UI will update automatically via onSnapshot
        } catch (error) {
            console.error("Error updating demo", error);
            alert("Error updating demo: " + error.message);
        }
    };

    const handleMigrate = async () => {
        // Removed confirm dialog to fix UI issues. It's a specific action button anyway.
        try {
            for (let i = 0; i < staticDemos.length; i++) {
                const demo = staticDemos[i];
                await addDoc(collection(db, "demos"), {
                    name: demo.name,
                    url: demo.url,
                    order: i,
                    createdAt: new Date(),
                });
            }
            // UI will update automatically via onSnapshot
        } catch (error) {
            console.error("Error migrating demos", error);
            alert("Error migrating demos: " + error.message);
        }
    };

    if (loading) return <div className="min-h-screen grid place-items-center bg-slate-50">Loading...</div>;

    if (!user) {
        return (
            <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full border border-slate-100">
                    <h1 className="text-2xl font-bold mb-6 text-slate-800">Admin Login</h1>
                    <button
                        onClick={handleLogin}
                        className="flex items-center justify-center gap-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-indigo-200"
                    >
                        <LogIn size={20} />
                        Sign in with Google
                    </button>
                </div>
            </div>
        );
    }

    // Simple authorization check
    // You can remove this check if you want anyone who logs in to edit (NOT RECOMMENDED)
    // or add your email to the match
    if (user.email !== authorizedEmail && authorizedEmail !== "") {
        return (
            <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full border border-red-100">
                    <h1 className="text-xl font-bold mb-4 text-red-600">Unauthorized</h1>
                    <p className="text-slate-600 mb-6">You are logged in as {user.email}, but you do not have permission to edit this site.</p>
                    <button
                        onClick={logout}
                        className="flex items-center justify-center gap-2 w-full bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium transition-all"
                    >
                        <LogOut size={18} />
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-full transition-all border border-slate-200"
                            title="Go to Home"
                        >
                            <Home size={20} />
                        </Link>
                        <h1 className="text-3xl font-bold text-slate-900">Manage Demos</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500 hidden sm:inline">Logged in as {user.email}</span>
                        <button
                            onClick={() => setShowAwsConfig(!showAwsConfig)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent"
                            title="AWS Settings"
                        >
                            <Settings size={20} />
                        </button>
                        <button
                            onClick={logout}
                            className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-lg border border-slate-200 shadow-sm transition-all text-sm"
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </div>
                </header>

                {/* AWS Config Modal/Section */}
                {showAwsConfig && (
                    <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg mb-10 border border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Settings size={20} className="text-cyan-400" /> AWS Configuration
                            </h2>
                            <button onClick={() => setShowAwsConfig(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <p className="text-sm text-slate-400 mb-4">
                            Enter your IAM credentials to enable direct S3 uploads. Keys are saved to your browser (LocalStorage) and are NOT stored in the database.
                            <br /><strong>Note:</strong> Ensure your bucket has CORS enabled.
                        </p>
                        <form onSubmit={saveAwsConfig} className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Access Key ID</label>
                                <input
                                    type="text"
                                    value={awsConfig.accessKeyId}
                                    onChange={(e) => setAwsConfig({ ...awsConfig, accessKeyId: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-cyan-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Secret Access Key</label>
                                <input
                                    type="password"
                                    value={awsConfig.secretAccessKey}
                                    onChange={(e) => setAwsConfig({ ...awsConfig, secretAccessKey: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-cyan-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                                    Save Config
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Add New Demo */}
                <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 mb-10">
                    <h2 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-2">
                        <Plus size={20} className="text-indigo-600" /> Add New Demo
                    </h2>
                    <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
                        <input
                            type="text"
                            placeholder="Demo Name (e.g. Commercial)"
                            value={newDemo.name}
                            required
                            onChange={(e) => setNewDemo({ ...newDemo, name: e.target.value })}
                            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all self-start mt-8"
                        />

                        <div className="flex-[2] flex flex-col gap-2">
                            <div className="flex gap-4 mb-1 text-sm text-slate-600 font-medium">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="uploadMode"
                                        checked={uploadMode === "file"}
                                        onChange={() => setUploadMode("file")}
                                        className="text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                                    />
                                    <span>Upload File</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="uploadMode"
                                        checked={uploadMode === "url"}
                                        onChange={() => setUploadMode("url")}
                                        className="text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                                    />
                                    <span>Paste URL</span>
                                </label>
                            </div>

                            {uploadMode === "url" ? (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="https://..."
                                        value={newDemo.url}
                                        required
                                        onChange={(e) => setNewDemo({ ...newDemo, url: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                    />
                                    <p className="text-[10px] text-slate-500 italic">
                                        Tip: For Google Drive, ensure sharing is set to "Anyone with the link".
                                    </p>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input
                                        id="fileInput"
                                        type="file"
                                        accept="audio/*"
                                        onChange={(e) => setNewDemo({ ...newDemo, file: e.target.files[0] })}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                    />
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={!newDemo.name || (uploadMode === "file" ? !newDemo.file : !newDemo.url) || uploading}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium shadow-md transition-all whitespace-nowrap self-start mt-8"
                        >
                            {uploading ? "Uploading..." : (
                                uploadMode === "file"
                                    ? (awsConfig.accessKeyId ? "Add Demo (S3)" : "Add Demo (Firebase)")
                                    : "Add Demo (URL)"
                            )}
                        </button>
                    </form>
                </div>

                {/* List Demos */}
                <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-semibold text-slate-700">Current Demos ({demos.length})</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {demos.length === 0 && (
                            <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-4">
                                <p>No demos found in database.</p>
                                <button
                                    onClick={handleMigrate}
                                    className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                                >
                                    <UploadCloud size={18} />
                                    Migrate Static Demos
                                </button>
                            </div>
                        )}

                        {demos.map((demo) => (
                            <div key={demo.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:bg-slate-50 transition-colors">
                                {editingId === demo.id ? (
                                    <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            className="flex-1 px-3 py-2 rounded-lg border border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none"
                                        />
                                        <input
                                            type="text"
                                            value={editForm.url}
                                            onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                                            className="flex-[2] px-3 py-2 rounded-lg border border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-800">{demo.name}</h4>
                                        <p className="text-sm text-slate-500 truncate max-w-lg">{demo.url}</p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 self-end sm:self-center">
                                    {editingId === demo.id ? (
                                        <>
                                            <button
                                                onClick={() => saveEdit(demo.id)}
                                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                title="Save"
                                            >
                                                <Save size={20} />
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Cancel"
                                            >
                                                <X size={20} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => startEdit(demo)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(demo.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
