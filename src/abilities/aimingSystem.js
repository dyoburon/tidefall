import * as THREE from 'three';
import { boat } from '../core/gameState.js';

/**
 * AimingSystem provides standardized functions for ability targeting and direction calculations
 * to ensure all abilities use the same aiming logic.
 */
export class AimingSystem {
    /**
     * Calculate the firing direction from a position to a target,
     * properly accounting for ship orientation and automatically adjusting
     * trajectory based on distance
     * 
     * @param {THREE.Vector3} sourcePosition - World position where the ability is fired from
     * @param {THREE.Vector3} targetPosition - World position that the player clicked
     * @param {Object} options - Additional options
     * @param {Number} options.minVerticalAngle - Minimum vertical angle in radians (default: -0.52 ~ -30°)
     * @param {Number} options.maxVerticalAngle - Maximum vertical angle in radians (default: 1.48 ~ 85°)
     * @param {Number} options.minVerticalComponent - Minimum Y component to ensure projectile isn't flat
     * @param {Number} options.adaptiveTrajectory - Whether to use distance-based trajectory (default: true)
     * @param {Number} options.minVerticalAdjust - Minimum vertical adjustment for close targets (default: 0.05)
     * @param {Number} options.maxVerticalAdjust - Maximum vertical adjustment for far targets (default: 0.45)
     * @param {Number} options.trajectoryRandomness - Random factor to apply to trajectory (default: 0)
     * @param {Boolean} options.allowDownwardShots - Whether to allow downward shots (default: true)
     * @returns {THREE.Vector3} Normalized firing direction vector
     */
    static calculateFiringDirection(sourcePosition, targetPosition, options = {}) {
        // Default options
        const {
            minVerticalAngle = -0.52,        // About -30 degrees
            maxVerticalAngle = 1.48,         // About 85 degrees
            minVerticalComponent = 0.02,     // Minimum Y component for mid/far shots
            adaptiveTrajectory = true,
            minVerticalAdjust = -0.15,       // CHANGED to negative for downward trajectory on close targets
            maxVerticalAdjust = 0.6,         // High arc for far targets
            minDistance = 5,                 // REDUCED to detect very close clicks
            maxDistance = 180,
            allowDownwardShots = true,       // NEW option to enable downward firing
            trajectoryRandomness = 0
        } = options;

        // IMPORTANT: Calculate the actual horizontal distance between points rather than using the direction
        // This ensures we're measuring the true ground distance for trajectory calculation
        const horizontalDistance = Math.sqrt(
            Math.pow(targetPosition.x - sourcePosition.x, 2) +
            Math.pow(targetPosition.z - sourcePosition.z, 2)
        );

        // Create the initial direction vector
        const rawDirection = new THREE.Vector3().subVectors(targetPosition, sourcePosition);
        const direction = rawDirection.clone().normalize();

        // Store original Y component to blend with our adjustment
        const originalY = direction.y;

        if (adaptiveTrajectory) {
            // For debugging - log the actual distance
            console.log(`Horizontal distance to target: ${horizontalDistance.toFixed(2)} units`);

            // Don't scale the distance - use it directly
            // This helps ensure we're using real-world measurements

            // Clamp distance to range and normalize to 0-1
            const clampedDistance = Math.max(minDistance, Math.min(horizontalDistance, maxDistance));
            const normalizedDistance = (clampedDistance - minDistance) / (maxDistance - minDistance);

            console.log(`Normalized distance (0-1): ${normalizedDistance.toFixed(2)}`);

            // Calculate the vertical adjustment with a more dramatic curve for close distances
            let verticalAdjustment;

            if (allowDownwardShots && normalizedDistance < 0.15) {
                // For very close targets (under 15% of max range), use a special downward curve
                // This creates a rapid transition from downward shots to flat shots
                // Map 0-0.15 normalized distance to -0.15 to +0.05 vertical adjustment
                verticalAdjustment = minVerticalAdjust +
                    (0.05 - minVerticalAdjust) * (normalizedDistance / 0.15);
            } else {
                // For normal distances, use our existing cubic curve
                // This gives a nice arc that increases dramatically with distance
                verticalAdjustment = Math.max(0.02,
                    minVerticalAdjust + (maxVerticalAdjust - minVerticalAdjust) *
                    Math.pow(normalizedDistance, 3));
            }

            // Apply randomness if specified
            if (trajectoryRandomness > 0) {
                const randomFactor = 1 - (trajectoryRandomness / 2) + Math.random() * trajectoryRandomness;
                verticalAdjustment *= randomFactor;
            }

            console.log(`Vertical adjustment: ${verticalAdjustment.toFixed(2)}`);

            // IMPORTANT CHANGE: Don't add to direction.y, REPLACE it
            // This ensures our adjustment isn't diluted by normalization
            direction.y = verticalAdjustment;

            // Renormalize after changing the Y component
            direction.normalize();

            console.log(`Final direction Y: ${direction.y.toFixed(2)}`);
        }

        // Do vertical angle clamping AFTER we've set our adaptive trajectory
        // Calculate vertical angle for clamping
        const verticalAngle = Math.atan2(direction.y,
            Math.sqrt(direction.x * direction.x + direction.z * direction.z));

        // Clamp the vertical angle to reasonable limits
        const clampedVerticalAngle = Math.max(minVerticalAngle,
            Math.min(maxVerticalAngle, verticalAngle));

        // If the angle needed clamping, recalculate the direction
        if (clampedVerticalAngle !== verticalAngle) {
            const horizontalComponent = Math.cos(clampedVerticalAngle);
            const verticalComponent = Math.sin(clampedVerticalAngle);

            // Distribute the horizontal component across X and Z
            const horizontalLength = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
            if (horizontalLength > 0.0001) {
                const scale = horizontalComponent / horizontalLength;
                direction.x *= scale;
                direction.z *= scale;
            }

            // Set the vertical component directly
            direction.y = verticalComponent;
        }

        // Ensure minimum vertical component if needed
        if (Math.abs(direction.y) < minVerticalComponent) {
            direction.y = Math.sign(direction.y) * minVerticalComponent || minVerticalComponent;
            direction.normalize();
        }

        return direction;
    }

