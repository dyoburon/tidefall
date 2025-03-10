import * as THREE from 'three';

// Configuration parameters with defaults
const DEFAULT_FOG_CONFIG = {
    color: 0xFF0000,        // Light blue fog
    near: 100,              // Start of fog (closer than chunk size)
    far: 500,              // Complete fog (2x chunk size)
    density: 200,        // For exponential fog
    useExponentialFog: false, // Whether to use exp2 fog (more realistic)
    enableWindEffect: true, // Whether wind affects fog color
    windEffectColor: 0xFF0000,  // Custom color for wind effect (null = auto-calculate)
    windEffectStrength: 0.4 // Strength of wind color effect (0-1)
};

// Fog object references
let sceneFog = null;
let fogConfig = { ...DEFAULT_FOG_CONFIG };

/**
 * Initializes fog in the scene
 * @param {THREE.Scene} scene - The scene to add fog to
 * @param {Object} config - Optional configuration parameters
 */
export function setupFog(scene, config = {}) {
    // Merge provided config with defaults
    fogConfig = { ...DEFAULT_FOG_CONFIG, ...config };

    // Remove any existing fog
    scene.fog = null;

    // Create appropriate fog type
    if (fogConfig.useExponentialFog) {
        sceneFog = new THREE.FogExp2(fogConfig.color, fogConfig.density);
    } else {
        sceneFog = new THREE.Fog(
            fogConfig.color,
            fogConfig.near,
            fogConfig.far
        );
    }

    // Add fog to scene
    scene.fog = sceneFog;

    console.log("Fog system initialized:", fogConfig);

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

    // Example: Subtly change fog color based on position
    // This creates a gentle variation as you move through the world
    const positionFactor = (Math.sin(playerPosition.x * 0.001) + Math.sin(playerPosition.z * 0.001)) * 0.5;

    if (sceneFog instanceof THREE.FogExp2) {
        // Gently vary fog density based on player position
        // This makes some areas clearer than others
        const baseDensity = fogConfig.density;
        const densityVariation = baseDensity * 0.2; // 20% variation
        sceneFog.density = baseDensity + (positionFactor * densityVariation);
    } else {
        // For regular fog, we can adjust the near/far values
        const baseFar = fogConfig.far;
        const farVariation = baseFar * 0.15; // 15% variation
        sceneFog.far = baseFar + (positionFactor * farVariation);
    }

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
 * Sets fog density (only for exponential fog)
 * @param {number} density - New fog density value
 */
export function setFogDensity(density) {
    if (sceneFog instanceof THREE.FogExp2) {
        fogConfig.density = density;
        sceneFog.density = density;
    }
}

/**
 * Sets fog distance parameters (only for linear fog)
 * @param {number} near - Distance where fog starts
 * @param {number} far - Distance where fog is completely opaque
 */
export function setFogDistance(near, far) {
    if (sceneFog instanceof THREE.Fog) {
        fogConfig.near = near;
        fogConfig.far = far;
        sceneFog.near = near;
        sceneFog.far = far;
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
 * Dynamically adjusts fog based on the current view distance
 * @param {number} chunkSize - Size of world chunks
 * @param {number} maxViewDistance - Current max view distance in chunks
 */
export function adjustFogToViewDistance(chunkSize, maxViewDistance) {
    const visibilityDistance = chunkSize * maxViewDistance;

    if (sceneFog instanceof THREE.FogExp2) {
        // For exponential fog, density is inverse to visibility
        // Denser fog = shorter visibility
        const targetDensity = 2.5 / visibilityDistance;
        setFogDensity(targetDensity);
    } else {
        // For linear fog, set the far distance based on chunk visibility
        const near = visibilityDistance * 0.6; // Start fog at 60% of view distance
        const far = visibilityDistance * 1.2;  // Complete fog at 120% of view distance
        setFogDistance(near, far);
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
 * @param {number} [config.density] - Fog density (for exponential fog)
 * @param {number} [config.near] - Distance where fog starts (for linear fog)
 * @param {number} [config.far] - Distance where fog is completely opaque (for linear fog)
 * @param {boolean} [config.useExponentialFog] - Whether to use exponential fog
 * @returns {Object} Current fog configuration
 */
export function setFogProperties(scene, config = {}) {
    // If we need to change fog type or there is no fog yet, recreate it
    if ((config.useExponentialFog !== undefined &&
        config.useExponentialFog !== (scene.fog instanceof THREE.FogExp2)) ||
        !scene.fog) {

        // Create new config by merging current with new
        const newConfig = { ...fogConfig, ...config };
        setupFog(scene, newConfig);
        return { ...fogConfig };
    }

    // Otherwise just update existing fog properties
    if (config.color !== undefined) {
        setFogColor(config.color);
    }

    if (scene.fog instanceof THREE.FogExp2) {
        if (config.density !== undefined) {
            setFogDensity(config.density);
        }
    } else if (scene.fog instanceof THREE.Fog) {
        if (config.near !== undefined || config.far !== undefined) {
            const near = config.near !== undefined ? config.near : scene.fog.near;
            const far = config.far !== undefined ? config.far : scene.fog.far;
            setFogDistance(near, far);
        }
    }

    // Update our stored config
    fogConfig = { ...fogConfig, ...config };

    return { ...fogConfig };
}

/**
 * Makes fog gradually dissipate/fade out
 * @param {Object} options - Dissipation options
 * @param {number} [options.duration=3000] - Duration in milliseconds for full dissipation
 * @param {boolean} [options.affectDensity=true] - Whether to reduce density/increase visibility
 * @param {boolean} [options.affectColor=true] - Whether to fade color to transparent
 * @param {boolean} [options.disableWind=true] - Whether to immediately disable wind effects
 * @param {Function} [options.onComplete] - Callback when dissipation completes
 * @returns {Object} - Control object with cancel method
 */
/**
 * Starts fog dissipation effect
 * @param {Object} options - Optional configuration
 * @param {number} [options.duration=3000] - Duration in milliseconds
 * @param {Function} [options.onComplete] - Callback when complete
 * @returns {Object} - Status object that game loop can check
 */
export function dissipateFog(options = {}) {
    if (!sceneFog) return { isActive: false };

    // Simple configuration
    const duration = options.duration || 3000;
    const onComplete = options.onComplete || (() => { });

    // Store original values
    const startValues = {
        color: sceneFog.color.clone(),
        near: sceneFog instanceof THREE.Fog ? sceneFog.near : null,
        far: sceneFog instanceof THREE.Fog ? sceneFog.far : null,
        density: sceneFog instanceof THREE.FogExp2 ? sceneFog.density : null
    };

    // Create a status object for the game loop to update
    const status = {
        isActive: true,
        startTime: Date.now(),
        duration: duration,
        startValues: startValues,
        onComplete: onComplete,
        completed: false
    };

    // Immediately disable wind effect
    fogConfig.enableWindEffect = false;

    // Add this effect to the global effects list
    if (!window.fogEffects) window.fogEffects = [];
    window.fogEffects.push(status);

    return status;
}

/**
 * Updates active fog effects - call this from the game loop
 * @param {number} deltaTime - Time since last frame in seconds
 */
export function updateFogEffects(deltaTime) {
    if (!window.fogEffects || window.fogEffects.length === 0) return;

    // Process each active fog effect
    window.fogEffects = window.fogEffects.filter(effect => {
        if (!effect.isActive || effect.completed) return false;

        // Calculate progress (0 to 1)
        const elapsed = Date.now() - effect.startTime;
        const progress = Math.min(1, elapsed / effect.duration);

        // Apply effect based on progress
        if (sceneFog) {
            // Fade color
            const color = effect.startValues.color.clone();
            color.multiplyScalar(1 - progress);
            sceneFog.color.copy(color);

            // Adjust fog parameters based on type
            if (sceneFog instanceof THREE.FogExp2 && effect.startValues.density !== null) {
                sceneFog.density = effect.startValues.density * (1 - progress);
            } else if (sceneFog instanceof THREE.Fog) {
                if (effect.startValues.near !== null && effect.startValues.far !== null) {
                    // Increase near and decrease far to shrink fog
                    const nearDelta = effect.startValues.far - effect.startValues.near;
                    sceneFog.near = effect.startValues.near + (nearDelta * progress);
                    sceneFog.far = Math.max(
                        sceneFog.near + 0.1,
                        effect.startValues.far * (1 - progress * 0.5)
                    );
                }
            }
        }

        // Check if effect is complete
        if (progress >= 1) {
            effect.isActive = false;
            effect.completed = true;

            // IMPORTANT: Either remove the fog completely
            if (sceneFog && sceneFog.parent) {
                sceneFog.parent.fog = null;
            }

            // OR reset to original color if you just want to fade effect to end
            // sceneFog.color.copy(effect.startValues.color);

            if (effect.onComplete) effect.onComplete();
            return false;
        }

        return true;
    });
}