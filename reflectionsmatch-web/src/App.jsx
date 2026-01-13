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
import Navbar from './components/Navbar';
import { Search, TrendingUp } from 'lucide-react';

// Initialize Gemini
// TODO: Replace with real key or use env var
const API_KEY = 'AIzaSyBGy5jRU5ic7kYJVJT3Hc5cLr9nLAkRrFA';
const genAI = new GoogleGenerativeAI(API_KEY);

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // NEW: Name state
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState(null);

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            if (isSignUp) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Immediately update profile with name
                if (name.trim()) {
                    await updateProfile(userCredential.user, { displayName: name });
                }
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            setError(err.message || "Authentication failed.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-brand">Reflections Match</h1>
                    <p className="text-gray-600 mt-2">Sign in to continue</p>
                </div>

                {/* Email Form */}
                <form onSubmit={handleEmailAuth} className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {isSignUp && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                                placeholder="Jane Doe"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-brand text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {isSignUp ? 'Create Account' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <span className="text-gray-600">
                        {isSignUp ? "Already have an account? " : "Don't have an account? "}
                    </span>
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-brand font-medium hover:underline"
                    >
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </div>
            </div>
        </div>
    );
};

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

const Dashboard = ({ user }) => {
    const [reflections, setReflections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [analyzingIds, setAnalyzingIds] = useState(new Set());
    const processingIds = useRef(new Set());

    // 1. Data Fetching
    useEffect(() => {
        if (!user) return; // Wait for user to be authenticated

        const q = query(
            collection(db, 'reflections'),
            where("userId", "==", user.uid),
            orderBy("timestamp", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setReflections(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching reflections: ", error);
            // This often happens if the index is missing
            if (error.code === 'failed-precondition') {
                console.log("INDEX REQUIRED: Check console/firebase for index creation link.");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // 2. AI Analysis Logic
    const analyzeReflection = async (id, imageUrl) => {
        // Prevent double processing
        if (processingIds.current.has(id)) return;

        console.log(`Starting analysis for ${id}...`);
        processingIds.current.add(id);
        setAnalyzingIds(prev => new Set(prev).add(id));

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            const imagePart = await urlToGenerativePart(imageUrl);

            const prompt = 'Analyze this image. Return a valid JSON object with a "summary" (max 2 sentences) and "tags" (array of 3 keywords). Do not include markdown code block syntax around the JSON.';

            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            // Clean up code blocks if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const analysis = JSON.parse(cleanText);

            console.log("AI Analysis Result:", analysis);

            // Update Firestore
            const docRef = doc(db, "reflections", id);
            await updateDoc(docRef, {
                aiSummary: analysis.summary,
                tags: analysis.tags
            });

        } catch (error) {
            console.error("AI Analysis Failed:", error);
            // Optionally remove from processingIds to retry later
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
            const tagsMatch = reflection.tags?.some(tag => {
                const lowerTag = tag.toLowerCase();
                return lowerTag.includes(term) || (`#${lowerTag}`).includes(term);
            });

            // Date Match
            const dateStr = reflection.timestamp?.seconds
                ? new Date(reflection.timestamp.seconds * 1000).toLocaleDateString()
                : new Date().toLocaleDateString();
            const dateMatch = dateStr.toLowerCase().includes(term);

            return notesMatch || summaryMatch || tagsMatch || dateMatch;
        });
    }, [reflections, searchTerm]);

    // 2.6 Trending Tags Logic
    const trendingTags = useMemo(() => {
        const tagCounts = {};
        reflections.forEach(r => {
            if (r.tags) {
                r.tags.forEach(t => {
                    const tag = t.toLowerCase();
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
        return Object.entries(tagCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([tag]) => tag);
    }, [reflections]);

    // 3. Automation Trigger
    useEffect(() => {
        if (loading) return;

        reflections.forEach(reflection => {
            // Check if analysis is needed: No summary, has image, not already processed
            if (!reflection.aiSummary &&
                (reflection.imageUrl || reflection.url) &&
                !processingIds.current.has(reflection.id)) {
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
                alert("Failed to delete reflection.");
            }
        }
    };

    // 5. Update Summary Handler
    const handleUpdateSummary = async (id, newSummary) => {
        try {
            const docRef = doc(db, "reflections", id);
            await updateDoc(docRef, {
                aiSummary: newSummary
            });
        } catch (error) {
            console.error("Error updating summary:", error);
            alert("Failed to update summary.");
        }
    };

    // 6. Update Notes Handler
    const handleUpdateNotes = async (id, newNotes) => {
        try {
            const docRef = doc(db, "reflections", id);
            await updateDoc(docRef, {
                notes: newNotes
            });
        } catch (error) {
            console.error("Error updating notes:", error);
            alert("Failed to update notes.");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <div className="flex justify-between items-center gap-4">
                        <h1 className="text-2xl font-bold text-brand whitespace-nowrap hidden md:block">Reflections Dashboard</h1>

                        {/* Search Bar - Moved here */}
                        <div className="relative w-full max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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

                {/* Trending Topics Widget */}
                {trendingTags.length > 0 && (
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
                )}

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
                    </div>
                ) : reflections.length === 0 ? (
                    <div className="bg-white p-12 rounded-xl shadow-sm text-center border dashed border-2 border-gray-300">
                        <p className="text-gray-500 text-lg">Your cropped reflections will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredReflections.map((reflection) => (
                            <ReflectionCard
                                key={reflection.id}
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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
            unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
            </div>
        );
    }

    return (
        <BrowserRouter>
            {user && <Navbar user={user} />}
            <Routes>
                <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Login />} />
                <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/" />} />
                <Route path="/profile" element={user ? <Profile user={user} /> : <Navigate to="/" />} />
                <Route path="/radar" element={user ? <Radar user={user} /> : <Navigate to="/" />} />
                <Route path="/chat" element={user ? <Chat user={user} /> : <Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;