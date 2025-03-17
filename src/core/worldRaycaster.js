import * as THREE from 'three';
import { camera, scene } from '../core/gameState.js';

/**
 * WorldRaycaster provides utilities for translating screen coordinates
 * into 3D world positions through raycasting.
 */
class WorldRaycaster {
    constructor() {
        // Create a reusable raycaster object
        this.raycaster = new THREE.Raycaster();

        // Create a water plane at y=0 for intersection with mouse
        this.waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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
     * @param {number} screenX - X coordinate on screen
     * @param {number} screenY - Y coordinate on screen
     * @returns {Object} Normalized device coordinates {x, y}
     */
    screenToNDC(screenX, screenY) {
        return {
            x: (screenX / this.screenWidth) * 2 - 1,
            y: -(screenY / this.screenHeight) * 2 + 1  // Y is inverted
        };
    }

    /**
     * Get world position from screen coordinates by raycasting
     * against the water plane (y=0)
     * 
     * @param {number} screenX - X coordinate on screen
     * @param {number} screenY - Y coordinate on screen
     * @returns {THREE.Vector3|null} World position or null if no intersection
     */
    screenToWorld(screenX, screenY) {
        // Convert to normalized device coordinates
        const ndc = this.screenToNDC(screenX, screenY);

        // Update the raycaster
        this.raycaster.setFromCamera(ndc, camera);

        // Get intersection with water plane
        const target = new THREE.Vector3();
        const hit = this.raycaster.ray.intersectPlane(this.waterPlane, target);

        if (hit) {
            return target;
        }

        // No intersection - try to get a point at reasonable distance
        const rayDirection = this.raycaster.ray.direction.clone();
        return this.raycaster.ray.origin.clone().add(
            rayDirection.multiplyScalar(100)  // 100 units along ray
        );
    }

    /**
     * Get world position from screen coordinates by raycasting against provided mesh(es)
     * 
     * @param {number} screenX - X coordinate on screen
     * @param {number} screenY - Y coordinate on screen
     * @param {Array|THREE.Mesh} targetMeshes - Mesh(es) to check for intersection
     * @returns {Object|null} Intersection data or null if no intersection
     */
    screenToObject(screenX, screenY, targetMeshes) {
        // Convert to normalized device coordinates
        const ndc = this.screenToNDC(screenX, screenY);

        // Update the raycaster
        this.raycaster.setFromCamera(ndc, camera);

        // Ensure targetMeshes is an array
        const meshes = Array.isArray(targetMeshes) ? targetMeshes : [targetMeshes];

        // Get intersections
        const intersections = this.raycaster.intersectObjects(meshes, true);

        if (intersections.length > 0) {
            return intersections[0];  // Return the closest intersection
        }

        return null;
    }

    /**
     * Gets target position for abilities, prioritizing object intersections
     * but falling back to water plane
     * 
     * @param {number} screenX - X coordinate on screen
     * @param {number} screenY - Y coordinate on screen
     * @param {Array} [targetMeshes=[]] - Optional meshes to check for intersection
     * @returns {THREE.Vector3} Target position in world space
     */
    getAbilityTargetPosition(screenX, screenY, targetMeshes = []) {
        // First try to hit objects if provided
        if (targetMeshes.length > 0) {
            const objectHit = this.screenToObject(screenX, screenY, targetMeshes);
            if (objectHit) {
                return objectHit.point;
            }
        }

        // Fall back to water plane intersection
        return this.screenToWorld(screenX, screenY);
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