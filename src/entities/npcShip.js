import * as THREE from 'three';
import { scene, addToScene, removeFromScene, getTime, boat } from '../core/gameState.js';
import { loadShipModel } from './boatLoader.js';
import npcCannonSystem from '../npc/abilities/npcCannon.js';
import { debugLog } from '../utils/debug.js';

// Configuration for NPC ships
const NPC_SHIP_CONFIG = {
    // Movement settings
    moveSpeed: 10.0,        // 10x faster movement speed
    turnSpeed: 0.03,        // Slightly increased turning speed for better navigation
    waypointRadius: 20,     // How close the NPC needs to get to a waypoint

    // Behavior settings
    idleTime: 1.5,          // Reduced idle time at waypoints (more dynamic)
    patrolRadius: 500,      // Increased patrol radius

    // Model settings
    defaultShipType: 'mediumpirate',  // Default ship type to use

    // Physics and effects
    boatRockSpeed: 1.0,     // Speed of boat rocking
    maxRockAngle: 0.06,     // Maximum rock angle in radians
    waterHeight: 0,         // Water height at rest (sea level)

    // Movement pattern settings
    maxCurveDeviation: 150, // Maximum curve deviation from straight line
    pathComplexity: 0.7,    // How complex the paths should be (0-1)
    waypointMode: 'curved', // 'direct' or 'curved' or 'zigzag'

    // Debug settings
    debugVisuals: true,     // Whether to show debug visuals
    debugLevel: 1,          // 0=none, 1=minimal, 2=verbose
};

// Track all active NPC ships
const activeNpcShips = [];

// Debug helpers for visualizing waypoints and states
const debugHelpers = {
    waypointMaterial: new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true }),
    pathMaterial: new THREE.LineBasicMaterial({ color: 0xffff00 }),
    movingMaterial: new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
    idleMaterial: new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
    combatMaterial: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    waypointMarkers: []
};

/**
 * NPC Ship class to represent a computer-controlled ship
 */
class NpcShip {
    constructor(position, options = {}) {
        // Core properties
        this.id = 'npc_' + Math.floor(Math.random() * 10000);
        this.position = position.clone();
        this.rotation = new THREE.Euler();
        this.velocity = new THREE.Vector3();

        // Path planning properties
        this.intermediateWaypoints = [];
        this.lastWaypointDirection = Math.random() < 0.5 ? 'left' : 'right';

        // Apply custom options or defaults
        this.shipType = options.shipType || NPC_SHIP_CONFIG.defaultShipType;
        this.moveSpeed = options.moveSpeed || NPC_SHIP_CONFIG.moveSpeed;
        this.turnSpeed = options.turnSpeed || NPC_SHIP_CONFIG.turnSpeed;
        this.waypointRadius = options.waypointRadius || NPC_SHIP_CONFIG.waypointRadius;
        this.idleTime = options.idleTime || NPC_SHIP_CONFIG.idleTime;
        this.patrolRadius = options.patrolRadius || NPC_SHIP_CONFIG.patrolRadius;

        // Combat properties
        this.combatEnabled = options.combatEnabled !== undefined ? options.combatEnabled : false;
        this.attackRange = options.attackRange || 80;
        this.aggroRange = options.aggroRange || 150;
        this.combatState = 'passive'; // 'passive' or 'aggressive'
        this.lastCannonFired = 0;

        // Behavior state
        this.state = 'moving';  // 'moving' or 'idling'
        this.idleTimer = 0;
        this.spawnPosition = position.clone();
        this.currentWaypoint = this.generateWaypoint();

        // Add physics and animation properties
        this.lastUpdateTime = getTime();
        this.rockAngleX = 0;
        this.rockAngleZ = 0;
        this.waterHeight = 0;

        // Create ship group and model
        this.shipGroup = new THREE.Group();
        this.shipGroup.position.copy(this.position);
        addToScene(this.shipGroup);

        // Load the ship model
        this.loadModel();

        // Debug visuals
        this.debugWaypointMarker = null;
        this.debugPathLine = null;
        this.debugStateIndicator = null;
        this.debugCombatIndicator = null;
        if (NPC_SHIP_CONFIG.debugVisuals) {
            this.createDebugVisuals();
        }

        if (options.debugLevel !== undefined) {
            this.debugLevel = options.debugLevel;
        } else {
            this.debugLevel = NPC_SHIP_CONFIG.debugLevel;
        }

        debugLog(`Created NPC Ship ${this.id} of type ${this.shipType} at position (${position.x.toFixed(0)}, ${position.z.toFixed(0)})`, 1);
        debugLog(`Ship settings: speed=${this.moveSpeed.toFixed(1)}, turnSpeed=${this.turnSpeed.toFixed(3)}, patrolRadius=${this.patrolRadius}`, 2);
    }

