// vibeverse.js - Portal to the Vibeverse
import * as THREE from 'three';
import { scene, addToScene, getPlayerInfo } from '../core/gameState.js';
import { createHugeFloatingText } from '../effects/HugeFloatingText.js';
import { applyOutline } from '../theme/outlineStyles';
import { loadBrightenedModel } from '../utils/islandLoader.js';

// Portal properties
const PORTAL_RADIUS = 100;
const PORTAL_HEIGHT = 150; // Height of the arch
const PORTAL_WIDTH = 120;  // Width of the arch
const PORTAL_THICKNESS = 20; // Thickness of the arch border
const PORTAL_SEGMENTS = 32;
const PORTAL_COLORS = {
    green: 0x00ff66, // Bright green color for Vibeverse
    blue: 0x00ffff,  // Bright blue color for Jetski
    default: 0x00ff66 // Default fallback color
};
const PORTAL_GLOW_COLOR = 0x66ffaa;
const PORTAL_COLLISION_RADIUS = 100; // How close the player needs to be to trigger the portal

// Array to track all portals in the game
const portals = [];

/**
 * Creates a portal using a GLB model with enhanced brightness
 * @param {Object} options Custom options for the portal
 * @returns {THREE.Group} Portal group containing the GLB model and effects
 */
function createVibeversePortal(options = {}) {
    // Create a group to hold all portal elements
    const portalGroup = new THREE.Group();

    // Load the GLB model using the brightened loader
    loadBrightenedModel(portalGroup, {
        modelId: `portal_${options.name || Date.now()}`, // Include 'portal' in the ID
        modelUrl: options.modelPath,
        scaleValue: options.scale || 1.0,
        position: [0, 0, 0],
        rotation: Array.isArray(options.rotation) ? options.rotation :
            options.rotation ? [options.rotation.x || 0, options.rotation.y || 0, options.rotation.z || 0] : [0, 0, 0]
    }, (success) => {
        if (success) {
            console.log('Portal model loaded successfully');
            applyOutline(portalGroup);
        } else {
            console.error('Failed to load portal model');
        }
    });

    return portalGroup;
}

/**
 * Creates a new portal and places it in the world
 * @param {THREE.Vector3} position The world position for the portal
 * @param {String} text The text to display above the portal
 * @param {String} url The URL to navigate to when entering the portal
 * @param {Object} options Additional options for portal placement
 * @returns {Object} The portal object with its properties and instance
 */
export function createPortal(position, text, url, options = {}) {
    // Configure portal options based on type
    const portalOptions = {
        modelPath: options.modelPath || './models/portal.glb',
        scale: options.scale || 1.0
    };

    // Create the portal with the GLB model
    const portal = createVibeversePortal(portalOptions);

    // Set the portal position
    portal.position.copy(position);

    // Set default orientation (adjust based on your GLB model's default orientation)
    portal.rotation.y = Math.PI; // Rotate to face the player

    // Apply any custom rotation if specified
    if (options.rotation) {
        portal.rotation.x += options.rotation.x || 0;
        portal.rotation.y += options.rotation.y || 0;
        portal.rotation.z += options.rotation.z || 0;
    }

    // Determine portal color based on model path
    let portalColor = PORTAL_COLORS.default;
    if (options.modelPath) {
        if (options.modelPath.includes('green')) {
            portalColor = PORTAL_COLORS.green;
        } else if (options.modelPath.includes('blue')) {
            portalColor = PORTAL_COLORS.blue;
        }
    }

    // Add a huge floating text above the portal
    const textPosition = position.clone();
    textPosition.y += 300;
    textPosition.z += 0;

    const textObj = createHugeFloatingText({
        text: text,
        position: textPosition,
        color: portalColor,
        size: 700,
        duration: 100.0,
        disappear: false,
        riseFactor: 0.0,
        fadeOut: false,
        glow: true
    });

    // Add the portal to the scene
    addToScene(portal);

    // Create portal object with all necessary properties
    const portalObject = {
        instance: portal,
        link: url,
        position: position.clone(),
        active: true,
        activated: false,
        triggerCollision: false,
        text: text,
        id: portals.length
    };

    // Add to our portals array
    portals.push(portalObject);

    return portalObject;
}

/**
 * Updates all portals and checks for player collision
 * @param {THREE.Vector3} playerPosition The player's current position
 * @returns {Array} Array of portal IDs that were collided with in this update
 */
export function updatePortals(playerPosition) {
    if (!playerPosition) return [];

    const collisions = [];

    // Check each portal for collision
    portals.forEach(portal => {
        if (!portal.active || portal.triggerCollision) return;

        const collision = checkPortalCollision(portal.position, playerPosition);

        if (collision) {
            portal.triggerCollision = true;
            const playerInfo = getPlayerInfo();
            handlePortalEntry(playerInfo, portal);
            collisions.push(portal.id);
        }
    });

    return collisions;
}

/**
 * Get a specific portal by ID
 * @param {Number} portalId The ID of the portal to retrieve
 * @returns {Object} The portal object or null if not found
 */
export function getPortal(portalId) {
    return portals.find(p => p.id === portalId) || null;
}

/**
 * Get all active portals
 * @returns {Array} Array of all active portal objects
 */
export function getAllPortals() {
    return [...portals];
}

/**
 * Remove a portal from the scene and the tracking array
 * @param {Number} portalId The ID of the portal to remove
 * @returns {Boolean} True if removal was successful
 */
export function removePortal(portalId) {
    const portalIndex = portals.findIndex(p => p.id === portalId);

    if (portalIndex >= 0) {
        const portal = portals[portalIndex];

        // Remove from scene
        if (portal.instance) {
            scene.remove(portal.instance);
        }

        // Remove from tracking array
        portals.splice(portalIndex, 1);
        return true;
    }

    return false;
}

/**
 * Checks if a player/boat has collided with the portal
 * @param {THREE.Vector3} portalPos Position of the portal
 * @param {THREE.Vector3} playerPos Position of the player or boat
 * @param {Number} collisionRadius Optional custom collision radius
 * @returns {Boolean} True if collision detected, false otherwise
 */
function checkPortalCollision(portalPos, playerPos, collisionRadius = PORTAL_COLLISION_RADIUS) {
    if (!portalPos || !playerPos) return false;

    // Calculate distance between player and portal (only on X-Z plane)
    const dx = portalPos.x - playerPos.x;
    const dz = (portalPos.z - 100) - playerPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Return true if within collision radius
    return distance < collisionRadius;
}

/**
 * Handles the player's entry into the portal, including URL generation and redirection
 * @param {Object} playerData The player data including username
 * @param {Object} portal The portal object the player entered
 * @returns {String} The URL that would be navigated to
 */
function handlePortalEntry(playerData, portal) {
    if (!playerData) return null;

    const username = playerData.username || 'anonymous';
    console.log(`Player ${username} entered portal to Vibeverse!`);

    // For our demo, we'll just print info about which portal was entered
    console.log(`Portal entered: ${portal.text} (ID: ${portal.id})`);
    const ref = 'tidefall.io';

    // This would typically create a URL and redirect, but for this example
    // we're just returning what the URL would be
    //const baseUrl = 'https://vibeverse.io/portal';
    //const portalUrl = `${baseUrl}?user=${encodeURIComponent(username)}&portal=${portal.id}`;

    let portalUrl = `${portal.link}?ref=${encodeURIComponent(ref)}`;
    window.location.href = portalUrl;

    //console.log(`Would navigate to: ${portalUrl}`);
    return portalUrl;
}