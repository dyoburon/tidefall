// gameState.js - Central store for shared game objects to avoid circular dependencies
import * as THREE from 'three';
import { createBoat } from '../entities/character.js';
import { checkAllIslandCollisions } from '../world/islands.js';

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
export const renderer = new THREE.WebGLRenderer({ antialias: true });
export const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
export const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
export let playerData = {
    name: localStorage.getItem('playerName') || 'Captain',
    color: localStorage.getItem('playerColor') || '#4285f4',
    rgbColor: { r: 0.26, g: 0.52, b: 0.96 } // Default blue
};

export const boatVelocity = new THREE.Vector3(0, 0, 0);
export const boatSpeed = 0.2; // Much slower speed (was 0.03)
export const rotationSpeed = 0.03; // Slower turning (was 0.03)
export const keys = { forward: false, backward: false, left: false, right: false };
export const boat = createBoat(scene);
let time = 0;

// Add this near the top with other exports
export let allPlayers = [];

// Player name and color functions that login.js is trying to import
export function setPlayerName(name) {

    // Initialize playerData if it doesn't exist
    if (!playerData) {
        playerData = {};
    }

    // Update playerData
    playerData.name = name;

    // Save to localStorage for persistence
    localStorage.setItem('playerName', name);

    return name;
}

export function setPlayerColor(color) {

    // Initialize playerData if it doesn't exist
    if (!playerData) {
        playerData = {};
    }

    // If color is already in RGB format (Three.js format)
    if (typeof color === 'object' && 'r' in color && 'g' in color && 'b' in color) {
        playerData.rgbColor = color;

        // Convert to hex for storage
        const hexColor = rgbToHex(color);
        playerData.color = hexColor;
        localStorage.setItem('playerColor', hexColor);
    }
    // If color is in hex format (from HTML color picker)
    else if (typeof color === 'string' && color.startsWith('#')) {
        playerData.color = color;
        playerData.rgbColor = hexToRgb(color);
        localStorage.setItem('playerColor', color);
    }

    // Update boat color if needed
    if (boat && boat.material) {
        boat.material.color.setRGB(
            playerData.rgbColor.r,
            playerData.rgbColor.g,
            playerData.rgbColor.b
        );
    }

    return playerData.color;
}

// Helper functions for color conversion
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
}

function rgbToHex(rgb) {
    const toHex = (c) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function updateTime(deltaTime) {
    time += deltaTime;
}

export function getTime() {
    return time;
}

export function getWindData() {
    // For now, return static data or calculate based on time
    return {
        direction: (Math.sin(getTime() * 0.01) * Math.PI) + Math.PI, // Slowly changing direction
        speed: 5 + Math.sin(getTime() * 0.05) * 3 // Wind speed between 2-8 knots
    };
}

export function getPlayerStateFromDb() {
    return playerData;
}

export function setPlayerStateFromDb(data) {
    playerData = data;
}

// Get current player info
export function getPlayerInfo() {
    return {
        name: playerData?.name || 'Captain',
        color: playerData?.color || '#4285f4',
        rgbColor: playerData?.rgbColor || { r: 0.26, g: 0.52, b: 0.96 }
    };
}

// Update existing updateAllPlayers function to store the players data
export function updateAllPlayers(players) {
    allPlayers = players;
    //
    return allPlayers;
}

// Add this new function to return the stored players
export function getAllPlayers() {
    return allPlayers;
}

// Add these scene management functions
export function addToScene(object) {

    scene.add(object);
    return object;
}

export function removeFromScene(object) {
    if (!object) {

        return false;
    }

    if (object.parent !== scene) {

        return false;
    }


    scene.remove(object);

    // Clean up resources
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
        if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
        } else {
            object.material.dispose();
        }
    }

    return true;
}

// Helper to safely check if an object is in the scene
export function isInScene(object) {
    return object && object.parent === scene;
}