import * as THREE from 'three';
import { scene, camera, boat, keys } from '../core/gameState.js';
import { updateCameraPosition } from '../controls/cameraControls.js';
import { islandCommands } from './islandCommands.js';
import { fireCommands, updateFireballs } from './fireCommands.js';
import { shipCommands } from './shipCommands.js';
import { monsterCommands } from './monsterCommands.js';
import { teleportCommands } from './teleportCommands.js';
import { clanCommands } from './clanCommands.js';
import { birdCommands } from './birdCommands.js';
import { weatherCommands } from './weatherCommands.js';
import { boatFlyCommands } from './boatFlyCommands.js';
import { toggleCameraLock, updateCameraPosition as updateMOBACamera } from '../controls/mobaCameraControls.js';

// Create a global variable to track fly mode state
// This will be checked by the updateCameraPosition function
window.flyModeEnabled = false;

// Also need to override the main.js updateCamera function
const originalUpdateCamera = window.updateCamera;

// Command registry to store all available commands
const commands = new Map();

// Command configuration - comprehensive list of all available commands and descriptions
export const COMMAND_CONFIG = {
    // Core commands
    fly: {
        description: 'Toggle fly mode or control flying options. Usage: /fly [speed]'
    },

    // Weather commands
    rain: {
        description: 'Control rain weather. Usage: /rain [start|stop|intensity (1-10)]'
    },

    // Island commands
    'rocky-island': {
        description: 'Create a rocky island at your current position. Usage: /rocky-island create [size]'
    },

    // Fire commands
    fireball: {
        description: 'Launch a fireball from your ship. Usage: /fireball [size] [intensity]'
    },

    // Ship commands
    speed: {
        description: 'Change ship speed. Usage: /speed [value]'
    },
    wild: {
        description: 'Teleport to a random location on the map'
    },

    // Monster commands
    killall: {
        description: 'Kill all sea monsters in the world'
    },

    // Teleport commands
    spawn: {
        description: 'Teleport back to the center of the map (0,0,0)'
    },

    // Clan commands
    clan: {
        description: 'Create and manage clans. Usage: /clan create [name]'
    },
    nick: {
        description: 'Change your nickname while preserving clan tag. Usage: /nick [new name]'
    },

    // Bird commands
    birdsworm: {
        description: 'Spawn a swarm of birds at your location. Usage: /birdsworm [count]'
    },

    boatfly: {
        description: 'Toggle boat flying mode with added wings. Usage: /boatfly [speed]'
    }
};

// Command system state
const state = {
    flyMode: false,
    flySpeed: 5.0,
    flyKeys: {
        forward: false,
        backward: false,
        left: false,
        right: false,
        up: false,
        down: false,
        rotateLeft: false,
        rotateRight: false
    },
    originalCameraUpdate: null,
    originalKeyHandlers: {
        keydown: null,
        keyup: null
    },
    mouseLook: {
        isLocked: false,
        isDragging: false,
        lastX: 0,
        lastY: 0,
        sensitivity: 0.002,
        pitchObject: null,  // Will hold pitch rotation
        yawObject: null,    // Will hold yaw rotation
        debugElement: null  // Element for on-screen debugging
    },
    originalMOBACameraState: {
        wasCameraLocked: true,
        orbitPosition: null
    },
    originalUpdateMOBACamera: null
};

// Reference to the imported updateCameraPosition function
let originalUpdateCameraPosition = updateCameraPosition;

// Track if we've patched the main animation loop
let animationLoopPatched = false;

/**
 * Initialize the command system
 */
