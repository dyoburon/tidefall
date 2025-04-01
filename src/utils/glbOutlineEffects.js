import * as THREE from 'three';
import {
    EffectComposer,
    EffectPass,
    RenderPass,
    OutlineEffect,
    SelectiveBloomEffect,
    KernelSize,
    BlendFunction,
    Selection
} from 'postprocessing';

/**
 * Manages shader-based outline effects specifically for GLB models
 * This is more performant and compatible than post-processing approaches
 */
export class GLBOutlineEffectManager {
    /**
     * Create a new shader-based outline effect manager for GLB models
     * @param {THREE.Scene} scene - The scene (not required but kept for API compatibility)
     * @param {THREE.Camera} camera - The camera (not required but kept for API compatibility)
     * @param {THREE.WebGLRenderer} renderer - The renderer (not required but kept for API compatibility)
     */
    constructor(scene, camera, renderer) {
        // Store these for API compatibility, but we don't actually need them for shader-based outlines
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // Store references to outlined objects
        this.outlinedObjects = new Map();

        // Define outline shader parameters
        this.outlineParameters = {
            outlineColor: new THREE.Color('#000000'),  // Black outline
            outlineThickness: 0.015,                  // Outline thickness
            outlineStrength: 1.0                      // Outline intensity
        };
    }

    /**
     * Add an object to be outlined using shader-based approach
     * @param {THREE.Object3D} object - The object to outline
     * @param {boolean} recursive - Whether to add all child objects recursively
     */
    addOutlineObject(object, recursive = false) {
        if (!object) return;

        const processObject = (obj) => {
            // Only apply to meshes
            if (!obj.isMesh) return;

            // Skip if already outlined
            if (this.outlinedObjects.has(obj.uuid)) return;

            // Clone the original materials for later restoration
            const originalMaterials = Array.isArray(obj.material) ?
                obj.material.map(m => m.clone()) :
                obj.material.clone();

            // Store original materials
            this.outlinedObjects.set(obj.uuid, {
                object: obj,
                originalMaterials: originalMaterials
            });

            // Apply outline shader to the materials
            if (Array.isArray(obj.material)) {
                obj.material = obj.material.map(mat => this._createOutlineMaterial(mat));
            } else {
                obj.material = this._createOutlineMaterial(obj.material);
            }

            // Make sure frustum culling is disabled for visibility at distance
            obj.frustumCulled = false;
        };

        if (recursive) {
            object.traverse(child => {
                processObject(child);
            });
        } else {
            processObject(object);
        }
    }

