from firebase_admin import firestore
from datetime import datetime
import time

# Define the db variable
db = None

# Instead, declare these variables to be set later by init_firestore
serialize_timestamp = None

class Inventory:
    """Inventory model for Firestore - stores player's fish, treasures, and cargo"""
    collection_name = 'inventories'
    
    @staticmethod
    def collection():
        return db.collection(Inventory.collection_name)
    
    @staticmethod
    def to_dict(doc_snapshot):
        """Convert Firestore document to dictionary"""
        if not doc_snapshot.exists:
            return None
            
        data = doc_snapshot.to_dict()
        data['id'] = doc_snapshot.id
        
        # Simple string conversion for timestamps
        for field in ['created_at', 'updated_at']:
            if field in data:
                data[field] = serialize_timestamp(data[field])
                
        return data
    
    @staticmethod
    def get(player_id):
        """Get player's inventory by player ID"""
        doc_ref = Inventory.collection().document(player_id)
        inventory = Inventory.to_dict(doc_ref.get())
        
        # If inventory doesn't exist, create a default one
        if not inventory:
            return Inventory.create(player_id)
            
        return inventory
    
    @staticmethod
    def create(player_id):
        """Create new inventory for a player with default empty collections"""
        # Set defaults for a new inventory
        defaults = {
            'player_id': player_id,
            'fish': [],       # List of fish caught
            'treasures': [],  # List of treasures found
            'cargo': [],      # List of cargo/trade items
            'created_at': time.time()
        }
        
        # Create the document with player_id as the document ID
        doc_ref = Inventory.collection().document(player_id)
        doc_ref.set(defaults)
        
        # Return the created inventory
        return Inventory.to_dict(doc_ref.get())
    
    @staticmethod
    def update(player_id, **updates):
        """Update inventory fields"""
        # Add updated_at timestamp
        updates['updated_at'] = time.time()
        
        doc_ref = Inventory.collection().document(player_id)
        doc_ref.update(updates)
        
        # Return updated inventory
        return Inventory.get(player_id)
    
    @staticmethod
    def add_fish(player_id, fish_name, fish_data=None):
        """Add a fish to player's inventory"""
        # Get current inventory
        inventory = Inventory.get(player_id)
        
        # Create fish entry with timestamp
        fish_entry = {
            'name': fish_name,
            'caught_at': time.time(),
            'data': fish_data or {}
        }
        
        # Ensure fish array exists
        current_fish = inventory.get('fish', [])
        
        # Add new fish
        current_fish.append(fish_entry)
        
        # Update inventory
        return Inventory.update(player_id, fish=current_fish)
    
    @staticmethod
    def add_treasure(player_id, treasure_name, treasure_data=None):
        """Add a treasure to player's inventory"""
        # Get current inventory
        inventory = Inventory.get(player_id)
        
        # Create treasure entry with timestamp
        treasure_entry = {
            'name': treasure_name,
            'found_at': time.time(),
            'data': treasure_data or {}
        }
        
        # Ensure treasures array exists
        current_treasures = inventory.get('treasures', [])
        
        # Add new treasure
        current_treasures.append(treasure_entry)
        
        # Update inventory
        return Inventory.update(player_id, treasures=current_treasures)
    
    @staticmethod
    def add_cargo(player_id, cargo_name, cargo_data=None):
        """Add cargo item to player's inventory"""
        # Get current inventory
        inventory = Inventory.get(player_id)
        
        # Create cargo entry with timestamp
        cargo_entry = {
            'name': cargo_name,
            'acquired_at': time.time(),
            'data': cargo_data or {}
        }
        
        # Ensure cargo array exists
        current_cargo = inventory.get('cargo', [])
        
        # Add new cargo
        current_cargo.append(cargo_entry)
        
        # Update inventory
        return Inventory.update(player_id, cargo=current_cargo)
    
    @staticmethod
    def remove_item(player_id, item_type, item_index):
        """Remove an item from player's inventory by index"""
        # Get current inventory
        inventory = Inventory.get(player_id)
        
        # Validate item type
        if item_type not in ['fish', 'treasures', 'cargo']:
            raise ValueError("Item type must be 'fish', 'treasures', or 'cargo'")
        
        # Get current items of the specified type
        current_items = inventory.get(item_type, [])
        
        # Check if index is valid
        if item_index < 0 or item_index >= len(current_items):
            raise ValueError(f"Invalid index {item_index} for {item_type}")
        
        # Remove the item at the specified index
        removed_item = current_items.pop(item_index)
        
        # Update inventory
        update_data = {item_type: current_items}
        result = Inventory.update(player_id, **update_data)
        
        # Return the removed item and updated inventory
        return {'removed_item': removed_item, 'inventory': result}
    
    @staticmethod
    def get_all_player_inventories():
        """Get all player inventories"""
        docs = Inventory.collection().stream()
        return [Inventory.to_dict(doc) for doc in docs]
    
    @staticmethod
    def clear_inventory(player_id):
        """Clear a player's entire inventory"""
        empty_inventory = {
            'fish': [],
            'treasures': [],
            'cargo': [],
            'updated_at': time.time()
        }
        
        return Inventory.update(player_id, **empty_inventory)