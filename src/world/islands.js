import * as THREE from 'three';
import { createShoreEffect, updateShores, setShoreVisibility, removeShore, clearAllShores } from './shores.js';
import {
    checkMassiveIslandCollision,
    updateMassiveIslandShores,
    findNearestMassiveIsland
} from './massiveIslands.js';
// import { createCoastalCliffScene } from './coastalCliff.js';
import { createBlockCave } from './blockCave.js';
import { createPirateTavern2 } from './pirateTavern2.js';
import { createTreehouseTavern } from './treehouseTavern.js';
// Import the outline style system
import { applyOutline } from '../theme/outlineStyles.js';

// Island generation variables
let islandColliders = [];

// Store generated chunks
const activeIslands = new Map(); // Maps island ID to island object

// Default shore effects setting - will be overridden by window.gameSettings if available
let enableShoreEffects = true;

// Initialize gameSettings if not already done
if (typeof window !== 'undefined') {
    window.gameSettings = window.gameSettings || {};
    // Use stored setting or default to true
    window.gameSettings.enableShoreEffects =
        window.gameSettings.enableShoreEffects !== undefined ?
            window.gameSettings.enableShoreEffects : true;
}

// Function to check if shore effects are enabled
function areShoreEffectsEnabled() {
    // First check window.gameSettings if available
    if (typeof window !== 'undefined' && window.gameSettings) {
        return window.gameSettings.enableShoreEffects;
    }
    // Fall back to local variable
    return enableShoreEffects;
}

// Cache for structure textures to improve performance
const structureTextureCache = {};

// Function to generate islands in a chunk based on chunk coordinates

// SPAWN CONTROLS - Update these values
const SPAWN_CONTROLS = {
    enableRandomSpawning: false,  // Enable random spawning (was false)
    smugglersHideout: false,
    pirateTavern: false,
    pirateTavern2: false,
    treehouseTavern: true,
    blockCave: false,
};

