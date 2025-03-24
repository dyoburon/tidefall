"""
Cannon Handler Module for Boat Game
Handles server-side cannon firing, projectile tracking, and hit detection
"""

import time
import math
import logging
from flask_socketio import emit
from simulations import simulate_cannonball, check_collision, calculate_trajectory_points
import player_handler

# Configure logging
logger = logging.getLogger(__name__)

# Cannon configuration constants
CANNON_SPEED = 100  # Units per second
CANNON_LIFETIME = 1  # Seconds before a cannon projectile expires
CANNON_DAMAGE = 10  # Damage inflicted by a cannon hit
CANNON_COOLDOWN = 0.5  # Seconds between cannon shots
CANNON_BLAST_RADIUS = 10  # Units radius for hit detection

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
    # No longer listening for client-reported hits as server now handles detection
    # socketio.on_event('cannon_hit', handle_cannon_hit)

    start_cannon_update_loop(socketio_instance)

    
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
        socketio.emit('cannon_fired', {
            'id': player_id,
            'position': cannon_data['position'],
            'direction': cannon_data['direction']
        }, broadcast=True)
        
        logger.info(f"Cannon fired by player {player_id}")
        
    except Exception as e:
        logger.error(f"Error in handle_cannon_fire: {str(e)}")

def handle_cannon_hit(data):
    """This function is deprecated as server now handles hit detection"""
    logger.info("Client-reported hit ignored: Server now handles hit detection")
    return

def handle_player_defeat(defeated_player_id, victor_player_id):
    """Handle logic when a player is defeated by a cannon"""
    # This function is now deprecated and exists only for backward compatibility.
    # All player defeat handling is now done by player_handler module.
    logger.info(f"handle_player_defeat called, but using player_handler instead for {defeated_player_id}")
    
    # Delegate to the player_handler module
    player_handler.handle_player_death(defeated_player_id, victor_player_id)

def update_cannon_positions():
    """Update positions of active cannons based on their velocity and time elapsed"""
    current_time = time.time()
    expired_cannons = []
    cannons_to_process = list(cannons.items())  # Create a copy of the items to iterate safely
    
    for cannon_id, cannon in cannons_to_process:
        # Skip if cannon no longer exists (might have been removed by another thread)
        if cannon_id not in cannons:
            continue
            
        # Calculate time elapsed since cannon creation
        time_elapsed = current_time - cannon['created_at']
        
        # Check if cannon has expired
        if time_elapsed >= CANNON_LIFETIME:
            expired_cannons.append(cannon_id)
            continue
            
        # Use simulation utility to update cannon position
        simulation_result = simulate_cannonball(
            cannon['position'],
            cannon['direction'],
            CANNON_SPEED,
             0.0981, 
            time_elapsed
        )
        
        # Update cannon position
        cannon['position'] = simulation_result['position']
        cannon['velocity'] = simulation_result['velocity']
        
        # Check for collisions with water (y <= 0)
        '''
        if cannon['position']['y'] <= 0:
            # Handle water impact
            logger.info(f"Cannon {cannon_id} hit water")
            expired_cannons.append(cannon_id)
            continue
        ''' 
        # Check for collisions with players
        check_cannon_collisions(cannon_id, cannon)
        
    # Remove expired cannons
    for cannon_id in expired_cannons:
        if cannon_id in cannons:
            del cannons[cannon_id]

def check_cannon_collisions(cannon_id, cannon):
    """Check if a cannon projectile has collided with any players using simulation utilities"""
    owner_id = cannon['owner']
    cannon_position = cannon['position']
    
    for player_id, player in players.items():
        # Skip checking collision with the cannon owner
        if player_id == owner_id:
            continue
            
        # Skip inactive players
        if not player.get('active', False):
            continue
            
        player_position = player.get('position', {'x': 0, 'y': 0, 'z': 0})

        # Calculate distance between cannon and player
        distance = calculate_distance(cannon_position, player_position)
        
        # Use the simulation utility to check for collision
        if check_collision(cannon_position, player_position, CANNON_BLAST_RADIUS):
            # Handle collision
            handle_cannon_collision(cannon, player_id)
            
            # Remove the cannon as it has hit something
            if cannon_id in cannons:
                del cannons[cannon_id]
                
            # Only hit one player per cannon
            break

def handle_cannon_collision(cannon, hit_player_id):
    """Handle a collision between a cannon projectile and a player with enhanced notifications"""
    # Notify all clients about the hit for visual effects
    socketio.emit('server_cannon_hit', {
        'shooter_id': cannon['owner'],
        'hit_player_id': hit_player_id,
        'damage': CANNON_DAMAGE,
        'hit_position': cannon['position']
    })
    
    # Apply damage to hit player using the player_handler module
    player_handler.damage_player(hit_player_id, CANNON_DAMAGE, cannon['owner'])
    
    logger.info(f"Cannon collision: {cannon['owner']} hit {hit_player_id} for {CANNON_DAMAGE} damage")

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

def start_cannon_update_loop(socketio_instance):
    """Start a background task that updates cannon positions at regular intervals"""
    
    def cannon_update_loop():
        """Background task to continuously update cannon positions"""
        UPDATE_INTERVAL = 0.05  # 50ms between updates (20 updates per second)
        
        logger.info("Starting cannon update loop")
        while True:
            update_cannon_positions()
            socketio_instance.sleep(UPDATE_INTERVAL)  # Non-blocking sleep
    
    # Start the background task
    socketio_instance.start_background_task(cannon_update_loop)
    logger.info("Cannon update loop started in background")