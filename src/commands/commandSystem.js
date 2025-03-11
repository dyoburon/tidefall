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
        sensitivity: 0.002
    }
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

    // Patch the animation loop once the page is fully loaded
    if (!animationLoopPatched) {
        // Patch the animation loop after a short delay to ensure
        // the main.js code has fully loaded
        setTimeout(patchAnimationLoop, 1000);

        // Set up the animation update for fireballs
        setupFireballUpdates();
    }

    console.log("✅ Command system initialized with commands:", Array.from(commands.keys()));

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
        console.error(`Error executing command /${commandName}:`, error);
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
            console.log("Blurred chat input to enable keyboard controls");
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

    // Remember current camera position and rotation
    state.cameraPosition = camera.position.clone();
    state.cameraRotation = camera.rotation.clone();

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

    // Add mouse handlers
    document.addEventListener('mousemove', handleFlyModeMouseMove);
    document.addEventListener('mousedown', handleFlyModeMouseDown);
    document.addEventListener('mouseup', handleFlyModeMouseUp);

    // Set up mouse look
    state.mouseLook = {
        isLocked: false,
        isDragging: false,
        lastX: 0,
        lastY: 0,
        sensitivity: 0.002
    };

    // Request pointer lock on click (disabled - now using click and drag instead)
    // document.addEventListener('click', requestPointerLock);
    // document.addEventListener('pointerlockchange', handlePointerLockChange);

    // Set fly mode state
    state.flyMode = true;
    window.flyModeEnabled = true; // Set the global state

    // Ensure the updateCamera function is properly overridden
    // This is a backup in case the early patchAnimationLoop didn't work
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
        console.log("📸 Overrode updateCamera function for fly mode");
    }

    // Setup animation loop for fly mode
    state.prevTime = performance.now();

    // Start our custom camera update loop
    window.requestAnimationFrame(updateFlyCamera);

    // Make sure we remove focus from any text inputs
    document.activeElement?.blur();

    // Force camera orientation if needed
    // This ensures the camera is correctly oriented for free flight
    if (!camera.quaternion) {
        camera.quaternion = new THREE.Quaternion();
        camera.quaternion.setFromEuler(camera.rotation);
    }

    // Add visual indicator for fly mode
    createFlyModeIndicator();

    console.log("🚁 Fly mode enabled - camera detached");
    console.log("Current camera position:", camera.position);
    console.log("Current camera rotation:", camera.rotation);
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
 * Disable fly mode
 */
function disableFlyMode() {
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

    // Reset camera to original position and rotation
    camera.position.copy(state.cameraPosition);
    camera.rotation.copy(state.cameraRotation);

    // Call updateCameraPosition once to restore proper camera positioning
    updateCameraPosition();

    // Remove visual indicator
    removeFlyModeIndicator();

    console.log("🚢 Fly mode disabled - camera reattached to boat");
}

/**
 * Request pointer lock for mouse look
 */
function requestPointerLock() {
    if (!state.flyMode) return;
    document.body.requestPointerLock();
}

/**
 * Handle pointer lock change
 */
function handlePointerLockChange() {
    state.mouseLook.isLocked = document.pointerLockElement === document.body;
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
        console.log("Fly mode: Started camera drag");
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
        console.log("Fly mode: Ended camera drag");
    }
}

/**
 * Handle mouse movement in fly mode
 * @param {MouseEvent} event - Mouse event
 */
function handleFlyModeMouseMove(event) {
    if (!state.flyMode) return;

    // Only rotate camera if mouse is being dragged (clicked and moved)
    if (state.mouseLook.isDragging) {
        const movementX = event.clientX - state.mouseLook.lastX;
        const movementY = event.clientY - state.mouseLook.lastY;

        // Update camera rotation based on mouse movement
        camera.rotation.y -= movementX * state.mouseLook.sensitivity;

        // Limit vertical rotation to avoid flipping
        const newRotationX = camera.rotation.x - movementY * state.mouseLook.sensitivity;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, newRotationX));

        // Store current position for next frame
        state.mouseLook.lastX = event.clientX;
        state.mouseLook.lastY = event.clientY;
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
    console.log(`Fly mode key down: ${event.key}`);

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
    console.log(`Fly mode key up: ${event.key}`);

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
        console.log("Fly mode deactivated, stopping camera updates");
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

            console.log(`Fly mode: Camera moved ${distance.toFixed(2)} units, rotated ${(rotationChange * 180 / Math.PI).toFixed(2)}°`);
            console.log(`From: ${originalPos.x.toFixed(1)}, ${originalPos.y.toFixed(1)}, ${originalPos.z.toFixed(1)}`);
            console.log(`To: ${newPos.x.toFixed(1)}, ${newPos.y.toFixed(1)}, ${newPos.z.toFixed(1)}`);
            console.log(`Keys pressed: ${pressedKeys.join(', ')}`);

            // Double-check that the camera actually moved or rotated
            if (distance < 0.01 && rotationChange < 0.001) {
                console.warn("WARNING: Camera position and rotation didn't change significantly despite key presses!");
                console.warn("Move speed:", moveSpeed);
                console.warn("Rotate speed:", rotateSpeed);
                console.warn("Forward vector:", forward);
                console.warn("Right vector:", right);
                console.warn("Camera quaternion:", camera.quaternion);
            }
        }

        // Debug helper: log current key states occasionally
        if (Math.random() < 0.01) { // ~1% chance each frame to reduce spam
            console.log("Current fly keys state:", JSON.stringify(state.flyKeys));
            console.log("Camera position:", camera.position);
            console.log("Camera rotation:", camera.rotation);
            console.log("Current speed:", state.flySpeed);
        }

        // Continue animation loop
        window.requestAnimationFrame(updateFlyCamera);
    } catch (error) {
        console.error("Error in updateFlyCamera:", error);
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

        console.log("✅ Successfully patched updateCamera function for fly mode");
        animationLoopPatched = true;
    } else {
        console.warn("⚠️ updateCamera function not found - fly mode may not work correctly");
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

        console.log("✅ Fireball updates integrated into animation loop");
    } else {
        // If we can't find the original animate function, set up our own update loop
        console.warn("⚠️ Could not find main animation loop, setting up separate fireball update loop");

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