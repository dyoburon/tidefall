// vibeverse.js - Portal to the Vibeverse
import * as THREE from 'three';
import { scene, addToScene, getPlayerInfo } from '../core/gameState.js';
import { createFloatingText } from '../effects/floatingText.js';
import { applyOutline } from '../theme/outlineStyles';

// Portal properties
const PORTAL_RADIUS = 100;
const PORTAL_HEIGHT = 150; // Height of the arch
const PORTAL_WIDTH = 120;  // Width of the arch
const PORTAL_THICKNESS = 20; // Thickness of the arch border
const PORTAL_SEGMENTS = 32;
const PORTAL_COLOR = 0x00ff66; // Bright green color
const PORTAL_GLOW_COLOR = 0x66ffaa;
const PORTAL_COLLISION_RADIUS = 100; // How close the player needs to be to trigger the portal

// Array to track all portals in the game
const portals = [];

/**
 * Creates an arch-shaped portal mesh with glowing effect
 * @param {Object} options Custom options for the portal
 * @returns {THREE.Group} Portal group containing the main mesh and glow effect
 */
function createVibeversePortal(options = {}) {
    // Create a group to hold all portal elements
    const portalGroup = new THREE.Group();

    // Define arch dimensions
    const width = PORTAL_WIDTH;
    const height = PORTAL_HEIGHT;
    const thickness = PORTAL_THICKNESS;

    // Create a simple arch using primitive shapes

    // Left pillar
    const leftPillarGeometry = new THREE.BoxGeometry(thickness, height * 0.7, thickness);

    // Create material - either textured or solid color
    let portalMaterial;

    if (options.useTexture && options.textureUrl) {
        // Create textured material
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(options.textureUrl);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2); // Much higher repeat values for smaller tiling pattern

        portalMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            color: 0xffffff, // White color to show texture true colors
            emissive: 0x555555, // Slight emissive for better visibility
            emissiveIntensity: 0.4,
            transparent: false,
            opacity: 1.0
        });

        console.log('Loading texture from:', options.textureUrl);
    } else {
        // Create default solid color material
        portalMaterial = new THREE.MeshStandardMaterial({
            color: PORTAL_COLOR,
            emissive: PORTAL_COLOR,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.8
        });
    }

    // Top arch - use half torus
    const archRadius = width / 2;
    const archGeometry = new THREE.TorusGeometry(
        archRadius,      // radius
        thickness / 2,     // tube radius
        16,              // radial segments
        32,              // tubular segments
        Math.PI          // arc angle (half circle)
    );

    const arch = new THREE.Mesh(archGeometry, portalMaterial);
    arch.rotation.x = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(0, height * 0.7, 0);
    portalGroup.add(arch);

    // Add simple glow using a plane with transparent material
    const glowGeometry = new THREE.PlaneGeometry(width - thickness, height * 0.65);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: PORTAL_GLOW_COLOR,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });

    applyOutline(portalGroup);
    return portalGroup;
}

/**
 * Creates a new portal and places it in the world
 * @param {THREE.Vector3} position The world position for the portal
 * @param {String} text The text to display above the portal
 * @param {Object} options Additional options for portal placement
 * @returns {Object} The portal object with its properties and instance
 */
export function createPortal(position, text, url, options = {}) {
    // Check if this is a Metaverse portal (to use the image texture)
    const portalOptions = {};

    if (text === "Metaverse") {
        // Use the provided image as a texture
        // You'll need to provide the path to your image
        portalOptions.useTexture = true;
        portalOptions.textureUrl = './zuck.jpg'; // Replace with your actual image path
    }

    const portal = createVibeversePortal(portalOptions);

    // Set the portal position
    portal.position.copy(position);

    // Set default orientation (vertical)
    portal.rotation.x = -Math.PI / 2; // Make it parallel to the ground

    // Apply any custom rotation if specified
    if (options.rotation) {
        portal.rotation.x += options.rotation.x || 0;
        portal.rotation.y += options.rotation.y || 0;
        portal.rotation.z += options.rotation.z || 0;
    }

    // Add a simple floating text above the portal
    const textPosition = position.clone();
    textPosition.y += 86; // Position above the arch
    textPosition.z -= 100;

    const textObj = createFloatingText({
        text: text,
        position: textPosition,
        color: 0xFFFFFF, // Brighter red
        size: 400, // Larger size
        duration: 100.0, // Longer duration
        disappear: false,
        riseFactor: 0.0, // Slower rise
        fadeOut: false
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