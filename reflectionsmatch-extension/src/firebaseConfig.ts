import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- PASTE YOUR REAL CONFIG OBJECT BELOW ---
const firebaseConfig = {
    apiKey: "AIzaSyCswu4w1IBaSvbsZ-qvx_wJmUOuEtdhQLU",
    authDomain: "reflections-match.firebaseapp.com",
    projectId: "reflections-match",
    storageBucket: "reflections-match.firebasestorage.app",
    messagingSenderId: "976571807414",
    appId: "1:976571807414:web:36070142998611858ed817",
    measurementId: "G-C1TQVN44XY"
};
// -------------------------------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// EXPORT these so we can use them in other files!
export const storage = getStorage(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
