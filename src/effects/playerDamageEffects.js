/**
 * Centralized Damage Visualization System
 * 
 * This module provides standardized visual effects for player damage
 * that can be used by all abilities in the game.
 */

import * as THREE from 'three';
import { scene } from '../core/gameState.js';
import { createFloatingText } from '../effects/floatingText.js';
import { playSound } from '../audio/soundEffects.js';

// Configuration constants for visual effects
const DAMAGE_FLASH_DURATION = 0.3; // seconds
const DAMAGE_FLASH_COLOR = 0xff0000; // red
const DAMAGE_NUMBER_DURATION = 1.0; // seconds
const DAMAGE_NUMBER_SCALE = 1.0;
const SMOKE_PARTICLE_COUNT = {
    light: 5,
    medium: 10,
    heavy: 20
};

/**
 * Main function to display damage effects on a player
 * 
 * @param {THREE.Object3D} playerMesh - The mesh of the damaged player
 * @param {number} damageAmount - Amount of damage dealt
 * @param {string} damageType - Type of damage (e.g., 'cannon', 'fire', 'collision')
 */
export function showDamageEffect(playerMesh, damageAmount, damageType = 'cannon') {
    if (!playerMesh) return;

    // Get position for effects (center of player mesh)
    const position = new THREE.Vector3();
    playerMesh.getWorldPosition(position);

    // Flash the damaged boat
    showHitFlash(playerMesh);

    // Show floating damage number
    showDamageNumber(position, damageAmount);

    // Add smoke effect based on damage amount
    let smokeIntensity = 'light';
    if (damageAmount > 30) {
        smokeIntensity = 'heavy';
    } else if (damageAmount > 15) {
        smokeIntensity = 'medium';
    }

    //showSmokeEffect(playerMesh, smokeIntensity);

    // Play appropriate sound based on damage type
    playDamageSound(damageType, damageAmount);
}

/**
 * Creates a flash effect on the damaged boat
 * 
 * @param {THREE.Object3D} playerMesh - The mesh to flash
 */
export function showHitFlash(playerMesh) {
    if (!playerMesh) return;

    const originalMaterials = [];
    const flashMaterials = [];

    // Save original materials and create flash materials
    playerMesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
            // Handle both single materials and material arrays
            if (Array.isArray(child.material)) {
                const materials = [];
                const flashMats = [];

                child.material.forEach(mat => {
                    materials.push(mat);

                    // Create flash material based on original
                    const flashMat = mat.clone();
                    flashMat.emissive = new THREE.Color(DAMAGE_FLASH_COLOR);
                    flashMat.emissiveIntensity = 0.7;
                    flashMats.push(flashMat);
                });

                originalMaterials.push({ mesh: child, materials });
                flashMaterials.push({ mesh: child, materials: flashMats });
            } else {
                originalMaterials.push({ mesh: child, material: child.material });

                // Create flash material based on original
                const flashMat = child.material.clone();
                flashMat.emissive = new THREE.Color(DAMAGE_FLASH_COLOR);
                flashMat.emissiveIntensity = 0.7;
                flashMaterials.push({ mesh: child, material: flashMat });
            }
        }
    });

    // Apply flash materials
    flashMaterials.forEach(item => {
        if (Array.isArray(item.materials)) {
            item.mesh.material = item.materials;
        } else {
            item.mesh.material = item.material;
        }
    });

    // Restore original materials after flash duration
    setTimeout(() => {
        originalMaterials.forEach(item => {
            if (Array.isArray(item.materials)) {
                item.mesh.material = item.materials;
            } else {
                item.mesh.material = item.material;
            }
        });
    }, DAMAGE_FLASH_DURATION * 1000);
}

/**
 * Shows a floating damage number at the specified position
 * 
 * @param {THREE.Vector3} position - Position to show the damage number
 * @param {number} amount - Amount of damage to display
 */
export function showDamageNumber(position, amount) {


    // Add some randomness to position so multiple hits don't overlap
    const offsetPosition = position.clone().add(
        new THREE.Vector3(
            ((Math.random() * 3) - 1.0) * 2,
            Math.random() * 2 + 2, // Add more height to ensure visibility
            ((Math.random() * 3) - 1.0) * 2
        )
    );

    // Format damage amount
    const damageText = `-${Math.round(amount)}`;


    // Create floating text that rises and fades
    const textObj = createFloatingText({
        text: damageText,
        position: offsetPosition,
        color: 0xff0000, // Brighter red
        size: 200 * DAMAGE_NUMBER_SCALE, // Larger size
        duration: 1.0, // Longer duration
        disappear: false,
        riseFactor: 5.0, // Slower rise
        fadeOut: true
    });
}

/**
 * Creates smoke particles at the damage position
 * 
 * @param {THREE.Object3D} playerMesh - The mesh of the damaged player
 * @param {string} intensity - Intensity of smoke ('light', 'medium', 'heavy')
 */