export function initCommandSystem() {
    // Register core commands
    registerCommand('fly', flyCommand, 'Toggle fly mode or control flying options');

    // Register weather commands from the weatherCommands module
    weatherCommands.forEach(cmd => {
        registerCommand(cmd.name, cmd.handler, cmd.description);
    });

    // Register island commands from the islandCommands module
    islandCommands.forEach(cmd => {
        registerCommand(cmd.name, cmd.handler, cmd.description);
    });

    // Register fire commands from the fireCommands module
    fireCommands.forEach(cmd => {
        registerCommand(cmd.name, cmd.handler, cmd.description);
    });

    // Register ship commands from the shipCommands module
    shipCommands.forEach(cmd => {
        registerCommand(cmd.name, cmd.handler, cmd.description);
    });

    // Register monster commands from the monsterCommands module
    monsterCommands.forEach(cmd => {
        registerCommand(cmd.name, cmd.handler, cmd.description);
    });

    // Register teleport commands from the teleportCommands module
    teleportCommands.forEach(cmd => {
        registerCommand(cmd.name, cmd.handler, cmd.description);
    });

    // Register clan commands from the clanCommands module
    clanCommands.forEach(cmd => {
        registerCommand(cmd.name, cmd.handler, cmd.description);
    });

    // Register bird commands from the birdCommands module
    birdCommands.forEach(cmd => {
        registerCommand(cmd.name, cmd.handler, cmd.description);
    });

    // Register boat fly commands from the boatFlyCommands module
    boatFlyCommands.forEach(cmd => {
        registerCommand(cmd.name, cmd.handler, cmd.description);
    });

    // Patch the animation loop once the page is fully loaded
    if (!animationLoopPatched) {
        // Patch the animation loop after a short delay to ensure
        // the main.js code has fully loaded
        setTimeout(patchAnimationLoop, 1000);

        // Set up the animation update for fireballs
        setupFireballUpdates();
    }

    return {
        processCommand,
        isCommand
    };
}

/**
 * Register a new command
 * @param {string} name - Command name (without the slash)
 * @param {Function} handler - Command handler function
 * @param {string} description - Command description
 */
function registerCommand(name, handler, description) {
    commands.set(name.toLowerCase(), {
        name,
        handler,
        description
    });
}

/**
 * Check if a message is a command
 * @param {string} message - Message text
 * @returns {boolean} True if the message is a command
 */
export function isCommand(message) {
    return message.startsWith('/');
}

/**
 * Process a command message
 * @param {string} message - Full command message
 * @param {object} chatSystem - Reference to the chat system
 * @returns {boolean} True if the command was processed
 */
export function processCommand(message, chatSystem) {
    if (!isCommand(message)) return false;

    // Parse command and arguments
    const parts = message.slice(1).trim().split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Check if command exists
    if (!commands.has(commandName)) {
        chatSystem.addSystemMessage(`Unknown command: /${commandName}`);
        return true;
    }

    // Execute command
    try {
        const command = commands.get(commandName);
        command.handler(args, chatSystem);
        return true;
    } catch (error) {
        chatSystem.addSystemMessage(`Error executing command: /${commandName}`);
        return true;
    }
}

/**
 * Fly command implementation
 * @param {Array<string>} args - Command arguments
 * @param {object} chatSystem - Reference to the chat system
 */
function flyCommand(args, chatSystem) {
    // Check for subcommands
    if (args.length > 0) {
        const subcommand = args[0].toLowerCase();

        // Handle speed subcommand
        if (subcommand === 'speed') {
            if (args.length < 2) {
                // If no speed provided, report current speed
                chatSystem.addSystemMessage(`Current fly speed is ${state.flySpeed.toFixed(1)}x`);
                return;
            }

            const speedArg = parseFloat(args[1]);
            if (!isNaN(speedArg) && speedArg > 0) {
                // Set new speed
                state.flySpeed = speedArg;
                chatSystem.addSystemMessage(`Fly speed set to ${state.flySpeed.toFixed(1)}x`);

                // Update the indicator if already in fly mode
                if (state.flyMode) {
                    createFlyModeIndicator(); // Refresh indicator with new speed
                }
                return;
            } else {
                chatSystem.addSystemMessage(`Invalid speed value. Please use a positive number.`);
                return;
            }
        }

        // Add debug command to diagnose camera issues
        if (subcommand === 'debug') {
            // Log camera and fly mode state
            console.log('--- FLY MODE DEBUG INFO ---');
            console.log(`state.flyMode: ${state.flyMode}`);
            console.log(`window.flyModeEnabled: ${window.flyModeEnabled}`);
            console.log(`window.cameraLocked: ${window.cameraLocked}`);
            console.log(`state.originalMOBACameraState:`, state.originalMOBACameraState);

            if (window.cameraOrbitPosition) {
                console.log('window.cameraOrbitPosition:', {
                    distance: window.cameraOrbitPosition.distance,
                    phi: window.cameraOrbitPosition.phi,
                    theta: window.cameraOrbitPosition.theta
                });
            }

            if (typeof window.toggleCameraLock === 'function') {
                console.log('window.toggleCameraLock is available');
            } else {
                console.log('window.toggleCameraLock is NOT available');
            }

            if (typeof window.updateMOBACamera === 'function') {
                console.log('window.updateMOBACamera is available');
            } else {
                console.log('window.updateMOBACamera is NOT available');
            }

            chatSystem.addSystemMessage('Fly mode debug info logged to console.');
            return;
        }

        // Add reset command to force unlock camera
        if (subcommand === 'reset') {
            if (typeof window.toggleCameraLock === 'function') {
                window.toggleCameraLock(false);
                chatSystem.addSystemMessage('Camera lock has been forcibly reset.');
            } else {
                chatSystem.addSystemMessage('Cannot reset camera - toggleCameraLock not available.');
            }
            return;
        }
    }

    // Regular fly command behavior (toggle fly mode)
    if (state.flyMode) {
        // Disable fly mode
        disableFlyMode();
        chatSystem.addSystemMessage('Fly mode disabled');
    } else {
        // Check for speed argument for backward compatibility
        let speed = state.flySpeed; // Use the default speed
        if (args.length > 0) {
            const speedArg = parseFloat(args[0]);
            if (!isNaN(speedArg) && speedArg > 0) {
                speed = speedArg;
                state.flySpeed = speed;
            }
        }

        // Enable fly mode
        enableFlyMode(speed);
        chatSystem.addSystemMessage(
            `Fly mode enabled with speed ${speed.toFixed(1)}x. ` +
            `Use WASD or arrow keys to fly. Space to go up, Shift to go down. ` +
            `P to rotate left, O to rotate right. ` +
            `Click and drag to look around. /fly again to exit. ` +
            `Change speed with /fly speed [value].`
        );

        // Blur focus from the input field to allow keyboard controls to work
        if (chatSystem.messageInput) {
            chatSystem.messageInput.blur();
        }
    }
}

