import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { scene, camera, renderer, getTime, getWindData } from '../core/gameState.js';
import { ToonWater } from './toonWater.js';

let waterMesh;
let waterNormals;
const waterSize = 5000; // Large water plane but not excessive
const waterSegments = 10; // Reduced from 1000 to improve performance and stability
let currentWaterStyle = 'realistic'; // Track current water style
let currentQualityLevel = 'medium'; // Track current quality level
let updateFrameSkip = 0; // Counter for skipping frames on updates
const MAX_UPDATE_SKIP = 2; // Skip every N frames for low-end devices

// Create and export waterShader object with wave parameters for other files to access
export const waterShader = {
    uniforms: {
        time: { value: 0 },
        waveSpeed: { value: 0.5 }, // Drastically reduced from 1000
        waveHeight: { value: 0.4 }, // Drastically reduced from 1000000
        flowDirection: { value: new THREE.Vector2(0, 0) }
    }
};

// Also expose waterShader on the window object for global access
window.waterShader = waterShader;

// Generate a procedural cartoony water normal map
function generateCartoonyWaterNormals() {
    // Get texture size based on quality level
    const textureSize = getQualityBasedTextureSize();
    const width = textureSize;
    const height = textureSize;
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Generate a more cartoony wave pattern
    // This creates larger, more rounded bumps with less detail
    for (let i = 0; i < size; i++) {
        const stride = i * 4;

        const x = i % width;
        const y = Math.floor(i / width);

        // Create smoother, more rounded wave patterns
        // Use multiple sine waves with different frequencies for a cartoony look
        const freq1 = 0.03;
        const freq2 = 0.07;
        const freq3 = 0.015;

        // More rounded, softer waves
        const nx = Math.sin(x * freq1) * 0.5 +
            Math.sin(x * freq2 + y * freq3) * 0.3 +
            Math.sin(y * freq1 * 2) * 0.2;

        const ny = Math.sin(y * freq1) * 0.5 +
            Math.sin(y * freq2 + x * freq3) * 0.3 +
            Math.sin(x * freq1 * 2) * 0.2;

        // Normalize and scale to 0-255 range
        const r = Math.floor((nx * 0.5 + 0.5) * 255);
        const g = Math.floor((ny * 0.5 + 0.5) * 255);
        const b = 255; // Full blue for height

        // Set RGBA values
        data[stride] = r;
        data[stride + 1] = g;
        data[stride + 2] = b;
        data[stride + 3] = 255; // Full alpha
    }

    // Create texture from data
    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;

    return texture;
}

// Get texture size based on quality level
function getQualityBasedTextureSize() {
    switch (currentQualityLevel) {
        case 'low':
            return 128;
        case 'medium':
            return 256;
        case 'high':
            return 512;
        case 'ultra':
            return 1024;
        default:
            return 256;
    }
}

// Get water size based on quality level
function getQualityBasedWaterSize() {
    switch (currentQualityLevel) {
        case 'low':
            return 3000;
        case 'medium':
            return 4000;
        case 'high':
            return 5000;
        case 'ultra':
            return 6000;
        default:
            return 4000;
    }
}

// Get water segments based on quality level
function getQualityBasedWaterSegments() {
    switch (currentQualityLevel) {
        case 'low':
            return 8;
        case 'medium':
            return 10;
        case 'high':
            return 12;
        case 'ultra':
            return 16;
        default:
            return 10;
    }
}

