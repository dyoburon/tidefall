import * as THREE from 'three';
import { scene, getTime, addToScene, removeFromScene, isInScene } from '../core/gameState.js';

// Configuration
const MAX_TREASURE_DROPS = 10; // Maximum number of treasure drops rendered at once
const TREASURE_LIFETIME = 30; // Seconds before treasure disappears
const COLLECT_DISTANCE = 12; // Distance at which player can collect treasures
const PARTICLE_COUNT = 12; // Number of particles orbiting each treasure

// Treasure types with different colors and values
export const TREASURE_TYPES = {
    CORAL_RED: {
        name: "Fire Coral Fragment",
        value: 8,
        color: 0xff5a5a,
        emissive: 0xff3030,
        description: "A vibrant red coral fragment that radiates heat energy."
    },
    CORAL_BLUE: {
        name: "Frost Coral Fragment",
        value: 10,
        color: 0x5a9fff,
        emissive: 0x3080ff,
        description: "A cool blue coral piece that emanates a gentle chill."
    },
    CORAL_GREEN: {
        name: "Venom Coral Fragment",
        value: 12,
        color: 0x50ff70,
        emissive: 0x30e050,
        description: "A toxic green coral fragment with mysterious properties."
    },
    CORAL_PURPLE: {
        name: "Arcane Coral Fragment",
        value: 15,
        color: 0xc050ff,
        emissive: 0xa030e0,
        description: "A magical purple coral piece humming with arcane energy."
    },
    CORAL_GOLD: {
        name: "Royal Coral Fragment",
        value: 20,
        color: 0xffd700,
        emissive: 0xffcc00,
        description: "A rare golden coral fragment fit for a sea king's crown."
    }
};

// Associate monster types with specific treasure types
export const MONSTER_TREASURE_MAPPING = {
    yellowBeast: TREASURE_TYPES.CORAL_GOLD,
    kraken: TREASURE_TYPES.CORAL_PURPLE,
    seaSerpent: TREASURE_TYPES.CORAL_GREEN,
    phantomJellyfish: TREASURE_TYPES.CORAL_BLUE
};

// Tracking collections
let treasureDrops = [];
let treasureInventory = {};
let playerBoat = null;

// Initialize the treasure system
export function initTreasureSystem(boat) {
    playerBoat = boat;
    treasureDrops = [];

    return treasureInventory;
}

// Create a new treasure drop at the specified position
export function createTreasureDrop(position, monsterType) {
    // Check if we already have too many drops - remove oldest ones if needed
    while (treasureDrops.length >= MAX_TREASURE_DROPS) {
        // Find the oldest drop
        let oldestIndex = 0;
        let oldestTime = Infinity;

        treasureDrops.forEach((drop, index) => {
            if (drop.userData.creationTime < oldestTime) {
                oldestTime = drop.userData.creationTime;
                oldestIndex = index;
            }
        });

        const oldestDrop = treasureDrops[oldestIndex];

        // Remove oldest drop and its particles
        if (oldestDrop.userData.particles) {
            oldestDrop.userData.particles.forEach(particle => {
                removeFromScene(particle);
            });
        }

        removeFromScene(oldestDrop);
        treasureDrops.splice(oldestIndex, 1);
    }

    // Determine treasure type based on monster type
    const treasureType = MONSTER_TREASURE_MAPPING[monsterType] || TREASURE_TYPES.CORAL_RED;

    // Create the coral fragment group
    const treasureGroup = new THREE.Group();
    treasureGroup.position.copy(position);
    treasureGroup.position.y = 0.5; // Float slightly above water
    treasureGroup.name = `treasure_${getTime()}_${treasureType.name}`;
    treasureGroup.userData = {
        treasureType: treasureType,
        creationTime: getTime() / 1000,
        bobHeight: 0.5 + Math.random() * 0.2, // Random bob height
        bobSpeed: 1 + Math.random() * 0.5,    // Random bob speed
        rotationSpeed: 0.2 + Math.random() * 0.3, // Random rotation
        particles: []
    };

    // Create the main coral fragment geometry
    // Using a custom geometry for a more interesting coral shape
    const coralGeometry = createCoralGeometry();

    // Create material with cartoon outline effect
    const coralMaterial = new THREE.MeshStandardMaterial({
        color: treasureType.color,
        emissive: treasureType.emissive,
        emissiveIntensity: 0.7,
        roughness: 0.7,
        metalness: 0.3
    });

    // Create outline material
    const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    });

    // Create coral mesh
    const coralMesh = new THREE.Mesh(coralGeometry, coralMaterial);
    coralMesh.scale.set(1.4, 1.4, 1.4); // Doubled from 0.7 to 1.4
    treasureGroup.add(coralMesh);

    // Create outline mesh (slightly larger)
    const outlineMesh = new THREE.Mesh(coralGeometry, outlineMaterial);
    outlineMesh.scale.set(1.6, 1.6, 1.6); // Doubled from 0.8 to 1.6
    treasureGroup.add(outlineMesh);

    // Add orbiting particles
    createOrbitingParticles(treasureGroup, treasureType);

    // Add to scene and tracking array
    addToScene(treasureGroup);
    treasureDrops.push(treasureGroup);



    return treasureGroup;
}

