import * as THREE from 'three';
import { boat, getTime, scene } from '../../core/gameState.js';
import { applyOutline } from '../../theme/outlineStyles.js';

// Yellow Beast type identifier - export so seaMonsters.js can use it
export const YELLOW_BEAST_TYPE = 'yellowBeast';

// Yellow Beast specific properties
export const YELLOW_BEAST_HEALTH = 3;

// Beast behavior constants
const ATTACK_SWIPE_SPEED = 0.6;      // Fast attack speed
const RETREAT_SPEED = 0.4;           // Speed when retreating
const CIRCLING_SPEED = 0.2;          // Speed when circling
const SWIPE_DURATION = 1.5;          // How long a swipe attack lasts
const RETREAT_DURATION = 2.0;        // How long to retreat after attack
const PREPARE_DURATION = 3.0;        // How long to prepare before next attack
const MIN_ATTACK_DISTANCE = 60;      // Minimum distance to begin attack
const MAX_ATTACK_DISTANCE = 180;     // Maximum distance to attempt attack

/**
 * Creates a Yellow Beast monster and returns the complete mesh
 * @returns {THREE.Group} The monster mesh
 */
export function createYellowBeastMonster() {
    // Create monster group
    const monster = new THREE.Group();

    // Create body with bright yellow color
    const bodyGeometry = new THREE.ConeGeometry(5, 20, 8);
    bodyGeometry.rotateX(-Math.PI / 2); // Point forward

    const bodyMaterial = new THREE.MeshPhongMaterial({
        color: 0xffff00, // Bright yellow
        specular: 0xffffaa,
        shininess: 50
    });

    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    monster.add(body);

    // Create eyes - red for contrast with yellow body
    const eyeGeometry = new THREE.SphereGeometry(1, 8, 8);
    const eyeMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        emissive: 0xaa0000
    });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-2, 2, -8);
    monster.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(2, 2, -8);
    monster.add(rightEye);

    // Create tentacles - also yellow
    const tentacleGeometry = new THREE.CylinderGeometry(1, 0.2, 15, 8);
    const tentacleMaterial = new THREE.MeshPhongMaterial({
        color: 0xffff00, // Bright yellow
        specular: 0xffffaa,
        shininess: 30
    });

    const tentaclePositions = [
        [-3, -2, 5],
        [3, -2, 5],
        [-5, -2, 0],
        [5, -2, 0],
        [-3, -2, -5],
        [3, -2, -5]
    ];

    const tentacles = [];

    tentaclePositions.forEach((pos, index) => {
        const tentacle = new THREE.Mesh(tentacleGeometry, tentacleMaterial);
        tentacle.position.set(pos[0], pos[1], pos[2]);

        // Rotate tentacles to hang down
        tentacle.rotation.x = Math.PI / 2;

        // Add some random rotation
        tentacle.rotation.z = Math.random() * Math.PI * 2;

        monster.add(tentacle);
        tentacles.push(tentacle);
    });

    // Add prominent dorsal fin that sticks out of water
    const finGeometry = new THREE.BoxGeometry(12, 1, 8);
    finGeometry.translate(0, 5, 0); // Move up so it sticks out of water

    const finMaterial = new THREE.MeshPhongMaterial({
        color: 0xffff00, // Bright yellow
        specular: 0xffffaa,
        shininess: 50
    });

    const dorsalFin = new THREE.Mesh(finGeometry, finMaterial);
    dorsalFin.position.set(0, 8, 0); // Position high on the monster
    dorsalFin.rotation.y = Math.PI / 2; // Orient correctly
    monster.add(dorsalFin);

    // Add side fins that also stick out
    const leftFin = new THREE.Mesh(finGeometry, finMaterial);
    leftFin.position.set(-6, 2, 0);
    leftFin.rotation.z = Math.PI / 4; // Angle outward
    leftFin.scale.set(0.7, 0.7, 0.7); // Slightly smaller
    monster.add(leftFin);

    const rightFin = new THREE.Mesh(finGeometry, finMaterial);
    rightFin.position.set(6, 2, 0);
    rightFin.rotation.z = -Math.PI / 4; // Angle outward
    rightFin.scale.set(0.7, 0.7, 0.7); // Slightly smaller
    monster.add(rightFin);

    return {
        mesh: monster,
        tentacles: tentacles,
        dorsalFin: dorsalFin,
        leftFin: leftFin,
        rightFin: rightFin
    };
}

