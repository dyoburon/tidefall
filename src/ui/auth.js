/**
 * Firebase Authentication UI module
 * Provides user authentication functionality
 */
import { registerScreen } from './messages.js';
import * as Firebase from '../core/firebase.js';

// Track authentication status
let isAuthenticated = false;
let currentUser = null;

/**
 * Show Firebase authentication popup
 * @param {Function} onComplete - Function to call when auth is complete
 */
export function showAuthPopup(onComplete) {


    Firebase.showAuthPopup((user) => {
        if (user) {

            isAuthenticated = true;
            currentUser = user;
        } else {

        }

        if (onComplete && typeof onComplete === 'function') {
            onComplete(user);
        }
    });
}

/**
 * Check if authentication screen should be shown
 * @returns {boolean} True if auth screen should be shown
 */
export function shouldShowAuthScreen() {
    // Implement whatever logic determines if auth is needed
    // For example, only require auth for multiplayer
    return !isAuthenticated && Firebase.isAuthRequired();
}

/**
 * Get current authenticated user
 * @returns {Object|null} Firebase user object or null if not authenticated
 */
export function getCurrentUser() {
    return currentUser;
}

// Register the auth screen with the message system
registerScreen({
    id: 'firebase-auth',
    order: 100, // Show first
    shouldShow: shouldShowAuthScreen,
    show: showAuthPopup,
    required: false // Only required if auth is needed
}); 