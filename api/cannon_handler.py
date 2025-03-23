"""
Cannon Handler Module for Boat Game
Handles server-side cannon firing, projectile tracking, and hit detection
"""

import time
import math
import logging
from flask_socketio import emit

# Configure logging
logger = logging.getLogger(__name__)

# Cannon configuration constants
CANNON_SPEED = 40  # Units per second
CANNON_LIFETIME = 3  # Seconds before a cannon projectile expires
CANNON_DAMAGE = 10  # Damage inflicted by a cannon hit
CANNON_COOLDOWN = 0.5  # Seconds between cannon shots
CANNON_BLAST_RADIUS = 5  # Units radius for hit detection

# Data structure to track active cannon projectiles
cannons = {}  # Dictionary to store active cannon projectiles
player_cooldowns = {}  # Track cooldowns for each player

def init_socketio(socketio_instance, players_reference):
    """Initialize cannon handler with Socket.IO instance and players reference"""
    global socketio, players
    print("we are here in init")
    socketio = socketio_instance
    players = players_reference
    
    # Register Socket.IO event handlers
    socketio.on_event('cannon_fire', handle_cannon_fire)
    socketio.on_event('cannon_hit', handle_cannon_hit)
    
    # Schedule periodic cleanup of expired cannons
    # Note: This requires a background task mechanism
    # Use with Flask's APScheduler or a similar solution
    # setup_cannon_cleanup()

def handle_cannon_fire(data):
    """
    Handle cannon firing event from a client
    
    Expected data format:
    {
        position: {x, y, z},
        direction: {x, y, z},
        player_id: string
    }
    """
    print("we in here")
    try:
        player_id = data.get('player_id')
        
        # Validate player exists
        if not player_id or player_id not in players:
            logger.warning(f"Invalid player_id in cannon_fire: {player_id}")
            return
            
        # Validate cooldown
        current_time = time.time()
        if player_id in player_cooldowns:
            time_since_last_shot = current_time - player_cooldowns[player_id]
            if time_since_last_shot < CANNON_COOLDOWN:
                # Player is still in cooldown, ignore the event
                logger.info(f"Player {player_id} attempted to fire cannon during cooldown")
                return
                
        # Update player cooldown
        player_cooldowns[player_id] = current_time
        
        # Create a new cannon projectile
        cannon_id = f"cannon_{player_id}_{current_time}"
        
        cannon_data = {
            'id': cannon_id,
            'owner': player_id,
            'position': data.get('position'),
            'direction': data.get('direction'),
            'created_at': current_time,
            'expires_at': current_time + CANNON_LIFETIME
        }
        
        # Store the cannon projectile
        cannons[cannon_id] = cannon_data
        
        # Broadcast cannon firing to all players
        emit('cannon_fired', {
            'id': player_id,
            'position': cannon_data['position'],
            'direction': cannon_data['direction']
        }, broadcast=True)
        
        logger.info(f"Cannon fired by player {player_id}")
        
    except Exception as e:
        logger.error(f"Error in handle_cannon_fire: {str(e)}")

def handle_cannon_hit(data):
    """
    Handle cannon hit report from a client
    
    Expected data format:
    {
        cannon_id: string,
        hit_player_id: string,
        hit_position: {x, y, z},
        player_id: string  # Sender's player_id
    }
    """
    try:
        reporting_player = data.get('player_id')
        cannon_id = data.get('cannon_id')
        hit_player_id = data.get('hit_player_id')
        
        # Validate cannon exists
        if not cannon_id or cannon_id not in cannons:
            logger.warning(f"Invalid cannon_id in cannon_hit: {cannon_id}")
            return
            
        cannon = cannons[cannon_id]
        
        # Validate hit (only the owner of the cannon can report a hit)
        if reporting_player != cannon['owner']:
            logger.warning(f"Unauthorized cannon hit report from {reporting_player}")
            return
            
        # Validate hit player exists
        if not hit_player_id or hit_player_id not in players:
            logger.warning(f"Invalid hit_player_id in cannon_hit: {hit_player_id}")
            return
            
        # Validate cannon hasn't expired
        current_time = time.time()
        if current_time > cannon['expires_at']:
            logger.warning(f"Expired cannon in hit report: {cannon_id}")
            return
            
        # Apply damage to the hit player
        if hit_player_id in players:
            # Update player's health or state as needed
            # This depends on how player health is stored in your game
            if 'health' in players[hit_player_id]:
                players[hit_player_id]['health'] -= CANNON_DAMAGE
                
                # Check if player is defeated
                if players[hit_player_id]['health'] <= 0:
                    handle_player_defeat(hit_player_id, cannon['owner'])
                    
            # Notify the hit player
            emit('cannon_hit', {
                'id': cannon['owner'],
                'damage': CANNON_DAMAGE,
                'hitPosition': data.get('hit_position')
            }, room=get_player_socket_id(hit_player_id))
            
            logger.info(f"Player {hit_player_id} hit by cannon from {cannon['owner']}")
            
        # Remove the cannon projectile after it hits
        if cannon_id in cannons:
            del cannons[cannon_id]
            
    except Exception as e:
        logger.error(f"Error in handle_cannon_hit: {str(e)}")