/**
 * Animate tentacles with sine wave motion
 * @param {Object} monster The monster object
 * @param {number} deltaTime Time elapsed since last frame
 * @param {number} time Current time value
 */
export function animateTentacles(monster, deltaTime, time) {
    // Animate tentacles with sine wave motion
    monster.tentacles.forEach((tentacle, index) => {
        // Different phase for each tentacle
        const phase = index * Math.PI / 3;

        // Faster tentacle movement when attacking
        const speed = monster.state === 'attacking' ? 5 : 2;

        // Calculate rotation based on sine wave
        const rotationAmount = Math.sin(time * speed + phase) * 0.2;

        // Apply rotation
        tentacle.rotation.z = Math.PI / 2 + rotationAmount;

        // Additional x-rotation for more dynamic movement
        tentacle.rotation.x = Math.PI / 2 + Math.sin(time * speed * 0.7 + phase) * 0.15;
    });

    // Update eye glow if hunting or attacking
    if (monster.state === 'hunting' || monster.state === 'attacking') {
        // Pulse the emissive intensity
        const eyeIntensity = 0.4 + Math.sin(time * 5) * 0.2;
        monster.mesh.children[1].material.emissive.setScalar(eyeIntensity); // Left eye
        monster.mesh.children[2].material.emissive.setScalar(eyeIntensity); // Right eye
    }
}

/**
 * Apply outline style to Yellow Beast monster
 * @param {Object} monster The monster object
 */
export function applyYellowBeastStyle(monster) {
    const styleOptions = {
        material: new THREE.MeshBasicMaterial({
            color: 0x000000,  // Black outline
            side: THREE.BackSide
        }),
        recursive: true,
        scale: 1.05  // Slightly thinner outline
    };

    // Apply the outline
    applyOutline(monster.mesh, styleOptions);
}

/**
 * Enhanced attack behavior for Yellow Beast monsters
 * Implements coordinated attacks, quick swipes, and tactical retreats
 * Uses GameState to access player boat directly
 * 
 * @param {Object} monster The monster object to update
 * @param {Array} allMonsters Array of all monsters for coordination
 * @param {number} deltaTime Time elapsed since last frame
 * @returns {boolean} True if custom behavior was applied, false to use default behavior
 */
export function updateYellowBeastBehavior(monster, allMonsters, deltaTime) {
    return;
    // Only handle when on surface (attacking)
    if (monster.state !== 'attacking') {
        return false; // Use default behavior for other states
    }

    // Get the player position directly from gameState
    const playerPosition = boat.position;

    // Initialize attack state if not present
    if (!monster.attackPattern) {
        monster.attackPattern = {
            phase: 'circling',       // circling, preparing, swiping, retreating
            phaseTimer: 0,           // Time left in current phase
            targetPosition: new THREE.Vector3(), // Current target position
            approachAngle: Math.random() * Math.PI * 2, // Angle to approach from
            formationIndex: 0,       // Position in formation (set when coordinating)
            lastAttackTime: 0,       // Time of last attack
            attackCooldown: 5 + Math.random() * 3, // Random cooldown between attacks
        };

        // Initial circling setup
        monster.attackPattern.phaseTimer = 4 + Math.random() * 3;
    }

    // Get distance to player
    const distanceToPlayer = monster.mesh.position.distanceTo(playerPosition);

    // Handle behavior based on current attack phase
    switch (monster.attackPattern.phase) {
        case 'circling':
            handleCirclingBehavior(monster, deltaTime);
            break;

        case 'preparing':
            handlePreparingBehavior(monster, deltaTime);
            break;

        case 'swiping':
            handleSwipingBehavior(monster, deltaTime);
            break;

        case 'retreating':
            handleRetreatingBehavior(monster, deltaTime);
            break;
    }

    // Coordinate with other Yellow Beasts
    coordinateWithOtherMonsters(monster, allMonsters);

    return true; // We handled the behavior, don't use default
}

/**
 * Handle circling behavior - monsters circle around player at a distance
 */