// Function to create a single island with specified parameters
function createIsland(x, z, seed, scene) {
    // Use the seed to create deterministic randomness for this island
    const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    // Create a unique ID for this island
    const islandId = `island_${Math.floor(x)}_${Math.floor(z)}`;

    // Add this line to define features
    const features = []; // Empty array since there are no explicit features in this function

    // Skip if this island already exists
    if (activeIslands.has(islandId)) {
        return;
    }

    // Island group to hold all parts
    const island = new THREE.Group();
    island.position.set(x, 0, z);
    scene.add(island);

    // Add island collider
    const collider = {
        center: new THREE.Vector3(x, 0, z),
        radius: 50, // Island radius
        id: islandId
    };
    islandColliders.push(collider);

    // Beach
    const beachGeometry = new THREE.CylinderGeometry(50, 55, 5, 64);
    const beachColor = new THREE.Color().setHSL(0.12 + random() * 0.05, 0.9, 0.7);
    const sandTexture = createSandTexture(beachColor);
    const beachMaterial = new THREE.MeshPhongMaterial({
        color: beachColor,
        map: sandTexture,
        bumpMap: sandTexture,
        bumpScale: 0.2,
        shininess: 2
    });
    const beach = new THREE.Mesh(beachGeometry, beachMaterial);
    beach.position.y = 0;
    island.add(beach);

    // Apply outline to beach with subtle effect
    applyOutline(beach, { scale: 1.1 });

    // Create a palette of vibrant colors for this island
    const islandPalette = [
        new THREE.Color().setHSL(random(), 0.85, 0.6),
        new THREE.Color().setHSL(random(), 0.9, 0.7),
        new THREE.Color().setHSL(random(), 0.8, 0.5)
    ];

    // Determine if this island should have a mega structure (roughly 20% chance)
    const hasMegaStructure = random() < 0.2;

    if (hasMegaStructure) {
        // Choose a type of mega structure
        const structureType = Math.floor(random() * 4); // 0-3 different types

        switch (structureType) {
            case 0: // Ancient Temple
                createAncientTemple(island, random);
                break;
            case 1: // Lighthouse
                createLighthouse(island, random);
                break;
            case 2: // Roman Obelisk
                createGiantStatue(island, random);
                break;
            case 3: // Ruined Tower
                createRuinedTower(island, random);
                break;
        }
    } else {
        // Regular island with temple structures if no mega structure

        for (let p = 0; p < 1; p++) {
            const templeSize = 15 + random() * 15;
            const templeHeight = 15 + random() * 20;

            // Create a temple group
            const temple = new THREE.Group();

            // Create a stepped pyramid/ziggurat style temple
            const levels = 3 + Math.floor(random() * 3); // 3-5 levels
            const baseWidth = templeSize;
            const topWidth = templeSize * 0.3;
            const levelHeight = templeHeight / levels;

            // Create temple texture
            const templeColor = islandPalette[p % islandPalette.length];
            const templeTexture = createStoneTexture(templeColor, 0.5);

            // Create each level of the temple
            for (let i = 0; i < levels; i++) {
                // Calculate the width of this level (decreasing as we go up)
                const t = i / (levels - 1); // 0 to 1
                const width = baseWidth * (1 - t) + topWidth * t;

                // Create the level geometry
                const levelGeometry = new THREE.BoxGeometry(width, levelHeight, width);
                const levelMaterial = new THREE.MeshPhongMaterial({
                    color: templeColor,
                    map: templeTexture,
                    shininess: 10
                });

                const level = new THREE.Mesh(levelGeometry, levelMaterial);
                level.position.y = i * levelHeight + levelHeight / 2;
                temple.add(level);

                // Apply outline to each temple level
                applyOutline(level, { scale: 1.12 });
            }

            // Add a small shrine/structure on top for some variation
            if (random() < 0.7) { // 70% chance of having a top structure
                const topStructureType = Math.floor(random() * 3);

                if (topStructureType === 0) {
                    // Small dome
                    const domeGeometry = new THREE.SphereGeometry(topWidth * 0.5, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
                    const domeMaterial = new THREE.MeshPhongMaterial({
                        color: templeColor.clone().multiplyScalar(1.2), // Slightly lighter
                        map: templeTexture
                    });
                    const dome = new THREE.Mesh(domeGeometry, domeMaterial);
                    dome.position.y = levels * levelHeight;
                    temple.add(dome);

                    // Apply outline to dome
                    applyOutline(dome, { scale: 1.12 });

                } else if (topStructureType === 1) {
                    // Small pillars in a square
                    const pillarRadius = topWidth * 0.1;
                    const pillarHeight = levelHeight * 0.8;
                    const pillarGeometry = new THREE.CylinderGeometry(pillarRadius, pillarRadius, pillarHeight, 6);
                    const pillarMaterial = new THREE.MeshPhongMaterial({
                        color: templeColor,
                        map: templeTexture
                    });

                    // Add pillars at corners
                    const offset = topWidth * 0.3;
                    const positions = [
                        [-offset, 0, -offset],
                        [-offset, 0, offset],
                        [offset, 0, -offset],
                        [offset, 0, offset]
                    ];

                    for (const pos of positions) {
                        const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
                        pillar.position.set(pos[0], levels * levelHeight + pillarHeight / 2, pos[2]);
                        temple.add(pillar);

                        // Apply outline to each pillar
                        applyOutline(pillar, { scale: 1.15 });
                    }

                    // Small roof
                    const roofGeometry = new THREE.BoxGeometry(topWidth * 0.8, levelHeight * 0.2, topWidth * 0.8);
                    const roof = new THREE.Mesh(roofGeometry, pillarMaterial);
                    roof.position.y = levels * levelHeight + pillarHeight + levelHeight * 0.1;
                    temple.add(roof);

                    // Apply outline to roof
                    applyOutline(roof, { scale: 1.12 });

                } else {
                    // Obelisk
                    const obeliskWidth = topWidth * 0.25;
                    const obeliskHeight = levelHeight * 1.5;
                    const obeliskGeometry = new THREE.CylinderGeometry(0, obeliskWidth, obeliskHeight, 4);
                    const obeliskMaterial = new THREE.MeshPhongMaterial({
                        color: templeColor.clone().multiplyScalar(0.8), // Slightly darker
                        map: templeTexture
                    });
                    const obelisk = new THREE.Mesh(obeliskGeometry, obeliskMaterial);
                    obelisk.position.y = levels * levelHeight + obeliskHeight / 2;
                    temple.add(obelisk);

                    // Apply outline to obelisk
                    applyOutline(obelisk, { scale: 1.15 });
                }
            }

            // Position the temple on the island
            const templeAngle = random() * Math.PI * 2;
            const templeDistance = random() * 25;
            temple.position.set(
                Math.cos(templeAngle) * templeDistance,
                2.5,
                Math.sin(templeAngle) * templeDistance
            );

            // Add some rotation for variety
            temple.rotation.y = random() * Math.PI * 2;

            island.add(temple);
        }
    }

    // Vegetation (always add some trees regardless of structure)
    for (let v = 0; v < 2; v++) {
        // Create a tree group to hold trunk and foliage
        const tree = new THREE.Group();

        // Define minimum sizes for trees
        const MIN_TREE_HEIGHT = 20;     // Was 10
        const MIN_TRUNK_RADIUS = 0.8;   // Was 0.5
        const MIN_FOLIAGE_RADIUS = 5;   // Was 3

        // Random tree properties with better minimum values
        const treeHeight = MIN_TREE_HEIGHT + random() * 8;
        const trunkHeight = treeHeight * 0.6;
        const trunkRadius = MIN_TRUNK_RADIUS + random() * 0.4;
        const foliageRadius = MIN_FOLIAGE_RADIUS + random() * 3;
        const foliageHeight = treeHeight - trunkHeight;

        // Tree type variation (0: cone, 1: rounded)
        const treeType = random() < 0.7 ? 0 : 1;

        // Create trunk
        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 8);
        const trunkColor = new THREE.Color().setHSL(0.07 + random() * 0.05, 0.5 + random() * 0.2, 0.2 + random() * 0.1);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: trunkColor });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = trunkHeight / 2;
        tree.add(trunk);

        // Apply outline to trunk
        applyOutline(trunk, { scale: 1.12 });

        // Create foliage
        let foliageGeometry;
        if (treeType === 0) {
            // Cone-shaped foliage (palm-like)
            foliageGeometry = new THREE.ConeGeometry(foliageRadius, foliageHeight, 8);
        } else {
            // Rounded foliage (deciduous-like)
            foliageGeometry = new THREE.SphereGeometry(foliageRadius, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.8);
        }

        const foliageColor = new THREE.Color().setHSL(0.25 + random() * 0.15, 0.8, 0.3 + random() * 0.2);
        const foliageMaterial = new THREE.MeshPhongMaterial({ color: foliageColor });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);

        // Position foliage on top of trunk
        foliage.position.y = trunkHeight + (treeType === 0 ? foliageHeight / 2 : 0);
        if (treeType === 1) {
            // Move rounded foliage slightly up so it sits better on trunk
            foliage.position.y += foliageHeight / 4;
        }

        tree.add(foliage);

        // Apply outline to foliage
        applyOutline(foliage, { scale: 1.15 });

        // Add some random rotation to the tree for variety
        tree.rotation.y = random() * Math.PI * 2;
        tree.rotation.x = (random() - 0.5) * 0.05; // Slight random tilt
        tree.rotation.z = (random() - 0.5) * 0.05; // Slight random tilt

        // Position the tree on the island
        const treeAngle = random() * Math.PI * 2;
        const treeDistance = 20 + random() * 25; // Place trees more toward the edges
        tree.position.set(
            Math.cos(treeAngle) * treeDistance,
            2,
            Math.sin(treeAngle) * treeDistance
        );

        island.add(tree);
    }

    // Store the island with its ID and collider reference
    const islandEntry = {
        mesh: island,
        collider: collider,
        visible: true
    };

    activeIslands.set(islandId, islandEntry);

    // Add shore effect if enabled
    if (areShoreEffectsEnabled() && scene) {
        const shore = createShoreEffect(island, collider, scene);
        islandEntry.shore = shore;
    }

    // Add the Smuggler's Hideout (with a certain probability or on specific islands)
    if (random() < 0.0) {  // Changed from 1.0 to 0.5 for 50% chance


        // Find a good spot on the island
        const angle = random() * Math.PI * 2;
        const distance = 35; // Slightly closer to center

        const tavernPosition = new THREE.Vector3(
            Math.cos(angle) * distance,
            0,
            Math.sin(angle) * distance
        );

        // Create the tavern with a random rotation
        createPirateTavern2({
            parent: island,
            random: random,
            position: tavernPosition,
            rotation: random() * Math.PI * 2,
            scale: 5.0
        });
    }

    if (SPAWN_CONTROLS.treehouseTavern && random() < 0.4) {  // Only spawn if enabled, with 40% chance


        // Find a spot with trees on the island
        const angle = random() * Math.PI * 2;
        const distance = 20 + random() * 15; // Position it among the trees

        const tavernPosition = new THREE.Vector3(
            Math.cos(angle) * distance,
            0, // At ground level
            Math.sin(angle) * distance
        );

        // Create the treehouse tavern
        createTreehouseTavern({
            parent: island,
            random: random,
            position: tavernPosition,
            rotation: random() * Math.PI * 2,
            scale: 1.0
        });
    }

    return islandEntry;
}

