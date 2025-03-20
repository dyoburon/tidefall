import * as THREE from 'three';
import { scene } from '../core/gameState.js';

// Physics constants
const DEFAULT_GRAVITY = 9.8;
const DEFAULT_TERMINAL_VELOCITY = 50;

/**
 * Applies gravity to an object and handles trajectory
 */
class GravitySystem {
    constructor(options = {}) {
        this.gravity = options.gravity || DEFAULT_GRAVITY;
        this.terminalVelocity = options.terminalVelocity || DEFAULT_TERMINAL_VELOCITY;

        // Track all objects affected by gravity
        this.objects = new Map();
    }

    /**
     * Add an object to the gravity system
     * @param {string} id - Unique identifier for the object
     * @param {Object} object - The 3D object to apply gravity to
     * @param {Object} params - Initial parameters for the object
     * @param {THREE.Vector3} params.velocity - Initial velocity vector
     * @param {number} params.mass - Object mass (affects how gravity is applied)
     * @param {boolean} params.collidesWithWater - Whether object should stop at water level
     * @param {Function} params.onCollide - Callback when object collides with ground/water
     */
    addObject(id, object, params = {}) {
        if (!object || !object.position) {

            return;
        }

        this.objects.set(id, {
            object,
            velocity: params.velocity || new THREE.Vector3(0, 0, 0),
            mass: params.mass || 1,
            collidesWithWater: params.collidesWithWater !== false,
            waterLevel: params.waterLevel || 0,
            onCollide: params.onCollide || null,
            startTime: performance.now(),
            isActive: true
        });

        return id;
    }

    /**
     * Remove an object from the gravity system
     */
    removeObject(id) {
        this.objects.delete(id);
    }

    /**
     * Update all objects affected by gravity
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        this.objects.forEach((data, id) => {
            if (!data.isActive) return;

            // Apply gravity to velocity
            data.velocity.y -= this.gravity * data.mass * deltaTime;

            // Apply terminal velocity limit
            if (data.velocity.y < -this.terminalVelocity) {
                data.velocity.y = -this.terminalVelocity;
            }

            // Update position based on velocity
            data.object.position.x += data.velocity.x * deltaTime;
            data.object.position.y += data.velocity.y * deltaTime;
            data.object.position.z += data.velocity.z * deltaTime;

            // Check for water collision if needed
            if (data.collidesWithWater && data.object.position.y <= data.waterLevel) {
                data.object.position.y = data.waterLevel;
                data.isActive = false;

                // Call collision callback if provided
                if (data.onCollide && typeof data.onCollide === 'function') {
                    data.onCollide(data.object, {
                        type: 'water',
                        position: data.object.position.clone(),
                        velocity: data.velocity.clone()
                    });
                }

                // Remove object after collision if not persistent
                if (!data.isPersistent) {
                    this.removeObject(id);
                }
            }
        });
    }

    /**
     * Calculate a trajectory considering gravity
     * @param {THREE.Vector3} startPosition - Starting position
     * @param {THREE.Vector3} direction - Normalized direction vector
     * @param {number} speed - Initial speed
     * @param {number} time - Time to simulate (seconds)
     * @returns {THREE.Vector3} - Position after time
     */
    calculateTrajectoryPoint(startPosition, direction, speed, time) {
        const initialVelocity = direction.clone().multiplyScalar(speed);

        // Calculate position with gravity
        const position = new THREE.Vector3();
        position.x = startPosition.x + initialVelocity.x * time;
        position.y = startPosition.y + (initialVelocity.y * time) - (0.5 * this.gravity * time * time);
        position.z = startPosition.z + initialVelocity.z * time;

        return position;
    }

    /**
     * Creates a visual trajectory line for aiming
     * @param {THREE.Vector3} startPosition - Starting position
     * @param {THREE.Vector3} direction - Normalized direction vector
     * @param {number} speed - Initial speed
     * @param {number} duration - How long to simulate (seconds)
     * @param {number} segments - How many line segments to use
     * @returns {THREE.Line} - The trajectory line object
     */
    createTrajectoryLine(startPosition, direction, speed, duration = 2, segments = 20) {
        const points = [];
        const timeStep = duration / segments;

        for (let i = 0; i <= segments; i++) {
            const time = i * timeStep;
            const point = this.calculateTrajectoryPoint(startPosition, direction, speed, time);
            points.push(point);
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0xffffff,
            dashSize: 1,
            gapSize: 0.5,
        });

        const line = new THREE.Line(geometry, material);
        line.computeLineDistances(); // Required for dashed lines

        return line;
    }

    /**
     * Apply a simple gravity effect to an object for one update
     * @param {Object} object - The object to apply gravity to (must have a position property)
     * @param {number} deltaTime - Time since last update in seconds
     * @param {Object} options - Optional parameters
     * @param {number} options.gravityStrength - Override default gravity strength (defaults to this.gravity)
     * @param {THREE.Vector3} options.velocity - Velocity vector to modify (creates a new one if not provided)
     * @returns {THREE.Vector3} - The updated velocity vector
     */
    applySimpleGravity(object, deltaTime, options = {}) {
        if (!object || !object.position) {

            return null;
        }

        // Use provided velocity or create a new one
        const velocity = options.velocity || new THREE.Vector3(0, 0, 0);
        const gravityStrength = options.gravityStrength || this.gravity;

        // Apply gravity to velocity
        velocity.y -= gravityStrength * deltaTime;

        // Update object position
        object.position.y += velocity.y * deltaTime;

        // Return the velocity for further use if needed
        return velocity;
    }
}

// Create a default gravity system instance
const gravitySystem = new GravitySystem();

export { GravitySystem, gravitySystem }; 