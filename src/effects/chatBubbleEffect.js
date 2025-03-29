import * as THREE from 'three';

// Map to store active chat bubbles, keyed by the target object's UUID
const activeBubbles = new Map();
const BUBBLE_DURATION = 5000; // 5 seconds

// Simple shared material for all chat bubbles
let bubbleMaterial = null;

/**
 * Initialize the chat bubble system. Call this once during game setup.
 * @param {THREE.Scene} scene - The main scene where bubbles will be added
 */
export function initChatBubbleSystem(scene) {
    // Create a simple material if not already created
    if (!bubbleMaterial) {
        bubbleMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
    }
}

/**
 * Creates and displays a chat bubble above a target 3D object.
 * @param {THREE.Object3D} targetObject - The boat or object above which the bubble should appear.
 * @param {string} message - The text content of the chat bubble.
 * @param {THREE.Scene} scene - The scene to add the bubble to.
 */
export function showChatBubble(targetObject, message, scene) {
    if (!targetObject || !message || !scene) {
        console.error("showChatBubble requires targetObject, message, and scene.");
        return;
    }

    // Remove existing bubble for this target, if any
    removeChatBubble(targetObject);

    // Initialize material if needed
    if (!bubbleMaterial) {
        bubbleMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
    }

    // Create a simple box for the chat bubble
    const messageLength = Math.min(message.length, 100);
    const width = Math.max(1, messageLength * 0.05);
    const geometry = new THREE.BoxGeometry(width, 0.5, 0.2);
    const bubble = new THREE.Mesh(geometry, bubbleMaterial);

    // Position the bubble above the target object
    bubble.position.copy(targetObject.position);
    bubble.position.y += 2; // Lift above the boat

    // Add to scene
    scene.add(bubble);

    // Create a simple text label with message (optional - remove if you want just a box)
    console.log(`Chat message: ${message}`);

    // Set up automatic removal after duration
    const removeTimeout = setTimeout(() => {
        fadeOutAndRemove(targetObject.uuid);
    }, BUBBLE_DURATION);

    // Store bubble data
    const bubbleData = {
        mesh: bubble,
        target: targetObject,
        scene: scene,
        removeTimeout: removeTimeout
    };

    activeBubbles.set(targetObject.uuid, bubbleData);
}

/**
 * Updates the positions of all active chat bubbles to follow their targets.
 * Should be called within the game's animation loop.
 */
export function updateChatBubblePositions() {
    activeBubbles.forEach((bubbleData) => {
        if (bubbleData.mesh && bubbleData.target) {
            // Update position to follow the target
            bubbleData.mesh.position.copy(bubbleData.target.position);
            bubbleData.mesh.position.y += 2; // Keep it above the boat
        }
    });
}

/**
 * Removes a chat bubble associated with a target object immediately.
 * @param {THREE.Object3D} targetObject - The object whose bubble should be removed.
 */
export function removeChatBubble(targetObject) {
    if (!targetObject) return;
    const uuid = targetObject.uuid;
    if (activeBubbles.has(uuid)) {
        const bubbleData = activeBubbles.get(uuid);
        clearTimeout(bubbleData.removeTimeout); // Clear the auto-remove timer

        // Remove mesh from scene
        if (bubbleData.scene && bubbleData.mesh) {
            bubbleData.scene.remove(bubbleData.mesh);
            // Dispose of geometry
            if (bubbleData.mesh.geometry) {
                bubbleData.mesh.geometry.dispose();
            }
        }

        activeBubbles.delete(uuid);
    }
}

/**
 * Shows a chat bubble above the local player's ship
 * @param {string} message - The message to display
 * @param {THREE.Object3D} playerBoat - The player's boat object
 * @param {THREE.Scene} scene - The main scene
 */
export function showLocalChatBubble(message, playerBoat, scene) {
    if (!playerBoat || !message || !scene) {
        console.error("showLocalChatBubble requires message, playerBoat, and scene.");
        return;
    }

    // Use the standard function to show the bubble
    showChatBubble(playerBoat, message, scene);
}

/**
 * Fades out and then removes a chat bubble.
 * @param {string} uuid - The UUID of the target object whose bubble should be removed.
 */
function fadeOutAndRemove(uuid) {
    if (activeBubbles.has(uuid)) {
        const bubbleData = activeBubbles.get(uuid);

        // Fade out by animating opacity
        if (bubbleData.mesh && bubbleData.mesh.material) {
            // Animate opacity over 0.5 seconds
            const startTime = Date.now();
            const duration = 500; // 500ms fade

            const fadeInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                if (bubbleData.mesh && bubbleData.mesh.material) {
                    bubbleData.mesh.material.opacity = 0.8 * (1 - progress);
                }

                if (progress >= 1) {
                    clearInterval(fadeInterval);
                    // Remove after fade completes
                    if (activeBubbles.has(uuid)) {
                        const data = activeBubbles.get(uuid);
                        if (data.scene && data.mesh) {
                            data.scene.remove(data.mesh);
                            if (data.mesh.geometry) {
                                data.mesh.geometry.dispose();
                            }
                        }
                        activeBubbles.delete(uuid);
                    }
                }
            }, 16); // ~60fps
        }
    }
}