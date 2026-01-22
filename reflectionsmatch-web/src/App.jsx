import React, { useEffect, useState, useRef, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "firebase/auth";
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReflectionCard from './components/ReflectionCard';
import Profile from './pages/Profile';
import Chat from './pages/Chat'; // NEW IMPORT
import Radar from './pages/Radar';
import About from './pages/About';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Navbar from './components/Navbar';
import { Search, TrendingUp } from 'lucide-react';
import ReflectionUploader from './components/ReflectionUploader'; // NEW IMPORT
import LandingPage from './components/LandingPage';
import Footer from './components/Footer';
import ignitiaLogo from './assets/ignitia_logo.jpg';

// Initialize Gemini
// TODO: Replace with real key or use env var
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);



// Helper to convert URL to Base64 for Gemini
async function urlToGenerativePart(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
    });
    return {
        inlineData: {
            data: await base64EncodedDataPromise,
            mimeType: blob.type,
        },
    };
}

const Dashboard = ({ user, reflections, loading }) => {
    // const [reflections, setReflections] = useState([]);  <-- LIFTED
    // const [loading, setLoading] = useState(true);        <-- LIFTED
    const [searchTerm, setSearchTerm] = useState('');
    const [analyzingIds, setAnalyzingIds] = useState(new Set());
    const [isAwakening, setIsAwakening] = useState(false);
    const [highlightUpload, setHighlightUpload] = useState(false);
    const [dismissedWelcome, setDismissedWelcome] = useState(false);
    const [userTagline, setUserTagline] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [milestone, setMilestone] = useState(null); // Milestone State
    const processingIds = useRef(new Set());

    // 1. Data Fetching - MOVED TO APP
    useEffect(() => {
        if (!user) return;

        // Fetch User Data Only (Tagline + Milestones)
        const userUnsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                setUserTagline(data.tagline || '');
                if (data.milestoneReached) {
                    setMilestone(data.milestoneReached);
                }
            }
        });

        return () => {
            userUnsubscribe();
        };
    }, [user]);

    // 2. AI Analysis Logic
    const analyzeReflection = async (id, imageUrl) => {
        if (processingIds.current.has(id)) return;
        console.log(`Starting analysis for ${id}...`);
        processingIds.current.add(id);
        setAnalyzingIds(prev => new Set(prev).add(id));

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const imagePart = await urlToGenerativePart(imageUrl);
            const prompt = 'Analyze this image. Return a valid JSON object with a "summary" (max 2 sentences) and "tags" (array of 3 keywords). Do not include markdown code block syntax around the JSON.';
            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const analysis = JSON.parse(cleanText);

            const docRef = doc(db, "reflections", id);
            await updateDoc(docRef, {
                aiSummary: analysis.summary,
                tags: analysis.tags
            });

        } catch (error) {
            console.error("AI Analysis Failed:", error);
        } finally {
            processingIds.current.delete(id);
            setAnalyzingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    // 2.5 Filtering Logic
    const filteredReflections = useMemo(() => {
        const term = searchTerm.toLowerCase();
        if (!term) return reflections;
        return reflections.filter(reflection => {
            const notesMatch = reflection.notes?.toLowerCase().includes(term);
            const summaryMatch = reflection.aiSummary?.toLowerCase().includes(term);
            const tagsMatch = reflection.tags?.some(tag => tag.toLowerCase().includes(term));
            return notesMatch || summaryMatch || tagsMatch;
        });
    }, [reflections, searchTerm]);

    // 2.6 Trending Tags Logic
    const trendingTags = useMemo(() => {
        const tagCounts = {};
        reflections.forEach(r => {
            if (r.tags) r.tags.forEach(t => {
                const tag = t.toLowerCase();
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });
        return Object.entries(tagCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([tag]) => tag);
    }, [reflections]);

    // 3. Automation Trigger
    useEffect(() => {
        if (loading) return;
        reflections.forEach(reflection => {
            if (!reflection.aiSummary && (reflection.imageUrl || reflection.url) && !processingIds.current.has(reflection.id)) {
                analyzeReflection(reflection.id, reflection.imageUrl || reflection.url);
            }
        });
    }, [reflections, loading]);

    // 4. Delete Handler
    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this reflection? This cannot be undone.")) {
            try {
                await deleteDoc(doc(db, "reflections", id));
            } catch (error) {
                console.error("Error deleting document:", error);
            }
        }
    };

    // 5. Update Handlers
    const handleUpdateSummary = async (id, newSummary) => {
        try { await updateDoc(doc(db, "reflections", id), { aiSummary: newSummary }); } catch (error) { console.error(error); }
    };
    const handleUpdateNotes = async (id, newNotes) => {
        try { await updateDoc(doc(db, "reflections", id), { notes: newNotes }); } catch (error) { console.error(error); }
    };

    // Awakening Handler
    const triggerAwakening = () => {
        setDismissedWelcome(true);
        setIsAwakening(true);
        setTimeout(() => {
            setIsAwakening(false);
            setHighlightUpload(true);
            setTimeout(() => setHighlightUpload(false), 2000); // 2s highlight pulse
        }, 2400);
    };

    const handleUploadComplete = () => {
        // Show Success Toast
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);

        // If this was the first reflection, trigger awakening (if not already triggered)
        if (reflections.length === 0 && !isAwakening) {
            triggerAwakening();
        }
    };

    const showWelcome = !loading && reflections.length === 0 && !dismissedWelcome;

    const handleClearMilestone = async () => {
        setMilestone(null);
        if (user) {
            await updateDoc(doc(db, "users", user.uid), {
                milestoneReached: null // Clear the flag
            });
        }
    };

    return (
        <div className={`min-h-screen bg-gray-50 p-8 transition-all duration-[2400ms] ${isAwakening ? 'brightness-110 contrast-110' : ''}`}
            style={isAwakening ? { boxShadow: 'inset 0 0 100px rgba(100, 200, 255, 0.2)' } : {}}
        >
            <style>{`
                @keyframes shimmer-bloom {
                    0% { filter: brightness(1); box-shadow: inset 0 0 0 rgba(0,0,0,0); }
                    50% { filter: brightness(1.1) contrast(1.1); box-shadow: inset 0 0 80px rgba(99, 102, 241, 0.2); }
                    100% { filter: brightness(1); box-shadow: inset 0 0 0 rgba(0,0,0,0); }
                }
                .animate-shimmer-bloom {
                    animation: shimmer-bloom 2.4s ease-in-out forwards;
                }
                @keyframes pulse-highlight {
                    0%, 100% { box-shadow: 0 0 0 rgba(59, 130, 246, 0); }
                    50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.5); transform: scale(1.01); }
                }
                .animate-pulse-highlight {
                    animation: pulse-highlight 2s ease-in-out infinite;
                }
                @keyframes glow-pulse {
                    0%, 100% { box-shadow: 0 0 15px rgba(0, 255, 255, 0.5); border-color: rgba(0, 255, 255, 0.8); }
                    33% { box-shadow: 0 0 15px rgba(255, 0, 255, 0.5); border-color: rgba(255, 0, 255, 0.8); }
                    66% { box-shadow: 0 0 15px rgba(255, 230, 0, 0.5); border-color: rgba(255, 230, 0, 0.8); }
                }
                .animate-glow-pulse {
                    animation: glow-pulse 3s infinite alternate;
                }
                .animate-glow-pulse {
                    animation: glow-pulse 3s infinite alternate;
                }
                @keyframes multi-color-pulse {
                    0% { filter: drop-shadow(0 0 10px rgba(0, 255, 255, 0.4)); }
                    25% { filter: drop-shadow(0 0 15px rgba(255, 0, 255, 0.5)); }
                    50% { filter: drop-shadow(0 0 20px rgba(255, 255, 0, 0.6)); }
                    75% { filter: drop-shadow(0 0 15px rgba(0, 255, 127, 0.5)); }
                    100% { filter: drop-shadow(0 0 10px rgba(0, 255, 255, 0.4)); }
                }
                .animate-multi-color-pulse {
                    animation: multi-color-pulse 2s infinite linear;
                }
                @keyframes sparkle-flicker {
                    0%, 100% { opacity: 0; transform: scale(0.5); }
                    50% { opacity: 1; transform: scale(1.2); }
                }
            `}</style>

            {/* MILESTONE MODAL */}
            {milestone && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-6">
                    <div className="bg-white p-12 rounded-3xl shadow-2xl max-w-xl w-full text-center border-2 border-white/20 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 opacity-50 z-0"></div>
                        <div className="relative z-10">
                            <div className="text-6xl mb-6">🏆</div>
                            <h2 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
                                {milestone === 100 ? "Essence Synchronized" : milestone === 10 ? "Identity Initialized" : milestone === 25 ? "Signal Clarity Achieved" : "Milestone Reached"}
                            </h2>
                            <p className="text-gray-600 mb-8 text-xl leading-relaxed">
                                {milestone === 100
                                    ? "100 Reflections. You have reached the final state. Your Digital Twin is now a pure reflection of your Essence—a living archive of your world."
                                    : milestone === 10
                                        ? "You've captured 10 reflections. Your digital twin is beginning to take shape."
                                        : "25 reflections captured. The patterns in your world are becoming clear, unlocking deeper insights into your unique digital identity."}
                            </p>
                            <button
                                onClick={handleClearMilestone}
                                className="px-10 py-4 bg-gray-900 text-white font-bold rounded-xl text-lg hover:bg-gray-800 hover:shadow-xl hover:scale-105 transition-all w-full shadow-lg"
                            >
                                Continue Building
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* WELCOME MODAL */}
            {showWelcome && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-lg w-full text-center border border-gray-100 transform transition-all scale-100">
                        <img
                            src="/logo-final.jpg"
                            alt="Reflections Match"
                            className="h-20 w-auto mx-auto mb-6 object-contain"
                        />
                        <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Your World, Synchronized.</h2>
                        <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                            Welcome, <span className="font-bold text-gray-800">{user.displayName || 'Traveler'}</span>. <br />
                            Start by adding a reflection manually or using the browser extension to begin building your digital twin.
                        </p>
                        <button
                            onClick={triggerAwakening}
                            className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl text-lg hover:bg-blue-700 hover:shadow-lg hover:scale-105 transition-all w-full"
                        >
                            Let's Begin
                        </button>
                    </div>
                </div>
            )}

            <div className={`max-w-6xl mx-auto ${isAwakening ? 'animate-shimmer-bloom' : ''}`}>
                <header className="flex flex-col md:flex-row justify-between items-center gap-4 py-4">
                    <div className="flex items-center gap-6 relative md:flex-1">
                        {/* Sparkle Overlay for Essence Level */}
                        {reflections.length >= 100 && (
                            <div className="absolute inset-0 z-20 pointer-events-none">
                                <div className="absolute top-2 right-2 w-4 h-4 bg-yellow-300 rounded-full blur-[2px] animate-[sparkle-flicker_1.5s_infinite]"></div>
                                <div className="absolute bottom-4 left-4 w-3 h-3 bg-cyan-300 rounded-full blur-[2px] animate-[sparkle-flicker_2s_infinite_0.5s]"></div>
                                <div className="absolute top-1/2 left-2 w-2 h-2 bg-white rounded-full blur-[1px] animate-[sparkle-flicker_1s_infinite_0.2s]"></div>
                            </div>
                        )}
                        <img
                            src="/dashboard-identity.png"
                            alt="Identity"
                            className={`w-[120px] h-auto object-contain drop-shadow-lg transition-all duration-1000 ${reflections.length >= 100 ? "animate-multi-color-pulse" : ""}`}
                        />
                        <div className="flex flex-col justify-center">
                            <h1 className="text-3xl font-bold text-[#2d2e32] tracking-tight">
                                {user.displayName}
                            </h1>
                            <p className="text-lg font-medium italic text-slate-500 mt-1">
                                {userTagline || "Your World, Synchronized."}
                            </p>
                        </div>
                    </div>

                    {/* Ignitia-AI Ad Unit */}
                    <a
                        href="https://www.ignitia-ai.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center group no-underline mx-auto"
                    >
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 group-hover:text-slate-600 transition-colors">
                            Sponsored by
                        </span>
                        <img
                            src={ignitiaLogo}
                            alt="Ignitia-AI"
                            className="h-14 w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                    </a>

                    {/* Search Bar - Moved here */}
                    <div className="relative w-full max-w-md pb-2 md:flex-1 md:flex md:justify-end">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none pb-2 md:relative md:inset-auto md:pr-0 md:pl-3 md:left-0">
                            {/* Adjustment for search icon pos relative to input might be needed but generic wrapper flex-end is key */}
                            {/* Revert inner icon simple structure */}
                        </div>
                        <div className="relative w-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none pb-2">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-brand focus:ring-1 focus:ring-brand sm:text-sm"
                                placeholder="Search notes, tags, or dates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </header>

                {/* Manual Uploader Container */}
                <div className={`transition-all duration-500 rounded-xl ${highlightUpload ? 'animate-pulse-highlight ring-2 ring-blue-500 shadow-xl' : ''}`}>
                    <ReflectionUploader user={user} onUploadComplete={handleUploadComplete} />
                </div>

                {/* Success Toast */}
                {showToast && (
                    <div className="fixed top-24 right-8 bg-white border border-green-100 shadow-xl rounded-lg p-4 flex items-center gap-3 animate-slide-in pointer-events-none z-50">
                        <div className="bg-green-100 text-green-600 rounded-full p-2">
                            <Check className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-800">Reflection Captured</p>
                            <p className="text-xs text-gray-500">Your world is growing.</p>
                        </div>
                        <style>{`
                            @keyframes slide-in-toast {
                                0% { opacity: 0; transform: translateY(-10px); }
                                100% { opacity: 1; transform: translateY(0); }
                            }
                            .animate-slide-in {
                                animation: slide-in-toast 0.4s ease-out forwards;
                            }
                        `}</style>
                    </div>
                )}

                {/* Trending Topics Widget */}
                {
                    trendingTags.length > 0 && (
                        <div className="mb-8 overflow-x-auto">
                            <div className="flex items-center gap-4 pb-2">
                                <span className="flex items-center gap-2 text-sm font-bold text-gray-500 uppercase tracking-wider">
                                    <TrendingUp size={16} /> Trending
                                </span>
                                <div className="flex gap-2">
                                    {trendingTags.map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => setSearchTerm(tag)}
                                            className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:text-brand hover:border-brand transition-colors whitespace-nowrap"
                                        >
                                            #{tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
                        </div>
                    ) : reflections.length === 0 ? (
                        <div className="bg-white p-16 rounded-2xl shadow-sm text-center border-2 border-dashed border-slate-200">
                            <p className="text-xl font-light text-slate-500 max-w-lg mx-auto leading-relaxed">
                                Your world is a blank canvas. Capture a reflection to begin building your digital twin.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredReflections.map((reflection) => {
                                const isNew = reflection.timestamp ? (Date.now() - reflection.timestamp.toMillis()) < 5 * 60 * 1000 : false;
                                return (
                                    <div key={reflection.id} className={isNew ? "rounded-xl animate-glow-pulse" : ""}>
                                        <ReflectionCard
                                            id={reflection.id}
                                            imageUrl={reflection.imageUrl || reflection.url}
                                            notes={reflection.notes}
                                            timestamp={reflection.timestamp}
                                            aiSummary={reflection.aiSummary}
                                            tags={reflection.tags}
                                            sourceUrl={reflection.sourceUrl}
                                            source={reflection.source}
                                            radarType={reflection.radarType}
                                            description={reflection.description}
                                            actionItem={reflection.actionItem}
                                            isAnalyzing={analyzingIds.has(reflection.id)}
                                            onDelete={handleDelete}
                                            onUpdate={handleUpdateSummary}
                                            onUpdateNotes={handleUpdateNotes}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )
                }
            </div >
        </div >
    );
};

function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    // Lifted State
    const [reflections, setReflections] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });

        // Safety timeout in case Firebase hangs
        const timeout = setTimeout(() => {
            setAuthLoading((loading) => {
                if (loading) {
                    console.warn("Auth listener timed out. Forcing load.");
                    return false;
                }
                return loading;
            });
        }, 3000);

        return () => {
            unsubscribeAuth();
            clearTimeout(timeout);
        };
    }, []);

    // Fetch Reflections at Top Level
    useEffect(() => {
        if (!user) {
            setReflections([]);
            return;
        }

        const q = query(
            collection(db, 'reflections'),
            where("userId", "==", user.uid),
            orderBy("timestamp", "desc")
        );

        const unsubscribeData = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setReflections(data);
            setDataLoading(false);
        }, (error) => {
            console.error("Error fetching reflections:", error);
            setDataLoading(false);
        });

        return () => unsubscribeData();
    }, [user]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
            </div>
        );
    }

    // if (!user) return <LandingPage />; // REMOVED to allow public routes

    return (
        <BrowserRouter>
            <Routes>
                {/* Landing Page (No Navbar/Footer) */}
                <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/dashboard" />} />

                {/* App Shell Routes (Navbar + Content + Footer) */}
                <Route path="/*" element={
                    <>
                        <Navbar user={user} />
                        <Routes>
                            <Route path="/about" element={<About />} />
                            <Route path="/privacy" element={<PrivacyPolicy />} />
                            <Route path="/dashboard" element={user ? <Dashboard user={user} reflections={reflections} loading={dataLoading} /> : <Navigate to="/" />} />
                            <Route path="/profile" element={user ? <Profile user={user} reflections={reflections} /> : <Navigate to="/" />} />
                            <Route path="/radar" element={user ? <Radar user={user} /> : <Navigate to="/" />} />
                            <Route path="/chat" element={user ? <Chat user={user} /> : <Navigate to="/" />} />
                            {/* Catch-all for unknown routes -> Redirect to Home */}
                            <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                        <Footer />
                    </>
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;