function handleCirclingBehavior(monster, deltaTime) {
    return;
    const attackPattern = monster.attackPattern;
    const time = getTime();

    // Update timer
    attackPattern.phaseTimer -= deltaTime;

    // Calculate orbit position around player
    const distanceToKeep = 120 + Math.sin(time * 0.5) * 20; // Vary distance slightly

    // Gradually change approach angle
    attackPattern.approachAngle += deltaTime * 0.2;

    // Calculate target position - using player boat from gameState directly
    const targetX = boat.position.x + Math.cos(attackPattern.approachAngle) * distanceToKeep;
    const targetZ = boat.position.z + Math.sin(attackPattern.approachAngle) * distanceToKeep;

    attackPattern.targetPosition.set(targetX, 0, targetZ); // At water level

    // Move toward the calculated orbit position
    const direction = new THREE.Vector3()
        .subVectors(attackPattern.targetPosition, monster.mesh.position)
        .normalize();

    // Stay at surface level
    monster.mesh.position.y = Math.sin(time * 0.5) * 0.5; // Small bobbing

    // Set velocity toward orbit position
    monster.velocity.set(
        direction.x * CIRCLING_SPEED,
        0,
        direction.z * CIRCLING_SPEED
    );

    // Show fin more aggressively during circling
    monster.dorsalFin.position.y = 8 + Math.sin(time * 2) * 0.5;

    // Check if we should transition to preparing phase
    if (attackPattern.phaseTimer <= 0) {
        // Transition to preparing for an attack
        attackPattern.phase = 'preparing';
        attackPattern.phaseTimer = PREPARE_DURATION;

        // Calculate ideal attack position (opposite side from current position)
        const vectorToPlayer = new THREE.Vector3().subVectors(boat.position, monster.mesh.position);
        const distanceToPlayer = vectorToPlayer.length();

        // If too far, move to closer position first
        if (distanceToPlayer > MAX_ATTACK_DISTANCE) {
            // Get vector of proper length
            vectorToPlayer.normalize().multiplyScalar(MAX_ATTACK_DISTANCE);
            // Set target to opposite side of player
            attackPattern.targetPosition.copy(boat.position).sub(vectorToPlayer);
        } else {
            // Choose flanking angle
            const flankAngle = Math.PI * 0.7; // ~120 degrees

            // Calculate attack position (from behind player with slight offset)
            const playerDirection = new THREE.Vector3(
                Math.sin(boat.rotation.y),
                0,
                Math.cos(boat.rotation.y)
            );

            // Get perpendicular vector
            const perpendicular = new THREE.Vector3(-playerDirection.z, 0, playerDirection.x);

            // Calculate flanking position
            attackPattern.targetPosition.copy(boat.position)
                .add(playerDirection.multiplyScalar(-MAX_ATTACK_DISTANCE * 0.7)) // Behind player
                .add(perpendicular.multiplyScalar((Math.random() > 0.5 ? 1 : -1) * MAX_ATTACK_DISTANCE * 0.5)); // Side offset
        }
    }
}

/**
 * Handle preparing behavior - monster moves to an ideal position to attack from
 */
function handlePreparingBehavior(monster, deltaTime) {
    const attackPattern = monster.attackPattern;

    // Update timer
    attackPattern.phaseTimer -= deltaTime;

    // Always face the player - using boat from gameState
    const directionToPlayer = new THREE.Vector3()
        .subVectors(boat.position, monster.mesh.position)
        .normalize();

    // Move toward the preparation position
    const directionToTarget = new THREE.Vector3()
        .subVectors(attackPattern.targetPosition, monster.mesh.position)
        .normalize();

    // Set velocity toward preparation position, but faster than circling
    monster.velocity.set(
        directionToTarget.x * CIRCLING_SPEED * 1.5,
        0,
        directionToTarget.z * CIRCLING_SPEED * 1.5
    );

    // Check if it's time to attack
    if (attackPattern.phaseTimer <= 0) {
        // Time to attack!
        attackPattern.phase = 'swiping';
        attackPattern.phaseTimer = SWIPE_DURATION;
        attackPattern.lastAttackTime = getTime() / 1000;

        // Target is directly at the player for the swipe - using boat from gameState
        attackPattern.targetPosition.copy(boat.position);

        // Create a wake effect before the attack
        createPreAttackEffect(monster.mesh.position);
    }
}

/**
 * Handle swiping behavior - fast attack directly at the player
 */
