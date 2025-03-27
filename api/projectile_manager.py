"""
Projectile Manager Module
Handles the lifecycle of generic projectiles (like cannonballs, harpoons).
Manages storage, updates positions via simulation, checks expiry,
and delegates collision checks via callbacks.
"""

import time
import math
import logging
from .simulations import simulate_projectile # Assuming this exists

# Configure logging
logger = logging.getLogger(__name__)

# --- Constants ---
UPDATE_INTERVAL = 0.05  # 50ms -> 20 updates per second

# --- Module-level Data Structures ---
projectiles = {}  # Stores active projectiles {projectile_id: projectile_data}

# --- Module-level References ---
socketio = None
# Dictionary to store collision check callbacks for different projectile types
# Format: { 'projectile_type': collision_check_function(projectile_id, projectile_data) -> bool }
collision_checkers = {}

def init_manager(socketio_instance):
    """
    Initializes the projectile manager with the Socket.IO instance
    and starts the update loop.
    """
    global socketio
    if socketio: # Prevent double initialization
        logger.warning("Projectile Manager already initialized.")
        return

    socketio = socketio_instance
    start_update_loop()
    logger.info("Projectile Manager initialized and update loop started.")

def register_collision_checker(projectile_type, callback_function):
    """
    Registers a callback function to handle collision checks for a specific projectile type.
    The callback should accept (projectile_id, projectile_data) and return True if a collision occurred, False otherwise.
    """
    if not callable(callback_function):
        logger.error(f"Failed to register collision checker for type '{projectile_type}': Provided callback is not callable.")
        return
    collision_checkers[projectile_type] = callback_function
    logger.info(f"Registered collision checker for projectile type: '{projectile_type}'")

def add_projectile(owner_id, projectile_type, initial_position, direction, speed, lifetime, gravity=0.0, **kwargs):
    """
    Creates, stores, and returns the ID of a new projectile.

    Args:
        owner_id (str): The ID of the entity that fired the projectile.
        projectile_type (str): The type of projectile (e.g., 'cannon', 'harpoon'). Used for collision checking.
        initial_position (dict): Starting {x, y, z}.
        direction (dict): Normalized direction vector {x, y, z}.
        speed (float): Initial speed magnitude.
        lifetime (float): Duration in seconds before the projectile expires.
        gravity (float): Gravitational acceleration (default 0.0).
        **kwargs: Additional type-specific data to store with the projectile.

    Returns:
        str: The unique ID generated for the projectile, or None if creation failed.
    """
    if not socketio:
        logger.error("Cannot add projectile: Projectile Manager not initialized.")
        return None

    current_time = time.time()
    projectile_id = f"{projectile_type}_{owner_id}_{current_time:.4f}"

    projectile_data = {
        'id': projectile_id,
        'owner': owner_id,
        'type': projectile_type,
        'initial_position': initial_position.copy(),
        'direction': direction.copy(), # Ensure normalized direction is passed
        'speed': speed,
        'gravity': gravity,
        'created_at': current_time,
        'expires_at': current_time + lifetime,
        'position': initial_position.copy(), # Current position, starts at initial
        'custom_data': kwargs # Store any extra data
    }

    projectiles[projectile_id] = projectile_data
    logger.debug(f"Added projectile: {projectile_id} (Type: {projectile_type}, Owner: {owner_id})")
    return projectile_id

def remove_projectile(projectile_id):
    """Removes a projectile from the active list."""
    if projectile_id in projectiles:
        del projectiles[projectile_id]
        logger.debug(f"Removed projectile: {projectile_id}")
        return True
    return False

def _update_projectiles_task():
    """
    The core update logic executed periodically by the background task.
    Updates positions, checks expiry, and triggers collision checks.
    """
    current_time = time.time()
    expired_ids = []
    collided_ids = []

    # Iterate over a copy of keys to allow modification during iteration
    active_ids = list(projectiles.keys())

    for projectile_id in active_ids:
        # Re-check existence in case it was removed mid-loop (e.g., by collision)
        if projectile_id not in projectiles:
            continue

        projectile = projectiles[projectile_id]

        # --- 1. Check for Expiry ---
        if current_time >= projectile['expires_at']:
            expired_ids.append(projectile_id)
            continue

        # --- 2. Calculate New Position using Simulation ---
        time_elapsed = current_time - projectile['created_at']
        initial_velocity = {
            axis: projectile['direction'][axis] * projectile['speed']
            for axis in ('x', 'y', 'z')
        }

        new_pos = simulate_projectile(
            initial_position=projectile['initial_position'],
            initial_velocity=initial_velocity,
            gravity=projectile['gravity'],
            time_elapsed=time_elapsed
        )
        projectile['position'] = new_pos # Update position in the dictionary

        # --- 3. Check for Collisions via Callback ---
        checker_func = collision_checkers.get(projectile['type'])
        if checker_func:
            try:
                # The callback function MUST return True if a collision occurred
                # and the projectile should be removed.
                if checker_func(projectile_id, projectile):
                    collided_ids.append(projectile_id)
                    # Don't continue; let removal happen after loop
            except Exception as e:
                logger.error(f"Error during collision check callback for projectile {projectile_id} (Type: {projectile['type']}): {e}", exc_info=True)
        else:
            # Only log warning occasionally if a checker is missing
            if hash(projectile_id) % 100 == 0: # Log roughly 1% of the time
                 logger.warning(f"No collision checker registered for projectile type: '{projectile['type']}'")


    # --- 4. Cleanup ---
    removed_count = 0
    ids_to_remove = set(expired_ids + collided_ids) # Combine and remove duplicates

    for proj_id in ids_to_remove:
        if remove_projectile(proj_id):
            removed_count += 1
            if proj_id in expired_ids:
                 logger.debug(f"Projectile {proj_id} removed due to expiry.")
            else:
                 logger.debug(f"Projectile {proj_id} removed due to collision.")


    #if removed_count > 0:
        # logger.debug(f"Projectile update cycle removed {removed_count} projectiles.")
        # pass # Reduce log spam

def start_update_loop():
    """Starts the background task that periodically calls _update_projectiles_task."""
    if not socketio:
        logger.error("Cannot start projectile update loop: Socket.IO instance not available.")
        return

    def background_task_wrapper():
        logger.info("Starting projectile manager update task loop.")
        while True:
            try:
                _update_projectiles_task()
                socketio.sleep(UPDATE_INTERVAL) # Use socketio's sleep for eventlet
            except Exception as e:
                logger.error(f"Critical error in projectile update task loop: {e}", exc_info=True)
                # Avoid tight loop on continuous error
                socketio.sleep(1)

    socketio.start_background_task(background_task_wrapper)
    logger.info("Projectile manager update background task scheduled.")

# --- Utility Functions (Optional) ---
def get_projectile_data(projectile_id):
    """Safely retrieves data for a specific projectile."""
    return projectiles.get(projectile_id) 