    /**
     * Load the ship model using boatLoader
     */
    loadModel() {
        loadShipModel(this.shipGroup, {
            shipType: this.shipType,
            customModelId: this.id,
            isOtherPlayer: true  // Use NPC orientation
        }, (success) => {
            if (success) {
                console.log(`NPC Ship ${this.id} model loaded successfully`);
            } else {
                console.error(`Failed to load NPC Ship ${this.id} model`);
            }
        });
    }

    /**
     * Generate a random waypoint within patrol radius
     * @returns {THREE.Vector3} New waypoint position
     */
    generateWaypoint() {
        // Base waypoint position using angle and distance
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.patrolRadius;

        let waypoint;

        // Choose a movement pattern (curved, zigzag, or direct)
        const patterns = ['curved', 'zigzag', 'direct'];
        const selectedPattern = Math.random() < 0.7 ?
            NPC_SHIP_CONFIG.waypointMode : patterns[Math.floor(Math.random() * patterns.length)];

        if (selectedPattern === 'curved') {
            // Create curved path with offset from straight line
            const curveOffset = NPC_SHIP_CONFIG.maxCurveDeviation * (Math.random() - 0.5);
            const perpAngle = angle + Math.PI / 2;
            waypoint = new THREE.Vector3(
                this.spawnPosition.x + Math.cos(angle) * distance + Math.cos(perpAngle) * curveOffset,
                0,
                this.spawnPosition.z + Math.sin(angle) * distance + Math.sin(perpAngle) * curveOffset
            );
        }
        else if (selectedPattern === 'zigzag') {
            // Create zigzag path alternating directions
            const zigzagDirection = this.lastWaypointDirection === 'left' ? 'right' : 'left';
            this.lastWaypointDirection = zigzagDirection;

            const zigzagOffset = NPC_SHIP_CONFIG.maxCurveDeviation * (zigzagDirection === 'left' ? -0.8 : 0.8);
            const zigzagPerpAngle = angle + Math.PI / 2;
            waypoint = new THREE.Vector3(
                this.spawnPosition.x + Math.cos(angle) * distance + Math.cos(zigzagPerpAngle) * zigzagOffset,
                0,
                this.spawnPosition.z + Math.sin(angle) * distance + Math.sin(zigzagPerpAngle) * zigzagOffset
            );
        }
        else {
            // Direct path to random point
            waypoint = new THREE.Vector3(
                this.spawnPosition.x + Math.cos(angle) * distance,
                0,
                this.spawnPosition.z + Math.sin(angle) * distance
            );
        }

        // Generate intermediate waypoints for more complex paths
        if (Math.random() < NPC_SHIP_CONFIG.pathComplexity && (!this.intermediateWaypoints || this.intermediateWaypoints.length === 0)) {
            // Create a sequence of points that lead to the final waypoint
            const intermediatePoints = [];
            const numPoints = 1 + Math.floor(Math.random() * 3); // 1-3 intermediate points

            // Start from current position
            const start = this.position.clone();

            for (let i = 0; i < numPoints; i++) {
                // Create point that's partially toward the destination
                const progress = (i + 1) / (numPoints + 1);
                const basePoint = new THREE.Vector3().lerpVectors(start, waypoint, progress);

                // Add random deviation
                const deviation = NPC_SHIP_CONFIG.maxCurveDeviation * 0.7 * Math.random();
                const deviationAngle = Math.random() * Math.PI * 2;

                // Add the intermediate point
                intermediatePoints.push(new THREE.Vector3(
                    basePoint.x + Math.cos(deviationAngle) * deviation,
                    0,
                    basePoint.z + Math.sin(deviationAngle) * deviation
                ));
            }

            // Add the final destination
            intermediatePoints.push(waypoint);
            this.intermediateWaypoints = intermediatePoints;

            // Return the first intermediate point
            return this.intermediateWaypoints.shift();
        }

        // Update debug visuals
        if (this.debugWaypointMarker) {
            this.updateDebugVisuals(waypoint);
        }

        return waypoint;
    }

