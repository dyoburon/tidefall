// gameState.js - Central store for shared game objects to avoid circular dependencies
import * as THREE from 'three';
import { createBoat } from '../entities/character.js';
import { checkAllIslandCollisions } from '../world/islands.js';

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

export const boatVelocity = new THREE.Vector3(0, 0, 0);
export const boatSpeed = 0.2; // Much slower speed (was 0.03)
export const rotationSpeed = 0.03; // Slower turning (was 0.03)
export const keys = { forward: false, backward: false, left: false, right: false };
export const boat = createBoat(scene);
let time = 0;

// Add these variables near the top with other exports
export const shipSpeedConfig = {
    basePlayerSpeed: 0.5,     // Normal max speed when player is controlling
    baseKnockbackSpeed: 2,   // Max speed when not player-controlled (like knockbacks)
    speedMultiplier: 1.0       // Multiplier that can be adjusted by /speed command
};

// Add this near the top with other exports
export let allPlayers = [];

// Add this near your other exports
export let knockbackActive = false;
export let knockbackTimer = 0;

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

// SHIP CONFIGURATION OBJECT - All tunable parameters in one place
const SHIP_CONFIG = {
    // PHYSICAL PROPERTIES
    mass: 1200,                     // Ultra light

    // POWER & SPEED
    baseSailPower: 100,             // Maximum power
    backwardPowerRatio: 0.6,        // Moderate backwards

    // TURNING
    baseRudderPower: 1.1,           // Modest turning - focused on speed
    turnSpeedMultiplier: 1.0,       // Slower rotation - not for cornering
    turnConsistencyFactor: 50,       // Poor turning at high speeds

    // RESISTANCE & FRICTION
    waterResistance: 0.3,           // Low resistance for speed

    // DAMPING (DECELERATION WHEN NOT ACCELERATING)
    normalDampingFactor: 0.98,      // Very slow deceleration
    lowSpeedDampingFactor: 0.8,     // Still slow to stop
    lowSpeedThreshold: 0.1,         // Low threshold - built for speed

    // DRIFTING
    turnDriftAmount: 0.2,           // Significant drift
    minTurnDriftSpeed: 0.4,         // Drifts easily

    // WIND EFFECTS
    windDriftStrength: 0.00003      // Affected by wind due to light weight
};

