import * as THREE from 'three';
import { scene, addToScene, removeFromScene, getTime, boat } from '../core/gameState.js';
import { loadShipModel } from './boatLoader.js';
import npcCannonSystem from '../npc/abilities/npcCannon.js';
import { debugLog } from '../utils/debug.js';
import { startNpcFollow, stopNpcFollow, updateNpcFollow, isNpcFollowing } from '../npc/behavior/npcFollowBehavior.js';
import { trackDestroyedShip } from '../world/spawn.js';
import { playSound } from '../audio/soundEffects.js';

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
    defaultShipType: 'mediumpirate',  // Default ship type to use if none specified

    // Physics and effects
    boatRockSpeed: 1.0,     // Speed of boat rocking
    maxRockAngle: 0.06,     // Maximum rock angle in radians
    waterHeight: 0,         // Water height at rest (sea level)

    // Movement pattern settings
    maxCurveDeviation: 150, // Maximum curve deviation from straight line
    pathComplexity: 0.7,    // How complex the paths should be (0-1)
    waypointMode: 'curved', // 'direct' or 'curved' or 'zigzag'

    // Debug settings
    debugVisuals: false,     // Whether to show debug visuals
    debugLevel: 1,          // 0=none, 1=minimal, 2=verbose
};

// Track all active NPC ships
const activeNpcShips = [];

