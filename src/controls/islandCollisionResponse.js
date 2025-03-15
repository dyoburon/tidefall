import * as THREE from 'three';
import { boat, boatVelocity, scene } from '../core/gameState.js';
import { checkAllIslandCollisions } from '../world/islands.js';

// Physics configuration - WITH DEBUG ENABLED
const COLLISION_CONFIG = {
    minBounceSpeed: 0.3,        // Minimum speed to trigger any bounce
    minAirborneSpeed: 3.0,      // User-specified threshold for flight
    bounceMultiplier: 4.0,      // Increased for dramatic parabolic flight
    restitution: 0.9,           // Higher bounciness 
    gravity: 9.8,               // Gravity acceleration
    terminalVelocity: 15,       // Maximum falling speed
    rotationEffect: 0.05,       // Boat rotation during flight
    landingDamping: 0.7,        // Velocity loss on landing
    debugMode: true,            // FORCE DEBUG ON
    extraCollisionRadius: 4,    // Larger collision detection radius
    lookAheadFactor: 1.5,       // INCREASED look-ahead for collision prevention
    emergencyEscapeForce: 10.0, // Force to escape when stuck
    stuckDetectionTime: 500,    // Ms to determine if boat is stuck
    velocityThreshold: 0.1      // Threshold to consider boat "stuck"
};

// State management for flight
let isAirborne = false;         // In air flag
let verticalVelocity = 0;       // Vertical speed
let originalRotation = null;    // Pre-collision rotation
let collisionTime = 0;          // Collision timestamp
let debugFrameCounter = 0;      // For periodic logging
let stuckFrames = 0;            // Stuck detection counter
let lastPosition = null;        // Track position changes
let frameDurations = [];        // Track performance
let lastCollisionCheck = 0;     // Throttle collision checks
let lastCollisionResult = null; // Store last collision result

// Initialize the collision response system with extensive logging
export function initCollisionResponse() {
    // Initialize position tracking
    lastPosition = boat.position.clone();

    // Export global flags for main.js
    window.boatInParabolicFlight = false;
    window.collisionDebugActive = COLLISION_CONFIG.debugMode;

    return {
        updateCollisionResponse
    };
}

// Debug helper that logs only every N frames to avoid console spam
function periodicDebugLog(message, data = null, forcePrint = false) {
    if (!COLLISION_CONFIG.debugMode) return;

    // Log important messages regardless of counter
    if (forcePrint) {
        if (data) {

        } else {

        }
        return;
    }

    // Otherwise log every 60 frames (about once per second)
    if (debugFrameCounter % 60 === 0) {
        if (data) {

        } else {

        }
    }
}

// Enhanced collision detection with logging
function checkForUpcomingCollision() {
    const startTime = performance.now();

    // Throttle collision checks for performance (max 5 per second)
    const now = performance.now();
    if (now - lastCollisionCheck < 200 && lastCollisionResult) {
        periodicDebugLog("⏱️ Using cached collision result", lastCollisionResult.hit);
        return lastCollisionResult;
    }

    lastCollisionCheck = now;

    // Skip if already airborne
    if (isAirborne) {
        periodicDebugLog("🛫 Skipping collision check - already airborne");
        return null;
    }

    // Get the boat's current velocity and speed
    const speed = boatVelocity.length();

    // Skip if barely moving
    if (speed < 0.1) {
        periodicDebugLog("🐌 Boat too slow for collision check", speed);
        return null;
    }

    // Create a look-ahead vector based on velocity
    const lookAheadDistance = speed * COLLISION_CONFIG.lookAheadFactor;
    const lookAheadVector = boatVelocity.clone().normalize().multiplyScalar(lookAheadDistance);

    // Get the boat's future position
    const futurePosition = boat.position.clone().add(lookAheadVector);

    // Log look-ahead values
    periodicDebugLog("👀 Look-ahead check: distance=" + lookAheadDistance.toFixed(2) +
        ", future=(" + futurePosition.x.toFixed(1) + "," +
        futurePosition.y.toFixed(1) + "," +
        futurePosition.z.toFixed(1) + ")");

    // Check if future position is inside an island
    const collision = checkAllIslandCollisions(futurePosition, COLLISION_CONFIG.extraCollisionRadius);
    lastCollisionResult = collision;

    const endTime = performance.now();
    periodicDebugLog("⏱️ Collision check took " + (endTime - startTime).toFixed(2) + "ms");

    return collision;
}

