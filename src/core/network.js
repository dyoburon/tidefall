import * as THREE from 'three';
import { getAuth } from 'firebase/auth';
import { showLoginScreen } from './main';
import { setPlayerStateFromDb, getPlayerStateFromDb } from './gameState';
import { setupAllPlayersTracking } from './main';
import { loadGLBModel, unloadGLBModel } from '../utils/glbLoader.js';
import { showDamageEffect } from '../effects/playerDamageEffects.js';
//import CannonShot from '../abilities/cannonshot.js'; // Import the CannonShot class

// Network configuration
const SERVER_URL = 'http://localhost:5001';
//const SERVER_URL = 'https://boat-game-python.onrender.com';

// Network state
export let socket;
let playerId;
let firebaseDocId = null; // Store Firebase User ID globally in the module
let otherPlayers = new Map(); // Map to store other players' meshes
let isConnected = false;
let playerName = "Sailor_" + Math.floor(Math.random() * 1000);
let playerColor;
let playerStats = {
    fishCount: 0,
    monsterKills: 0,
    money: 0
};

// Chat system variables
let chatMessageCallback = null;
let recentMessagesCallback = null;
let messageHistory = [];
const DEFAULT_MESSAGE_LIMIT = 50;

// Cannon network communication variables
let cannonHitCallback = null;

// Reference to scene and game objects (to be set from script.js)
let sceneRef;
let playerStateRef;
let boatRef;
let character;
let islandCollidersRef;
let activeIslandsRef;

// Callback for 'all_players' event
let allPlayersCallback = null;

// Register a callback for when player list is updated
export function onAllPlayers(callback) {
    allPlayersCallback = callback;

    // Register the socket listener if it doesn't exist


    if (socket) {

        socket.on('all_players', (players) => {


            // Add player stats if available
            players.forEach(player => {
                // Try to get stored stats for this player from cache
                if (otherPlayers.has(player.id)) {
                    const storedPlayer = otherPlayers.get(player.id);
                    if (storedPlayer.data && storedPlayer.data.stats) {
                        player.stats = storedPlayer.data.stats;
                    }
                }
            });

            // Call the registered callback
            if (allPlayersCallback) {
                allPlayersCallback(players);
            }
        });
    }
}

// Request the player list from the server
export function getAllPlayers() {
    if (isConnected && socket) {

        socket.emit('get_all_players');
        return true;
    }
    return false;
}

// Export a getter for the player name
export function getPlayerName() {

    return playerName;
}

// Initialize the network connection
export async function initializeNetwork(
    scene,
    playerState,
    boat,
    islandColliders,
    activeIslands,
    name,
    color,
    userId = null // Firebase UID
) {


    // Store references to game objects
    sceneRef = scene;
    playerStateRef = playerState;
    boatRef = boat;
    islandCollidersRef = islandColliders;
    activeIslandsRef = activeIslands;
    playerName = name;
    playerColor = color;

    // Store the Firebase user ID




    // Apply the player's color to their own boat
    applyColorToBoat(boat, playerColor);

    // Initialize Socket.IO connection
    socket = io(SERVER_URL);

    // Add this line to make socket globally available
    window.socket = socket;  // Make socket available on window for other components

    // Set up event handlers
    setupSocketEvents();

    // Get the Firebase auth token if using Firebase
    let firebaseToken = null;
    if (userId) {
        try {
            const auth = getAuth();
            firebaseToken = await auth.currentUser.getIdToken();

        } catch (error) {

        }
    }



    // Once connected, we'll send the player_join event
    socket.on('connect', () => {

        isConnected = true;

        // CRUCIAL FIX: Get the current Firebase UID value at connection time
        // This ensures we're using the most up-to-date value


        // Send player data with the token to authenticate
        socket.emit('player_join', {
            name: playerName,
            color: playerColor,
            position: boatRef.position,
            rotation: boatRef.rotation.y,
            mode: playerStateRef.mode,
            player_id: userId,      // Use module-scoped variable
            firebaseToken: firebaseToken   // Use module-scoped variable
        });
    });

    firebaseDocId = "firebase_" + userId;
}