    /**
     * Create debug visuals for the NPC ship
     */
    createDebugVisuals() {
        // Create waypoint marker (red sphere)
        const waypointGeometry = new THREE.SphereGeometry(5, 8, 8);
        this.debugWaypointMarker = new THREE.Mesh(waypointGeometry, debugHelpers.waypointMaterial);
        this.debugWaypointMarker.position.copy(this.currentWaypoint);
        addToScene(this.debugWaypointMarker);
        debugHelpers.waypointMarkers.push(this.debugWaypointMarker);

        // Create path line from ship to waypoint
        const lineGeometry = new THREE.BufferGeometry();
        const linePoints = [this.position.clone(), this.currentWaypoint.clone()];
        lineGeometry.setFromPoints(linePoints);
        this.debugPathLine = new THREE.Line(lineGeometry, debugHelpers.pathMaterial);
        addToScene(this.debugPathLine);

        // Create state indicator
        const stateGeometry = new THREE.SphereGeometry(2, 8, 8);
        this.debugStateIndicator = new THREE.Mesh(
            stateGeometry,
            this.state === 'moving' ? debugHelpers.movingMaterial : debugHelpers.idleMaterial
        );
        this.debugStateIndicator.position.copy(this.position.clone().add(new THREE.Vector3(0, 15, 0)));
        addToScene(this.debugStateIndicator);

        // Create combat state indicator
        const combatGeometry = new THREE.SphereGeometry(3, 8, 8);
        this.debugCombatIndicator = new THREE.Mesh(
            combatGeometry,
            debugHelpers.combatMaterial
        );
        this.debugCombatIndicator.position.copy(this.position.clone().add(new THREE.Vector3(0, 20, 0)));
        this.debugCombatIndicator.visible = this.combatState === 'aggressive';
        addToScene(this.debugCombatIndicator);

        console.log(`Created debug visuals for NPC ship ${this.id}`);
    }

    /**
     * Update debug visual positions
     * @param {THREE.Vector3} waypoint - New waypoint position
     */
    updateDebugVisuals(waypoint) {
        if (!NPC_SHIP_CONFIG.debugVisuals) return;

        // Update waypoint marker position
        if (this.debugWaypointMarker) {
            this.debugWaypointMarker.position.copy(waypoint);
        }

        // Update path line
        if (this.debugPathLine) {
            const linePoints = [this.position.clone(), waypoint.clone()];
            this.debugPathLine.geometry.dispose();
            this.debugPathLine.geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        }
    }