export function updateShipMovement(deltaTime) {
    // Get wind info for sailing mechanics
    const windData = getWindData();
    const windDirection = windData.direction;
    const windSpeed = windData.speed;


    checkAndHandleIslandCollisions();

    // Calculate ship's current speed and heading
    const currentSpeed = boatVelocity.length();
    const shipHeading = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), boat.rotation.y);

    // Calculate sailing efficiency based on wind angle
    const windVector = new THREE.Vector3(Math.cos(windDirection), 0, Math.sin(windDirection));
    const windAngleToShip = shipHeading.angleTo(windVector);

    // Wind efficiency calculation
    const windEfficiency = 0.1 + 0.9 * (1 - Math.abs(windAngleToShip - Math.PI) / Math.PI);

    // SAILING MECHANICS
    // Calculate forces acting on the ship
    let accelerationForce = new THREE.Vector3();

    // Apply sail power with wind efficiency
    const effectiveSailPower = SHIP_CONFIG.baseSailPower * Math.sqrt(shipSpeedConfig.speedMultiplier);

    if (keys.forward && !knockbackActive) {
        // DRAMATICALLY IMPROVED FORWARD ACCELERATION
        accelerationForce.add(shipHeading.clone().multiplyScalar(effectiveSailPower));
    }

    if (keys.backward && !knockbackActive) {
        // DRAMATICALLY IMPROVED BACKWARD ACCELERATION
        const backwardForce = -effectiveSailPower * SHIP_CONFIG.backwardPowerRatio;
        accelerationForce.add(shipHeading.clone().multiplyScalar(backwardForce));
    }

    // DRAMATICALLY IMPROVED TURNING MECHANICS
    let turnEffect = 0;

    // More consistent turning at all speeds
    const speedFactor = Math.max(0.2, Math.min(1, currentSpeed / SHIP_CONFIG.turnConsistencyFactor));
    const turnPower = SHIP_CONFIG.baseRudderPower / speedFactor;

    if (keys.left) {
        turnEffect = turnPower;
    } else if (keys.right) {
        turnEffect = -turnPower;
    }

    // DRAMATICALLY INCREASED ROTATION SPEED
    boat.rotation.y += turnEffect * deltaTime * SHIP_CONFIG.turnSpeedMultiplier;

    // DRAMATICALLY REDUCED DRIFT for more arcade-like handling
    if (Math.abs(turnEffect) > 0.1 && currentSpeed > SHIP_CONFIG.minTurnDriftSpeed) {
        const driftDirection = new THREE.Vector3(shipHeading.z, 0, -shipHeading.x);
        driftDirection.normalize().multiplyScalar(turnEffect * currentSpeed * SHIP_CONFIG.turnDriftAmount);
        accelerationForce.add(driftDirection);
    }

    // DRAMATICALLY INCREASED WATER RESISTANCE for less "icy" feel
    const resistanceForce = boatVelocity.clone().normalize().multiplyScalar(
        -SHIP_CONFIG.waterResistance * currentSpeed * currentSpeed
    );
    accelerationForce.add(resistanceForce);

    // Calculate acceleration (F = ma)
    const acceleration = accelerationForce.divideScalar(SHIP_CONFIG.mass);

    // Apply acceleration with force multiplier
    boatVelocity.add(acceleration.multiplyScalar(deltaTime * 60 *
        (shipSpeedConfig.speedMultiplier > 1.0 ? Math.sqrt(shipSpeedConfig.speedMultiplier) : 1.0)));

    // Maximum speed logic
    const playerMaxSpeed = shipSpeedConfig.basePlayerSpeed * shipSpeedConfig.speedMultiplier;
    const knockbackMaxSpeed = shipSpeedConfig.baseKnockbackSpeed * shipSpeedConfig.speedMultiplier;
    const maxSpeed = keys.forward || keys.backward ? playerMaxSpeed * (keys.forward ? 1 : 0.5) : knockbackMaxSpeed;

    const currentSpeedValue = boatVelocity.length();
    if (currentSpeedValue > maxSpeed) {
        // Hard cap at maximum speed
        boatVelocity.normalize().multiplyScalar(maxSpeed);


        if (shipSpeedConfig.speedMultiplier > 1.0 && window.showSpeedBoostEffect) {
            window.showSpeedBoostEffect(shipSpeedConfig.speedMultiplier);
        }
    }

    // Minimal wind drift
    const windDriftAmount = SHIP_CONFIG.windDriftStrength * deltaTime;
    const windDrift = windVector.clone().multiplyScalar(windDriftAmount);
    boatVelocity.add(windDrift);

    // Update knockback timer if active
    if (knockbackActive) {
        knockbackTimer -= deltaTime;
        if (knockbackTimer <= 0) {
            knockbackActive = false;
        }
    }

    // DRAMATICALLY IMPROVED DECELERATION when not accelerating
    if (!keys.forward && !keys.backward && !knockbackActive) {
        // Much stronger damping for quick deceleration
        boatVelocity.multiplyScalar(SHIP_CONFIG.normalDampingFactor);

        // Even stronger damping at low speeds for quick stopping
        if (currentSpeed < SHIP_CONFIG.lowSpeedThreshold) {
            boatVelocity.multiplyScalar(SHIP_CONFIG.lowSpeedDampingFactor);
        }
    }

    // Return calculated velocity
    return boatVelocity;
}

// Update existing updateAllPlayers function to store the players data
export function updateAllPlayers(players) {
    allPlayers = players;
    console.log("🌍 GAME STATE: All players updated:", allPlayers);
    return allPlayers;
}

// Add this new function to return the stored players
export function getAllPlayers() {
    return allPlayers;
}

// Add these scene management functions
export function addToScene(object) {
    console.log(`Adding object to scene: ${object.name || 'unnamed object'}`);
    scene.add(object);
    return object;
}

