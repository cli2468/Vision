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

let app;
let auth;
let db;
let googleProvider;

try {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
        throw new Error('Firebase API Key is missing or default. Live features will be disabled.');
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    console.log('✅ Firebase initialized successfully.');
} catch (error) {
    console.warn('⚠️ Firebase initialization skipped:', error.message);
    // Export nulls or mocks to prevent top-level crashes
    app = null;
    auth = {
        onAuthStateChanged: (cb) => {
            // Immediately trigger with "no user" to allow app to boot into demo mode
            setTimeout(() => cb(null), 0);
            return () => { };
        }
    };
    db = null;
    googleProvider = null;
}

export { auth, db };


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
