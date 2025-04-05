import * as THREE from 'three';
import { camera, boat } from '../core/gameState.js';
import { touchControlsActive } from './touchControls.js';

// Configuration options
const ORBIT_SENSITIVITY = 0.01; // Rotation sensitivity
const MIN_POLAR_ANGLE = 0.1; // Minimum angle (don't go completely overhead)
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.1; // Maximum angle (don't go below horizon)
const MIN_DISTANCE = 5; // Minimum distance from boat
const MAX_DISTANCE = 350; // Increased maximum distance (was 250)
const DEFAULT_DISTANCE = 261; // Updated default distance to match initial offset

// Camera state
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Track camera lock state - NEW
let cameraLocked = false; // Default to unlocked to respect initial position

// Expose camera orbit position to window so it's accessible by touch controls
window.cameraOrbitPosition = {
    distance: DEFAULT_DISTANCE,
    phi: 0.74,
    theta: 2.3
};

// Track if we're currently in a zoom transition
let isZooming = false;
let zoomTarget = 120;
let zoomSpeed = 350.0; // How fast to zoom (units per second)

// Add these near the top with other state variables
let lastAbilityUsedTime = 0;
const UNLOCK_COOLDOWN = 2000; // 2 seconds cooldown in milliseconds

// NEW: Function to toggle camera lock
function toggleCameraLock(forceLock = null) {
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

// NEW: Function to show temporary on-screen message
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

// Expose event handlers to window for touchControls to disable them
function onMouseDown(event) {
    // Skip if touch controls are active
    if (touchControlsActive) return;

    // Only initiate drag if it's the left mouse button
    if (event.button === 0) {
        // Check if ability is active
        const abilityActive = window.abilityManager && window.abilityManager.activeAbility;

        // Get current time
        const currentTime = Date.now();

        // Check if we're within the cooldown period after using an ability
        const isWithinCooldown = (currentTime - lastAbilityUsedTime) < UNLOCK_COOLDOWN;

        // If ability is active or we're within cooldown period, don't unlock camera
        if (abilityActive || isWithinCooldown) {
            // Start drag without unlocking camera
            isDragging = true;
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
            return;
        }

        isDragging = true;
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };

        // Only unlock camera when no ability is active and cooldown period has passed
        if (cameraLocked) {
            toggleCameraLock(false);
        }
    }
}

function onMouseMove(event) {
    // Skip if touch controls are active
    if (touchControlsActive) return;

    if (!isDragging) return;

    // Calculate mouse movement from last position
    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;

    // Update previous position
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };

    // Calculate angular changes
    // Move camera in opposite direction of mouse movement
    const thetaChange = -deltaX * ORBIT_SENSITIVITY;
    const phiChange = -deltaY * ORBIT_SENSITIVITY;

    // Update orbit angles
    window.cameraOrbitPosition.theta += thetaChange;

    // Limit phi to keep camera from flipping or going underground
    const newPhi = window.cameraOrbitPosition.phi + phiChange;
    if (newPhi >= MIN_POLAR_ANGLE && newPhi <= MAX_POLAR_ANGLE) {
        window.cameraOrbitPosition.phi = newPhi;
    }
}

function onMouseUp(event) {
    // Skip if touch controls are active
    if (touchControlsActive) return;

    isDragging = false;
}

function onTouchStart(event) {
    // Skip if touch controls are active
    if (touchControlsActive) return;

    if (event.touches.length === 1) {
        // Check if ability is active
        const abilityActive = window.abilityManager && window.abilityManager.activeAbility;

        // Get current time
        const currentTime = Date.now();

        // Check if we're within the cooldown period after using an ability
        const isWithinCooldown = (currentTime - lastAbilityUsedTime) < UNLOCK_COOLDOWN;

        // If ability is active or we're within cooldown period, don't unlock camera
        if (abilityActive || isWithinCooldown) {
            // Start drag without unlocking camera
            isDragging = true;
            previousMousePosition = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            };
            event.preventDefault();
            return;
        }

        isDragging = true;
        previousMousePosition = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };

        // Only unlock camera when no ability is active and cooldown period has passed
        if (cameraLocked) {
            toggleCameraLock(false);
        }

        event.preventDefault();
    }
}