// Helper function to apply color to a boat
function applyColorToBoat(boatMesh, color) {
    // Initialize texture if needed (first time function is called)
    if (!window.boatTextureCache) {
        createBoatTextures();
    }

    // Find the hull in the boat group
    boatMesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry) {
            // Only change color if it's NOT flagged as not player colorable
            if (child.material && !child.userData.isNotPlayerColorable) {
                // Create a new material with the player's color and texture
                const newMaterial = new THREE.MeshPhongMaterial({
                    color: new THREE.Color(color.r, color.g, color.b),
                    map: window.boatTextureCache.imperfectionMap,
                    bumpMap: window.boatTextureCache.bumpMap,
                    bumpScale: 0.02,
                    shininess: 40, // Slightly glossy finish
                    specular: new THREE.Color(0x333333) // Subtle specular highlights
                });

                child.material = newMaterial;
            }
        }
    });
}

// Create textures for boat materials (called once)
function createBoatTextures() {
    // Create cache object for textures
    window.boatTextureCache = {};

    // Create a canvas for the imperfection texture
    const impCanvas = document.createElement('canvas');
    impCanvas.width = 512;
    impCanvas.height = 512;
    const impCtx = impCanvas.getContext('2d');

    // Fill with nearly transparent white (allows color to show through)
    impCtx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    impCtx.fillRect(0, 0, impCanvas.width, impCanvas.height);

    // Add subtle scratches and imperfections
    impCtx.strokeStyle = 'rgba(0, 0, 0, 0.1)';

    // Add random scratches
    for (let i = 0; i < 30; i++) {
        impCtx.lineWidth = 0.5 + Math.random() * 1.5;
        impCtx.beginPath();
        const x1 = Math.random() * impCanvas.width;
        const y1 = Math.random() * impCanvas.height;
        const length = 10 + Math.random() * 40;
        const angle = Math.random() * Math.PI * 2;
        impCtx.moveTo(x1, y1);
        impCtx.lineTo(
            x1 + Math.cos(angle) * length,
            y1 + Math.sin(angle) * length
        );
        impCtx.stroke();
    }

    // Add some subtle noise/grain
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * impCanvas.width;
        const y = Math.random() * impCanvas.height;
        const size = 1 + Math.random() * 2;
        impCtx.fillStyle = `rgba(0, 0, 0, ${0.03 + Math.random() * 0.05})`;
        impCtx.fillRect(x, y, size, size);
    }

    // Create the imperfection texture
    const imperfectionMap = new THREE.CanvasTexture(impCanvas);
    imperfectionMap.wrapS = THREE.RepeatWrapping;
    imperfectionMap.wrapT = THREE.RepeatWrapping;
    window.boatTextureCache.imperfectionMap = imperfectionMap;

    // Create bump map for surface detail
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = 512;
    bumpCanvas.height = 512;
    const bumpCtx = bumpCanvas.getContext('2d');

    // Fill with middle gray (neutral bump)
    bumpCtx.fillStyle = 'rgb(128, 128, 128)';
    bumpCtx.fillRect(0, 0, bumpCanvas.width, bumpCanvas.height);

    // Add wood-like grain for bump
    for (let i = 0; i < 15; i++) {
        const y = i * (bumpCanvas.height / 15) + (Math.random() * 10 - 5);
        bumpCtx.strokeStyle = `rgb(${100 + Math.random() * 30}, ${100 + Math.random() * 30}, ${100 + Math.random() * 30})`;
        bumpCtx.lineWidth = 2 + Math.random() * 3;

        bumpCtx.beginPath();
        bumpCtx.moveTo(0, y);

        const segments = 8;
        const xStep = bumpCanvas.width / segments;

        for (let j = 1; j <= segments; j++) {
            const x = j * xStep;
            const yOffset = (Math.random() - 0.5) * 15;
            bumpCtx.lineTo(x, y + yOffset);
        }

        bumpCtx.stroke();
    }

    // Create the bump texture
    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    window.boatTextureCache.bumpMap = bumpMap;
}

