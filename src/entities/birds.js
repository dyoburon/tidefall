import * as THREE from 'three';
import { scene, getTime } from '../core/gameState.js';

// Bird configuration
const BIRD_COUNT = 30;
const BIRD_SPEED = 0.5;
const BIRD_FLIGHT_HEIGHT_MIN = 50;
const BIRD_FLIGHT_HEIGHT_MAX = 150;
const BIRD_FLOCK_RADIUS = 100;
const BIRD_SEPARATION_DISTANCE = 15;
const BIRD_ALIGNMENT_FACTOR = 0.05;
const BIRD_COHESION_FACTOR = 0.005;
const BIRD_SEPARATION_FACTOR = 0.05;
const BIRD_WANDER_FACTOR = 0.1;
const BIRD_GOAL_FACTOR = 0.03;
const BIRD_WING_FLAP_SPEED = 0.2;

// Bird poop configuration
const POOP_CONFIG = {
    CHANCE_PER_BIRD: 0.0005,  // Chance per frame per bird to poop
    SIZE: 0.3,                // Size of poop particle
    FALL_SPEED: 0.15,         // Initial fall speed
    ACCELERATION: 0.01,       // Gravity acceleration
    COLOR: 0xf5f5dc,          // Off-white color
    SPLASH_PARTICLES: 6,      // Number of splash particles
    SPLASH_HEIGHT: 1.5,       // How high splash particles go
    SPLASH_DURATION: 1        // How long splash particles exist
};


// Bird state
let birds = [];
let birdGoals = [];
let activeIslands = null;
let playerBoat = null;

// Storage for active poop particles
let poopParticles = [];
let splashParticles = [];

export function setupBirds(islands, boat) {
    try {
        activeIslands = islands;
        playerBoat = boat;

        // Create bird geometry
        const bodyGeometry = new THREE.ConeGeometry(1, 4, 4);
        bodyGeometry.rotateX(Math.PI / 2);

        // Create wing geometry
        const wingGeometry = new THREE.PlaneGeometry(6, 2);

        // Create different bird colors
        const birdColors = [
            0xFFFFFF, // White
            0x333333, // Dark gray
            0x87CEEB, // Sky blue
            0xA52A2A, // Brown
            0x000000  // Black
        ];

        // Create birds
        for (let i = 0; i < BIRD_COUNT; i++) {
            // Choose random color
            const colorIndex = Math.floor(Math.random() * birdColors.length);
            const birdColor = birdColors[colorIndex];

            // Create bird group
            const bird = new THREE.Group();

            // Create body
            const bodyMaterial = new THREE.MeshPhongMaterial({ color: birdColor });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            bird.add(body);

            // Create left wing
            const leftWingMaterial = new THREE.MeshPhongMaterial({
                color: birdColor,
                side: THREE.DoubleSide
            });
            const leftWing = new THREE.Mesh(wingGeometry, leftWingMaterial);
            leftWing.position.set(-2, 0, 0);
            leftWing.rotation.z = Math.PI / 4;
            bird.add(leftWing);

            // Create right wing
            const rightWing = new THREE.Mesh(wingGeometry, leftWingMaterial);
            rightWing.position.set(2, 0, 0);
            rightWing.rotation.z = -Math.PI / 4;
            bird.add(rightWing);

            // Position bird randomly in the sky
            const randomAngle = Math.random() * Math.PI * 2;
            const randomRadius = 500 + Math.random() * 1000;
            const randomHeight = BIRD_FLIGHT_HEIGHT_MIN +
                Math.random() * (BIRD_FLIGHT_HEIGHT_MAX - BIRD_FLIGHT_HEIGHT_MIN);

            bird.position.set(
                Math.cos(randomAngle) * randomRadius,
                randomHeight,
                Math.sin(randomAngle) * randomRadius
            );

            // Set random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * BIRD_SPEED,
                (Math.random() - 0.5) * BIRD_SPEED * 0.2,
                (Math.random() - 0.5) * BIRD_SPEED
            );

            // Add bird to scene
            scene.add(bird);

            // Store bird data
            birds.push({
                mesh: bird,
                velocity: velocity,
                leftWing: leftWing,
                rightWing: rightWing,
                wingFlapDirection: 1,
                wingFlapPhase: Math.random() * Math.PI * 2, // Random starting phase
                goalIndex: null,
                goalTimer: 0,
                state: 'wander' // Initial state: wander, flock, approach_island, approach_boat
            });
        }

        // Initialize bird goals
        updateBirdGoals();

        return birds;
    } catch (error) {
        console.error("Error in setupBirds:", error);
        return [];
    }
}

