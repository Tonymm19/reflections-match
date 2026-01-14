import { useState, useRef, useEffect } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, serverTimestamp, setDoc, doc, getCountFromServer, query, where, updateDoc, getDoc } from 'firebase/firestore'
import { storage, db, auth } from './firebaseConfig'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, type User, createUserWithEmailAndPassword } from 'firebase/auth'
import { canvasPreview } from './canvasPreview'
import { GoogleGenerativeAI } from "@google/generative-ai"
import ReactMarkdown from 'react-markdown'
import './App.css'

// Initialize Gemini
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
console.log("Checking VITE_GEMINI_API_KEY status...", API_KEY ? "Present" : "Missing");
if (!API_KEY) {
  console.error("CRITICAL: API Key is missing from the build.");
}
const genAI = new GoogleGenerativeAI(API_KEY);

function App() {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // View State: 'capture', 'success', 'insight'
  const [viewMode, setViewMode] = useState<'capture' | 'success' | 'insight'>('capture');

  // Insight State
  const [insight, setInsight] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError("Authentication failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      clearScreenshot();
    } catch (err) {
      console.error("Sign out failed", err);
    }
  };

  // State for User Notes
  const [userNotes, setUserNotes] = useState('');

  // Crop state
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [isBursting, setIsBursting] = useState(false);
  const [buttonText, setButtonText] = useState("Save Reflection");

  // Check URL on mount
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        setSourceUrl(tab.url);
        if (tab.id) {
          chrome.storage.local.get(['linkedInSync_' + tab.id], (result) => {
            if (result['linkedInSync_' + tab.id]) {
              setSourceUrl(prev => prev + "?reflections_sync=true");
              chrome.storage.local.remove(['linkedInSync_' + tab.id]);
            }
          });
        }
      }
    });
  }, []);

  const handleLinkedInSync = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) throw new Error("No active tab");

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
          window.scrollTo(0, document.body.scrollHeight);
          await wait(2000);
          window.scrollTo(0, 0);

          const bodyText = document.body.innerText;
          const findSection = (keyword: string, length = 1500) => {
            const regex = new RegExp(`${keyword}\\s*\\n`, 'i');
            const match = bodyText.match(regex);
            if (match && match.index) {
              return bodyText.substring(match.index + match[0].length, match.index + match[0].length + length);
            }
            return "";
          };

          const aboutText = findSection("About", 2000);
          const experienceText = findSection("Experience", 4000);
          const getName = () => (document.querySelector('h1') as HTMLElement)?.innerText || "";
          const getHeadline = () => (document.querySelector('.text-body-medium') as HTMLElement)?.innerText || "";
          const getMetaAbout = () => document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";

          return {
            name: getName(),
            headline: getHeadline(),
            about: getMetaAbout(),
            deepProfileText: `About Section:\n${aboutText}\n\nExperience Section:\n${experienceText}\n\n(Extracted from LinkedIn)`,
            profileUrl: window.location.href,
            scrapedAt: new Date().toISOString()
          };
        }
      }, async (results) => {
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message || "Script execution failed");
          setLoading(false);
          return;
        }

        if (results && results[0] && results[0].result) {
          const data = results[0].result;
          try {
            await setDoc(doc(db, "users", user!.uid), {
              linkedinProfileData: data,
              tagline: data.headline
            }, { merge: true });
            setViewMode('success');
          } catch (e: any) {
            setError("Save failed: " + e.message);
          }
        }
        setLoading(false);
      });
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const captureTab = async () => {
    setLoading(true);
    setError(null);
    try {
      chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl: string) => {
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message || 'Failed to capture tab');
          setLoading(false);
          return;
        }
        if (dataUrl) setScreenshotUrl(dataUrl);
        else setError('No image data received');
        setLoading(false);
      });
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
      setLoading(false);
    }
  };

  const clearScreenshot = () => {
    setScreenshotUrl(null);
    setSourceUrl(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setUserNotes('');
    setError(null);
    setViewMode('capture');
    setInsight('');
    setIsAnalyzing(false);
    setIsBursting(false);
    setButtonText("Save Reflection");
  };

  const handleUpload = async () => {
    if (!screenshotUrl) return;
    setUploading(true);
    setError(null);

    try {
      let blob: Blob;
      if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && imgRef.current) {
        blob = await canvasPreview(imgRef.current, completedCrop);
      } else {
        const response = await fetch(screenshotUrl);
        blob = await response.blob();
      }

      const filename = `captures/${Date.now()}.png`;
      const storageRef = ref(storage, filename);
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      let milestoneReached = null;
      let currentReflectionCount = 0;

      try {
        const q = query(collection(db, "reflections"), where("userId", "==", user?.uid));
        const snapshot = await getCountFromServer(q);
        const currentCount = snapshot.data().count;
        const newCount = currentCount + 1;
        currentReflectionCount = newCount;
        if (newCount === 10 || newCount === 25 || newCount === 50 || newCount === 100) {
          milestoneReached = newCount;
        }
      } catch (err) {
        console.error("Error checking milestone:", err);
      }

      await addDoc(collection(db, "reflections"), {
        imageUrl: downloadUrl,
        timestamp: serverTimestamp(),
        notes: userNotes,
        sourceUrl: sourceUrl,
        userId: user?.uid
      });

      if (milestoneReached && user?.uid) {
        await updateDoc(doc(db, "users", user.uid), { milestoneReached });
      }

      setButtonText(currentReflectionCount === 1 ? "1st Reflection Captured! ✨" : "Captured! ✨");
      setIsBursting(true);

      setTimeout(() => {
        setViewMode('success');
      }, 1000);

    } catch (err: any) {
      console.error("Upload failed:", err);
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const generateInsight = async () => {
    if (!user) return;

    setViewMode('insight');
    setIsAnalyzing(true);
    setInsight('');

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      let traitsText = "Unknown Traits";
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.aiPersona && data.aiPersona.traits) {
          traitsText = data.aiPersona.traits.join(", ");
        } else if (data.explicitInterests) {
          traitsText = data.explicitInterests.join(", ");
        }
      }

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const systemPrompt = `You are Tony's Digital Twin. Use his Core Traits (AI Solutions Architect, Guitar Player) to provide a single-turn Digital Twin Brief in Markdown. Structure: 1) One high-level sentence on the signal's impact. 2) Three bulleted 'Next Steps' for his career/interests.
      User Traits: ${traitsText}.
      New Reflection Notes: "${userNotes}"`;

      const result = await model.generateContent(systemPrompt);
      const response = result.response.text();
      setInsight(response);

    } catch (err: any) {
      console.error("Insight generation error:", err);
      setInsight("Unable to generate insight. Please check your connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="App min-h-screen flex flex-col" style={{ width: '100%', height: '100%' }}>
      <header className="app-header p-4 border-b border-gray-200 bg-white">
        <h1 className="text-blue-600 font-bold text-lg m-0">ReflectionsMatch</h1>
        {viewMode !== 'capture' && user && (
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>
            {user.email} <button onClick={handleSignOut} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline', marginLeft: '5px' }}>Sign Out</button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col w-full overflow-hidden relative bg-white">
        {authLoading ? (
          <div style={{ padding: '20px' }}>Loading...</div>
        ) : !user ? (
          <div className="login-container" style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#333', marginBottom: '10px' }}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </h2>
              {error && <div className="error-message">{error}</div>}
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="notes-input" style={{ height: '40px' }} required />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="notes-input" style={{ height: '40px' }} required />
              <button type="submit" className="primary-button" disabled={loading}>{loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}</button>
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={{ background: 'none', border: 'none', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>
                  {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                </button>
              </div>
            </form>
          </div>
        ) : viewMode === 'success' ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] h-full gap-8 p-6 w-full">
            <div className="flex flex-col items-center text-center">
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✨</div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: '#166534', fontWeight: 'bold' }}>Reflection Captured!</h2>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>Insights are emerging in your Reflections...</p>
            </div>

            <div className="w-full flex flex-col items-center gap-4">
              <button
                className="primary-button w-full max-w-[240px] flex items-center justify-center gap-2"
                onClick={generateInsight}
                style={{ padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 600, backgroundColor: '#2563eb', color: 'white' }}
              >
                <span>✨</span> Ask Your Reflections
              </button>

              <button
                className="primary-button w-full max-w-[240px]"
                onClick={clearScreenshot}
                style={{ backgroundColor: '#4b5563', padding: '12px', borderRadius: '8px', border: 'none', color: 'white' }}
              >
                Done
              </button>
            </div>
          </div>
        ) : viewMode === 'insight' ? (
          // Use a fade-in animation container
          <div className="flex flex-col h-full bg-gray-50 animate-in fade-in duration-700">
            <div className="flex-1 overflow-y-auto p-4">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <p className="text-gray-600 font-medium animate-pulse">Analyzing Patterns...</p>
                  <div className="flex gap-2">
                    <div className="w-2 h-8 bg-slate-700 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-8 bg-slate-700 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-8 bg-slate-700 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <div className="bg-[#1e1f22] p-6 rounded-xl border-l-4 border-purple-500 shadow-2xl text-white">
                    <div className="prose prose-invert max-w-none">
                      <ReactMarkdown>
                        {insight}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              <button
                onClick={clearScreenshot}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors"
              >
                Back to Reflections
              </button>
            </div>
          </div>
        ) : sourceUrl?.includes("linkedin.com/in/") ? (
          // ... LinkedIn Sync View (Same as before)
          <div className="capture-container" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ marginBottom: '20px', background: '#e8f4f9', padding: '16px', borderRadius: '12px', border: '1px solid #cce4f0' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#0077B5', fontSize: '1.1rem' }}>LinkedIn Detected</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>We can import your Headline and Bio directly to your profile.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '0.8rem', color: '#666' }}>We are auto-syncing your profile in the background. If it didn't work, click below.</p>
              <button
                className="primary-button"
                style={{ background: '#0077B5' }}
                onClick={handleLinkedInSync}
                disabled={loading}
              >
                {loading ? 'Syncing...' : 'Force Sync Profile'}
              </button>
            </div>

            {error && <div className="error-message" style={{ marginTop: '16px' }}>{error}</div>}

            <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px', width: '100%' }}>
              <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '10px' }}>Or use standard capture:</p>
              <button className="secondary-button" onClick={() => setSourceUrl("manual_override")} style={{ width: '100%' }}>Capture Snapshot</button>
            </div>
          </div>
        ) : !screenshotUrl ? (
          <div className="capture-container">
            <button className="primary-button capture-btn" onClick={captureTab} disabled={loading}>
              {loading ? 'Capturing...' : 'Capture This Page'}
            </button>
          </div>
        ) : (
          <div className="preview-container">
            <p className="crop-instruction">Crop the image, then tell us why it matters.</p>
            <div className="crop-wrapper">
              <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)}>
                <img ref={imgRef} src={screenshotUrl || undefined} alt="Screenshot" style={{ maxWidth: '100%' }} />
              </ReactCrop>
            </div>

            <div className="notes-section">
              <textarea className="notes-input" placeholder="Why is this relevant? (Optional)" value={userNotes} onChange={(e) => setUserNotes(e.target.value)} />
              {error && <div className="error-message" style={{ width: '100%', marginTop: '8px' }}>{error}</div>}
            </div>

            <div className="action-buttons">
              <button className="primary-button upload-btn" onClick={handleUpload} disabled={uploading} style={{ position: 'relative', overflow: 'visible' }}>
                {uploading ? 'Saving...' : buttonText}
                {isBursting && (
                  <>
                    {[...Array(12)].map((_, i) => {
                      const colors = ['#00FFFF', '#FF00FF', '#32CD32', '#FFE600'];
                      const angle = (i / 12) * 360;
                      const delay = Math.random() * 0.2;
                      return (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: colors[i % 4],
                            animation: `particle-burst 0.8s ease-out forwards ${delay}s`,
                            transform: `translate(-50%, -50%) rotate(${angle}deg) translate(0px)`,
                            pointerEvents: 'none',
                            zIndex: 999,
                            '--angle': `${angle}deg`
                          } as React.CSSProperties}
                        />
                      );
                    })}
                  </>
                )}
              </button>
              <button className="secondary-button reset-btn" onClick={clearScreenshot} disabled={uploading}>Reset</button>
            </div>
          </div>
        )}
      </main>
      <footer style={viewMode === 'insight' || viewMode === 'success' ? { backgroundColor: '#f3f4f6', color: '#9ca3af', borderTop: 'none' } : {}}>v1.3.0</footer>
    </div>
  )
}

export default App