import { useState, useRef, useEffect } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, serverTimestamp, setDoc, doc, getCountFromServer, query, where, updateDoc } from 'firebase/firestore'
import { storage, db, auth } from './firebaseConfig'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, type User, createUserWithEmailAndPassword } from 'firebase/auth'
import { canvasPreview } from './canvasPreview'
import './App.css'

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
      // Success will trigger onAuthStateChanged
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
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isBursting, setIsBursting] = useState(false); // NEW
  const [buttonText, setButtonText] = useState("Save Reflection"); // NEW

  // Check URL on mount
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        setSourceUrl(tab.url);

        // Check for navigation flag from background script
        if (tab.id) {
          chrome.storage.local.get(['linkedInSync_' + tab.id], (result) => {
            if (result['linkedInSync_' + tab.id]) {
              // If the flag was set (even if redirected), treat as valid sync target
              // We can artificially append the param to sourceUrl state to trigger the UI,
              // or just modify the condition. Let's modify the condition by setting a new state.
              setSourceUrl(prev => prev + "?reflections_sync=true");
              // Clean up flag
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
          // Helper to wait
          const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

          // 1. Force Scroll to bottom to trigger lazy loading
          window.scrollTo(0, document.body.scrollHeight);
          await wait(2000); // Wait for content to load
          window.scrollTo(0, 0); // Scroll back up (optional, but polite)

          // 2. Deep Text Extraction
          const bodyText = document.body.innerText;

          // Heuristic Parsing
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

          // Fallback / Basic Info
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
          // Save to Firestore
          console.log("Saving LinkedIn Data:", data);
          // 2. Save Data to USER DOCUMENT (Sync Profile)
          try {
            await setDoc(doc(db, "users", user!.uid), {
              linkedinProfileData: data,
              tagline: data.headline // Optional: auto-update tagline
            }, { merge: true });

            setUploadSuccess(true);
            setTimeout(() => window.close(), 2000);
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
    setUploadSuccess(false);
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
    setUserNotes(''); // Clear notes on reset
    setError(null);
    setUploadSuccess(false);
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

      // 1. Upload Image
      const filename = `captures/${Date.now()}.png`;
      const storageRef = ref(storage, filename);
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      // 2. Milestone Logic (Check Count BEFORE or parallel)
      // We need to count existing reflections for this user
      let milestoneReached = null;
      let currentReflectionCount = 0;

      try {
        const q = query(collection(db, "reflections"), where("userId", "==", user?.uid));
        const snapshot = await getCountFromServer(q);
        const currentCount = snapshot.data().count;
        const newCount = currentCount + 1; // Anticipating this add
        currentReflectionCount = newCount;

        if (newCount === 10 || newCount === 25) {
          milestoneReached = newCount;
        }
      } catch (err) {
        console.error("Error checking milestone:", err);
      }

      // 3. Save Data (Including user notes)
      console.log("Uploading Reflection for UserID:", user?.uid);
      await addDoc(collection(db, "reflections"), {
        imageUrl: downloadUrl,
        timestamp: serverTimestamp(),
        notes: userNotes,
        sourceUrl: sourceUrl,
        userId: user?.uid // Use real User ID
      });

      // 4. Update User Doc if Milestone Reached
      if (milestoneReached && user?.uid) {
        await updateDoc(doc(db, "users", user.uid), {
          milestoneReached: milestoneReached // Simple flag or value
        });
      }

      // 5. Success Feedback
      setUploadSuccess(true);
      if (currentReflectionCount === 1) {
        setButtonText("1st Reflection Captured! ✨");
      } else {
        setButtonText("Captured! ✨");
      }
      setIsBursting(true);

      setTimeout(() => {
        clearScreenshot();
        window.close();
      }, 2000);

    } catch (err: any) {
      console.error("Upload failed:", err);
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      // Reset generic state if needed, but window closing soon
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>Reflections Match</h1>
        {user ? (
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>
            {user.email} <button onClick={handleSignOut} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline', marginLeft: '5px' }}>Sign Out</button>
          </div>
        ) : (
          <p className="subtitle">Capture and reflect</p>
        )}
      </header>

      <main>
        {authLoading ? (
          <div style={{ padding: '20px' }}>Loading...</div>
        ) : !user ? (
          <div className="login-container" style={{ padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
            {/* ... Login Form ... */}
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#333', marginBottom: '10px' }}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </h2>
              {/* ... existing fields ... */}
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
        ) : sourceUrl?.includes("linkedin.com/in/") ? (
          // LINKEDIN SYNC VIEW
          <div className="capture-container" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ marginBottom: '20px', background: '#e8f4f9', padding: '16px', borderRadius: '12px', border: '1px solid #cce4f0' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#0077B5', fontSize: '1.1rem' }}>LinkedIn Detected</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>We can import your Headline and Bio directly to your profile.</p>
            </div>

            {uploadSuccess ? (
              <div className="success-message" style={{ width: '100%', marginBottom: '16px' }}>
                Profile Synced Successfully!
              </div>
            ) : (
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
            )}

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
            {/* ... Existing Preview UI ... */}
            <p className="crop-instruction">Crop the image, then tell us why it matters.</p>
            <div className="crop-wrapper">
              <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)}>
                <img ref={imgRef} src={screenshotUrl || undefined} alt="Screenshot" style={{ maxWidth: '100%' }} />
              </ReactCrop>
            </div>
            {uploadSuccess ? (
              <div className="success-message" style={{ width: '100%', marginBottom: '16px' }}>Saved successfully!</div>
            ) : (
              <div className="notes-section">
                <textarea className="notes-input" placeholder="Why is this relevant? (Optional)" value={userNotes} onChange={(e) => setUserNotes(e.target.value)} />
                {error && <div className="error-message" style={{ width: '100%', marginTop: '8px' }}>{error}</div>}
              </div>
            )}
            <div className="action-buttons">
              <button className="primary-button upload-btn" onClick={handleUpload} disabled={uploading} style={{ position: 'relative', overflow: 'visible' }}>
                {uploading ? 'Saving...' : buttonText}

                {/* Particle Burst */}
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
      <footer>v1.1.0</footer>
    </div>
  )
}

export default App