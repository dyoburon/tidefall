import * as THREE from 'three';
import { scene } from '../core/gameState.js';
// Import fog configs from each biome
import { VOLCANIC_FOG_CONFIG } from '../biomes/volcanicbiome.js';
import { ARCTIC_FOG_CONFIG } from '../biomes/arcticbiome.js';
import { OPEN_FOG_CONFIG } from '../biomes/openbiome.js';

// Configuration parameters with defaults (for exponential fog)
const DEFAULT_FOG_CONFIG = {
    color: 0xFF0000,           // Red fog
    density: 0.001,            // Appropriate density for exponential fog
    enableWindEffect: true,    // Whether wind affects fog color
    windEffectColor: 0xFF0000, // Custom color for wind effect
    windEffectStrength: 0.4    // Strength of wind color effect (0-1)
};

// Fog object reference
let sceneFog = null;
let fogConfig = { ...DEFAULT_FOG_CONFIG };

// Track the current fog effect state
let isFadingIn = false;
let isFadingOut = false;
let isInterpolatingFog = false; // New flag for fog type transitions

// Track the intended/target fog state
let targetFogState = false; // false = off, true = on

// Add this to the top of the file with other variable declarations
let fogTransitionInterval = null;
let activeType = 'default'; // Track the active fog type

/**
 * Initializes exponential fog in the scene
 * @param {THREE.Scene} scene - The scene to add fog to
 * @param {Object} config - Optional configuration parameters
 */
