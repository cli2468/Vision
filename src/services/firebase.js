// Firebase initialization and authentication service

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

console.log('🔥 Initializing Firebase...');
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Simple popup sign-in
export const signInWithGoogle = async () => {
    console.log('🔑 Starting Google sign-in...');
    const result = await signInWithPopup(auth, googleProvider);
    console.log('✅ Sign-in success:', result.user.email);
    return result.user;
};

export const logout = () => {
    console.log('👋 Signing out...');
    return signOut(auth);
};

// Helper to listen to auth state changes
export const onUserChanged = (callback) => {
    return onAuthStateChanged(auth, (user) => {
        console.log('👤 Auth state change:', user ? user.email : 'No user');
        callback(user);
    });
};
