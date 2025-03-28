import * as THREE from 'three';
import { socket } from '../core/network.js';
import { getOtherPlayers } from './playerManager.js';

// Harpoon network communication variables
let harpoonHitCallback = null;
let harpoonReturnCallback = null;

/**
 * Fire a harpoon from the player's position
 * @param {THREE.Vector3} position - Starting position of the harpoon
 * @param {THREE.Vector3} direction - Direction the harpoon is fired in
 * @param {Number} speed - Speed of the harpoon
 * @param {Number} range - Maximum range of the harpoon
 * @param {String} harpoonId - Unique ID for this harpoon instance
 */
export function fireHarpoon(position, direction, speed, range, harpoonId) {
    if (!socket || !socket.connected) {
        console.warn('Cannot fire harpoon: not connected to server');
        return;
    }

    //console.log("we are here");

    // Send harpoon data to server
    socket.emit('harpoon_fire', {
        position: {
            x: position.x,
            y: position.y,
            z: position.z
        },
        direction: {
            x: direction.x,
            y: direction.y,
            z: direction.z
        },
        speed: speed,
        range: range,
        harpoonId: harpoonId
    });
}

/**
 * Pull a harpooned entity toward the player
 * @param {String} harpoonId - ID of the harpoon that hit
 * @param {String} targetId - ID of the entity that was hit
 */
export function pullHarpoonedEntity(harpoonId, targetId) {
    if (!socket || !socket.connected) {
        console.warn('Cannot pull harpooned entity: not connected to server');
        return;
    }

    socket.emit('harpoon_pull', {
        harpoonId: harpoonId,
        targetId: targetId
    });
}

/**
 * Release a harpooned entity
 * @param {String} harpoonId - ID of the harpoon to release
 */
export function releaseHarpoon(harpoonId) {
    if (!socket || !socket.connected) {
        console.warn('Cannot release harpoon: not connected to server');
        return;
    }

    socket.emit('harpoon_release', {
        harpoonId: harpoonId
    });
}

/**
 * Register a callback function to be called when the player is hit by a harpoon
 * @param {Function} callback - Function to call when hit by a harpoon
 */
export function onHarpoonHit(callback) {
    harpoonHitCallback = callback;
}

/**
 * Register a callback function to be called when a harpoon returns
 * @param {Function} callback - Function to call when a harpoon returns
 */
export function onHarpoonReturn(callback) {
    harpoonReturnCallback = callback;
}

/**
 * Handle harpoon fired events from other players
 * @param {Object} data - Data about the harpoon fired
 */
export function handleHarpoonFired(data) {
    console.log("handleHarpoonFired");
    const otherPlayers = getOtherPlayers();
    const firingPlayer = otherPlayers.get(data.playerId);

    if (!firingPlayer) {
        console.warn(`Received harpoon_fired from unknown player: ${data.playerId}`);
        return;
    }

    // Create position and direction vectors from the data
    const position = new THREE.Vector3(
        data.position.x,
        data.position.y,
        data.position.z
    );

    const direction = new THREE.Vector3(
        data.direction.x,
        data.direction.y,
        data.direction.z
    );

    // Create a visual representation of the harpoon
    // This would typically be handled by a separate harpoon visualization system
    console.log(`Player ${firingPlayer.name} fired a harpoon from ${position.x}, ${position.y}, ${position.z}`);

    // The actual visual representation would be implemented in a separate
    // harpoon visualization system that would be called here
}

/**
 * Handle when player is hit by a harpoon
 * @param {Object} data - Data about the harpoon hit
 */
export function handleHarpoonHit(data) {
    if (harpoonHitCallback) {
        harpoonHitCallback(data);
    }
}

/**
 * Handle when player is being pulled by a harpoon
 * @param {Object} data - Data about the harpoon pull
 */
export function handleHarpoonPull(data) {
    // Apply pulling force to the player
    // This would typically be handled by the physics system
    console.log(`Being pulled by harpoon ${data.harpoonId} from player ${data.playerId}`);
}

/**
 * Handle when a harpoon is released
 * @param {Object} data - Data about the harpoon release
 */
export function handleHarpoonRelease(data) {
    console.log(`Harpoon ${data.harpoonId} released`);
    // Stop any pull effects
}

/**
 * Handle when a harpoon returns to the player
 * @param {Object} data - Data about the harpoon return
 */
export function handleHarpoonReturn(data) {
    if (harpoonReturnCallback) {
        harpoonReturnCallback(data);
    }
}

/**
 * Set up harpoon-related socket event handlers
 * This should be called from network.js when setting up socket events
 */
export function setupHarpoonSocketEvents(socket) {
    socket.on('harpoon_fired_broadcast', handleHarpoonFired);
    socket.on('harpoon_hit', handleHarpoonHit);
    socket.on('harpoon_pull', handleHarpoonPull);
    socket.on('harpoon_release', handleHarpoonRelease);
    socket.on('harpoon_return', handleHarpoonReturn);
}