// Function to create and cache a sand texture with grainy appearance
function createSandTexture(baseColor) {
    // Use cached texture if available
    const cacheKey = `sand_${baseColor.getHexString()}`;
    if (structureTextureCache[cacheKey]) {
        return structureTextureCache[cacheKey];
    }

    // Create canvas for texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base color (warm sand)
    const sandColor = baseColor.clone();
    ctx.fillStyle = `#${sandColor.getHexString()}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create a lighter variant for contrast
    const lighterColor = sandColor.clone().multiplyScalar(1.1);

    // Add a subtle noise pattern that looks like sand
    for (let i = 0; i < 5000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = 1 + Math.random() * 2;

        // Simple dots in varying shades for a cartoony sand look
        if (Math.random() > 0.7) {
            // Darker dots (30% of dots)
            const dotColor = sandColor.clone().multiplyScalar(0.9);
            ctx.fillStyle = `#${dotColor.getHexString()}`;
        } else {
            // Lighter dots (70% of dots)
            ctx.fillStyle = `#${lighterColor.getHexString()}`;
        }

        ctx.fillRect(x, y, size, size);
    }

    // Add very subtle directional "brushed" lines for some texture variation
    ctx.strokeStyle = `rgba(0, 0, 0, 0.03)`;
    ctx.lineWidth = 1;

    // Horizontal gentle waves suggesting sand
    for (let y = 10; y < canvas.height; y += 20) {
        ctx.beginPath();

        for (let x = 0; x < canvas.width; x += 5) {
            const yOffset = Math.sin(x / 30) * 3;

            if (x === 0) {
                ctx.moveTo(x, y + yOffset);
            } else {
                ctx.lineTo(x, y + yOffset);
            }
        }

        ctx.stroke();
    }

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3); // Repeat texture for more detail

    // Cache the texture
    structureTextureCache[cacheKey] = texture;

    return texture;
}

// Function to create and cache a stone texture with imperfections
function createStoneTexture(color, roughness) {
    // Use cached texture if available
    const cacheKey = `stone_${color.getHexString()}_${roughness}`;
    if (structureTextureCache[cacheKey]) {
        return structureTextureCache[cacheKey];
    }

    // Create canvas for texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base color
    ctx.fillStyle = `#${color.getHexString()}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add noise/imperfections
    for (let i = 0; i < 3000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = 1 + Math.random() * 2;

        // Random darker or lighter spots
        const shade = Math.random() > 0.5 ? 0 : 255;
        ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.05 + Math.random() * roughness * 0.1})`;
        ctx.fillRect(x, y, size, size);
    }

    // Add some cracks/lines
    ctx.strokeStyle = `rgba(0, 0, 0, ${roughness * 0.2})`;
    for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.lineWidth = 0.5 + Math.random() * 1;

        // Random start point
        const startX = Math.random() * canvas.width;
        const startY = Math.random() * canvas.height;

        ctx.moveTo(startX, startY);

        // Create jaggy line
        let x = startX;
        let y = startY;
        const segments = 3 + Math.floor(Math.random() * 4);

        for (let j = 0; j < segments; j++) {
            x += (Math.random() - 0.5) * 40;
            y += (Math.random() - 0.5) * 40;
            ctx.lineTo(x, y);
        }

        ctx.stroke();
    }

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Cache the texture
    structureTextureCache[cacheKey] = texture;

    return texture;
}

