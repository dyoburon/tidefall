import * as THREE from 'three';

/**
 * A utility class for applying cartoon-style outlines and other visual styles to 3D objects
 */
export class StyleSystem {
    /**
     * Create a new style system
     * @param {Object} options - Configuration options for the style system
     * @param {THREE.Material} options.outlineMaterial - Custom outline material (optional)
     * @param {number} options.defaultOutlineScale - Default scale factor for outlines (optional, default: 1.15)
     * @param {boolean} options.autoDispose - Whether to dispose of materials when removing styles (optional, default: true)
     */
    constructor(options = {}) {
        // Default outline material (black with backside rendering)
        this.outlineMaterial = options.outlineMaterial ||
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                side: THREE.BackSide
            });

        this.defaultOutlineScale = options.defaultOutlineScale || 1.15;
        this.autoDispose = options.autoDispose !== undefined ? options.autoDispose : true;

        // Registry of styled objects for management
        this._registry = new Map();
    }

    /**
     * Apply cartoon-style outline to a 3D object
     * @param {THREE.Object3D} object - The object to apply the outline to
     * @param {Object} options - Outline options
     * @param {number} options.scale - Scale factor for outline (optional, default: this.defaultOutlineScale)
     * @param {THREE.Material} options.material - Custom material for this specific outline (optional)
     * @param {boolean} options.recursive - Apply to all descendants (optional, default: false)
     * @param {Function} options.filter - Function to filter which objects get outlined (optional)
     * @returns {Array} - Array of added outline meshes
     */
    applyOutline(object, options = {}) {
        const outlineScale = options.scale || this.defaultOutlineScale;
        const outlineMaterial = options.material || this.outlineMaterial;
        const recursive = options.recursive || false;
        const filter = options.filter || (() => true);

        const addedOutlines = [];

        if (recursive) {
            // Apply to object and all descendants that pass the filter
            object.traverse((child) => {
                if (child.isMesh && filter(child)) {
                    const outline = this._createOutlineForMesh(child, outlineMaterial, outlineScale);
                    if (outline) {
                        addedOutlines.push(outline);
                    }
                }
            });
        } else if (object.isMesh && filter(object)) {
            // Apply only to the main object if it's a mesh
            const outline = this._createOutlineForMesh(object, outlineMaterial, outlineScale);
            if (outline) {
                addedOutlines.push(outline);
            }
        } else if (object.isGroup || object.isObject3D) {
            // If it's a group, apply to immediate children that are meshes
            object.children.forEach(child => {
                if (child.isMesh && filter(child)) {
                    const outline = this._createOutlineForMesh(child, outlineMaterial, outlineScale);
                    if (outline) {
                        addedOutlines.push(outline);
                    }
                }
            });
        }

        return addedOutlines;
    }

    /**
     * Create an outline mesh for a given mesh
     * @private
     * @param {THREE.Mesh} mesh - The mesh to outline
     * @param {THREE.Material} material - Material to use for the outline
     * @param {number} scale - Scale factor for the outline
     * @returns {THREE.Mesh} The created outline mesh
     */
    _createOutlineForMesh(mesh, material, scale) {
        // Skip if the mesh already has an outline registered
        const meshId = mesh.uuid;
        if (this._registry.has(meshId)) {
            return null;
        }

        // Create outline mesh with same geometry but slightly larger
        const outlineMesh = new THREE.Mesh(
            mesh.geometry,
            material
        );

        // Copy transformations but with larger scale
        outlineMesh.position.copy(mesh.position);
        outlineMesh.rotation.copy(mesh.rotation);
        outlineMesh.scale.copy(mesh.scale).multiplyScalar(scale);

        // Add outline to the same parent
        if (mesh.parent) {
            // Add outline first so it renders behind the main mesh
            mesh.parent.add(outlineMesh);

            // Store in registry for management
            this._registry.set(meshId, {
                original: mesh,
                outline: outlineMesh,
                parent: mesh.parent
            });

            return outlineMesh;
        }

        return null;
    }

    /**
     * Remove outlines from an object or objects
     * @param {THREE.Object3D|Array} objects - The object(s) to remove outlines from
     * @param {Object} options - Options for removal
     * @param {boolean} options.recursive - Remove from all descendants (optional, default: false)
     */
    removeOutline(objects, options = {}) {
        // Safety check for undefined objects
        if (!objects) return;

        const objArray = Array.isArray(objects) ? objects.filter(obj => obj) : [objects];
        const recursive = options.recursive || false;

        objArray.forEach(obj => {
            if (!obj) return; // Skip undefined objects

            try {
                if (recursive) {
                    // Add a null check BEFORE trying to access traverse
                    if (obj && typeof obj.traverse === 'function') {
                        /*obj.traverse(child => {
                            if (child && child.isMesh) {
                                this._removeOutlineFromMesh(child);
                            }
                        });*/
                    } else {
                        // Fallback for objects without a traverse function
                        // Just try to remove the outline from this specific object
                        if (obj.isMesh) {
                            this._removeOutlineFromMesh(obj);
                        }
                    }
                } else if (obj.isMesh) {
                    this._removeOutlineFromMesh(obj);
                } else if ((obj.isGroup || obj.isObject3D) && obj.children) {
                    // Safety check to make sure children exists and is iterable
                    if (Array.isArray(obj.children)) {
                        obj.children.forEach(child => {
                            if (child && child.isMesh) {
                                this._removeOutlineFromMesh(child);
                            }
                        });
                    }
                }
            } catch (error) {

            }
        });
    }

    /**
     * Remove outline from a specific mesh
     * @private
     * @param {THREE.Mesh} mesh - The mesh to remove outline from
     */
    _removeOutlineFromMesh(mesh) {
        // Safety check - make sure mesh exists
        if (!mesh) return;

        const meshId = mesh.uuid;
        if (this._registry.has(meshId)) {
            const { outline, parent } = this._registry.get(meshId);

            if (parent && outline) {
                try {
                    parent.remove(outline);

                    // Dispose of geometry and materials if needed
                    if (this.autoDispose) {
                        if (outline.geometry && outline.geometry !== mesh.geometry) {
                            outline.geometry.dispose();
                        }

                        if (outline.material && outline.material !== this.outlineMaterial) {
                            if (Array.isArray(outline.material)) {
                                outline.material.forEach(mat => mat.dispose());
                            } else {
                                outline.material.dispose();
                            }
                        }
                    }
                } catch (error) {

                }
            }

            this._registry.delete(meshId);
        }
    }

    /**
     * Update outline positions to match their original objects
     * Useful when objects move or animate
     */
    update() {
        this._registry.forEach(({ original, outline }) => {
            if (original && outline) {
                outline.position.copy(original.position);
                outline.rotation.copy(original.rotation);
                outline.scale.copy(original.scale).multiplyScalar(
                    original.userData.outlineScale || this.defaultOutlineScale
                );

                // Update visibility to match original
                outline.visible = original.visible;
            }
        });
    }

    /**
     * Create themed outline materials with different colors
     * @param {Object} colorMap - Map of theme names to colors
     * @returns {Object} - Object with theme names mapped to materials
     */
    createThemedMaterials(colorMap) {
        const materials = {};

        for (const [name, color] of Object.entries(colorMap)) {
            materials[name] = new THREE.MeshBasicMaterial({
                color: color,
                side: THREE.BackSide
            });
        }

        return materials;
    }

    /**
     * Apply outlines to all meshes in a scene
     * @param {THREE.Scene} scene - The scene to apply outlines to
     * @param {Object} options - Options (same as applyOutline)
     */
    applyToScene(scene, options = {}) {
        scene.traverse(object => {
            if (object.isMesh) {
                this.applyOutline(object, options);
            }
        });
    }
}

/**
 * Default game-wide style system instance
 */
export const defaultStyleSystem = new StyleSystem();

/**
 * Convenience function to apply outline using the default style system
 * @param {THREE.Object3D} object - The object to apply outline to
 * @param {Object} options - Outline options
 * @returns {Array} - Array of added outline meshes
 */
export function applyOutline(object, options = {}) {
    return defaultStyleSystem.applyOutline(object, options);
}

/**
 * Convenience function to remove outline using the default style system
 * @param {THREE.Object3D} object - The object to remove outline from
 * @param {Object} options - Removal options
 */
export function removeOutline(object, options = {}) {
    defaultStyleSystem.removeOutline(object, options);
}

/**
 * Update all outlines managed by the default style system
 */
export function updateOutlines() {
    defaultStyleSystem.update();
} 