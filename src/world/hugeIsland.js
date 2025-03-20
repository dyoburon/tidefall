import * as THREE from 'three';
import { createShoreEffect } from './shores.js';
import { applyOutline } from '../theme/outlineStyles.js';
import { scene } from '../core/gameState.js';

// Constants for huge island generation
const HUGE_ISLAND_SIZE = 1000; // Much larger than regular islands
const PERFORMANCE_MODE = true; // Toggle for performance optimization
const GEOMETRY_DETAIL = PERFORMANCE_MODE ? 0.3 : 1.0; // Reduce geometry detail by 70% for performance

// Array to store huge island colliders for collision detection
const hugeIslandColliders = [];

// Map to track active huge islands
const activeHugeIslands = new Map();

/**
 * Creates a huge island with a simple mountain formation
 * @param {number} x - X coordinate in the world
 * @param {number} z - Z coordinate in the world
 * @param {number} seed - Seed for random generation
 * @param {THREE.Group} chunkGroup - The chunk group to add the island to
 * @returns {Object} - The created island entry with mesh and collider info
 */
export function createHugeIsland(x, z, seed, chunkGroup) {
    // Create a deterministic random function based on the seed
    const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    // Generate unique island ID
    const islandId = `huge_island_${Math.floor(x)}_${Math.floor(z)}`;

    // Skip if this island already exists
    if (activeHugeIslands.has(islandId)) {
        return activeHugeIslands.get(islandId);
    }

    // Island radius - much larger than regular islands
    const baseRadius = HUGE_ISLAND_SIZE;

    // Create island container
    const island = new THREE.Group();
    island.position.set(x, 0, z);
    chunkGroup.add(island);

    // Create island collider 
    const collider = {
        center: new THREE.Vector3(x, 0, z),
        radius: baseRadius,
        id: islandId
    };
    hugeIslandColliders.push(collider);

    // Create the gradual sloping base
    createGradualBase(island, baseRadius, random);

    // Create the main mountain
    createMountain(island, baseRadius * 0.7, random);

    // Add smaller mountain features
    addSecondaryMountains(island, baseRadius * 0.7, random);

    // Store the island with its ID and collider reference
    const islandEntry = {
        mesh: island,
        collider: collider,
        visible: true
    };

    activeHugeIslands.set(islandId, islandEntry);

    // Add shore effect if the scene is provided
    if (scene) {
        const shore = createShoreEffect(island, collider, scene);
        islandEntry.shore = shore;
    }

    return islandEntry;
}

/**
 * Creates a gradual sloping base for the island
 * @param {THREE.Group} island - The island group
 * @param {number} baseRadius - The base radius
 * @param {Function} random - Random function
 */
function createGradualBase(island, baseRadius, random) {
    // Create a simple base with gradually increasing height
    const baseSegments = Math.floor(24 * GEOMETRY_DETAIL);
    const baseGeometry = new THREE.CylinderGeometry(
        baseRadius,
        baseRadius * 1.1,
        10,
        baseSegments,
        1
    );

    const baseColor = new THREE.Color(0x8B4513); // Brown
    const baseMaterial = new THREE.MeshPhongMaterial({
        color: baseColor,
        flatShading: true
    });

    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0;
    island.add(base);
    applyOutline(base);

    // Add a second layer with smaller radius
    const secondLayerGeometry = new THREE.CylinderGeometry(
        baseRadius * 0.9,
        baseRadius,
        15,
        baseSegments,
        1
    );

    const secondLayer = new THREE.Mesh(secondLayerGeometry, baseMaterial);
    secondLayer.position.y = 10;
    island.add(secondLayer);
}

/**
 * Creates the main mountain structure
 * @param {THREE.Group} island - The island group
 * @param {number} radius - The mountain base radius
 * @param {Function} random - Random function
 */
function createMountain(island, radius, random) {
    // Create a simple cone for the mountain
    const baseHeightVariation = random() * 50 + 200; // Height between 200-250
    const segments = Math.floor(16 * GEOMETRY_DETAIL);

    // Create a simple cone geometry
    const mountainGeometry = new THREE.ConeGeometry(
        radius,
        baseHeightVariation,
        segments,
        4 // Reduced segments for height for simpler shape
    );

    // Create material with a slight random tint
    const colorValue = 0.2 + random() * 0.1;
    const mountainColor = new THREE.Color(colorValue, colorValue, colorValue);
    const mountainMaterial = new THREE.MeshPhongMaterial({
        color: mountainColor,
        flatShading: true
    });

    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
    mountain.position.y = 15; // Position on top of the base
    island.add(mountain);

    // Apply outline
    applyOutline(mountain);
}

/**
 * Adds smaller secondary mountains
 * @param {THREE.Group} island - The island group
 * @param {number} radius - The main mountain radius
 * @param {Function} random - Random function
 */
function addSecondaryMountains(island, radius, random) {
    // Number of secondary mountains - fewer for performance
    const count = Math.floor(3 * GEOMETRY_DETAIL);

    for (let i = 0; i < count; i++) {
        // Calculate position in a circle around the main mountain
        const angle = random() * Math.PI * 2;
        const distance = (0.4 + random() * 0.3) * radius;

        const posX = Math.cos(angle) * distance;
        const posZ = Math.sin(angle) * distance;

        // Create smaller mountain
        const height = 100 + random() * 80;
        const secondaryRadius = radius * (0.2 + random() * 0.3);

        const segments = Math.floor(12 * GEOMETRY_DETAIL);
        const secondaryGeometry = new THREE.ConeGeometry(
            secondaryRadius,
            height,
            segments,
            3 // Even fewer segments for secondary mountains
        );

        // Create material with a slight random tint
        const colorValue = 0.15 + random() * 0.15;
        const mountainColor = new THREE.Color(colorValue, colorValue, colorValue);
        const secondaryMaterial = new THREE.MeshPhongMaterial({
            color: mountainColor,
            flatShading: true
        });

        const secondaryMountain = new THREE.Mesh(secondaryGeometry, secondaryMaterial);
        secondaryMountain.position.set(posX, 15, posZ);
        island.add(secondaryMountain);

        // Apply outline
        applyOutline(secondaryMountain);
    }
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
        if (islandEntry.mesh && islandEntry.mesh.parent) {
            islandEntry.mesh.parent.remove(islandEntry.mesh);
        }
        if (islandEntry.shore) {
            removeShore(islandEntry.shore);
        }
    });

    activeHugeIslands.clear();
}