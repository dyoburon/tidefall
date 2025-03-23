"""
Physics Simulation Utilities for Boat Game
Centralizes projectile physics calculations for server-side consistency
"""

import math


def simulate_projectile(initial_position, initial_velocity, gravity, time_elapsed):
    """
    Generic projectile simulation based on physics equations
    
    Args:
        initial_position (dict): Starting position {x, y, z}
        initial_velocity (dict): Initial velocity vector {x, y, z}
        gravity (float): Gravity force (typically positive value)
        time_elapsed (float): Time elapsed in seconds since projectile creation
        
    Returns:
        dict: New position {x, y, z}
    """
    # Calculate position using physics equations
    new_position = {
        'x': initial_position['x'] + initial_velocity['x'] * time_elapsed,
        'y': initial_position['y'] + initial_velocity['y'] * time_elapsed - 0.5 * gravity * time_elapsed * time_elapsed,
        'z': initial_position['z'] + initial_velocity['z'] * time_elapsed
    }
    
    return new_position


def simulate_cannonball(initial_position, direction, speed, gravity, time_elapsed):
    """
    Cannonball-specific simulation
    
    Args:
        initial_position (dict): Starting position {x, y, z}
        direction (dict): Direction vector (normalized) {x, y, z}
        speed (float): Initial speed magnitude
        gravity (float): Gravity force (typically positive value)
        time_elapsed (float): Time elapsed in seconds since projectile creation
        
    Returns:
        dict: New position {x, y, z} and current velocity {x, y, z}
    """
    # Calculate initial velocity from direction and speed
    initial_velocity = {
        'x': direction['x'] * speed,
        'y': direction['y'] * speed,
        'z': direction['z'] * speed
    }
    
    # Calculate new position
    position = simulate_projectile(initial_position, initial_velocity, gravity, time_elapsed)
    
    # Calculate current velocity (affected by gravity)
    current_velocity = {
        'x': initial_velocity['x'],
        'y': initial_velocity['y'] - gravity * time_elapsed,
        'z': initial_velocity['z']
    }
    
    return {
        'position': position,
        'velocity': current_velocity
    }


def check_collision(projectile_position, target_position, hitbox_size):
    """
    Collision detection utility with configurable hitbox size for client framerate variance
    
    Args:
        projectile_position (dict): Projectile position {x, y, z}
        target_position (dict): Target position {x, y, z}
        hitbox_size (float): Size of the hitbox (radius)
        
    Returns:
        bool: True if collision detected, False otherwise
    """
    print(f"Collision check - Projectile: {projectile_position}, Target: {target_position}, Hitbox size: {hitbox_size}")
    # Calculate distance between projectile and target
    distance = calculate_distance(projectile_position, target_position)
    
    # Check if distance is less than hitbox size
    # Adding extra leeway for client framerate variance
    return distance <= hitbox_size


def calculate_distance(pos1, pos2):
    """
    Calculate the distance between two 3D positions
    
    Args:
        pos1 (dict): First position {x, y, z}
        pos2 (dict): Second position {x, y, z}
        
    Returns:
        float: Distance between the positions
    """
    dx = pos1['x'] - pos2['x']
    dy = pos1['y'] - pos2['y']
    dz = pos1['z'] - pos2['z']
    
    return math.sqrt(dx*dx + dy*dy + dz*dz)


def calculate_trajectory_points(initial_position, direction, speed, gravity, duration, steps):
    """
    Pre-calculate trajectory points for a projectile
    
    Args:
        initial_position (dict): Starting position {x, y, z}
        direction (dict): Direction vector (normalized) {x, y, z}
        speed (float): Initial speed magnitude
        gravity (float): Gravity force (typically positive value)
        duration (float): Total duration to simulate
        steps (int): Number of points to calculate
        
    Returns:
        list: List of position dictionaries [{x, y, z}, ...]
    """
    trajectory = []
    time_step = duration / steps
    
    for i in range(steps + 1):
        time_elapsed = i * time_step
        sim_result = simulate_cannonball(initial_position, direction, speed, gravity, time_elapsed)
        trajectory.append(sim_result['position'])
        
        # Stop calculation if projectile hits water (y <= 0)
        if sim_result['position']['y'] <= 0:
            break
    
    return trajectory