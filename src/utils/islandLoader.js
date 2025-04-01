import * as THREE from 'three';
import { loadGLBModel } from './glbLoader.js';

/**
 * Loads a GLB model and enhances its visibility by brightening materials
 * @param {THREE.Object3D} parent - Parent object to add the model to
 * @param {Object} options - Model loading options
 * @param {Function} onComplete - Optional callback when model loading completes
 * @returns {Promise} Promise that resolves when the model is loaded
 */
export function loadBrightenedModel(parent, options, onComplete) {
    // Use the original loadGLBModel with original options
    return loadGLBModel(parent, options, (success) => {
        if (success) {
            // Apply brightness enhancement to all meshes after successful load
            parent.traverse(child => {
                if (child.isMesh && child.material) {
                    // Handle both single materials and arrays
                    const materials = Array.isArray(child.material) ? child.material : [child.material];

                    materials.forEach(material => {
                        // Clone the material to avoid modifying shared materials
                        const newMaterial = material.clone();

                        // Directly set a much brighter color (forced approach)
                        if (newMaterial.map) {
                            // If there's a texture, we can't just change the color.
                            // Instead, we'll create a bright emissive glow
                            newMaterial.emissive = new THREE.Color(0.8, 0.8, 0.8);
                            newMaterial.emissiveIntensity = 0.7;
                            newMaterial.emissiveMap = newMaterial.map;
                        } else if (newMaterial.color) {
                            // For materials without textures, maximize brightness
                            const baseColor = newMaterial.color.clone();
                            // Amplify each RGB channel while preserving some of the original color
                            newMaterial.color.setRGB(
                                Math.min(baseColor.r * 3, 1.0),
                                Math.min(baseColor.g * 3, 1.0),
                                Math.min(baseColor.b * 3, 1.0)
                            );
                        }

                        // Apply the modified material
                        if (Array.isArray(child.material)) {
                            // Replace in the array at the same index
                            child.material[materials.indexOf(material)] = newMaterial;
                        } else {
                            child.material = newMaterial;
                        }
                    });


                }
            });

        }

        // Call onComplete callback if provided
        if (onComplete && typeof onComplete === 'function') {
            onComplete(success);
        }
    });
} 