/**
 * Enable fly mode
 * @param {number} speed - Flying speed multiplier
 */
function enableFlyMode(speed = 1.0) {
    // Check if already in fly mode
    if (state.flyMode) return;

    console.log('[FLY] Enabling fly mode');

    // Remember current camera position and rotation
    state.cameraPosition = camera.position.clone();
    state.cameraRotation = camera.rotation.clone();

    // Store the MOBA camera state - use window.cameraLocked since that's what the module exposes
    state.originalMOBACameraState = {
        wasCameraLocked: window.cameraLocked,
        orbitPosition: window.cameraOrbitPosition ? { ...window.cameraOrbitPosition } : null
    };

    // Force unlock the camera for fly mode - call the global function that's exported by mobaCameraControls
    if (typeof window.toggleCameraLock === 'function') {
        window.toggleCameraLock(false); // Unlock the camera
        console.log('[FLY] Unlocking camera for fly mode');
    }

    // CRITICAL: Disable all other camera control event listeners
    disableAllOtherCameraControls();

    // Set fly speed
    state.flySpeed = speed;

    // Reset fly keys state
    Object.keys(state.flyKeys).forEach(key => {
        state.flyKeys[key] = false;
    });

    // Save original document keydown/keyup handlers
    const originalHandlers = getKeyboardEventListeners();
    state.originalKeyHandlers.keydown = originalHandlers.keydown;
    state.originalKeyHandlers.keyup = originalHandlers.keyup;

    // Remove the original keyboard handlers
    if (state.originalKeyHandlers.keydown) {
        document.removeEventListener('keydown', state.originalKeyHandlers.keydown);
    }
    if (state.originalKeyHandlers.keyup) {
        document.removeEventListener('keyup', state.originalKeyHandlers.keyup);
    }

    // Add our fly mode keyboard handlers
    document.addEventListener('keydown', handleFlyModeKeyDown);
    document.addEventListener('keyup', handleFlyModeKeyUp);

    // Initialize the camera rotation system using pitch/yaw objects
    setupCameraRotationSystem();

    // Add mouse handlers
    document.addEventListener('mousemove', handleFlyModeMouseMove);
    document.addEventListener('mousedown', handleFlyModeMouseDown);
    document.addEventListener('mouseup', handleFlyModeMouseUp);

    // Set fly mode state
    state.flyMode = true;
    window.flyModeEnabled = true; // Set the global state

    // Ensure the updateCamera function is properly overridden
    if (typeof window.updateCamera === 'function' && window.updateCamera !== state.originalUpdateCamera) {
        state.originalUpdateCamera = window.updateCamera;

        // Save reference to our special wrapper function
        if (!state.updateCameraWrapper) {
            state.updateCameraWrapper = function () {
                if (window.flyModeEnabled) return;
                if (state.originalUpdateCamera) {
                    return state.originalUpdateCamera.apply(this, arguments);
                }
            };
        }

        // Replace the updateCamera function
        window.updateCamera = state.updateCameraWrapper;
    }

    // Override the MOBA camera update function to prevent it from running during fly mode
    if (typeof window.updateMOBACamera === 'function' && !state.originalUpdateMOBACamera) {
        state.originalUpdateMOBACamera = window.updateMOBACamera;
        window.updateMOBACamera = function () {
            if (window.flyModeEnabled) return;
            if (state.originalUpdateMOBACamera) {
                return state.originalUpdateMOBACamera.apply(this, arguments);
            }
        };
    }

    // Override standard camera controls updateCameraPosition function
    if (typeof window.updateCameraPosition === 'function' && !state.originalUpdateCameraPosition) {
        state.originalUpdateCameraPosition = window.updateCameraPosition;
        window.updateCameraPosition = function () {
            if (window.flyModeEnabled) return;
            if (state.originalUpdateCameraPosition) {
                return state.originalUpdateCameraPosition.apply(this, arguments);
            }
        };
    }

    // Setup animation loop for fly mode
    state.prevTime = performance.now();

    // Start our custom camera update loop
    window.requestAnimationFrame(updateFlyCamera);

    // Make sure we remove focus from any text inputs
    document.activeElement?.blur();

    // Force camera to have correct orientation and rotation order for fly mode
    camera.rotation.order = 'YXZ'; // This is critical for proper first-person controls

    if (!camera.quaternion) {
        camera.quaternion = new THREE.Quaternion();
    }
    camera.quaternion.setFromEuler(camera.rotation);

    // Create on-screen debug info
    createCameraDebugInfo();

    // Add visual indicator for fly mode
    createFlyModeIndicator();
}