function onTouchMove(event) {
    // Skip if touch controls are active
    if (touchControlsActive) return;

    if (!isDragging || event.touches.length !== 1) return;

    const deltaX = event.touches[0].clientX - previousMousePosition.x;
    const deltaY = event.touches[0].clientY - previousMousePosition.y;

    previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
    };

    // Calculate angular changes with lower sensitivity for touch
    const thetaChange = -deltaX * ORBIT_SENSITIVITY * 0.8;
    const phiChange = -deltaY * ORBIT_SENSITIVITY * 0.8;

    // Update orbit angles with same constraints as mouse
    window.cameraOrbitPosition.theta += thetaChange;

    const newPhi = window.cameraOrbitPosition.phi + phiChange;
    if (newPhi >= MIN_POLAR_ANGLE && newPhi <= MAX_POLAR_ANGLE) {
        window.cameraOrbitPosition.phi = newPhi;
    }

    event.preventDefault();
}

function onTouchEnd(event) {
    // Skip if touch controls are active
    if (touchControlsActive) return;

    isDragging = false;
}

function onMouseWheel(event) {
    // Skip if touch controls are active
    if (touchControlsActive) return;

    event.preventDefault();

    const scrollAmount = Math.sign(event.deltaY) * 10; // Scroll speed

    // Apply zoom limits
    const newDistance = Math.max(MIN_DISTANCE,
        Math.min(MAX_DISTANCE,
            window.cameraOrbitPosition.distance + scrollAmount));

    // Start smooth zoom
    zoomTarget = newDistance;
    isZooming = true;
}

// NEW: Keyboard event handler for 'L' key
function onKeyDown(event) {
    // Check if L key was pressed
    if (event.key.toLowerCase() === 'l') {
        toggleCameraLock();
    }
}

// NEW: Helper function to get boat's Y rotation
function getBoatRotationY() {
    if (!boat) return 0;

    // Get the boat's forward direction vector (negative Z in boat's local space)
    const boatDirection = new THREE.Vector3(0, 0, -1);
    boatDirection.applyQuaternion(boat.quaternion);

    // Project onto XZ plane (ignore Y component) and normalize
    boatDirection.y = 0;
    boatDirection.normalize();

    // Calculate angle in XZ plane
    const angle = Math.atan2(boatDirection.x, boatDirection.z);

    return angle;
}

// Expose handlers to window for touch controls to disable them
window.cameraMouseDown = onMouseDown;
window.cameraMouseMove = onMouseMove;
window.cameraMouseUp = onMouseUp;
window.cameraTouchStart = onTouchStart;
window.cameraTouchMove = onTouchMove;
window.cameraTouchEnd = onTouchEnd;

// NEW: Expose camera lock functions to window
window.toggleCameraLock = toggleCameraLock;

// Initialize camera controls
export function initCameraControls() {
    // Add event listeners for mouse/touch controls
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    // Add event listener for zooming
    document.addEventListener('wheel', onMouseWheel, { passive: false });

    // NEW: Add keyboard listener for lock toggle
    document.addEventListener('keydown', onKeyDown);

    // Set initial camera position based on default orbit values
    updateCameraPosition();

    // Initialize with camera unlocked - lastBoatRotation will be set if user locks it
    // lastBoatRotation = getBoatRotationY(); // REMOVED
}

