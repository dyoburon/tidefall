import * as THREE from 'three';
import { scene } from '../core/gameState.js';

// Hard-coded configuration - no more complex settings
let fogDome = null;
let fogMaterial = null;
let isActive = false;
let fadeEffect = null;

/**
 * Initialize simple fog system with hardcoded values
 */
export function setupFog() {
    console.log("Setting up simplified fog dome...");

    // Clean up any existing fog
    if (fogDome) {
        scene.remove(fogDome);
        if (fogMaterial) fogMaterial.dispose();
    }

    // Create very simple shader material
    fogMaterial = new THREE.ShaderMaterial({
        uniforms: {
            fogColor: { value: new THREE.Color(0xFF0000) },  // Bright red for visibility
            opacity: { value: 0.8 }                        // High opacity
        },
        vertexShader: `
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 fogColor;
            uniform float opacity;
            
            void main() {
                // Super simple - just output the color with fixed opacity
                gl_FragColor = vec4(fogColor, opacity);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,  // Render both sides
        depthWrite: false        // Don't write to depth buffer
    });

    // Create a small sphere very close to the camera
    const radius = 1000; // Increased from 15 to 200 units
    const geometry = new THREE.SphereGeometry(radius, 16, 12);

    // Create the fog dome mesh
    fogDome = new THREE.Mesh(geometry, fogMaterial);

    // Make it active immediately
    isActive = true;

    // Add to scene immediately
    scene.add(fogDome);

    console.log("Simplified fog dome created and added to scene");

    return fogDome;
}

/**
 * Updates fog position to stay with player
 * @param {THREE.Vector3} playerPosition - Player's current position
 */
export function updateFog(playerPosition, deltaTime) {
    if (!fogDome || !isActive) {
        // console.log("Fog not updating - dome or active state missing");
        return;
    }

    // Simply position dome at player
    fogDome.position.copy(playerPosition);

    // Log position occasionally to verify updates
    if (Math.random() < 0.01) { // Log only occasionally
        console.log("Fog position updated:", playerPosition);
    }

    // Process any active fade effect
    updateFogEffects(deltaTime);
}

/**
 * Toggles fog on/off
 */
export function toggleFog() {
    console.log("Toggling fog:", !isActive);

    if (isActive) {
        // Turn off
        if (fogDome && fogDome.parent) {
            fogDome.parent.remove(fogDome);
            console.log("Fog removed from scene");
        }
        isActive = false;
        return false;
    } else {
        // Turn on
        if (fogDome) {
            scene.add(fogDome);
            console.log("Existing fog added to scene");
        } else {
            setupFog();
            console.log("New fog created and added");
        }
        isActive = true;
        return true;
    }
}

/**
 * Sets fog color
 */
export function setFogColor(color) {
    if (fogMaterial) {
        fogMaterial.uniforms.fogColor.value.set(color);
        console.log("Fog color set to:", color);
    }
}

/**
 * Sets fog density (dummy function for compatibility)
 */
export function setFogDensity(density) {
    console.log("setFogDensity called (not used in simplified version)");
}

/**
 * Makes fog gradually dissipate
 */
export function dissipateFog(options = {}) {
    if (!fogDome || !isActive) {
        console.log("Cannot dissipate - fog not active");
        return { isActive: false };
    }

    console.log("Starting fog dissipation effect...");

    // Simple configuration
    const duration = options.duration || 3000;
    const onComplete = options.onComplete || (() => { });

    // Store original values
    const startOpacity = fogMaterial.uniforms.opacity.value;

    // Create status object for the game loop
    fadeEffect = {
        isActive: true,
        startTime: Date.now(),
        duration: duration,
        startOpacity: startOpacity,
        onComplete: onComplete,
        completed: false
    };

    return fadeEffect;
}

/**
 * Updates active fog fade effects
 */
export function updateFogEffects(deltaTime) {
    if (!fadeEffect || !fadeEffect.isActive || fadeEffect.completed) return;

    // Calculate progress (0 to 1)
    const elapsed = Date.now() - fadeEffect.startTime;
    const progress = Math.min(1, elapsed / fadeEffect.duration);

    // Apply fade effect to opacity
    fogMaterial.uniforms.opacity.value = fadeEffect.startOpacity * (1 - progress);

    // Log progress occasionally
    if (Math.random() < 0.01) { // Log only occasionally
        console.log("Fog fade progress:", progress.toFixed(2),
            "Opacity:", fogMaterial.uniforms.opacity.value.toFixed(2));
    }

    // Check if effect is complete
    if (progress >= 1) {
        fadeEffect.isActive = false;
        fadeEffect.completed = true;

        console.log("Fog dissipation complete");

        // Remove fog dome from scene completely
        if (fogDome && fogDome.parent) {
            fogDome.parent.remove(fogDome);
            console.log("Fog removed after dissipation");
        }

        // Set inactive
        isActive = false;

        if (fadeEffect.onComplete) fadeEffect.onComplete();
        fadeEffect = null;
    }
}

// For compatibility with existing code
export function setFogProperties() {
    console.log("setFogProperties called (not used in simplified version)");
    return {};
}