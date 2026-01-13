import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Send, Bot, User, Loader, Sparkles } from 'lucide-react';

// TODO: Move to env var
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

const Chat = ({ user }) => {
    const [messages, setMessages] = useState([
        { role: 'model', text: "Hello! I have access to all of your Reflections, notes, usage patterns, and tags. Ask me anything about them." }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [chatSession, setChatSession] = useState(null);
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 1. Fetch Context & Initialize Chat
    useEffect(() => {
        const initChat = async () => {
            if (!user) return;

            try {
                // Fetch all reflections
                const q = query(
                    collection(db, 'reflections'),
                    where("userId", "==", user.uid),
                    orderBy('timestamp', 'desc')
                );
                const snapshot = await getDocs(q);

                let contextString = "These are the user's saved reflection notes:\n\n";
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toDateString() : 'Unknown Date';
                    contextString += `[Record ID: ${doc.id}] Date: ${date}\n`;
                    if (data.notes) contextString += `User Notes: "${data.notes}"\n`;
                    if (data.aiSummary) contextString += `AI Summary: "${data.aiSummary}"\n`;
                    if (data.tags && data.tags.length > 0) contextString += `Tags: ${data.tags.join(', ')}\n`;
                    contextString += "---\n";
                });

                // Fetch User Profile Data (LinkedIn & Resume)
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                const userData = userDocSnap.exists() ? userDocSnap.data() : {};

                const professionalContext = `
                PROFESSIONAL BACKGROUND:
                Resume: ${userData.resumeText ? userData.resumeText.substring(0, 3000) + "..." : "No resume available."}
                LinkedIn: ${userData.linkedinProfileData?.deepProfileText || userData.linkedinProfileData?.about || "No LinkedIn data available."}
                `;

                // Initialize Gemini Chat
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const chat = model.startChat({
                    history: [
                        {
                            role: "user",
                            parts: [{
                                text: `You are an intelligent assistant called 'Reflections Match AI'. 
                            You have access to the user's personal 'Second Brain' of reflections AND their professional background. 
                            Your goal is to help them find patterns, answer questions about their past thoughts, and provide insights.
                            
                            Here is the user's PROFESSIONAL CONTEXT:
                            ${professionalContext}

                            Here is the complete DATA CONTEXT of their reflections:
                            ${contextString}
                            
                            Instructions:
                            1. Answer strictly based on the provided context (Reflections + Professional Data). 
                            2. If the answer isn't in the notes, say "I couldn't find that in your reflections." and suggest a related topic if possible.
                            3. Be concise, friendly, and helpful.
                            4. You can reference specific dates or tags if relevant.` }]
                        },
                        {
                            role: "model",
                            parts: [{ text: "Understood. I am ready to answer questions about the user's reflections and professional background." }]
                        }
                    ],
                });

                setChatSession(chat);
                setLoading(false);

            } catch (error) {
                console.error("Error initializing chat:", error);
                setMessages(prev => [...prev, { role: 'model', text: "Sorry, I had trouble connecting to your reflections. Please try refreshing." }]);
                setLoading(false);
            }
        };

        initChat();
    }, [user]);

    const handleSend = async () => {
        if (!input.trim() || !chatSession || sending) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setSending(true);

        try {
            const result = await chatSession.sendMessage(userMessage);
            const response = await result.response;
            const text = response.text();

            setMessages(prev => [...prev, { role: 'model', text: text }]);
        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, { role: 'model', text: "I'm having trouble thinking right now. Try again?" }]);
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-gray-50">
                <Loader className="animate-spin text-brand mb-4" size={40} />
                <p className="text-gray-500 font-medium animate-pulse">Reading your mind (and notes)...</p>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex items-center justify-center p-4">

            {/* Main Floating Card */}
            <div className="bg-white w-full max-w-3xl h-[75vh] rounded-2xl shadow-xl flex flex-col border border-gray-100 overflow-hidden">

                {/* Header */}
                <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 shrink-0">
                    <div className="bg-indigo-100 p-2 rounded-lg text-brand">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Chat with your Reflections</h1>
                        <p className="text-xs text-gray-500">Ask about your patterns, history, or ideas.</p>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-white">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`flex max-w-[85%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm
                                    ${msg.role === 'user' ? 'bg-brand' : 'bg-gray-200'}`}
                                >
                                    {msg.role === 'user' ? (
                                        user.photoURL ? <img src={user.photoURL} alt="User" className="w-full h-full rounded-full object-cover" /> : <User size={16} className="text-white" />
                                    ) : (
                                        <Bot size={18} className="text-gray-600" />
                                    )}
                                </div>

                                {/* Bubble */}
                                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
                                    ${msg.role === 'user'
                                        ? 'bg-brand text-white rounded-tr-none'
                                        : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        </div>
                    ))}

                    {sending && (
                        <div className="flex justify-start w-full">
                            <div className="flex max-w-[85%] gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-1">
                                    <Bot size={18} className="text-gray-600" />
                                </div>
                                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="bg-white border-t border-gray-100 p-4 shrink-0">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask me anything about your Reflections"
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all text-gray-800 placeholder-gray-400"
                            disabled={sending || loading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || sending || loading}
                            className="bg-brand text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;