// Function to create an ancient temple mega structure
function createAncientTemple(island, random) {
    // Create stone texture for temple
    const templeColor = new THREE.Color(0xd2b48c);
    const stoneTexture = createStoneTexture(templeColor, 0.7);

    // Base platform
    const baseGeometry = new THREE.BoxGeometry(40, 10, 40);
    const baseMaterial = new THREE.MeshPhongMaterial({
        color: 0xd2b48c,
        map: stoneTexture,
        bumpMap: stoneTexture,
        bumpScale: 0.05,
        roughness: 0.8,
        metalness: 0.2
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 5;
    island.add(base);

    // Apply outline to base
    applyOutline(base, { scale: 1.1 });

    // Temple steps
    const stepsGeometry = new THREE.BoxGeometry(30, 5, 30);
    const steps = new THREE.Mesh(stepsGeometry, baseMaterial);
    steps.position.y = 12.5;
    island.add(steps);

    // Apply outline to steps
    applyOutline(steps, { scale: 1.1 });

    // Main temple structure
    const templeGeometry = new THREE.BoxGeometry(20, 15, 20);
    const templeMaterial = new THREE.MeshPhongMaterial({
        color: 0xc2a278,
        map: stoneTexture,
        bumpMap: stoneTexture,
        bumpScale: 0.03,
        roughness: 0.7,
        metalness: 0.1
    });
    const temple = new THREE.Mesh(templeGeometry, templeMaterial);
    temple.position.y = 22.5;
    island.add(temple);

    // Apply outline to temple
    applyOutline(temple, { scale: 1.12 });

    // Temple roof
    const roofGeometry = new THREE.ConeGeometry(15, 10, 4);
    const roofTexture = createStoneTexture(new THREE.Color(0xa52a2a), 0.4);
    const roofMaterial = new THREE.MeshPhongMaterial({
        color: 0xa52a2a,
        map: roofTexture,
        bumpMap: roofTexture,
        bumpScale: 0.02
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 35;
    roof.rotation.y = Math.PI / 4; // Rotate 45 degrees
    island.add(roof);

    // Apply outline to roof
    applyOutline(roof, { scale: 1.15 });

    // Columns
    const columnPositions = [
        [-12, 0, -12], [12, 0, -12], [-12, 0, 12], [12, 0, 12]
    ];

    columnPositions.forEach(pos => {
        const columnGeometry = new THREE.CylinderGeometry(2, 2, 20, 16);
        const column = new THREE.Mesh(columnGeometry, baseMaterial);
        column.position.set(pos[0], 20, pos[2]);
        island.add(column);

        // Apply outline to each column
        applyOutline(column, { scale: 1.15 });
    });
}

// Function to create a lighthouse mega structure
function createLighthouse(island, random) {
    // Create stone and metal textures
    const stoneTexture = createStoneTexture(new THREE.Color(0x808080), 0.6);
    const metalTexture = createStoneTexture(new THREE.Color(0x333333), 0.3);

    // Base
    const baseGeometry = new THREE.CylinderGeometry(15, 18, 10, 32);
    const baseMaterial = new THREE.MeshPhongMaterial({
        color: 0x808080,
        map: stoneTexture,
        bumpMap: stoneTexture,
        bumpScale: 0.04
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 5;
    island.add(base);

    // Apply outline to base
    applyOutline(base, { scale: 1.12 });

    // Tower
    const towerGeometry = new THREE.CylinderGeometry(8, 12, 40, 32);

    // Create a special texture for the lighthouse with stripes
    const lighthouseCanvas = document.createElement('canvas');
    lighthouseCanvas.width = 256;
    lighthouseCanvas.height = 256;
    const lhCtx = lighthouseCanvas.getContext('2d');

    // White base with subtle imperfections
    lhCtx.fillStyle = '#ffffff';
    lhCtx.fillRect(0, 0, lighthouseCanvas.width, lighthouseCanvas.height);

    // Add noise
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * lighthouseCanvas.width;
        const y = Math.random() * lighthouseCanvas.height;
        lhCtx.fillStyle = `rgba(0, 0, 0, ${0.01 + Math.random() * 0.03})`;
        lhCtx.fillRect(x, y, 1, 1);
    }

    // Add red stripes
    const stripeHeight = lighthouseCanvas.height / 5;
    for (let i = 0; i < 5; i += 2) {
        lhCtx.fillStyle = 'rgba(255, 0, 0, 0.9)';
        lhCtx.fillRect(0, i * stripeHeight, lighthouseCanvas.width, stripeHeight);

        // Add weathering to red stripes
        for (let j = 0; j < 500; j++) {
            const x = Math.random() * lighthouseCanvas.width;
            const y = i * stripeHeight + Math.random() * stripeHeight;
            lhCtx.fillStyle = `rgba(255, 255, 255, ${0.05 + Math.random() * 0.1})`;
            lhCtx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
        }
    }

    const lighthouseTexture = new THREE.CanvasTexture(lighthouseCanvas);
    lighthouseTexture.wrapS = THREE.RepeatWrapping;
    lighthouseTexture.wrapT = THREE.RepeatWrapping;

    const towerMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        map: lighthouseTexture,
        roughness: 0.5
    });
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position.y = 30;
    island.add(tower);

    // Apply outline to tower
    applyOutline(tower, { scale: 1.1 });

    // Lantern room
    const lanternGeometry = new THREE.CylinderGeometry(10, 10, 8, 16);
    const lanternMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        map: metalTexture,
        bumpMap: metalTexture,
        bumpScale: 0.02,
        metalness: 0.8,
        roughness: 0.2
    });
    const lantern = new THREE.Mesh(lanternGeometry, lanternMaterial);
    lantern.position.y = 54;
    island.add(lantern);

    // Apply outline to lantern room
    applyOutline(lantern, { scale: 1.15 });

    // Light source - don't outline this since it emits light
    const lightGeometry = new THREE.SphereGeometry(6, 16, 16);
    const lightMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 1
    });
    const light = new THREE.Mesh(lightGeometry, lightMaterial);
    light.position.y = 54;
    island.add(light);

    // Add a point light
    const pointLight = new THREE.PointLight(0xffff00, 1, 100);
    pointLight.position.y = 54;
    island.add(pointLight);
}