// Export for debugging
export { activeNpcShips };

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
        this.id = options.id || `npc-ship-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        this.position = new THREE.Vector3(position.x, position.y, position.z);
        this.rotation = new THREE.Euler(0, Math.random() * Math.PI * 2, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);

        // Health system
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.damagePerHit = 10;
        this.isDestroyed = false;
        this.lastDamageTime = 0;
        this.damageCooldown = 0.3; // Short cooldown between damage events

        // Ship model type selection
        this.type = options.shipType || options.type || NPC_SHIP_CONFIG.defaultShipType;

        // Path planning properties
        this.intermediateWaypoints = [];
        this.lastWaypointDirection = Math.random() < 0.5 ? 'left' : 'right';

        // Apply custom options or defaults
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
        this.cooldownTimer = 0; // Simple cooldown timer in seconds

        // Add follow behavior property
        this.isFollowing = false;

        // Behavior state
        this.state = 'moving';  // 'moving' or 'idling'
        this.idleTimer = 0;
        this.spawnPosition = this.position.clone();
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

        debugLog(`Created NPC Ship ${this.id} of type ${this.type} at position (${position.x.toFixed(0)}, ${position.z.toFixed(0)})`, 1);
        debugLog(`Ship settings: speed=${this.moveSpeed.toFixed(1)}, turnSpeed=${this.turnSpeed.toFixed(3)}, patrolRadius=${this.patrolRadius}`, 2);
    }

    /**
     * Load the ship model using boatLoader
     */
    loadModel() {
        loadShipModel(this.shipGroup, {
            shipType: this.type,
            customModelId: this.id,
            isOtherPlayer: true  // Use NPC orientation
        }, (success) => {
            if (success) {

            } else {

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
        // Skip updates if ship is destroyed
        if (this.isDestroyed) {
            return;
        }

        // Make sure deltaTime is valid
        const dt = Math.min(deltaTime || 0.016, 0.1);  // Cap at 100ms, default to 16ms

        // Update current time
        this.lastUpdateTime = getTime();

        // Update cooldown timer
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= dt;
            if (this.cooldownTimer < 0) this.cooldownTimer = 0;
        }

        // Remember previous state for debug visualization
        const previousState = this.state;
        const previousCombatState = this.combatState;

        // Check if we should be following the player in aggressive mode
        if (this.combatState === 'aggressive' && this.combatEnabled && boat) {
            // While aggressive, use follow behavior instead of normal movement
            const followUpdated = updateNpcFollow(this, dt);

            // Track follow state
            this.isFollowing = followUpdated;

            // If following, we skip normal movement state updates
            if (followUpdated) {
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
                this.updateDebugStateIndicator(previousState);

                return; // Skip normal movement
            }
        } else if (this.isFollowing) {
            // Was following but no longer aggressive - stop following
            stopNpcFollow(this);
            this.isFollowing = false;
        }

        // Normal movement states when not aggressively following
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
        this.updateDebugStateIndicator(previousState);
    }

    /**
     * Update debug state indicator color and position
     * @param {string} previousState - Previous movement state
     */
    updateDebugStateIndicator(previousState) {
        if (!NPC_SHIP_CONFIG.debugVisuals) return;

        // Update path line
        if (this.debugPathLine && !this.isFollowing) {
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
        // Stop follow behavior if active
        if (this.isFollowing) {
            stopNpcFollow(this);
            this.isFollowing = false;
        }

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
        // Skip if combat is disabled or ship is destroyed
        if (!this.combatEnabled || this.isDestroyed) {
            return;
        }

        // Calculate distance to player
        const distanceToPlayer = this.position.distanceTo(playerPosition);

        // Previous combat state
        const previousState = this.combatState;

        // Log distance to player less frequently to reduce console spam
        if (Math.random() < 0.01) { // 1% chance to log

        }

        // If player is within cannon range, fire
        if (distanceToPlayer < this.attackRange) {
            // Set combat state
            if (this.combatState !== 'aggressive') {
                this.combatState = 'aggressive';


                // Start following behavior when entering aggressive mode
                if (!this.isFollowing) {
                    this.isFollowing = startNpcFollow(this);
                    debugLog(`Started follow behavior for NPC ${this.id}: ${this.isFollowing}`, 1);
                }
            }

            // Check if we can fire (not on cooldown)
            if (this.cooldownTimer <= 0) {
                // Show debug info for firing


                // Fire cannons at player directly using npcCannonSystem
                const fired = npcCannonSystem.fireAtTarget(this, playerPosition);

                if (fired) {

                } else {

                }
            } else if (Math.random() < 0.05) { // Occasionally log cooldown status

            }
        }
        // If player is within aggro range but outside attack range, pursue
        else if (distanceToPlayer < this.aggroRange) {
            // Set to aggressive and use follow behavior
            if (this.combatState !== 'aggressive') {
                this.combatState = 'aggressive';


                // Start following behavior when entering aggressive mode
                if (!this.isFollowing) {
                    this.isFollowing = startNpcFollow(this);
                    debugLog(`Started follow behavior for NPC ${this.id}: ${this.isFollowing}`, 1);
                }
            }
        }
        // If player is outside aggro range, return to passive
        else if (this.combatState !== 'passive') {
            this.combatState = 'passive';


            // Stop following when returning to passive mode
            if (this.isFollowing) {
                stopNpcFollow(this);
                this.isFollowing = false;
                debugLog(`Stopped follow behavior for NPC ${this.id}`, 1);
            }
        }

        // Update combat indicator if state changed
        if (this.debugCombatIndicator && previousState !== this.combatState) {
            this.debugCombatIndicator.visible = this.combatState === 'aggressive';
        }
    }

    /**
     * Get the visual world position of the ship
     * @returns {THREE.Vector3} The world position of the ship's visual model
     */
    getShipWorldPosition() {
        // If we have a loaded 3D model, use its position
        if (this.shipGroup) {
            const worldPos = new THREE.Vector3();
            this.shipGroup.getWorldPosition(worldPos);
            return worldPos;
        }

        // Otherwise fall back to the ship's logical position
        return this.position.clone();
    }

    /**
     * Apply damage to the NPC ship
     * @param {number} amount - Amount of damage to apply
     * @param {string} source - Source of damage (e.g., 'player_cannon')
     * @returns {boolean} - Returns true if damage was applied, false otherwise
     */
    takeDamage(amount, source = 'player_cannon') {
        const currentTime = getTime();

        // Check cooldown to prevent damage spamming
        if (currentTime - this.lastDamageTime < this.damageCooldown) {
            return false;
        }

        // Update last damage time
        this.lastDamageTime = currentTime;

        // Apply damage directly (no standardization needed since we fixed cannonshot.js)
        this.health -= amount;

        // Clamp health to 0-max
        this.health = Math.max(0, Math.min(this.maxHealth, this.health));

        // Show damage effect
        if (this.shipGroup) {
            import('../effects/playerDamageEffects.js').then(effects => {
                // Use the shipGroup for visual effect placement
                effects.showDamageEffect(this.shipGroup, amount, 'cannon');
            });
        }

        // Check if ship is destroyed
        if (this.health <= 0 && !this.isDestroyed) {
            this.isDestroyed = true;
            this.handleDestruction(source);
        }

        return true;
    }

    /**
     * Handle ship destruction
     * @param {string} source - Source of the killing damage
     */
    handleDestruction(source) {
        // Always play explosion sound
        playSound('shipblowingup.mp3', {
            volume: 0.1, // Increased volume significantly
            spatial: false,
            position: this.position,
            minDistance: 20,
            maxDistance: 1000
        }).catch(error => {
            console.warn('Failed to play wilhelm scream:', error);
        });

        // 50% chance to play Wilhelm scream
        if (Math.random() < 0.7) {
            playSound('wilhelm.wav', {
                volume: 0.1, // Increased volume significantly
                spatial: false,
                position: this.position,
                minDistance: 20,
                maxDistance: 1000
            }).catch(error => {
                console.warn('Failed to play wilhelm scream:', error);
            });
        }

        // Delay the visual effects by 300ms to match audio
        setTimeout(() => {
            // Track this ship for respawning with its original configuration
            const shipConfig = {
                x: this.spawnPosition.x,
                y: this.spawnPosition.y,
                z: this.spawnPosition.z,
                type: this.type,
                options: {
                    moveSpeed: this.moveSpeed,
                    turnSpeed: this.turnSpeed,
                    patrolRadius: this.patrolRadius,
                    combatEnabled: this.combatEnabled,
                    attackRange: this.attackRange,
                    aggroRange: this.aggroRange
                }
            };
            trackDestroyedShip(shipConfig);

            // Create explosion effect
            const position = this.position.clone();
            position.y += 1; // Raise explosion slightly above water

            // Hide the ship model immediately
            if (this.shipGroup) {
                this.shipGroup.visible = false;
            }

            // Create destruction visual effects
            this.createDestructionEffect(position);

            // Remove the ship from game logic after effects have time to play
            setTimeout(() => {
                this.dispose();
            }, 3000); // Extended to match the longest effect duration (debris is 3 seconds)

            // Increment player stats for destroying an NPC ship
            if (source === 'player_cannon') {
                try {
                    // Try to increment player stats if the network module is available
                    import('../core/network.js').then(network => {
                        if (network.incrementPlayerStats) {
                            network.incrementPlayerStats({ npcShipsDestroyed: 1 });
                        }
                    });
                } catch (error) {
                    // Handle error silently
                }
            }
        }, 300); // 300ms delay for visual effects
    }

    /**
     * Create destruction visual effects
     * @param {THREE.Vector3} position - Position of the explosion
     */
    createDestructionEffect(position) {
        // Create multiple layers of explosion effects
        this.createExplosionParticles(position);
        this.createExplosionFlash(position);
        this.createSmokeCloud(position);
        this.createDebris(position);

        // Play explosion sound
    }

    /**
     * Create particle explosion effect
     * @param {THREE.Vector3} position - Position of the explosion
     */
    createExplosionParticles(position) {
        // Create explosion particles
        const particleCount = 50; // Increased count
        const particles = [];

        // Create particle geometry
        const particleGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xff5500,
            transparent: true,
            opacity: 0.9
        });

        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());

            // Position around the explosion point
            particle.position.copy(position).add(
                new THREE.Vector3(
                    (Math.random() - 0.5) * 6, // Larger spread
                    Math.random() * 4,         // Higher
                    (Math.random() - 0.5) * 6  // Larger spread
                )
            );

            // More powerful explosion - higher velocity
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 12,  // Faster horizontal
                5 + Math.random() * 10,      // Higher vertical
                (Math.random() - 0.5) * 12   // Faster horizontal
            );

            // Add to scene
            scene.add(particle);
            particles.push(particle);

            // Set particle to expand over time
            particle.userData.scaleRate = 0.05 + Math.random() * 0.05;
            particle.userData.opacityDecay = 0.02 + Math.random() * 0.02;

            // Randomize colors between orange and yellow
            if (Math.random() > 0.5) {
                particle.material.color.set(0xff7700); // More orange
            } else {
                particle.material.color.set(0xffaa00); // More yellow
            }
        }

        // Animate explosion particles
        let elapsed = 0;
        const duration = 2.5; // seconds

        function animateExplosion() {
            elapsed += 0.04; // Reduced from 0.2 to slow down by 5x

            if (elapsed >= duration) {
                // Remove particles when animation completes
                particles.forEach(particle => {
                    if (particle.parent) {
                        scene.remove(particle);
                        particle.geometry.dispose();
                        particle.material.dispose();
                    }
                });
                return;
            }

            // Update each particle
            particles.forEach(particle => {
                // Apply gravity
                particle.userData.velocity.y -= 0.2; // Stronger gravity

                // Move based on velocity - MATCH THE TIME INCREMENT
                particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.04));

                // Expand
                particle.scale.addScalar(particle.userData.scaleRate);

                // Fade out
                particle.material.opacity -= particle.userData.opacityDecay;
                if (particle.material.opacity < 0) {
                    particle.material.opacity = 0;
                }
            });

            requestAnimationFrame(animateExplosion);
        }

        // Start animation
        animateExplosion();
    }

    /**
     * Create central flash for explosion
     * @param {THREE.Vector3} position - Position of the explosion
     */
    createExplosionFlash(position) {
        // Create a bright flash at the center
        const flashGeometry = new THREE.SphereGeometry(4, 16, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 1.0
        });

        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        scene.add(flash);

        // Animate the flash using the same incremental approach as other animations
        let elapsed = 0;
        const flashDuration = 0.4; // seconds

        function animateFlash() {
            elapsed += 0.04; // Reduced from 0.2 to slow down by 5x

            if (elapsed >= flashDuration) {
                scene.remove(flash);
                flash.geometry.dispose();
                flash.material.dispose();
                return;
            }

            // Calculate progress as a percentage of duration
            const progress = elapsed / flashDuration;

            // Quickly expand then contract (using sin curve for smooth animation)
            const scale = 1 + 4 * Math.sin(Math.PI * progress);
            flash.scale.set(scale, scale, scale);

            // Fade out
            flash.material.opacity = 1 - progress;

            requestAnimationFrame(animateFlash);
        }

        requestAnimationFrame(animateFlash);
    }

    /**
     * Create smoke cloud after explosion
     * @param {THREE.Vector3} position - Position of the explosion
     */
    createSmokeCloud(position) {
        const smokeCount = 20;
        const smokeClouds = [];

        // Create dark smoke particles
        const smokeGeometry = new THREE.SphereGeometry(2, 8, 8);
        const smokeMaterial = new THREE.MeshBasicMaterial({
            color: 0x555555,
            transparent: true,
            opacity: 0.7
        });

        for (let i = 0; i < smokeCount; i++) {
            const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial.clone());

            // Start at explosion center
            smoke.position.copy(position).add(
                new THREE.Vector3(
                    (Math.random() - 0.5) * 3,
                    Math.random() * 1,
                    (Math.random() - 0.5) * 3
                )
            );

            // Slower rising motion
            smoke.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                0.5 + Math.random() * 1.5,
                (Math.random() - 0.5) * 1.5
            );

            // Randomize smoke color slightly
            const darkness = 0.3 + Math.random() * 0.3;
            smoke.material.color.setRGB(darkness, darkness, darkness);

            scene.add(smoke);
            smokeClouds.push(smoke);
        }

        // Animate smoke
        let elapsed = 0;
        const smokeDuration = 5.0; // seconds

        function animateSmoke() {
            elapsed += 0.04; // Reduced from 0.2 to slow down by 5x

            if (elapsed >= smokeDuration) {
                smokeClouds.forEach(smoke => {
                    if (smoke.parent) {
                        scene.remove(smoke);
                        smoke.geometry.dispose();
                        smoke.material.dispose();
                    }
                });
                return;
            }

            smokeClouds.forEach(smoke => {
                // Slow rising motion - MATCH THE TIME INCREMENT
                smoke.position.add(smoke.userData.velocity.clone().multiplyScalar(0.04));

                // Expand smoke over time
                if (elapsed < smokeDuration * 0.7) {
                    smoke.scale.addScalar(0.01);
                }

                // Fade out gradually
                smoke.material.opacity = 0.7 * (1 - (elapsed / smokeDuration));
            });

            requestAnimationFrame(animateSmoke);
        }

        requestAnimationFrame(animateSmoke);
    }

    /**
     * Create ship debris from explosion
     * @param {THREE.Vector3} position - Position of the explosion
     */
    createDebris(position) {
        const debrisCount = 15;
        const debrisPieces = [];

        // Create various debris geometries
        const debrisGeometries = [
            new THREE.BoxGeometry(1, 0.5, 2),
            new THREE.BoxGeometry(0.7, 0.7, 0.7),
            new THREE.BoxGeometry(1.5, 0.3, 0.8)
        ];

        // Brown/wood colors for ship debris
        const debrisColors = [0x8B4513, 0x704214, 0x5C3A17];

        for (let i = 0; i < debrisCount; i++) {
            // Randomly select geometry and color
            const geometryIndex = Math.floor(Math.random() * debrisGeometries.length);
            const colorIndex = Math.floor(Math.random() * debrisColors.length);

            const debris = new THREE.Mesh(
                debrisGeometries[geometryIndex],
                new THREE.MeshBasicMaterial({
                    color: debrisColors[colorIndex]
                })
            );

            // Position around explosion center
            debris.position.copy(position).add(
                new THREE.Vector3(
                    (Math.random() - 0.5) * 4,
                    Math.random() * 2,
                    (Math.random() - 0.5) * 4
                )
            );

            // Add random rotation
            debris.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // Add physics
            debris.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                3 + Math.random() * 7,
                (Math.random() - 0.5) * 10
            );

            // Add rotation velocity
            debris.userData.rotationSpeed = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            );

            scene.add(debris);
            debrisPieces.push(debris);
        }

        // Animate debris
        let elapsed = 0;
        const debrisDuration = 3.0; // seconds

        function animateDebris() {
            elapsed += 0.04; // Reduced from 0.2 to slow down by 5x

            if (elapsed >= debrisDuration) {
                debrisPieces.forEach(debris => {
                    if (debris.parent) {
                        scene.remove(debris);
                        debris.geometry.dispose();
                        debris.material.dispose();
                    }
                });
                return;
            }

            debrisPieces.forEach(debris => {
                // Apply gravity
                debris.userData.velocity.y -= 0.3;

                // Move based on velocity - MATCH THE TIME INCREMENT
                debris.position.add(debris.userData.velocity.clone().multiplyScalar(0.04));

                // Rotate debris
                debris.rotation.x += debris.userData.rotationSpeed.x;
                debris.rotation.y += debris.userData.rotationSpeed.y;
                debris.rotation.z += debris.userData.rotationSpeed.z;

                // If debris hits water, make it float
                if (debris.position.y <= 0) {
                    debris.position.y = 0;
                    debris.userData.velocity.y = Math.abs(debris.userData.velocity.y) * 0.3;

                    // Slow down horizontal movement in water
                    debris.userData.velocity.x *= 0.95;
                    debris.userData.velocity.z *= 0.95;

                    // Slow down rotation in water
                    debris.userData.rotationSpeed.multiplyScalar(0.95);
                }
            });

            requestAnimationFrame(animateDebris);
        }

        requestAnimationFrame(animateDebris);
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
    // Make active ships available globally for mobile targeting
    if (typeof window !== 'undefined') {
        window.activeNpcShips = activeNpcShips;
    }

    // Log the first update call to verify it's running
    if (activeNpcShips.length > 0 && !updateNpcShips.hasLogged) {
        updateNpcShips.hasLogged = true;
    }

    // Get player position from boat object
    const playerPosition = boat ? boat.position.clone() : null;

    // Log player position occasionally
    if (playerPosition && Math.random() < 0.01) {

    }

    // If no player position, nothing to do for combat
    if (!playerPosition) {

        return;
    }

    let closestShip = null;
    let closestDistance = Infinity;

    for (const npcShip of activeNpcShips) {
        // Force combat enabled for testing
        if (!npcShip.combatEnabled) {
            npcShip.combatEnabled = true;
            npcShip.attackRange = 100; // Original attack range
            npcShip.aggroRange = 150;  // Original aggro range

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

        return;
    }



    // Get player position
    const playerPos = boat ? boat.position : null;
    if (!playerPos) {

    }

    activeNpcShips.forEach(ship => {
        const distToPlayer = playerPos ? ship.position.distanceTo(playerPos) : "unknown";











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

        return;
    }

    // Get player position
    const playerPos = boat.position.clone();

    // Spawn at a distance that will test the range
    const spawnPos = new THREE.Vector3(
        playerPos.x + 100, // Use original distance for testing
        0,
        playerPos.z
    );



    // Create the ship
    const ship = createNpcShip(spawnPos, {
        shipType: 'mediumpirate',
        moveSpeed: 0, // Don't move
        patrolRadius: 0,
        combatEnabled: true,
        attackRange: 100, // Original attack range
        aggroRange: 150  // Original aggro range
    });

    // Reset cooldown to ensure it can fire immediately
    ship.cooldownTimer = 0;

    // Wait a moment for the model to load
    setTimeout(() => {

        if (npcCannonSystem) {
            const result = npcCannonSystem.fireAtTarget(ship, playerPos);


            if (result) {

            }
        } else {

        }
    }, 1000);

    return ship;
}

// Register test function globally
if (typeof window !== 'undefined') {
    window.testNpcFire = testNpcFire;

}