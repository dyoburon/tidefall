/**
 * Player List UI Component
 * Displays a list of all players currently connected to the server
 */

// Update imports to include allPlayers functionality
import {
    playerData,
    getPlayerInfo,
    allPlayers,
    updateAllPlayers,
    getAllPlayers
} from '../core/gameState.js';
import { registerOpenUI, unregisterOpenUI } from './ui.js';

class PlayerList {
    constructor() {


        // Create container for the player list UI
        this.container = document.createElement('div');
        this.container.id = 'player-list';
        this.container.style.position = 'absolute';
        this.container.style.top = '50%';
        this.container.style.left = '50%';
        this.container.style.transform = 'translate(-50%, -50%)';
        this.container.style.backgroundColor = 'rgba(40, 25, 10, 0.95)';
        this.container.style.padding = '20px';
        this.container.style.borderRadius = '10px';
        this.container.style.border = '3px solid #B8860B';
        this.container.style.display = 'none';
        this.container.style.flexDirection = 'column';
        this.container.style.width = '400px';
        this.container.style.maxHeight = '80vh';
        this.container.style.overflowY = 'auto';
        this.container.style.zIndex = '2000'; // Higher than other UI elements
        this.container.style.boxShadow = '0 0 30px rgba(0, 0, 0, 0.8)';
        document.body.appendChild(this.container);

        // Create basic header and content elements directly here
        const header = document.createElement('h2');
        header.textContent = 'Active Sailors';
        header.style.color = '#FFD700';
        header.style.textAlign = 'center';
        header.style.marginBottom = '15px';
        this.container.appendChild(header);

        // Create content container
        this.content = document.createElement('div');
        this.content.style.maxHeight = '400px';
        this.content.style.overflowY = 'auto';
        this.container.appendChild(this.content);

        // Add connectivity status indicator
        this.statusIndicator = document.createElement('div');
        this.statusIndicator.style.padding = '8px';
        this.statusIndicator.style.marginTop = '10px';
        this.statusIndicator.style.textAlign = 'center';
        this.statusIndicator.style.fontSize = '14px';
        this.statusIndicator.style.color = '#ffaa00';
        this.statusIndicator.style.border = '1px solid #ffaa00';
        this.statusIndicator.style.borderRadius = '4px';
        this.statusIndicator.style.backgroundColor = 'rgba(60, 40, 0, 0.4)';
        this.container.appendChild(this.statusIndicator);

        // Create refresh button
        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Refresh List';
        refreshButton.style.marginTop = '15px';
        refreshButton.style.padding = '5px 10px';
        refreshButton.style.backgroundColor = '#5A3D27';
        refreshButton.style.color = '#FFD700';
        refreshButton.style.border = '1px solid #DAA520';
        refreshButton.style.borderRadius = '4px';
        refreshButton.style.cursor = 'pointer';
        refreshButton.addEventListener('click', () => this.refreshPlayerList());
        this.container.appendChild(refreshButton);

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.marginTop = '10px';
        closeButton.style.padding = '5px 10px';
        closeButton.style.backgroundColor = '#5A3D27';
        closeButton.style.color = '#FFD700';
        closeButton.style.border = '1px solid #DAA520';
        closeButton.style.borderRadius = '4px';
        closeButton.style.cursor = 'pointer';
        closeButton.addEventListener('click', () => this.close());
        this.container.appendChild(closeButton);

        // Fix circular dependency by using dynamic import for network
        setTimeout(() => this.initNetworkListeners(), 100);


    }

    initNetworkListeners() {


        // Try to access socket from multiple possible sources
        let socketConnection = null;

        // First try window.socket
        if (window.socket) {

            socketConnection = window.socket;
        }
        // Then try to import from network.js
        else {
            try {
                import('../core/network.js').then(network => {

                    if (network.socket) {

                        this.setupSocketListeners(network.socket);
                        return;
                    } else {

                        this.showFallbackPlayerList();
                    }
                }).catch(err => {

                    this.showFallbackPlayerList();
                });
                return; // Return early as we're handling this asynchronously
            } catch (err) {

            }
        }

        // If we got a socket connection, set it up
        if (socketConnection) {
            this.setupSocketListeners(socketConnection);
        } else {

            this.statusIndicator.textContent = "No server connection - showing local data only";
            this.statusIndicator.style.color = "#ffaa00";
            this.statusIndicator.style.borderColor = "#ffaa00";

            // Use local player data as fallback
            this.showFallbackPlayerList();
        }
    }