function handleSwipingBehavior(monster, deltaTime) {
    return;
    const attackPattern = monster.attackPattern;
    const time = getTime();

    // Update timer
    attackPattern.phaseTimer -= deltaTime;

    // Always update target to player's current position for a better hit - using boat from gameState
    attackPattern.targetPosition.copy(boat.position);

    // Calculate direction to the player
    const directionToPlayer = new THREE.Vector3()
        .subVectors(boat.position, monster.mesh.position)
        .normalize();

    // Move very fast toward the player
    monster.velocity.set(
        directionToPlayer.x * ATTACK_SWIPE_SPEED,
        0,
        directionToPlayer.z * ATTACK_SWIPE_SPEED
    );

    // Make dorsalFin more aggressive during attack
    monster.dorsalFin.position.y = 9 + Math.sin(time * 8) * 1;

    // Check if we've completed the swipe
    if (attackPattern.phaseTimer <= 0) {
        // Transition to retreating
        attackPattern.phase = 'retreating';
        attackPattern.phaseTimer = RETREAT_DURATION;

        // Calculate retreat position (away from player)
        const retreatDistance = 120 + Math.random() * 40;
        const retreatDirection = new THREE.Vector3(
            -directionToPlayer.x,
            0,
            -directionToPlayer.z
        ).normalize();

        // Set retreat target
        attackPattern.targetPosition.copy(monster.mesh.position)
            .add(retreatDirection.multiplyScalar(retreatDistance));
    }
}

/**
 * Handle retreating behavior - quickly moving away from the player
 */
function handleRetreatingBehavior(monster, deltaTime) {
    const attackPattern = monster.attackPattern;

    // Update timer
    attackPattern.phaseTimer -= deltaTime;

    // Calculate direction to the retreat position
    const directionToTarget = new THREE.Vector3()
        .subVectors(attackPattern.targetPosition, monster.mesh.position)
        .normalize();

    // Move quickly away
    monster.velocity.set(
        directionToTarget.x * RETREAT_SPEED,
        0,
        directionToTarget.z * RETREAT_SPEED
    );

    // Check if we've completed the retreat
    if (attackPattern.phaseTimer <= 0) {
        // Transition back to circling
        attackPattern.phase = 'circling';
        attackPattern.phaseTimer = 4 + Math.random() * 3;

        // Calculate new circling angle (to be modified by coordination)
        attackPattern.approachAngle = Math.random() * Math.PI * 2;
    }
}

/**
 * Coordinate with other monsters for better strategic attacks
 */
function coordinateWithOtherMonsters(monster, allMonsters) {
    // Count how many yellow beasts are attacking
    const attackingYellowBeasts = allMonsters.filter(m =>
        m.monsterType === YELLOW_BEAST_TYPE &&
        m.state === 'attacking'
    );

    // If we have multiple attacking beasts, coordinate them
    if (attackingYellowBeasts.length > 1) {
        // Determine this monster's index if not already assigned
        if (monster.attackPattern.formationIndex === 0) {
            monster.attackPattern.formationIndex = attackingYellowBeasts.indexOf(monster) + 1;
        }

        // Distribute beasts around the player evenly
        const beastCount = attackingYellowBeasts.length;
        const idealAngleSpacing = (Math.PI * 2) / beastCount;

        // Calculate base angle (first beast gets this angle)
        const baseAngle = getTime() * 0.1; // Slowly rotating base angle

        // Adjust approach angle based on formation position
        const targetAngle = baseAngle + (monster.attackPattern.formationIndex - 1) * idealAngleSpacing;

        // Gradually adjust to formation position
        monster.attackPattern.approachAngle +=
            (targetAngle - monster.attackPattern.approachAngle) * 0.01;
    }
}

/**
 * Create a dramatic effect before an attack
 */
function createPreAttackEffect(position) {
    return;
    // Create a water disturbance effect
    const rippleCount = 12;
    const rippleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6
    });

    for (let i = 0; i < rippleCount; i++) {
        const startRadius = 3;
        const ringGeometry = new THREE.RingGeometry(
            startRadius, startRadius + 0.5, 16
        );

        const ring = new THREE.Mesh(ringGeometry, rippleMaterial);
        ring.position.copy(position);
        ring.position.y = 0.1; // Slightly above water
        ring.rotation.x = -Math.PI / 2; // Lay flat on water

        scene.add(ring);

        // Animate the ripple
        const startTime = getTime();
        const expandSpeed = 10 + Math.random() * 5;

        function animateRipple() {
            const elapsedTime = (getTime() - startTime) / 1000;

            if (elapsedTime > 0.8) {
                scene.remove(ring);
                return;
            }

            // Expand ring
            const scale = 1 + elapsedTime * expandSpeed;
            ring.scale.set(scale, scale, 1);

            // Fade out
            ring.material.opacity = 0.6 * (1 - elapsedTime / 0.8);

            requestAnimationFrame(animateRipple);
        }

        // Stagger ripple starts
        setTimeout(() => {
            animateRipple();
        }, i * 60); // Staggered start times
    }
} 