// Set up Socket.IO event handlers
function setupSocketEvents() {
    // Skip connect handler as we'll handle it in initializeNetwork

    socket.on('disconnect', () => {

        isConnected = false;

        // Clean up other players
        otherPlayers.forEach((player, id) => {
            removeOtherPlayerFromScene(id);
        });
    });

    socket.on('connection_response', (data) => {


        // Important: The server will now send back the Firebase UID as the player ID
        // if authentication was successful
        playerId = data.id;

        // This may be different from the socket ID now - it could be the Firebase UID

        if (!data.name) {
            showLoginScreen();
        }


        setPlayerStateFromDb(data);

        setupAllPlayersTracking();


        // Example usage in game code


        getPlayerInventory((inventory) => {

            if (inventory) {



                // Check if player has a specific item
                if (playerHasItem(inventory, 'fish', 'Rare Tuna')) {

                }
            }
        });


        // IMPORTANT FIX: Update the playerName variable with the server-stored name
        // This ensures clan tags are maintained after page reload
        if (data.name) {

            playerName = data.name; // Update the local variable directly with server data
        }

        // Register islands
        registerIslands();

        // Initialize player stats from server
        initializePlayerStats();

        // Request all current players (as a backup in case the automatic all_players event wasn't received)
        socket.emit('get_all_players');

        // Request initial chat messages
        // requestInitialMessages();
    });

    // Handle receiving all current players
    socket.on('all_players', (players) => {


        // Add each player to the scene (except ourselves)
        players.forEach(playerData => {
            if (playerData.id !== playerId) {
                addOtherPlayerToScene(playerData);
            }
        });
    });

    // Player events
    socket.on('player_joined', (data) => {

        if (data.id !== playerId) {
            addOtherPlayerToScene(data);
        }
    });

    socket.on('player_moved', (data) => {
        if (data.id !== playerId) {
            updateOtherPlayerPosition(data);
        }
    });

    socket.on('player_updated', (data) => {
        if (data.id !== playerId) {
            updateOtherPlayerInfo(data);
        }
    });

    socket.on('player_disconnected', (data) => {

        removeOtherPlayerFromScene(data.id);
    });

    // Island events
    socket.on('island_registered', (data) => {
        // This could be used to sync islands across clients

    });

    // Leaderboard events
    socket.on('leaderboard_update', (data) => {


        // Update the UI with new leaderboard data
        if (typeof updateLeaderboardData === 'function') {
            updateLeaderboardData(data);
        } else {

        }
    });

    // Add this handler to process the player stats response
    socket.on('player_stats', (data) => {


        // Update local player stats
        if (data.fishCount !== undefined) {
            playerStats.fishCount = data.fishCount;
        }
        if (data.monsterKills !== undefined) {
            playerStats.monsterKills = data.monsterKills;
        }
        if (data.money !== undefined) {
            playerStats.money = data.money;
        }

        // Update UI if gameUI exists
        if (window.gameUI && typeof window.gameUI.updatePlayerStats === 'function') {
            window.gameUI.updatePlayerStats();
        }
    });

    // Chat events
    socket.on('new_message', (data) => {



        // Handle string messages (backwards compatibility)
        if (typeof data === 'string') {

            data = {
                content: data,
                timestamp: Date.now(),
                sender_name: 'Unknown Sailor'
            };
        } else if (data && typeof data === 'object') {


            // Check if data has required fields
            if (!data.content) {

            }

            if (!data.sender_name) {


                // If this is our own message and it's missing the sender name
                if (data.player_id === firebaseDocId) {

                    data.sender_name = playerName;
                }
                // If it's from another player, try to get their name from our local cache
                else if (data.player_id && otherPlayers.has(data.player_id)) {
                    const otherPlayer = otherPlayers.get(data.player_id);
                    if (otherPlayer && otherPlayer.data.name) {
                        data.sender_name = otherPlayer.data.name;

                    } else {
                        data.sender_name = 'Unknown Sailor';

                    }
                }
                // Last resort - use default name
                else {
                    data.sender_name = 'Unknown Sailor';

                }
            } else {

            }
        } else {

            return; // Skip processing invalid data
        }

        // Ensure timestamp exists
        if (!data.timestamp) {
            data.timestamp = Date.now();
        }



        // Add to message history
        messageHistory.push(data);

        // Trim history if it gets too long (keep last 100 messages in memory)
        if (messageHistory.length > 100) {
            messageHistory = messageHistory.slice(-100);
        }

        // Notify UI if callback is registered
        if (chatMessageCallback) {

            chatMessageCallback(data);
        } else {

        }
    });

    socket.on('recent_messages', (data) => {


        // Replace message history with recent messages (sorted chronologically)
        messageHistory = data.messages.sort((a, b) => a.timestamp - b.timestamp);

        // Notify UI if callback is registered
        if (recentMessagesCallback) {
            recentMessagesCallback(messageHistory);
        }
    });

    // Cannon event handlers
    socket.on('cannon_fired', (data) => {

        // When another player fires a cannon, this event is received
        // Data contains: {id, position, direction, cannonShotData}
        handleCannonFired(data);
    });

    socket.on('cannon_hit', (data) => {
        console.log("we are in cannon hit from server")
        // When this player is hit by a cannon, this event is received
        // Data contains: {id, damage, hitPosition}

        // Use the centralized damage visualization system
        if (boatRef) {
            showDamageEffect(boatRef, data.damage, 'cannon');
        }

        // Still call the original callback if registered
        if (cannonHitCallback) {
            cannonHitCallback(data);
        }
    });

    // Also handle server-side determined cannon hits
    socket.on('server_cannon_hit', (data) => {
        console.log("we are in cannon hit from server")

        // Server-side hit detection event
        // Data contains: {shooter_id, hit_player_id, damage, hit_position}

        // Only show damage effects if we're the player who was hit
        // Show damage effect if we're the player who was hit
        if (data.hit_player_id === playerId && boatRef) {
            showDamageEffect(boatRef, data.damage, 'cannon');
        }

        // Show damage effect on other players when they're hit
        // This allows the shooter to see the hit effect on their target
        if (data.hit_player_id !== playerId && otherPlayers.has(data.hit_player_id)) {
            const hitPlayer = otherPlayers.get(data.hit_player_id);
            if (hitPlayer && hitPlayer.mesh) {
                showDamageEffect(hitPlayer.mesh, data.damage, 'cannon');
            }
        }

        // Call the callback if registered
        if (cannonHitCallback) {
            cannonHitCallback(data);
        }
    });
};