/**
 * Disable all other camera control systems to prevent conflicts
 */
function disableAllOtherCameraControls() {
    // Disable standard camera controls
    if (window.cameraMouseDown) {
        document.removeEventListener('mousedown', window.cameraMouseDown);
        console.log('[FLY] Removed cameraMouseDown');
    }
    if (window.cameraMouseMove) {
        document.removeEventListener('mousemove', window.cameraMouseMove);
        console.log('[FLY] Removed cameraMouseMove');
    }
    if (window.cameraMouseUp) {
        document.removeEventListener('mouseup', window.cameraMouseUp);
        console.log('[FLY] Removed cameraMouseUp');
    }
    if (window.cameraTouchStart) {
        document.removeEventListener('touchstart', window.cameraTouchStart);
        console.log('[FLY] Removed cameraTouchStart');
    }
    if (window.cameraTouchMove) {
        document.removeEventListener('touchmove', window.cameraTouchMove);
        console.log('[FLY] Removed cameraTouchMove');
    }
    if (window.cameraTouchEnd) {
        document.removeEventListener('touchend', window.cameraTouchEnd);
        console.log('[FLY] Removed cameraTouchEnd');
    }

    // Save for restoration later
    state.disabledCameraControls = {
        mouseDown: window.cameraMouseDown,
        mouseMove: window.cameraMouseMove,
        mouseUp: window.cameraMouseUp,
        touchStart: window.cameraTouchStart,
        touchMove: window.cameraTouchMove,
        touchEnd: window.cameraTouchEnd
    };
}

/**
 * Restore all previously disabled camera control systems
 */
function restoreOtherCameraControls() {
    if (!state.disabledCameraControls) return;

    // Restore standard camera controls
    if (state.disabledCameraControls.mouseDown) {
        document.addEventListener('mousedown', state.disabledCameraControls.mouseDown);
        console.log('[FLY] Restored cameraMouseDown');
    }
    if (state.disabledCameraControls.mouseMove) {
        document.addEventListener('mousemove', state.disabledCameraControls.mouseMove);
        console.log('[FLY] Restored cameraMouseMove');
    }
    if (state.disabledCameraControls.mouseUp) {
        document.addEventListener('mouseup', state.disabledCameraControls.mouseUp);
        console.log('[FLY] Restored cameraMouseUp');
    }
    if (state.disabledCameraControls.touchStart) {
        document.addEventListener('touchstart', state.disabledCameraControls.touchStart);
        console.log('[FLY] Restored cameraTouchStart');
    }
    if (state.disabledCameraControls.touchMove) {
        document.addEventListener('touchmove', state.disabledCameraControls.touchMove);
        console.log('[FLY] Restored cameraTouchMove');
    }
    if (state.disabledCameraControls.touchEnd) {
        document.addEventListener('touchend', state.disabledCameraControls.touchEnd);
        console.log('[FLY] Restored cameraTouchEnd');
    }

    // Clear saved controls
    state.disabledCameraControls = null;
}

