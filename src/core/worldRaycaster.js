import * as THREE from 'three';
import { camera, scene } from '../core/gameState.js';

/**
 * WorldRaycaster provides utilities for translating screen coordinates
 * into 3D world positions through raycasting - optimized for performance.
 */
class WorldRaycaster {
    constructor() {
        // Create a reusable raycaster object
        this.raycaster = new THREE.Raycaster();

        // Create a water plane at y=0 for intersection with mouse
        this.waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        // Reusable objects to avoid creating new ones
        this.reusableVector = new THREE.Vector3();
        this.reusableNDC = { x: 0, y: 0 };
        this.lastScreenX = -1;
        this.lastScreenY = -1;
        this.cachedWorldPosition = new THREE.Vector3();

        // Throttling state
        this.lastUpdateTime = 0;
        this.throttleDelay = 16; // ~60fps

        // Store screen dimensions
        this.updateScreenSize();

        // Bind the resize handler
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
    }

    /**
     * Update screen dimensions when window is resized
     */
    handleResize() {
        this.updateScreenSize();
    }

    /**
     * Update cached screen dimensions
     */
    updateScreenSize() {
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;
    }

    /**
     * Convert screen coordinates to normalized device coordinates (-1 to +1)
     * Reuses the same object for better performance.
     * 
     * @param {number} screenX - X coordinate on screen
     * @param {number} screenY - Y coordinate on screen
     * @returns {Object} Normalized device coordinates {x, y}
     */
    screenToNDC(screenX, screenY) {
        this.reusableNDC.x = (screenX / this.screenWidth) * 2 - 1;
        this.reusableNDC.y = -(screenY / this.screenHeight) * 2 + 1;
        return this.reusableNDC;
    }

    /**
     * Get world position from screen coordinates by raycasting
     * against the water plane (y=0) - with performance optimizations
     * 
     * @param {number} screenX - X coordinate on screen
     * @param {number} screenY - Y coordinate on screen
     * @param {boolean} forceUpdate - Bypass throttling and caching
     * @returns {THREE.Vector3} World position
     */
    screenToWorld(screenX, screenY, forceUpdate = false) {
        // Check if we can use cached result
        if (!forceUpdate &&
            screenX === this.lastScreenX &&
            screenY === this.lastScreenY &&
            Date.now() - this.lastUpdateTime < this.throttleDelay) {
            return this.cachedWorldPosition.clone();
        }

        // Update tracking values
        this.lastScreenX = screenX;
        this.lastScreenY = screenY;
        this.lastUpdateTime = Date.now();

        // Convert to normalized device coordinates (reuses object)
        const ndc = this.screenToNDC(screenX, screenY);

        // Update the raycaster
        this.raycaster.setFromCamera(ndc, camera);

        // Get intersection with water plane
        const hit = this.raycaster.ray.intersectPlane(this.waterPlane, this.reusableVector);

        if (hit) {
            // Cache the result and return a clone
            this.cachedWorldPosition.copy(this.reusableVector);
            return this.cachedWorldPosition.clone();
        }

        // No intersection - get a point at reasonable distance
        this.reusableVector.copy(this.raycaster.ray.direction).multiplyScalar(100);
        this.cachedWorldPosition.copy(this.raycaster.ray.origin).add(this.reusableVector);
        return this.cachedWorldPosition.clone();
    }

    /**
     * Get world position with throttling for better performance
     * This is the main method to use for continuous updates (like mouse movement)
     */
    screenToWorldThrottled(screenX, screenY) {
        return this.screenToWorld(screenX, screenY, false);
    }

    /**
     * Gets target position for abilities - optimized version
     * Only does full raycasting for critical moments (like ability execution)
     * 
     * @param {number} screenX - X coordinate on screen
     * @param {number} screenY - Y coordinate on screen
     * @param {boolean} forceAccurate - Force full precision raycast
     * @returns {THREE.Vector3} Target position in world space
     */
    getAbilityTargetPosition(screenX, screenY, forceAccurate = false) {
        return this.screenToWorld(screenX, screenY, forceAccurate);
    }

    /**
     * Clean up event listeners
     */
    dispose() {
        window.removeEventListener('resize', this.handleResize);
    }
}

// Create and export singleton instance
const worldRaycaster = new WorldRaycaster();
export default worldRaycaster; 