export function showSmokeEffect(playerMesh, intensity = 'medium') {
    if (!playerMesh || !scene) return;

    const position = new THREE.Vector3();
    playerMesh.getWorldPosition(position);

    // Determine number of particles based on intensity
    const particleCount = SMOKE_PARTICLE_COUNT[intensity] || SMOKE_PARTICLE_COUNT.medium;

    // Create smoke particles
    const particleGroup = new THREE.Group();
    scene.add(particleGroup);

    // Create simple particle geometry
    const particleGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.7
    });

    // Create and animate each particle
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());

        // Position around the damage point
        particle.position.copy(position).add(
            new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 1,
                (Math.random() - 0.5) * 2
            )
        );

        // Add random velocity
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            2 + Math.random() * 2,
            (Math.random() - 0.5) * 0.5
        );

        // Add to particle group
        particleGroup.add(particle);

        // Set particle to expand over time
        particle.userData.scaleRate = 0.01 + Math.random() * 0.02;
        particle.userData.opacityDecay = 0.01 + Math.random() * 0.02;
    }

    // Animate smoke particles
    let elapsed = 0;
    const duration = 2.0; // seconds

    function animateSmoke() {
        elapsed += 0.016; // Approximately 60fps

        if (elapsed >= duration) {
            // Remove particles when animation completes
            scene.remove(particleGroup);
            return;
        }

        // Update each particle
        particleGroup.children.forEach(particle => {
            // Move based on velocity
            particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.016));

            // Slow down as it rises
            particle.userData.velocity.multiplyScalar(0.98);

            // Expand
            particle.scale.addScalar(particle.userData.scaleRate);

            // Fade out
            particle.material.opacity -= particle.userData.opacityDecay;
            if (particle.material.opacity < 0) {
                particle.material.opacity = 0;
            }
        });

        requestAnimationFrame(animateSmoke);
    }

    animateSmoke();
}

/**
 * Plays appropriate sound based on damage type and amount
 * 
 * @param {string} damageType - Type of damage
 * @param {number} damageAmount - Amount of damage
 */
function playDamageSound(damageType, damageAmount) {
    let soundId = '';

    switch (damageType) {
        case 'cannon':
            soundId = 'impact_cannon';
            break;
        case 'fire':
            soundId = 'impact_fire';
            break;
        case 'collision':
            soundId = 'impact_collision';
            break;
        default:
            soundId = 'impact_generic';
    }

    // Adjust volume based on damage amount
    const volume = Math.min(0.5 + (damageAmount / 100) * 0.5, 1.0);

}

/**
 * Shows a water splash effect when projectiles hit water
 * 
 * @param {THREE.Vector3} position - Position of the splash
 * @param {number} scale - Scale of the splash (1.0 is default)
 */
export function createWaterSplashEffect(position, scale = 1.0) {
    if (!scene) return;

    // Create splash particles
    const splashGroup = new THREE.Group();
    scene.add(splashGroup);

    // Create base splash geometry
    const dropletGeometry = new THREE.SphereGeometry(0.2 * scale, 4, 4);
    const dropletMaterial = new THREE.MeshBasicMaterial({
        color: 0x3377ff,
        transparent: true,
        opacity: 0.7
    });

    // Create water columns and droplets
    const dropletCount = Math.floor(15 * scale);

    for (let i = 0; i < dropletCount; i++) {
        const droplet = new THREE.Mesh(dropletGeometry, dropletMaterial.clone());

        // Position at water surface with slight randomness
        droplet.position.copy(position).add(
            new THREE.Vector3(
                (Math.random() - 0.5) * 2 * scale,
                0.1,
                (Math.random() - 0.5) * 2 * scale
            )
        );

        // Initial upward velocity with randomness
        const upwardForce = 5 + Math.random() * 5 * scale;
        const horizontalForce = (Math.random() - 0.5) * 3 * scale;

        droplet.userData.velocity = new THREE.Vector3(
            horizontalForce,
            upwardForce,
            horizontalForce
        );

        // Add gravity factor
        droplet.userData.gravity = 9.8 * scale;

        // Add to splash group
        splashGroup.add(droplet);
    }

    // Add white foam at the center
    const foamGeometry = new THREE.CircleGeometry(1.5 * scale, 16);
    const foamMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });

    const foam = new THREE.Mesh(foamGeometry, foamMaterial);
    foam.rotation.x = -Math.PI / 2; // Make it horizontal
    foam.position.copy(position).add(new THREE.Vector3(0, 0.05, 0));
    splashGroup.add(foam);

    // Animate splash
    let elapsed = 0;
    const duration = 1.5; // seconds

    function animateSplash() {
        elapsed += 0.016; // Approximately 60fps

        if (elapsed >= duration) {
            // Remove splash when animation completes
            scene.remove(splashGroup);
            return;
        }

        // Scale up foam and fade it out
        foam.scale.addScalar(0.05);
        foam.material.opacity = 0.8 * (1 - (elapsed / duration));

        // Update each droplet
        splashGroup.children.forEach(child => {
            if (child !== foam && child.userData.velocity) {
                // Apply gravity
                child.userData.velocity.y -= child.userData.gravity * 0.016;

                // Move based on velocity
                child.position.add(child.userData.velocity.clone().multiplyScalar(0.016));

                // If below water, remove velocity and fade out
                if (child.position.y <= 0) {
                    child.position.y = 0;
                    child.userData.velocity = null; // Stop moving
                    child.material.opacity -= 0.1; // Fade out quickly
                } else {
                    child.material.opacity = 0.7 * (1 - (elapsed / duration));
                }
            }
        });

        requestAnimationFrame(animateSplash);
    }

    animateSplash();
}