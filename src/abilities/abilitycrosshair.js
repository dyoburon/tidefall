import * as THREE from 'three';

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
    startAiming() {
        if (this.isActive) return;

        this.isActive = true;
        this.crosshairElement.style.display = 'block';
        console.log("Crosshair element display:", this.crosshairElement.style.display); // Check display
        console.log("Crosshair element:", this.crosshairElement); // Log the element itself

        // Change cursor style
        document.body.style.cursor = 'none';

        // Add mouse move listener
        document.addEventListener('mousemove', this.onMouseMove);

        // Position crosshair at current mouse position
        this.updateCrosshairPosition();
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
        // Update normalized mouse position (-1 to 1)
        this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update crosshair DOM element position
        this.updateCrosshairPosition();
    }

    /**
     * Updates the crosshair position based on mouse coordinates
     */
    updateCrosshairPosition() {
        if (!this.isActive) return;

        // Position crosshair at mouse position
        this.crosshairElement.style.left = `${this.mousePosition.x * window.innerWidth / 2 + window.innerWidth / 2}px`;
        this.crosshairElement.style.top = `${-this.mousePosition.y * window.innerHeight / 2 + window.innerHeight / 2}px`;

        console.log("Crosshair position:", this.crosshairElement.style.left, this.crosshairElement.style.top); // Log position
        console.log("Crosshair visibility:", this.crosshairElement.style.visibility); // Check visibility
        console.log("Crosshair offsetWidth:", this.crosshairElement.offsetWidth, "offsetHeight:", this.crosshairElement.offsetHeight); // Check dimensions
    }

    /**
     * Calculates the target position in 3D space
     * @param {number} distance - How far to project the ray
     * @returns {THREE.Vector3} The target position in world space
     */
    getTargetPosition(distance = 100) {
        // Update the picking ray
        this.raycaster.setFromCamera(this.mousePosition, this.camera);

        // Calculate target point along ray
        this.targetPosition.copy(this.raycaster.ray.origin)
            .add(this.raycaster.ray.direction.clone().multiplyScalar(distance));

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