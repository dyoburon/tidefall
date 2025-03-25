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

// Portal state tracking
let portalState = {
    active: false,          // Whether the portal is active in the scene
    activated: false,       // Whether the player has entered the portal
    instance: null,         // Reference to the portal's THREE.Group
};

let portalMesh;
let portalGlow;
let portalPosition = new THREE.Vector3(100, 0, 0);
let triggerCollision = false;

/**
 * Creates an arch-shaped portal mesh with glowing effect
 * @returns {THREE.Group} Portal group containing the main mesh and glow effect
 */
export function createVibeversePortal() {
    // Create a group to hold all portal elements
    const portalGroup = new THREE.Group();

    // Define arch dimensions
    const width = PORTAL_WIDTH;
    const height = PORTAL_HEIGHT;
    const thickness = PORTAL_THICKNESS;

    // Create a simple arch using primitive shapes

    // Left pillar
    const leftPillarGeometry = new THREE.BoxGeometry(thickness, height * 0.7, thickness);
    const portalMaterial = new THREE.MeshStandardMaterial({
        color: PORTAL_COLOR,
        emissive: PORTAL_COLOR,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.8
    });

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

    portalGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    portalGlow.position.set(0, height * 0.35, -0.1); // Slightly behind the main portal

    portalMesh = portalGroup; // Store the entire group as the portal mesh for reference
    applyOutline(portalMesh);
    return portalGroup;
}

/**
 * Places the portal in the world at the specified position
 * @param {THREE.Vector3} position The world position for the portal
 * @param {Object} options Additional options for portal placement
 * @returns {THREE.Group} The placed portal group
 */
export function placePortalInWorld(position, text, options = {}) {
    const portal = createVibeversePortal();

    // Store the position for collision detection
    portalPosition = position.clone();

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
    textPosition.z -= 100

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

    return portal;
}

/**
 * Updates the portal state and checks for player collision
 * @param {THREE.Vector3} playerPosition The player's current position
 * @returns {Boolean} True if portal collision detected
 */
export function updatePortal(playerPosition) {
    console.log("player position ", playerPosition)
    // Skip if portal isn't active
    if (!portalState.active || !portalState.instance) return false;
    console.log("player position 2", playerPosition)


    // Check if player has collided with the portal
    let collision = null;
    if (!triggerCollision) {
        collision = checkPortalCollision(portalPosition, playerPosition);
    }


    console.log("collision ", collision)

    // Handle collision if it's the first time
    if (collision) {
        triggerCollision = true;
        const playerInfo = getPlayerInfo();
        handlePortalEntry(playerInfo);
    }

    return collision;
}

/**
 * Returns the current position of the portal
 * @returns {THREE.Vector3} The portal's position
 */
export function getPortalPosition() {
    return portalPosition;
}

/**
 * Returns the current state of the portal
 * @returns {Object} Portal state object
 */
export function getPortalState() {
    return portalState;
}

/**
 * Initializes the Vibeverse portal in the game world
 * @param {THREE.Vector3} position The position to place the portal
 * @param {Object} options Additional options for portal placement
 * @returns {THREE.Group} The created portal instance
 */
export function initializePortal(position, text, options = {}) {
    // Remove any existing portal instance if it exists and is in the scene
    if (portalState.instance) {
        try {
            scene.remove(portalState.instance);
        } catch (e) {
            console.error("Failed to remove existing portal:", e);
        }
    }

    // Create and place the new portal
    const portal = placePortalInWorld(position, text, options);

    // Update the portal state
    portalState.active = true;
    portalState.activated = false;
    portalState.instance = portal;
    portalPosition = position.clone(); // Update the position

    return portal;
}

/**
 * Sets the activation state of the portal
 * @param {Boolean} status Whether the portal has been activated
 */
export function setPortalActivated(status = true) {
    portalState.activated = status;

    // Additional portal activation logic can be added here
    // such as visual effects or game state changes
    if (status) {
        console.log("Portal activated! Player has entered the Vibeverse.");
    }
}

/**
 * Checks if a player/boat has collided with the portal
 * @param {THREE.Vector3} portalPos Position of the portal
 * @param {THREE.Vector3} playerPos Position of the player or boat
 * @param {Number} collisionRadius Optional custom collision radius
 * @returns {Boolean} True if collision detected, false otherwise
 */
export function checkPortalCollision(portalPos, playerPos, collisionRadius = PORTAL_COLLISION_RADIUS) {
    console.log("test here checkportal")
    // Calculate horizontal distance only (x and z coordinates)
    const dx = (portalPos.x) - playerPos.x;
    const dz = (portalPos.z - 100) - playerPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Collision occurs when distance is less than the collision radius
    return distance < collisionRadius;
}

/**
 * Handles the player's entry into the portal, including URL generation and redirection
 * @param {Object} playerData The player data including username
 * @returns {String} The URL that would be navigated to
 */
export function handlePortalEntry(playerData) {
    console.log("in portal entry ");
    // Get the player's username from game state or use default if not available
    const username = playerData?.name || 'Captain';

    // Construct portal URL with required parameters
    const baseUrl = 'http://portal.pieter.com';
    const ref = 'tidefall.io';

    // Build the URL with query parameters
    let portalUrl = `${baseUrl}?ref=${encodeURIComponent(ref)}`;

    // In a real implementation, we would redirect the user to this URL
    // However, for testing purposes, we'll just return the URL
    console.log(`Portal activated! Redirecting to: ${portalUrl}`);

    // For a real implementation, uncomment the following line:
    window.location.href = portalUrl;

    return portalUrl;
}