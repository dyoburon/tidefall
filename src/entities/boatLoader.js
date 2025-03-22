import * as THREE from 'three';
import { animateSails } from '../animations/sailAnimations';
import { loadGLBModel, resetModelLoadingState } from '../utils/glbLoader';

// Single comprehensive ship definition
export const SHIP_MODELS = {
    'massivepirate': {
        name: 'Large Pirate Ship',
        category: 'Pirate',
        size: 'Large',
        path: '/massivepirate.glb',
        scale: 40.0,
        position: [0, 14, 0],
        rotation: [0, Math.PI, 0],  // Change to 0 rotation (no rotation)
        // Gameplay attributes
        speed: 0.7,         // Slower but powerful
        turnRate: 0.6,      // Slower turning
        damageMultiplier: 1.5, // High damage
        healthMultiplier: 1.6, // High health
        cannonCount: 12,    // More cannons
        cargoCapacity: 300, // Large cargo
        crewCapacity: 30,   // Large crew
        description: 'A powerful pirate galleon with devastating firepower. Slow but deadly in combat.'
    },
    'mediumpirate': {
        name: 'Medium Pirate Ship',
        category: 'Pirate',
        size: 'Medium',
        path: '/mediumpirate.glb',
        scale: 80.0,
        position: [0, 35, 0],
        rotation: [0, Math.PI, 0],  // Change to 0 rotation (no rotation)
        // Gameplay attributes
        speed: 0.9,         // Balanced speed
        turnRate: 0.8,      // Balanced turning
        damageMultiplier: 1.0, // Standard damage
        healthMultiplier: 1.0, // Standard health
        cannonCount: 8,     // Medium cannon count
        cargoCapacity: 200, // Medium cargo
        crewCapacity: 20,   // Medium crew
        description: 'A balanced brigantine with a good mix of speed and firepower. Perfect for versatile captains.'
    },
    'smallpirate': {
        name: 'Small Pirate Ship',
        category: 'Pirate',
        size: 'Small',
        path: '/smallpirate.glb',
        scale: 24.0,
        position: [0, 8, 0],
        rotation: [0, 0, 0],  // Change to 0 rotation (no rotation)
        // Gameplay attributes
        speed: 1.2,         // Fast speed
        turnRate: 1.2,      // Quick turning
        damageMultiplier: 0.7, // Lower damage
        healthMultiplier: 0.8, // Lower health
        cannonCount: 4,     // Fewer cannons
        cargoCapacity: 100, // Small cargo
        crewCapacity: 12,   // Small crew
        description: 'A swift pirate sloop that excels at outrunning enemies. Sacrifices firepower for speed and agility.'
    },
    'massivecolonial': {
        name: 'Large Colonial S hip',
        category: 'Colonial',
        size: 'Large',
        path: '/massivecolonial.glb',
        scale: 40.0,
        position: [0, 14, 0],
        rotation: [0, Math.PI, 0],  // Change to 0 rotation (no rotation)
        // Gameplay attributes
        speed: 0.6,         // Very slow
        turnRate: 0.5,      // Very slow turning
        damageMultiplier: 1.7, // Very high damage
        healthMultiplier: 1.8, // Very high health
        cannonCount: 16,    // Most cannons
        cargoCapacity: 350, // Largest cargo
        crewCapacity: 35,   // Largest crew
        description: 'A massive man-of-war with unmatched firepower. Slow but nearly unstoppable in battle.'
    },
    'mediumcolonial': {
        name: 'Medium Colonial Ship',
        category: 'Colonial',
        size: 'Medium',
        path: '/mediumcolonial.glb',
        scale: 20.0,
        position: [0, 7, 0],
        rotation: [0, 0, 0],  // Change to 0 rotation (no rotation)
        // Gameplay attributes
        speed: 0.85,        // Slightly slower than pirate equivalent
        turnRate: 0.75,     // Slightly slower turning
        damageMultiplier: 1.1, // Slightly higher damage
        healthMultiplier: 1.1, // Slightly higher health
        cannonCount: 10,    // More cannons than pirate equivalent
        cargoCapacity: 220, // More cargo than pirate equivalent
        crewCapacity: 22,   // More crew than pirate equivalent
        description: 'A well-rounded frigate with balanced capabilities. Adaptable to various naval situations.'
    },
    'smallcolonial': {
        name: 'Small Colonial Ship',
        category: 'Colonial',
        size: 'Small',
        path: '/smallcolonial.glb',
        scale: 24.0,
        position: [0, 8, 0],
        rotation: [0, 0, 0],  // Change to 0 rotation (no rotation)
        // Gameplay attributes
        speed: 1.15,        // Fast but not as fast as pirate equivalent
        turnRate: 1.1,      // Quick turning but not as quick as pirate
        damageMultiplier: 0.8, // Slightly higher damage than pirate equivalent
        healthMultiplier: 0.9, // Slightly higher health than pirate equivalent
        cannonCount: 6,     // More cannons than pirate equivalent
        cargoCapacity: 120, // More cargo than pirate equivalent
        crewCapacity: 15,   // More crew than pirate equivalent
        description: 'A nimble cutter built for speed and scouting. Highly maneuverable but lightly armed.'
    }
};

