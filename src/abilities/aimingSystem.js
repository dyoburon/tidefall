import * as THREE from 'three';
import { boat } from '../core/gameState.js';

/**
 * AimingSystem provides standardized functions for ability targeting and direction calculations
 * to ensure all abilities use the same aiming logic.
 */
class AimingSystem {
    /**
     * Calculate the firing direction from a position to a target,
     * properly accounting for ship orientation
     * 
     * @param {THREE.Vector3} sourcePosition - World position where the ability is fired from
     * @param {THREE.Vector3} targetPosition - World position that the player clicked
     * @param {Object} options - Additional options
     * @param {Number} options.minVerticalAngle - Minimum vertical angle in radians (default: -0.52 ~ -30°)
     * @param {Number} options.maxVerticalAngle - Maximum vertical angle in radians (default: 1.48 ~ 85°)
     * @param {Number} options.minVerticalComponent - Minimum Y component to ensure projectile isn't flat
     * @returns {THREE.Vector3} Normalized firing direction vector
     */
    static calculateFiringDirection(sourcePosition, targetPosition, options = {}) {
        // Default options
        const {
            minVerticalAngle = -0.52, // About -30 degrees
            maxVerticalAngle = 1.48,  // About 85 degrees
            minVerticalComponent = 0.05
        } = options;

        // Create a direct vector from source to target
        const rawDirection = new THREE.Vector3().subVectors(targetPosition, sourcePosition);

        // Get the horizontal distance
        const horizontalDistance = Math.sqrt(
            rawDirection.x * rawDirection.x +
            rawDirection.z * rawDirection.z
        );

        // Calculate vertical angle
        const verticalAngle = Math.atan2(rawDirection.y, horizontalDistance);

        // Clamp the vertical angle to reasonable limits
        const clampedVerticalAngle = Math.max(minVerticalAngle,
            Math.min(maxVerticalAngle, verticalAngle));

        // Recreate the direction vector with the clamped vertical angle
        const direction = new THREE.Vector3(
            rawDirection.x,
            Math.sin(clampedVerticalAngle) * horizontalDistance,
            rawDirection.z
        );

        // Normalize the direction
        direction.normalize();

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