    /**
     * Update the NPC ship's position and behavior
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        // Make sure deltaTime is valid
        const dt = Math.min(deltaTime || 0.016, 0.1);  // Cap at 100ms, default to 16ms

        // Update current time
        this.lastUpdateTime = getTime();

        // Remember previous state for debug visualization
        const previousState = this.state;

        switch (this.state) {
            case 'moving':
                this.moveTowardsWaypoint(dt);
                break;

            case 'idling':
                this.idle(dt);
                break;
        }

        // Apply water-based rocking effect
        this.updateBoatRocking(dt);

        // Update the ship group position/rotation
        this.shipGroup.position.copy(this.position);

        // We now apply full rotation including rocking
        this.shipGroup.rotation.set(
            this.rockAngleX,
            this.rotation.y,
            this.rockAngleZ
        );

        // Update debug visuals
        if (NPC_SHIP_CONFIG.debugVisuals) {
            // Update path line
            if (this.debugPathLine) {
                const linePoints = [this.position.clone(), this.currentWaypoint.clone()];
                this.debugPathLine.geometry.dispose();
                this.debugPathLine.geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
            }

            // Update state indicator position and color
            if (this.debugStateIndicator) {
                this.debugStateIndicator.position.copy(this.position.clone().add(new THREE.Vector3(0, 15, 0)));

                // Change color if state changed
                if (previousState !== this.state) {
                    this.debugStateIndicator.material =
                        this.state === 'moving' ? debugHelpers.movingMaterial : debugHelpers.idleMaterial;
                }
            }
        }
    }

    /**
     * Apply water-based rocking effect to the ship
     * @param {number} deltaTime - Time since last update in seconds
     */
    updateBoatRocking(deltaTime) {
        // Get the current time
        const time = this.lastUpdateTime * 0.001; // Convert to seconds

        // Calculate speed-based rocking factor
        const speedMagnitude = this.velocity.length();
        const rockingFactor = speedMagnitude * 2.0 + 0.2; // base rocking + speed-based

        // Calculate wave-based height
        // Simple sine waves with different frequencies
        const wave1 = Math.sin(time * 0.5 + this.position.x * 0.01) * 0.3;
        const wave2 = Math.sin(time * 0.7 + this.position.z * 0.01) * 0.2;
        this.waterHeight = NPC_SHIP_CONFIG.waterHeight + wave1 + wave2;

        // Update ship height to follow water
        this.position.y = this.waterHeight;

        // Add rocking motion based on time and speed
        const rockSpeed = NPC_SHIP_CONFIG.boatRockSpeed;
        const maxRockAngle = NPC_SHIP_CONFIG.maxRockAngle;

        // Calculate target rock angles with some randomness
        const targetRockX = Math.sin(time * rockSpeed) * maxRockAngle * rockingFactor;
        const targetRockZ = Math.sin(time * rockSpeed * 0.7 + 0.5) * maxRockAngle * rockingFactor;

        // Smoothly interpolate current angles toward target angles
        const smoothFactor = Math.min(deltaTime * 2.0, 1.0);
        this.rockAngleX += (targetRockX - this.rockAngleX) * smoothFactor;
        this.rockAngleZ += (targetRockZ - this.rockAngleZ) * smoothFactor;
    }

    /**
     * Check if we've reached the waypoint
     * @param {number} distanceToWaypoint - Current distance to waypoint
     * @returns {boolean} Whether we've reached the waypoint
     */
    hasReachedWaypoint(distanceToWaypoint) {
        return distanceToWaypoint < this.waypointRadius; // Use instance waypointRadius
    }

    /**
     * Handle movement towards current waypoint
     * @param {number} deltaTime - Time since last update
     */
    moveTowardsWaypoint(deltaTime) {
        // Direction to waypoint
        const direction = new THREE.Vector3()
            .subVectors(this.currentWaypoint, this.position)
            .normalize();

        // Calculate target rotation (yaw only - around Y axis)
        // Add PI (180 degrees) to make ships face the direction they're moving
        const targetRotation = Math.atan2(direction.x, direction.z) + Math.PI;

        // Calculate how direct of a turn we need to make
        const rotationDiff = normalizeAngle(targetRotation - this.rotation.y);

        // Calculate turn amount, slowing down when making sharp turns
        const turnAmount = rotationDiff * this.turnSpeed * deltaTime * 60;
        this.rotation.y += turnAmount;

        // Adjust speed based on turn sharpness (slow down in turns)
        const turnSharpness = Math.abs(rotationDiff) / Math.PI; // 0 to 1 scale
        const speedFactor = 1.0 - (turnSharpness * 0.7); // Reduce to 30% speed in sharpest turns

        // Create forward vector based on current rotation
        // Use opposite direction (forward is actually backward for the model)
        const forwardVector = new THREE.Vector3(0, 0, -1)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);

