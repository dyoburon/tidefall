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
 * @param {Function} onComplete - Optional callback when model loading completes
 */
export function loadGLBModel(targetGroup, config, onComplete) {
    const {
        modelId,
        modelUrl,
        scaleValue,
        position = [0, 0, 0],
        rotation = [0, 0, 0],
        animationSetup,
        fallbackConfig,
        isOtherPlayer = false
    } = config;

    // Don't load if already loaded or currently loading
    if (modelLoadedStatus[modelId]) {
        // If already loaded, just call the completion callback immediately
        if (onComplete && typeof onComplete === 'function') {
            onComplete(true); // true = success
        }
        return;
    }

    if (modelLoadingStatus[modelId]) return;

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

            // Make sure simplified model has the same orientation as the detailed model
            simplifiedModel.position.copy(model.position);
            simplifiedModel.rotation.copy(model.rotation);
            simplifiedModel.scale.copy(model.scale);

            // Use visibleDistance from chunkControl.js to match view distance
            lod.addLevel(simplifiedModel, visibleDistance * 0.5);  // Medium detail at half visible distance

            // For huge islands or portals, we don't want the tiny box representation at all
            if (modelId && (modelId.includes('huge_island') || modelId.includes('portal'))) {
                // For huge islands and portals, don't add the box level - keep detailed model visible from all distances
                // This ensures they are always visible when their chunk is loaded

                // Also disable frustum culling to ensure visibility
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

                // Apply rotation to box model (same for all cases, just being explicit)
                boxModel.rotation.set(rotX, rotY, rotZ);

                lod.addLevel(boxModel, visibleDistance);  // Low detail at full visible distance
            }

            // Store the isOtherPlayer flag in userData for future reference
            lod.userData.isOtherPlayer = isOtherPlayer;

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

            // Call completion callback if provided
            if (onComplete && typeof onComplete === 'function') {
                onComplete(true); // true = success
            }
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

                        // Call completion callback if provided
                        if (onComplete && typeof onComplete === 'function') {
                            onComplete(true); // true = success with fallback
                        }
                    },
                    null,
                    function (fallbackError) {
                        console.error(`Error loading fallback model for ${modelId}:`, fallbackError);

                        // Call completion callback with error status
                        if (onComplete && typeof onComplete === 'function') {
                            onComplete(false); // false = complete failure
                        }
                    }
                );
            } else {
                // Call completion callback with error status if no fallback
                if (onComplete && typeof onComplete === 'function') {
                    onComplete(false); // false = failure
                }
            }
        }
    );
}

/**
 * Unloads a GLB model and cleans up associated resources
 * @param {String} modelId - The ID of the model to unload
 * @param {THREE.Object3D} modelObject - The object containing the model (typically a Group or Mesh)
 */
export function unloadGLBModel(modelId, modelObject) {
    // If no model object provided, just clean up the loading status
    if (!modelObject) {
        delete modelLoadedStatus[modelId];
        delete modelLoadingStatus[modelId];
        return;
    }

    // Clean up any animations
    if (modelObject.userData && modelObject.userData.animationControls) {
        const animControl = modelObject.userData.animationControls;

        // Stop animations
        if (animControl.mixer) {
            animControl.mixer.stopAllAction();
        }

        // Remove from global animation controls if exists
        if (window.animationControls) {
            const index = window.animationControls.indexOf(animControl);
            if (index !== -1) {
                window.animationControls.splice(index, 1);
            }
        }
    }

    // Recursively dispose of geometries and materials
    modelObject.traverse((child) => {
        if (child.geometry) {
            child.geometry.dispose();
        }

        if (child.material) {
            // Handle array of materials
            if (Array.isArray(child.material)) {
                child.material.forEach(material => {
                    disposeMaterial(material);
                });
            } else {
                // Handle single material
                disposeMaterial(child.material);
            }
        }

        // If it's an LOD object, make sure to clean up all levels
        if (child instanceof THREE.LOD) {
            for (let i = 0; i < child.levels.length; i++) {
                const level = child.levels[i];
                if (level && level.object) {
                    level.object.traverse(subChild => {
                        if (subChild.geometry) {
                            subChild.geometry.dispose();
                        }
                        if (subChild.material) {
                            disposeMaterial(subChild.material);
                        }
                    });
                }
            }
        }
    });

    // Remove from loading statuses
    delete modelLoadedStatus[modelId];
    delete modelLoadingStatus[modelId];
}

/**
 * Helper function to dispose of a material and its textures
 * @param {THREE.Material} material - The material to dispose
 */
function disposeMaterial(material) {
    // Dispose textures
    for (const key in material) {
        const value = material[key];
        if (value && typeof value === 'object' && 'isTexture' in value) {
            value.dispose();
        }
    }

    // Dispose material
    material.dispose();
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