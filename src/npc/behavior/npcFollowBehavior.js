import * as THREE from 'three';
import { boat, getTime } from '../../core/gameState.js';
import { debugLog } from '../../utils/debug.js';

// Configuration for follow behavior
const FOLLOW_CONFIG = {
    // Base movement parameters
    moveSpeed: 13.0,         // Slightly faster than default NPC_SHIP_CONFIG to catch up to player
    turnSpeed: 0.04,          // Increased turning for better pursuit

    // Follow behavior parameters
    minFollowDistance: 40,    // Minimum distance to maintain from player
    maxFollowDistance: 80,    // Maximum distance before accelerating to catch up
    optimalRange: 60,         // Optimal combat distance to maintain

    // Randomness parameters
    positionVariance: 30,     // Maximum randomness in target position
    directionChangeTime: 2.0, // Seconds between direction changes

    // Orbiting behavior
    orbitEnabled: true,       // Whether ships should orbit the player
    orbitChance: 0.6,         // Chance to orbit vs direct approach
    orbitSpeed: 0.4,          // Speed of orbit movement

    // Advanced behavior
    adaptiveSpeed: true,      // Adjust speed based on distance
    useFlocking: false,       // Consider other NPC ships (for future implementation)

    // Debug settings
    debugVisuals: false,       // Show debug paths and markers
    debugLevel: 1,            // 0=none, 1=minimal, 2=verbose
};

/**
 * NPC Ship Follow Behavior
 * Controls how NPC ships follow and maneuver around the player during combat
 */
class NpcFollowBehavior {
    constructor() {
        // Current behavior state
        this.activeFollows = new Map(); // Map of NPC IDs to their follow state
        this.lastUpdateTime = getTime();

        // Debug visualization
        this.debugMarkers = new Map();


    }

    /**
     * Initialize follow behavior for an NPC ship
     * @param {Object} npcShip - The NPC ship to control
     * @returns {Object} The follow state
     */
    initializeFollow(npcShip) {
        if (!npcShip || !npcShip.id) {

            return null;
        }

        // Check if already following
        if (this.activeFollows.has(npcShip.id)) {
            return this.activeFollows.get(npcShip.id);
        }

        // Create initial follow state
        const followState = {
            npcId: npcShip.id,
            isFollowing: true,
            targetPosition: null,
            lastDirectionChange: getTime(),
            followMode: Math.random() < FOLLOW_CONFIG.orbitChance ? 'orbit' : 'direct',
            orbitAngle: Math.random() * Math.PI * 2, // Random starting angle
            orbitDirection: Math.random() < 0.5 ? 1 : -1, // Clockwise or counter-clockwise
            lastTargetDistance: 0,
            debugPathLine: null
        };

        // Store follow state
        this.activeFollows.set(npcShip.id, followState);

        debugLog(`Initialized follow behavior for NPC ${npcShip.id} in ${followState.followMode} mode`, 1);

        // Create debug visualization if enabled
        if (FOLLOW_CONFIG.debugVisuals) {
            this.createDebugVisuals(npcShip, followState);
        }

        return followState;
    }

    /**
     * Create debug visualizations for the follow behavior
     * @param {Object} npcShip - The NPC ship
     * @param {Object} followState - The follow state
     */
    createDebugVisuals(npcShip, followState) {
        // Create path line from ship to target
        const lineGeometry = new THREE.BufferGeometry();
        const linePoints = [
            npcShip.position.clone(),
            npcShip.position.clone().add(new THREE.Vector3(10, 0, 0)) // Temporary end point
        ];
        lineGeometry.setFromPoints(linePoints);

        const pathMaterial = new THREE.LineBasicMaterial({ color: 0xff00ff });
        followState.debugPathLine = new THREE.Line(lineGeometry, pathMaterial);

        // Add to scene via npcShip's scene access
        if (npcShip.shipGroup && npcShip.shipGroup.parent) {
            npcShip.shipGroup.parent.add(followState.debugPathLine);
        }
    }

    /**
     * Update debug visualizations
     * @param {Object} npcShip - The NPC ship
     * @param {Object} followState - The follow state
     * @param {THREE.Vector3} targetPos - The current target position
     */
    updateDebugVisuals(npcShip, followState, targetPos) {
        if (!FOLLOW_CONFIG.debugVisuals || !followState.debugPathLine) return;

        // Update path line
        const linePoints = [npcShip.position.clone(), targetPos.clone()];
        followState.debugPathLine.geometry.dispose();
        followState.debugPathLine.geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    }