        // Apply speed, adjusted for turning
        const adjustedSpeed = this.moveSpeed * speedFactor;
        this.velocity.copy(forwardVector).multiplyScalar(adjustedSpeed * deltaTime);
        this.position.add(this.velocity);

        // Check if we've reached the waypoint
        const distanceToWaypoint = this.position.distanceTo(this.currentWaypoint);
        if (this.hasReachedWaypoint(distanceToWaypoint)) {
            // Check if we have more intermediate waypoints
            if (this.intermediateWaypoints && this.intermediateWaypoints.length > 0) {
                // Move to next waypoint
                this.currentWaypoint = this.intermediateWaypoints.shift();
                debugLog(`NPC Ship ${this.id} moving to next intermediate waypoint`, 2);

                // Update debug visualizations
                if (this.debugWaypointMarker) {
                    this.updateDebugVisuals(this.currentWaypoint);
                }
            } else {
                // Reached final waypoint, switch to idle state
                this.state = 'idling';
                this.idleTimer = 0;
                debugLog(`NPC Ship ${this.id} reached final waypoint, now idling`, 2);
            }
        }
    }

    /**
     * Handle idle behavior at waypoint
     * @param {number} deltaTime - Time since last update
     */
    idle(deltaTime) {
        this.idleTimer += deltaTime;

        // After idle time, generate new waypoint and continue moving
        if (this.idleTimer >= this.idleTime) { // Use instance idleTime
            this.currentWaypoint = this.generateWaypoint();
            this.state = 'moving';
            debugLog(`NPC Ship ${this.id} resuming movement to new waypoint (${this.currentWaypoint.x.toFixed(0)}, ${this.currentWaypoint.z.toFixed(0)})`, 2);
        }
    }

    /**
     * Remove the ship from the scene and memory
     */
    dispose() {
        removeFromScene(this.shipGroup);

        // Clean up debug visuals
        if (this.debugWaypointMarker) {
            removeFromScene(this.debugWaypointMarker);
            const index = debugHelpers.waypointMarkers.indexOf(this.debugWaypointMarker);
            if (index !== -1) {
                debugHelpers.waypointMarkers.splice(index, 1);
            }
        }

        if (this.debugPathLine) {
            removeFromScene(this.debugPathLine);
        }

        if (this.debugStateIndicator) {
            removeFromScene(this.debugStateIndicator);
        }

        if (this.debugCombatIndicator) {
            removeFromScene(this.debugCombatIndicator);
        }

        // Remove from active NPCs list
        const index = activeNpcShips.indexOf(this);
        if (index !== -1) {
            activeNpcShips.splice(index, 1);
        }
    }

    /**
     * Update NPC combat behavior
     * @param {THREE.Vector3} playerPosition - The player's position
     * @param {number} deltaTime - Time since last update
     */
    updateCombat(playerPosition, deltaTime) {
        if (!this.combatEnabled) {
            // Skip silently
            return;
        }

        // Calculate distance to player
        const distanceToPlayer = this.position.distanceTo(playerPosition);

        // Previous combat state
        const previousState = this.combatState;

        // Log distance to player less frequently to reduce console spam
        if (Math.random() < 0.01) { // 1% chance to log
            console.log(`NPC Ship ${this.id} distance to player: ${distanceToPlayer.toFixed(0)} units (attack: ${this.attackRange}, aggro: ${this.aggroRange})`);
        }

        // If player is within cannon range, fire
        if (distanceToPlayer < this.attackRange) {
            // Set combat state
            if (this.combatState !== 'aggressive') {
                this.combatState = 'aggressive';
                console.log(`NPC Ship ${this.id} engaging player at distance ${distanceToPlayer.toFixed(0)}`);
            }

            // Check if we can fire (not on cooldown)
            const cooldownRemaining = npcCannonSystem.getRemainingCooldown(this);
            if (cooldownRemaining <= 0) {
                // Show debug info for firing
                console.log(`Attempting to fire cannons at player from NPC ${this.id}`);

                // Fire cannons at player directly using npcCannonSystem
                const fired = npcCannonSystem.fireAtTarget(this, playerPosition);

                if (fired) {
                    console.log(`NPC Ship ${this.id} successfully fired cannons at player`);
                } else {
                    console.log(`NPC Ship ${this.id} failed to fire`);
                }
            } else if (Math.random() < 0.05) { // Occasionally log cooldown status
                console.log(`NPC Ship ${this.id} on cooldown: ${cooldownRemaining.toFixed(1)}s remaining`);
            }
        }
        // If player is within aggro range but outside attack range, pursue
        else if (distanceToPlayer < this.aggroRange) {
            // In a full implementation, we would change the ship's waypoint to follow the player
            // For now, we'll just set the combat state
            if (this.combatState !== 'aggressive') {
                this.combatState = 'aggressive';
                console.log(`NPC Ship ${this.id} pursuing player at distance ${distanceToPlayer.toFixed(0)}`);
            }
        }
        // If player is outside aggro range, return to passive
        else if (this.combatState !== 'passive') {
            this.combatState = 'passive';
            console.log(`NPC Ship ${this.id} returning to passive state at distance ${distanceToPlayer.toFixed(0)}`);
        }

        // Update combat indicator if state changed
        if (this.debugCombatIndicator && previousState !== this.combatState) {
            this.debugCombatIndicator.visible = this.combatState === 'aggressive';
        }
    }
}

