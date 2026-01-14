import React, { useState, useEffect, useRef } from 'react';
import { db, functions } from '../firebase'; // Adjust path if needed
import { doc, collection, addDoc, query, orderBy, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const PursuitCoach = ({ pursuit, onClose, onDelete }) => {
    const [activeTab, setActiveTab] = useState('roadmap');
    const [updateInput, setUpdateInput] = useState('');
    const [isStuck, setIsStuck] = useState(false);
    const [updates, setUpdates] = useState([]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom of chat
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        // Real-time listener for updates
        const q = query(
            collection(db, 'reflections', pursuit.id, 'updates'), // CHANGED: 'pursuits' -> 'reflections' based on previous context
            orderBy('timestamp', 'asc') // CHANGED: 'createdAt' -> 'timestamp' to match existing data
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUpdates(msgs);
            setTimeout(scrollToBottom, 100); // Scroll after render
        });
        return () => unsubscribe();
    }, [pursuit.id]);

    const handlePostUpdate = async () => {
        if (!updateInput.trim()) return;
        setLoading(true);

        // 1. Add user message immediately for optimistic UI
        // CHANGED: 'pursuits' -> 'reflections', 'createdAt' -> 'timestamp'
        await addDoc(collection(db, 'reflections', pursuit.id, 'updates'), {
            role: 'user',
            text: updateInput,
            isStuck: isStuck,
            timestamp: serverTimestamp()
        });

        // 2. Clear input immediately
        const currentInput = updateInput;
        const currentStuck = isStuck;
        setUpdateInput('');
        setIsStuck(false);

        try {
            // 3. Call Gemini
            const getGoalCoaching = httpsCallable(functions, 'getGoalCoaching');
            const result = await getGoalCoaching({
                goalTitle: pursuit.aiSummary, // CHANGED: pursuit.title -> pursuit.aiSummary
                updateText: currentInput,
                existingRoadmap: pursuit.aiRoadmap, // ADDED: based on previous code usage
                isStuck: currentStuck,
                type: "UPDATE_GOAL"
            });

            // 4. Add AI response
            if (result.data.data.feedback) {
                // CHANGED: 'pursuits' -> 'reflections', 'createdAt' -> 'timestamp'
                await addDoc(collection(db, 'reflections', pursuit.id, 'updates'), {
                    role: 'ai',
                    text: result.data.data.feedback, // CHANGED: result.data.coaching -> result.data.data.feedback to match existing backend response structure
                    timestamp: serverTimestamp()
                });
            }

            // Update parent timestamp
            // CHANGED: 'pursuits' -> 'reflections'
            await updateDoc(doc(db, 'reflections', pursuit.id), { updatedAt: serverTimestamp() });

        } catch (error) {
            console.error("Coaching failed", error);
        }
        setLoading(false);
    };

    return (
        // MAIN MODAL CONTAINER - Fixed Height
        <div className="flex flex-col h-[85vh] bg-white rounded-xl overflow-hidden shadow-2xl">

            {/* 1. FIXED HEADER */}
            <div className="flex-none p-6 border-b border-slate-100 bg-white z-10">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Active Pursuit</span>
                        <h2 className="text-2xl font-bold text-slate-800 leading-tight">{pursuit.aiSummary}</h2> {/* CHANGED: pursuit.title -> pursuit.aiSummary */}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-6 border-b border-slate-100 justify-center">
                    <button
                        onClick={() => setActiveTab('roadmap')}
                        className={`pb-3 text-sm font-semibold transition-colors ${activeTab === 'roadmap' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Roadmap
                    </button>
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`pb-3 text-sm font-semibold transition-colors ${activeTab === 'chat' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Coaching Chat
                    </button>
                </div>
            </div>

            {/* 2. SCROLLABLE BODY */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50/50">
                {activeTab === 'roadmap' ? (
                    <div className="p-6">
                        <div className="bg-teal-50 border border-teal-100 rounded-lg p-5 mb-6">
                            <h4 className="text-sm font-bold text-teal-900 uppercase tracking-wide mb-2">Strategy Assessment</h4>
                            <p className="text-sm text-teal-800 leading-relaxed whitespace-pre-wrap">{pursuit.aiRoadmap?.assessment}</p> {/* CHANGED: Added data access */}
                        </div>
                        {/* Full Roadmap Text */}
                        <div className="prose prose-slate max-w-none">
                            {/* CHANGED: Render phases instead of raw string 'pursuit.roadmap' which doesn't exist on object */}
                            <div className="space-y-4">
                                {pursuit.aiRoadmap?.phases?.map((phase, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-lg shadow-sm">
                                        <h5 className="font-bold text-slate-900 mb-2">{phase.phase}</h5>
                                        <ul className="list-disc leading-relaxed text-sm text-slate-700 pl-4 space-y-1">
                                            {phase.items?.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 flex flex-col gap-4">
                        {/* Chat Banner */}
                        <div className="bg-teal-50 border border-teal-100 rounded-lg p-4 flex items-start gap-3">
                            <div className="bg-teal-100 p-2 rounded-full text-teal-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-teal-900 text-sm">AI Coach Ready</h4>
                                <p className="text-xs text-teal-700 mt-1">
                                    Update me on your progress. Stuck? Let me know, and I'll help you get back in the flow.
                                </p>
                            </div>
                        </div>

                        {/* Message History */}
                        {updates.length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                <p>No updates yet. Start the conversation!</p>
                            </div>
                        )}

                        {updates.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                    ? 'bg-white text-slate-700 border border-slate-100 rounded-tr-none'
                                    : 'bg-teal-50 text-teal-900 border border-teal-100 rounded-tl-none'
                                    }`}>
                                    {msg.isStuck && <span className="inline-block bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded mb-2">STUCK</span>}
                                    <div className="whitespace-pre-wrap">{msg.text}</div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* 3. FIXED FOOTER (Input Area) */}
            {activeTab === 'chat' ? (
                <div className="flex-none p-4 bg-white border-t border-slate-100 z-10 sticky bottom-0">
                    <div className="relative">
                        <textarea
                            value={updateInput}
                            onChange={(e) => setUpdateInput(e.target.value)}
                            placeholder="Share your progress or roadblocks..."
                            className="w-full p-4 pr-32 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-sm transition-all"
                            rows="3"
                        />
                        <div className="absolute bottom-3 right-3 flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={isStuck}
                                    onChange={(e) => setIsStuck(e.target.checked)}
                                    className="w-4 h-4 text-red-500 rounded border-slate-300 focus:ring-red-500"
                                />
                                <span className={`text-xs font-medium transition-colors ${isStuck ? 'text-red-500' : 'text-slate-400 group-hover:text-slate-600'}`}>I'm Stuck</span>
                            </label>
                            <button
                                onClick={handlePostUpdate}
                                disabled={loading || !updateInput.trim()}
                                className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-all ${loading ? 'bg-slate-300' : 'bg-slate-900 hover:bg-slate-800 shadow-md hover:shadow-lg'
                                    }`}
                            >
                                {loading ? 'Thinking...' : 'Add Update'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-none p-4 bg-white border-t border-slate-100 flex justify-between items-center z-10">
                    <button onClick={() => { if (window.confirm('Delete?')) onDelete(pursuit.id); }} className="text-red-500 text-sm font-medium hover:text-red-600 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete Pursuit
                    </button>
                    <button onClick={onClose} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-bold transition-colors">
                        Close
                    </button>
                </div>
            )}
        </div>
    );
};

export default PursuitCoach;
