// gameState.js - Central store for shared game objects to avoid circular dependencies
import * as THREE from 'three';
import { createBoat } from '../entities/character.js';
import { checkAllIslandCollisions } from '../world/islands.js';
import { getHugeIslandMeshes } from '../world/hugeIsland.js';
import { applyShipKnockback } from './shipController.js';
import { setKnockbackActive, isKnockbackActive } from './shipController.js';

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
export const renderer = new THREE.WebGLRenderer({ antialias: true });
export const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
export const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
export let playerData = {
    name: localStorage.getItem('playerName') || 'Captain',
    color: localStorage.getItem('playerColor') || '#4285f4',
    rgbColor: { r: 0.26, g: 0.52, b: 0.96 } // Default blue
};

// Player health system
export const PLAYER_MAX_HEALTH = 100;
export let playerHealth = PLAYER_MAX_HEALTH;
export let isPlayerDead = false;
export let lastDamageTime = 0;
export const DAMAGE_COOLDOWN = 0.5; // Seconds between taking damage

// Add callback system for health updates
let healthUpdateCallbacks = [];

export function registerHealthUpdateCallback(callback) {
    healthUpdateCallbacks.push(callback);
}

export function unregisterHealthUpdateCallback(callback) {
    healthUpdateCallbacks = healthUpdateCallbacks.filter(cb => cb !== callback);
}

// Notify all callbacks of health update
function notifyHealthUpdate() {
    const healthStatus = getPlayerHealthStatus();
    healthUpdateCallbacks.forEach(callback => callback(healthStatus));
}

// Add this function to apply damage to the player
export function applyDamageToPlayer(damageAmount, damageSource = 'npc_cannon') {
    const currentTime = getTime();

    // Check cooldown to prevent rapid damage
    if (currentTime - lastDamageTime < DAMAGE_COOLDOWN) {
        return false;
    }

    // Update last damage time
    lastDamageTime = currentTime;

    // Apply damage
    playerHealth -= damageAmount;

    // Clamp health to 0-MAX
    playerHealth = Math.max(0, Math.min(PLAYER_MAX_HEALTH, playerHealth));

    console.log(`Player took ${damageAmount} damage from ${damageSource}. Health: ${playerHealth}/${PLAYER_MAX_HEALTH}`);

    // Notify UI and other systems of health change
    notifyHealthUpdate();

    // Check if player died
    if (playerHealth <= 0 && !isPlayerDead) {
        isPlayerDead = true;
        handlePlayerDeath(damageSource);
    }

    // Return true to indicate damage was applied
    return true;
}

// Add this function to heal the player
export function healPlayer(amount) {
    playerHealth = Math.min(PLAYER_MAX_HEALTH, playerHealth + amount);
    notifyHealthUpdate();
    return playerHealth;
}

// Add this function to reset player health
export function resetPlayerHealth() {
    playerHealth = PLAYER_MAX_HEALTH;
    isPlayerDead = false;
    notifyHealthUpdate();
    return playerHealth;
}

// Add this function to get player health status
export function getPlayerHealthStatus() {
    return {
        current: playerHealth,
        max: PLAYER_MAX_HEALTH,
        percentage: (playerHealth / PLAYER_MAX_HEALTH) * 100,
        isDead: isPlayerDead
    };
}

// Handle player death
function handlePlayerDeath(damageSource) {
    console.log(`Player has died from ${damageSource}!`);

    // Import network module dynamically to avoid circular dependencies
    import('./network.js').then(network => {
        // Send player_defeated event to server
        if (network.socket && network.socket.connected) {
            console.log("Sending player_defeated event to server");
            network.socket.emit('player_defeated', {
                player_id: network.firebaseDocId || 'local_player',
                killer_id: damageSource,
                timestamp: Date.now()
            });
        }

        // Use respawnManager which is properly exported from network.js
        if (network.respawnManager) {
            console.log("Starting respawn process...");
            // Initialize with references if not already done
            // Fix: pass the boat reference without relying on playerState variable
            network.respawnManager.initRespawnManager({
                isRespawning: true,
                mode: 'boat'
            }, boat);
            // Start the respawn process
            network.respawnManager.startRespawn();

            // Auto-complete respawn after 3 seconds for local players
            setTimeout(() => {
                if (network.respawnManager.isRespawning) {
                    console.log("Auto-completing respawn for local player");
                    network.respawnManager.completeRespawn();
                }
            }, 3000); // 3 second delay to match respawn countdown
        } else {
            console.error("Unable to start respawn process - respawnManager not found");
        }
    }).catch(error => {
        console.error("Error importing network module:", error);
    });

    // Reset player health
    resetPlayerHealth();
}