// Initialize the advanced water effect
export function setupWater(style = 'realistic') {
    // Set the current style
    currentWaterStyle = style;

    // Load normal map for detailed waves
    const textureLoader = new THREE.TextureLoader();

    // Always start with the standard water normals
    waterNormals = textureLoader.load(
        './waternormals.jpg',
        function (texture) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

            if (style === 'cartoony' || style === 'toon') {
                texture.repeat.set(2, 2); // Larger pattern repeats for stylized water
            } else {
                texture.repeat.set(1, 1); // Standard repeats for realistic style
            }

            // If cartoony style and water mesh exists, we can optionally replace with procedural
            if (style === 'cartoony' && waterMesh) {
                // Uncomment the below line to use procedural normals instead
                // const proceduralTexture = generateCartoonyWaterNormals();
                // waterMesh.material.uniforms.normalSampler.value = proceduralTexture;
            }
        },
        undefined,
        function (err) {
            console.error('Error loading water normals');
        }
    );

    // Get quality-based parameters
    const adaptiveWaterSize = getQualityBasedWaterSize();
    const adaptiveWaterSegments = getQualityBasedWaterSegments();
    const textureSize = getQualityBasedTextureSize();

    // Configure water properties - use quality-based parameters
    const waterGeometry = new THREE.PlaneGeometry(
        adaptiveWaterSize,
        adaptiveWaterSize,
        adaptiveWaterSegments,
        adaptiveWaterSegments
    );

    // Style-specific water parameters
    let waterColor, distortionScale, alpha;

    // Set parameters based on style
    switch (style) {
        case 'toon':
            // Brighter, more saturated blue for toon style
            waterColor = 0x4499ff; // Medium bright blue for cell-shading
            distortionScale = 4.5; // Medium wave distortion
            alpha = 1.0; // Full opacity
            break;

        case 'cartoony':
            // Bright, saturated blue for cartoony look
            waterColor = 0x33ccff; // Bright cyan-blue
            distortionScale = 5.0; // More exaggerated waves
            alpha = 1.0; // Keep full opacity to ensure water is visible
            break;

        default: // 'realistic'
            // Original realistic parameters
            waterColor = 0x001e4d; // Slightly brighter dark blue
            distortionScale = 3.7; // Standard waves
            alpha = 1.0; // Standard opacity
            break;
    }

    // Base water parameters - use quality-based texture size
    const waterOptions = {
        textureWidth: textureSize,
        textureHeight: textureSize,
        waterNormals: waterNormals,
        sunDirection: new THREE.Vector3(),
        sunColor: 0xffffff,
        waterColor: waterColor,
        distortionScale: distortionScale,
        fog: scene.fog !== undefined,
        alpha: alpha
    };

    // Create the appropriate water mesh based on style
    if (style === 'toon') {
        // Use our custom toon water for cell-shaded style
        waterMesh = new ToonWater(waterGeometry, waterOptions);
    } else {
        // Use standard water for realistic and cartoony styles
        waterMesh = new Water(waterGeometry, waterOptions);
    }

    // Make sure the water is above the default position slightly to ensure visibility
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -0.5; // Slightly below sea level for visibility

    // Enable frustum culling for performance
    waterMesh.frustumCulled = true;

    // Adjust additional properties based on style
    if (style === 'cartoony') {
        // Higher reflectivity for cartoony look
        if (waterMesh.material.uniforms.reflectivity) {
            waterMesh.material.uniforms.reflectivity.value = 0.8;
        }
    } else if (style === 'toon') {
        // Adjust toon-specific properties if available
        if (waterMesh.setToonSteps) {
            waterMesh.setToonSteps(4); // 4 discrete color steps for cell-shading
        }
        if (waterMesh.setHighlightIntensity) {
            waterMesh.setHighlightIntensity(0.3); // Medium highlight intensity
        }
        if (waterMesh.material.uniforms.reflectivity) {
            waterMesh.material.uniforms.reflectivity.value = 0.5; // Medium reflectivity
        }
    }

    // Update the waterShader uniforms for the boat floating calculation
    // This ensures our waterShader has the same parameters as the water mesh
    if (waterMesh.material.uniforms) {
        // Copy any relevant values from the water mesh uniforms
        if (waterMesh.material.uniforms.distortionScale) {
            waterShader.uniforms.waveHeight.value = waterMesh.material.uniforms.distortionScale.value * 0.2;
        }

        // Set wave speed based on style
        switch (style) {
            case 'toon':
                waterShader.uniforms.waveSpeed.value = 0.35;
                break;
            case 'cartoony':
                waterShader.uniforms.waveSpeed.value = 0.4;
                break;
            default: // 'realistic'
                waterShader.uniforms.waveSpeed.value = 0.35;
                break;
        }
    }

    // Add to scene
    scene.add(waterMesh);

    return waterMesh;
}

// Add safety check for water uniforms
function ensureWaterUniforms() {
    if (!waterMesh || !waterMesh.material || !waterMesh.material.uniforms) return;

    // Ensure all required uniforms exist and have valid values
    const requiredUniforms = {
        time: { value: 0 },
        distortionScale: { value: 3.7 },
        size: { value: 1.0 },
        waterColor: { value: new THREE.Color(0x001e4d) }
    };

    // Check and restore any missing uniforms
    Object.entries(requiredUniforms).forEach(([key, defaultValue]) => {
        if (!waterMesh.material.uniforms[key] || waterMesh.material.uniforms[key].value === undefined) {
            waterMesh.material.uniforms[key] = { value: defaultValue.value };
        }
    });
}