/**
 * Create a new NPC ship
 * @param {THREE.Vector3} position - Initial position
 * @param {Object} options - Optional configuration
 * @returns {NpcShip} The created NPC ship
 */
export function createNpcShip(position, options = {}) {
    const npcShip = new NpcShip(position, options);
    activeNpcShips.push(npcShip);
    return npcShip;
}

/**
 * Update all active NPC ships
 * @param {number} deltaTime - Time since last update in seconds
 */
export function updateNpcShips(deltaTime) {
    // Log the first update call to verify it's running
    if (activeNpcShips.length > 0 && !updateNpcShips.hasLogged) {
        console.log(`Updating ${activeNpcShips.length} NPC ships with deltaTime: ${deltaTime}`);
        updateNpcShips.hasLogged = true;
    }

    // Get player position from boat object
    const playerPosition = boat ? boat.position.clone() : null;

    // Log player position occasionally
    if (playerPosition && Math.random() < 0.01) {
        console.log(`Player position: (${playerPosition.x.toFixed(0)}, ${playerPosition.y.toFixed(0)}, ${playerPosition.z.toFixed(0)})`);
    }

    // If no player position, nothing to do for combat
    if (!playerPosition) {
        console.log("No player position available for NPC combat");
        return;
    }

    let closestShip = null;
    let closestDistance = Infinity;

    for (const npcShip of activeNpcShips) {
        // Force combat enabled for testing
        if (!npcShip.combatEnabled) {
            npcShip.combatEnabled = true;
            npcShip.attackRange = 600; // Match the cannon range
            npcShip.aggroRange = 700;  // Slightly larger than attack range
            console.log(`Forced combat enabled for NPC ship ${npcShip.id}`);
        }

        // Update movement and animations
        npcShip.update(deltaTime);

        // Track closest ship for debugging
        const distanceToPlayer = npcShip.position.distanceTo(playerPosition);
        if (distanceToPlayer < closestDistance) {
            closestDistance = distanceToPlayer;
            closestShip = npcShip;
        }

        // Update combat behavior
        npcShip.updateCombat(playerPosition, deltaTime);
    }

    // Log closest ship for debugging
    if (closestShip && Math.random() < 0.03) {
        console.log(`Closest ship ${closestShip.id} at distance ${closestDistance.toFixed(0)}`);
    }
}

