import * as THREE from 'three';
import { getAuth } from 'firebase/auth';
import { showLoginScreen } from './main';
import { setPlayerStateFromDb, getPlayerStateFromDb, updateBoatReference } from './gameState';
import { setupAllPlayersTracking } from './main';
import { loadGLBModel, unloadGLBModel } from '../utils/glbLoader.js';
import { showDamageEffect } from '../effects/playerDamageEffects.js';
import { resetCameraPosition, reconnectControlsToModel } from '../controls/cameraControls.js';
import { addOtherPlayerToScene, removeOtherPlayerFromScene, updatePlayerInAllPlayers, getOtherPlayers } from '../network/playerManager.js';
//import CannonShot from '../abilities/cannonshot.js'; // Import the CannonShot class

// Global initialization for chat and callbacks
let chatMessageCallback = null;
let recentMessagesCallback = null;
let messageHistory = [];
const DEFAULT_MESSAGE_LIMIT = 50;

// Cannon network communication variables
let cannonHitCallback = null;

// Network configuration
const SERVER_URL = 'http://localhost:5001';
// const SERVER_URL = 'https://boat-game-python.onrender.com';

// Network state
export let socket;
let playerId;
let firebaseDocId = null; // Store Firebase User ID globally in the module
let isConnected = false;
let playerName = "Sailor_" + Math.floor(Math.random() * 1000);
let playerColor;
let playerStats = {
    fishCount: 0,
    monsterKills: 0,
    money: 0
};
let otherPlayers = getOtherPlayers()

// Reference to scene and game objects (to be set from script.js)
let sceneRef;
let playerStateRef;
let boatRef;
let character;
let islandCollidersRef;
let activeIslandsRef;

// Callback for 'all_players' event
let allPlayersCallback = null;

// Respawn Manager - centralized respawn handling
export const respawnManager = {
    // References
    playerState: null,
    boat: null,

    // State
    isRespawning: false,
    respawnCountdown: 0,
    respawnOverlayElement: null,
    countdownInterval: null,

    /**
     * Initialize the respawn manager with references
     */
    initRespawnManager(playerState, boat) {
        this.playerState = playerState;
        this.boat = boat;
        this.isRespawning = false;
        this.respawnCountdown = 0;
    },

    /**
     * Start the respawn countdown and show UI
     */
    startRespawn() {
        // Set respawning state
        this.isRespawning = true;
        this.respawnCountdown = 3; // 3 seconds respawn time

        // Make boat invisible during respawn countdown
        if (this.boat) {
            this.boat.visible = false;
        }

        // Create or show respawn overlay
        if (!this.respawnOverlayElement) {
            this.respawnOverlayElement = document.createElement('div');
            this.respawnOverlayElement.style.position = 'absolute';
            this.respawnOverlayElement.style.top = '0';
            this.respawnOverlayElement.style.left = '0';
            this.respawnOverlayElement.style.width = '100%';
            this.respawnOverlayElement.style.height = '100%';
            this.respawnOverlayElement.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            this.respawnOverlayElement.style.display = 'flex';
            this.respawnOverlayElement.style.justifyContent = 'center';
            this.respawnOverlayElement.style.alignItems = 'center';
            this.respawnOverlayElement.style.fontSize = '32px';
            this.respawnOverlayElement.style.color = 'white';
            this.respawnOverlayElement.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.7)';
            this.respawnOverlayElement.style.zIndex = '1000';
            document.body.appendChild(this.respawnOverlayElement);
        } else {
            this.respawnOverlayElement.style.display = 'flex';
        }

        // Update respawn text
        this.respawnOverlayElement.textContent = `You were defeated! Respawning in ${this.respawnCountdown}...`;

        // Start countdown
        this.countdownInterval = setInterval(() => {
            this.respawnCountdown--;

            if (this.respawnCountdown <= 0) {
                clearInterval(this.countdownInterval);
                this.respawnOverlayElement.style.display = 'none';

                // Trigger the actual respawn
                //this.completeRespawn();
            } else {
                this.respawnOverlayElement.textContent = `You were defeated! Respawning in ${this.respawnCountdown}...`;
            }
        }, 1000);

        // Disable player movement during respawn
        if (this.playerState) {
            this.playerState.isRespawning = true;
        }
    },

    /**
     * Complete the respawn process
     */
    completeRespawn() {
        // Hide respawn overlay if it exists
        if (this.respawnOverlayElement) {
            this.respawnOverlayElement.style.display = 'none';
        }

        // Reset respawning state
        this.isRespawning = false;

        // Get respawn position
        const spawnPosition = this.getRespawnPosition();
        const spawnRotation = 0; // Default rotation

        // Instead of creating a new boat, just teleport and reset the existing one
        if (this.boat) {
            console.log('Teleporting boat to respawn point');

            // Reset position
            this.boat.position.copy(spawnPosition);
            this.boat.rotation.y = spawnRotation;

            // Reset velocity
            //boatVelocity.set(0, 0, 0);

            // Make boat visible again
            this.boat.visible = true;

            // Update server with new position
            updatePlayerPosition();

            console.log('Boat respawned at:', spawnPosition);
        } else {
            console.error('Could not respawn boat: boat reference is null');
        }
    },

    /**
     * Set the respawn position for the player
     */
    getRespawnPosition() {
        // Default to origin if no other logic is available
        return new THREE.Vector3(0, 0, 0);

        // In the future, could implement more complex logic:
        // - Spawn near teammates
        // - Spawn at control points
        // - Spawn away from enemies
    },

    /**
     * Reload a player's GLB model after respawn (for other players)
     * @param {string} playerId - ID of the player to reload
     */
    reloadPlayerGLB(playerId) {
        // Get references to other players

        const otherPlayers = getOtherPlayers();
        const player = otherPlayers.get(playerId);

        if (!player) return;

        // Remove existing model from scene
        if (player.mesh) {
            player.mesh.visible = true;
        }

        /*

        // Get spawn position (or use player's last known position)
        const spawnPosition = this.getRespawnPosition();

        // Use the existing addOtherPlayerToScene function which already works correctly
        // Create a player data object that matches what addOtherPlayerToScene expects
        const playerData = {
            id: playerId,
            name: player.data ? player.data.name : 'Unknown Player',
            position: spawnPosition,
            rotation: 0, // Default rotation
            color: player.data ? player.data.color : null
        };

        // Remove the player first to ensure clean state
        removeOtherPlayerFromScene(playerId);

        // Re-add the player with the working function from playerManager
        addOtherPlayerToScene(playerData);*/
    },
};

