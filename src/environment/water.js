import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { scene, camera, renderer, getTime, getWindData } from '../core/gameState.js';

let waterMesh;
let waterNormals;
const waterSize = 500; // Water plane size
const waterSegments = 100; // Reduced for performance

// Create and export waterShader object with enhanced parameters
export const waterShader = {
    uniforms: {
        time: { value: 100.0 },
        waveSpeed: { value: 30.0 },
        waveHeight: { value: 1.0 },
        flowDirection: { value: new THREE.Vector2(0, 0) },

        // Wave control
        waveFrequency: { value: 5.0 }, // Controls how close together waves are
        turbulence: { value: 5.0 }, // Adds randomness to wave patterns

        // Foam parameters
        foamColor: { value: new THREE.Color(0xffffff) },
        foamStrength: { value: 0.2 },
        foamThreshold: { value: 0.8 }, // Where foam appears on waves

        // Depth color control
        deepColor: { value: new THREE.Color(0x001e0f) }, // Color of deep water
        shallowColor: { value: new THREE.Color(0x33ccff) }, // Color of shallow water
        depthScale: { value: 5.0 }, // How quickly color changes with depth

        // Wind effect
        windStrength: { value: 1.0 }, // How much wind affects the water
        windDirection: { value: new THREE.Vector2(1.0, 0.0) }, // Wind direction

        // Caustics (light patterns)
        causticsStrength: { value: 0.5 },
        causticsScale: { value: 0.3 },
        causticsSpeed: { value: 0.2 },

        // Reflection/Refraction control
        reflectionStrength: { value: 0.5 },
        refractionStrength: { value: 0.3 },

        // Environment interaction
        interactionScale: { value: 0.0 }, // How objects interact with water
        rippleSpeed: { value: 0.8 }, // How fast ripples spread
        rippleSize: { value: 0.2 } // Size of ripples
    }
};

// Also expose waterShader on the window object for global access
window.waterShader = waterShader;

// Initialize the water effect
export function setupWater() {
    // Load normal map for waves
    const textureLoader = new THREE.TextureLoader();

    waterNormals = textureLoader.load(
        './waternormals.jpg',
        function (texture) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);
        }
    );

    // Configure water
    const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, waterSegments, waterSegments);

    // Water parameters
    const waterOptions = {
        textureWidth: 2000,
        textureHeight: 2000,
        waterNormals: waterNormals,
        sunDirection: new THREE.Vector3(),
        sunColor: 0xffffff,
        waterColor: 0x33ccff, // Bright blue
        distortionScale: 5.0, // Enhanced waves
        fog: scene.fog !== undefined,
        alpha: 1.0
    };

    // Create water mesh
    waterMesh = new Water(waterGeometry, waterOptions);

    // Position the water
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -0.5;

    // Add to scene
    //scene.add(waterMesh);

    // Set enhanced properties on the water material
    if (waterMesh.material.uniforms) {
        if (waterMesh.material.uniforms.reflectivity) {
            waterMesh.material.uniforms.reflectivity.value = 0.8;
        }

    }

    return waterMesh;
}

// Update water in animation loop
export function updateWater(deltaTime) {
    if (!waterMesh) return;

    const time = getTime();

    // Update time uniform
    waterShader.uniforms.time.value = time * 0.1;

    // Update water mesh time if available
    if (waterMesh.material.uniforms.time) {
        waterMesh.material.uniforms.time.value = time * 0.1;
    }

    if (waterMesh.geometry) {
        const positions = waterMesh.geometry.attributes.position.array;
        const time = getTime() * 0.1;
        const waveHeight = 10.0; // Fixed height for testing


        /*
        for (let i = 0; i < positions.length; i += 3) {
            // Create a simple sine wave pattern
            positions[i + 1] = Math.sin(i * 0.05 + time) * waveHeight;
        }*/

        // This is CRITICAL - it tells Three.js to update the geometry
        waterMesh.geometry.attributes.position.needsUpdate = true;
        waterMesh.geometry.computeVertexNormals();
    }

    // Get wind data and update flow direction
    const windData = getWindData();
    if (windData) {
        waterShader.uniforms.flowDirection.value.set(
            windData.direction.x * windData.speed * 0.01,
            windData.direction.z * windData.speed * 0.01
        );

        // Update wind-related uniforms
        waterShader.uniforms.windStrength.value = windData.speed * 0.1;
        waterShader.uniforms.windDirection.value.set(
            windData.direction.x,
            windData.direction.z
        );
    }

    // Apply any dynamic wave height adjustments
    // For example, increase wave height in stormy conditions
    if (windData && windData.speed > 10) {
        waterShader.uniforms.waveHeight.value = 5 + (windData.speed - 10) * 0.5;
        waterShader.uniforms.turbulence.value = 1.25 + (windData.speed - 10) * 0.1;
    } else {
        waterShader.uniforms.waveHeight.value = 5;
        waterShader.uniforms.turbulence.value = 1.25;
    }
}

// Function to adjust water quality for performance
export function setWaterQuality(quality) {
    // Stop if no water mesh
    if (!waterMesh) return;

    // Remove old water
    scene.remove(waterMesh);

    // Adjust segments based on quality
    let newSegments;
    switch (quality) {
        case 'low':
            newSegments = 5;
            break;
        case 'medium':
            newSegments = 10;
            break;
        case 'high':
            newSegments = 20;
            break;
        default:
            newSegments = 10;
    }

    // Re-create water with new segment count
    setupWater();
}

export function setWaterStyle(style) {
    return;
}
export function createWaterControls() {
    return;
}