export const boatVelocity = new THREE.Vector3(0, 0, 0);
export const boatSpeed = 1.4; // Much slower speed (was 0.03)
export const rotationSpeed = 0.03; // Slower turning (was 0.03)
export const keys = { forward: false, backward: false, left: false, right: false };
export const boat = createBoat(scene);
let time = 0;

// Add this near the top with other exports
export let allPlayers = [];

// Player name and color functions that login.js is trying to import
export function setPlayerName(name) {

    // Initialize playerData if it doesn't exist
    if (!playerData) {
        playerData = {};
    }

    // Update playerData
    playerData.name = name;

    // Save to localStorage for persistence
    localStorage.setItem('playerName', name);

    return name;
}

export function setPlayerColor(color) {

    // Initialize playerData if it doesn't exist
    if (!playerData) {
        playerData = {};
    }

    // If color is already in RGB format (Three.js format)
    if (typeof color === 'object' && 'r' in color && 'g' in color && 'b' in color) {
        playerData.rgbColor = color;

        // Convert to hex for storage
        const hexColor = rgbToHex(color);
        playerData.color = hexColor;
        localStorage.setItem('playerColor', hexColor);
    }
    // If color is in hex format (from HTML color picker)
    else if (typeof color === 'string' && color.startsWith('#')) {
        playerData.color = color;
        playerData.rgbColor = hexToRgb(color);
        localStorage.setItem('playerColor', color);
    }

    // Update boat color if needed
    if (boat && boat.material) {
        boat.material.color.setRGB(
            playerData.rgbColor.r,
            playerData.rgbColor.g,
            playerData.rgbColor.b
        );
    }

    return playerData.color;
}

// Helper functions for color conversion
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
}

function rgbToHex(rgb) {
    const toHex = (c) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function updateTime(deltaTime) {
    time += deltaTime;
}

export function getTime() {
    return time;
}

export function getWindData() {
    // For now, return static data or calculate based on time
    return {
        direction: (Math.sin(getTime() * 0.01) * Math.PI) + Math.PI, // Slowly changing direction
        speed: 5 + Math.sin(getTime() * 0.05) * 3 // Wind speed between 2-8 knots
    };
}

export function getPlayerStateFromDb() {
    return playerData;
}

export function setPlayerStateFromDb(data) {
    playerData = data;
}

// Get current player info
export function getPlayerInfo() {
    return {
        name: playerData?.name || 'Captain',
        color: playerData?.color || '#4285f4',
        rgbColor: playerData?.rgbColor || { r: 0.26, g: 0.52, b: 0.96 }
    };
}

// Update existing updateAllPlayers function to store the players data
export function updateAllPlayers(players) {
    allPlayers = players;
    //
    return allPlayers;
}

// Add this new function to return the stored players
export function getAllPlayers() {
    return allPlayers;
}

// Add these scene management functions
export function addToScene(object) {

    scene.add(object);
    return object;
}

export function removeFromScene(object) {
    if (!object) {

        return false;
    }

    if (object.parent !== scene) {

        return false;
    }


    scene.remove(object);

    // Clean up resources
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
        if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
        } else {
            object.material.dispose();
        }
    }

    return true;
}

// Helper to safely check if an object is in the scene
export function isInScene(object) {
    return object && object.parent === scene;
}

const raycaster = new THREE.Raycaster(); // Add raycaster to game state

export function checkBoatIslandCollision() {
    if (!boat) return false;

    // Persistent state for frame-skipping
    if (!checkBoatIslandCollision.state) {
        checkBoatIslandCollision.state = {
            frameCounter: 0,
            lastResult: false
        };
    }
    const state = checkBoatIslandCollision.state;

    // Check every 30 frames
    state.frameCounter = (state.frameCounter + 1) % 60;
    if (state.frameCounter !== 0) {
        return state.lastResult;
    }

    // Skip if knockback is active (prevents re-triggering)
    if (isKnockbackActive()) {
        console.log('knockbackActive', isKnockbackActive());
        return state.lastResult;
    }

    // Full collision check
    const boatPos = boat.position.clone();
    const rayDirection = new THREE.Vector3(-1, 0, 0); // Leftward ray
    raycaster.set(boatPos, rayDirection);

    const islandMeshes = getHugeIslandMeshes();
    if (islandMeshes.length === 0) return false;

    let intersects = [];
    if (islandMeshes) {
        intersects = raycaster.intersectObjects(islandMeshes, true);
    }

    const collisionThreshold = 20;
    if (intersects.length > 0) {
        const distance = intersects[0].distance;
        if (distance <= collisionThreshold) {
            // Collision detected: apply knockback opposite to ray direction (rightward)
            const knockbackDirection = rayDirection.clone().negate(); // (1, 0, 0)
            applyDirectBoatKnockback(knockbackDirection, 200.0, {
                duration: 5
            });
            state.lastResult = true;
            console.log(`Collision! Knockback applied, distance: ${distance}`);
        } else {
            state.lastResult = false;
        }
        return state.lastResult;
    }

    state.lastResult = false;
    return false;
}

