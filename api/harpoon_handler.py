"""
Harpoon Handler Module for Boat Game
Handles harpoon-specific logic like firing requests, cooldowns,
and processing the results of collisions detected by the ProjectileManager.
"""

import time
import math
import logging
from flask_socketio import emit
import player_handler
import projectile_manager # <-- Import the projectile manager

# Assuming a simulations module exists with calculate_distance
try:
    from simulations import calculate_distance
except ImportError:
    # Basic distance calculation if simulations module is not available
    def calculate_distance(pos1, pos2):
        """Calculate the Euclidean distance between two 3D positions."""
        if not isinstance(pos1, dict) or not isinstance(pos2, dict):
            return float('inf') # Avoid errors with invalid positions
        dx = pos1.get('x', 0) - pos2.get('x', 0)
        dy = pos1.get('y', 0) - pos2.get('y', 0)
        dz = pos1.get('z', 0) - pos2.get('z', 0)
        return math.sqrt(dx*dx + dy*dy + dz*dz)
    # Define a basic linear projectile simulation if the main one isn't available
    def simulate_projectile(initial_position, initial_velocity, gravity, time_elapsed):
        # Simple linear motion if gravity is 0 or near 0
        if abs(gravity) < 1e-6:
             return {
                'x': initial_position['x'] + initial_velocity['x'] * time_elapsed,
                'y': initial_position['y'] + initial_velocity['y'] * time_elapsed,
                'z': initial_position['z'] + initial_velocity['z'] * time_elapsed
            }
        # Fallback to basic gravity if needed (though harpoons likely won't use it)
        else:
             return {
                'x': initial_position['x'] + initial_velocity['x'] * time_elapsed,
                'y': initial_position['y'] + initial_velocity['y'] * time_elapsed - 0.5 * gravity * time_elapsed * time_elapsed,
                'z': initial_position['z'] + initial_velocity['z'] * time_elapsed
            }
    logger.warning("Simulations module not found, using basic implementations.")

# Configure logging
logger = logging.getLogger(__name__)

# --- Harpoon Configuration Constants ---
HARPOON_SPEED = 80      # Units per second (adjust as needed)
HARPOON_LIFETIME = 2.0  # Seconds before a harpoon projectile expires
HARPOON_COOLDOWN = 1.5  # Seconds between harpoon shots for a player
HARPOON_HIT_RADIUS = 5  # Units radius for player hit detection
PROJECTILE_TYPE_HARPOON = 'harpoon' # Define type constant

# --- Module-level Data Structures ---
# Removed: harpoons = {} - Now managed by ProjectileManager
player_harpoon_cooldowns = {}  # Tracks the last fire time for each player {player_id: timestamp}

# --- Module-level References (Initialized via init_socketio) ---
socketio = None
players = None # Reference to the main player dictionary from app.py

def init_socketio(socketio_instance, players_reference):
    """
    Initializes the harpoon handler, registers event listeners,
    and registers its collision checker with the ProjectileManager.
    """
    global socketio, players
    socketio = socketio_instance
    players = players_reference

    # Register Socket.IO event handlers
    socketio.on_event('harpoon_fire', handle_harpoon_fire)

    # Register the collision check function with the Projectile Manager
    projectile_manager.register_collision_checker(PROJECTILE_TYPE_HARPOON, _harpoon_collision_check_callback)

    # Removed: start_harpoon_update_loop(socketio_instance) - Loop is now centralized

    logger.info("Harpoon handler initialized and collision checker registered.")

