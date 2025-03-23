import * as THREE from 'three';
import { applyOutline } from '../theme/outlineStyles.js';
import { scene } from '../core/gameState.js';
import { loadGLBModel } from '../utils/glbLoader.js';
import { applyGLBOutline, updateOutlineSettings } from '../utils/glbOutlineEffects.js';
import { visibleDistance } from './chunkControl.js';

// Constants for huge island generation
const HUGE_ISLAND_SIZE = 1000; // Much larger than regular islands

// Array to store huge island colliders for collision detection
const hugeIslandColliders = [];

// Map to track active huge islands
const activeHugeIslands = new Map();

/**
 * Creates a huge island by loading an island1.glb model
 * @param {number} x - X coordinate in the world
 * @param {number} z - Z coordinate in the world
 * @param {number} seed - Seed for random generation
 * @param {THREE.Group} chunkGroup - The chunk group to add the island to
 * @returns {Object} - The created island entry with mesh and collider info
 */
export function createHugeIsland(x, z, seed, chunkGroup) {
    console.log(`Creating huge island at (${x}, ${z}) with seed ${seed}`);

    // Create a deterministic random function based on the seed
    const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    // Generate unique island ID
    const islandId = `huge_island_${Math.floor(x)}_${Math.floor(z)}`;

    // Skip if this island already exists
    if (activeHugeIslands.has(islandId)) {
        console.log(`Island ${islandId} already exists, returning existing instance`);
        return activeHugeIslands.get(islandId);
    }

    // Island radius - much larger than regular islands
    const baseRadius = HUGE_ISLAND_SIZE;

    // Create island container
    const island = new THREE.Group();
    island.position.set(x, 0, z);

    // IMPORTANT: Add directly to scene instead of chunk group
    // This bypasses chunk-based visibility for huge islands
    scene.add(island);

    // Create island collider with larger radius
    const collider = {
        center: new THREE.Vector3(x, 0, z),
        radius: baseRadius * 3,
        id: islandId
    };
    hugeIslandColliders.push(collider);

    // Make the scale even larger for better visibility
    const scaleValue = 3000.0 + random() * 100.0; // Huge scale for better visibility
    const yOffset = 970;

    console.log(`Loading island model with scale ${scaleValue} at position [0, ${yOffset}, 0]`);

    // Island entry will be updated inside onLoad
    const islandEntry = {
        mesh: island,
        collider: collider,
        visible: true,
        addedToScene: true, // Flag to indicate it was added directly to scene
        glbMesh: null       // Will store the actual GLB mesh for collision
    };

    // Store the island with its ID and collider reference
    activeHugeIslands.set(islandId, islandEntry);

    try {
        // Randomly select between island1.glb and island2.glb with 50% probability
        const islandModel = random() < 0.5 ? '/island1.glb' : '/island2.glb';
        console.log(`Selected model: ${islandModel} for island ${islandId}`);

        // Load the GLB model with modified settings
        loadGLBModel(island, {
            modelId: islandId,
            modelUrl: islandModel,
            scaleValue: scaleValue,
            position: [0, yOffset, 0],
            rotation: [0, random() * Math.PI * 2, 0],
            animationSetup: null,
            onLoad: function (model, gltf) {
                console.log(`Successfully loaded island model for ${islandId}`);

                // Store the model in the islandEntry for collision purposes
                islandEntry.glbMesh = model;

                // You might also want to store the raw gltf scene for more detailed collision
                islandEntry.gltfScene = gltf.scene;

                // Apply extremely visible outline
                applyGLBOutline(model);

                // Then immediately update the outline settings to max visibility
                // Note: This assumes you added the updateOutlineSettings function to glbOutlineEffects.js
                updateOutlineSettings({
                    edgeStrength: 15.0,         // Super strong outline
                    visibleEdgeColor: 0xff0000, // Bright red
                    hiddenEdgeColor: 0xff0000,  // Also red for hidden parts
                    kernelSize: 3,              // Use numeric value instead of KernelSize.VERY_LARGE
                    blur: true
                });

                // Keep the existing marker sphere but make it larger
                const markerGeometry = new THREE.SphereGeometry(1000, 16, 16);
                const markerMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff00ff,    // Bright magenta
                    wireframe: true,
                    depthTest: false,   // Always visible
                    transparent: true,
                    opacity: 0.9        // Higher opacity
                });
                const sphereMarker = new THREE.Mesh(markerGeometry, markerMaterial);
                sphereMarker.position.y = 2000; // Higher above the island
                sphereMarker.frustumCulled = false;
                sphereMarker.renderOrder = 9999;
                island.add(sphereMarker);

                // Keep the beacon beam, but make it much larger
                const beamGeometry = new THREE.CylinderGeometry(300, 300, 15000, 8);
                const beamMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffff00,    // Bright yellow
                    wireframe: true,
                    transparent: true,
                    opacity: 0.9,
                    depthTest: false
                });
                const beam = new THREE.Mesh(beamGeometry, beamMaterial);
                beam.position.y = 7500; // Very high position
                beam.frustumCulled = false;
                beam.renderOrder = 9998;
                island.add(beam);

                // Ensure model and all meshes have frustumCulled disabled
                gltf.scene.traverse(child => {
                    if (child.isMesh) {
                        child.frustumCulled = false;
                        child.renderOrder = 1;

                        // Enhance materials without animation
                        if (child.material) {
                            const materials = Array.isArray(child.material) ?
                                child.material : [child.material];

                            materials.forEach(mat => {
                                mat.needsUpdate = true;
                                mat.depthWrite = true;
                                mat.depthTest = true;

                                // Make it glow a bit
                                if (mat.color) {
                                    mat.emissive = mat.color.clone();
                                    mat.emissiveIntensity = 0.3;
                                }
                            });
                        }
                    }
                });

                // Force matrix updates
                model.updateMatrix();
                model.updateMatrixWorld(true);
            },
            onError: function (error) {
                console.error(`Error loading island model: ${error}`);
            }
        });
    } catch (error) {
        console.error(`Exception during GLB loading: ${error}`);
    }

    // Removed shore effect for huge islands
    // Shore effects disabled for performance and visual clarity on huge islands

    console.log(`Island ${islandId} creation complete`);
    return islandEntry;
}

/**
 * Returns the list of all huge island colliders
 * @returns {Array} Array of huge island colliders
 */
export function getHugeIslandColliders() {
    return hugeIslandColliders;
}

/**
 * Clear and remove all huge islands
 */
export function clearHugeIslands() {
    hugeIslandColliders.length = 0;

    // Remove all huge islands from scene
    activeHugeIslands.forEach((islandEntry) => {
        if (islandEntry.mesh) {
            // Since we're adding directly to scene now
            if (islandEntry.addedToScene && scene) {
                scene.remove(islandEntry.mesh);
            } else if (islandEntry.mesh.parent) {
                islandEntry.mesh.parent.remove(islandEntry.mesh);
            }
        }

        if (islandEntry.shore && typeof removeShore === 'function') {
            removeShore(islandEntry.shore);
        }
    });

    activeHugeIslands.clear();
    console.log("All huge islands cleared");
}

// Add a getter for all island meshes
export function getHugeIslandMeshes() {
    return Array.from(activeHugeIslands.values())
        .filter(entry => entry.mesh)
        .map(entry => entry.mesh);
}