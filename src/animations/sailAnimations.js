import * as THREE from 'three';
import { boat, getTime, getWindData } from '../core/gameState.js';

// Set up a timer to analyze any mesh after 5 seconds
setTimeout(() => {
    if (boat) {


        // Find ALL meshes to analyze, not just sail-named ones
        const allMeshes = [];
        boat.traverse(child => {
            if (child.isMesh) {
                allMeshes.push(child);
            }
        });



        // Analyze each mesh individually (limit to first 3 to avoid excessive output)
        const meshesToAnalyze = allMeshes.slice(0, 3); // Take up to first 3 meshes
        meshesToAnalyze.forEach((mesh, index) => {

            dumpObject(mesh);
        });
    }
}, 5000);

/**
 * Directly animates the sails on the boat - to be called from the game loop
 */
export function animateSails() {
    // Skip if no boat or traverse not available
    if (!boat || typeof boat.traverse !== 'function') {
        return;
    }

    // Find all sail meshes each frame
    const sailMeshes = [];

    // Locate all sail-related meshes
    boat.traverse(child => {
        if (child.isMesh &&
            (child.name.includes('sail') || child.name.includes('Sail'))) {
            sailMeshes.push(child);
        }
    });

    // Skip if no sail meshes found
    if (sailMeshes.length === 0) {
        return;
    }

    // Get current time and wind data
    const time = getTime() * 0.005;
    const { direction, speed } = getWindData();

    // Use dramatic values for testing
    const windDirection = direction || 0;
    const windStrength = 1.0;  // Maximum strength for testing
    const windRad = THREE.MathUtils.degToRad(windDirection + (time * 50)); // Rotating wind

    // Animate each sail mesh
    sailMeshes.forEach(mesh => {
        // Skip if no geometry
        if (!mesh.geometry || !mesh.geometry.attributes.position) {
            return;
        }

        // Store original geometry if not already saved
        if (!mesh.userData.originalPositions) {
            const original = mesh.geometry.attributes.position.array.slice();
            mesh.userData.originalPositions = original;
        }

        // Get positions
        const positions = mesh.geometry.attributes.position;
        const original = mesh.userData.originalPositions;

        // Apply extreme effects to each vertex
        for (let i = 0; i < positions.count; i++) {
            // Get vertex index
            const idx = i * 3;

            // Get original position
            const x = original[idx];
            const y = original[idx + 1];
            const z = original[idx + 2];

            // Extremely dramatic wind effects
            const heightFactor = Math.max(0, y / 2) * 6.0;
            const xEffect = Math.sin(windRad) * windStrength;
            const zEffect = Math.cos(windRad) * windStrength;

            // Wild animation effects
            const seed = (x * 100 + y * 10 + z) * 0.1;
            const animX = Math.sin(time * 3 + x) * 0.15 * windStrength;
            const animY = Math.cos(time * 2.5 + seed) * 0.1 * windStrength;
            const animZ = Math.cos(time * 2 + z) * 0.15 * windStrength;
            const billow = Math.sin(time * 1.5 + x * 0.3 + z * 0.2) * 0.25;

            // Apply combined effects
            positions.setXYZ(
                i,
                x + xEffect * heightFactor + animX + billow,
                y + animY + (Math.sin(time + x * 0.5) * 0.2),
                z + zEffect * heightFactor + animZ + billow
            );
        }

        // Mark positions for update
        positions.needsUpdate = true;
    });
}

