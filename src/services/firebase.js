// Firebase initialization and authentication service

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD59FLH3amRac3fQjk7YtuHTdpCEofqFq0",
    authDomain: "resell-tracker-5320f.firebaseapp.com",
    projectId: "resell-tracker-5320f",
    storageBucket: "resell-tracker-5320f.firebasestorage.app",
    messagingSenderId: "355958720369",
    appId: "1:355958720369:web:fd3c105d6542889b03d8d0"
};

console.log('🔥 Initializing Firebase...');
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Handle redirect results on page load
getRedirectResult(auth)
    .then((result) => {
        if (result?.user) {
            console.log('✅ Redirect sign-in success:', result.user.email);
        }
    })
    .catch((error) => {
        console.error('❌ Redirect sign-in error:', error);
    });

// Auth function - hybrid popup/redirect
export const signInWithGoogle = async () => {
    console.log('🔑 Starting Google sign-in...');
    try {
        const result = await signInWithPopup(auth, googleProvider);
        console.log('✅ Popup sign-in success:', result.user.email);
        return result.user;
    } catch (error) {
        console.warn('⚠️ Popup sign-in failed/blocked, trying redirect...', error.code);
        // If popup is blocked or fails, use redirect as fallback
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user' || error.code === 'auth/internal-error') {
            await signInWithRedirect(auth, googleProvider);
            return null; // Page will redirect
        }
        throw error;
    }
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