export function setupFog(config = {}) {
    // Merge provided config with defaults
    fogConfig = { ...DEFAULT_FOG_CONFIG, ...config };

    // Remove any existing fog
    scene.fog = null;

    // Create exponential fog
    sceneFog = new THREE.FogExp2(fogConfig.color, 0);

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
    //console.log("Density:", sceneFog.density);
    if (!sceneFog && scene.fog) {
        sceneFog = scene.fog; // Ensure we have the reference if fog exists
    }

    // Process all active fog effects
    if (window.fogEffects && window.fogEffects.length > 0) {
        // Update each effect and keep only those that return true (still active)
        window.fogEffects = window.fogEffects.filter(effect => effect.update(deltaTime));
    }

    if (!sceneFog) return;

    // Only modify density if we're not in ANY fog transition
    if (!isFadingIn && !isFadingOut && !isInterpolatingFog && sceneFog) {
        // Subtly change fog density based on position
        const positionFactor = (Math.sin(playerPosition.x * 0.001) + Math.sin(playerPosition.z * 0.001)) * 0.5;
        const baseDensity = fogConfig.density;
        const densityVariation = baseDensity * 0.2; // 20% variation

        sceneFog.density = baseDensity + (positionFactor * densityVariation);
    }

    // Handle wind effect - color changes can happen during transitions
    if (windData && fogConfig.enableWindEffect !== false) {
        const windStrength = Math.min(1, windData.speed / 10);
        const baseColor = new THREE.Color(fogConfig.color);
        const windyColor = fogConfig.windEffectColor
            ? new THREE.Color(fogConfig.windEffectColor)
            : new THREE.Color(baseColor).multiplyScalar(0.7);
        const effectStrength = fogConfig.windEffectStrength !== undefined
            ? fogConfig.windEffectStrength
            : 0.2;
        const finalColor = new THREE.Color().lerpColors(baseColor, windyColor, effectStrength);
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
 * Toggles fog on/off or explicitly sets fog state
 * @param {boolean} [fadeIn] - If provided, explicitly sets whether to fade in (true) or fade out (false)
 * @returns {boolean} - New fog state (true = enabled)
 */
export function toggleFog(fadeIn) {
    // If fadeIn parameter is provided, use it to determine the action
    if (fadeIn !== undefined) {
        // Check if this is already our target state
        if (fadeIn === targetFogState) {
            console.log(`Fog is already ${fadeIn ? 'fading in/on' : 'fading out/off'}, ignoring redundant call`);
            return targetFogState;
        }

        // Set the new target state
        targetFogState = fadeIn;

        // Interruption handling: Cancel any ongoing effects in the opposite direction
        if (fadeIn && isFadingOut) {
            console.log("Interrupting fade-out to start fade-in");
            isFadingOut = false;
        } else if (!fadeIn && isFadingIn) {
            console.log("Interrupting fade-in to start fade-out");
            isFadingIn = false;
        }

        if (fadeIn) {
            // Explicitly fade in
            console.log("Explicit fade in triggered");

            // Create new fog with zero density if it doesn't exist
            if (!scene.fog) {
                sceneFog = new THREE.FogExp2(fogConfig.color, 0);
                scene.fog = sceneFog;
            }

            isFadingIn = true;

            fadeInFog({
                duration: 10000,
                onComplete: () => {
                    console.log("Fog has faded in");
                    isFadingIn = false;
                }
            });

            return true;
        } else {
            // Explicitly fade out
            console.log("Explicit fade out triggered");

            if (scene.fog) {
                isFadingOut = true;

                dissipateFog({
                    duration: 5000,
                    onComplete: () => {
                        console.log("Fog has dissipated");
                        isFadingOut = false;
                    }
                });
            }

            return false;
        }
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
export function setFogProperties(config = {}) {
    // If no fog exists, create it
    if (!scene.fog) {
        const newConfig = { ...fogConfig, ...config };
        setupFog(newConfig);
        return { ...fogConfig };
    }

    // Otherwise just update existing fog properties
    if (config.color !== undefined) {
        setFogColor(config.color);
    }

    /*if (config.density !== undefined) {
        setFogDensity(config.density);
    }*/

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
    const startTime = Date.now();

    // Create the effect object
    const effect = {
        update: function (deltaTime) {
            if (!sceneFog) return false; // Ensure sceneFog exists

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
                scene.fog = null;

                //console.log("Fog dissipation complete, fog removed");

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
 * Makes fog gradually fade in by increasing density from zero
 * @param {Object} options - Optional configuration
 * @param {number} [options.duration=3000] - Duration in milliseconds
 * @param {number} [options.targetDensity] - Target fog density (uses default if not specified)
 * @param {Function} [options.onComplete] - Callback when complete
 */
export function fadeInFog(options = {}) {
    // Configuration
    const duration = options.duration || 3000;
    const targetDensity = options.targetDensity || DEFAULT_FOG_CONFIG.density;
    const onComplete = options.onComplete || (() => { });

    console.log("Starting fog fade-in effect...");

    // Ensure fog exists with zero density
    if (!scene.fog) {
        sceneFog = new THREE.FogExp2(
            options.color || DEFAULT_FOG_CONFIG.color,
            0 // Start with zero density (invisible)
        );
        scene.fog = sceneFog;
    } else {
        sceneFog = scene.fog;
        // Set initial density to 0 for fade-in
        sceneFog.density = 0;
    }

    // Store starting time
    const startTime = Date.now();

    // Create the effect object
    const effect = {
        update: function (deltaTime) {
            if (!sceneFog) return false; // Ensure sceneFog exists

            // Calculate progress
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Increase density from 0 to target value
            sceneFog.density = targetDensity * progress;

            // Log occasionally
            if (Math.random() < 0.01) {
                console.log(`Fog fade-in: ${Math.round(progress * 100)}%, density=${sceneFog.density.toFixed(5)}`);
            }

            // Complete?
            if (progress >= 1) {
                // Set final density
                sceneFog.density = targetDensity;

                // Update config to match
                fogConfig.density = targetDensity;
                if (options.color) fogConfig.color = options.color;

                console.log("Fog fade-in complete, final density:", targetDensity);

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
 * Toggles fog fade-in and fade-out
 */
export function toggleFogEffect() {
    if (isFadingIn || isFadingOut) {
        // If currently fading, toggle the state
        isFadingIn = !isFadingIn;
        isFadingOut = !isFadingOut;
    } else {
        // Start fading in if no effect is active
        isFadingIn = true;
        fadeInFog({
            duration: 5000,
            onComplete: () => {
                console.log("Fog has faded in");
                isFadingIn = false;
            }
        });
    }

    if (isFadingOut) {
        console.log("Fade out should trigger");
        dissipateFog({
            duration: 5000,
            onComplete: () => {
                console.log("Fog has dissipated");
                isFadingOut = false;
            }
        });
    }
}

/**
 * Update fog settings with new values
 * @param {Object} settings - New fog settings to apply
 * @param {THREE.Color} settings.color - Fog color
 * @param {number} settings.density - Fog density (for FogExp2)
 * @param {number} settings.near - Near plane (for regular Fog)
 * @param {number} settings.far - Far plane (for regular Fog)
 */
function updateFogSettings(settings) {
    if (!scene) {
        console.warn("Scene not available for fog settings update");
        return;
    }

    console.log("Updating fog settings:", settings);

    // Apply to existing fog
    if (scene.fog) {

        console.log("test 2");
        // Update color regardless of fog type
        if (settings.color) {
            scene.fog.color.copy(settings.color);
        }

        // Update other properties based on fog type
        if (scene.fog.isFogExp2) {
            console.log("test 3");
            if (settings.density !== undefined) {
                console.log("test 4");
                scene.fog.density = settings.density;
            }
        } else {
            // Regular Fog
            if (settings.near !== undefined) {
                scene.fog.near = settings.near;
            }
            if (settings.far !== undefined) {
                scene.fog.far = settings.far;
            }
        }
    } else {
        // No existing fog, create it if we have enough settings
        if (settings.density !== undefined) {
            // Create exponential fog
            scene.fog = new THREE.FogExp2(
                settings.color || new THREE.Color(0xcccccc),
                settings.density
            );
        } else if (settings.near !== undefined && settings.far !== undefined) {
            // Create regular fog
            scene.fog = new THREE.Fog(
                settings.color || new THREE.Color(0xcccccc),
                settings.near,
                settings.far
            );
        }
    }
}

/**
 * Get fog settings for a specific fog type
 * @param {string} type - Fog type
 * @returns {Object} Fog settings
 */
function getFogSettingsForType(type) {
    // Default fog settings
    const defaultSettings = {
        color: new THREE.Color(0xcccccc),
        density: 0.015,
        near: 10,
        far: 300
    };

    // Return imported settings based on type
    switch (type) {
        case 'volcanic':
            return VOLCANIC_FOG_CONFIG;
        case 'arctic':
            return ARCTIC_FOG_CONFIG;
        case 'open':
            return OPEN_FOG_CONFIG;
        default:
            return defaultSettings;
    }
}

/**
 * Interpolate between two colors
 * @param {THREE.Color} colorA - Starting color
 * @param {THREE.Color} colorB - Target color
 * @param {number} progress - Interpolation progress (0-1)
 * @returns {THREE.Color} Interpolated color
 */
function interpolateColor(colorA, colorB, progress) {
    const result = new THREE.Color();
    result.r = interpolateValue(colorA.r, colorB.r, progress);
    result.g = interpolateValue(colorA.g, colorB.g, progress);
    result.b = interpolateValue(colorA.b, colorB.b, progress);
    return result;
}

/**
 * Interpolate between two values
 * @param {number} a - Starting value
 * @param {number} b - Target value
 * @param {number} progress - Interpolation progress (0-1)
 * @returns {number} Interpolated value
 */
function interpolateValue(a, b, progress) {
    return a + (b - a) * progress;
}

/**
 * Transition between two different fog types
 * @param {string} fromType - Current fog type (e.g., 'volcanic')
 * @param {string} toType - Target fog type (e.g., 'arctic')
 * @param {number} duration - Transition duration in milliseconds
 */
function transitionFogType(fromType, toType, duration = 8000) {
    console.log(`Transitioning fog: ${fromType} → ${toType} over ${duration}ms`);

    // Get settings for both fog types
    const fromSettings = getFogSettingsForType(fromType);
    const toSettings = getFogSettingsForType(toType);

    // Set flag to prevent updateFog from overriding our settings
    isInterpolatingFog = true;

    // Store start time for interpolation
    const startTime = Date.now();

    // Clear any existing transition
    if (fogTransitionInterval) {
        clearInterval(fogTransitionInterval);
        fogTransitionInterval = null;
    }

    // Start the transition
    fogTransitionInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1); // 0 to 1

        // Interpolate between the fog settings
        const currentColor = interpolateColor(
            fromSettings.color,
            toSettings.color,
            progress
        );

        const currentDensity = interpolateValue(
            fromSettings.density,
            toSettings.density,
            progress
        );

        const currentNear = interpolateValue(
            fromSettings.near,
            toSettings.near,
            progress
        );

        const currentFar = interpolateValue(
            fromSettings.far,
            toSettings.far,
            progress
        );

        // Apply interpolated settings - important to use all computed values
        updateFogSettings({
            color: currentColor,
            density: currentDensity,
            near: currentNear,
            far: currentFar
        });

        // Complete the transition
        if (progress >= 1) {
            clearInterval(fogTransitionInterval);
            fogTransitionInterval = null;
            activeType = toType;

            // Update the fog config to match the target settings
            fogConfig = { ...fogConfig, ...toSettings };

            // Reset the interpolation flag
            isInterpolatingFog = false;

            console.log(`Fog transition to ${toType} complete`);
        }
    }, 16); // Update roughly every frame at 60fps
}

// Don't forget to export the new function
export {
    // ... existing exports
    transitionFogType,
    getFogSettingsForType,
    updateFogSettings
};