// Custom geometry for coral fragment
function createCoralGeometry() {
    // Instead of creating separate geometries and merging them,
    // we'll use a single object and add the coral features directly

    // Start with a more detailed icosahedron for better shape
    const coralGeometry = new THREE.IcosahedronGeometry(1, 1);

    // Get position attribute for modification
    const positions = coralGeometry.attributes.position;
    const vertexCount = positions.count;

    // Add noise to create irregular coral-like surface
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);

        // Calculate distance from center
        const distance = Math.sqrt(x * x + y * y + z * z);

        // Add noise based on position
        const noise = (Math.random() * 0.3) + 0.8;

        // Update vertex position with noise
        positions.setXYZ(i, x * noise, y * noise, z * noise);
    }

    // Update geometry
    positions.needsUpdate = true;

    // Add spike-like protrusions using vertex modification
    // Instead of merging geometries, we'll modify existing vertices
    const spikeCount = 5 + Math.floor(Math.random() * 3);

    // For each spike, find vertices in a region and pull them outward
    for (let i = 0; i < spikeCount; i++) {
        // Choose a random direction for the spike
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const spikeDir = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        ).normalize();

        // Strength of the spike extrusion
        const spikeStrength = 0.5 + Math.random() * 0.8;

        // For each vertex, check if it's in the region of this spike
        for (let j = 0; j < vertexCount; j++) {
            const x = positions.getX(j);
            const y = positions.getY(j);
            const z = positions.getZ(j);

            const vertexDir = new THREE.Vector3(x, y, z).normalize();

            // If vertex direction is close to spike direction, pull it out
            const alignment = vertexDir.dot(spikeDir);
            if (alignment > 0.8) {
                // Pull vertex outward based on alignment
                const pullFactor = alignment * spikeStrength;
                positions.setXYZ(j,
                    x * (1 + pullFactor),
                    y * (1 + pullFactor),
                    z * (1 + pullFactor)
                );
            }
        }
    }

    // Make sure to update normals
    positions.needsUpdate = true;
    coralGeometry.computeVertexNormals();

    return coralGeometry;
}

// Create small particles that orbit around the treasure
function createOrbitingParticles(treasureGroup, treasureType) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Create particle geometry - double the size
        const particleGeometry = new THREE.SphereGeometry(0.14, 8, 8); // Doubled from 0.07

        // Create particle material with glow
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: treasureType.emissive,
            transparent: true,
            opacity: 0.8
        });

        // Create particle mesh
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);

        // Random orbit parameters
        const orbitRadius = 2.4 + Math.random() * 1.2; // Doubled from 1.2 + random * 0.6
        const orbitSpeed = 0.5 + Math.random() * 1.5;
        const orbitOffset = Math.random() * Math.PI * 2;
        const orbitHeight = (Math.random() - 0.5) * 0.8;
        const orbitDirection = Math.random() > 0.5 ? 1 : -1;

        // Store parameters for animation
        particle.userData = {
            orbitRadius,
            orbitSpeed,
            orbitOffset,
            orbitHeight,
            orbitDirection
        };

        // Add to scene and store in treasureGroup
        addToScene(particle);
        treasureGroup.userData.particles.push(particle);
    }
}

// Update all treasure drops
export function updateTreasures(deltaTime) {
    if (!deltaTime || isNaN(deltaTime)) {
        deltaTime = 0.016; // Default to ~60fps
    }

    if (treasureDrops.length === 0) return;

    const currentTime = getTime() / 1000;

    // Update each treasure
    for (let i = treasureDrops.length - 1; i >= 0; i--) {
        const treasure = treasureDrops[i];

        // Skip if invalid
        if (!treasure || !treasure.userData) {
            treasureDrops.splice(i, 1);
            continue;
        }

        // Check if expired
        if (currentTime - treasure.userData.creationTime > TREASURE_LIFETIME) {
            // Clean up particles
            if (treasure.userData.particles) {
                treasure.userData.particles.forEach(particle => {
                    removeFromScene(particle);
                });
            }

            removeFromScene(treasure);
            treasureDrops.splice(i, 1);
            continue;
        }

        // Animate bobbing up and down on water
        const bobHeight = treasure.userData.bobHeight;
        const bobSpeed = treasure.userData.bobSpeed;
        treasure.position.y = 0.5 + Math.sin(currentTime * bobSpeed) * bobHeight * 0.3;

        // Rotate slowly
        treasure.rotation.y += treasure.userData.rotationSpeed * deltaTime;

        // Animate emissive intensity (pulsing glow)
        if (treasure.children[0] && treasure.children[0].material) {
            const pulseIntensity = 0.7 + Math.sin(currentTime * 2) * 0.3;
            treasure.children[0].material.emissiveIntensity = pulseIntensity;
        }

        // Update orbiting particles
        if (treasure.userData.particles) {
            treasure.userData.particles.forEach(particle => {
                const data = particle.userData;

                // Calculate orbit position
                const angle = currentTime * data.orbitSpeed * data.orbitDirection + data.orbitOffset;
                const x = Math.cos(angle) * data.orbitRadius;
                const z = Math.sin(angle) * data.orbitRadius;
                const y = data.orbitHeight + Math.sin(currentTime * 3 + data.orbitOffset) * 0.1;

                // Position relative to treasure
                particle.position.set(
                    treasure.position.x + x,
                    treasure.position.y + y,
                    treasure.position.z + z
                );

                // Pulse opacity
                particle.material.opacity = 0.5 + Math.sin(currentTime * 5 + data.orbitOffset) * 0.3;
            });
        }

        // Check for player collection if boat exists
        if (playerBoat) {
            const boatPosition = playerBoat.position.clone();
            boatPosition.y = 0.5; // Match Y level

            if (treasure.position.distanceTo(boatPosition) < COLLECT_DISTANCE) {
                // Collect treasure
                collectTreasure(treasure);

                // Clean up particles
                if (treasure.userData.particles) {
                    treasure.userData.particles.forEach(particle => {
                        removeFromScene(particle);
                    });
                }

                removeFromScene(treasure);
                treasureDrops.splice(i, 1);
            }
        }
    }
}