// Update water in animation loop
export function updateWater(deltaTime) {
    if (!waterMesh) return;

    // Ensure uniforms are valid before updating
    ensureWaterUniforms();

    // Frame skipping for performance - only update on certain frames
    updateFrameSkip = (updateFrameSkip + 1) % (MAX_UPDATE_SKIP + 1);

    // Skip updates on non-zero frames based on quality setting
    if (updateFrameSkip !== 0) {
        // For low quality, skip more updates
        if (currentQualityLevel === 'low' && updateFrameSkip !== MAX_UPDATE_SKIP) {
            // Still update position to follow camera
            waterMesh.position.x = camera.position.x;
            waterMesh.position.z = camera.position.z;
            return;
        }

        // For medium quality, skip some updates
        if (currentQualityLevel === 'medium' && updateFrameSkip === 1) {
            // Still update position to follow camera
            waterMesh.position.x = camera.position.x;
            waterMesh.position.z = camera.position.z;
            return;
        }
    }

    // Get current time for wave animation
    const time = getTime() * 0.001; // Convert to seconds and slow down

    // Access the water material parameters
    const waterUniforms = waterMesh.material.uniforms;

    // Style-specific animation speeds
    let animationSpeed;
    switch (currentWaterStyle) {
        case 'toon':
            animationSpeed = 0.35; // Medium animation speed for toon style
            break;
        case 'cartoony':
            animationSpeed = 0.4; // Faster for cartoony style
            break;
        default:
            animationSpeed = 0.35; // Standard for realistic
            break;
    }

    // Reduce animation speed for low quality
    if (currentQualityLevel === 'low') {
        animationSpeed *= 0.7;
    }

    // Update animation time
    waterUniforms.time.value += deltaTime * animationSpeed;

    // Update waterShader time for consistency between water and boat
    waterShader.uniforms.time.value = waterUniforms.time.value;

    // Get wind data to influence wave direction and intensity
    // Skip complex wind calculations on low quality
    if (currentQualityLevel !== 'low') {
        const wind = getWindData();

        // Wind influence based on style
        let windStrengthDivisor;
        if (currentWaterStyle === 'toon') {
            windStrengthDivisor = 8; // Medium wind influence for toon style
        } else if (currentWaterStyle === 'cartoony') {
            windStrengthDivisor = 10; // Less wind influence for cartoony style
        } else {
            windStrengthDivisor = 6; // More wind influence for realistic style
        }

        const windStrength = wind.speed / windStrengthDivisor;

        // Base distortion and multiplier values based on style
        let baseDistortion, multiplier;

        switch (currentWaterStyle) {
            case 'toon':
                baseDistortion = 3.5;
                multiplier = 2.0;
                break;
            case 'cartoony':
                baseDistortion = 4.0;
                multiplier = 1.5;
                break;
            default: // 'realistic'
                baseDistortion = 3.0;
                multiplier = 3.0;
                break;
        }

        // Adjust wave distortion based on wind and style
        waterUniforms.distortionScale.value = baseDistortion + windStrength * multiplier;

        // Update waterShader's waveHeight based on distortion scale
        waterShader.uniforms.waveHeight.value = waterUniforms.distortionScale.value * 0.2;

        // Update wave direction based on wind
        const windDirection = new THREE.Vector3(
            Math.sin(wind.direction),
            0,
            Math.cos(wind.direction)
        );

        // Apply slight offset to wave direction for natural look
        // Different styles have different wave uniformity
        let directionFactor;
        switch (currentWaterStyle) {
            case 'toon':
                directionFactor = 0.25; // Medium uniformity for toon style
                break;
            case 'cartoony':
                directionFactor = 0.2; // More uniform for cartoony style
                break;
            default:
                directionFactor = 0.3; // Less uniform for realistic style
                break;
        }

        const waveDirection = new THREE.Vector2(
            windDirection.x * directionFactor,
            windDirection.z * directionFactor
        );

        // Update wave direction in water uniforms
        if (waterUniforms.flowDirection) {
            waterUniforms.flowDirection.value.copy(waveDirection);
        }

        // Update the same in waterShader for boat physics
        waterShader.uniforms.flowDirection.value.copy(waveDirection);
    }

    // Update sun position and color
    if (scene.directionalLight) {
        waterUniforms.sunDirection.value.copy(scene.directionalLight.position).normalize();
    }

    // Time-based water color animation for stylized water
    // Skip color effects on low quality
    if ((currentWaterStyle === 'cartoony' || currentWaterStyle === 'toon') &&
        currentQualityLevel !== 'low') {
        let waterColor;

        if (currentWaterStyle === 'toon') {
            // Less color variation for toon style to emphasize cell-shading
            if (time % 24 < 6) { // Night
                waterColor = new THREE.Color(0x3377cc); // Medium blue at night
            } else if (time % 24 > 18) { // Evening
                waterColor = new THREE.Color(0x4488dd); // Medium-bright blue evening
            } else { // Day
                waterColor = new THREE.Color(0x4499ff); // Medium-bright blue day
            }
        } else { // 'cartoony'
            if (time % 24 < 6) { // Night
                waterColor = new THREE.Color(0x0066cc); // Deeper blue at night
            } else if (time % 24 > 18) { // Evening
                waterColor = new THREE.Color(0x00aaff); // Purple-blue evening
            } else { // Day
                waterColor = new THREE.Color(0x33ccff); // Bright cyan-blue day
            }
        }

        // Smoothly transition between colors
        const transitionSpeed = currentWaterStyle === 'toon' ? 0.5 : 0.8;
        waterUniforms.waterColor.value.lerp(waterColor, deltaTime * transitionSpeed);

        // Add a slight wobble to the water height for stylized effects
        // Skip for low quality settings
        if (currentQualityLevel !== 'low') {
            const bounceFactor = currentWaterStyle === 'toon' ? 0.01 : 0.02; // Less bounce for toon
            const bounceSpeed = currentWaterStyle === 'toon' ? 0.6 : 0.8;
            const bounceHeight = Math.sin(time * bounceSpeed) * bounceFactor;

            // Apply a subtle bounce but ensure water stays visible
            waterMesh.position.y = -0.5 + bounceHeight;
        }
    }

    // Make sure water follows camera on x/z
    waterMesh.position.x = camera.position.x;
    waterMesh.position.z = camera.position.z;
}

