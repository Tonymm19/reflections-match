import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Plus, X, Brain, User, Edit2, Check, Loader, Upload, ExternalLink, FileText, Linkedin } from 'lucide-react';
import LinkedInGuideModal from '../components/LinkedInGuideModal';
import { parsePdf, parseDocx, parseTxt } from '../utils/fileParsers';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

const Profile = ({ user }) => {
    // Identity State
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
    const [tagline, setTagline] = useState(''); // NEW: Tagline
    const [editedSummary, setEditedSummary] = useState(''); // NEW: Editable AI Summary
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingAnalysis, setIsEditingAnalysis] = useState(false); // NEW: Independent Analysis Edit Mode
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingAnalysis, setSavingAnalysis] = useState(false); // NEW: Saving state for analysis
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [isLinkedInModalOpen, setIsLinkedInModalOpen] = useState(false); // NEW
    const [linkedInData, setLinkedInData] = useState(null); // NEW
    const [resumeText, setResumeText] = useState(null); // NEW: Resume Text
    const [uploadingResume, setUploadingResume] = useState(false); // NEW: Resume Upload State
    const fileInputRef = useRef(null); // Ref for file input
    const resumeInputRef = useRef(null); // NEW Ref



    // ... (rest of code)


    // Data State
    const [interests, setInterests] = useState([]);
    const [personaData, setPersonaData] = useState(null); // { archetype, traits, summary }
    const [newInterest, setNewInterest] = useState('');
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [lastAnalyzed, setLastAnalyzed] = useState(null);
    const [lastAnalysisCount, setLastAnalysisCount] = useState(0); // NEW: Track count
    const [toastMessage, setToastMessage] = useState(null); // NEW: Toast state

    // Helper for Toast
    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Sync personaData summary to editedSummary when loaded or editing starts
    useEffect(() => {
        if (personaData?.summary) {
            setEditedSummary(personaData.summary);
        }
    }, [personaData, isEditing]);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            try {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setInterests(data.explicitInterests || []);
                    setTagline(data.tagline || ''); // Fetch tagline
                    if (data.linkedinProfileData) setLinkedInData(data.linkedinProfileData); // NEW
                    if (data.resumeText) setResumeText(data.resumeText); // Fetch resume text
                    if (data.lastAnalysisCount) setLastAnalysisCount(data.lastAnalysisCount); // Fetch count

                    // Parse stored JSON string if it exists
                    if (data.aiPersona) {
                        if (typeof data.aiPersona === 'object') {
                            setPersonaData(data.aiPersona);
                        } else {
                            try {
                                const parsed = JSON.parse(data.aiPersona);
                                setPersonaData(parsed);
                            } catch (e) {
                                setPersonaData({ summary: String(data.aiPersona), archetype: "Legacy Analysis", traits: [] });
                            }
                        }
                    }

                    if (data.lastAnalyzed) {
                        setLastAnalyzed(new Date(data.lastAnalyzed.seconds * 1000));
                    }
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    // --- AUTO-UPDATE LOGIC ---

    // 1. Debounced LinkedIn Watcher
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (linkedInData && !loading && !analyzing) {
                // Heuristic: If we have LinkedIn data but no analysis yet, OR if the analysis is old
                // We check if lastAnalyzed exists to avoid loop on initial load (unless intended)
                if (lastAnalyzed) {
                    showToast("LinkedIn data updated. Refreshing analysis...");
                    analyzePersona();
                }
            }
        }, 2000); // 2s Debounce

        return () => clearTimeout(timeoutId);
    }, [linkedInData]);

    // 2. Reflection Threshold Check on Load
    useEffect(() => {
        const checkThreshold = async () => {
            if (!user || loading || analyzing) return;

            // Wait a moment for profile data to be fully set
            if (lastAnalysisCount === undefined) return;

            const q = query(
                collection(db, 'reflections'),
                where("userId", "==", user.uid)
            );
            const snapshot = await getDocs(q);
            const currentCount = snapshot.size;

            if (currentCount - lastAnalysisCount >= 5) {
                showToast(`You have ${currentCount - lastAnalysisCount} new reflections! Updating analysis...`);
                analyzePersona();
            }
        };

        checkThreshold();
    }, [user, loading, lastAnalysisCount]);
    // --- END AUTO-UPDATE LOGIC ---

    // --- AUTO-UPDATE LOGIC ---

    // 1. Debounced LinkedIn Watcher
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (linkedInData && !loading && !analyzing) {
                // Heuristic: If we have LinkedIn data but no analysis yet, OR if the analysis is old.
                if (lastAnalyzed) {
                    showToast("LinkedIn data updated. Refreshing analysis...");
                    analyzePersona();
                }
            }
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [linkedInData]);

    // 2. Reflection Threshold Check on Load
    useEffect(() => {
        const checkThreshold = async () => {
            if (!user || loading || analyzing) return;
            if (lastAnalysisCount === undefined) return;

            const q = query(
                collection(db, 'reflections'),
                where("userId", "==", user.uid)
            );
            const snapshot = await getDocs(q);
            const currentCount = snapshot.size;

            if (currentCount - lastAnalysisCount >= 5) {
                showToast(`You have ${currentCount - lastAnalysisCount} new reflections! Updating analysis...`);
                analyzePersona();
            }
        };

        checkThreshold();
    }, [user, loading, lastAnalysisCount]);
    // --- END AUTO-UPDATE LOGIC ---

    // Handlers
    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingPhoto(true);
        try {
            const storageRef = ref(storage, `profile_pics/${user.uid}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            await updateProfile(user, { photoURL: url });
            await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true });
            setPhotoURL(url);
            showToast("Profile photo updated!");
        } catch (error) {
            console.error(error);
            showToast("Failed to upload photo.");
        } finally {
            setUploadingPhoto(false);
        }
    };

    const analyzePersona = async () => {
        setAnalyzing(true);
        // showToast("Analyzing your latest data..."); // Can be called by caller or here
        try {
            // 1. Fetch all reflections for this user
            const q = query(
                collection(db, 'reflections'),
                where("userId", "==", user.uid),
                orderBy('timestamp', 'desc')
            );
            const querySnapshot = await getDocs(q);
            const currentReflectionCount = querySnapshot.size;

            if (querySnapshot.empty) {
                alert("You need to save some reflections first!");
                setAnalyzing(false);
                return;
            }

            // 2. Aggregate Data
            let accumulatedText = "USER REFLECTIONS:\n";
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.aiSummary) accumulatedText += `Summary: ${data.aiSummary}\n`;
                if (data.tags) accumulatedText += `Tags: ${data.tags.join(', ')}\n`;
                accumulatedText += "---\n";
            });

            // Add Professional Context
            let professionalContext = "\nPROFESSIONAL CONTEXT:\n";
            if (resumeText) {
                professionalContext += `RESUME CONTENT:\n${resumeText.substring(0, 5000)}\n\n`; // Limit length
            }
            if (linkedInData?.deepProfileText) {
                professionalContext += `LINKEDIN DATA:\n${linkedInData.deepProfileText}\n\n`;
            } else if (linkedInData) {
                professionalContext += `LINKEDIN SUMMARY:\n${linkedInData.headline}\n${linkedInData.about}\n`;
            }

            // 3. Call Gemini
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            // Construct Prompt matching User Request
            const prompt = `
            SYSTEM CONTEXT:
            You are analyzing the user '${user.displayName || "User"}'.
            
            SOURCE A: PROFESSIONAL DATA (LinkedIn/Resume)
            ${linkedInData?.deepProfileText || linkedInData?.about || "No LinkedIn data found."}
            ${resumeText || "No Resume data found."}

            SOURCE B: PERSONAL REFLECTIONS (Notes)
            ${accumulatedText}

            TASK:
            Create a 'Reflection Analysis' that blends their professional expertise with their personal curiosities.
            Return a valid JSON object with: 
            1. "traits" (Extract 5-7 distinct 'Archetypes' or 'Skills' as short 2-3 word tags e.g., 'AR/VR Strategist', 'Music Historian', 'Health Bio-hacker'. Do NOT write full sentences.), 
            2. "summary" (Write a rich, nuanced professional biography (approx. 150-200 words). Weave the user's professional expertise with their personal passions to create a holistic picture of who they are. Avoid generic corporate speak; make it sound like a premium bio. Address the user as 'You'.). 
            Do NOT refer to 'the user' in the third person. Do NOT wrap in markdown code blocks.
            
            Data to Analyze:
            ${accumulatedText}
            ${professionalContext}`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean up any markdown blocks if the model ignores the instruction
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const analysis = JSON.parse(cleanText);

            // 4. Save Result (as Stringified JSON for simple storage)
            const now = new Date();
            setPersonaData(analysis);
            setLastAnalyzed(now);
            setLastAnalysisCount(currentReflectionCount); // Update local count

            const docRef = doc(db, 'users', user.uid);
            await setDoc(docRef, {
                aiPersona: JSON.stringify(analysis),
                lastAnalyzed: now,
                lastAnalysisCount: currentReflectionCount // Update firestore count
            }, { merge: true });

        } catch (error) {
            console.error("Error analyzing persona:", error);
            showToast("Analysis failed. Please try again.");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleUpdateProfile = async () => {
        setSavingProfile(true);
        try {
            await updateProfile(user, { displayName });
            await setDoc(doc(db, 'users', user.uid), { displayName, tagline }, { merge: true });
            setIsEditing(false);
            showToast("Profile updated!");
        } catch (error) {
            console.error(error);
            showToast("Failed to update profile.");
        } finally {
            setSavingProfile(false);
        }
    };

    const addInterest = () => {
        if (newInterest.trim() && !interests.includes(newInterest.trim())) {
            const updated = [...interests, newInterest.trim()];
            setInterests(updated);
            setDoc(doc(db, 'users', user.uid), { explicitInterests: updated }, { merge: true });
            setNewInterest('');
        }
    };

    const removeInterest = (index) => {
        const updated = interests.filter((_, i) => i !== index);
        setInterests(updated);
        setDoc(doc(db, 'users', user.uid), { explicitInterests: updated }, { merge: true });
    };

    const handleUpdateAnalysis = async () => {
        setSavingAnalysis(true);
        try {
            const updatedPersona = { ...personaData, summary: editedSummary };
            setPersonaData(updatedPersona);
            await setDoc(doc(db, 'users', user.uid), { aiPersona: JSON.stringify(updatedPersona) }, { merge: true });
            setIsEditingAnalysis(false);
            showToast("Analysis summary updated!");
        } catch (error) {
            console.error(error);
            showToast("Failed to save analysis.");
        } finally {
            setSavingAnalysis(false);
        }
    };

    const handleResumeUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingResume(true);
        showToast("Processing resume...");

        try {
            let text = "";
            const fileType = file.name.toLowerCase();

            if (fileType.endsWith('.pdf')) {
                text = await parsePdf(file);
            } else if (fileType.endsWith('.docx')) {
                text = await parseDocx(file);
            } else if (fileType.endsWith('.txt')) {
                text = await parseTxt(file);
            } else {
                showToast("Unsupported file format. Please upload .pdf, .docx, or .txt");
                setUploadingResume(false);
                return;
            }

            if (!text || text.trim().length < 50) {
                showToast("Could not extract enough text from this file.");
                setUploadingResume(false);
                return;
            }

            // Save to Firestore
            const docRef = doc(db, 'users', user.uid);
            await setDoc(docRef, { resumeText: text }, { merge: true });
            setResumeText(text);

            // AUTO-ACTION: Analyze immediately
            showToast("Resume saved! Updating analysis...");
            await analyzePersona();

        } catch (error) {
            console.error("Error uploading resume:", error);
            showToast(`Error: ${error.message}`);
        } finally {
            setUploadingResume(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading profile...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12 relative">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-24 right-6 bg-indigo-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-slideIn">
                    <Loader size={20} className="animate-spin text-indigo-300" />
                    <div>
                        <p className="font-bold text-sm">AI Update</p>
                        <p className="text-xs text-indigo-200">{toastMessage}</p>
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto space-y-8">
                {/* ... rest of render ... */}

                {/* Identity Header */}
                <div className="bg-white rounded-2xl shadow-sm p-8 flex flex-col md:flex-row items-center gap-8 border border-gray-100">
                    {/* Photo Upload Interaction */}
                    <div
                        className="h-24 w-24 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 font-bold text-2xl border-4 border-white shadow-md overflow-hidden relative group cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                        title="Change Profile Photo"
                    >
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                            <span>{user?.displayName ? user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : "TM"}</span>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {uploadingPhoto ? <Loader className="animate-spin text-white" size={20} /> : <Edit2 size={20} className="text-white" />}
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            ref={fileInputRef}
                            disabled={uploadingPhoto}
                        />
                    </div>


                    <div className="flex-1 text-center md:text-left w-full">
                        {isEditing ? (
                            // ... existing edit view ...
                            <div className="flex flex-col gap-2 w-full max-w-md mx-auto md:mx-0">
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Display Name"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="text-xl font-bold text-gray-900 border-b-2 border-brand focus:outline-none bg-transparent px-1 flex-1"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleUpdateProfile}
                                        disabled={savingProfile}
                                        className="bg-brand text-white p-2 rounded-lg hover:bg-blue-700 transition shadow-sm"
                                        title="Save Changes"
                                    >
                                        <Check size={18} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            setDisplayName(user?.displayName || '');
                                            setTagline(user?.tagline || tagline); // Revert tagline
                                        }}
                                        className="bg-gray-100 text-gray-500 p-2 rounded-lg hover:bg-gray-200 hover:text-red-500 transition shadow-sm"
                                        title="Cancel"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Add a tagline..."
                                    value={tagline}
                                    onChange={(e) => setTagline(e.target.value)}
                                    className="text-sm text-gray-600 border-b border-gray-200 focus:border-brand focus:outline-none bg-transparent px-1 py-1 w-full italic"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center md:items-start group">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-3xl font-bold text-gray-900">
                                        {displayName || "Anonymous User"}
                                    </h1>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="text-gray-400 hover:text-brand transition opacity-0 group-hover:opacity-100"
                                        title="Edit Name & Tagline"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                                <p className="text-gray-500 italic mt-1 min-h-[1.5em] mb-2">
                                    {tagline || "No tagline set"}
                                </p>

                                {/* Stats Row */}
                                <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
                                    <span>{lastAnalysisCount || 0} Reflections</span>
                                    <span>•</span>
                                    <span>5 Active Pursuits</span>
                                </div>
                            </div>
                        )}
                        {/* Email removed as requested */}
                    </div>

                    <div className="text-right">
                        <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold">
                            {interests.length} Interests
                        </div>
                    </div>
                </div>

                {/* LinkedIn Guide Modal */}
                <LinkedInGuideModal
                    isOpen={isLinkedInModalOpen}
                    onClose={() => setIsLinkedInModalOpen(false)}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Data Sources & Inputs */}
                    <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 h-full flex flex-col">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <span className="bg-blue-50 text-blue-600 p-2 rounded-lg">🔌</span>
                            Data Sources & Inputs
                        </h2>

                        {/* Connection Status Section */}
                        <div className="space-y-3 mb-8">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Connected Accounts</h3>

                            {/* LinkedIn Row */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="bg-[#0077B5] text-white p-2 rounded-lg">
                                        <Linkedin size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">LinkedIn</p>
                                        <p className="text-xs text-gray-500">{linkedInData ? "Profile Synced" : "Not connected"}</p>
                                    </div>
                                </div>
                                {linkedInData ? (
                                    <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                        <Check size={12} /> Synced
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsLinkedInModalOpen(true)}
                                        className="text-[#0077B5] text-xs font-bold hover:underline"
                                    >
                                        Connect
                                    </button>
                                )}
                            </div>

                            {/* Resume Row */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-600 text-white p-2 rounded-lg">
                                        <FileText size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">Resume / Bio</p>
                                        <p className="text-xs text-gray-500">{resumeText ? "Parsed & Active" : "Not uploaded"}</p>
                                    </div>
                                </div>
                                {resumeText ? (
                                    <div className="flex items-center gap-2">
                                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                            <Check size={12} /> Parsed
                                        </span>
                                        <button
                                            onClick={() => resumeInputRef.current?.click()}
                                            className="text-gray-400 hover:text-purple-600"
                                            title="Re-upload"
                                        >
                                            <Upload size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => resumeInputRef.current?.click()}
                                        className="text-purple-600 text-xs font-bold hover:underline"
                                    >
                                        Upload
                                    </button>
                                )}
                            </div>
                        </div>

                        <h3 className="text-gray-900 font-bold mb-3 flex items-center gap-2">
                            <span className="bg-yellow-100 text-yellow-600 p-1.5 rounded-lg text-xs">🎯</span>
                            Manual Interests
                        </h3>

                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                className="flex-1 border border-gray-200 bg-gray-50 rounded-lg px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-brand focus:border-brand focus:outline-none transition-all"
                                placeholder="Add an interest (comma separated)..."
                                value={newInterest}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val.includes(',')) {
                                        const parts = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
                                        const newItems = parts.filter(p => !interests.includes(p));

                                        if (newItems.length > 0) {
                                            const updatedInterests = [...interests, ...newItems];
                                            setInterests(updatedInterests);
                                            // Save to firestore immediately for seamless UX
                                            const docRef = doc(db, 'users', user.uid);
                                            setDoc(docRef, { explicitInterests: updatedInterests }, { merge: true }).catch(console.error);
                                        }
                                        setNewInterest('');
                                    } else {
                                        setNewInterest(val);
                                    }
                                }}
                                onKeyPress={(e) => e.key === 'Enter' && addInterest()}
                            />
                            <button
                                onClick={addInterest}
                                className="bg-gray-900 text-white px-4 rounded-lg font-medium hover:bg-black transition-colors"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {interests.map((interest, index) => (
                                <span key={index} className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 group hover:border-red-200 hover:bg-red-50 transition-colors">
                                    {interest}
                                    <button
                                        onClick={() => removeInterest(index)}
                                        className="text-gray-300 group-hover:text-red-500 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </span>
                            ))}
                            {interests.length === 0 && (
                                <p className="text-gray-400 text-sm italic w-full text-center py-4">
                                    No interests added yet. What are you tracking?
                                </p>
                            )}
                        </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden h-full min-h-[600px] flex flex-col">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Brain size={200} />
                        </div>

                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">✨</span>
                                Reflection Analysis
                            </h2>
                            {!isEditingAnalysis && personaData && (
                                <button
                                    onClick={() => setIsEditingAnalysis(true)}
                                    className="text-indigo-200 hover:text-white transition-colors p-1"
                                    title="Edit Summary"
                                >
                                    <Edit2 size={18} />
                                </button>
                            )}
                        </div>

                        <div className="relative z-10 flex-1 flex flex-col">
                            {!personaData && !analyzing ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                                    <p className="text-indigo-100 mb-6 max-w-xs mx-auto">
                                        Unlock your persona analysis based on your reflection patterns.
                                    </p>
                                    <button
                                        onClick={analyzePersona}
                                        className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                                    >
                                        <Brain size={18} /> Analyze Persona
                                    </button>
                                </div>
                            ) : analyzing ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center">
                                    <Loader className="animate-spin mb-4" size={32} />
                                    <p className="text-indigo-100 font-medium animate-pulse">Consulting the oracle...</p>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full animate-fadeIn">
                                    <div className="mb-6">
                                        <h3 className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-3">Core Traits</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {personaData.traits && Array.isArray(personaData.traits) && personaData.traits.map((trait, i) => (
                                                <span key={i} className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-medium shadow-sm backdrop-blur-sm border border-white/10">
                                                    {trait}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {isEditingAnalysis ? (
                                        <div className="flex-1 flex flex-col border-t border-white/20 pt-4 mb-4">
                                            <textarea
                                                value={editedSummary}
                                                onChange={(e) => setEditedSummary(e.target.value)}
                                                className="w-full min-h-[200px] flex-1 bg-indigo-900/50 border border-indigo-700 rounded-lg p-4 text-indigo-100 focus:outline-none focus:ring-2 focus:ring-brand resize-none mb-4 text-sm leading-relaxed"
                                                placeholder="Write your own analysis..."
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => {
                                                        setIsEditingAnalysis(false);
                                                        setEditedSummary(personaData?.summary || '');
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleUpdateAnalysis}
                                                    disabled={savingAnalysis}
                                                    className="px-3 py-1.5 rounded-lg bg-white text-indigo-600 text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center gap-1"
                                                >
                                                    {savingAnalysis ? "Saving..." : "Save Changes"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border-t border-white/10 pt-4 mb-4 flex-1 flex flex-col">
                                            <h3 className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-3">Narrative Bio</h3>
                                            <div className="bg-white/10 rounded-xl p-6 backdrop-blur-sm border border-white/5 flex-1 overflow-y-auto custom-scrollbar">
                                                <p className="text-indigo-50 leading-7 text-sm font-light whitespace-pre-wrap">
                                                    {personaData.summary}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-end mt-auto pt-2">
                                        <span className="text-xs text-indigo-300">
                                            Updated: {lastAnalyzed ? lastAnalyzed.toLocaleDateString() : 'Just now'}
                                        </span>
                                        {!isEditingAnalysis && (
                                            <button
                                                onClick={analyzePersona}
                                                className="text-white/70 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
                                            >
                                                <Brain size={12} /> Refresh
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Profile;