// Collect a treasure and add to inventory
function collectTreasure(treasure) {
    const treasureType = treasure.userData.treasureType;
    const treasureName = treasureType.name;

    // Add to inventory
    if (!treasureInventory[treasureName]) {
        treasureInventory[treasureName] = {
            ...treasureType,
            count: 1
        };
    } else {
        treasureInventory[treasureName].count++;
    }



    // Update the inventory UI if it exists
    updateTreasureInventoryDisplay();

    // Play collection sound
    playCollectionSound(treasureType);

    // Create collection effect
    createCollectionEffect(treasure.position, treasureType.color);
}

// Update the treasure inventory in the UI when changes occur
function updateTreasureInventoryDisplay() {
    // If inventory UI exists and has a method for updating treasures, call it
    if (window.inventoryUI && typeof window.inventoryUI.updateTreasureInventory === 'function') {
        window.inventoryUI.updateTreasureInventory(treasureInventory);
    }
}

// Create visual effect when collecting treasure
function createCollectionEffect(position, color) {
    // Create particle burst
    const particleCount = 15;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.1, 6, 6);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1.0
        });

        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);

        // Random velocity - upward and outward
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.5;
        const velocity = new THREE.Vector3(
            Math.cos(angle) * speed,
            1 + Math.random() * 2,
            Math.sin(angle) * speed
        );

        particle.userData = { velocity };

        addToScene(particle);
        particles.push(particle);
    }

    // Animate particles
    const startTime = getTime();

    function animateParticles() {
        const elapsedTime = (getTime() - startTime) / 1000;

        if (elapsedTime > 1.0) {
            // Remove all particles
            particles.forEach(particle => removeFromScene(particle));
            return;
        }

        // Update particles
        particles.forEach(particle => {
            // Apply gravity
            particle.userData.velocity.y -= 0.1;

            // Move particle
            particle.position.add(particle.userData.velocity);

            // Fade out
            particle.material.opacity = 1.0 - elapsedTime;
        });

        requestAnimationFrame(animateParticles);
    }

    animateParticles();
}

// Play collection sound with tone based on treasure type
function playCollectionSound(treasureType) {
    // Create audio context if not already created
    if (!window.audioContext) {
        try {
            window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {

            return;
        }
    }

    // Base frequency varies by treasure type value
    const baseFreq = 400 + (treasureType.value * 20);

    // Create oscillators for a more complex sound
    const oscillator1 = window.audioContext.createOscillator();
    const oscillator2 = window.audioContext.createOscillator();
    const gainNode = window.audioContext.createGain();

    // Set oscillator types and frequencies
    oscillator1.type = 'sine';
    oscillator1.frequency.setValueAtTime(baseFreq, window.audioContext.currentTime);
    oscillator1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, window.audioContext.currentTime + 0.2);

    oscillator2.type = 'triangle';
    oscillator2.frequency.setValueAtTime(baseFreq * 1.5, window.audioContext.currentTime);
    oscillator2.frequency.exponentialRampToValueAtTime(baseFreq * 2, window.audioContext.currentTime + 0.1);

    // Set volume
    gainNode.gain.setValueAtTime(0.2, window.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, window.audioContext.currentTime + 0.3);

    // Connect oscillators to gain node
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(window.audioContext.destination);

    // Play sound
    oscillator1.start();
    oscillator2.start();
    oscillator1.stop(window.audioContext.currentTime + 0.3);
    oscillator2.stop(window.audioContext.currentTime + 0.3);
}

// Export inventory for use in other modules
export function getTreasureInventory() {
    return treasureInventory;
}

// Make treasure inventory available globally for UI
window.getTreasureInventory = getTreasureInventory; 