function updateBirdGoals() {
    try {
        birdGoals = [];

        // Add all islands as potential goals
        if (activeIslands && typeof activeIslands.forEach === 'function') {
            activeIslands.forEach((island, id) => {
                if (island && island.collider && island.collider.center) {
                    birdGoals.push({
                        type: 'island',
                        position: island.collider.center.clone(),
                        radius: island.collider.radius || 20,
                        id: id
                    });
                }
            });
        }

        // Add boat as a goal
        if (playerBoat && playerBoat.position) {
            birdGoals.push({
                type: 'boat',
                position: playerBoat.position.clone(),
                radius: 20,
                id: 'player_boat'
            });
        }
    } catch (error) {
        console.error("Error in updateBirdGoals:", error);
        birdGoals = [];
    }
}

export function updateBirds(deltaTime) {
    try {
        // Ensure deltaTime is valid
        if (!deltaTime || isNaN(deltaTime)) {
            deltaTime = 0.016; // Default to ~60fps
        }

        // Update goals if islands or boat has moved
        updateBirdGoals();

        // Update each bird
        birds.forEach((bird, index) => {
            // Update bird state
            updateBirdState(bird, index);

            // Calculate steering forces based on current state
            const steeringForce = calculateSteeringForce(bird, index);

            // Apply steering force to velocity
            bird.velocity.add(steeringForce);

            // Limit velocity to max speed
            if (bird.velocity.length() > BIRD_SPEED) {
                bird.velocity.normalize().multiplyScalar(BIRD_SPEED);
            }

            // Apply velocity to position
            bird.mesh.position.add(bird.velocity);

            // Make bird face direction of travel
            if (bird.velocity.length() > 0.01) {
                const lookTarget = bird.mesh.position.clone().add(bird.velocity);
                bird.mesh.lookAt(lookTarget);
            }

            // Flap wings
            updateWingFlap(bird, deltaTime);

            // Ensure birds stay within world bounds
            keepBirdInWorld(bird);

            // Random chance for bird to poop
            if (Math.random() < POOP_CONFIG.CHANCE_PER_BIRD) {
                createBirdPoop(bird.mesh.position.clone());
            }
        });

        // Update any active poop particles
        updatePoopParticles(deltaTime);

        // Update splash particles
        updateSplashParticles(deltaTime);
    } catch (error) {
        console.error("Error in updateBirds:", error);
    }
}

function updateBirdState(bird, index) {
    // Decrement goal timer
    if (bird.goalTimer > 0) {
        bird.goalTimer -= 0.016; // Assume 60fps
    }

    // Possibly change state
    if (bird.goalTimer <= 0) {
        // Choose a new state
        const rand = Math.random();

        if (rand < 0.4) {
            // Wander freely
            bird.state = 'wander';
            bird.goalTimer = 10 + Math.random() * 20; // 10-30 seconds
            bird.goalIndex = null;
        } else if (rand < 0.7) {
            // Flock with other birds
            bird.state = 'flock';
            bird.goalTimer = 15 + Math.random() * 15; // 15-30 seconds
            bird.goalIndex = null;
        } else if (birdGoals.length > 0) {
            // Approach a goal (island or boat)
            const goalIndex = Math.floor(Math.random() * birdGoals.length);
            const goal = birdGoals[goalIndex];

            if (goal.type === 'island') {
                bird.state = 'approach_island';
                bird.goalTimer = 20 + Math.random() * 40; // 20-60 seconds
            } else {
                bird.state = 'approach_boat';
                bird.goalTimer = 1 + Math.random() * 4; // 1-5 seconds for boat
            }

            bird.goalIndex = goalIndex;
        }
    }
}

function calculateSteeringForce(bird, index) {
    const steeringForce = new THREE.Vector3();

    // Add different forces based on bird state
    switch (bird.state) {
        case 'wander':
            // Random wandering force
            steeringForce.add(calculateWanderForce(bird));
            // Small amount of flocking behavior
            steeringForce.add(calculateSeparationForce(bird, index).multiplyScalar(0.5));
            break;

        case 'flock':
            // Full flocking behavior
            steeringForce.add(calculateSeparationForce(bird, index));
            steeringForce.add(calculateAlignmentForce(bird, index));
            steeringForce.add(calculateCohesionForce(bird, index));
            break;

        case 'approach_island':
        case 'approach_boat':
            if (bird.goalIndex !== null && bird.goalIndex < birdGoals.length) {
                // Move toward goal
                const goal = birdGoals[bird.goalIndex];
                steeringForce.add(calculateGoalForce(bird, goal));

                // Maintain some separation from other birds
                steeringForce.add(calculateSeparationForce(bird, index).multiplyScalar(0.7));
            }
            break;
    }

    // Add slight upward force to maintain altitude
    const heightForce = new THREE.Vector3(0, 0, 0);
    const targetHeight = BIRD_FLIGHT_HEIGHT_MIN +
        Math.random() * (BIRD_FLIGHT_HEIGHT_MAX - BIRD_FLIGHT_HEIGHT_MIN);

    if (bird.mesh.position.y < targetHeight) {
        heightForce.y = 0.01;
    } else if (bird.mesh.position.y > targetHeight + 50) {
        heightForce.y = -0.01;
    }

    steeringForce.add(heightForce);

    return steeringForce;
}

