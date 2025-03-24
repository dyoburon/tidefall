import * as THREE from 'three';
import { loadGLBModel, unloadGLBModel } from '../utils/glbLoader.js';
import { scene } from '../core/gameState.js';

let otherPlayers = new Map(); // Map to store other players' meshes

export function addOtherPlayerToScene(playerData) {
    let otherPlayers = getOtherPlayers()
    // Skip if this player is already in the scene
    if (otherPlayers.has(playerData.id)) {
        // If the player exists but position is different, update it
        const existingPlayer = otherPlayers.get(playerData.id);
        if (existingPlayer && existingPlayer.mesh) {
            // Update position if needed
            updateOtherPlayerPosition(playerData);
        }
        return;
    }

    // Create a group for the other player
    const playerGroup = new THREE.Group();

    // Create a unique model ID for this player
    const modelId = `player_${playerData.id}`;

    // Keep track of the player with a temporary placeholder
    // but don't add to scene yet, wait for model loading
    otherPlayers.set(playerData.id, {
        mesh: playerGroup,
        data: playerData,
        nameSprite: null,
        loaded: false,
        modelId: modelId
    });

    // Configuration for the Medium Pirate model
    const modelConfig = {
        modelId: modelId,
        modelUrl: '/mediumpirate.glb',  // Path to Medium Pirate GLB
        scaleValue: 20.0,               // Scale from boatLoader.js
        position: [0, 7, 0],            // Position from boatLoader.js
        rotation: [0, Math.PI, 0]       // Rotation from boatLoader.js
    };

    // Load the model and wait for completion before adding to scene
    loadGLBModel(playerGroup, modelConfig, (success) => {
        if (!success) {

            // Still continue with adding a basic representation
        }

        // Only proceed if this player hasn't been removed during loading
        if (!otherPlayers.has(playerData.id)) {
            return;
        }

        // Add player name label
        const nameCanvas = document.createElement('canvas');
        const nameContext = nameCanvas.getContext('2d');
        nameCanvas.width = 256;
        nameCanvas.height = 64;
        nameContext.font = '24px Arial';
        nameContext.fillStyle = 'white';
        nameContext.textAlign = 'center';
        nameContext.fillText(playerData.name, 128, 32);

        const nameTexture = new THREE.CanvasTexture(nameCanvas);
        const nameMaterial = new THREE.SpriteMaterial({ map: nameTexture });
        const nameSprite = new THREE.Sprite(nameMaterial);
        nameSprite.position.y = 20;  // Adjusted higher to appear above the model
        nameSprite.scale.set(50, 12.5, 1);
        playerGroup.add(nameSprite);

        // Add a vertical, thin light that follows the player (adjusted for new model)
        const lightHeight = 10000; // Adjust the height of the light
        const lightGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, lightHeight, 0)
        ]);

        const lightColor = playerData.color ?
            new THREE.Color(playerData.color.r, playerData.color.g, playerData.color.b) :
            new THREE.Color(0xffff00); // Default to bright yellow if no color is provided
        const lightMaterial = new THREE.LineBasicMaterial({
            color: lightColor,
            linewidth: 1 // Adjust the width of the line
        });
        const lightLine = new THREE.Line(lightGeometry, lightMaterial);
        lightLine.position.y = 7; // Adjusted for the pirate model height
        playerGroup.add(lightLine);

        // Add a point light for additional visibility
        const pointLight = new THREE.PointLight(0xffffff, 0.5, 10); // Adjust intensity and distance as needed
        pointLight.position.y = 7; // Adjusted for the pirate model height
        playerGroup.add(pointLight);

        // Position the player - IMPORTANT: Set position after model is loaded
        playerGroup.position.set(
            playerData.position.x,
            playerData.position.y,
            playerData.position.z
        );
        playerGroup.rotation.y = playerData.rotation;

        // Add to scene - do this only after model is loaded
        scene.add(playerGroup);

        // Update the stored data with the completed mesh and mark as loaded
        otherPlayers.set(playerData.id, {
            mesh: playerGroup,
            data: playerData,
            nameSprite: nameSprite,
            loaded: true,
            modelId: modelId
        });
    });
}

export function updatePlayerInAllPlayers(playerData) {
    // Import the functions we need from gameState
    const { getAllPlayers, updateAllPlayers } = require('../core/gameState');

    // Get the current allPlayers array
    const allPlayers = getAllPlayers();

    if (!allPlayers || !Array.isArray(allPlayers)) {

        return;
    }

    // Find and update the player in the array
    const updatedPlayers = allPlayers.map(player => {
        if (player.id === playerData.id) {
            // Update this player's data with the new position
            return {
                ...player,
                position: playerData.position,
                rotation: playerData.rotation,
                mode: playerData.mode
            };
        }
        return player;
    });

    // Update the allPlayers array in gameState
    updateAllPlayers(updatedPlayers);

}

export function removeOtherPlayerFromScene(playerId) {
    let otherPlayers = getOtherPlayers()
    const player = otherPlayers.get(playerId);
    if (!player) return;

    // First, properly unload the GLB model
    if (player.modelId) {
        // Unload the model resources
        unloadGLBModel(player.modelId, player.mesh);
    } else {
        // If we don't have a modelId stored, generate one based on player ID
        const modelId = `player_${playerId}`;
        unloadGLBModel(modelId, player.mesh);
    }

    // Remove from scene
    scene.remove(player.mesh);

    // Dispose of the nameSprite texture if it exists
    if (player.nameSprite && player.nameSprite.material && player.nameSprite.material.map) {
        player.nameSprite.material.map.dispose();
        player.nameSprite.material.dispose();
    }

    // Remove from map
    otherPlayers.delete(playerId);

    // Also update the allPlayers array to ensure consistency
    updatePlayerInAllPlayers({
        id: playerId,
        removed: true
    });
}

/**
 * Check if the player is currently respawning
 * @returns {boolean} True if player is respawning
 */
export function isPlayerRespawning() {
    return isRespawning;
}

export function getOtherPlayers() {
    return otherPlayers;
}
