import * as THREE from 'three';
import { camera, boat } from '../core/gameState.js';
import { touchControlsActive } from './touchControls.js';

// Configuration options
const DEFAULT_DISTANCE = 261;
const DEFAULT_PHI = 0.74; // Vertical angle
const DEFAULT_THETA = 1.7; // Horizontal angle

// MOBA camera state
let cameraLocked = true; // Default to locked

// Expose camera orbit position to window so it's accessible by touch controls
window.cameraOrbitPosition = {
    distance: DEFAULT_DISTANCE,
    phi: DEFAULT_PHI,
    theta: DEFAULT_THETA
};

/**
 * Initialize MOBA-style camera controls
 */
export function initMOBACamera() {
    // Set initial camera position
    updateCameraPosition();

    // No event listeners needed as we're locking the camera

    // Expose camera lock function to window
    window.toggleCameraLock = toggleCameraLock;
    window.updateMOBACamera = updateCameraPosition;

    return cameraLocked;
}

/**
 * Toggle camera lock state
 * @param {boolean} forceLock - Force a specific lock state
 * @returns {boolean} - New lock state
 */
export function toggleCameraLock(forceLock = null) {
    if (forceLock !== null) {
        cameraLocked = forceLock;
    } else {
        cameraLocked = !cameraLocked;
    }

    // Display feedback message
    const message = cameraLocked ? "Camera locked to ship" : "Camera unlocked";
    showCameraMessage(message);

    return cameraLocked;
}

/**
 * Show a temporary message on screen
 * @param {string} text - Message to display
 */
function showCameraMessage(text) {
    let messageElement = document.getElementById('camera-message');

    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.id = 'camera-message';
        messageElement.style.position = 'absolute';
        messageElement.style.top = '20%';
        messageElement.style.left = '50%';
        messageElement.style.transform = 'translate(-50%, -50%)';
        messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        messageElement.style.color = 'white';
        messageElement.style.padding = '10px 20px';
        messageElement.style.borderRadius = '5px';
        messageElement.style.fontFamily = 'Arial, sans-serif';
        messageElement.style.fontSize = '18px';
        messageElement.style.transition = 'opacity 0.5s';
        messageElement.style.zIndex = '1000';
        document.body.appendChild(messageElement);
    }

    // Set message and make visible
    messageElement.textContent = text;
    messageElement.style.opacity = '1';

    // Fade out after 2 seconds
    setTimeout(() => {
        messageElement.style.opacity = '0';
    }, 2000);
}

/**
 * Update camera position (MOBA style)
 */
export function updateCameraPosition() {
    if (!boat) return;

    // Get current orbit parameters
    const distance = window.cameraOrbitPosition.distance;
    const phi = window.cameraOrbitPosition.phi;

    // Fixed camera angle in world space (won't rotate with the boat)
    // Initial value should put camera behind the boat
    const fixedTheta = Math.PI; // Camera directly behind the boat in world space

    // Use a negative offset to move the camera to the left
    const rightOffset = -Math.PI / 12; // -15 degrees (to the left)
    const theta = fixedTheta + rightOffset;

    // Update the orbit position for other systems
    window.cameraOrbitPosition.theta = theta;

    // Calculate position offset in world coordinates
    const offsetX = distance * Math.sin(phi) * Math.sin(theta);
    const offsetY = distance * Math.cos(phi);
    const offsetZ = distance * Math.sin(phi) * Math.cos(theta);

    // Update camera position based on boat position
    const cameraPosition = boat.position.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));
    camera.position.copy(cameraPosition);

    // Look at the boat with a slight vertical offset
    const targetOffset = new THREE.Vector3(0, 1, 0);
    const lookTarget = boat.position.clone().add(targetOffset);
    camera.lookAt(lookTarget);
}

/**
 * Set the initial camera position based on boat spawn
 * @param {THREE.Vector3} boatPosition - The boat's spawn position
 */
export function setInitialCameraPosition(boatPosition) {
    const initialDistance = DEFAULT_DISTANCE;
    const initialPhi = DEFAULT_PHI;
    const initialTheta = DEFAULT_THETA;

    const initialCamX = boatPosition.x + initialDistance * Math.sin(initialPhi) * Math.sin(initialTheta);
    const initialCamY = boatPosition.y + initialDistance * Math.cos(initialPhi);
    const initialCamZ = boatPosition.z + initialDistance * Math.sin(initialPhi) * Math.cos(initialTheta);

    camera.position.set(initialCamX, initialCamY, initialCamZ);
    camera.lookAt(boatPosition);

    // Update orbit position
    window.cameraOrbitPosition.distance = initialDistance;
    window.cameraOrbitPosition.phi = initialPhi;
    window.cameraOrbitPosition.theta = initialTheta;
}

/**
 * Function to notify the camera system that an ability was used
 */
export function notifyAbilityUsed() {
    // Nothing needed for MOBA style, but keep for API compatibility
}

// Make this function available globally so ability manager can call it
window.notifyCameraAbilityUsed = notifyAbilityUsed; 