    // Updated method to set up socket listeners with the provided socket
    setupSocketListeners(socket) {

        this.statusIndicator.textContent = "Connected to game server";
        this.statusIndicator.style.color = "#00ff00";
        this.statusIndicator.style.borderColor = "#00ff00";

        socket.on('all_players', (players) => {

            // Update both the UI and the gameState's allPlayers array
            updateAllPlayers(players);
            this.updatePlayerList(players);
        });

        // Add listener for player_joined events
        socket.on('player_joined', (player) => {

            // Update gameState's allPlayers array by adding the new player
            const currentPlayers = getAllPlayers();
            const updatedPlayers = [...currentPlayers];

            // Check if player already exists, update if so
            const existingIndex = updatedPlayers.findIndex(p => p.id === player.id);
            if (existingIndex >= 0) {
                updatedPlayers[existingIndex] = player;
            } else {
                updatedPlayers.push(player);
            }

            updateAllPlayers(updatedPlayers);

            // Refresh the UI with the updated player list
            this.updatePlayerList(updatedPlayers);
        });

        // Add listener for player_left events
        socket.on('player_left', (playerId) => {

            // Update gameState's allPlayers array by removing the player
            const currentPlayers = getAllPlayers();
            const updatedPlayers = currentPlayers.filter(p => p.id !== playerId);

            updateAllPlayers(updatedPlayers);

            // Refresh the UI with the updated player list
            this.updatePlayerList(updatedPlayers);
        });

        // Cache the socket for later use
        this.socketConnection = socket;

        // Request player list immediately
        this.refreshPlayerList();
    }