    /**
     * Stop following for an NPC ship
     * @param {Object} npcShip - The NPC ship to stop following with
     */
    stopFollowing(npcShip) {
        if (!npcShip || !npcShip.id) return;

        const followState = this.activeFollows.get(npcShip.id);
        if (!followState) return;

        // Clean up debug visuals
        if (followState.debugPathLine) {
            if (followState.debugPathLine.parent) {
                followState.debugPathLine.parent.remove(followState.debugPathLine);
            }
            followState.debugPathLine.geometry.dispose();
            followState.debugPathLine.material.dispose();
        }

        // Remove from active follows
        this.activeFollows.delete(npcShip.id);

        debugLog(`Stopped follow behavior for NPC ${npcShip.id}`, 1);
    }

    /**
     * Update follow behavior for an NPC ship
     * @param {Object} npcShip - The NPC ship to update
     * @param {number} deltaTime - Time since last update
     * @returns {boolean} - Whether follow behavior is active
     */
    updateFollow(npcShip, deltaTime) {
        if (!npcShip || !npcShip.id) return false;
        if (!boat) return false;

        // Get follow state or initialize if not exists
        let followState = this.activeFollows.get(npcShip.id);
        if (!followState) {
            followState = this.initializeFollow(npcShip);
        }

        // Make sure we have valid follow state
        if (!followState || !followState.isFollowing) return false;

        // Get current time
        const currentTime = getTime();

        // Calculate distance to player
        const distanceToPlayer = npcShip.position.distanceTo(boat.position);
        followState.lastTargetDistance = distanceToPlayer;

        // Determine if it's time to change directions
        const shouldChangeDirection =
            (currentTime - followState.lastDirectionChange) > FOLLOW_CONFIG.directionChangeTime;

        // Calculate target position based on follow mode
        let targetPosition;

        if (shouldChangeDirection) {
            // Occasionally switch between orbit and direct follow modes
            if (Math.random() < 0.3) {
                followState.followMode = Math.random() < FOLLOW_CONFIG.orbitChance ? 'orbit' : 'direct';
                debugLog(`NPC ${npcShip.id} changing follow mode to ${followState.followMode}`, 2);
            }

            // For orbit mode, occasionally change orbit direction
            if (followState.followMode === 'orbit' && Math.random() < 0.2) {
                followState.orbitDirection *= -1;
                debugLog(`NPC ${npcShip.id} changing orbit direction`, 2);
            }

            followState.lastDirectionChange = currentTime;
        }

        if (followState.followMode === 'orbit' && FOLLOW_CONFIG.orbitEnabled) {
            // Orbit around player at varying distance

            // Update orbit angle
            followState.orbitAngle += FOLLOW_CONFIG.orbitSpeed * deltaTime * followState.orbitDirection;

            // Calculate orbit position
            const orbitDistance = FOLLOW_CONFIG.optimalRange +
                (Math.random() * FOLLOW_CONFIG.positionVariance * 0.5);

            targetPosition = new THREE.Vector3(
                boat.position.x + Math.cos(followState.orbitAngle) * orbitDistance,
                0,
                boat.position.z + Math.sin(followState.orbitAngle) * orbitDistance
            );

            debugLog(`NPC ${npcShip.id} orbiting at angle ${followState.orbitAngle.toFixed(2)}`, 2);
        } else {
            // Direct approach with randomness

            // Direction from ship to player
            const dirToPlayer = new THREE.Vector3()
                .subVectors(boat.position, npcShip.position)
                .normalize();

            // Calculate randomized target offset
            const randomOffsetX = (Math.random() - 0.5) * FOLLOW_CONFIG.positionVariance;
            const randomOffsetZ = (Math.random() - 0.5) * FOLLOW_CONFIG.positionVariance;

            // Calculate optimal distance to maintain
            let targetDistance;
            if (distanceToPlayer < FOLLOW_CONFIG.minFollowDistance) {
                // Too close, back off
                targetDistance = FOLLOW_CONFIG.optimalRange;
            } else if (distanceToPlayer > FOLLOW_CONFIG.maxFollowDistance) {
                // Too far, get closer
                targetDistance = FOLLOW_CONFIG.optimalRange * 0.8;
            } else {
                // In the good range, maintain optimal distance
                targetDistance = FOLLOW_CONFIG.optimalRange;
            }

            // Calculate target position with randomness
            targetPosition = new THREE.Vector3()
                .addVectors(
                    boat.position,
                    dirToPlayer.clone().multiplyScalar(-targetDistance)
                );

            // Add randomness
            targetPosition.x += randomOffsetX;
            targetPosition.z += randomOffsetZ;

            debugLog(`NPC ${npcShip.id} direct following at distance ${distanceToPlayer.toFixed(0)}`, 2);
        }

        // Ensure target position is at water level
        targetPosition.y = 0;

        // Store target position
        followState.targetPosition = targetPosition;

        // Update debug visuals
        this.updateDebugVisuals(npcShip, followState, targetPosition);

        // Apply movement to reach the target position
        this.moveTowardsTarget(npcShip, targetPosition, distanceToPlayer, deltaTime);

        return true;
    }

