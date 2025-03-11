from firebase_admin import firestore
from datetime import datetime
import time

# Simple absolute imports
from models.player import Player
from models.island import Island 
from models.message import Message
from models.inventory import Inventory

# This will be initialized in app.py
db = None

# Simple timestamp serialization - just convert to string
def serialize_timestamp(value):
    """Convert any timestamp to a string representation"""
    if value is None:
        return None
    # Just convert to string, no fancy handling
    return str(value)

# Initialize Firebase in your app.py file
def init_firestore(firestore_client):
    """Initialize the Firestore client for all models to use"""
    global db
    db = firestore_client
    
    # Import the models at the module level
    import models.player
    import models.island
    import models.message
    import models.inventory
    
    # Set the global db variable in each model module
    models.player.db = db
    models.island.db = db
    models.message.db = db
    models.inventory.db = db
    
    # Make serialize_timestamp available in each model module
    models.player.serialize_timestamp = serialize_timestamp
    models.island.serialize_timestamp = serialize_timestamp  
    models.message.serialize_timestamp = serialize_timestamp
    models.inventory.serialize_timestamp = serialize_timestamp
    
    # Handle cross-model dependencies
    models.message.Player = models.player.Player
    
    # Also expose Player, Island, Message and Inventory from their modules
    global Player, Island, Message, Inventory
    Player = models.player.Player
    Island = models.island.Island
    Message = models.message.Message
    Inventory = models.inventory.Inventory

# ======= Player getters =======
def get_player(player_id):
    """Get a player by ID"""
    return Player.get(player_id)

def get_all_players():
    """Get all players"""
    return Player.get_all()

def get_active_players():
    """Get all active players"""
    return Player.get_active_players()

def create_player(player_id, **data):
    """Create a new player"""
    return Player.create(player_id, **data)

def update_player(player_id, **updates):
    """Update a player's fields"""
    return Player.update(player_id, **updates)

def delete_player(player_id):
    """Delete a player"""
    return Player.delete(player_id)

def get_player_leaderboard(category, limit=10):
    """Get leaderboard for a specific category"""
    return Player.get_leaderboard(category, limit)

def get_combined_leaderboard(limit=10):
    """Get combined leaderboards for all categories"""
    return Player.get_combined_leaderboard(limit)

# ======= Island getters =======
def get_island(island_id):
    """Get an island by ID"""
    return Island.get(island_id)

def get_all_islands():
    """Get all islands"""
    return Island.get_all()

def create_island(island_id, **data):
    """Create a new island"""
    return Island.create(island_id, **data)

def update_island(island_id, **updates):
    """Update an island's fields"""
    return Island.update(island_id, **updates)

def delete_island(island_id):
    """Delete an island"""
    return Island.delete(island_id)

# ======= Message getters =======
def get_message(message_id):
    """Get a message by ID"""
    return Message.get(message_id)

def get_recent_messages(limit=50, message_type='global'):
    """Get recent messages of a specific type"""
    return Message.get_recent_messages(limit, message_type)

def create_message(sender_id, content, message_type='global'):
    """Create a new message"""
    return Message.create(sender_id, content, message_type)

# ======= Inventory getters =======
def get_inventory(player_id):
    """Get a player's inventory"""
    return Inventory.get(player_id)

def create_inventory(player_id):
    """Create a new inventory for a player"""
    return Inventory.create(player_id)

def update_inventory(player_id, **updates):
    """Update a player's inventory"""
    return Inventory.update(player_id, **updates)

def add_fish_to_inventory(player_id, fish_name, fish_data=None):
    """Add a fish to a player's inventory"""
    return Inventory.add_fish(player_id, fish_name, fish_data)

def add_treasure_to_inventory(player_id, treasure_name, treasure_data=None):
    """Add a treasure to a player's inventory"""
    return Inventory.add_treasure(player_id, treasure_name, treasure_data)

def add_cargo_to_inventory(player_id, cargo_name, cargo_data=None):
    """Add cargo to a player's inventory"""
    return Inventory.add_cargo(player_id, cargo_name, cargo_data)

def remove_inventory_item(player_id, item_type, item_index):
    """Remove an item from a player's inventory"""
    return Inventory.remove_item(player_id, item_type, item_index)

def get_all_player_inventories():
    """Get all player inventories"""
    return Inventory.get_all_player_inventories()

def clear_inventory(player_id):
    """Clear a player's inventory"""
    return Inventory.clear_inventory(player_id) 