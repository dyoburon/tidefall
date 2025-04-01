import nipplejs from 'nipplejs';
import { keys, boat, boatVelocity } from '../core/gameState.js';
import * as THREE from 'three';

// Get access to camera controls
let cameraOrbitPosition;

// Store joystick instances
let movementJoystick = null;
let cameraJoystick = null;

// Flag to indicate if touch controls are active
export let touchControlsActive = false;

// Configuration for movement joystick (controls both movement and rotation)
const movementJoystickConfig = {
    zone: document.body,
    mode: 'static',
    position: { left: '30%', bottom: '25%' }, // Left side, 25% from bottom
    color: 'rgba(255, 255, 255, 0.7)',
    size: 60,
    fadeTime: 0,
    restOpacity: 0.5,
    catchDistance: 100,
    multitouch: true,
    identifier: 'movement' // Add identifier for movement joystick
};

// Configuration for camera joystick
const cameraJoystickConfig = {
    zone: document.body,
    mode: 'static',
    position: { left: '70%', bottom: '25%' }, // Right side, 25% from bottom
    color: 'rgba(255, 255, 255, 0.7)',
    size: 60,
    fadeTime: 0,
    restOpacity: 0.5,
    catchDistance: 100,
    multitouch: true,
    identifier: 'camera' // Add identifier for camera joystick
};

// Initialize touch controls
export function initTouchControls() {
    // Only initialize on touch devices
    if (!('ontouchstart' in window)) {
        console.log('Touch not supported, skipping joystick initialization');
        return false;
    }

    // Get camera orbit position from the camera controls system
    try {
        // Access the camera orbit position from the window object
        if (window.cameraOrbitPosition) {
            cameraOrbitPosition = window.cameraOrbitPosition;
        } else {
            console.log('Camera orbit position not found on window object');
            // Create a default if we can't access it
            cameraOrbitPosition = {
                distance: 50,
                phi: Math.PI / 4,
                theta: Math.PI
            };
            window.cameraOrbitPosition = cameraOrbitPosition;
        }
    } catch (error) {
        console.log('Error accessing camera orbit position:', error);
    }

    // Create movement joystick container
    const movementContainer = createJoystickContainer('movementJoystickContainer', '30%', '25%');
    document.body.appendChild(movementContainer);

    // Create camera joystick container
    const cameraContainer = createJoystickContainer('cameraJoystickContainer', '70%', '25%');
    document.body.appendChild(cameraContainer);

    // Update joystick configs to use the containers
    const movementConfig = {
        ...movementJoystickConfig,
        zone: movementContainer
    };

    const cameraConfig = {
        ...cameraJoystickConfig,
        zone: cameraContainer
    };

    // Create joysticks
    movementJoystick = nipplejs.create(movementConfig);
    cameraJoystick = nipplejs.create(cameraConfig);

    // Add visual labels to help users
    addJoystickLabel(movementContainer, 'MOVE');
    addJoystickLabel(cameraContainer, 'CAMERA');

    // Set up event listeners
    movementJoystick.on('move', handleMovementJoystickMove);
    movementJoystick.on('end', handleMovementJoystickEnd);

    cameraJoystick.on('move', handleCameraJoystickMove);
    cameraJoystick.on('end', handleCameraJoystickEnd);

    // Add touch event handler for abilities
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    // Disable regular camera controls when touch controls are active
    disableRegularCameraControls();

    touchControlsActive = true;
    console.log('Touch joysticks initialized');
    return true;
}

// Disable regular camera controls to avoid conflicts
function disableRegularCameraControls() {
    // Remove the regular mouse/touch event listeners from camera controls
    document.removeEventListener('mousedown', window.cameraMouseDown);
    document.removeEventListener('mousemove', window.cameraMouseMove);
    document.removeEventListener('mouseup', window.cameraMouseUp);
    document.removeEventListener('touchstart', window.cameraTouchStart);
    document.removeEventListener('touchmove', window.cameraTouchMove);
    document.removeEventListener('touchend', window.cameraTouchEnd);

    console.log('Regular camera controls disabled for touch mode');
}

// Create a joystick container with the specified position
function createJoystickContainer(id, leftPos, bottomPos) {
    const container = document.createElement('div');
    container.id = id;
    container.style.position = 'absolute';
    container.style.left = leftPos;
    container.style.bottom = bottomPos;
    container.style.transform = 'translateX(-50%)'; // Center horizontally
    container.style.width = '75px';
    container.style.height = '75px';
    container.style.zIndex = '1000';
    container.style.pointerEvents = 'auto'; // Restore pointer events
    container.style.touchAction = 'none'; // Prevent scrolling while using joystick
    return container;
}