# --- Event Handlers (Implementation follows) ---
def handle_harpoon_fire(data):
    """
    Handles incoming requests from clients to fire a harpoon.
    Performs validation, cooldown checks, adds the projectile via the manager, and notifies clients.
    """
    try:
        player_id = data.get('player_id')
        position = data.get('position')
        direction = data.get('direction')

        # --- Validation ---
        if not player_id or player_id not in players:
            logger.warning(f"Harpoon fire rejected: Invalid or unknown player_id '{player_id}'.")
            return

        if not isinstance(position, dict) or not all(k in position for k in ('x', 'y', 'z')):
            logger.error(f"Harpoon fire rejected: Invalid position format from player {player_id}. Data: {position}")
            return

        if not isinstance(direction, dict) or not all(k in direction for k in ('x', 'y', 'z')):
            logger.error(f"Harpoon fire rejected: Invalid direction format from player {player_id}. Data: {direction}")
            return
        # Normalize direction vector (optional but good practice)
        dir_len = math.sqrt(direction['x']**2 + direction['y']**2 + direction['z']**2)
        if dir_len == 0:
             logger.warning(f"Harpoon fire rejected: Zero direction vector from player {player_id}.")
             return
        normalized_direction = {k: v / dir_len for k, v in direction.items()}


        # --- Cooldown Check ---
        current_time = time.time()
        last_fire_time = player_harpoon_cooldowns.get(player_id, 0)

        if current_time - last_fire_time < HARPOON_COOLDOWN:
            logger.info(f"Player {player_id} harpoon fire rejected: Cooldown active.")
            # Optional: Notify the specific player they are on cooldown
            # player_sid = player_handler.get_player_sid(player_id) # Requires get_player_sid
            # if player_sid:
            #     socketio.emit('harpoon_cooldown', {'remaining': HARPOON_COOLDOWN - (current_time - last_fire_time)}, room=player_sid)
            return

        # --- Add Projectile via Manager ---
        player_harpoon_cooldowns[player_id] = current_time
        harpoon_id = projectile_manager.add_projectile(
            owner_id=player_id,
            projectile_type=PROJECTILE_TYPE_HARPOON,
            initial_position=position,
            direction=normalized_direction,
            speed=HARPOON_SPEED,
            lifetime=HARPOON_LIFETIME,
            gravity=0.0 # Harpoons fly straight
            # Add any harpoon-specific kwargs here if needed later
        )

        if not harpoon_id:
            logger.error(f"Failed to add harpoon projectile for player {player_id}.")
            return

        # Removed: Storing harpoon_data locally in 'harpoons' dict

        logger.info(f"Harpoon {harpoon_id} fired by player {player_id} via ProjectileManager.")

        # --- Emit Events ---
        # 1. Broadcast to other players
        emit_data_broadcast = {
            'harpoon_id': harpoon_id, # Use the ID from the manager
            'owner_id': player_id,
            'position': position, # Emit initial position
            'direction': normalized_direction,
            'speed': HARPOON_SPEED # Send speed so clients can simulate if needed
        }
        socketio.emit('harpoon_fired_broadcast', emit_data_broadcast, broadcast=True, include_self=False)

        # 2. (Optional) Confirm back to the firing player
        # Requires get_player_sid implementation in player_handler or app.py
        # player_sid = player_handler.get_player_sid(player_id)
        # if player_sid:
        #     emit_data_confirm = {'harpoon_id': harpoon_id}
        #     socketio.emit('harpoon_fired_confirmed', emit_data_confirm, room=player_sid)

    except Exception as e:
        logger.error(f"Error in handle_harpoon_fire: {e}", exc_info=True)

# --- Collision Logic (Implementation follows) ---
def _harpoon_collision_check_callback(harpoon_id, harpoon_data):
    """
    Callback function provided to the ProjectileManager.
    Checks a specific harpoon projectile for collisions against active players.
    Returns True if a collision occurred (signaling manager to remove projectile), False otherwise.
    """
    harpoon_pos = harpoon_data['position']
    owner_id = harpoon_data['owner']

    # Iterate through a copy of player items for safety
    current_players = list(players.items())

    for player_id, player_data in current_players:
        # --- Skip Self-Hit ---
        if player_id == owner_id:
            continue

        # --- Skip Inactive/Invalid Targets ---
        # Ensure player is active and has necessary data
        if not player_data.get('active', False) or 'position' not in player_data:
            continue
        # Optional: Add check for health > 0 if needed
        # if player_data.get('health', 0) <= 0:
        #     continue

        player_pos = player_data['position']

        # --- Calculate Distance & Check Collision ---
        distance = calculate_distance(harpoon_pos, player_pos)

        if distance <= HARPOON_HIT_RADIUS:
            logger.info(f"Collision detected by callback: Harpoon {harpoon_id} hit player {player_id}.")
            # --- Handle Hit ---
            handle_harpoon_player_hit(harpoon_data, player_id, player_data)
            return True # Signal to ProjectileManager that a hit occurred

    # --- No Collision Detected ---
    return False

def handle_harpoon_player_hit(harpoon_data, hit_player_id, hit_player_data):
    """
    Handles the consequences of a harpoon hitting a player:
    Calls PlayerHandler to apply state change and emits a broadcast notification.
    Mirrors cannon_handler pattern without using socket_to_user_map.
    """
    try:
        harpoon_id = harpoon_data['id']
        owner_id = harpoon_data['owner']

        logger.info(f"Processing harpoon hit effects: Harpoon {harpoon_id} on player {hit_player_id}.")

        # --- Update Hit Player State via PlayerHandler ---
        # This mirrors cannon_handler calling player_handler.damage_player
        effect_data = {
            'by': owner_id,
            'harpoon_id': harpoon_id
        }
        # Call player_handler to manage the state change
        # player_handler.apply_status_effect(hit_player_id, 'harpooned', effect_data) # <-- Temporarily disabled

        # --- Emit Global Notification ---
        # This mirrors cannon_handler emitting 'server_cannon_hit'
        socketio.emit('harpoon_hit_broadcast', {
             'harpoon_id': harpoon_id,
             'owner_id': owner_id,
             'hit_player_id': hit_player_id,
             'hit_position': harpoon_data['position'] # Position where the hit occurred
        }, broadcast=True)
        logger.debug(f"Broadcast harpoon_hit_broadcast for harpoon {harpoon_id}")

    except Exception as e:
        logger.error(f"Error in handle_harpoon_player_hit for harpoon {harpoon_data.get('id', 'N/A')}: {e}", exc_info=True)


# --- Utility Functions (If needed) ---
# Example placeholder if get_player_sid is needed here:
# def get_player_sid(player_id):
#     """Placeholder: Retrieves SID for a player_id."""
#     # In a real scenario, this would likely involve looking up a mapping
#     # maintained in app.py or player_handler itself.
#     # For now, returning None to avoid errors if called.
#     logger.warning("get_player_sid is a placeholder and needs proper implementation.")
#     return None 