// Function to create a Roman obelisk mega structure
function createGiantStatue(island, random) {
    // Create stone textures
    const stoneTexture = createStoneTexture(new THREE.Color(0x999999), 0.8);
    const graniteTexture = createStoneTexture(new THREE.Color(0x663333), 0.6);

    // Base/pedestal - rectangular marble platform
    const baseGeometry = new THREE.BoxGeometry(25, 10, 25);
    const baseMaterial = new THREE.MeshPhongMaterial({
        color: 0xeeeeee,
        map: stoneTexture,
        bumpMap: stoneTexture,
        bumpScale: 0.05
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 5;
    island.add(base);

    // Apply outline to base
    applyOutline(base, { scale: 1.1 });

    // Create a fancy Roman inscription on the base
    const inscriptionGeometry = new THREE.PlaneGeometry(18, 6);
    const inscriptionCanvas = document.createElement('canvas');
    inscriptionCanvas.width = 512;
    inscriptionCanvas.height = 256;
    const ctx = inscriptionCanvas.getContext('2d');

    // Fill with marble-like texture
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, inscriptionCanvas.width, inscriptionCanvas.height);

    // Add some marble veins
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(random() * inscriptionCanvas.width, 0);
        ctx.bezierCurveTo(
            random() * inscriptionCanvas.width, random() * inscriptionCanvas.height / 3,
            random() * inscriptionCanvas.width, random() * inscriptionCanvas.height / 3 * 2,
            random() * inscriptionCanvas.width, inscriptionCanvas.height
        );
        ctx.stroke();
    }

    // Add Roman text
    ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
    ctx.font = '40px serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOLIS GLORIA', inscriptionCanvas.width / 2, 80); // "Glory of the Sun"
    ctx.font = '32px serif';
    ctx.fillText('AETERNVM MONVMENTVM', inscriptionCanvas.width / 2, 150); // "Eternal Monument"

    const inscriptionTexture = new THREE.CanvasTexture(inscriptionCanvas);
    const inscriptionMaterial = new THREE.MeshPhongMaterial({
        map: inscriptionTexture,
        bumpMap: inscriptionTexture,
        bumpScale: 0.2
    });

    // Add inscription to each side of the base
    const sides = [
        { pos: [0, 5, 12.6], rot: [0, 0, 0] },      // Front
        { pos: [0, 5, -12.6], rot: [0, Math.PI, 0] }, // Back
        { pos: [12.6, 5, 0], rot: [0, -Math.PI / 2, 0] }, // Right
        { pos: [-12.6, 5, 0], rot: [0, Math.PI / 2, 0] }  // Left
    ];

    sides.forEach(side => {
        const inscription = new THREE.Mesh(inscriptionGeometry, inscriptionMaterial);
        inscription.position.set(side.pos[0], side.pos[1], side.pos[2]);
        inscription.rotation.set(side.rot[0], side.rot[1], side.rot[2]);
        island.add(inscription);

        // Apply outline to inscription
        applyOutline(inscription, { scale: 1.1 });
    });

    // Create obelisk material
    const obeliskCanvas = document.createElement('canvas');
    obeliskCanvas.width = 512;
    obeliskCanvas.height = 1024;
    const obCtx = obeliskCanvas.getContext('2d');

    // Create red granite texture for obelisk
    obCtx.fillStyle = '#7d2e2e';
    obCtx.fillRect(0, 0, obeliskCanvas.width, obeliskCanvas.height);

    // Add granite speckles
    for (let i = 0; i < 10000; i++) {
        const x = Math.random() * obeliskCanvas.width;
        const y = Math.random() * obeliskCanvas.height;
        const size = 1 + Math.random() * 2;
        const shade = 0.8 + Math.random() * 0.4;

        obCtx.fillStyle = `rgba(${Math.floor(125 * shade)}, ${Math.floor(46 * shade)}, ${Math.floor(46 * shade)}, 0.8)`;
        obCtx.fillRect(x, y, size, size);
    }

    // Add simplified "hieroglyphic" patterns
    obCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    obCtx.lineWidth = 2;

    // Create patterns on different parts of the obelisk
    const patternCount = 20;
    const patternHeight = obeliskCanvas.height / patternCount;

    for (let i = 0; i < patternCount; i++) {
        const y = i * patternHeight + patternHeight / 2;

        // Each row has a different pattern
        if (i % 5 === 0) {
            // Horizontal line with dots
            obCtx.beginPath();
            obCtx.moveTo(100, y);
            obCtx.lineTo(obeliskCanvas.width - 100, y);
            obCtx.stroke();

            for (let x = 150; x < obeliskCanvas.width - 150; x += 50) {
                obCtx.beginPath();
                obCtx.arc(x, y - 20, 8, 0, Math.PI * 2);
                obCtx.fill();
            }
        } else if (i % 5 === 1) {
            // Eagle/falcon symbol
            obCtx.beginPath();
            obCtx.moveTo(obeliskCanvas.width / 2, y - 15);
            obCtx.lineTo(obeliskCanvas.width / 2 - 50, y + 15);
            obCtx.lineTo(obeliskCanvas.width / 2 + 50, y + 15);
            obCtx.closePath();
            obCtx.stroke();

            // Eye
            obCtx.beginPath();
            obCtx.arc(obeliskCanvas.width / 2, y, 5, 0, Math.PI * 2);
            obCtx.fill();
        } else if (i % 5 === 2) {
            // Wavy line (water symbol)
            obCtx.beginPath();
            obCtx.moveTo(100, y);

            for (let x = 150; x < obeliskCanvas.width - 100; x += 30) {
                obCtx.lineTo(x, y + ((x % 60 === 0) ? 10 : -10));
            }

            obCtx.lineTo(obeliskCanvas.width - 100, y);
            obCtx.stroke();
        } else if (i % 5 === 3) {
            // Square pattern
            for (let j = 0; j < 5; j++) {
                const x = obeliskCanvas.width / 2 - 100 + j * 50;
                obCtx.strokeRect(x - 15, y - 15, 30, 30);
            }
        } else {
            // Sun symbol
            obCtx.beginPath();
            obCtx.arc(obeliskCanvas.width / 2, y, 20, 0, Math.PI * 2);
            obCtx.stroke();

            // Sun rays
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
                obCtx.beginPath();
                obCtx.moveTo(
                    obeliskCanvas.width / 2 + Math.cos(angle) * 20,
                    y + Math.sin(angle) * 20
                );
                obCtx.lineTo(
                    obeliskCanvas.width / 2 + Math.cos(angle) * 35,
                    y + Math.sin(angle) * 35
                );
                obCtx.stroke();
            }
        }
    }

    // Create obelisk texture
    const obeliskTexture = new THREE.CanvasTexture(obeliskCanvas);
    obeliskTexture.wrapS = THREE.RepeatWrapping;
    obeliskTexture.wrapT = THREE.RepeatWrapping;

    const obeliskMaterial = new THREE.MeshPhongMaterial({
        color: 0x7d2e2e, // Reddish granite color
        map: obeliskTexture,
        bumpMap: obeliskTexture,
        bumpScale: 0.1,
        shininess: 20
    });

    // Create sub-base for obelisk
    const subBaseGeometry = new THREE.BoxGeometry(15, 5, 15);
    const subBase = new THREE.Mesh(subBaseGeometry, obeliskMaterial);
    subBase.position.y = 12.5;
    island.add(subBase);

    // Apply outline to sub-base
    applyOutline(subBase, { scale: 1.1 });

    // Create main obelisk shaft (tapered rectangular prism)
    // Since THREE.js doesn't have a built-in tapered box, we'll create a custom geometry
    const obeliskHeight = 50;
    const bottomWidth = 8;
    const topWidth = 4;

    const obeliskGeometry = new THREE.BufferGeometry();

    // Create vertices for the tapered prism
    const vertices = [];

    // Bottom vertices
    vertices.push(-bottomWidth / 2, 0, -bottomWidth / 2);  // 0: bottom left back
    vertices.push(bottomWidth / 2, 0, -bottomWidth / 2);   // 1: bottom right back
    vertices.push(bottomWidth / 2, 0, bottomWidth / 2);    // 2: bottom right front
    vertices.push(-bottomWidth / 2, 0, bottomWidth / 2);   // 3: bottom left front

    // Top vertices
    vertices.push(-topWidth / 2, obeliskHeight, -topWidth / 2);  // 4: top left back
    vertices.push(topWidth / 2, obeliskHeight, -topWidth / 2);   // 5: top right back
    vertices.push(topWidth / 2, obeliskHeight, topWidth / 2);    // 6: top right front
    vertices.push(-topWidth / 2, obeliskHeight, topWidth / 2);   // 7: top left front

    // Create faces (triangles)
    const indices = [
        // Bottom face
        0, 2, 1,
        0, 3, 2,

        // Top face
        4, 5, 6,
        4, 6, 7,

        // Side faces
        0, 1, 5,
        0, 5, 4,

        1, 2, 6,
        1, 6, 5,

        2, 3, 7,
        2, 7, 6,

        3, 0, 4,
        3, 4, 7
    ];

    // Calculate UVs for texture mapping
    const uvs = [];

    // Bottom face UVs
    uvs.push(0, 0);
    uvs.push(1, 0);
    uvs.push(1, 1);
    uvs.push(0, 1);

    // Top face UVs
    uvs.push(0, 0);
    uvs.push(1, 0);
    uvs.push(1, 1);
    uvs.push(0, 1);

    // Set attributes
    obeliskGeometry.setIndex(indices);
    obeliskGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    obeliskGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    obeliskGeometry.computeVertexNormals();

    // Create the obelisk mesh
    const obeliskShaft = new THREE.Mesh(obeliskGeometry, obeliskMaterial);
    obeliskShaft.position.y = 15; // Position on top of sub-base
    island.add(obeliskShaft);

    // Apply outline to obelisk shaft
    applyOutline(obeliskShaft, { scale: 1.1 });

    // Create pyramid cap for obelisk
    const pyramidHeight = 10;
    const pyramidGeometry = new THREE.ConeGeometry(topWidth * 0.8, pyramidHeight, 4);

    // Create special material for the cap - gold plated
    const pyramidMaterial = new THREE.MeshPhongMaterial({
        color: 0xffdb8a,
        metalness: 0.8,
        roughness: 0.2,
        shininess: 100
    });

    const pyramidCap = new THREE.Mesh(pyramidGeometry, pyramidMaterial);
    pyramidCap.position.y = 15 + obeliskHeight + pyramidHeight / 2;
    pyramidCap.rotation.y = Math.PI / 4; // Rotate 45 degrees for alignment
    island.add(pyramidCap);

    // Apply outline to pyramid cap
    applyOutline(pyramidCap, { scale: 1.1 });

    // Add dramatic lighting effect
    const statueLight = new THREE.PointLight(0xffffaa, 1, 70);
    statueLight.position.set(0, 40, 0);
    island.add(statueLight);

    // Add a subtle pulsing glow from the gold cap
    const capLight = new THREE.PointLight(0xffdd66, 0.8, 50);
    capLight.position.y = 15 + obeliskHeight + pyramidHeight;
    island.add(capLight);

    // Animate the cap light (subtle pulsing effect)
    const pulseAnimation = () => {
        const pulsate = () => {
            const time = Date.now() * 0.001; // Convert to seconds
            capLight.intensity = 0.5 + Math.sin(time) * 0.3;
            requestAnimationFrame(pulsate);
        };
        pulsate();
    };

    // Start the pulsing animation
    pulseAnimation();



    return island;
}