/**
 * Remove all NPC ships from the scene
 */
export function clearAllNpcShips() {
    while (activeNpcShips.length > 0) {
        activeNpcShips[0].dispose();
    }
}

/**
 * Create an NPC ship at a specific position for debugging
 * @param {THREE.Vector3} position - Position to create the ship
 * @param {string} shipType - Type of ship to create
 */
export function createDebugNpcShip(position, shipType = 'mediumpirate') {
    console.log(`Creating debug NPC ship at position (${position.x}, ${position.y}, ${position.z})`);
    return createNpcShip(position, { shipType });
}

/**
 * Helper function to normalize an angle between -PI and PI
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle
 */
function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
}

/**
 * Set debug level for NPC ships
 * @param {number} level - Debug level (0=none, 1=minimal, 2=verbose)
 */
export function setNpcDebugLevel(level) {
    NPC_SHIP_CONFIG.debugLevel = level;
    debugLog(`NPC ship debug level set to ${level}`, 0); // Always show this message
}

/**
 * Toggle debug visuals for all NPC ships
 * @param {boolean} enabled - Whether to enable or disable debug visuals
 */
export function toggleNpcDebugVisuals(enabled) {
    NPC_SHIP_CONFIG.debugVisuals = enabled;

    // Show/hide existing debug markers
    debugHelpers.waypointMarkers.forEach(marker => {
        marker.visible = enabled;
    });

    // Show/hide path lines and state indicators for all ships
    activeNpcShips.forEach(ship => {
        if (ship.debugWaypointMarker) {
            ship.debugWaypointMarker.visible = enabled;
        }

        if (ship.debugPathLine) {
            ship.debugPathLine.visible = enabled;
        }

        if (ship.debugStateIndicator) {
            ship.debugStateIndicator.visible = enabled;
        }

        if (ship.debugCombatIndicator) {
            ship.debugCombatIndicator.visible = enabled;
        }
    });

    debugLog(`NPC ship debug visuals ${enabled ? 'enabled' : 'disabled'}`, 0);
}

/**
 * Helper function to check combat status of all NPC ships
 * Useful for debugging from the console
 */
export function debugNpcCombatStatus() {
    if (activeNpcShips.length === 0) {
        console.log("No active NPC ships to debug");
        return;
    }

    console.log(`=== NPC Ships Combat Status (${activeNpcShips.length} ships) ===`);

    // Get player position
    const playerPos = boat ? boat.position : null;
    if (!playerPos) {
        console.log("Cannot find player position for distance calculation");
    }

    activeNpcShips.forEach(ship => {
        const distToPlayer = playerPos ? ship.position.distanceTo(playerPos) : "unknown";
        const cooldownRemaining = npcCannonSystem.getRemainingCooldown(ship);

        console.log(`Ship ${ship.id} (${ship.shipType}):`);
        console.log(`  Position: (${ship.position.x.toFixed(0)}, ${ship.position.z.toFixed(0)})`);
        console.log(`  Combat: ${ship.combatEnabled ? 'ENABLED' : 'disabled'}`);
        console.log(`  State: ${ship.combatState}`);
        console.log(`  Attack range: ${ship.attackRange}`);
        console.log(`  Aggro range: ${ship.aggroRange}`);
        console.log(`  Distance to player: ${typeof distToPlayer === 'number' ? distToPlayer.toFixed(0) : distToPlayer}`);
        console.log(`  Can attack player: ${ship.combatEnabled && typeof distToPlayer === 'number' && distToPlayer < ship.attackRange}`);
        console.log(`  Cooldown: ${cooldownRemaining > 0 ? cooldownRemaining.toFixed(1) + 's remaining' : 'ready to fire'}`);
        console.log('---');
    });
}

/**
 * Spawn a hostile NPC ship near the player for testing combat
 * @param {number} distance - Distance from player to spawn the ship (default: 100)
 * @param {string} shipType - Type of ship to spawn
 * @returns {NpcShip} The spawned ship
 */
