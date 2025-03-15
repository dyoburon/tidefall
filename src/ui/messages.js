/**
 * Centralized message and screen management system
 * Handles sequencing of various UI screens (login, settings, MOTD, etc.)
 */

// Array to store registered screens in their display order
const registeredScreens = [];

// Track which screens have been shown in the current session
const shownScreens = new Set();

// Flag to indicate if a screen sequence is currently in progress
let isProcessingSequence = false;

/**
 * Register a new screen in the message system
 * 
 * @param {Object} screen - Screen configuration object
 * @param {string} screen.id - Unique identifier for the screen
 * @param {Function} screen.shouldShow - Function that returns true if screen should be shown
 * @param {Function} screen.show - Function to display the screen, should accept an onComplete callback
 * @param {number} screen.order - Order in which the screen should appear (lower numbers first)
 * @param {boolean} screen.required - If true, this screen must be shown regardless of conditions
 * @param {boolean} screen.once - If true, only show once per session
 */
export function registerScreen(screen) {
    if (!screen.id || typeof screen.show !== 'function') {

        return;
    }

    // Set defaults for optional properties
    const completeScreen = {
        shouldShow: () => true,
        order: 100,
        required: false,
        once: true,
        ...screen
    };

    // Add to registered screens
    registeredScreens.push(completeScreen);

    // Sort screens by order
    registeredScreens.sort((a, b) => a.order - b.order);


}

/**
 * Start the screen sequence, showing each applicable screen in order
 * 
 * @param {Function} onComplete - Callback to execute when all screens are shown
 * @param {boolean} forceAll - If true, shows all screens regardless of conditions
 */
export function startScreenSequence(onComplete = () => { }, forceAll = false) {
    if (isProcessingSequence) {

        return;
    }


    isProcessingSequence = true;

    // Process screens in order
    processNextScreen(0, onComplete, forceAll);
}

/**
 * Process the next screen in the sequence
 * 
 * @param {number} index - Current index in the registered screens array
 * @param {Function} onComplete - Callback for when all screens are processed
 * @param {boolean} forceAll - If true, shows all screens regardless of conditions
 */
function processNextScreen(index, onComplete, forceAll) {
    // If we've processed all screens, we're done
    if (index >= registeredScreens.length) {

        isProcessingSequence = false;
        onComplete();
        return;
    }

    const screen = registeredScreens[index];

    // Check if screen should be shown
    const shouldShow = forceAll || screen.required ||
        (screen.shouldShow() && (!screen.once || !shownScreens.has(screen.id)));

    if (shouldShow) {


        // Mark as shown
        shownScreens.add(screen.id);

        // Show the screen, passing completion callback to move to next screen
        screen.show(() => {

            // Process next screen
            processNextScreen(index + 1, onComplete, forceAll);
        });
    } else {

        // Skip to next screen
        processNextScreen(index + 1, onComplete, forceAll);
    }
}

/**
 * Reset the system state - allows a new sequence to start
 */
export function resetScreenSequence() {
    isProcessingSequence = false;
}

/**
 * Force show a specific screen by ID
 * 
 * @param {string} screenId - ID of the screen to show
 * @param {Function} onComplete - Callback for when screen is closed
 */
export function showScreen(screenId, onComplete = () => { }) {
    const screen = registeredScreens.find(s => s.id === screenId);

    if (screen) {

        screen.show(onComplete);
    } else {

        onComplete();
    }
}

/**
 * Get all registered screen IDs
 * @returns {string[]} Array of screen IDs
 */
export function getRegisteredScreenIds() {
    return registeredScreens.map(screen => screen.id);
}

// Expose some functions to the global scope for debugging
window.messageSystem = {
    showScreen,
    startScreenSequence: () => startScreenSequence(() => { }, true),
    getRegisteredScreenIds
};



// COMMENT OUT the MOTD screen registration in messages.js

/*
// Original registration code:
registerScreen({
    id: 'motd',
    order: 300,
    shouldShow: shouldShowMessageOfDay,
    show: showMessageOfDay,
    once: true
});
*/

// Add debug info


registerScreen({
    id: 'my-new-screen',
    order: 250, // Position between login (200) and MOTD (300)
    shouldShow: () => true, // Logic to determine if screen should show
    show: (onComplete) => {
        // Display your screen
        // Call onComplete() when done
    },
    once: true // Only show once per session
});

// Show all registered screens
window.messageSystem.getRegisteredScreenIds();

// Force show a specific screen
window.messageSystem.showScreen('motd');

// Start the entire sequence
window.messageSystem.startScreenSequence(); 