// Send player position update to the server
export function updatePlayerPosition() {
    if (!isConnected || !socket || !playerId) return;

    // Get the active object (boat or character)
    const activeObject = playerStateRef.mode === 'boat' ? boatRef : character;

    socket.emit('update_position', {
        x: activeObject.position.x,
        y: activeObject.position.y,
        z: activeObject.position.z,
        rotation: activeObject.rotation.y,
        mode: playerStateRef.mode,
        player_id: firebaseDocId
    });
}

// Set the player's name
export function setPlayerName(name) {



    // Safety check - don't allow empty names
    if (!name || name.trim() === '') {

        return;
    }

    playerName = name;


    if (isConnected && socket) {

        socket.emit('update_player_name', { name: playerName, player_id: firebaseDocId });
    } else {

    }
}

export function setPlayerColor(color) {
    playerColor = color;

    if (isConnected && socket) {
        socket.emit('update_player_color', { color: playerColor, player_id: firebaseDocId });
    }
}

// Register islands with the server
function registerIslands() {
    if (!isConnected || !socket) return;

    // Register each island with the server
    islandCollidersRef.forEach(collider => {
        socket.emit('register_island', {
            id: collider.id,
            x: collider.center.x,
            y: collider.center.y,
            z: collider.center.z,
            radius: collider.radius,
            type: activeIslandsRef.get(collider.id)?.type || 'default',
            player_id: firebaseDocId
        });
    });
}

