import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Loader, Sparkles, Zap, Compass, Save, Bookmark, ExternalLink, RefreshCw, Trash2, Edit3, X } from 'lucide-react';

const API_KEY = 'AIzaSyBGy5jRU5ic7kYJVJT3Hc5cLr9nLAkRrFA';
const genAI = new GoogleGenerativeAI(API_KEY);

const Radar = ({ user }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [lastGenerated, setLastGenerated] = useState(null);

    useEffect(() => {
        const fetchRadar = async () => {
            if (!user) return;
            try {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.radarSuggestions) {
                        // Store as JSON string in Firestore for simplicity, parse here
                        try {
                            const parsed = typeof data.radarSuggestions === 'string'
                                ? JSON.parse(data.radarSuggestions)
                                : data.radarSuggestions;
                            setSuggestions(parsed);
                        } catch (e) {
                            console.error("Error parsing radar suggestions", e);
                            setSuggestions([]);
                        }
                    }
                    if (data.lastRadarGen) {
                        setLastGenerated(new Date(data.lastRadarGen.seconds * 1000));
                    }
                }
            } catch (error) {
                console.error("Error fetching radar:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRadar();
    }, [user]);

    const generateSuggestions = async () => {
        setGenerating(true);
        try {
            // 1. Context Gathering
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            const userData = userDocSnap.exists() ? userDocSnap.data() : {};

            const reflectionsQ = query(
                collection(db, 'reflections'),
                where("userId", "==", user.uid),
                orderBy('timestamp', 'desc')
            ); // Get recent 5
            const reflectionsSnap = await getDocs(reflectionsQ);

            let recentActivity = "Recent Reflection Topics:\n";
            let count = 0;
            reflectionsSnap.forEach(doc => {
                if (count < 5) {
                    const d = doc.data();
                    if (d.aiSummary) recentActivity += `- ${d.aiSummary}\n`;
                    count++;
                }
            });

            const professionalContext = `
                LinkedIn: ${userData.linkedinProfileData?.deepProfileText || userData.linkedinProfileData?.about || "N/A"}
                Resume: ${userData.resumeText ? userData.resumeText.substring(0, 1000) + "..." : "N/A"}
            `;

            const traitsContext = userData.aiPersona ?
                (typeof userData.aiPersona === 'string' ? userData.aiPersona : JSON.stringify(userData.aiPersona.traits))
                : "N/A";

            // 2. Prompting Gemini
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `
            Act as a Visionary Career & Creativity Coach.
            
            USER PROFILE:
            ${professionalContext}
            
            CORE TRAITS:
            ${traitsContext}

            RECENT INTERESTS:
            ${recentActivity}

            TASK:
            Generate 3 distinct 'Growth Cards' for this user to explore this week.
            
            1. 'Deep Dive': A specific technical skill, methodology, or professional topic they should master to level up.
            2. 'Wildcard': A surprising, creative intersection of their hobbies/interests (e.g., "Mix Biology with Data Vis").
            3. 'Spark': A deep philosophical question or mental model challenge related to their work/life.

            RETURN JSON ARRAY (No markdown):
            [
                { 
                    "type": "Deep Dive", 
                    "title": "Short Punchy Title", 
                    "description": "2 sentences explaining WHY availability and HOW to start.", 
                    "actionItem": "A concrete first step (e.g. 'Read x', 'Prototype y')" 
                },
                ... (Wildcard, Spark)
            ]
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const newSuggestions = JSON.parse(cleanText);

            // 3. Save
            setSuggestions(newSuggestions);
            const now = new Date();
            setLastGenerated(now);

            await updateDoc(userDocRef, {
                radarSuggestions: JSON.stringify(newSuggestions), // Store as string to be safe with varying formats
                lastRadarGen: now
            });

        } catch (error) {
            console.error("Error generating radar:", error);
            alert("Failed to generate suggestions. Try again.");
        } finally {
            setGenerating(false);
        }
    };

    const [activePursuits, setActivePursuits] = useState([]);

    // Modal State
    const [selectedPursuit, setSelectedPursuit] = useState(null);
    const [noteText, setNoteText] = useState("");
    const [currStatus, setCurrStatus] = useState("Not Started");

    const openModal = (item) => {
        setSelectedPursuit(item);
        setNoteText(item.notes || "");
        setCurrStatus(item.status || "Not Started");
    };

    const handleSaveNotes = async () => {
        if (!selectedPursuit) return;
        try {
            const docRef = doc(db, 'reflections', selectedPursuit.id);
            await updateDoc(docRef, {
                notes: noteText,
                status: currStatus
            });
            alert("Updated successfully!");
            setSelectedPursuit(null); // Close modal
        } catch (error) {
            console.error("Error updating:", error);
            alert("Failed to update.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this Pursuit?")) {
            try {
                await deleteDoc(doc(db, 'reflections', id));
                if (selectedPursuit && selectedPursuit.id === id) {
                    setSelectedPursuit(null);
                }
            } catch (error) {
                console.error("Error deleting:", error);
                alert("Failed to delete.");
            }
        }
    };

    // Fetch Active Pursuits (Client-side filtering to verify "Save" worked and show list)
    useEffect(() => {
        if (!user) return;

        // Query ONLY by userId to avoid composite index requirements
        const q = query(
            collection(db, 'reflections'),
            where("userId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(item => item.source === 'radar') // Client-side filter
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)); // Client-side sort

            setActivePursuits(data);
        });

        return () => unsubscribe();
    }, [user]);

    const handleSaveToBoard = async (card) => {
        // Prevent duplicates check
        if (activePursuits.some(p => p.aiSummary === card.title)) return;

        try {
            await addDoc(collection(db, 'reflections'), {
                userId: user.uid,
                notes: "", // Start empty, user fills in modal
                aiSummary: card.title,
                description: card.description, // Save explicitly for modal context
                actionItem: card.actionItem,   // Save explicitly for modal context
                tags: ["Radar", card.type],
                source: "radar",
                radarType: card.type,
                status: "Not Started", // Default status
                timestamp: serverTimestamp()
            });

            // No alert needed if the list updates below instantly
        } catch (error) {
            console.error("Error saving to board:", error);
            alert("Failed to save.");
        }
    };

    if (loading) return <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-4"><Loader className="animate-spin text-brand" size={32} /> Calibrating Radar...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-12">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Compass className="text-brand" size={32} />
                            The Radar
                        </h1>
                        <p className="text-gray-500 mt-2">
                            A weekly forecast of opportunities tailored to your unique identity.
                        </p>
                    </div>
                    <div className="mt-4 md:mt-0 text-right">
                        {suggestions.length > 0 && (
                            <p className="text-xs text-gray-400 mb-2">
                                Last updated: {lastGenerated?.toLocaleDateString()}
                            </p>
                        )}
                        <button
                            onClick={generateSuggestions}
                            disabled={generating}
                            className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                        >
                            {generating ? <Loader className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                            {suggestions.length > 0 ? "Regenerate Radar" : "Activate Radar"}
                        </button>
                    </div>
                </div>

                {/* Grid */}
                {suggestions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {suggestions.map((card, idx) => {
                            let styleClass = "border-t-4 border-gray-300";
                            let Icon = Sparkles;
                            let btnClass = "bg-gray-100 text-gray-700 hover:bg-gray-200";

                            if (card.type === 'Deep Dive') {
                                styleClass = "border-t-4 border-blue-500 bg-gradient-to-b from-blue-50 to-white";
                                Icon = Compass;
                                btnClass = "bg-blue-100 text-blue-700 hover:bg-blue-200";
                            } else if (card.type === 'Wildcard') {
                                styleClass = "border-t-4 border-purple-500 bg-gradient-to-b from-purple-50 to-white";
                                Icon = Zap;
                                btnClass = "bg-purple-100 text-purple-700 hover:bg-purple-200";
                            } else if (card.type === 'Spark') {
                                styleClass = "border-t-4 border-orange-500 bg-gradient-to-b from-orange-50 to-white";
                                Icon = Sparkles;
                                btnClass = "bg-orange-100 text-orange-700 hover:bg-orange-200";
                            }

                            // Check if this card is already in Active Pursuits (by title/summary)
                            const isSaved = activePursuits.some(p => p.aiSummary === card.title);

                            return (
                                <div key={idx} className={`rounded-2xl shadow-md p-6 flex flex-col h-full hover:shadow-xl transition-shadow ${styleClass}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="text-xs font-bold uppercase tracking-wider opacity-60">
                                            {card.type}
                                        </div>
                                        <Icon size={24} className="opacity-80" />
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 mb-3 leading-snug">
                                        {card.title}
                                    </h3>

                                    <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1">
                                        {card.description}
                                    </p>

                                    <div className="bg-white/60 p-4 rounded-xl mb-6 border border-black/5">
                                        <p className="text-xs font-bold text-gray-500 mb-1">ACTION ITEM</p>
                                        <p className="text-sm font-medium text-gray-800">{card.actionItem}</p>
                                    </div>

                                    <button
                                        onClick={() => handleSaveToBoard(card)}
                                        disabled={isSaved}
                                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${isSaved ? "bg-green-100 text-green-700 cursor-default" : btnClass}`}
                                    >
                                        {isSaved ? <Bookmark size={18} className="fill-current" /> : <Bookmark size={18} />}
                                        {isSaved ? "Saved" : "Save to Board"}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                        <Compass className="mx-auto text-gray-300 mb-4" size={64} />
                        <h3 className="text-xl font-medium text-gray-400">Radar is offline.</h3>
                        <p className="text-gray-400 mb-6">Activate it to scan for opportunities.</p>
                        <button
                            onClick={generateSuggestions}
                            className="bg-brand text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700"
                        >
                            Start Scan
                        </button>
                    </div>
                )}

                {/* Active Pursuits Section */}
                {activePursuits.length > 0 && (
                    <div className="animate-fadeIn">
                        <div className="flex items-center gap-4 mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Active Pursuits</h2>
                            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                                {activePursuits.length}
                            </span>
                            <div className="h-px bg-gray-200 flex-1"></div>
                        </div>

                        <div className="flex flex-col gap-4">
                            {activePursuits.map((item) => {
                                let badgeColor = "bg-gray-100 text-gray-600";
                                if (item.radarType === 'Deep Dive') badgeColor = "bg-blue-100 text-blue-700";
                                if (item.radarType === 'Wildcard') badgeColor = "bg-purple-100 text-purple-700";
                                if (item.radarType === 'Spark') badgeColor = "bg-orange-100 text-orange-700";

                                return (
                                    <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow group">
                                        <div className="flex items-center gap-4 md:gap-6 flex-1">
                                            {/* Type Badge */}
                                            <div className={`w-2 h-12 rounded-full ${badgeColor.split(' ')[0]}`}></div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                                                        {item.radarType || "Radar"}
                                                    </span>
                                                    {item.status && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase 
                                                            ${item.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                                item.status === 'Stuck' ? 'bg-red-100 text-red-700' :
                                                                    item.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-gray-100 text-gray-500'}`}>
                                                            {item.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-lg font-bold text-gray-900 truncate pr-4">
                                                    {item.aiSummary || "Untitled Pursuit"}
                                                </h4>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openModal(item)}
                                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-brand hover:bg-brand/5 rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <Edit3 size={16} /> Edit/View
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {selectedPursuit && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPursuit(null)}>
                        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 block">
                                        {selectedPursuit.radarType}
                                    </span>
                                    <h3 className="text-xl font-bold text-gray-900">{selectedPursuit.aiSummary}</h3>
                                </div>

                                <div className="flex items-center gap-4">
                                    <select
                                        value={currStatus}
                                        onChange={(e) => setCurrStatus(e.target.value)}
                                        className="bg-gray-100 border-none text-sm font-bold text-gray-700 rounded-lg px-3 py-2 cursor-pointer focus:ring-2 focus:ring-brand"
                                    >
                                        <option value="Not Started">Not Started</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Stuck">Stuck</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                    <button onClick={() => setSelectedPursuit(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-left">
                                {/* Context */}
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-sm text-amber-900 leading-relaxed">
                                    <p className="font-semibold mb-1 opacity-80 text-xs uppercase tracking-wide">Original Prompt</p>
                                    <p>{selectedPursuit.description}</p>
                                    <p className="mt-2 font-medium">Action: {selectedPursuit.actionItem}</p>
                                </div>

                                {/* Editor */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">My Progress & Notes</label>
                                    <textarea
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        className="w-full h-40 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand focus:border-brand outline-none resize-none bg-gray-50 focus:bg-white transition-all font-mono text-sm"
                                        placeholder="Track your progress here..."
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                                <button
                                    onClick={() => handleDelete(selectedPursuit.id)}
                                    className="px-4 py-2 text-red-500 font-medium hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setSelectedPursuit(null)}
                                        className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveNotes}
                                        className="px-6 py-2 bg-brand text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                                    >
                                        <Save size={16} /> Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Radar;