// Function to create a ruined tower mega structure
function createRuinedTower(island, random) {
    // Create stone texture with heavy weathering
    const weatheredStoneTexture = createStoneTexture(new THREE.Color(0x777777), 1.0);

    // Base of the tower
    const baseGeometry = new THREE.CylinderGeometry(15, 18, 10, 16);
    const stoneMaterial = new THREE.MeshPhongMaterial({
        color: 0x777777,
        map: weatheredStoneTexture,
        bumpMap: weatheredStoneTexture,
        bumpScale: 0.08,
        roughness: 0.9
    });
    const base = new THREE.Mesh(baseGeometry, stoneMaterial);
    base.position.y = 5;
    island.add(base);

    // Apply outline to base
    applyOutline(base, { scale: 1.12 });

    // Tower sections with progressive damage
    const sections = 5;
    const maxHeight = 50;
    const sectionHeight = maxHeight / sections;

    for (let i = 0; i < sections; i++) {
        // Each section gets more damaged as we go up
        const damage = i / sections; // 0 to almost 1
        const radius = 12 - (i * 1.5); // Narrower as we go up
        const completeness = 1 - (damage * 0.7); // How complete the circle is

        // Create a cylinder with a portion missing
        const sectionGeometry = new THREE.CylinderGeometry(
            radius - 1, radius,
            sectionHeight,
            16, 1,
            false, // Open ended?
            0, // Start angle
            completeness * Math.PI * 2 // End angle (partial for damage)
        );

        // Rotate each section randomly for varied damage
        const section = new THREE.Mesh(sectionGeometry, stoneMaterial);
        section.position.y = 10 + (i * sectionHeight) + sectionHeight / 2;
        section.rotation.y = random() * Math.PI * 2;
        island.add(section);

        // Apply outline to each section
        applyOutline(section, { scale: 1.15 });

        // Add some fallen debris around the base
        if (i > 1) { // More debris from higher sections
            const debrisCount = Math.floor(random() * 3) + 1;
            for (let d = 0; d < debrisCount; d++) {
                const debrisSize = 2 + random() * 3;
                const debrisGeometry = new THREE.BoxGeometry(debrisSize, debrisSize, debrisSize);
                const debris = new THREE.Mesh(debrisGeometry, stoneMaterial);

                // Position debris around the base
                const angle = random() * Math.PI * 2;
                const distance = 15 + random() * 25;
                debris.position.set(
                    Math.cos(angle) * distance,
                    2 + random() * 3, // Slightly above ground
                    Math.sin(angle) * distance
                );

                // Random rotation for natural look
                debris.rotation.set(
                    random() * Math.PI,
                    random() * Math.PI,
                    random() * Math.PI
                );

                island.add(debris);
            }
        }
    }

    // Add some larger fallen sections
    const largeDebrisCount = 2 + Math.floor(random() * 3);
    for (let d = 0; d < largeDebrisCount; d++) {
        // Create a partial cylinder section as a large piece of debris
        const angle = random() * Math.PI * 0.5; // How much of the cylinder to use
        const largeDebrisGeometry = new THREE.CylinderGeometry(
            5 + random() * 3,
            6 + random() * 3,
            8 + random() * 10,
            16, 1, false,
            0, angle
        );

        const largeDebris = new THREE.Mesh(largeDebrisGeometry, stoneMaterial);

        // Position large debris further from the tower
        const debrisAngle = random() * Math.PI * 2;
        const debrisDistance = 25 + random() * 20;
        largeDebris.position.set(
            Math.cos(debrisAngle) * debrisDistance,
            2,
            Math.sin(debrisAngle) * debrisDistance
        );

        // Rotate to look like it fell over
        largeDebris.rotation.set(
            Math.PI / 2 + (random() * 0.5 - 0.25), // Mostly on its side
            random() * Math.PI * 2,
            random() * Math.PI * 0.3
        );

        island.add(largeDebris);
    }

    // Add some vegetation growing on the ruins
    for (let v = 0; v < 5; v++) {
        const vineGeometry = new THREE.CylinderGeometry(0.5, 0.5, 15, 8);
        const vineColor = new THREE.Color().setHSL(0.3 + random() * 0.1, 0.8, 0.4);
        const vineMaterial = new THREE.MeshPhongMaterial({ color: vineColor });
        const vine = new THREE.Mesh(vineGeometry, vineMaterial);

        // Position vines on the tower
        const vineAngle = random() * Math.PI * 2;
        const vineHeight = 10 + random() * 30;
        const vineRadius = 12 - (vineHeight / maxHeight * 5); // Match tower radius at that height

        vine.position.set(
            Math.cos(vineAngle) * vineRadius,
            vineHeight,
            Math.sin(vineAngle) * vineRadius
        );

        // Angle vines to droop down the tower
        vine.rotation.x = Math.PI / 2 - 0.5 - random() * 0.5;
        vine.rotation.y = random() * Math.PI * 2;

        island.add(vine);
    }

    // Add a mysterious glow at the top - don't outline since it glows
    const glowGeometry = new THREE.SphereGeometry(3, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x66ccff,
        transparent: true,
        opacity: 0.7
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.y = maxHeight + 5;
    island.add(glow);

    // Add a point light for the glow
    const glowLight = new THREE.PointLight(0x66ccff, 1, 50);
    glowLight.position.y = maxHeight + 5;
    island.add(glowLight);
}

// Function to update visible chunks based on boat position

// Find nearest island function
function findNearestIsland(boat) {
    let nearest = { distance: Infinity, name: "None" };

    activeIslands.forEach((island, id) => {
        /*const distance = boat.position.distanceTo(island.collider.center);
        if (distance < nearest.distance) {
            nearest = {
                distance: distance,
                name: `Island ${id.substring(0, 4)}` // Use part of the ID as a name
            };
        }*/
    });

    return nearest;
}

// Check for island collisions
function checkIslandCollision(position, extraRadius = 2) {
    for (const collider of islandColliders) {
        const distance = position.distanceTo(collider.center);
        if (distance < collider.radius + extraRadius) {
            return true;
        }
    }
    return false;
}

// Add a function to update shores in the animation loop
function updateIslandEffects(deltaTime) {
    if (areShoreEffectsEnabled()) {
        updateShores(deltaTime);
    }
}

// Add these variables to track the massive island
let massiveIslandSpawned = false;
let massiveIslandPosition = { x: 2000, z: 2000 }; // Position for the massive island


// Getter and setter functions for massive island variables
export function getMassiveIslandSpawned() {
    return massiveIslandSpawned;
}

export function setMassiveIslandSpawned(value) {
    massiveIslandSpawned = value;
}

export function getMassiveIslandPosition() {
    return { ...massiveIslandPosition }; // Return a copy to prevent direct modification
}

export function setMassiveIslandPosition(position) {
    massiveIslandPosition = { ...position };
}

/**
 * Spawns a single massive island at the specified position
 * @param {THREE.Scene} scene - The scene to add the island to
 */
export function spawnMassiveIsland(scene) {

    return null; // Return null instead of creating the island
}

/**
 * Checks collisions with all island types
 * @param {THREE.Vector3} position - Position to check
 * @param {number} extraRadius - Extra radius to add to collision check
 * @returns {boolean} Whether there is a collision
 */
export function checkAllIslandCollisions(position, extraRadius = 2) {
    // Check regular islands
    const regularIslandCollision = checkIslandCollision(position, extraRadius);

    // Check massive islands
    const massiveIslandCollision = checkMassiveIslandCollision(position, extraRadius);

    return regularIslandCollision || massiveIslandCollision;
}

/**
 * Finds the nearest island of any type
 * @param {THREE.Object3D} boat - The boat object
 * @returns {object} Object with distance and name of nearest island
 */
export function findNearestAnyIsland(boat) {
    // Find nearest regular island
    const nearestRegular = findNearestIsland(boat);

    // Find nearest massive island if spawned
    let nearestMassive = { distance: Infinity, name: "None" };
    if (massiveIslandSpawned) {
        nearestMassive = findNearestMassiveIsland(boat.position);
    }

    // Return the closest one
    if (nearestMassive.distance < nearestRegular.distance) {
        return nearestMassive;
    } else {
        return nearestRegular;
    }
}

/**
 * Updates all island effects
 * @param {number} deltaTime - Time since last update
 */
export function updateAllIslandEffects(deltaTime) {
    // Update regular island shores
    updateIslandEffects(deltaTime);

    // Update massive island shores
    if (massiveIslandSpawned) {
        updateMassiveIslandShores(deltaTime);
    }
}


/**
 * Spawns a massive block-based cave system at the specified position
 * @param {THREE.Scene} scene - The scene to add the cave to
 * @param {THREE.Vector3} position - Position to place the cave (optional)
 * @returns {Object} - References to the cave system
 */
export function spawnBlockCaveFromIsland(scene, position = new THREE.Vector3(0, 0, 0)) {

    return createBlockCave(scene, position);
}

/**
 * Placeholder function for coastal cliff scene (disabled for now)
 * @param {THREE.Scene} scene - The scene object
 * @param {THREE.Vector3} position - Position for the cliff
 * @returns {Object} - Empty object
 */
export function spawnCoastalCliffScene(scene, position = new THREE.Vector3(0, 0, 0)) {

    return null; // Return null instead of creating the cliff
}

// Main function that spawns islands and cave systems
export function spawnIslands(scene, position) {


    // ONLY spawn the block cave - everything else is disabled
    try {

        spawnBlockCaveFromIsland(scene, position);
    } catch (error) {

    }

    // Return immediately after spawning block cave
    // This ensures no other island generation code runs
    return true;
}

/**
 * Removes a collider from the island colliders array by ID
 * @param {string} id - ID of the collider to remove
 * @returns {boolean} Whether the collider was found and removed
 */
export function removeIslandCollider(id) {
    const initialLength = islandColliders.length;
    islandColliders = islandColliders.filter(c => c.id !== id);
    return islandColliders.length < initialLength; // Return true if a collider was removed
}

// Export everything together at the bottom of the file
export {
    islandColliders,
    activeIslands,
    createIsland,
    findNearestIsland,
    checkIslandCollision,
    updateIslandEffects,
    areShoreEffectsEnabled,
    SPAWN_CONTROLS
}; 