import React, { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from '../firebase'; // Import mapped to local config

// Initialize Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const ReflectionUploader = ({ user, onUploadComplete }) => {
    const [isExpanded, setIsExpanded] = useState(false); // New state for collapse/expand
    const [isBursting, setIsBursting] = useState(false); // Particle Burst State
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [file, setFile] = useState(null);
    const [userNote, setUserNote] = useState("");

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
        }
    };

    const handleCancel = () => {
        setFile(null);
        setPreview(null);
        setUserNote("");
        setIsExpanded(false);
    };

    const handleUpload = async () => {
        if (!file) return;
        if (!user) {
            alert("Please sign in to upload.");
            return;
        }

        setLoading(true);

        try {
            // 1. Upload Image to Storage (Added for persistence)
            const filename = `manual_uploads/${user.uid}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, filename);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(snapshot.ref);

            // 2. Convert to Base64 for Gemini Analysis
            const base64Data = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(file);
            });

            // 3. Analyze with Gemini
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const prompt = `Analyze this image. It is a 'reflection' saved by the user to represent their interests or work. 
      User's specific note: "${userNote}".
      
      Output a JSON object with:
      - title: A short, punchy title.
      - summary: A brief summary of what this is and why it matters.
      - tags: A list of 3-5 relevant hashtags (interests).`;

            const result = await model.generateContent([
                prompt,
                { inlineData: { data: base64Data, mimeType: file.type } }
            ]);

            const response = await result.response;
            const text = response.text();
            const jsonStr = text.replace(/```json|```/g, "").trim();
            const analysis = JSON.parse(jsonStr);

            // 4. Save to Firestore
            await addDoc(collection(db, "reflections"), {
                title: analysis.title,
                aiSummary: analysis.summary,
                tags: analysis.tags,
                notes: userNote,
                type: "manual_upload",
                timestamp: serverTimestamp(),
                userId: user.uid,
                imageUrl: downloadUrl, // Save the storage URL
            });

            // Reset and Collapse
            setFile(null);
            setPreview(null);
            setUserNote("");
            setIsExpanded(false);

            // Trigger Particle Burst
            setIsBursting(true);
            setTimeout(() => setIsBursting(false), 1000); // 1s burst duration

            if (onUploadComplete) onUploadComplete();

        } catch (error) {
            console.error("Upload failed:", error);
            alert("Error uploading. Check console.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden transition-all">

            {/* 1. The Collapsed View (Slim Bar) */}
            {!isExpanded ? (
                <div
                    onClick={() => setIsExpanded(true)}
                    className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition text-gray-500"
                >
                    <span className="bg-blue-100 text-blue-600 p-2 rounded-full text-xl">📸</span>
                    <span className="font-medium">Add a manual reflection (Photo, Screenshot, Sketch)...</span>
                </div>
            ) : (
                /* 2. The Expanded View (Form) */
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Add Reflection</h3>
                        <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>

                    {!preview ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition relative">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-3xl">📂</span>
                                <p className="text-gray-600 font-medium text-sm">Click to upload image</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-6 animate-fade-in">
                            <div className="w-full md:w-1/3">
                                <img src={preview} alt="Preview" className="rounded-lg border shadow-sm w-full h-40 object-cover" />
                                <button onClick={() => { setPreview(null); setFile(null) }} className="mt-2 text-xs text-red-500 underline hover:text-red-700">Change Image</button>
                            </div>
                            <div className="w-full md:w-2/3 flex flex-col gap-3">
                                <label className="text-sm font-semibold text-gray-700">Context / Note</label>
                                <textarea
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
                                    rows="3"
                                    placeholder="Why is this meaningful to you?"
                                    value={userNote}
                                    onChange={(e) => setUserNote(e.target.value)}
                                />
                                <div className="flex gap-2 justify-end mt-2">
                                    <button onClick={handleCancel} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                                    <button
                                        onClick={handleUpload}
                                        disabled={loading}
                                        className={`relative px-6 py-2 rounded-lg text-sm font-bold text-white transition overflow-visible ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-md active:scale-95"}`}
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                                Analyzing...
                                            </span>
                                        ) : "Save Reflection"}

                                        {/* Particle Burst */}
                                        {isBursting && (
                                            <>
                                                {[...Array(12)].map((_, i) => {
                                                    const colors = ['#00FFFF', '#FF00FF', '#32CD32', '#FFE600']; // Cyan, Magenta, Lime, Vivid Yellow
                                                    const angle = (i / 12) * 360;
                                                    const delay = Math.random() * 0.2;
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full pointer-events-none"
                                                            style={{
                                                                backgroundColor: colors[i % 4],
                                                                animation: `particle-burst 0.8s ease-out forwards ${delay}s`,
                                                                transform: `translate(-50%, -50%) rotate(${angle}deg) translate(0px)`,
                                                                '--angle': `${angle}deg`
                                                            }}
                                                        />
                                                    );
                                                })}
                                                <style>{`
                                                    @keyframes particle-burst {
                                                        0% { transform: translate(-50%, -50%) rotate(var(--angle)) translate(0px); opacity: 1; }
                                                        100% { transform: translate(-50%, -50%) rotate(var(--angle)) translate(60px); opacity: 0; }
                                                    }
                                                `}</style>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReflectionUploader;