/**
 * Setup the camera rotation system using separate pitch and yaw objects
 */
function setupCameraRotationSystem() {
    // Reset state
    state.mouseLook.pitchObject = { rotation: 0 }; // Pitch (up/down)
    state.mouseLook.yawObject = { rotation: 0 };   // Yaw (left/right)

    // Initialize with camera's current rotation
    state.mouseLook.pitchObject.rotation = camera.rotation.x;
    state.mouseLook.yawObject.rotation = camera.rotation.y;

    // Set the rotation order - critical for FPS camera
    camera.rotation.order = 'YXZ';

    // Log initial camera state
    console.log('[FLY] Initial camera state:', {
        position: camera.position.clone(),
        rotation: {
            x: camera.rotation.x,
            y: camera.rotation.y,
            z: camera.rotation.z,
            order: camera.rotation.order
        },
        quaternion: camera.quaternion.clone()
    });
}

/**
 * Handle mouse down events in fly mode
 * @param {MouseEvent} event - Mouse event
 */
function handleFlyModeMouseDown(event) {
    if (!state.flyMode) return;

    // Only handle left mouse button (button 0)
    if (event.button === 0) {
        state.mouseLook.isDragging = true;
        state.mouseLook.lastX = event.clientX;
        state.mouseLook.lastY = event.clientY;
        console.log('Mouse DOWN - Drag started', { x: event.clientX, y: event.clientY });

        // Update debug info
        updateCameraDebugInfo();
    }
}

/**
 * Handle mouse up events in fly mode
 * @param {MouseEvent} event - Mouse event
 */
function handleFlyModeMouseUp(event) {
    if (!state.flyMode) return;

    // Only handle left mouse button (button 0)
    if (event.button === 0) {
        state.mouseLook.isDragging = false;
        console.log('Mouse UP - Drag ended', { x: event.clientX, y: event.clientY });

        // Update debug info
        updateCameraDebugInfo();
    }
}

/**
 * Handle mouse movement in fly mode - completely rewritten with better pitch/yaw handling
 * @param {MouseEvent} event - Mouse event
 */
function handleFlyModeMouseMove(event) {
    if (!state.flyMode) return;

    // Only rotate camera if mouse is being dragged (clicked and moved)
    if (state.mouseLook.isDragging) {
        // Calculate mouse movement since last frame
        const movementX = event.clientX - state.mouseLook.lastX;
        const movementY = event.clientY - state.mouseLook.lastY;

        // Store current position for next frame
        state.mouseLook.lastX = event.clientX;
        state.mouseLook.lastY = event.clientY;

        // Skip tiny movements to reduce jitter
        if (Math.abs(movementX) < 0.5 && Math.abs(movementY) < 0.5) return;

        // Start fresh with current values
        let newPitch = state.mouseLook.pitchObject.rotation;
        let newYaw = state.mouseLook.yawObject.rotation;

        // Apply pitch change (up/down) - INVERT Y for natural movement
        // Negative movementY (mouse up) should increase pitch angle (look up)
        newPitch -= movementY * state.mouseLook.sensitivity;

        // Apply yaw change (left/right)
        // Negative movementX (mouse left) should decrease yaw angle (look left)
        newYaw -= movementX * state.mouseLook.sensitivity;

        // Clamp pitch to avoid flipping
        newPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, newPitch));

        // Store final values in state
        state.mouseLook.pitchObject.rotation = newPitch;
        state.mouseLook.yawObject.rotation = newYaw;

        // Apply rotations directly to camera
        // For a proper FPS camera:
        // 1. Rotation order must be YXZ
        // 2. Apply yaw first (Y), then pitch (X)
        camera.rotation.y = newYaw;
        camera.rotation.x = newPitch;

        // Update quaternion from Euler angles
        camera.quaternion.setFromEuler(camera.rotation);

        // Verbose logging for debugging every 20px of movement
        const totalMovement = Math.abs(movementX) + Math.abs(movementY);
        if (totalMovement > 20) {
            console.log('[FLY] Mouse move:', {
                movementX,
                movementY,
                pitch: newPitch.toFixed(3),
                yaw: newYaw.toFixed(3),
                camX: camera.rotation.x.toFixed(3),
                camY: camera.rotation.y.toFixed(3),
                order: camera.rotation.order
            });
        }

        // Update debug info
        updateCameraDebugInfo();
    }
}

