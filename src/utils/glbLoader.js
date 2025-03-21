import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { visibleDistance } from '../world/chunkControl.js'; // Import the visibility constant

// Variables to track loading state for different models
const modelLoadedStatus = {};
const modelLoadingStatus = {};

/**
 * Loads a GLB model with LOD support
 * @param {THREE.Group} targetGroup - The group to add the loaded model to
 * @param {Object} config - Configuration for the model loading
 */
export function loadGLBModel(targetGroup, config) {
    const {
        modelId,
        modelUrl,
        scaleValue,
        position = [0, 0, 0],
        rotation = [0, 0, 0],
        animationSetup,
        fallbackConfig
    } = config;

    // Don't load if already loaded or currently loading
    if (modelLoadedStatus[modelId] || modelLoadingStatus[modelId]) return;

    // Set loading flag to prevent concurrent load attempts
    modelLoadingStatus[modelId] = true;

    // Create a GLTF loader
    const loader = new GLTFLoader();

    // Get position from config
    const [posX, posY, posZ] = position;

    // Get rotation - support both single value and array formats
    let rotX = 0, rotY = rotation[1], rotZ = 0;
    if (Array.isArray(rotation)) {
        [rotX, rotY, rotZ] = rotation;
    }

    loader.load(
        modelUrl,
        // Success callback
        function (gltf) {
            const model = gltf.scene;

            // Add LOD system
            const lod = new THREE.LOD();

            // Add highest detail model with CONFIG SCALE, POSITION AND ROTATION
            model.scale.set(scaleValue, scaleValue, scaleValue);
            model.position.set(posX, posY, posZ);
            model.rotation.set(rotX, rotY, rotZ);
            lod.addLevel(model, 0);  // Highest detail at close range

            // Create simplified version for distance (with same transforms)
            const simplifiedModel = model.clone();
            simplifiedModel.traverse(child => {
                if (child.isMesh && child.geometry) {
                    // Remove unnecessary details for distant view
                    if (child.name.includes('detail') || child.name.includes('accessory')) {
                        child.visible = false;
                    }
                }
            });

            // Use visibleDistance from chunkControl.js to match view distance
            lod.addLevel(simplifiedModel, visibleDistance * 0.5);  // Medium detail at half visible distance

            // For huge islands, we don't want the tiny box representation at all
            if (modelId && modelId.includes('huge_island')) {
                // For huge islands, don't add the box level - keep detailed model visible from all distances
                // This ensures huge islands are always visible when their chunk is loaded

                // Also disable frustum culling for huge islands to ensure visibility
                model.traverse(child => {
                    if (child.isMesh) {
                        child.frustumCulled = false;
                    }
                });
                simplifiedModel.traverse(child => {
                    if (child.isMesh) {
                        child.frustumCulled = false;
                    }
                });
            } else {
                // For regular models, add a box level at visible distance
                const boxGeometry = new THREE.BoxGeometry(6, 2, 12);
                const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
                const boxModel = new THREE.Mesh(boxGeometry, boxMaterial);
                boxModel.position.set(posX, posY, posZ);
                boxModel.rotation.set(rotX, rotY, rotZ);
                lod.addLevel(boxModel, visibleDistance);  // Low detail at full visible distance
            }

            // Add LOD to target group
            targetGroup.add(lod);

            // Add custom animations if animation setup function provided
            if (animationSetup && typeof animationSetup === 'function') {
                const animationControls = animationSetup(model);
                if (animationControls) {
                    targetGroup.userData.animationControls = animationControls;

                    // Add to a global update list if not exists
                    if (!window.animationControls) window.animationControls = [];
                    window.animationControls.push(animationControls);
                }
            }

            // Handle animations if present
            if (gltf.animations && gltf.animations.length) {
                const mixer = new THREE.AnimationMixer(model);
                const animation = mixer.clipAction(gltf.animations[0]);
                animation.play();

                model.userData.mixer = mixer;

                if (!window.modelMixers) window.modelMixers = [];
                window.modelMixers.push(mixer);
            }

            // Set flags to indicate model is loaded and no longer loading
            modelLoadedStatus[modelId] = true;
            modelLoadingStatus[modelId] = false;
        },
        // Progress callback
        function (xhr) {
            if (xhr.lengthComputable) {
                const percentComplete = xhr.loaded / xhr.total * 100;
                // Progress tracking can be implemented here if needed
            }
        },
        // Error callback
        function (error) {
            console.error(`Error loading model ${modelId}:`, error);

            // Reset loading flag but don't mark as loaded
            modelLoadingStatus[modelId] = false;

            // Try loading the fallback model if provided
            if (fallbackConfig) {
                const {
                    modelUrl: fallbackUrl,
                    scaleValue: fallbackScale,
                    position: fallbackPosition = [0, 0, 0],
                    rotation: fallbackRotation = [0, 0, 0]
                } = fallbackConfig;

                const [fbPosX, fbPosY, fbPosZ] = fallbackPosition;

                // Get fallback rotation
                let fbRotX = 0, fbRotY = fallbackRotation[1], fbRotZ = 0;
                if (Array.isArray(fallbackRotation)) {
                    [fbRotX, fbRotY, fbRotZ] = fallbackRotation;
                }

                loader.load(
                    fallbackUrl,
                    function (gltf) {
                        const model = gltf.scene;
                        model.scale.set(fallbackScale, fallbackScale, fallbackScale);
                        model.position.set(fbPosX, fbPosY, fbPosZ);
                        model.rotation.set(fbRotX, fbRotY, fbRotZ);
                        targetGroup.add(model);
                        modelLoadedStatus[modelId] = true;
                    },
                    null,
                    function (fallbackError) {
                        console.error(`Error loading fallback model for ${modelId}:`, fallbackError);
                    }
                );
            }
        }
    );
}

/**
 * Check if a model is loaded
 * @param {string} modelId - The unique identifier for the model
 * @returns {boolean} Whether the model is loaded
 */
export function isModelLoaded(modelId) {
    return !!modelLoadedStatus[modelId];
}

/**
 * Check if a model is currently loading
 * @param {string} modelId - The unique identifier for the model
 * @returns {boolean} Whether the model is currently loading
 */
export function isModelLoading(modelId) {
    return !!modelLoadingStatus[modelId];
}

/**
 * Reset the loading state for a model
 * @param {string} modelId - The unique identifier for the model
 */
export function resetModelLoadingState(modelId) {
    modelLoadedStatus[modelId] = false;
    modelLoadingStatus[modelId] = false;
} 