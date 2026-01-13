import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCswu4w1IBaSvbsZ-qvx_wJmUOuEtdhQLU",
    authDomain: "reflections-match.firebaseapp.com",
    projectId: "reflections-match",
    storageBucket: "reflections-match.firebasestorage.app",
    messagingSenderId: "976571807414",
    appId: "1:976571807414:web:36070142998611858ed817",
    measurementId: "G-C1TQVN44XY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
