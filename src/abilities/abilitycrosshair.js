import * as THREE from 'three';
import { isTouchDevice } from '../controls/touchControls.js';
import worldRaycaster from '../core/worldRaycaster.js'; // Import our raycaster

/**
 * Manages the crosshair/aiming UI for all abilities
 * Provides a consistent interface for aiming mechanics
 */
class AbilityCrosshair {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.isActive = false;
        this.mousePosition = new THREE.Vector2();
        this.targetPosition = new THREE.Vector3();
        this.raycaster = new THREE.Raycaster();

        // Create a DOM element for the crosshair
        this.createCrosshairElement();

        // Bind methods
        this.onMouseMove = this.onMouseMove.bind(this);
    }

    /**
     * Creates the crosshair DOM element
     */
    createCrosshairElement() {
        // Remove existing crosshair if present
        const existingCrosshair = document.getElementById('ability-crosshair');
        if (existingCrosshair) {
            document.body.removeChild(existingCrosshair);
        }

        // Create new crosshair element
        this.crosshairElement = document.createElement('div');
        this.crosshairElement.id = 'ability-crosshair';
        this.crosshairElement.style.position = 'absolute';
        this.crosshairElement.style.width = '32px';
        this.crosshairElement.style.height = '32px';
        this.crosshairElement.style.boxSizing = 'border-box';
        this.crosshairElement.style.pointerEvents = 'none';
        this.crosshairElement.style.zIndex = '1000';
        this.crosshairElement.style.transform = 'translate(-50%, -50%)';

        // --- Styling for Spyglass Lens ---
        this.crosshairElement.style.borderRadius = '50%'; // Make it a circle
        this.crosshairElement.style.border = '2px solid #654321'; // Dark wood border
        this.crosshairElement.style.backgroundColor = 'rgba(250, 235, 215, 0.1)'; // Very faint AntiqueWhite fill
        this.crosshairElement.style.boxShadow = '0 0 0 2px #FAEBD7'; // AntiqueWhite outline

        // Add concentric rings (using box-shadow trick)
        this.crosshairElement.style.boxShadow = `
            0 0 0 2px #FAEBD7,
            0 0 0 4px rgba(101, 67, 33, 0.5),
            0 0 0 6px rgba(250, 235, 215, 0.3),
            0 0 0 8px rgba(101, 67, 33, 0.2)
        `;

        // Make lines extend to edges of the circle, and brighter color
        const verticalLine = document.createElement('div');
        verticalLine.style.position = 'absolute';
        verticalLine.style.width = '1px';
        verticalLine.style.height = '32px'; // Full height of crosshair
        verticalLine.style.backgroundColor = '#FAEBD7'; // AntiqueWhite for high contrast
        verticalLine.style.left = '50%';
        verticalLine.style.top = '50%';
        verticalLine.style.transform = 'translate(-50%, -50%)';
        this.crosshairElement.appendChild(verticalLine);

        const horizontalLine = document.createElement('div');
        horizontalLine.style.position = 'absolute';
        horizontalLine.style.width = '32px'; // Full width of crosshair
        horizontalLine.style.height = '1px';
        horizontalLine.style.backgroundColor = '#FAEBD7'; // AntiqueWhite for high contrast
        horizontalLine.style.left = '50%';
        horizontalLine.style.top = '50%';
        horizontalLine.style.transform = 'translate(-50%, -50%)';
        this.crosshairElement.appendChild(horizontalLine);

        // --- End Spyglass Styling ---

        // Hide initially
        this.crosshairElement.style.display = 'none';

        // Add to DOM
        document.body.appendChild(this.crosshairElement);
    }

    /**
     * Activates the crosshair for aiming
     */
    startAiming(event) {
        if (this.isActive) return;

        this.isActive = true;

        // Get current mouse position from the most recent event or browser API
        if (!this.screenPosition) {
            // If we don't have a position yet, use the current cursor position
            this.screenPosition = {
                x: event?.clientX || window.mouseX || window.innerWidth / 2,
                y: event?.clientY || window.mouseY || window.innerHeight / 2
            };

            // Update normalized coordinates for raycasting
            this.mousePosition.x = (this.screenPosition.x / window.innerWidth) * 2 - 1;
            this.mousePosition.y = -(this.screenPosition.y / window.innerHeight) * 2 + 1;

            // Also update the target position immediately using the WorldRaycaster
            this.updateTargetPosition();
        }

        // Update crosshair position before showing it
        this.updateCrosshairPosition();

        // Now show the crosshair at the correct position
        this.crosshairElement.style.display = 'block';

        // Change cursor style
        document.body.style.cursor = 'none';

        // Add mouse move listener
        document.addEventListener('mousemove', this.onMouseMove);
    }

    /**
     * Deactivates the crosshair
     */
    stopAiming() {
        if (!this.isActive) return;

        this.isActive = false;
        this.crosshairElement.style.display = 'none';

        // Restore cursor
        document.body.style.cursor = 'auto';

        // Remove event listener
        document.removeEventListener('mousemove', this.onMouseMove);
    }

    /**
     * Mouse move event handler
     */
    onMouseMove(event) {
        // Store actual screen coordinates
        this.screenPosition = {
            x: event.clientX,
            y: event.clientY
        };

        // Also update window-level tracking for initial positioning
        window.mouseX = event.clientX;
        window.mouseY = event.clientY;

        // Update normalized mouse position (-1 to 1) for raycasting
        this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update target position using the improved WorldRaycaster
        this.updateTargetPosition();

        // Update crosshair DOM element position
        this.updateCrosshairPosition();
    }

    /**
     * Updates the crosshair position based on mouse coordinates
     */
    updateCrosshairPosition() {
        if (!this.isActive) return;

        // Position crosshair directly at screen position
        if (this.screenPosition) {
            this.crosshairElement.style.left = `${this.screenPosition.x}px`;
            this.crosshairElement.style.top = `${this.screenPosition.y}px`;
        }
    }

    /**
     * Updates the target position in world space using the WorldRaycaster
     */
    updateTargetPosition() {
        if (!this.screenPosition) return;

        // Use the WorldRaycaster to get a more accurate world position
        const worldPos = worldRaycaster.getAbilityTargetPosition(
            this.screenPosition.x,
            this.screenPosition.y
        );

        // Update our internal target position
        this.targetPosition.copy(worldPos);
    }

    /**
     * Calculates the target position in 3D space
     * Now uses the improved WorldRaycaster for more accurate targeting
     * 
     * @param {Array} [targetMeshes=[]] - Optional meshes to check for intersection
     * @returns {THREE.Vector3} The target position in world space
     */
    getTargetPosition(targetMeshes = []) {
        // If we have specific target meshes, try to intersect with them
        if (targetMeshes.length > 0 && this.screenPosition) {
            const worldPos = worldRaycaster.getAbilityTargetPosition(
                this.screenPosition.x,
                this.screenPosition.y,
                targetMeshes
            );
            return worldPos;
        }

        // Otherwise return our cached target position
        // which is already updated by updateTargetPosition()
        return this.targetPosition.clone();
    }

    /**
     * Main update function called each frame
     */
    update() {
        if (!this.isActive) return;

        // Could add additional visual effects or animations here
    }
}

export default AbilityCrosshair; 