export function spawnHostileNpcNearPlayer(distance = 100, shipType = 'mediumpirate') {
    if (!boat) {
        debugLog('Cannot spawn hostile NPC: Player boat not found', 0);
        return null;
    }

    // Get player position
    const playerPos = boat.position.clone();

    // Choose a random angle
    const angle = Math.random() * Math.PI * 2;

    // Calculate position at given distance
    const spawnPos = new THREE.Vector3(
        playerPos.x + Math.cos(angle) * distance,
        0,
        playerPos.z + Math.sin(angle) * distance
    );

    // Spawn the ship with combat enabled
    const ship = createNpcShip(spawnPos, {
        shipType: shipType,
        moveSpeed: 8.0,
        patrolRadius: 500,
        combatEnabled: true,
        attackRange: 600, // Updated to match new cannon range
        aggroRange: 700
    });

    debugLog(`Spawned hostile ${shipType} at distance ${distance} from player`, 0);

    return ship;
}

/**
 * Toggle combat mode for all NPC ships
 * @param {boolean} enabled - Whether to enable or disable combat
 * @param {number} attackRange - Attack range to set (optional)
 * @param {number} aggroRange - Aggro range to set (optional)
 */
export function toggleAllNpcCombat(enabled, attackRange, aggroRange) {
    const count = activeNpcShips.length;
    if (count === 0) {
        debugLog('No active NPC ships to toggle combat for', 0);
        return;
    }

    activeNpcShips.forEach(ship => {
        ship.combatEnabled = enabled;

        if (attackRange !== undefined) {
            ship.attackRange = attackRange;
        }

        if (aggroRange !== undefined) {
            ship.aggroRange = aggroRange;
        }

        // Reset combat state
        if (!enabled) {
            ship.combatState = 'passive';
            if (ship.debugCombatIndicator) {
                ship.debugCombatIndicator.visible = false;
            }
        }
    });

    debugLog(`${enabled ? 'Enabled' : 'Disabled'} combat for ${count} NPC ships`, 0);
    if (attackRange !== undefined || aggroRange !== undefined) {
        debugLog(`Updated ranges - Attack: ${attackRange}, Aggro: ${aggroRange}`, 1);
    }
}

/**
 * Test function to spawn a ship near the player and force it to fire immediately
 * Call from console: testNpcFire()
 */
export function testNpcFire() {
    if (!boat) {
        console.error("Cannot test NPC firing - player boat not found");
        return;
    }

    // Get player position
    const playerPos = boat.position.clone();

    // Spawn at a distance that will test the range
    const spawnPos = new THREE.Vector3(
        playerPos.x + 300, // Half the attack range for better testing
        0,
        playerPos.z
    );

    console.log("TEST: Spawning test NPC ship at", spawnPos);

    // Create the ship
    const ship = createNpcShip(spawnPos, {
        shipType: 'mediumpirate',
        moveSpeed: 0, // Don't move
        patrolRadius: 0,
        combatEnabled: true,
        attackRange: 600, // Match the cannon range
        aggroRange: 700  // Slightly more than attack range
    });

    // Wait a moment for the model to load
    setTimeout(() => {
        console.log("TEST: Forcing test NPC ship to fire");
        if (npcCannonSystem) {
            // Clear any cooldown for this test ship
            npcCannonSystem.lastFiredTimes.delete(ship.id);

            const result = npcCannonSystem.fireAtTarget(ship, playerPos);
            console.log("Cannon fire result:", result);

            if (result) {
                console.log(`Cooldown set, remaining: ${npcCannonSystem.getRemainingCooldown(ship).toFixed(1)}s`);
            }
        } else {
            console.error("NPC Cannon System not available");
        }
    }, 1000);

    return ship;
}

// Register test function globally
if (typeof window !== 'undefined') {
    window.testNpcFire = testNpcFire;
    console.log("Test function registered: Call testNpcFire() to test NPC firing");
}