// Default ship if none is selected
export const DEFAULT_SHIP_TYPE = 'mediumpirate';

// Create path lookup for faster resolution
const PATH_TO_SHIP_MAP = {};
for (const [type, ship] of Object.entries(SHIP_MODELS)) {
    // Add all path variations to the map
    const cleanPath = ship.path.replace(/^\.?\//, '');
    PATH_TO_SHIP_MAP[ship.path] = type;
    PATH_TO_SHIP_MAP[`./${cleanPath}`] = type;
    PATH_TO_SHIP_MAP[`/${cleanPath}`] = type;
    PATH_TO_SHIP_MAP[cleanPath] = type;
}

/**
 * Loads a ship model based on the selected type in localStorage
 * @param {THREE.Group} targetGroup - The group to add the loaded model to
 */
export function loadShipModel(targetGroup) {
    // Reset loading state for boat model
    resetModelLoadingState('playerBoat');

    // Get the current ship type and its configuration
    const shipType = getShipType();
    const shipConfig = SHIP_MODELS[shipType];

    // Create configuration for the generic loader
    const config = {
        modelId: 'playerBoat',
        modelUrl: shipConfig.path,
        scaleValue: shipConfig.scale,
        position: shipConfig.position,
        rotation: shipConfig.rotation,
        animationSetup: (model) => {
            // Only set up sail animations if appropriate
            if (model.name.includes('sail')) {
                const sailControls = animateSails(model);
                return sailControls;
            }
            return null;
        },
        fallbackConfig: {
            modelUrl: SHIP_MODELS[DEFAULT_SHIP_TYPE].path,
            scaleValue: SHIP_MODELS[DEFAULT_SHIP_TYPE].scale,
            position: SHIP_MODELS[DEFAULT_SHIP_TYPE].position,
            rotation: SHIP_MODELS[DEFAULT_SHIP_TYPE].rotation
        }
    };

    // Use the generic GLB loader
    loadGLBModel(targetGroup, config);
}

/**
 * Set the current ship type in localStorage
 * @param {string} shipType - The type of ship to set
 */
export function setShipType(shipType) {
    if (SHIP_MODELS[shipType]) {
        localStorage.setItem('selectedShip', shipType);
        localStorage.setItem('playerBoatModel', SHIP_MODELS[shipType].path);
        return true;
    }
    return false;
}

/**
 * Get the current ship type from localStorage
 * @returns {string} The current ship type
 */
export function getShipType() {
    // Try to get the ship type directly
    const savedType = localStorage.getItem('selectedShip');
    if (savedType && SHIP_MODELS[savedType]) {
        return savedType;
    }

    // If not found, try to determine from model path
    const modelPath = localStorage.getItem('playerBoatModel');
    if (modelPath) {
        // Clean up the path to handle variations
        const cleanPath = modelPath.replace(/^\.?\//, ''); // Remove ./ or / prefix

        // Try different variations of the path
        const pathVariations = [
            modelPath,
            `./${cleanPath}`,
            `/${cleanPath}`,
            cleanPath
        ];

        // Check each variation against our mapping
        for (const path of pathVariations) {
            if (PATH_TO_SHIP_MAP[path]) {
                return PATH_TO_SHIP_MAP[path];
            }
        }
    }

    // Return the default if nothing found
    return DEFAULT_SHIP_TYPE;
}

/**
 * Get all available ship types
 * @returns {Array} Array of ship type strings
 */
export function getAvailableShipTypes() {
    return Object.keys(SHIP_MODELS);
}

/**
 * Get all attributes for the current or specified ship
 * @param {string} shipType - Optional ship type, uses current if not specified
 * @returns {Object} Ship data object
 */
export function getShipAttributes(shipType = null) {
    const type = shipType || getShipType();
    return SHIP_MODELS[type] || SHIP_MODELS[DEFAULT_SHIP_TYPE];
}

/**
 * Get a specific attribute of the current ship
 * @param {string} attribute - The attribute to get (e.g., 'speed', 'damageMultiplier')
 * @param {string} shipType - Optional ship type, defaults to current ship
 * @returns {any} The attribute value
 */
export function getShipAttribute(attribute, shipType = null) {
    return getShipAttributes(shipType)[attribute];
}

/**
 * Utility functions for common ship attributes
 */
export function getShipSpeed() {
    return getShipAttribute('speed');
}

export function getShipDamage() {
    return getShipAttribute('damageMultiplier');
}

export function getShipHealth() {
    return getShipAttribute('healthMultiplier');
}

export function getShipTurnRate() {
    return getShipAttribute('turnRate');
}

export function getShipName() {
    return getShipAttribute('name');
}

export function getShipCannonCount() {
    return getShipAttribute('cannonCount');
} 