// Add another player to the scene
function addOtherPlayerToScene(playerData) {
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
        sceneRef.add(playerGroup);

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

function updateOtherPlayerPosition(playerData) {
    const player = otherPlayers.get(playerData.id);
    if (!player) {
        // Add the player if they don't exist yet
        addOtherPlayerToScene(playerData);
        return;
    }

    // Check if mode has changed
    if (player.data.mode !== playerData.mode) {
        // Remove old mesh and create a new one with the correct mode
        removeOtherPlayerFromScene(playerData.id);
        addOtherPlayerToScene(playerData);
        return;
    }

    // Make sure the mesh exists and is loaded before updating position
    if (!player.loaded || !player.mesh) {
        // Update the data even if we can't update the position yet
        player.data = {
            ...player.data,
            position: playerData.position,
            rotation: playerData.rotation,
            mode: playerData.mode
        };
        return;
    }

    // Update position and rotation
    player.mesh.position.set(
        playerData.position.x,
        playerData.position.y,
        playerData.position.z
    );
    player.mesh.rotation.y = playerData.rotation;

    // Force update the matrix world to ensure all children update
    player.mesh.updateMatrixWorld(true);

    // Check if the player has any LOD objects that need updating
    player.mesh.traverse((child) => {
        if (child instanceof THREE.LOD && window.camera) {
            // Reset the LOD's position to avoid conflicts with parent group
            child.position.set(0, 0, 0);
            // Update the LOD with the current camera
            child.update(window.camera);
        }
    });

    // Update stored data
    player.data = {
        ...player.data,
        position: playerData.position,
        rotation: playerData.rotation,
        mode: playerData.mode
    };

    // IMPORTANT ADDITION: Update player in the allPlayers array in gameState
    updatePlayerInAllPlayers(playerData);
}

// Update another player's information (like name)
function updateOtherPlayerInfo(playerData) {
    const player = otherPlayers.get(playerData.id);
    if (!player) return;

    // Update name if provided
    if (playerData.name && player.data.name !== playerData.name) {
        player.data.name = playerData.name;

        // Update name sprite
        const nameCanvas = document.createElement('canvas');
        const nameContext = nameCanvas.getContext('2d');
        nameCanvas.width = 256;
        nameCanvas.height = 64;
        nameContext.font = '24px Arial';
        nameContext.fillStyle = 'white';
        nameContext.textAlign = 'center';
        nameContext.fillText(playerData.name, 128, 32);

        const nameTexture = new THREE.CanvasTexture(nameCanvas);
        player.nameSprite.material.map = nameTexture;
        player.nameSprite.material.needsUpdate = true;
    }

    // Update color if provided
    if (playerData.color && player.data.mode === 'boat') {
        player.data.color = playerData.color;

        // Find the hull in the boat group and update its color
        player.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry) {
                // This is likely the hull
                if (child.material) {
                    child.material.color.setRGB(
                        playerData.color.r,
                        playerData.color.g,
                        playerData.color.b
                    );
                    child.material.needsUpdate = true;
                }
            }
        });
    }
}

