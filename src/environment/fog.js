import * as THREE from 'three';

// Configuration parameters with defaults (for exponential fog)
const DEFAULT_FOG_CONFIG = {
    color: 0xFF0000,           // Red fog
    density: 0.008,            // Appropriate density for exponential fog
    enableWindEffect: true,    // Whether wind affects fog color
    windEffectColor: 0xFF0000, // Custom color for wind effect
    windEffectStrength: 0.4    // Strength of wind color effect (0-1)
};

// Fog object reference
let sceneFog = null;
let fogConfig = { ...DEFAULT_FOG_CONFIG };

/**
 * Initializes exponential fog in the scene
 * @param {THREE.Scene} scene - The scene to add fog to
 * @param {Object} config - Optional configuration parameters
 */
export function setupFog(scene, config = {}) {
    // Merge provided config with defaults
    fogConfig = { ...DEFAULT_FOG_CONFIG, ...config };

    // Remove any existing fog
    scene.fog = null;

    // Create exponential fog
    sceneFog = new THREE.FogExp2(fogConfig.color, fogConfig.density);

    // Add fog to scene
    scene.fog = sceneFog;

    console.log("Exponential fog system initialized:", fogConfig);

    return sceneFog;
}

/**
 * Updates fog based on player position and time
 * @param {THREE.Vector3} playerPosition - Player's current position
 * @param {number} deltaTime - Time since last update (seconds)
 * @param {Object} windData - Optional wind data for fog movement
 */
export function updateFog(playerPosition, deltaTime, windData = null) {
    if (!sceneFog) return;

    // Subtly change fog density based on position
    const positionFactor = (Math.sin(playerPosition.x * 0.001) + Math.sin(playerPosition.z * 0.001)) * 0.5;

    // Gently vary density based on player position
    const baseDensity = fogConfig.density;
    const densityVariation = baseDensity * 0.2; // 20% variation
    sceneFog.density = baseDensity + (positionFactor * densityVariation);

    // If we have wind data, we can make the fog color slightly respond to it
    if (windData && fogConfig.enableWindEffect !== false) {
        const windStrength = Math.min(1, windData.speed / 10); // Normalized 0-1
        const baseColor = new THREE.Color(fogConfig.color);

        // Use a configurable wind effect color with a sensible default
        const windyColor = fogConfig.windEffectColor
            ? new THREE.Color(fogConfig.windEffectColor)
            : new THREE.Color(baseColor).multiplyScalar(0.7); // Darker version of base color

        // Make effect strength configurable
        const effectStrength = fogConfig.windEffectStrength !== undefined
            ? fogConfig.windEffectStrength
            : 0.2; // Reduced from 0.3 to be more subtle

        const finalColor = new THREE.Color().lerpColors(
            baseColor,
            windyColor,
            effectStrength
        );

        sceneFog.color.copy(finalColor);
    }
}

/**
 * Sets fog density for exponential fog
 * @param {number} density - New fog density value
 */
export function setFogDensity(density) {
    if (sceneFog) {
        fogConfig.density = density;
        sceneFog.density = density;
    }
}

/**
 * Sets fog color
 * @param {number|string} color - Fog color (hex value or string)
 */
export function setFogColor(color) {
    if (sceneFog) {
        fogConfig.color = color;
        sceneFog.color.set(color);
    }
}

/**
 * Toggles fog on/off
 * @param {THREE.Scene} scene - The scene containing fog
 * @returns {boolean} - New fog state (true = enabled)
 */
export function toggleFog(scene) {
    if (scene.fog) {
        sceneFog = scene.fog;
        scene.fog = null;
        return false;
    } else {
        scene.fog = sceneFog || setupFog(scene);
        return true;
    }
}

/**
 * Updates or initializes fog with new properties
 * @param {THREE.Scene} scene - The scene containing the fog
 * @param {Object} config - Configuration for the fog
 * @param {THREE.Color|number|string} [config.color] - Fog color
 * @param {number} [config.density] - Fog density
 * @returns {Object} Current fog configuration
 */
export function setFogProperties(scene, config = {}) {
    // If no fog exists, create it
    if (!scene.fog) {
        const newConfig = { ...fogConfig, ...config };
        setupFog(scene, newConfig);
        return { ...fogConfig };
    }

    // Otherwise just update existing fog properties
    if (config.color !== undefined) {
        setFogColor(config.color);
    }

    if (config.density !== undefined) {
        setFogDensity(config.density);
    }

    // Update our stored config
    fogConfig = { ...fogConfig, ...config };

    return { ...fogConfig };
}

/**
 * Makes fog gradually dissipate by reducing density to zero
 * @param {Object} options - Optional configuration
 * @param {number} [options.duration=3000] - Duration in milliseconds
 * @param {Function} [options.onComplete] - Callback when complete
 */
export function dissipateFog(options = {}) {
    if (!sceneFog) return { isActive: false };

    console.log("Starting exponential fog dissipation...");

    // Configuration
    const duration = options.duration || 3000;
    const onComplete = options.onComplete || (() => { });

    // Store starting values
    const startDensity = sceneFog.density;
    const fogScene = sceneFog.parent;
    const startTime = Date.now();

    // Create the effect object
    const effect = {
        update: function (deltaTime) {
            // Calculate progress
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Simply reduce density toward zero
            sceneFog.density = startDensity * (1 - progress);

            // Log occasionally
            if (Math.random() < 0.01) {
                console.log(`Fog dissipation: ${Math.round(progress * 100)}%, density=${sceneFog.density.toFixed(5)}`);
            }

            // Complete?
            if (progress >= 1) {
                // Remove fog completely
                if (fogScene) {
                    fogScene.fog = null;
                }

                // Clear reference
                sceneFog = null;

                console.log("Fog dissipation complete, fog removed");

                // Call completion callback
                onComplete();

                // Remove this effect
                return false;
            }

            return true;
        }
    };

    // Add to effects list
    if (!window.fogEffects) window.fogEffects = [];
    window.fogEffects.push(effect);

    return { isActive: true };
}

/**
 * Updates active fog effects - call this from the game loop
 * @param {number} deltaTime - Time since last frame in seconds
 */
export function updateFogEffects(deltaTime) {
    if (!window.fogEffects || window.fogEffects.length === 0) return;

    // Process each active fog effect
    window.fogEffects = window.fogEffects.filter(effect => {
        if (!effect || !effect.update) return false;

        // Call the effect's update function
        return effect.update(deltaTime);
    });
}