// Update camera position around the boat
export function updateCameraPosition() {
    // Check if fly mode is enabled
    if (window.flyModeEnabled) return;
    if (!boat) return;

    // Handle camera zoom update first
    handleCameraZoom();

    // If camera is locked, align directly with boat orientation
    if (cameraLocked) {
        // Get boat's forward direction (projected onto XZ plane)
        const shipForwardLocal = new THREE.Vector3(0, 0, -1);
        const shipForwardWorld = shipForwardLocal.clone().applyQuaternion(boat.quaternion);
        shipForwardWorld.y = 0;
        shipForwardWorld.normalize();

        // Calculate the desired theta angle behind the boat
        const targetTheta = Math.atan2(shipForwardWorld.x, shipForwardWorld.z) + Math.PI;

        let distance, phi, theta;

        if (!touchControlsActive) { // --- DESKTOP LOCKED VIEW ---
            distance = window.cameraOrbitPosition.distance;
            phi = 0.15; // Fixed high angle
            theta = targetTheta;
            window.cameraOrbitPosition.phi = phi;
            window.cameraOrbitPosition.theta = theta;
        } else { // --- MOBILE LOCKED VIEW ---
            distance = window.cameraOrbitPosition.distance;
            phi = window.cameraOrbitPosition.phi;
            theta = targetTheta;
            window.cameraOrbitPosition.theta = theta;
        }

        // Calculate position offset
        const offsetX = distance * Math.sin(phi) * Math.sin(theta);
        const offsetY = distance * Math.cos(phi);
        const offsetZ = distance * Math.sin(phi) * Math.cos(theta);
        const cameraPosition = boat.position.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));

        // Update camera position
        camera.position.copy(cameraPosition);

        // Look at the boat
        const targetOffset = new THREE.Vector3(0, 1, 0);
        const lookTarget = boat.position.clone().add(targetOffset);
        camera.lookAt(lookTarget);

    } else { // --- UNLOCKED CAMERA VIEW ---
        // Use the standard free-orbit calculation based on user-controlled orbit parameters
        const phi = window.cameraOrbitPosition.phi;
        const theta = window.cameraOrbitPosition.theta;
        const distance = window.cameraOrbitPosition.distance;

        // Calculate position based purely on orbit parameters relative to the boat
        // Assumes Y-up, phi from +Y axis, theta from +Z axis
        const x = boat.position.x + distance * Math.sin(phi) * Math.sin(theta);
        const y = boat.position.y + distance * Math.cos(phi);
        const z = boat.position.z + distance * Math.sin(phi) * Math.cos(theta);

        // Update camera position
        camera.position.set(x, y, z);

        // Look at the boat with the same offset as in locked mode
        const targetOffset = new THREE.Vector3(0, 1, 0);
        const lookTarget = boat.position.clone().add(targetOffset);
        camera.lookAt(lookTarget);
    }
}

// Function that handles camera zoom in a single frame
function handleCameraZoom() {
    if (!isZooming) return;

    const currentDistance = window.cameraOrbitPosition.distance;
    const distanceDifference = zoomTarget - currentDistance;

    // If we're close enough to target, snap to it and end zooming
    if (Math.abs(distanceDifference) < 0.1) {
        window.cameraOrbitPosition.distance = zoomTarget;
        isZooming = false;
        return;
    }
    // Get time since last frame - fallback to 1/60 if not available
    const deltaTime = window.lastFrameDeltaTime || (1 / 60);

    // Otherwise, move towards target at zoomSpeed
    const step = Math.sign(distanceDifference) * zoomSpeed * deltaTime;
    window.cameraOrbitPosition.distance += step;
}

// Reset camera to default position - updated with new values
export function resetCameraPosition() {
    // Reset to initial calculated offset values
    window.cameraOrbitPosition.distance = DEFAULT_DISTANCE;
    window.cameraOrbitPosition.phi = 0.74; // Default vertical angle
    window.cameraOrbitPosition.theta = 2.3;  // Default horizontal angle (match initial)

    // Update camera immediately
    updateCameraPosition();

    // Lock camera after reset
    toggleCameraLock(true);
}

// Function to smoothly zoom camera to a specific distance
export function zoomCameraTo(targetDistance) {
    zoomTarget = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, targetDistance));
    isZooming = true;
    return zoomTarget; // Return the clamped value for feedback
}

// Function to reset zoom to default distance
export function resetZoom() {
    return zoomCameraTo(DEFAULT_DISTANCE);
}

// Function to zoom out for fast movement
export function zoomOutForSpeed() {
    // Skip zoom out on mobile devices
    if (touchControlsActive) {
        return;
    }
    return zoomCameraTo(120); // Zoom out to see more when moving fast
}

// Update function to handle smooth zooming - now for external calling
export function updateCameraZoom(deltaTime) {
    if (!isZooming) return false;

    handleCameraZoom();

    return isZooming; // Return whether we're still zooming
}

// Create a function that can be called when an ability is used
export function notifyAbilityUsed() {
    lastAbilityUsedTime = Date.now();
}

// Make this function available globally so ability manager can call it
window.notifyCameraAbilityUsed = notifyAbilityUsed;