    // Updated to create interactive player entries with teleport functionality
    updatePlayerList(players) {


        // If no players are passed directly, try to use gameState's allPlayers
        if (!players || players.length === 0) {
            players = getAllPlayers();

        }

        // Clear existing content
        this.content.innerHTML = '';

        if (!players || players.length === 0) {
            const noPlayers = document.createElement('div');
            noPlayers.textContent = 'No other sailors found on the seas';
            noPlayers.style.textAlign = 'center';
            noPlayers.style.color = '#aaa';
            noPlayers.style.padding = '20px 0';
            this.content.appendChild(noPlayers);
            return;
        }

        // Sort players by name
        const sortedPlayers = [...players].sort((a, b) => {
            return (a.name || '').localeCompare(b.name || '');
        });

        // Create a player entry for each player
        sortedPlayers.forEach(player => {
            // Skip current player for teleport options
            const isCurrentPlayer = player.id === (playerData.id || '');

            const playerEntry = document.createElement('div');
            playerEntry.style.padding = '10px';
            playerEntry.style.marginBottom = '5px';
            playerEntry.style.backgroundColor = 'rgba(60, 40, 20, 0.5)';
            playerEntry.style.borderRadius = '4px';
            playerEntry.style.display = 'flex';
            playerEntry.style.justifyContent = 'space-between';
            playerEntry.style.position = 'relative'; // For popup positioning

            // Make it look interactive if not current player
            if (!isCurrentPlayer) {
                playerEntry.style.cursor = 'pointer';
                playerEntry.style.transition = 'background-color 0.2s';
                playerEntry.addEventListener('mouseover', () => {
                    playerEntry.style.backgroundColor = 'rgba(80, 60, 30, 0.6)';
                });
                playerEntry.addEventListener('mouseout', () => {
                    playerEntry.style.backgroundColor = 'rgba(60, 40, 20, 0.5)';
                });

                // Add click listener to show teleport popup
                playerEntry.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent bubbling
                    this.showTeleportPopup(player, playerEntry);
                });
            }

            const nameEl = document.createElement('div');
            nameEl.textContent = player.name || 'Unknown Sailor';

            // Set color based on player.color - handle different possible formats
            if (player.color) {
                if (typeof player.color === 'string') {
                    nameEl.style.color = player.color;
                } else if (player.color.r !== undefined) {
                    // RGB format from Three.js
                    const r = Math.floor(player.color.r * 255);
                    const g = Math.floor(player.color.g * 255);
                    const b = Math.floor(player.color.b * 255);
                    nameEl.style.color = `rgb(${r}, ${g}, ${b})`;
                }
            } else {
                nameEl.style.color = '#fff';
            }

            nameEl.style.fontWeight = 'bold';

            // Add "(You)" indicator for current player
            if (isCurrentPlayer) {
                const youIndicator = document.createElement('span');
                youIndicator.textContent = ' (You)';
                youIndicator.style.color = '#aaa';
                youIndicator.style.fontStyle = 'italic';
                nameEl.appendChild(youIndicator);
            }

            const statsEl = document.createElement('div');
            statsEl.textContent = `Fish: ${player.fishCount || 0} | Gold: ${player.money || 0}`;
            statsEl.style.color = '#ddd';
            statsEl.style.fontSize = '0.9em';

            playerEntry.appendChild(nameEl);
            playerEntry.appendChild(statsEl);
            this.content.appendChild(playerEntry);
        });

        // Update the count in the header
        const playerCount = document.createElement('div');
        playerCount.textContent = `${players.length} sailor${players.length !== 1 ? 's' : ''} online`;
        playerCount.style.fontSize = '14px';
        playerCount.style.color = '#aaa';
        playerCount.style.textAlign = 'center';
        playerCount.style.marginTop = '5px';
        this.content.appendChild(playerCount);

        // Add event listener to hide any open popups when clicking elsewhere
        document.addEventListener('click', () => {
            this.hideAllPopups();
        });
    }

    // Add this new method to create and show the teleport popup
    showTeleportPopup(targetPlayer, parentElement) {
        // First, hide any other open popups
        this.hideAllPopups();

        // Create popup container
        const popup = document.createElement('div');
        popup.className = 'player-teleport-popup';
        popup.style.position = 'absolute';
        popup.style.top = '100%';
        popup.style.left = '0';
        popup.style.zIndex = '1000000000'; // Increased from 2100 to be above everything
        popup.style.backgroundColor = 'rgba(30, 20, 5, 0.95)';
        popup.style.border = '2px solid #B8860B';
        popup.style.borderRadius = '6px';
        popup.style.padding = '10px';
        popup.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
        popup.style.minWidth = '150px';

        // Create teleport option
        const teleportOption = document.createElement('div');
        teleportOption.textContent = '🧭 Teleport to Player';
        teleportOption.style.color = '#FFD700';
        teleportOption.style.padding = '6px 8px';
        teleportOption.style.cursor = 'pointer';
        teleportOption.style.borderRadius = '4px';
        teleportOption.style.transition = 'background-color 0.2s';

        // Add hover effect
        teleportOption.addEventListener('mouseover', () => {
            teleportOption.style.backgroundColor = 'rgba(100, 80, 20, 0.5)';
        });
        teleportOption.addEventListener('mouseout', () => {
            teleportOption.style.backgroundColor = 'transparent';
        });

        // Add click handler for teleport functionality
        teleportOption.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling
            this.teleportToPlayer(targetPlayer);
            this.hideAllPopups();
        });

        popup.appendChild(teleportOption);

        // Add the popup to the parent element
        parentElement.appendChild(popup);

        // Save reference to the current popup for easy removal
        this.currentPopup = popup;

        // Add click handler to prevent closing when clicking inside the popup
        popup.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Helper method to hide all open popups
    hideAllPopups() {
        if (this.currentPopup) {
            if (this.currentPopup.parentNode) {
                this.currentPopup.parentNode.removeChild(this.currentPopup);
            }
            this.currentPopup = null;
        }
    }

    // Implement the teleport functionality
    teleportToPlayer(targetPlayer) {


        // Check if the target player has position data
        if (!targetPlayer.position) {


            // Show error message
            const errorMsg = document.createElement('div');
            errorMsg.textContent = `Cannot teleport to ${targetPlayer.name} - Position data unavailable`;
            errorMsg.style.position = 'fixed';
            errorMsg.style.top = '50%';
            errorMsg.style.left = '50%';
            errorMsg.style.transform = 'translate(-50%, -50%)';
            errorMsg.style.backgroundColor = 'rgba(100, 0, 0, 0.8)';
            errorMsg.style.color = 'white';
            errorMsg.style.padding = '15px 20px';
            errorMsg.style.borderRadius = '8px';
            errorMsg.style.zIndex = '9800'; // Increased from 3000 to be above everything
            document.body.appendChild(errorMsg);

            // Remove after 3 seconds
            setTimeout(() => {
                if (errorMsg.parentNode) {
                    errorMsg.parentNode.removeChild(errorMsg);
                }
            }, 3000);

            return;
        }

        // Import boat and camera from gameState
        import('../core/gameState.js').then(gameState => {
            // Set player boat position to target player position
            if (gameState.boat && gameState.boat.position && targetPlayer.position) {
                // Store original position values before teleport (for animation or effects)
                const originalX = gameState.boat.position.x;
                const originalZ = gameState.boat.position.z;

                // Set the boat position
                gameState.boat.position.x = targetPlayer.position.x;
                gameState.boat.position.z = targetPlayer.position.z;

                // If you want to implement a teleport effect
                this.showTeleportEffect(originalX, originalZ, targetPlayer.position.x, targetPlayer.position.z);

                // Reset velocity to prevent momentum carrying over
                if (gameState.boatVelocity) {
                    gameState.boatVelocity.set(0, 0, 0);
                }

                // Also move the camera to follow the boat
                if (gameState.camera) {
                    // Adjust camera position to maintain same relative position to boat
                    const offsetX = gameState.camera.position.x - originalX;
                    const offsetZ = gameState.camera.position.z - originalZ;

                    gameState.camera.position.x = targetPlayer.position.x + offsetX;
                    gameState.camera.position.z = targetPlayer.position.z + offsetZ;
                }

                console.log("🧭 PLAYERLIST: Teleport successful", {
                    from: { x: originalX, z: originalZ },
                    to: { x: targetPlayer.position.x, z: targetPlayer.position.z }
                });

                // Show success message
                this.showTeleportSuccessMessage(targetPlayer.name);
            } else {

            }
        }).catch(err => {

        });
    }

    // Show a simple teleport success message
    showTeleportSuccessMessage(playerName) {
        const msg = document.createElement('div');
        msg.textContent = `Teleported to ${playerName}`;
        msg.style.position = 'fixed';
        msg.style.bottom = '20px';
        msg.style.left = '50%';
        msg.style.transform = 'translateX(-50%)';
        msg.style.backgroundColor = 'rgba(0, 80, 0, 0.8)';
        msg.style.color = 'white';
        msg.style.padding = '10px 20px';
        msg.style.borderRadius = '20px';
        msg.style.zIndex = '9800'; // Increased from 3000 to be above everything
        document.body.appendChild(msg);

        // Remove after 3 seconds
        setTimeout(() => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        }, 3000);
    }

    // Optional teleport visual effect
    showTeleportEffect(fromX, fromZ, toX, toZ) {
        // This is a placeholder for a visual effect you might want to add
        // For example, you could create particles, a flash, or an animation


        // You might want to add a simple flash effect to indicate teleportation
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        flash.style.zIndex = '9700'; // Increased from 2500 to be above everything
        flash.style.pointerEvents = 'none';
        document.body.appendChild(flash);

        // Fade out the flash
        let opacity = 0.3;
        const fadeInterval = setInterval(() => {
            opacity -= 0.05;
            if (opacity <= 0) {
                clearInterval(fadeInterval);
                if (flash.parentNode) {
                    flash.parentNode.removeChild(flash);
                }
            } else {
                flash.style.backgroundColor = `rgba(255, 255, 255, ${opacity})`;
            }
        }, 50);
    }

    // Fallback function when socket isn't available - now uses gameState's allPlayers
    showFallbackPlayerList() {


        // First check if we have players in gameState
        const storedPlayers = getAllPlayers();

        if (storedPlayers && storedPlayers.length > 0) {

            // We have players in gameState, use them
            this.updatePlayerList(storedPlayers);
            return;
        }

        // If we don't have stored players, show only the current player
        this.content.innerHTML = '';

        try {
            // Get current player data from gameState
            const currentPlayer = getPlayerInfo();

            // Create an entry for the current player
            const player = {
                name: currentPlayer.name || 'You (Offline)',
                color: currentPlayer.color || '#4285f4',
                fishCount: localStorage.getItem('fishCount') || 0,
                money: localStorage.getItem('playerMoney') || 0
            };

            // Create visual notification that this is offline mode
            const offlineNotice = document.createElement('div');
            offlineNotice.textContent = '⚠️ OFFLINE MODE - Only showing your data';
            offlineNotice.style.textAlign = 'center';
            offlineNotice.style.color = '#ffaa00';
            offlineNotice.style.padding = '10px';
            offlineNotice.style.marginBottom = '15px';
            offlineNotice.style.backgroundColor = 'rgba(60, 40, 0, 0.4)';
            offlineNotice.style.borderRadius = '4px';
            this.content.appendChild(offlineNotice);

            // Create player entry
            const playerEntry = document.createElement('div');
            playerEntry.style.padding = '10px';
            playerEntry.style.marginBottom = '5px';
            playerEntry.style.backgroundColor = 'rgba(60, 40, 20, 0.5)';
            playerEntry.style.borderRadius = '4px';
            playerEntry.style.display = 'flex';
            playerEntry.style.justifyContent = 'space-between';

            const nameEl = document.createElement('div');
            nameEl.textContent = player.name;
            nameEl.style.color = player.color;
            nameEl.style.fontWeight = 'bold';

            const statsEl = document.createElement('div');
            statsEl.textContent = `Fish: ${player.fishCount} | Gold: ${player.money}`;
            statsEl.style.color = '#ddd';
            statsEl.style.fontSize = '0.9em';

            playerEntry.appendChild(nameEl);
            playerEntry.appendChild(statsEl);
            this.content.appendChild(playerEntry);

            // Add the single player to allPlayers
            updateAllPlayers([player]);


        } catch (error) {


            // Display error message in the player list
            const errorMsg = document.createElement('div');
            errorMsg.textContent = 'Unable to display player data';
            errorMsg.style.textAlign = 'center';
            errorMsg.style.color = '#ff5555';
            errorMsg.style.padding = '20px 0';
            this.content.appendChild(errorMsg);
        }
    }

    // Updated to check gameState first
    refreshPlayerList() {


        // Try to get players from gameState first
        const storedPlayers = getAllPlayers();
        if (storedPlayers && storedPlayers.length > 0) {

            this.updatePlayerList(storedPlayers);
        }

        // Still try to get updated data from the server
        if (this.socketConnection) {

            this.socketConnection.emit('get_all_players');
        } else if (window.socket) {

            window.socket.emit('get_all_players');
        } else {
            try {
                import('../core/network.js').then(network => {
                    if (network.socket) {

                        network.socket.emit('get_all_players');
                    } else if (network.getAllPlayers && typeof network.getAllPlayers === 'function') {

                        network.getAllPlayers();
                    } else {

                        this.showFallbackPlayerList();
                    }
                }).catch(err => {

                    this.showFallbackPlayerList();
                });
            } catch (error) {

                this.showFallbackPlayerList();
            }
        }
    }

    show() {

        this.container.style.display = 'block';

        this.refreshPlayerList();

        registerOpenUI(this);

    }

    toggle() {

        if (this.container.style.display === 'none') {

            this.show();
        } else {

            this.close();
        }

    }

    close() {

        this.container.style.display = 'none';
        unregisterOpenUI(this);

    }
}

// Export a singleton instance
const playerList = new PlayerList();
export default playerList;

