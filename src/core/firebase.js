// Firebase Integration Module
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

// Firebase state variables
let app;
let auth;
let db;
let currentUser = null;
let userProfile = null;
let isInitialized = false;

/**
 * Initialize Firebase by loading configuration from external file
 * @returns {Promise} Resolves when Firebase is initialized
 */
export async function initializeFirebase() {
    if (isInitialized) return true;

    try {
        // Firebase configuration embedded directly in code
        const firebaseConfig = {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID,
            measurementId: process.env.FIREBASE_MEASUREMENT_ID
        };

        // Initialize Firebase services
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);

        // Set persistence to LOCAL (persists indefinitely)
        await setPersistence(auth, browserLocalPersistence);


        db = getFirestore(app);

        // Set up auth state listener
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            if (user) {

                loadUserProfile(user.uid);
            } else {

                userProfile = null;
            }
        });

        isInitialized = true;

        return true;
    } catch (error) {

        return false;
    }
}

/**
 * Load user profile data from Firestore
 * @param {string} uid - User ID
 */
async function loadUserProfile(uid) {
    try {
        const userDoc = await getDoc(doc(db, "players", "firebase_" + uid));
        if (userDoc.exists()) {

            userProfile = userDoc.data();

            // Dispatch event for other systems to react to
            window.dispatchEvent(new CustomEvent('userProfileLoaded', {
                detail: { profile: userProfile }
            }));

            return userProfile;
        } else {
            // Don't create a profile if it doesn't exist

            userProfile = null;
            return null;
        }
    } catch (error) {

        return null;
    }
}

/**
 * Update user stats in Firestore
 * @param {Object} stats - Stats to update
 */
export async function updateUserStats(stats) {
    if (!currentUser || !userProfile) return;

    try {
        await updateDoc(doc(db, "players", currentUser.uid), stats);
        // Update local profile
        userProfile = { ...userProfile, ...stats };

    } catch (error) {

    }
}

/**
 * Get current user profile
 * @returns {Object|null} User profile or null if not logged in
 */
export function getUserProfile() {
    return userProfile;
}

/**
 * Check if user is already signed in from a previous session
 * @returns {boolean} True if user is already signed in
 */
export function isUserSignedIn() {
    return !!currentUser;
}

/**
 * Show Firebase authentication popup
 * @param {Function} onSuccess - Callback when auth succeeds
 */
