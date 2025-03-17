import * as THREE from 'three';
import { camera, boat } from '../core/gameState.js';
import { touchControlsActive } from './touchControls.js';

// Configuration options
const ORBIT_SENSITIVITY = 0.01; // Rotation sensitivity
const MIN_POLAR_ANGLE = 0.1; // Minimum angle (don't go completely overhead)
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.1; // Maximum angle (don't go below horizon)
const MIN_DISTANCE = 5; // Minimum distance from boat
const MAX_DISTANCE = 250; // Maximum distance from boat
const DEFAULT_DISTANCE = 50; // Increased default distance (was 15)

// Camera state
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Expose camera orbit position to window so it's accessible by touch controls
window.cameraOrbitPosition = {
    distance: DEFAULT_DISTANCE,
    phi: Math.PI / 4, // Polar angle (up/down)
    theta: Math.PI    // Azimuthal angle (left/right) - initialized to PI to start behind boat
};

// Track if we're currently in a zoom transition
let isZooming = false;
let zoomTarget = 120;
let zoomSpeed = 350.0; // How fast to zoom (units per second)

// Expose event handlers to window for touchControls to disable them
function onMouseDown(event) {
    // Skip if touch controls are active
    if (touchControlsActive) return;

    // Only initiate drag if it's the left mouse button
    if (event.button === 0) {
        isDragging = true;
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
        //event.preventDefault();
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

    //event.preventDefault();
}

function onMouseUp(event) {
    // Skip if touch controls are active
    if (touchControlsActive) return;

    isDragging = false;
    //event.preventDefault();
}

function onTouchStart(event) {
    // Skip if touch controls are active
    if (touchControlsActive) return;

    if (event.touches.length === 1) {
        isDragging = true;
        previousMousePosition = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };
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
    //event.preventDefault();
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

// Expose handlers to window for touch controls to disable them
window.cameraMouseDown = onMouseDown;
window.cameraMouseMove = onMouseMove;
window.cameraMouseUp = onMouseUp;
window.cameraTouchStart = onTouchStart;
window.cameraTouchMove = onTouchMove;
window.cameraTouchEnd = onTouchEnd;

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

    // Set initial camera position behind the boat
    updateCameraPosition();

    console.log("✅ Camera orbit controls initialized");
}

// Update camera position around the boat
export function updateCameraPosition() {
    // Check if fly mode is enabled (from command system)
    if (window.flyModeEnabled) {
        return; // Skip camera update when in fly mode
    }

    if (!boat) return;

    // Handle camera zoom update first
    handleCameraZoom();

    // Calculate camera position in spherical coordinates
    const x = boat.position.x + window.cameraOrbitPosition.distance * Math.sin(window.cameraOrbitPosition.phi) * Math.cos(window.cameraOrbitPosition.theta);
    const y = boat.position.y + window.cameraOrbitPosition.distance * Math.cos(window.cameraOrbitPosition.phi);
    const z = boat.position.z + window.cameraOrbitPosition.distance * Math.sin(window.cameraOrbitPosition.phi) * Math.sin(window.cameraOrbitPosition.theta);

    // Update camera position
    camera.position.set(x, y, z);

    // Look at the boat
    camera.lookAt(boat.position);
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

// Reset camera to default position - updated to be behind boat
export function resetCameraPosition() {
    // Reset to initial values
    window.cameraOrbitPosition.distance = DEFAULT_DISTANCE;
    window.cameraOrbitPosition.phi = Math.PI / 4;
    window.cameraOrbitPosition.theta = Math.PI; // Behind boat

    // Update camera immediately
    updateCameraPosition();

    console.log("Camera position reset");
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
    return zoomCameraTo(120); // Zoom out to see more when moving fast
}

// Update function to handle smooth zooming - now for external calling
export function updateCameraZoom(deltaTime) {
    if (!isZooming) return false;

    handleCameraZoom();

    return isZooming; // Return whether we're still zooming
}