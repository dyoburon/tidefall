import * as THREE from 'three';
import { camera, boat } from '../core/gameState.js';

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
let cameraOrbitPosition = {
    distance: DEFAULT_DISTANCE,
    phi: Math.PI / 4, // Polar angle (up/down)
    theta: Math.PI    // Azimuthal angle (left/right) - initialized to PI to start behind boat
};

// Track if we're currently in a zoom transition
let isZooming = false;
let zoomTarget = 120;
let zoomSpeed = 350.0; // How fast to zoom (units per second)

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
    const x = boat.position.x + cameraOrbitPosition.distance * Math.sin(cameraOrbitPosition.phi) * Math.cos(cameraOrbitPosition.theta);
    const y = boat.position.y + cameraOrbitPosition.distance * Math.cos(cameraOrbitPosition.phi);
    const z = boat.position.z + cameraOrbitPosition.distance * Math.sin(cameraOrbitPosition.phi) * Math.sin(cameraOrbitPosition.theta);

    // Update camera position
    camera.position.set(x, y, z);

    // Look at the boat
    camera.lookAt(boat.position);
}

// Function that handles camera zoom in a single frame
function handleCameraZoom() {
    if (!isZooming) return;

    const currentDistance = cameraOrbitPosition.distance;
    const distanceDifference = zoomTarget - currentDistance;

    // If we're close enough to target, snap to it and end zooming
    if (Math.abs(distanceDifference) < 0.1) {
        cameraOrbitPosition.distance = zoomTarget;
        isZooming = false;
        return;
    }

    // Get time since last frame - fallback to 1/60 if not available
    const deltaTime = window.lastFrameDeltaTime || (1 / 60);

    // Otherwise, move towards target at zoomSpeed
    const step = Math.sign(distanceDifference) * zoomSpeed * deltaTime;
    cameraOrbitPosition.distance += step;
}

// Event handlers
function onMouseDown(event) {
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
    if (!isDragging) return;

    // Calculate mouse movement delta
    const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
    };

    // Update camera angles based on mouse movement
    cameraOrbitPosition.theta -= deltaMove.x * ORBIT_SENSITIVITY;
    cameraOrbitPosition.phi += deltaMove.y * ORBIT_SENSITIVITY;

    // Clamp phi to avoid going below horizon or above boat
    cameraOrbitPosition.phi = Math.max(MIN_POLAR_ANGLE, Math.min(MAX_POLAR_ANGLE, cameraOrbitPosition.phi));

    // Store current position for next frame
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };

    event.preventDefault();
}

function onMouseUp(event) {
    if (event.button === 0) {
        isDragging = false;
        event.preventDefault();
    }
}

function onTouchStart(event) {
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
    if (!isDragging || event.touches.length !== 1) return;

    const deltaMove = {
        x: event.touches[0].clientX - previousMousePosition.x,
        y: event.touches[0].clientY - previousMousePosition.y
    };

    cameraOrbitPosition.theta -= deltaMove.x * ORBIT_SENSITIVITY;
    cameraOrbitPosition.phi += deltaMove.y * ORBIT_SENSITIVITY;
    cameraOrbitPosition.phi = Math.max(MIN_POLAR_ANGLE, Math.min(MAX_POLAR_ANGLE, cameraOrbitPosition.phi));

    previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
    };

    event.preventDefault();
}

function onTouchEnd(event) {
    isDragging = false;
}

function onMouseWheel(event) {
    // Check if the event target is inside the terminal or any other UI element
    const isOverUI = event.target.closest('#game-terminal') ||
        (window.terminalInputActive === true);

    // Only adjust camera if not over UI
    if (!isOverUI) {
        // Adjust camera distance based on wheel movement
        const zoomSpeed = 0.5;
        cameraOrbitPosition.distance += Math.sign(event.deltaY) * zoomSpeed;

        // Clamp distance to min/max values
        cameraOrbitPosition.distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, cameraOrbitPosition.distance));

        // Only prevent default when we're actually using the event for camera control
        event.preventDefault();
    }
}

// Reset camera to default position - updated to be behind boat
export function resetCameraPosition() {
    cameraOrbitPosition = {
        distance: DEFAULT_DISTANCE,
        phi: Math.PI / 4,
        theta: Math.PI // PI radians = 180 degrees = behind boat
    };
    updateCameraPosition();
}

// Function to smoothly zoom camera to a specific distance
export function zoomCameraTo(targetDistance) {
    zoomTarget = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, targetDistance));
    isZooming = true;
    console.log(`Camera zooming to: ${zoomTarget}`);
}

// Function to reset zoom to default distance
export function resetZoom() {
    zoomCameraTo(DEFAULT_DISTANCE);
}

// Function to zoom out for fast movement
export function zoomOutForSpeed() {
    // Zoom out to 80% of max distance for dramatic effect
    zoomCameraTo(MAX_DISTANCE * 0.8);
}

// Update function to handle smooth zooming - now for external calling
export function updateCameraZoom(deltaTime) {
    // Store the delta time for use in handleCameraZoom
    window.lastFrameDeltaTime = deltaTime;

    // No longer needs to do anything here since handleCameraZoom is called inside updateCameraPosition
    return isZooming; // Just return if we're currently zooming
} 