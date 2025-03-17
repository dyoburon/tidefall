import * as THREE from 'three';
import { isTouchDevice } from '../controls/touchControls.js';
import worldRaycaster from '../core/worldRaycaster.js';

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

        // Throttling mouse movement updates
        this.lastUpdateTime = 0;
        this.updateThrottle = 32; // Update at ~30fps for aiming

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
            this.screenPosition = {
                x: event?.clientX || window.mouseX || window.innerWidth / 2,
                y: event?.clientY || window.mouseY || window.innerHeight / 2
            };

            // Update normalized coordinates for raycasting
            this.mousePosition.x = (this.screenPosition.x / window.innerWidth) * 2 - 1;
            this.mousePosition.y = -(this.screenPosition.y / window.innerHeight) * 2 + 1;

            // Initial update - force accurate position
            this.updateTargetPosition(true);
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
     * Mouse move event handler - optimized to reduce calculations
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

        // Update crosshair DOM element position (this is cheap)
        this.updateCrosshairPosition();

        // Only update the 3D target position if enough time has passed
        const now = Date.now();
        if (now - this.lastUpdateTime > this.updateThrottle) {
            this.lastUpdateTime = now;
            this.updateTargetPosition(false);
        }
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
     * Updates the target position in world space using the optimized WorldRaycaster
     * @param {boolean} forceAccurate - Force high accuracy update
     */
    updateTargetPosition(forceAccurate = false) {
        if (!this.screenPosition) return;

        // Use the throttled raycaster version for better performance
        const worldPos = worldRaycaster.getAbilityTargetPosition(
            this.screenPosition.x,
            this.screenPosition.y,
            forceAccurate
        );

        // Update our internal target position
        this.targetPosition.copy(worldPos);
    }

    /**
     * Calculates the target position in 3D space
     * Uses caching to improve performance
     * 
     * @param {boolean} [accurate=true] - Whether to force an accurate raycast (for firing)
     * @returns {THREE.Vector3} The target position in world space
     */
    getTargetPosition(accurate = true) {
        // Always do an accurate update when the ability is actually fired
        if (accurate) {
            this.updateTargetPosition(true);
        }

        return this.targetPosition.clone();
    }

    /**
     * Main update function called each frame
     */
    update() {
        // No per-frame updates needed - we update on mouse movement instead
    }
}

export default AbilityCrosshair; 