export function removeFromScene(object) {
    if (!object) {
        console.warn("Attempted to remove null or undefined object from scene");
        return false;
    }

    if (object.parent !== scene) {
        console.warn(`Object ${object.name || 'unnamed'} is not a direct child of scene`);
        return false;
    }

    console.log(`Removing object from scene: ${object.name || 'unnamed object'}`);
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

// Modify the applyShipKnockback function
export function applyShipKnockback(direction, force = 1.0, options = {}) {
    // Default options
    const defaults = {
        resetVelocity: true,       // Whether to zero out current velocity first
        maxSpeed: shipSpeedConfig.baseKnockbackSpeed, // Max speed cap for knockback
        bounceFactor: 0.3,         // How "bouncy" the knockback feels (0-1)
        dampingFactor: 0.3,        // CHANGED: No damping (was 0.1)
        knockbackDuration: 0.3     // How long knockback immunity lasts (seconds)
    };

    // Merge provided options with defaults
    const settings = { ...defaults, ...options };

    // Normalize the direction vector
    const knockbackDir = direction.clone().normalize();

    // Calculate knockback velocity based on force (significantly increase force)
    const knockbackVelocity = knockbackDir.multiplyScalar(force * 5.0); // Multiplied by 5x

    // If we should reset velocity first (for hard collisions)
    if (settings.resetVelocity) {
        // First, calculate the component of current velocity in the knockback direction
        const currentVelocityInKnockbackDir = boatVelocity.dot(knockbackDir);

        // Only reset if we're moving toward the collision point
        if (currentVelocityInKnockbackDir < 0) {
            // Zero out velocity before applying knockback
            boatVelocity.set(0, 0, 0);
        }
    }

    // Add knockback force to velocity (scaled by bounce factor)
    boatVelocity.add(knockbackVelocity.multiplyScalar(settings.bounceFactor));

    // Apply speed limit to prevent excessive knockback
    const currentSpeed = boatVelocity.length();
    if (currentSpeed > settings.maxSpeed) {
        boatVelocity.multiplyScalar(settings.maxSpeed / currentSpeed);
    }

    // Set knockback flag and timer
    knockbackActive = true;
    knockbackTimer = settings.knockbackDuration;

    console.log(`🚢 KNOCKBACK applied! Force: ${force}, Speed: ${boatVelocity.length().toFixed(2)}`);

    return boatVelocity.clone(); // Return the new velocity for reference
}

// Add this with your other global variables
let lastIslandCollisionTime = 0;
const ISLAND_COLLISION_COOLDOWN = 1.0; // Seconds between collision responses

// Add this function to gameState.js
export function checkAndHandleIslandCollisions() {
    // Skip if too soon after last collision
    const currentTime = getTime() / 1000;
    if (currentTime - lastIslandCollisionTime < ISLAND_COLLISION_COOLDOWN) {
        return;
    }

    // Get ship position and velocity
    const shipPosition = boat.position.clone();
    const currentSpeed = boatVelocity.length();

    // Check for collision with any islands (add extra radius for early detection)
    if (checkAllIslandCollisions(shipPosition, 2)) {
        console.log("🏝️ ISLAND COLLISION DETECTED!");

        // Calculate direction vector away from island
        // Since we don't have the exact island center, use the negative of current velocity 
        // and add significant upward component to create "flying" effect
        const bounceDirection = new THREE.Vector3();

        if (currentSpeed > 0.1) {
            // If we have significant speed, bounce opposite to our direction of travel
            bounceDirection.copy(boatVelocity).negate().normalize();
        } else {
            // If very slow or stopped, just bounce backward relative to boat orientation
            bounceDirection.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), boat.rotation.y);
        }

        // Add significant upward component to create "flying" effect
        bounceDirection.y = 1.5; // Strong upward component
        bounceDirection.normalize();

        // Force depends on impact speed - faster impact = stronger bounce
        const impactForce = Math.max(2.0, Math.min(5.0, currentSpeed * 10));

        // Apply knockback with custom parameters
        applyShipKnockback(bounceDirection, impactForce, {
            resetVelocity: true,      // Cancel existing velocity
            bounceFactor: 1.2,        // Extra bouncy
            dampingFactor: 0.6,       // Slow damping
            knockbackDuration: 1.2    // Long knockback effect
        });

        // Set collision time to prevent rapid multiple collisions
        lastIslandCollisionTime = currentTime;

        // Optional: Add camera shake or other effects
        if (window.shakeCamera) {
            window.shakeCamera(0.5, 0.8); // Intensity, duration
        }

        return true; // Collision handled
    }

    return false; // No collision
}