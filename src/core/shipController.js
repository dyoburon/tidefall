import * as THREE from 'three';
import { boat, boatVelocity, keys, getWindData, getTime } from './gameState.js';
import { checkAllIslandCollisions } from '../world/islands.js';



// Add this near your other exports
export let knockbackActive = false;
export let knockbackTimer = 0;



// Add these variables near the top with other exports
export const shipSpeedConfig = {
    basePlayerSpeed: 0.5,     // Normal max speed when player is controlling
    baseKnockbackSpeed: 2,   // Max speed when not player-controlled (like knockbacks)
    speedMultiplier: 1.0       // Multiplier that can be adjusted by /speed command
};


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

// Update the momentum variables at the top
let momentumActive = false;
let momentumMultiplier = 1.0;
let momentumDecayRate = 0.5;
let originalSpeedMultiplier = 1.0; // Store original multiplier

/**
 * Preserves current momentum by gradually decreasing speed from current value
 * @param {number} fromMultiplier - The speed multiplier we're coming from
 * @param {number} toMultiplier - The target multiplier to decay to
 * @param {number} decayDuration - How long the decay should take (seconds)
 */
export function preserveMomentum(fromMultiplier, toMultiplier, decayDuration = 1.5) {
    // Store the current and target speed multipliers
    momentumMultiplier = fromMultiplier;
    originalSpeedMultiplier = toMultiplier;

    // Calculate decay rate based on the difference and duration
    momentumDecayRate = (fromMultiplier - toMultiplier) / decayDuration;

    // Activate momentum preservation
    momentumActive = true;

    console.log(`🚀 Preserving momentum: ${fromMultiplier.toFixed(2)} → ${toMultiplier.toFixed(2)} over ${decayDuration.toFixed(1)}s`);
}

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

    // Process momentum decay if active
    if (momentumActive) {
        // Decay the momentum multiplier
        momentumMultiplier -= momentumDecayRate * deltaTime;

        // Check if we've reached or gone below the target multiplier
        if (momentumMultiplier <= originalSpeedMultiplier) {
            // End momentum and restore original multiplier
            momentumActive = false;
            momentumMultiplier = originalSpeedMultiplier;
            shipSpeedConfig.speedMultiplier = originalSpeedMultiplier;
            console.log("🚀 Momentum fully decayed, speed restored to", originalSpeedMultiplier.toFixed(2));
        } else {
            // Set the current speed multiplier to the decaying momentum value
            shipSpeedConfig.speedMultiplier = momentumMultiplier;
        }
    }

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