    /**
     * Move the NPC ship towards the target position
     * @param {Object} npcShip - The NPC ship to move
     * @param {THREE.Vector3} targetPosition - The target position
     * @param {number} distanceToPlayer - Current distance to player
     * @param {number} deltaTime - Time since last update
     */
    moveTowardsTarget(npcShip, targetPosition, distanceToPlayer, deltaTime) {
        // Direction to target
        const direction = new THREE.Vector3()
            .subVectors(targetPosition, npcShip.position)
            .normalize();

        // Calculate target rotation (yaw only - around Y axis)
        // Add PI (180 degrees) to make ships face the direction they're moving
        const targetRotation = Math.atan2(direction.x, direction.z) + Math.PI;

        // Calculate how direct of a turn we need to make
        const rotationDiff = this.normalizeAngle(targetRotation - npcShip.rotation.y);

        // Calculate turn amount, slowing down when making sharp turns
        const turnAmount = rotationDiff * FOLLOW_CONFIG.turnSpeed * deltaTime * 60;
        npcShip.rotation.y += turnAmount;

        // Adjust speed based on turn sharpness and distance
        const turnSharpness = Math.abs(rotationDiff) / Math.PI; // 0 to 1 scale
        let speedFactor = 1.0 - (turnSharpness * 0.7); // Reduce to 30% speed in sharpest turns

        // Adjust speed based on distance to player if adaptive speed is enabled
        if (FOLLOW_CONFIG.adaptiveSpeed) {
            if (distanceToPlayer > FOLLOW_CONFIG.maxFollowDistance) {
                // Too far, speed up to catch player
                speedFactor *= 1.2;
            } else if (distanceToPlayer < FOLLOW_CONFIG.minFollowDistance) {
                // Too close, slow down
                speedFactor *= 0.5;
            }
        }

        // Create forward vector based on current rotation
        // Use opposite direction (forward is actually backward for the model)
        const forwardVector = new THREE.Vector3(0, 0, -1)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), npcShip.rotation.y);

        // Apply speed, adjusted for turning
        const adjustedSpeed = FOLLOW_CONFIG.moveSpeed * speedFactor;
        npcShip.velocity.copy(forwardVector).multiplyScalar(adjustedSpeed * deltaTime);
        npcShip.position.add(npcShip.velocity);

        // Optional: log movement details at lower frequency
        if (Math.random() < 0.01) {
            debugLog(`NPC ${npcShip.id} following at speed ${adjustedSpeed.toFixed(1)} (factor: ${speedFactor.toFixed(2)})`, 2);
        }
    }

    /**
     * Helper function to normalize an angle between -PI and PI
     * @param {number} angle - Angle in radians
     * @returns {number} Normalized angle
     */
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    }

    /**
     * Check if a ship is currently following
     * @param {string} npcId - The NPC ship ID
     * @returns {boolean} Whether the ship is following
     */
    isFollowing(npcId) {
        return this.activeFollows.has(npcId);
    }

    /**
     * Update all active follows
     * @param {number} deltaTime - Time since last update
     */
    updateAllFollows(deltaTime) {
        // Skip if there are no active follows
        if (this.activeFollows.size === 0) return;

        // Update each follow
        for (const [npcId, followState] of this.activeFollows.entries()) {
            // Find the NPC ship from the activeNpcShips array
            // This requires access to the activeNpcShips array from npcShip.js
            // For now, this is a placeholder that will be implemented when connected
        }
    }
}

// Create singleton instance
const npcFollowBehavior = new NpcFollowBehavior();

/**
 * Start follow behavior for an NPC ship
 * @param {Object} npcShip - The NPC ship to follow with
 * @returns {boolean} Whether follow was successfully started
 */
export function startNpcFollow(npcShip) {
    if (!npcShip) return false;

    const followState = npcFollowBehavior.initializeFollow(npcShip);
    return !!followState;
}

/**
 * Stop follow behavior for an NPC ship
 * @param {Object} npcShip - The NPC ship to stop following with
 */
export function stopNpcFollow(npcShip) {
    if (!npcShip) return;
    npcFollowBehavior.stopFollowing(npcShip);
}

/**
 * Update follow behavior for an NPC ship
 * @param {Object} npcShip - The NPC ship to update
 * @param {number} deltaTime - Time since last update
 * @returns {boolean} - Whether follow behavior is active
 */
export function updateNpcFollow(npcShip, deltaTime) {
    return npcFollowBehavior.updateFollow(npcShip, deltaTime);
}

/**
 * Check if an NPC ship is currently following
 * @param {Object} npcShip - The NPC ship to check
 * @returns {boolean} Whether the ship is following
 */
export function isNpcFollowing(npcShip) {
    if (!npcShip || !npcShip.id) return false;
    return npcFollowBehavior.isFollowing(npcShip.id);
}

// Export the singleton for direct access
export default npcFollowBehavior; 