def handle_player_defeat(defeated_player_id, victor_player_id):
    """Handle logic when a player is defeated by a cannon"""
    # Implement defeat logic (respawn, award points, etc.)
    logger.info(f"Player {defeated_player_id} was defeated by {victor_player_id}")
    
    # Example: Award points to victor
    if victor_player_id in players and 'monsterKills' in players[victor_player_id]:
        players[victor_player_id]['monsterKills'] += 1
        
    # Example: Respawn defeated player
    if defeated_player_id in players:
        players[defeated_player_id]['health'] = 100  # Reset health
        
        # Notify of defeat/respawn
        emit('player_defeated', {
            'player_id': defeated_player_id,
            'victor_id': victor_player_id
        }, broadcast=True)

def update_cannon_positions():
    """Update positions of active cannons based on their velocity and time elapsed"""
    current_time = time.time()
    expired_cannons = []
    
    for cannon_id, cannon in cannons.items():
        # Check if cannon has expired
        if current_time > cannon['expires_at']:
            expired_cannons.append(cannon_id)
            continue
            
        # Calculate time elapsed since creation
        time_elapsed = current_time - cannon['created_at']
        
        # Update position based on direction and speed
        direction = cannon['direction']
        distance = CANNON_SPEED * time_elapsed
        
        new_position = {
            'x': cannon['position']['x'] + direction['x'] * distance,
            'y': cannon['position']['y'] + direction['y'] * distance,
            'z': cannon['position']['z'] + direction['z'] * distance
        }
        
        # Update cannon position
        cannon['position'] = new_position
        
        # Check for potential collisions
        check_cannon_collisions(cannon_id, cannon)
    
    # Remove expired cannons
    for cannon_id in expired_cannons:
        if cannon_id in cannons:
            del cannons[cannon_id]
            
    logger.debug(f"Updated {len(cannons)} active cannons, removed {len(expired_cannons)} expired")

def check_cannon_collisions(cannon_id, cannon):
    """Check if a cannon projectile has collided with any players"""
    owner_id = cannon['owner']
    cannon_position = cannon['position']
    
    for player_id, player in players.items():
        # Skip checking collision with the cannon owner
        if player_id == owner_id:
            continue
            
        # Skip inactive players
        if not player.get('active', False):
            continue
            
        # Get player position
        player_position = player.get('position', {'x': 0, 'y': 0, 'z': 0})
        
        # Calculate distance between cannon and player
        distance = calculate_distance(cannon_position, player_position)
        
        # Check if collision occurred
        if distance <= CANNON_BLAST_RADIUS:
            # Handle collision
            handle_cannon_collision(cannon, player_id)
            
            # Remove the cannon as it has hit something
            if cannon_id in cannons:
                del cannons[cannon_id]
                
            # Only hit one player per cannon
            break

def handle_cannon_collision(cannon, hit_player_id):
    """Handle a collision between a cannon projectile and a player"""
    # Notify the owner that their cannon hit someone
    emit('cannon_hit_success', {
        'hit_player_id': hit_player_id
    }, room=get_player_socket_id(cannon['owner']))
    
    # Notify the hit player
    emit('cannon_hit', {
        'id': cannon['owner'],
        'damage': CANNON_DAMAGE,
        'hitPosition': cannon['position']
    }, room=get_player_socket_id(hit_player_id))
    
    # Apply damage to hit player
    if hit_player_id in players and 'health' in players[hit_player_id]:
        players[hit_player_id]['health'] -= CANNON_DAMAGE
        
        # Check if player is defeated
        if players[hit_player_id]['health'] <= 0:
            handle_player_defeat(hit_player_id, cannon['owner'])
            
    logger.info(f"Cannon collision: {cannon['owner']} hit {hit_player_id}")

def calculate_distance(pos1, pos2):
    """Calculate the distance between two 3D positions"""
    dx = pos1['x'] - pos2['x']
    dy = pos1['y'] - pos2['y']
    dz = pos1['z'] - pos2['z']
    
    return math.sqrt(dx*dx + dy*dy + dz*dz)

def get_player_socket_id(player_id):
    """Get the socket ID for a player - this function needs to be implemented based on your app structure"""
    # This is a placeholder - you need to implement this based on how
    # your app tracks the mapping between player IDs and socket IDs
    # It might be a lookup in socket_to_user_map or a similar structure
    
    # For testing, we can return None which will be ignored by emit()
    # In a real implementation, return the actual socket ID
    return None

def setup_cannon_cleanup():
    """Set up cannon cleanup that can be called during regular game operations"""
    # Instead of a scheduler, we'll perform cleanup checks during normal server operations
    # This can be called from regular player updates or other frequent events
    pass

def cleanup_expired_cannons():
    """Remove expired cannon projectiles"""
    current_time = time.time()
    expired_count = 0
    
    # Find and remove expired cannons
    expired_cannons = [cid for cid, cannon in cannons.items() if current_time > cannon['expires_at']]
    for cannon_id in expired_cannons:
        if cannon_id in cannons:
            del cannons[cannon_id]
            expired_count += 1
            
    if expired_count > 0:
        logger.debug(f"Cleaned up {expired_count} expired cannons")
    
    return expired_count