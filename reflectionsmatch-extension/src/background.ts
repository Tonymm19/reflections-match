import { db, auth } from './firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

console.log("Background Service Worker Loaded");

// Ensure Auth is initialized
let currentUser: any = null;
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Background Auth Restored:", user.uid);
        currentUser = user;
    } else {
        console.log("Background Auth: No user");
        currentUser = null;
    }
});

// 1. Navigation Flag Listener (Legacy/Fallback)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('reflections_sync=true')) {
            chrome.storage.local.set({ ['linkedInSync_' + tabId]: true });
            console.log('LinkedIn Sync flag set for tab', tabId);
        }
    }
});

// 2. Message Listener (Auto-Sync Data)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "LINKEDIN_SYNC_DATA") {
        console.log("Received LinkedIn Data:", message.data);

        // Helper to get user safely
        const saveToFirestore = async () => {
            // If currentUser is not set yet, wait a sec (edge case) or check auth.currentUser directly
            // auth.currentUser is usually synchronous after initial load
            const user = currentUser || auth.currentUser;

            if (!user) {
                console.error("No user logged in extension background.");
                return { success: false, error: "User not logged in. Please open the Reflections extension to sign in." };
            }

            try {
                await setDoc(doc(db, "users", user.uid), {
                    linkedinProfileData: message.data,
                    tagline: message.data.headline
                }, { merge: true });
                console.log("Data saved to Firestore!");
                return { success: true };
            } catch (err: any) {
                console.error("Firestore Save Error:", err);
                return { success: false, error: err.message };
            }
        };

        saveToFirestore().then(sendResponse);
        return true; // Keep message channel open for async response
    }
});