/**
 * Handle keydown events in fly mode
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleFlyModeKeyDown(event) {
    // Skip if chat input is active or any input element is focused
    if (window.chatInputActive ||
        (document.activeElement &&
            (document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.isContentEditable))) {
        return;
    }

    // First log the event to debug
    let handled = true;

    // Convert key to uppercase for case-insensitive comparison
    const key = event.key.toUpperCase();

    switch (key) {
        case 'W':
        case 'ARROWUP':
            state.flyKeys.forward = true;
            break;
        case 'S':
        case 'ARROWDOWN':
            state.flyKeys.backward = true;
            break;
        case 'A':
        case 'ARROWLEFT':
            state.flyKeys.left = true;
            break;
        case 'D':
        case 'ARROWRIGHT':
            state.flyKeys.right = true;
            break;
        case ' ': // Space
            state.flyKeys.up = true;
            break;
        case 'SHIFT':
            state.flyKeys.down = true;
            break;
        case 'P':
            state.flyKeys.rotateLeft = true;
            break;
        case 'O':
            state.flyKeys.rotateRight = true;
            break;
        default:
            handled = false;
            break;
    }

    // If we handled a navigation key, prevent default actions
    if (handled) {
        event.preventDefault();
        event.stopPropagation();
    }
}

/**
 * Handle keyup events in fly mode
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleFlyModeKeyUp(event) {
    // Skip if chat input is active or any input element is focused
    if (window.chatInputActive ||
        (document.activeElement &&
            (document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.isContentEditable))) {
        return;
    }

    // First log the event to debug
    let handled = true;

    // Convert key to uppercase for case-insensitive comparison
    const key = event.key.toUpperCase();

    switch (key) {
        case 'W':
        case 'ARROWUP':
            state.flyKeys.forward = false;
            break;
        case 'S':
        case 'ARROWDOWN':
            state.flyKeys.backward = false;
            break;
        case 'A':
        case 'ARROWLEFT':
            state.flyKeys.left = false;
            break;
        case 'D':
        case 'ARROWRIGHT':
            state.flyKeys.right = false;
            break;
        case ' ': // Space
            state.flyKeys.up = false;
            break;
        case 'SHIFT':
            state.flyKeys.down = false;
            break;
        case 'P':
            state.flyKeys.rotateLeft = false;
            break;
        case 'O':
            state.flyKeys.rotateRight = false;
            break;
        default:
            handled = false;
            break;
    }

    // If we handled a navigation key, prevent default actions
    if (handled) {
        event.preventDefault();
        event.stopPropagation();
    }
}

/**
 * Update the camera position in fly mode
 */
function updateFlyCamera() {
    // If no longer in fly mode, stop updating
    if (!state.flyMode || !window.flyModeEnabled) {
        return;
    }

    try {
        const now = performance.now();
        const deltaTime = Math.min((now - state.prevTime) / 1000, 0.1); // Cap at 100ms to prevent large jumps
        state.prevTime = now;

        // Move speed (units per second)
        const moveSpeed = state.flySpeed * 30 * deltaTime;

        // Rotation speed (radians per second)
        const rotateSpeed = 2.0 * deltaTime;

        // Store original position and rotation for debugging
        const originalPos = camera.position.clone();
        const originalRot = camera.rotation.clone();

        // Get camera direction vectors
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0);

        // Check if any movement keys are pressed
        let anyMovementKeyPressed = false;
        let pressedKeys = [];

        // Apply movement based on key states
        if (state.flyKeys.forward) {
            camera.position.addScaledVector(forward, moveSpeed);
            anyMovementKeyPressed = true;
            pressedKeys.push('W/↑ (forward)');
        }
        if (state.flyKeys.backward) {
            camera.position.addScaledVector(forward, -moveSpeed);
            anyMovementKeyPressed = true;
            pressedKeys.push('S/↓ (backward)');
        }
        if (state.flyKeys.right) {
            camera.position.addScaledVector(right, moveSpeed);
            anyMovementKeyPressed = true;
            pressedKeys.push('D/→ (right)');
        }
        if (state.flyKeys.left) {
            camera.position.addScaledVector(right, -moveSpeed);
            anyMovementKeyPressed = true;
            pressedKeys.push('A/← (left)');
        }
        if (state.flyKeys.up) {
            camera.position.addScaledVector(up, moveSpeed);
            anyMovementKeyPressed = true;
            pressedKeys.push('Space (up)');
        }
        if (state.flyKeys.down) {
            camera.position.addScaledVector(up, -moveSpeed);
            anyMovementKeyPressed = true;
            pressedKeys.push('Shift (down)');
        }

        // Apply rotation based on key states
        if (state.flyKeys.rotateLeft) {
            camera.rotation.y += rotateSpeed;
            anyMovementKeyPressed = true;
            pressedKeys.push('P (rotate left)');
        }
        if (state.flyKeys.rotateRight) {
            camera.rotation.y -= rotateSpeed;
            anyMovementKeyPressed = true;
            pressedKeys.push('O (rotate right)');
        }

        // Debug logging
        if (anyMovementKeyPressed) {
            const newPos = camera.position;
            const distance = originalPos.distanceTo(newPos);
            const rotationChange = Math.abs(originalRot.y - camera.rotation.y);

            // Double-check that the camera actually moved or rotated
            if (distance < 0.01 && rotationChange < 0.001) {
            }
        }

        // Debug helper: log current key states occasionally
        if (Math.random() < 0.01) { // ~1% chance each frame to reduce spam
        }

        // Continue animation loop
        window.requestAnimationFrame(updateFlyCamera);
    } catch (error) {
        // Try to continue the animation loop despite the error
        window.requestAnimationFrame(updateFlyCamera);
    }
}