// Function to adjust water quality for performance
export function setWaterQuality(quality) {
    if (quality === currentQualityLevel) return; // No change needed

    currentQualityLevel = quality;

    // If water is already created, we need to recreate it with new quality settings
    if (waterMesh) {
        const currentStyle = currentWaterStyle;
        scene.remove(waterMesh);
        waterMesh = null;
        setupWater(currentStyle);
    }

    // Update update frequency based on quality
    switch (quality) {
        case 'low':
            MAX_UPDATE_SKIP = 3; // Update every 4th frame
            break;
        case 'medium':
            MAX_UPDATE_SKIP = 2; // Update every 3rd frame
            break;
        case 'high':
            MAX_UPDATE_SKIP = 1; // Update every 2nd frame
            break;
        case 'ultra':
            MAX_UPDATE_SKIP = 0; // Update every frame
            break;
        default:
            MAX_UPDATE_SKIP = 2; // Default to medium
    }
}

// Function to toggle between water styles
export function setWaterStyle(style = 'realistic') {
    if (style === currentWaterStyle) {
        return; // No change needed
    }

    // Remove current water mesh
    if (waterMesh) {
        scene.remove(waterMesh);
        waterMesh = null; // Clear the reference
    }

    // Setup new water with desired style
    setupWater(style);
}

// Function to optimize water rendering based on distance from camera
export function optimizeWaterForDistance() {
    if (!waterMesh) return;

    // Dynamically adjust LOD based on distance
    const distanceToCamera = camera.position.distanceTo(new THREE.Vector3(0, -0.5, 0));

    // Apply LOD optimizations
    if (distanceToCamera > 2000) {
        // Far away - lowest detail
        waterMesh.material.uniforms.size.value = 0.3;
    } else if (distanceToCamera > 1000) {
        // Medium distance - medium detail
        waterMesh.material.uniforms.size.value = 0.7;
    } else {
        // Close to camera - high detail
        waterMesh.material.uniforms.size.value = 1.0;
    }
} 