// A temporary solution for boat knockback that directly manipulates position
// instead of using velocity, to avoid getting stuck in collisions
export function applyDirectBoatKnockback(direction, distance, options = {}) {
    // Default options
    const defaults = {
        duration: 0.5,          // Duration of the knockback animation in seconds
        easing: 'quadOut',     // Easing function: quadOut gives a natural slow-down at the end
        heightBoost: 5,       // Optional vertical bounce in units
        additionalRotation: 0  // Optional rotation during knockback in radians
    };

    // Merge options
    const settings = { ...defaults, ...options };

    // Make sure boat exists
    if (!boat) return false;

    // Normalize direction
    const knockbackDir = direction.clone().normalize();

    // Calculate target position
    const startPosition = boat.position.clone();
    const targetPosition = startPosition.clone().add(
        knockbackDir.multiplyScalar(distance)
    );

    // Store animation state
    const knockbackState = {
        active: true,
        startTime: getTime(),
        duration: settings.duration,
        startPosition: startPosition,
        targetPosition: targetPosition,
        startRotation: boat.rotation.y,
        additionalRotation: settings.additionalRotation,
        heightBoost: settings.heightBoost,
        easing: settings.easing
    };

    // Store the state in a global for the update function to use
    if (!window.boatKnockbackState) {
        window.boatKnockbackState = knockbackState;
    } else {
        Object.assign(window.boatKnockbackState, knockbackState);
    }

    // Stop the boat's velocity immediately
    boatVelocity.set(0, 0, 0);

    // Enable the knockback state
    setKnockbackActive(true);

    return true;
}

// Add this function to update the position-based knockback animation
export function updateDirectKnockback(deltaTime) {
    const state = window.boatKnockbackState;

    // Skip if no active knockback
    if (!state || !state.active) return false;

    // Calculate progress
    const currentTime = getTime();
    const elapsed = currentTime - state.startTime;
    let progress = Math.min(1.0, elapsed / state.duration);

    // Apply easing
    if (state.easing === 'quadOut') {
        // Quadratic ease-out: slows down as it approaches end
        progress = 1 - (1 - progress) * (1 - progress);
    } else if (state.easing === 'bounceOut') {
        // Bounce effect
        const bounce = (x) => {
            const n1 = 7.5625;
            const d1 = 2.75;
            if (x < 1 / d1) {
                return n1 * x * x;
            } else if (x < 2 / d1) {
                return n1 * (x -= 1.5 / d1) * x + 0.75;
            } else if (x < 2.5 / d1) {
                return n1 * (x -= 2.25 / d1) * x + 0.9375;
            } else {
                return n1 * (x -= 2.625 / d1) * x + 0.984375;
            }
        };
        progress = bounce(progress);
    }

    // Interpolate position
    const newPosition = new THREE.Vector3().lerpVectors(
        state.startPosition,
        state.targetPosition,
        progress
    );

    // Add height boost using a parabolic curve (up and down)
    if (state.heightBoost > 0) {
        // Height follows a parabola: 4 * h * p * (1 - p) where p is progress
        // This gives max height at progress = 0.5 and returns to 0 at progress = 1
        const heightProgress = 4 * state.heightBoost * progress * (1 - progress);
        newPosition.y += heightProgress;
    }

    // Apply rotation if specified
    if (state.additionalRotation !== 0) {
        const rotationProgress = progress * state.additionalRotation;
        boat.rotation.y = state.startRotation + rotationProgress;
    }

    // Apply the new position
    boat.position.copy(newPosition);

    // Check if knockback is complete
    if (progress >= 1.0) {
        state.active = false;
        setKnockbackActive(false);
        return false;
    }

    return true;
}