// Remove another player from the scene
function removeOtherPlayerFromScene(playerId) {
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
    sceneRef.remove(player.mesh);

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

// Disconnect from the server
export function disconnect() {
    if (socket) {
        socket.disconnect();
    }
}

// Get the number of connected players
export function getConnectedPlayersCount() {
    return otherPlayers.size + 1; // +1 for the local player
}

// Check if connected to the server
export function isNetworkConnected() {
    return isConnected;
}

// Request leaderboard data from the server
export function requestLeaderboard() {
    if (!isConnected || !socket) return;


    socket.emit('get_leaderboard', { player_id: firebaseDocId });
}

// Update player stats
export function updatePlayerStats(stats) {
    if (!isConnected || !socket) return;

    // Update local stats
    if (stats.fishCount !== undefined) {
        playerStats.fishCount = stats.fishCount;
    }
    if (stats.monsterKills !== undefined) {
        playerStats.monsterKills = stats.monsterKills;
    }
    if (stats.money !== undefined) {
        playerStats.money = stats.money;
    }

    // Send update to server

    socket.emit('player_action', {
        action: 'update_stats',
        stats: stats,
        player_id: firebaseDocId
    });

    // Update UI if gameUI exists
    if (window.gameUI && typeof window.gameUI.updatePlayerStats === 'function') {
        window.gameUI.updatePlayerStats();
    }
}

// Increment player stats (more convenient for individual updates)
export function incrementPlayerStats(stats) {
    if (!isConnected || !socket) return;

    // Update local stats
    if (stats.fishCount) {
        playerStats.fishCount += stats.fishCount;
    }
    if (stats.monsterKills) {
        playerStats.monsterKills += stats.monsterKills;
    }
    if (stats.money) {
        playerStats.money += stats.money;
    }

    updatePlayerStats(playerStats);

    // Send the complete updated stats to server

    socket.emit('player_action', {
        action: 'update_stats',
        stats: playerStats,
        player_id: firebaseDocId
    });

    // Update UI if gameUI exists
    if (window.gameUI && typeof window.gameUI.updatePlayerStats === 'function') {
        window.gameUI.updatePlayerStats();
    }
}

// Get current player stats
export function getPlayerStats() {
    return { ...playerStats };
}

// Call this when a player catches a fish
export function onFishCaught(value = 1) {
    if (!isConnected || !socket) return;

    // Update local stats
    playerStats.fishCount += value;



    // Send the fish caught action to server
    socket.emit('player_action', {
        action: 'fish_caught',
        value: value,
        player_id: firebaseDocId
    });

    // Update UI
    if (window.gameUI && typeof window.gameUI.updatePlayerStats === 'function') {
        window.gameUI.updatePlayerStats();
    }
}

// Call this when a player kills a monster
export function onMonsterKilled(value = 1) {
    if (!isConnected || !socket) return;

    // Update local stats
    playerStats.monsterKills += value;



    // Send the monster killed action to server
    socket.emit('player_action', {
        action: 'monster_killed',
        value: value,
        player_id: firebaseDocId
    });

    // Update UI
    if (window.gameUI && typeof window.gameUI.updatePlayerStats === 'function') {
        window.gameUI.updatePlayerStats();
    }
}

// Call this when a player earns money
export function onMoneyEarned(value) {
    if (!isConnected || !socket) return;

    // Update local stats
    playerStats.money += value;



    // Send the money earned action to server
    socket.emit('player_action', {
        action: 'money_earned',
        value: value,
        player_id: firebaseDocId
    });

    // Update UI
    if (window.gameUI && typeof window.gameUI.updatePlayerStats === 'function') {
        window.gameUI.updatePlayerStats();
    }
}

// Add this new function to initialize player stats
function initializePlayerStats() {
    if (!isConnected || !socket || !playerId) return;



    // Request player stats from server
    socket.emit('get_player_stats', { id: playerId, player_id: firebaseDocId });
}

// Send a chat message
export function sendChatMessage(content, messageType = 'global') {
    try {
        // First check for socket connection
        if (!isConnected || !socket) {

            return false;
        }

        // Log current state






        // Ensure we have a valid player ID
        // Try to get it from different sources if not available
        if (!playerId && socket && socket.id) {
            // If no player ID but we have a socket ID, use that temporarily

            playerId = socket.id;
        }

        // Make sure firebaseDocId is properly set
        if (!firebaseDocId && playerId) {
            // If we have playerId but no firebaseDocId, set it

            firebaseDocId = playerId.startsWith('firebase_') ?
                playerId : 'firebase_' + playerId;
        } else if (!firebaseDocId) {
            // Last resort - create a temporary ID

            const tempId = 'firebase_temp_' + Math.floor(Math.random() * 10000);
            firebaseDocId = tempId;
            playerId = tempId.replace('firebase_', '');
        }

        // Ensure the firebaseDocId is correctly formatted
        if (!firebaseDocId.startsWith('firebase_')) {
            firebaseDocId = 'firebase_' + firebaseDocId;

        }

        // IMPORTANT: DON'T send a player_name field at all
        // Let the server use what it has in its cache
        // This ensures consistency between nick changes and chat



        // Create the message object WITHOUT the player_name field
        const messageObj = {
            content: content,
            type: messageType,
            player_id: firebaseDocId
            // Removed player_name field to let server use its cached value
        };

        // Log the complete message object being sent


        // Now send the message
        socket.emit('send_message', messageObj);



        return true;
    } catch (error) {

        return false;
    }
}

// Request recent messages from the server
export function getRecentMessages(messageType = 'global', limit = DEFAULT_MESSAGE_LIMIT) {
    if (!isConnected || !socket) return false;



    socket.emit('get_recent_messages', {
        type: messageType,
        limit: limit,
        player_id: firebaseDocId
    });

    return true;
}

// Register a callback function to be called when a new message is received
export function onChatMessage(callback) {
    chatMessageCallback = callback;
}

// Register a callback function to be called when recent messages are received
export function onRecentMessages(callback) {
    recentMessagesCallback = callback;
}

// Get message history from memory
export function getChatHistory() {
    return [...messageHistory]; // Return a copy to prevent external modification
}

// Request initial messages when connecting
function requestInitialMessages() {
    getRecentMessages('global', DEFAULT_MESSAGE_LIMIT);
}

// Add a getter for other modules that might need the ID
export function getFirebaseUserId() {
    return firebaseDocId;
}

// Add fish or other items to the player's inventory
export function addToInventory(itemData) {
    if (!isConnected || !socket) return;



    // Send the inventory update to server
    socket.emit('add_to_inventory', {
        player_id: firebaseDocId,
        item_type: itemData.item_type,
        item_name: itemData.item_name,
        item_data: itemData.item_data
    });
}

// Get player inventory from the server using Socket.IO instead of fetch
export function getPlayerInventory(callback) {
    if (!isConnected || !socket || !firebaseDocId) {

        if (callback) callback(null);
        return false;
    }





    socket.off('inventory_data');


    // Set up handler for inventory data response
    socket.on('inventory_data', (inventoryData) => {

        if (callback) callback(inventoryData);
    });

    // Request inventory data via Socket.IO
    socket.emit('get_inventory', {
        player_id: firebaseDocId
    });

    return true;
}

// Helper function to check if player has a specific item
export function playerHasItem(inventoryData, itemType, itemName) {
    if (!inventoryData) return false;

    const itemCollection = inventoryData[itemType];
    if (!itemCollection || !Array.isArray(itemCollection)) return false;

    return itemCollection.some(item => item.name === itemName);
}

// Fire a cannon from the player's position
export function fireCannon(position, direction) {
    if (!isConnected || !socket || !playerId) return;

    socket.emit('cannon_fire', {
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
        player_id: firebaseDocId
    });
}

// Register a callback function to be called when the player is hit by a cannon
export function onCannonHit(callback) {
    cannonHitCallback = callback;
}

// Add this helper function to update a player's data in the allPlayers array
function updatePlayerInAllPlayers(playerData) {
    // Import the functions we need from gameState
    const { getAllPlayers, updateAllPlayers } = require('./gameState');

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

// Add this new function to handle cannon fired events from other players
function handleCannonFired(data) {
    import('../abilities/cannonshot.js').then(module => {
        const CannonShot = module.default;


        // Extract data from the event
        const { id, cannon_id, position, direction, cannon_position_name } = data;

        // Only process cannon fire from other players to avoid duplicate visualizations
        if (id !== firebaseDocId) {

            // Retrieve the firing player's boat mesh from otherPlayers Map
            let playerBoat = null;
            if (otherPlayers.has(id)) {
                playerBoat = otherPlayers.get(id).mesh;
            } else {

                // If we can't find the boat, we'll still create the cannonball but without boat reference
            }

            // If CannonShot has a static method for creating remote cannonballs, call it
            // The actual implementation of this method will be in Step 3
            if (typeof CannonShot.createRemoteCannonball === 'function') {
                CannonShot.createRemoteCannonball(
                    new THREE.Vector3(position.x, position.y, position.z),
                    new THREE.Vector3(direction.x, direction.y, direction.z),
                    cannon_id,
                    playerBoat,
                    cannon_position_name
                );
            } else {
                // Fallback to existing event system if static method not yet implemented

            }
        }
    }).catch(error => {

    });


}