function dumpObject(obj, indent = 0) {


    const padding = ' '.repeat(indent * 2);

    // Basic info
    let info = `${padding}${obj.name || 'unnamed'} [${obj.type}]`;

    // Add mesh details
    if (obj.isMesh) {
        info += ' (MESH)';

        // Add material info
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                info += ` - Materials: ${obj.material.length}`;
                obj.material.forEach((mat, i) => {
                    info += `\n${padding}  - Mat ${i}: ${mat.name || 'unnamed'} (${mat.type})`;
                });
            } else {
                info += ` - Material: ${obj.material.name || 'unnamed'} (${obj.material.type})`;
            }
        }

        // Add geometry info
        if (obj.geometry) {
            info += `\n${padding}  - Geometry: ${obj.geometry.type}`;
            info += ` (vertices: ${obj.geometry.attributes.position ? obj.geometry.attributes.position.count : 'unknown'})`;

            // List all geometry attributes (might contain vertex groups)
            info += `\n${padding}  - Attributes: `;
            for (const key in obj.geometry.attributes) {
                info += `${key}, `;
            }

            // Sample vertex data if positions exist
            if (obj.geometry.attributes.position) {
                const positions = obj.geometry.attributes.position.array;
                const vertexCount = obj.geometry.attributes.position.count;
                const sampleSize = Math.min(2000, vertexCount); // Sample up to 10 vertices

                info += `\n${padding}  - Vertex Sample (${sampleSize}/${vertexCount}):`;

                for (let i = 0; i < sampleSize; i++) {
                    const idx = i * 3;
                    info += `\n${padding}    Vertex ${i}: (${positions[idx].toFixed(2)}, ${positions[idx + 1].toFixed(2)}, ${positions[idx + 2].toFixed(2)})`;
                }

                // Check for specific attributes like 'sale' or 'LBL'
                const hasLBL = obj.geometry.attributes.lbl !== undefined;
                const hasSale = obj.geometry.attributes.Sail !== undefined;
                const hasSail = obj.geometry.attributes.sail !== undefined;

                if (hasLBL || hasSale || hasSail) {
                    info += `\n${padding}  - FOUND TARGETED ATTRIBUTES:`;
                    if (hasLBL) info += ` lbl`;
                    if (hasSale) info += ` sale`;
                    if (hasSail) info += ` sail`;

                    // Sample data from these attributes if they exist
                    [
                        { name: 'LBL', exists: hasLBL },
                        { name: 'sale', exists: hasSale },
                        { name: 'sail', exists: hasSail }
                    ].forEach(attr => {
                        if (attr.exists) {
                            const attrData = obj.geometry.attributes[attr.name];
                            info += `\n${padding}    ${attr.name} (${attrData.itemSize} components per vertex):`;

                            // Sample a few values from this attribute
                            for (let i = 0; i < Math.min(5, vertexCount); i++) {
                                let valueStr = `\n${padding}      Vertex ${i}: (`;
                                for (let j = 0; j < attrData.itemSize; j++) {
                                    const val = attrData.array[i * attrData.itemSize + j];
                                    valueStr += `${val.toFixed(2)}${j < attrData.itemSize - 1 ? ', ' : ''}`;
                                }
                                valueStr += ')';
                                info += valueStr;
                            }
                        }
                    });
                } else {
                    info += `\n${padding}  - No 'sale', 'sail', or 'LBL' attributes found`;
                }
            }

            // Check for morph targets (sometimes vertex groups become morph targets)
            if (obj.geometry.morphAttributes && Object.keys(obj.geometry.morphAttributes).length > 0) {
                info += `\n${padding}  - Morph targets: ${Object.keys(obj.geometry.morphAttributes).join(', ')}`;

                // Check if any morph targets contain 'sale', 'sail', or 'LBL'
                const morphKeys = Object.keys(obj.geometry.morphAttributes);
                const relevantMorphs = morphKeys.filter(key =>
                    key === 'sale' || key === 'sail' || key === 'LBL' ||
                    key.includes('sail') || key.includes('sale') || key.includes('LBL'));

                if (relevantMorphs.length > 0) {
                    info += `\n${padding}  - FOUND TARGETED MORPH TARGETS: ${relevantMorphs.join(', ')}`;
                }
            }

            // Look for groups property (rarely used but might be there)
            if (obj.geometry.groups && obj.geometry.groups.length) {
                info += `\n${padding}  - Geometry groups: ${obj.geometry.groups.length}`;
            }
        }

        // Check for skinning information (vertex groups used for rigging)
        if (obj.isSkinnedMesh) {
            info += `\n${padding}  - SKINNED MESH with ${obj.skeleton ? obj.skeleton.bones.length : 0} bones`;

            // Skinned meshes might use bone weights for sail animation
            if (obj.geometry && obj.geometry.attributes) {
                const hasSkinIndices = obj.geometry.attributes.skinIndex !== undefined;
                const hasSkinWeights = obj.geometry.attributes.skinWeight !== undefined;

                if (hasSkinIndices && hasSkinWeights) {
                    info += `\n${padding}  - Has skin indices and weights (could control sail deformation)`;
                }
            }
        }
    }

    // Add any userData (might contain labels or vertex group info)
    if (obj.userData && Object.keys(obj.userData).length > 0) {
        info += `\n${padding}  - UserData: ${JSON.stringify(obj.userData)}`;
    }



    // Don't process children to run only once for the main object
    // To see children, uncomment these lines:
    /*
    if (obj.children && obj.children.length > 0) {
        obj.children.forEach(child => {
            dumpObject(child, indent + 1);
        });
    }
    */
}