/**
 * Helper to get keyboard event listeners
 * @returns {Object} Object with keydown and keyup event listeners
 */
function getKeyboardEventListeners() {
    // This is a simplified method that might not find all listeners
    // In a real app, you'd need a more robust way to manage this
    const listeners = { keydown: null, keyup: null };

    // We'll take the document's listeners from main.js
    // This is a simplification and might not work in all cases
    document.eventListeners = document.eventListeners || {};
    listeners.keydown = document.eventListeners.keydown;
    listeners.keyup = document.eventListeners.keyup;

    return listeners;
}

/**
 * Patch the animation loop to respect the fly mode
 */
function patchAnimationLoop() {
    // If updateCamera function exists, patch it
    if (typeof window.updateCamera === 'function') {
        state.originalUpdateCamera = window.updateCamera;

        // Create a wrapper function that checks flyModeEnabled
        const originalFn = window.updateCamera;
        window.updateCamera = function () {
            if (window.flyModeEnabled) return;
            return originalFn.apply(this, arguments);
        };

        animationLoopPatched = true;
    } else {
    }
}

/**
 * Set up fireball updates by hooking into the animation loop
 */
function setupFireballUpdates() {
    // Get the original animate function if it exists
    const originalAnimate = window.animate;

    if (typeof originalAnimate === 'function') {
        // Create a wrapper that calls updateFireballs before the original animation
        window.animate = function () {
            // Calculate delta time (similar to how it's done in main.js)
            const now = performance.now();
            const deltaTime = (now - (window.lastTime || now)) / 1000; // Convert to seconds
            window.lastTime = now;

            // Update fireballs
            updateFireballs(deltaTime);

            // Call the original animate function
            return originalAnimate.apply(this, arguments);
        };
    } else {
        // If we can't find the original animate function, set up our own update loop
        let lastTime = performance.now();

        function updateLoop() {
            const now = performance.now();
            const deltaTime = (now - lastTime) / 1000;
            lastTime = now;

            updateFireballs(deltaTime);

            requestAnimationFrame(updateLoop);
        }

        requestAnimationFrame(updateLoop);
    }
}

/**
 * Create a visual indicator showing fly mode is active and controls
 */
function createFlyModeIndicator() {
    // Remove existing indicator if present
    removeFlyModeIndicator();

    // Create the indicator
    const indicator = document.createElement('div');
    indicator.id = 'fly-mode-indicator';
    indicator.style.position = 'fixed';
    indicator.style.top = '80px';
    indicator.style.right = '20px';
    indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    indicator.style.color = '#fff';
    indicator.style.padding = '10px';
    indicator.style.borderRadius = '5px';
    indicator.style.fontFamily = 'serif';
    indicator.style.fontSize = '14px';
    indicator.style.zIndex = '1000';
    indicator.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    indicator.style.border = '1px solid #B8860B'; // Gold border

    // Create content
    indicator.innerHTML = `
        <div style="margin-bottom: 5px; font-weight: bold; color: #DAA520; text-align: center;">✈️ FLY MODE ACTIVE</div>
        <div style="border-bottom: 1px solid #B8860B; margin-bottom: 5px;"></div>
        <div style="display: grid; grid-template-columns: auto auto; gap: 5px;">
            <div><b>W/↑</b>: Forward</div>
            <div><b>S/↓</b>: Backward</div>
            <div><b>A/←</b>: Left</div>
            <div><b>D/→</b>: Right</div>
            <div><b>Space</b>: Up</div>
            <div><b>Shift</b>: Down</div>
            <div><b>P</b>: Rotate Left</div>
            <div><b>O</b>: Rotate Right</div>
            <div><b>Click+Drag</b>: Look</div>
            <div><b>/fly</b>: Exit</div>
        </div>
        <div style="border-top: 1px solid #B8860B; margin-top: 5px; font-size: 12px; text-align: center;">
            Speed: ${state.flySpeed.toFixed(1)}x • <span style="cursor:pointer; text-decoration:underline;" onclick="document.querySelector('#chat-input').value='/fly speed '; document.querySelector('#chat-input').focus();">Change Speed</span>
        </div>
    `;

    document.body.appendChild(indicator);
}