    /**
     * Create a material with outline shader
     * @private
     * @param {THREE.Material} originalMaterial - The original material to modify
     * @returns {THREE.ShaderMaterial} - The new shader material with outline
     */
    _createOutlineMaterial(originalMaterial) {
        // Skip if the material is already a shader material with our outline property
        if (originalMaterial.isShaderMaterial && originalMaterial._isOutlineMaterial) {
            return originalMaterial;
        }

        // Basic texture and color extraction from original material
        let map = null;
        let color = new THREE.Color(0xffffff);

        if (originalMaterial.map) map = originalMaterial.map;
        if (originalMaterial.color) color = originalMaterial.color;

        // Create a new shader material
        const outlineMaterial = new THREE.ShaderMaterial({
            uniforms: {
                // Pass textures from the original material
                map: { value: map },
                diffuse: { value: color },
                // Outline parameters
                outlineColor: { value: this.outlineParameters.outlineColor },
                outlineThickness: { value: this.outlineParameters.outlineThickness },
                outlineStrength: { value: this.outlineParameters.outlineStrength }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 diffuse;
                uniform vec3 outlineColor;
                uniform float outlineThickness;
                uniform float outlineStrength;
                uniform sampler2D map;
                
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    // Calculate the rim/edge
                    vec3 normal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    float rim = 1.0 - max(0.0, dot(normal, viewDir));
                    rim = smoothstep(1.0 - outlineThickness, 1.0, rim);
                    
                    // Base color from texture or diffuse
                    vec4 texelColor = texture2D(map, vUv);
                    vec3 baseColor = map == null ? diffuse : texelColor.rgb;
                    
                    // Mix base color with outline
                    vec3 finalColor = mix(baseColor, outlineColor, rim * outlineStrength);
                    
                    gl_FragColor = vec4(finalColor, texelColor.a);
                }
            `,
            transparent: originalMaterial.transparent,
            side: THREE.FrontSide,
            // Keep track of all original material properties that might be needed
            alphaTest: originalMaterial.alphaTest || 0,
            blending: originalMaterial.blending || THREE.NormalBlending,
            depthTest: originalMaterial.depthTest !== undefined ? originalMaterial.depthTest : true,
            depthWrite: originalMaterial.depthWrite !== undefined ? originalMaterial.depthWrite : true
        });

        // Mark this as our outline material
        outlineMaterial._isOutlineMaterial = true;

        // Return the new material
        return outlineMaterial;
    }

    /**
     * Remove outline from an object
     * @param {THREE.Object3D} object - The object to remove outline from
     * @param {boolean} recursive - Whether to remove all child objects recursively
     */
    removeOutlineObject(object, recursive = false) {
        if (!object) return;

        const restoreOriginalMaterial = (obj) => {
            if (!obj.isMesh) return;

            const entry = this.outlinedObjects.get(obj.uuid);
            if (!entry) return;

            // Restore original materials
            obj.material = entry.originalMaterials;

            // Remove from the tracked objects
            this.outlinedObjects.delete(obj.uuid);
        };

        if (recursive) {
            object.traverse(child => {
                restoreOriginalMaterial(child);
            });
        } else {
            restoreOriginalMaterial(object);
        }
    }

    /**
     * Clear all objects from being outlined
     */
    clearOutlineObjects() {
        this.outlinedObjects.forEach((entry) => {
            if (entry.object && entry.object.isMesh) {
                entry.object.material = entry.originalMaterials;
            }
        });

        this.outlinedObjects.clear();
    }

    /**
     * Update the outline parameters
     * @param {Object} params - Parameters to update
     * @param {THREE.Color|string} [params.outlineColor] - New outline color
     * @param {number} [params.outlineThickness] - New outline thickness
     * @param {number} [params.outlineStrength] - New outline strength
     */
    updateOutlineParameters(params = {}) {
        // Update parameters
        if (params.outlineColor !== undefined) {
            this.outlineParameters.outlineColor = new THREE.Color(params.outlineColor);
        }

        if (params.outlineThickness !== undefined) {
            this.outlineParameters.outlineThickness = params.outlineThickness;
        }

        if (params.outlineStrength !== undefined) {
            this.outlineParameters.outlineStrength = params.outlineStrength;
        }

        // Update all affected materials
        this.outlinedObjects.forEach((entry) => {
            if (!entry.object || !entry.object.isMesh) return;

            const updateUniforms = (material) => {
                if (material.uniforms) {
                    material.uniforms.outlineColor.value = this.outlineParameters.outlineColor;
                    material.uniforms.outlineThickness.value = this.outlineParameters.outlineThickness;
                    material.uniforms.outlineStrength.value = this.outlineParameters.outlineStrength;
                }
            };

            if (Array.isArray(entry.object.material)) {
                entry.object.material.forEach(updateUniforms);
            } else {
                updateUniforms(entry.object.material);
            }
        });
    }

    /**
     * This method exists for API compatibility but does nothing as shader-based outlines
     * don't need special rendering
     */
    render() {
        // Nothing needed for shader-based outlines
    }

    /**
     * API compatibility method - not needed for shader-based outlines
     */
    updateSize() {
        // Nothing needed for shader-based outlines
    }
}

// Global state
let composer = null;
let outlineEffect = null;
let bloomEffect = null;
let selection = new Selection();
let initialized = false;

/**
 * Completely reinitialize the effect composer to ensure clean state
 */
export function initGLBOutlineEffects(scene, camera, renderer, options = {}) {


    // If we already have a composer, dispose it properly to avoid memory leaks
    if (composer) {
        composer.dispose();
    }

    // Reset state
    selection = new Selection();

    // Get the size from the renderer - this is critical for resolution
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const pixelRatio = renderer.getPixelRatio();

    // Create high-quality render target
    const renderTarget = new THREE.WebGLRenderTarget(
        size.width * pixelRatio,
        size.height * pixelRatio,
        {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            encoding: renderer.outputEncoding, // IMPORTANT: match encoder
            samples: renderer.capabilities.isWebGL2 ? 4 : 0 // Use MSAA if available
        }
    );

    // Create fresh composer with this render target
    composer = new EffectComposer(renderer, renderTarget);
    composer.setSize(size.width, size.height);

    // Add render pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Add outline effect with DRAMATICALLY increased values
    outlineEffect = new OutlineEffect(scene, camera, {
        blendFunction: BlendFunction.SCREEN,
        edgeStrength: 10.0,            // 3-4x stronger than before
        pulseSpeed: 0.0,               // Keep static (no pulse)
        visibleEdgeColor: options.edgeColor || 0xff0000,  // Bright red
        hiddenEdgeColor: options.hiddenEdgeColor || 0xff0000, // Same red for hidden edges
        kernelSize: KernelSize.VERY_LARGE, // Use the largest kernel for thickest outlines
        blur: true,                    // Keep blur for smooth edges
        xRay: true,                    // Show outlines through objects
        resolutionScale: 1.0,          // Full resolution
        thickness: 2.0,                // Double thickness if this parameter exists
        opacity: 1.0                   // Full opacity
    });
    outlineEffect.selection = selection;

    // Create a pass with the outline effect
    const outlinePass = new EffectPass(camera, outlineEffect);
    composer.addPass(outlinePass);

    // Mark as initialized
    initialized = true;



    return composer;
}

/**
 * Apply outline to a GLB model
 */
export function applyGLBOutline(model, options = {}) {
    if (!initialized || !selection) {

        return;
    }

    model.traverse(child => {
        if (child.isMesh) {
            // Add to selection
            selection.add(child);
            // Ensure visible from distance
            child.frustumCulled = false;
        }
    });
}

/**
 * The ONLY render function to call in your animation loop
 */
export function render() {
    if (!initialized || !composer) {

        return;
    }

    composer.render();
}

/**
 * Handle window resize
 */
export function updateSize() {
    if (!initialized || !composer) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = window.devicePixelRatio;

    composer.setSize(width, height);
}

/**
 * Clean up resources
 */
export function dispose() {
    if (composer) {
        composer.dispose();
    }

    selection.clear();
    composer = null;
    outlineEffect = null;
    bloomEffect = null;
    initialized = false;
}

/**
 * Also let's add an update method to dynamically change outline parameters:
 */
export function updateOutlineSettings(settings = {}) {
    if (!initialized || !outlineEffect) {

        return;
    }

    if (settings.edgeStrength !== undefined) {
        outlineEffect.edgeStrength = settings.edgeStrength;
    }

    if (settings.visibleEdgeColor !== undefined) {
        outlineEffect.visibleEdgeColor.set(settings.visibleEdgeColor);
    }

    if (settings.hiddenEdgeColor !== undefined) {
        outlineEffect.hiddenEdgeColor.set(settings.hiddenEdgeColor);
    }

    if (settings.kernelSize !== undefined) {
        outlineEffect.kernelSize = settings.kernelSize;
    }

    if (settings.blur !== undefined) {
        outlineEffect.blur = settings.blur;
    }


}