// Register a callback for when player list is updated
export function onAllPlayers(callback) {
    allPlayersCallback = callback;

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
    sceneRef = scene;
    playerStateRef = playerState;
    boatRef = boat;
    islandCollidersRef = islandColliders;
    activeIslandsRef = activeIslands;
    playerName = name;
    playerColor = color;

    // Store the Firebase user ID

    // Apply the player's color to their own boat
    //applyColorToBoat(boat, playerColor);

    // Initialize Socket.IO connection
    socket = io(SERVER_URL);

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

        // Update local player information after loading
        updateOtherPlayerInfo(data);

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

    // Listen for player defeated events
    socket.on('player_defeated', (data) => {
        console.log('Player defeated:', data);

        // Check if this is the local player
        if (data.player_id === firebaseDocId) {
            // First, remove the boat from the scene temporarily

            // Start respawn process for local player
            respawnManager.initRespawnManager(playerStateRef, boatRef);
            respawnManager.startRespawn();
        } else {
            // Handle other players' defeats
            const player = otherPlayers.get(data.player_id);
            if (player && player.mesh) {
                player.mesh.visible = false;
            }
        }

        // Show defeat notification (for all players)
        const defeatedPlayer = otherPlayers.get(data.player_id) ||
            (data.player_id === firebaseDocId ? { name: playerName } : { name: 'Unknown Player' });
        const killerPlayer = otherPlayers.get(data.killer_id) ||
            (data.killer_id === firebaseDocId ? { name: playerName } : { name: 'Another Player' });

        // Display defeat message
        if (window.addNotification) {
            window.addNotification(`${defeatedPlayer.name} was defeated by ${killerPlayer.name}!`, 'defeat');
        }
    });

    // Listen for player respawn events
    socket.on('player_respawned', (data) => {
        console.log('Player respawned:', data);

        // Check if this is the local player
        if (data.player_id === firebaseDocId) {
            console.log("firing event for player respawned")
            // End respawn process for local player
            respawnManager.completeRespawn();
        } else {
            console.log("in the respawn else")
            // Reload the player's GLB model
            respawnManager.reloadPlayerGLB(data.player_id);
        }

        // Update player health in player list
        updatePlayerInAllPlayers({
            id: data.player_id,
            health: data.health
        });

        // Display respawn message for local player
        if (data.player_id === firebaseDocId && window.addNotification) {
            window.addNotification('You have respawned!', 'respawn');
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

        // Ensure we have a valid player ID
        // Try to get it from different sources if not available
        if (!playerId && socket && socket.id) {
            // If no player ID but we have a socket ID, use that temporarily

            playerId = socket.id;
        }

        // Create the message object WITHOUT the player_name field
        const messageObj = {
            content: content,
            type: messageType,
            player_id: firebaseDocId
            // Removed player_name field to let server use its cached value
        };
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

/**
 * Start the respawn process for the local player
 */
function startRespawnProcess() {
    // Use the respawn manager instead
    respawnManager.initRespawnManager(sceneRef, playerStateRef, boatRef);
    respawnManager.startRespawn();
}

/**
 * End the respawn process for the local player
 */
function endRespawnProcess() {
    // The respawn manager now handles the complete respawn process
    respawnManager.completeRespawn();

    // Make sure playerState has the updated boat reference
    if (playerStateRef && respawnManager.boat) {
        playerStateRef.boat = respawnManager.boat;
        console.log('Player state updated with new boat reference');
    }
}