export function showAuthPopup(onSuccess) {
    if (!isInitialized) {

        return;
    }

    // Check if user is already signed in
    if (currentUser) {

        if (onSuccess && typeof onSuccess === 'function') {
            onSuccess(currentUser);
        }
        return;
    }

    // Remove any existing auth container
    const existingContainer = document.querySelector('.auth-container');
    if (existingContainer) {
        document.body.removeChild(existingContainer);
    }

    // Create and display authentication dialog
    const authContainer = document.createElement('div');
    authContainer.className = 'auth-container';
    authContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    const authForm = document.createElement('div');
    authForm.className = 'auth-form';
    authForm.style.cssText = `
        background-color: #0f1626;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 0 30px rgba(0,100,255,0.3);
        width: 350px;
        max-width: 90%;
        border: 1px solid rgba(50, 130, 240, 0.3);
    `;

    authForm.innerHTML = `
        <div style="position: relative; margin-bottom: 25px;">
            <h2 style="text-align: center; color: #fff; font-size: 32px; margin-bottom: 5px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; text-shadow: 0 0 10px rgba(66, 133, 244, 0.7);">TideFall</h2>
            <div style="height: 3px; width: 60px; background: linear-gradient(to right, #4285f4, #34a853); margin: 0 auto 15px;"></div>
            <div style="background: linear-gradient(135deg, rgba(10, 37, 64, 0.9), rgba(32, 58, 96, 0.9)); border-radius: 8px; padding: 15px; border-left: 2px solid #4285f4; margin-top: 10px;">
                <p style="margin: 0; color: #e0e0e0; font-size: 15px; line-height: 1.5; font-weight: 400; text-align: center;">
                Build alliances, claim vast lands, and hunt for loot in dangerous realms.                </p>
            </div>
        </div>
        <div style="text-align: center; margin-bottom: 20px;">
            <button id="google-signin" style="
                background-color: #1a73e8;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 12px 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                cursor: pointer;
                font-family: 'Roboto', sans-serif;
                font-weight: 500;
                font-size: 14px;
                margin-bottom: 15px;
                transition: background-color 0.2s;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            ">
                <span style="margin-right: 10px;">
                    <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                    </svg>
                </span>
                Sign in with Google
            </button>
        </div>

        <!-- Add the OR divider -->
        <div style="text-align: center; margin-bottom: 15px; color: #757575;">OR</div>

        <!-- Add the Play Offline button -->
        <div style="text-align: center; margin-bottom: 20px;">
            <button id="offline-play" style="
                background-color: #a9a9a9;
                color: white;
                border: 1px solid #dadce0;
                border-radius: 4px;
                padding: 10px 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                cursor: pointer;
                font-family: 'Roboto', sans-serif;
                margin-bottom: 15px;
            ">
                Play Offline
            </button>
        </div>
        
        <div style="margin-bottom: 15px;">
            <input type="email" id="email" placeholder="Email" style="width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box;">
            <input type="password" id="password" placeholder="Password" style="width: 100%; padding: 8px; box-sizing: border-box;">
        </div>
        
        <div style="display: flex; gap: 10px;">
            <button id="signin-btn" style="flex: 1; padding: 10px; background-color: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">Sign In</button>
            <button id="signup-btn" style="flex: 1; padding: 10px; background-color: #2ecc71; color: white; border: none; border-radius: 4px; cursor: pointer;">Sign Up</button>
        </div>
        
        <div id="auth-error" style="color: red; margin-top: 10px; text-align: center;"></div>
    `;

    authContainer.appendChild(authForm);
    document.body.appendChild(authContainer);

    // Auth error display
    const showError = (message) => {
        document.getElementById('auth-error').textContent = message;
    };

    // Google Sign In
    document.getElementById('google-signin').addEventListener('click', async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            authSuccess(result.user);
        } catch (error) {
            showError(error.message);

        }
    });

    // Offline Play
    document.getElementById('offline-play').addEventListener('click', () => {
        // Close the auth popup
        document.body.removeChild(authContainer);
    });

    // Email/Password Sign In
    document.getElementById('signin-btn').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }

        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            authSuccess(result.user);
        } catch (error) {
            showError(error.message);

        }
    });

    // Email/Password Sign Up
    document.getElementById('signup-btn').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters');
            return;
        }

        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            authSuccess(result.user);
        } catch (error) {
            showError(error.message);

        }
    });

    // Success handler
    function authSuccess(user) {
        // Close the auth popup
        document.body.removeChild(authContainer);

        // Call the success callback if provided
        if (onSuccess && typeof onSuccess === 'function') {
            onSuccess(user);
        }
    }
}

/**
 * Sign out the current user
 */
export function signOutUser() {
    if (auth) signOut(auth);
}

/**
 * Get hex color from user profile or generate one
 * @returns {string} Hex color code
 */
export function getUserColor() {
    if (userProfile && userProfile.color) {
        return userProfile.color;
    }
    return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
}

/**
 * Get username from user profile or generate one
 * @returns {string} Username
 */
export function getUsername() {
    if (userProfile && userProfile.displayName) {
        return userProfile.displayName;
    }
    if (currentUser && currentUser.displayName) {
        return currentUser.displayName;
    }
    return `Sailor ${Math.floor(Math.random() * 1000)}`;
}

/**
 * Check if Firebase authentication is required
 * @returns {boolean} True if authentication is required
 */
export function isAuthRequired() {
    // Implement your logic to determine if auth is needed
    // For example, only require for multiplayer or specific features
    return true; // Or false, depending on your requirements
} 