// Check if boat is stuck (not moving despite having velocity)
function checkIfStuck() {
    if (!lastPosition) return false;

    const positionDelta = boat.position.distanceTo(lastPosition);
    const velocity = boatVelocity.length();

    // If we have velocity but position barely changed, increment stuck counter
    if (velocity > COLLISION_CONFIG.velocityThreshold && positionDelta < 0.01) {
        stuckFrames++;

        if (stuckFrames > 10) {
            console.log("🚨 Boat is stuck! Stuck frames:", stuckFrames,
                ", movement=" + positionDelta.toFixed(5),
                "background:red; color:white; padding:3px; border-radius:3px;");
            return true;
        }
    } else {
        // Reset stuck counter if we're moving normally
        stuckFrames = 0;
    }

    lastPosition.copy(boat.position);
    return false;
}

// Apply emergency escape maneuver when stuck
function emergencyEscape() {


    // Strong upward velocity
    verticalVelocity = COLLISION_CONFIG.emergencyEscapeForce;

    // Random horizontal direction to escape
    const angle = Math.random() * Math.PI * 2;
    boatVelocity.set(
        Math.cos(angle) * COLLISION_CONFIG.emergencyEscapeForce * 0.5,
        0,
        Math.sin(angle) * COLLISION_CONFIG.emergencyEscapeForce * 0.5
    );

    // Set airborne state
    isAirborne = true;
    window.boatInParabolicFlight = true;
    collisionTime = performance.now();

    // Save rotation
    originalRotation = new THREE.Euler(
        boat.rotation.x, boat.rotation.y, boat.rotation.z
    );

    // Force position above water
    boat.position.y = 1.0;

    // Reset stuck counter
    stuckFrames = 0;
}

// Handle the parabolic flight after collision
function executeParabolicFlight(deltaTime) {
    // Start with detailed logging
    periodicDebugLog("🛫 In parabolic flight, h=" + boat.position.y.toFixed(2) +
        ", v=" + verticalVelocity.toFixed(2) +
        ", vx=" + boatVelocity.x.toFixed(2) +
        ", vz=" + boatVelocity.z.toFixed(2));

    // Apply gravity to vertical velocity
    const prevVelocity = verticalVelocity;
    verticalVelocity -= COLLISION_CONFIG.gravity * deltaTime;

    // Log gravity effects
    periodicDebugLog("⬇️ Gravity applied: " + prevVelocity.toFixed(2) + " → " + verticalVelocity.toFixed(2));

    // Limit falling speed
    if (verticalVelocity < -COLLISION_CONFIG.terminalVelocity) {
        verticalVelocity = -COLLISION_CONFIG.terminalVelocity;
        periodicDebugLog("⚠️ Terminal velocity reached", verticalVelocity);
    }

    // Store original Y before update for logging
    const originalY = boat.position.y;

    // Update boat's vertical position with clear logging
    boat.position.y += verticalVelocity * deltaTime;

    // Log position change
    periodicDebugLog("📏 Y-position: " + originalY.toFixed(2) + " → " + boat.position.y.toFixed(2) +
        " (Δ=" + (verticalVelocity * deltaTime).toFixed(2) + ")");

    // Apply pitch and roll based on flight
    if (originalRotation) {
        // Forward/backward tilt based on vertical motion
        const pitchAngle = -verticalVelocity * 0.02;
        boat.rotation.x = originalRotation.x + pitchAngle;

        // Add slight roll for visual interest
        const flightTime = (performance.now() - collisionTime) / 1000;
        const rollAngle = Math.sin(flightTime * 2) * 0.1;
        boat.rotation.z = originalRotation.z + rollAngle;

        periodicDebugLog("🔄 Applied pitch=" + pitchAngle.toFixed(3) + ", roll=" + rollAngle.toFixed(3));
    }

    // Check if we've hit the water
    if (boat.position.y <= 0.5 && verticalVelocity < 0) {




        // Land the boat
        boat.position.y = 0.5;

        // Reset flags
        isAirborne = false;
        window.boatInParabolicFlight = false;

        // Apply landing impact to velocity (slow down a bit when landing)
        const oldSpeed = boatVelocity.length();
        boatVelocity.multiplyScalar(COLLISION_CONFIG.landingDamping);
        const newSpeed = boatVelocity.length();



        // Reset rotation
        if (originalRotation) {
            boat.rotation.x = originalRotation.x;
            boat.rotation.z = originalRotation.z;

        }
    }

    // Check for islands while airborne (can hit mountains!)
    if (performance.now() - lastCollisionCheck > 500) {
        const airborneCollision = checkAllIslandCollisions(boat.position, 2);
        if (airborneCollision && airborneCollision.hit) {


            // Calculate bounce normal
            const normal = new THREE.Vector3().subVectors(
                boat.position, airborneCollision.position
            ).normalize();

            // Add upward component to bounce
            normal.y += 0.5;
            normal.normalize();

            // Apply bounce
            const bounceForce = 5.0;
            boatVelocity.reflect(normal).multiplyScalar(0.8);
            verticalVelocity = Math.max(verticalVelocity, bounceForce);


        }
        lastCollisionCheck = performance.now();
    }
}