function calculateWanderForce(bird) {
    // Create a random wander force
    return new THREE.Vector3(
        (Math.random() - 0.5) * BIRD_WANDER_FACTOR,
        (Math.random() - 0.5) * BIRD_WANDER_FACTOR * 0.2,
        (Math.random() - 0.5) * BIRD_WANDER_FACTOR
    );
}

function calculateSeparationForce(bird, index) {
    const separationForce = new THREE.Vector3();
    let neighborCount = 0;

    // Check all other birds
    birds.forEach((otherBird, otherIndex) => {
        if (index !== otherIndex) {
            const distance = bird.mesh.position.distanceTo(otherBird.mesh.position);

            if (distance < BIRD_SEPARATION_DISTANCE) {
                // Calculate vector away from other bird
                const awayVector = new THREE.Vector3()
                    .subVectors(bird.mesh.position, otherBird.mesh.position)
                    .normalize()
                    .divideScalar(Math.max(0.1, distance));

                separationForce.add(awayVector);
                neighborCount++;
            }
        }
    });

    // Average the separation force
    if (neighborCount > 0) {
        separationForce.divideScalar(neighborCount);
        separationForce.multiplyScalar(BIRD_SEPARATION_FACTOR);
    }

    return separationForce;
}

function calculateAlignmentForce(bird, index) {
    const alignmentForce = new THREE.Vector3();
    let neighborCount = 0;

    // Check all other birds within flock radius
    birds.forEach((otherBird, otherIndex) => {
        if (index !== otherIndex) {
            const distance = bird.mesh.position.distanceTo(otherBird.mesh.position);

            if (distance < BIRD_FLOCK_RADIUS) {
                // Add other bird's velocity
                alignmentForce.add(otherBird.velocity);
                neighborCount++;
            }
        }
    });

    // Average the alignment force
    if (neighborCount > 0) {
        alignmentForce.divideScalar(neighborCount);
        alignmentForce.multiplyScalar(BIRD_ALIGNMENT_FACTOR);
    }

    return alignmentForce;
}

function calculateCohesionForce(bird, index) {
    const centerOfMass = new THREE.Vector3();
    let neighborCount = 0;

    // Check all other birds within flock radius
    birds.forEach((otherBird, otherIndex) => {
        if (index !== otherIndex) {
            const distance = bird.mesh.position.distanceTo(otherBird.mesh.position);

            if (distance < BIRD_FLOCK_RADIUS) {
                // Add other bird's position
                centerOfMass.add(otherBird.mesh.position);
                neighborCount++;
            }
        }
    });

    // Calculate cohesion force toward center of mass
    if (neighborCount > 0) {
        centerOfMass.divideScalar(neighborCount);

        // Vector toward center of mass
        const cohesionForce = new THREE.Vector3()
            .subVectors(centerOfMass, bird.mesh.position)
            .multiplyScalar(BIRD_COHESION_FACTOR);

        return cohesionForce;
    }

    return new THREE.Vector3();
}

function calculateGoalForce(bird, goal) {
    // Vector toward goal
    const goalForce = new THREE.Vector3()
        .subVectors(goal.position, bird.mesh.position)
        .normalize()
        .multiplyScalar(BIRD_GOAL_FACTOR);

    // If close to goal, circle around it
    const distanceToGoal = bird.mesh.position.distanceTo(goal.position);
    if (distanceToGoal < goal.radius * 2) {
        // Add perpendicular force to create circling behavior
        const circleForce = new THREE.Vector3(
            -goalForce.z,
            0,
            goalForce.x
        ).multiplyScalar(0.02);

        goalForce.add(circleForce);

        // Reduce goal force to slow down near the goal
        goalForce.multiplyScalar(distanceToGoal / (goal.radius * 2));
    }

    return goalForce;
}

function updateWingFlap(bird, deltaTime) {
    // Update wing flap phase
    bird.wingFlapPhase += BIRD_WING_FLAP_SPEED * deltaTime * 60; // Adjust for frame rate

    // Calculate wing angle based on sine wave
    const wingAngle = Math.sin(bird.wingFlapPhase) * Math.PI / 4;

    // Apply wing angles
    bird.leftWing.rotation.z = Math.PI / 4 + wingAngle;
    bird.rightWing.rotation.z = -Math.PI / 4 - wingAngle;
}

