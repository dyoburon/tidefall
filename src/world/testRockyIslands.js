/**
 * Test file for debugging the rocky islands implementation
 * This can be imported temporarily in main.js to test the rocky islands
 */

import * as THREE from 'three';
import { createRockyIsland } from './rockyIslands.js';

/**
 * Creates a test rocky island at a specific position for debugging
 * @param {THREE.Scene} scene - The scene to add the island to
 * @param {number} x - X position
 * @param {number} z - Z position
 */
export function createTestRockyIsland(scene, x = 300, z = 300) {

    const seed = Math.floor(Math.random() * 1000000);
    const island = createRockyIsland(x, z, seed, scene);

    return island;
}

/**
 * Creates multiple test rocky islands around the scene for visual testing
 * @param {THREE.Scene} scene - The scene to add islands to
 * @param {number} count - Number of islands to create
 * @param {number} radius - Radius around center to place islands
 * @param {THREE.Vector3} center - Center position to place islands around
 */
export function createTestRockyIslandCluster(scene, count = 3, radius = 1200, center = new THREE.Vector3(0, 0, 0)) {


    const islands = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = center.x + Math.cos(angle) * radius;
        const z = center.z + Math.sin(angle) * radius;
        const seed = Math.floor(Math.random() * 1000000);

        const island = createRockyIsland(x, z, seed, scene);
        islands.push(island);
    }


    return islands;
} 