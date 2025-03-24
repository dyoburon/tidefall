"""
Player Handler Module for Boat Game
Handles player health, death, and respawn mechanics
"""

import logging
from flask_socketio import emit
import firestore_models

# Configure logging
logger = logging.getLogger(__name__)

# Player health configuration constants
DEFAULT_HEALTH = 100
RESPAWN_POSITION = {'x': 0, 'y': 0, 'z': 0}  # Default respawn location

# Reference to global objects (to be set during initialization)
socketio = None
players = None

def init_handler(socketio_instance, players_reference):
    """Initialize player handler with Socket.IO instance and players reference"""
    global socketio, players
    socketio = socketio_instance
    players = players_reference
    logger.info("Player handler initialized")

def damage_player(player_id, damage_amount, source_id=None):
    """
    Apply damage to a player
    
    Parameters:
    - player_id: ID of the player to damage
    - damage_amount: Amount of health to deduct
    - source_id: ID of the player or entity that caused the damage (optional)
    
    Returns:
    - True if the player was killed (health <= 0)
    - False if the player is still alive
    """
    # Ignore if player doesn't exist or is already inactive
    if player_id not in players or not players[player_id].get('active', False):
        return False
        
    # Get current health
    current_health = players[player_id].get('health', DEFAULT_HEALTH)
    
    # Apply damage
    new_health = max(0, current_health - damage_amount)
    
    # Update player health in memory
    players[player_id]['health'] = new_health
    
    # Update player health in database
    firestore_models.Player.update(player_id, health=new_health)
    
    # Broadcast health update to all players
    socketio.emit('player_health_update', {
        'player_id': player_id,
        'health': new_health,
        'damage_amount': damage_amount,
        'source_id': source_id
    })
    
    # Check for death
    if new_health <= 0:
        handle_player_death(player_id, source_id)
        return True
        
    return False

def handle_player_death(player_id, killer_id=None):
    """
    Handle logic when a player's health reaches zero
    
    Parameters:
    - player_id: ID of the player who died
    - killer_id: ID of the player who caused the death (optional)
    """
    # Log the event
    if killer_id:
        logger.info(f"Player {player_id} was defeated by {killer_id}")
        
        # Award a kill to the player who caused the death
        if killer_id in players and 'monsterKills' in players[killer_id]:
            players[killer_id]['monsterKills'] += 1
            firestore_models.Player.update(killer_id, monsterKills=players[killer_id]['monsterKills'])
    else:
        logger.info(f"Player {player_id} was defeated")
    
    # Notify all players of the defeat
    socketio.emit('player_defeated', {
        'player_id': player_id,
        'killer_id': killer_id
    })
    
    # Respawn immediately
    respawn_player(player_id)

def respawn_player(player_id):
    """
    Respawn a player immediately with full health
    
    Parameters:
    - player_id: ID of the player to respawn
    """
    # Reset health
    players[player_id]['health'] = DEFAULT_HEALTH
    
    # Update in database
    firestore_models.Player.update(
        player_id, 
        health=DEFAULT_HEALTH
    )
    
    # Notify all players of the respawn
    socketio.emit('player_respawned', {
        'player_id': player_id,
        'health': DEFAULT_HEALTH
    })
    
    logger.info(f"Player {player_id} has respawned")