import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, onSnapshot, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Loader, Sparkles, Zap, Compass, Save, Bookmark, ExternalLink, RefreshCw, Trash2, Edit3, X, Play, CheckCircle, MessageSquare } from 'lucide-react';
import PursuitCoach from './PursuitCoach';
import ignitiaLogo from '../assets/ignitia_logo.jpg';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
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

    // New Function to handle direct status updates from the list
    const handleStatusChange = async (id, newStatus) => {
        try {
            await updateDoc(doc(db, 'reflections', id), {
                status: newStatus
            });
            // Local state update is handled by the real-time listener (onSnapshot)
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status.");
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

    const [loadingAction, setLoadingAction] = useState(null); // ID of pursuit being processed
    const [updateInput, setUpdateInput] = useState("");
    const [coachingFeedback, setCoachingFeedback] = useState("");

    const handleStartPursuit = async (pursuit) => {
        setLoadingAction(pursuit.id);
        try {
            const getGoalCoaching = httpsCallable(functions, 'getGoalCoaching');
            const result = await getGoalCoaching({
                type: "INITIAL_PLAN",
                pursuitId: pursuit.id,
                goalTitle: pursuit.aiSummary,
                goalDescription: pursuit.description || "No description provided."
            });

            if (result.data.status === "success") {
                const updatedData = {
                    status: 'In Progress', // Changed from 'active' to match UI options better, or keep 'active' if backend relies on it. sticking to 'active' if users code used it, but 'In Progress' is better for the UI dropdown. Let's use 'In Progress' to be safe with the dropdown options? No, let's stick to the code's previous value 'active' unless I see 'active' is not used elsewhere. 
                    // Wait, previous code used 'active'. But the dropdown has "In Progress". 
                    // Let's use 'active' to minimize side effects, but actually, if I want the dropdown to show something valid, 'In Progress' is better. 
                    // However, the user didn't ask to fix the status. I will maintain 'active' to be safe, or check if 'active' maps to proper UI.
                    // Actually, let's look at the previous code again.
                    // It was `status: 'active'`. 
                    // I will keep it 'active' to avoid breaking other logic, but I will open the modal.

                    aiRoadmap: result.data.data,
                    updates: []
                };

                await updateDoc(doc(db, 'reflections', pursuit.id), updatedData);

                // Update local state and open modal immediately
                openModal({ ...pursuit, ...updatedData });
            }
        } catch (error) {
            console.error("Error starting pursuit:", error);
            alert("Failed to start pursuit. Try again.");
        } finally {
            setLoadingAction(null);
        }
    };

    const handlePostUpdate = async () => {
        if (!selectedPursuit || !updateInput.trim()) return;

        setLoadingAction("posting-update");
        try {
            // 1. Add user update locally first (optimistic or just save)
            const newUpdate = {
                role: 'user',
                text: updateInput,
                timestamp: new Date().toISOString()
            };

            const docRef = doc(db, 'reflections', selectedPursuit.id);
            await updateDoc(docRef, {
                updates: arrayUnion(newUpdate)
            });

            // 2. Get Coaching Feedback
            const getGoalCoaching = httpsCallable(functions, 'getGoalCoaching');
            const result = await getGoalCoaching({
                type: "UPDATE_GOAL",
                pursuitId: selectedPursuit.id,
                goalTitle: selectedPursuit.aiSummary,
                updateText: updateInput,
                existingRoadmap: selectedPursuit.aiRoadmap,
                isStuck: currStatus === 'Stuck'
            });

            const aiFeedback = {
                role: 'ai',
                text: result.data.data.feedback,
                timestamp: new Date().toISOString()
            };

            await updateDoc(docRef, {
                updates: arrayUnion(aiFeedback)
            });

            setUpdateInput("");
            setCoachingFeedback(result.data.data.feedback); // Optional: show immediate feedback in UI

            // Update selectedPursuit local state to reflect changes immediately
            setSelectedPursuit(prev => ({
                ...prev,
                updates: [...(prev.updates || []), newUpdate, aiFeedback]
            }));

        } catch (error) {
            console.error("Error posting update:", error);
            alert("Failed to get coaching.");
        } finally {
            setLoadingAction(null);
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

            // Update selected pursuit if it changes in background
            if (selectedPursuit) {
                const updated = data.find(p => p.id === selectedPursuit.id);
                if (updated) setSelectedPursuit(updated);
            }
        });

        return () => unsubscribe();
    }, [user, selectedPursuit?.id]); // Add dependency to keep modal fresh if needed, but carefully to avoid loops

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
                status: "pending", // Default status updated to 'pending'
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
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100 gap-6 md:gap-4">

                    {/* Left Section: Title */}
                    <div className="w-full md:w-auto md:flex-1 text-center md:text-left">
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center md:justify-start gap-3">
                            <Compass className="text-brand" size={32} />
                            The Radar
                        </h1>
                        <p className="text-gray-500 mt-2">
                            A weekly forecast of opportunities tailored to your unique identity.
                        </p>
                    </div>

                    {/* Center Section: Ad Unit */}
                    <div className="w-full md:w-auto md:flex-1 flex justify-center">
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
                    </div>

                    {/* Right Section: Actions */}
                    <div className="w-full md:w-auto md:flex-1 flex flex-col items-center md:items-end gap-2">
                        {suggestions.length > 0 && (
                            <p className="text-xs text-gray-400">
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
                                let borderClass = "border-gray-100"; // Default border

                                if (item.radarType === 'Deep Dive') {
                                    badgeColor = "bg-blue-100 text-blue-700";
                                    borderClass = "border-blue-400"; // Blue border for Deep Dive
                                }
                                if (item.radarType === 'Wildcard') {
                                    badgeColor = "bg-purple-100 text-purple-700";
                                    borderClass = "border-purple-400";
                                }
                                if (item.radarType === 'Spark') {
                                    badgeColor = "bg-orange-100 text-orange-700";
                                    borderClass = "border-orange-400";
                                }

                                return (
                                    <div key={item.id} className={`bg-white rounded-xl p-4 shadow-sm border ${borderClass} flex items-center justify-between hover:shadow-md transition-shadow group border-l-4`}>
                                        <div className="flex items-center gap-4 md:gap-6 flex-1">

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                                                        {item.radarType || "Radar"}
                                                    </span>

                                                    {/* Status Dropdown */}
                                                    <select
                                                        value={item.status || "Not Started"}
                                                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                                        onClick={(e) => e.stopPropagation()} // Prevent card click
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border-none cursor-pointer focus:ring-2 focus:ring-brand
                                                            ${(item.status === 'Completed' || item.status === 'Complete') ? 'bg-green-100 text-green-700' :
                                                                item.status === 'Stuck' ? 'bg-red-100 text-red-700' :
                                                                    (item.status === 'In Progress' || item.status === 'active') ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-gray-100 text-gray-500'}`}
                                                    >
                                                        <option value="Not Started">Not Started</option>
                                                        <option value="active">Active</option>
                                                        <option value="In Progress">In Progress</option>
                                                        <option value="Stuck">Stuck</option>
                                                        <option value="Completed">Completed</option>
                                                        <option value="Archived">Archived</option>
                                                    </select>
                                                </div>
                                                <h4 className="text-lg font-bold text-gray-900 truncate pr-4">
                                                    {item.aiSummary || "Untitled Pursuit"}
                                                </h4>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {item.status === 'pending' || item.status === 'Not Started' ? (
                                                <button
                                                    onClick={() => handleStartPursuit(item)}
                                                    disabled={loadingAction === item.id}
                                                    className="px-4 py-2 text-sm font-bold text-white bg-brand hover:bg-black rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                                                >
                                                    {loadingAction === item.id ? <Loader className="animate-spin" size={16} /> : <Play size={16} />}
                                                    Start Pursuit
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => openModal(item)}
                                                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-brand hover:bg-brand/5 rounded-lg transition-colors flex items-center gap-2"
                                                >
                                                    <Compass size={16} /> View Coach
                                                </button>
                                            )}

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
                        <div className="w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                            {selectedPursuit.aiRoadmap ? (
                                <PursuitCoach
                                    pursuit={selectedPursuit}
                                    onClose={() => setSelectedPursuit(null)}
                                    onDelete={() => handleDelete(selectedPursuit.id)}
                                />
                            ) : (
                                <div className="bg-white rounded-2xl w-full max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
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

                                    {/* Body - Start View */}
                                    <div className="flex-1 bg-white flex flex-col min-h-0 overflow-y-auto">
                                        <div className="flex flex-col items-center justify-center py-12 text-center animate-fadeIn p-6">
                                            <div className="bg-gray-100 p-4 rounded-full mb-4">
                                                <Compass size={32} className="text-gray-400" />
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Start?</h3>
                                            <p className="text-gray-500 max-w-sm mb-8">
                                                Initialize the AI Coach to generate your custom roadmap for <span className="font-bold text-black">"{selectedPursuit.aiSummary}"</span>.
                                            </p>

                                            {/* Context */}
                                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-sm text-amber-900 leading-relaxed max-w-md w-full mb-8 text-left">
                                                <p className="font-semibold mb-1 opacity-80 text-xs uppercase tracking-wide">Original Prompt</p>
                                                <p>{selectedPursuit.description}</p>
                                            </div>

                                            <button
                                                onClick={() => handleStartPursuit(selectedPursuit)}
                                                disabled={loadingAction === selectedPursuit.id}
                                                className="bg-brand text-white text-lg px-8 py-4 rounded-xl font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl flex items-center gap-3 disabled:opacity-70"
                                            >
                                                {loadingAction === selectedPursuit.id ? <Loader className="animate-spin" size={20} /> : <Play size={20} />}
                                                {loadingAction === selectedPursuit.id ? "Analyzing..." : "Generate Roadmap"}
                                            </button>
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
                                                className="px-6 py-2 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-colors"
                                            >
                                                Close
                                            </button>
                                            <button
                                                onClick={handleSaveNotes}
                                                className="px-6 py-2 bg-brand text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                                            >
                                                <Save size={16} /> Save Status
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Radar;