function keepBirdInWorld(bird) {
    // Get distance from center
    const distanceFromCenter = new THREE.Vector2(
        bird.mesh.position.x,
        bird.mesh.position.z
    ).length();

    // If bird is too far from center, add force toward center
    if (distanceFromCenter > 5000) {
        const towardCenter = new THREE.Vector3(
            -bird.mesh.position.x,
            0,
            -bird.mesh.position.z
        ).normalize().multiplyScalar(0.05);

        bird.velocity.add(towardCenter);
    }
}

/**
 * Create a poop particle at the given position
 */
export function createBirdPoop(position) {
    // Create geometry and material
    const geometry = new THREE.SphereGeometry(POOP_CONFIG.SIZE, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: POOP_CONFIG.COLOR });

    // Create mesh
    const poop = new THREE.Mesh(geometry, material);

    // Set initial position (slightly below bird)
    position.y -= 1;
    poop.position.copy(position);

    // Add to scene
    scene.add(poop);

    // Store with velocity data
    poopParticles.push({
        mesh: poop,
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.05,  // Slight sideways movement
            -POOP_CONFIG.FALL_SPEED,       // Initial downward velocity
            (Math.random() - 0.5) * 0.05   // Slight sideways movement
        ),
        hasHitWater: false
    });
}

/**
 * Update all poop particles
 */
function updatePoopParticles(deltaTime) {
    for (let i = poopParticles.length - 1; i >= 0; i--) {
        const poop = poopParticles[i];

        // Apply gravity
        poop.velocity.y -= POOP_CONFIG.ACCELERATION * deltaTime;

        // Update position
        poop.mesh.position.x += poop.velocity.x;
        poop.mesh.position.y += poop.velocity.y;
        poop.mesh.position.z += poop.velocity.z;

        // Check if hit water (y = 0)
        if (!poop.hasHitWater && poop.mesh.position.y <= 0) {
            poop.hasHitWater = true;
            poop.mesh.position.y = 0; // Set to water level

            // Create splash effect
            createSplashEffect(poop.mesh.position.clone());

            // Remove poop mesh after hitting water
            scene.remove(poop.mesh);
            poop.mesh.geometry.dispose();
            poop.mesh.material.dispose();
            poopParticles.splice(i, 1);
        }

        // Remove if gone too far below water (failsafe)
        if (poop.mesh.position.y < -10) {
            scene.remove(poop.mesh);
            poop.mesh.geometry.dispose();
            poop.mesh.material.dispose();
            poopParticles.splice(i, 1);
        }
    }
}

/**
 * Create splash effect when poop hits water
 */
function createSplashEffect(position) {
    // Create several small particles for the splash
    for (let i = 0; i < POOP_CONFIG.SPLASH_PARTICLES; i++) {
        // Create small white particle
        const geometry = new THREE.SphereGeometry(0.1 + Math.random() * 0.1, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });

        const splash = new THREE.Mesh(geometry, material);

        // Position at impact point
        splash.position.copy(position);

        // Add random upward and outward velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.03 + Math.random() * 0.05;
        const upSpeed = 0.05 + Math.random() * 0.1;

        const velocity = new THREE.Vector3(
            Math.cos(angle) * speed,
            upSpeed,
            Math.sin(angle) * speed
        );

        // Add to scene
        scene.add(splash);

        // Store with metadata
        splashParticles.push({
            mesh: splash,
            velocity: velocity,
            lifetime: POOP_CONFIG.SPLASH_DURATION,
            age: 0
        });
    }

    // Optional: Add a sound effect here if you have audio implemented
    // playSound('splash', position, 0.3); // Example function
}

/**
 * Update splash particles
 */
function updateSplashParticles(deltaTime) {
    for (let i = splashParticles.length - 1; i >= 0; i--) {
        const splash = splashParticles[i];

        // Update age
        splash.age += deltaTime;

        // Apply gravity to velocity
        splash.velocity.y -= 0.003;

        // Update position
        splash.mesh.position.add(splash.velocity);

        // Fade out over lifetime
        const lifeRatio = splash.age / splash.lifetime;
        if (lifeRatio <= 1) {
            splash.mesh.material.opacity = 0.8 * (1 - lifeRatio);
        }

        // Check if hit water again
        if (splash.mesh.position.y <= 0) {
            splash.mesh.position.y = 0;
            splash.velocity.y *= -0.5; // Bounce effect (reduced energy)
            splash.velocity.x *= 0.9;  // Slow down x movement
            splash.velocity.z *= 0.9;  // Slow down z movement
        }

        // Remove if lifetime exceeded
        if (splash.age >= splash.lifetime) {
            scene.remove(splash.mesh);
            splash.mesh.geometry.dispose();
            splash.mesh.material.dispose();
            splashParticles.splice(i, 1);
        }
    }
} 