/**
 * Remove the fly mode indicator
 */
function removeFlyModeIndicator() {
    const existingIndicator = document.getElementById('fly-mode-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
}

/**
 * Disable fly mode - cleanup and restore previous camera state
 */
function disableFlyMode() {
    console.log('[FLY] Disabling fly mode');

    // Remove fly mode keyboard handlers
    document.removeEventListener('keydown', handleFlyModeKeyDown);
    document.removeEventListener('keyup', handleFlyModeKeyUp);

    // Remove mouse handlers
    document.removeEventListener('mousemove', handleFlyModeMouseMove);
    document.removeEventListener('mousedown', handleFlyModeMouseDown);
    document.removeEventListener('mouseup', handleFlyModeMouseUp);

    // Exit pointer lock if active (legacy cleanup)
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    // Restore original keyboard handlers
    if (state.originalKeyHandlers.keydown) {
        document.addEventListener('keydown', state.originalKeyHandlers.keydown);
    }
    if (state.originalKeyHandlers.keyup) {
        document.addEventListener('keyup', state.originalKeyHandlers.keyup);
    }

    // Reset state
    state.flyMode = false;
    window.flyModeEnabled = false; // Reset the global state

    // Restore original updateCamera function
    if (state.originalUpdateCamera) {
        window.updateCamera = state.originalUpdateCamera;
    }

    // Restore original MOBA camera update function
    if (state.originalUpdateMOBACamera) {
        window.updateMOBACamera = state.originalUpdateMOBACamera;
        state.originalUpdateMOBACamera = null;
    }

    // Restore original standard camera controls update function
    if (state.originalUpdateCameraPosition) {
        window.updateCameraPosition = state.originalUpdateCameraPosition;
        state.originalUpdateCameraPosition = null;
    }

    // Reset camera to original position and rotation
    camera.position.copy(state.cameraPosition);
    camera.rotation.copy(state.cameraRotation);
    camera.quaternion.setFromEuler(camera.rotation);

    // Restore the MOBA camera state if it was saved
    if (state.originalMOBACameraState) {
        // Restore orbit position if it was saved
        if (state.originalMOBACameraState.orbitPosition && window.cameraOrbitPosition) {
            window.cameraOrbitPosition.distance = state.originalMOBACameraState.orbitPosition.distance;
            window.cameraOrbitPosition.phi = state.originalMOBACameraState.orbitPosition.phi;
            window.cameraOrbitPosition.theta = state.originalMOBACameraState.orbitPosition.theta;
        }

        // Re-lock the camera if it was locked before, using window.toggleCameraLock
        if (typeof window.toggleCameraLock === 'function' && state.originalMOBACameraState.wasCameraLocked) {
            console.log('[FLY] Restoring camera lock state:', state.originalMOBACameraState.wasCameraLocked);
            window.toggleCameraLock(true); // Lock the camera
        }
    }

    // Restore all other camera control systems
    restoreOtherCameraControls();

    // Call updateMOBACamera once to restore proper camera positioning for the MOBA camera
    if (typeof updateMOBACamera === 'function') {
        updateMOBACamera();
    } else if (typeof window.updateMOBACamera === 'function') {
        window.updateMOBACamera(); // Try the window version
    } else {
        // Fallback to standard camera update
        updateCameraPosition();
    }

    // Remove debug elements
    if (state.mouseLook.debugElement) {
        document.body.removeChild(state.mouseLook.debugElement);
        state.mouseLook.debugElement = null;
    }

    // Remove visual indicator
    removeFlyModeIndicator();
} 