/**
 * Message of the Day (MOTD) module
 * Displays important announcements and updates to players
 */
import { registerScreen } from './messages.js';

/**
 * Show Message of the Day screen
 * @param {Function} onClose - Callback for when the screen is closed
 */
export function showMessageOfDay(onClose) {


    // Check if already showing
    if (document.getElementById('motd-container')) {

        if (onClose) onClose();
        return;
    }

    // Mark as shown with a safety check
    try {
        localStorage.setItem('motd-has-shown', 'true');
    } catch (e) {

    }

    // Create container
    const motdContainer = document.createElement('div');
    motdContainer.id = 'motd-container';
    motdContainer.style.position = 'fixed';
    motdContainer.style.top = '0';
    motdContainer.style.left = '0';
    motdContainer.style.width = '100%';
    motdContainer.style.height = '100%';
    motdContainer.style.backgroundColor = 'rgba(0,0,0,0.85)';
    motdContainer.style.display = 'flex';
    motdContainer.style.justifyContent = 'center';
    motdContainer.style.alignItems = 'center';
    motdContainer.style.zIndex = '9999';
    document.body.appendChild(motdContainer);

    // Create card
    const card = document.createElement('div');
    card.style.backgroundColor = '#0f1626';
    card.style.padding = '30px';
    card.style.borderRadius = '10px';
    card.style.boxShadow = '0 0 30px rgba(50, 130, 240, 0.4)';
    card.style.width = '600px';
    card.style.maxWidth = '90%';
    card.style.maxHeight = '80vh';
    card.style.overflowY = 'auto';
    card.style.border = '1px solid rgba(50, 130, 240, 0.5)';
    card.style.position = 'relative';
    motdContainer.appendChild(card);

    // Create header
    const header = document.createElement('div');
    header.innerHTML = `
        <h2 style="text-align: center; color: #fff; font-size: 28px; margin-bottom: 20px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; text-shadow: 0 0 10px rgba(66, 133, 244, 0.7);">
            Message of the Day
        </h2>
        <div style="height: 3px; width: 60px; background: linear-gradient(to right, #4285f4, #34a853); margin: 0 auto 20px;"></div>
    `;
    card.appendChild(header);

    // Create content
    const content = document.createElement('div');
    content.style.color = '#e0e0e0';
    content.style.fontSize = '16px';
    content.style.lineHeight = '1.6';
    content.style.marginBottom = '25px';

    // Sample MOTD content
    content.innerHTML = `
    <div style="background: linear-gradient(135deg, rgba(10, 37, 64, 0.9), rgba(32, 58, 96, 0.9)); border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 3px solid #ff5500;">
        <h3 style="color: #ff5500; margin-top: 0; margin-bottom: 10px;">⚠️ Server Maintenance Notice</h3>
        <p>Our servers will be down during night hours as we work on the game.</p>
    </div>
    
    <div style="background: linear-gradient(135deg, rgba(10, 37, 64, 0.9), rgba(32, 58, 96, 0.9)); border-radius: 8px; padding: 20px; border-left: 3px solid #4285f4;">
        <h3 style="color: #4285f4; margin-top: 0; margin-bottom: 10px;">Welcome to TideFall - Naval Conquest</h3>
        <p>Set sail in a vast ocean world where you'll:</p>
        <ul style="padding-left: 20px; margin-bottom: 10px;">
            <li>Navigate your customizable vessel through treacherous waters</li>
            <li>Play alongside your friends in a shared persistent world</li>
            <li>Form or join clans to establish dominance over territories</li>
            <li>Explore mysterious cave systems with dangerous sea monsters lurking in the depths</li>
        </ul>
        <p>The waters await, Captain. Claim your territory and explore the mysterious depths with your crew!</p>
    </div>
`;
    card.appendChild(content);

    // Create buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.gap = '15px';
    card.appendChild(buttonContainer);

    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Set Sail';
    closeButton.style.padding = '12px 25px';
    closeButton.style.backgroundColor = '#4285f4';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '5px';
    closeButton.style.fontSize = '16px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontWeight = 'bold';
    closeButton.style.transition = 'background-color 0.2s';
    buttonContainer.appendChild(closeButton);

    // Close functionality
    closeButton.addEventListener('click', () => {
        // Remove from document
        if (document.body.contains(motdContainer)) {
            document.body.removeChild(motdContainer);
        }

        // Don't need the checkbox check anymore since we always mark as shown
        // Just call the onClose callback
        if (onClose && typeof onClose === 'function') {
            onClose();
        }
    });

    // Hover effect for button
    closeButton.addEventListener('mouseover', () => {
        closeButton.style.backgroundColor = '#5294ff';
    });
    closeButton.addEventListener('mouseout', () => {
        closeButton.style.backgroundColor = '#4285f4';
    });
}

/**
 * Check if MOTD should be shown today
 * @returns {boolean} True if MOTD should be shown
 */
export function shouldShowMessageOfDay() {
    try {
        // Check if MOTD has EVER been shown (not just today)
        const hasShownBefore = localStorage.getItem('motd-has-shown');

        // Return true only if it has never been shown before
        return hasShownBefore !== 'true';
    } catch (e) {
        // If localStorage is not available, default to showing MOTD

        return true;
    }
}

/**
 * Force show Message of the Day regardless of conditions
 * @param {Function} onClose - Callback for when the screen is closed
 */
export function forceShowMessageOfDay(onClose) {


    // Bypass the normal conditions that would prevent showing
    // For example, localStorage checks or already-shown-today flags

    // Show the MOTD
    showMessageOfDay(onClose);
}

// Register the MOTD screen with the message system
registerScreen({
    id: 'motd',
    order: 300, // Show after login and name/color screens
    shouldShow: shouldShowMessageOfDay,
    show: showMessageOfDay,
    once: true
}); 