// Add a label to a joystick container
function addJoystickLabel(container, text) {
    const label = document.createElement('div');
    label.textContent = text;
    label.style.position = 'absolute';
    label.style.top = '-30px';
    label.style.left = '50%';
    label.style.transform = 'translateX(-50%)';
    label.style.color = 'white';
    label.style.fontFamily = 'Arial, sans-serif';
    label.style.fontSize = '16px';
    label.style.fontWeight = 'bold';
    label.style.textShadow = '1px 1px 3px rgba(0,0,0,0.8)';
    container.appendChild(label);
}

// Handle movement joystick (controls both forward/backward AND rotation)
function handleMovementJoystickMove(event, data) {
    // Get direction vector and force
    const angle = data.angle.radian;
    const force = Math.min(1, data.force);

    // Reset all keys first
    keys.forward = false;
    keys.backward = false;
    keys.left = false;
    keys.right = false;

    // Calculate direction components
    // Fix: Correctly map joystick angle to forward/backward motion
    const forward = Math.cos(angle - Math.PI / 2); // North is at PI/2 in joystick coordinates
    const sideways = Math.sin(angle - Math.PI / 2); // East is at 0 in joystick coordinates

    // Only move forward/backward if joystick is pushed significantly in that direction
    if (forward > 0.5) { // More strict threshold for forward
        keys.forward = true;
    } else if (forward < -0.5) { // More strict threshold for backward
        keys.backward = true;
    }

    // Only turn if joystick is pushed significantly sideways AND force is significant
    // Fix: Higher threshold for rotation to reduce sensitivity
    if (Math.abs(sideways) > 0.6 && force > 0.4) { // Much higher threshold for rotation
        if (sideways < 0) {
            keys.right = true; // Reversed: left joystick movement turns right
        } else {
            keys.left = true;  // Reversed: right joystick movement turns left
        }
    }
}

// Handle camera joystick movement
function handleCameraJoystickMove(event, data) {
    if (!window.cameraOrbitPosition) {
        // Use the local reference if the global one isn't available
        window.cameraOrbitPosition = cameraOrbitPosition;
    }

    // Get direction and force
    const angle = data.angle.radian;
    const force = Math.min(1, data.force) * 0.02; // Reduced sensitivity for smoother camera movement

    // Calculate horizontal and vertical components
    const xMove = Math.cos(angle) * force;
    const yMove = Math.sin(angle) * force;

    // Update camera orbit position
    // Horizontal movement controls theta (left/right orbit)
    if (window.cameraOrbitPosition) {
        window.cameraOrbitPosition.theta -= xMove;

        // Vertical movement controls phi (up/down orbit)
        // Limit phi to avoid camera flipping
        const newPhi = window.cameraOrbitPosition.phi + yMove;
        const MIN_POLAR_ANGLE = 0.1;
        const MAX_POLAR_ANGLE = Math.PI / 2 - 0.1;

        if (newPhi >= MIN_POLAR_ANGLE && newPhi <= MAX_POLAR_ANGLE) {
            window.cameraOrbitPosition.phi = newPhi;
        }
    }
}

// Reset movement keys when joystick is released
function handleMovementJoystickEnd() {
    keys.forward = false;
    keys.backward = false;
    keys.left = false;
    keys.right = false;
}

// Handle camera joystick release
function handleCameraJoystickEnd() {
    // Nothing to do, camera stays where it was left
}

// Track touch points for abilities
let abilityTouchId = null;

// Handle touch start for abilities
function handleTouchStart(event) {
    // Don't prevent default here to allow other touch interactions

    // Check if this touch is on an ability button
    const touch = event.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    if (element && element.closest('#abilities-bar')) {
        // This is a touch on the abilities bar
        abilityTouchId = touch.identifier;

        // Don't prevent default to allow the ability click to go through
        return;
    }
}

// Handle touch move for abilities
function handleTouchMove(event) {
    if (abilityTouchId !== null) {
        // Find our tracked touch
        for (let i = 0; i < event.touches.length; i++) {
            if (event.touches[i].identifier === abilityTouchId) {
                // Prevent default only for ability touches to avoid interfering with joysticks
                event.preventDefault();
                break;
            }
        }
    }
}

// Handle touch end for abilities
function handleTouchEnd(event) {
    // Check if our tracked ability touch has ended
    for (let i = 0; i < event.changedTouches.length; i++) {
        if (event.changedTouches[i].identifier === abilityTouchId) {
            abilityTouchId = null;
            break;
        }
    }
}

// Clean up touch controls
export function destroyTouchControls() {
    if (movementJoystick) {
        movementJoystick.destroy();
        movementJoystick = null;
    }

    if (cameraJoystick) {
        cameraJoystick.destroy();
        cameraJoystick = null;
    }

    // Remove touch event listeners
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);

    // Remove containers
    removeElementById('movementJoystickContainer');
    removeElementById('cameraJoystickContainer');

    touchControlsActive = false;
}

// Helper function to remove elements by ID
function removeElementById(id) {
    const element = document.getElementById(id);
    if (element) {
        document.body.removeChild(element);
    }
}

// Check if device has touch support
export function isTouchDevice() {
    return ('ontouchstart' in window);
}