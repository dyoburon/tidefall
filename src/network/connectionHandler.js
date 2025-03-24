import { showLoginScreen } from '../core/main';
import { setPlayerStateFromDb, getPlayerStateFromDb } from '../core/gameState';
import { setupAllPlayersTracking } from '../core/main';

let firebaseDocId = null; // Store Firebase User ID globally in the module


export function setFirebaseDocId() {
    return firebaseDocId;
}

export function getFirebaseDocId(docid) {
    firebaseDocId = docid;
}

export function setupSocketEvents() {
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

    // Listen for player defeated events
    socket.on('player_defeated', (data) => {
        console.log('Player defeated:', data);

        // Check if this is the local player
        if (data.player_id === firebaseDocId) {
            // First, remove the boat from the scene temporarily
            if (boatRef) {
                // Store current model ID for later restoration
                const currentModelId = boatRef.userData.modelId || `player_${firebaseDocId}`;
                boatRef.userData.storedModelId = currentModelId;

                // Remove the boat from the scene but don't destroy it
                sceneRef.remove(boatRef);
            }

            // Start respawn process for local player
            startRespawnProcess();
        } else {
            // Handle other players' defeats
            const player = otherPlayers.get(data.player_id);
            if (player && player.mesh) {
                // Temporarily remove the player's mesh from the scene
                if (sceneRef.getObjectById(player.mesh.id)) {
                    sceneRef.remove(player.mesh);

                    // We won't unload the model since it will be restored when they respawn
                    // Just storing that this player is currently defeated
                    player.isDefeated = true;
                }
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
            // End respawn process for local player
            endRespawnProcess();
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