// The main update function called each frame - now with comprehensive logging
export function updateCollisionResponse(deltaTime) {
    const startTime = performance.now();

    // Track frames for periodic logging
    debugFrameCounter++;

    // Skip if delta time is invalid
    if (!deltaTime || deltaTime > 0.1) {
        periodicDebugLog("⏱️ Skipping frame - invalid deltaTime: " + deltaTime, null, true);
        return;
    }

    // Basic state info logging every ~1 second
    if (debugFrameCounter % 60 === 0) {
    }

    // Check if boat is stuck against an island
    const isStuck = checkIfStuck();
    if (isStuck) {
        emergencyEscape();
    }

    // If already in parabolic flight, continue it
    if (isAirborne) {
        executeParabolicFlight(deltaTime);
        return;
    }

    // Check for upcoming collisions
    const collision = checkForUpcomingCollision();

    if (collision && collision.hit) {
        // Check if we're going fast enough to trigger parabolic flight
        const speed = boatVelocity.length();

        // Log detailed collision information







        if (speed >= COLLISION_CONFIG.minAirborneSpeed) {
            // Calculate the normal vector from island center to boat
            const normalVector = new THREE.Vector3().subVectors(
                boat.position, collision.position
            ).normalize();



            // Save original rotation
            originalRotation = new THREE.Euler(
                boat.rotation.x, boat.rotation.y, boat.rotation.z
            );

            // Calculate launch velocity based on speed
            const launchSpeed = (speed - COLLISION_CONFIG.minAirborneSpeed) * COLLISION_CONFIG.bounceMultiplier;
            verticalVelocity = 5.0 + launchSpeed;  // Minimum upward velocity + speed boost



            // Reflect horizontal velocity based on collision normal
            const oldVelocity = boatVelocity.clone();
            reflectVelocityFromIsland(normalVector, speed);

            console.log("   Velocity changed:",
                "(" + oldVelocity.x.toFixed(2) + "," + oldVelocity.z.toFixed(2) + ")",
                "→",
                "(" + boatVelocity.x.toFixed(2) + "," + boatVelocity.z.toFixed(2) + ")");

            // Set flags
            isAirborne = true;
            window.boatInParabolicFlight = true;
            collisionTime = performance.now();


        } else {
            // Not fast enough for flight, just bounce
            const normalVector = new THREE.Vector3().subVectors(
                boat.position, collision.position
            ).normalize();



            // Simple bounce at slower speeds
            const oldVelocity = boatVelocity.clone();
            reflectVelocityFromIsland(normalVector, speed);

        }
    }

    // Performance tracking
    const endTime = performance.now();
    const duration = endTime - startTime;
    frameDurations.push(duration);

    // Log performance every ~5 seconds
    if (debugFrameCounter % 300 === 0) {
        const avgDuration = frameDurations.reduce((sum, val) => sum + val, 0) / frameDurations.length;

        frameDurations = []; // Reset for next batch
    }
}

// Helper function to reflect velocity off an island with enhanced logging
function reflectVelocityFromIsland(normal, speed) {
    // Log initial state
    const initialVelocity = boatVelocity.clone();

    // Calculate reflection angle
    const dot = boatVelocity.dot(normal);






    // NEW BEHAVIOR: For standard speed (around 1.2), do a simple small bounce
    // in the opposite direction of travel
    if (speed < COLLISION_CONFIG.minAirborneSpeed && speed > 0.5) {


        // Reverse the velocity direction (opposite of travel)
        const reverseDirection = boatVelocity.clone().negate();

        // Scale down to make it a small bounce (25% of original speed)
        const bounceForce = 0.25;
        reverseDirection.multiplyScalar(bounceForce);

        // Apply the simple bounce
        boatVelocity.copy(reverseDirection);

        console.log("     Simple bounce applied, new velocity:",
            boatVelocity.x.toFixed(2), boatVelocity.y.toFixed(2), boatVelocity.z.toFixed(2));
        return;
    }

    // Rest of the original code for other speeds
    if (dot < 0) {
        // Basic reflection formula: v' = v - 2(v·n)n
        const reflection = boatVelocity.clone().sub(
            normal.clone().multiplyScalar(2 * dot)
        );

        // Log reflection calculation


        // Apply some energy loss in the reflection
        boatVelocity.copy(reflection.multiplyScalar(COLLISION_CONFIG.restitution));

        // Log after energy loss


        // Add extra push away from island to prevent getting stuck
        const pushForce = normal.clone().multiplyScalar(0.8 + Math.random() * 0.4);
        boatVelocity.add(pushForce);



    } else {


        // Already moving away, just add more push
        const pushForce = normal.clone().multiplyScalar(1.0 + Math.random() * 0.5);
        boatVelocity.add(pushForce);



    }
}

// Public function to check if boat is airborne
export function isBoatAirborne() {
    return isAirborne;
} 