    /**
     * Find the nearest firing position from a set of possible positions
     * 
     * @param {Array} positionConfigs - Array of position configs relative to boat
     * @param {THREE.Vector3} targetPosition - Target position in world space
     * @returns {Object} Object containing worldPosition and the config that was used
     */
    static getNearestFiringPosition(positionConfigs, targetPosition) {
        let nearestPosition = null;
        let nearestConfig = null;
        let minDistance = Infinity;

        for (const config of positionConfigs) {
            // Convert to world position
            const worldPosition = new THREE.Vector3(
                config.x,
                config.y || 1.5, // Default height if not specified
                config.z
            ).applyMatrix4(boat.matrixWorld);

            const distance = worldPosition.distanceTo(targetPosition);

            if (distance < minDistance) {
                minDistance = distance;
                nearestPosition = worldPosition;
                nearestConfig = config;
            }
        }

        return {
            worldPosition: nearestPosition,
            config: nearestConfig
        };
    }

    /**
     * Get the ship's current up, forward, and right vectors
     * These vectors can be used to transform directions relative to the ship
     * 
     * @returns {Object} Object containing up, forward, and right vectors
     */
    static getShipOrientationVectors() {
        const shipUp = new THREE.Vector3(0, 1, 0);
        const shipForward = new THREE.Vector3(0, 0, -1).applyQuaternion(boat.quaternion);
        const shipRight = new THREE.Vector3(1, 0, 0).applyQuaternion(boat.quaternion);

        return { shipUp, shipForward, shipRight };
    }

    /**
     * Calculate an arc trajectory for projectiles with physics
     * 
     * @param {THREE.Vector3} startPosition - Starting position
     * @param {THREE.Vector3} direction - Initial normalized direction
     * @param {Number} speed - Initial speed
     * @param {Number} gravity - Gravity constant
     * @param {Number} time - Time since launch in seconds
     * @returns {THREE.Vector3} Position at the given time
     */
    static calculateProjectilePosition(startPosition, direction, speed, gravity, time) {
        const position = new THREE.Vector3();

        position.x = startPosition.x + direction.x * speed * time;
        position.y = startPosition.y + direction.y * speed * time - 0.5 * gravity * time * time;
        position.z = startPosition.z + direction.z * speed * time;

        return position;
    }
}

export default AimingSystem; 