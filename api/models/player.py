from firebase_admin import firestore
from datetime import datetime
import time

class Player:
    """Player model for Firestore"""
    collection_name = 'players'
    
    @staticmethod
    def collection():
        return db.collection(Player.collection_name)
    
    @staticmethod
    def to_dict(doc_snapshot):
        """Convert Firestore document to dictionary"""
        if not doc_snapshot.exists:
            return None
            
        data = doc_snapshot.to_dict()
        data['id'] = doc_snapshot.id
        
        # Just convert all potential timestamp fields to strings
        for field in ['created_at', 'updated_at', 'last_update']:
            if field in data:
                data[field] = serialize_timestamp(data[field])
                
        return data
    
    @staticmethod
    def get(player_id):
        """Get player by ID"""
        doc_ref = Player.collection().document(player_id)
        return Player.to_dict(doc_ref.get())
    
    @staticmethod
    def create(player_id, **data):
        """Create new player"""
        # Set defaults if not provided
        defaults = {
            'name': f'Sailor {player_id[:4]}',
            'color': {'r': 0.3, 'g': 0.6, 'b': 0.8},
            'position': {'x': 0, 'y': 0, 'z': 0},
            'rotation': 0,
            'mode': 'boat',
            'last_update': time.time(),  # Use simple timestamp
            'fishCount': 0,
            'monsterKills': 0,
            'money': 0,
            'active': True,
            'created_at': time.time()  # Use simple timestamp instead of SERVER_TIMESTAMP
        }
        
        # Update defaults with provided data
        player_data = {**defaults, **data}
        
        # Create the document
        doc_ref = Player.collection().document(player_id)
        doc_ref.set(player_data)
        
        # Return the created player
        return Player.get(player_id)
    
    @staticmethod
    def update(player_id, **updates):
        """Update player fields"""
        # Add updated_at timestamp
        updates['updated_at'] = time.time()  # Use simple timestamp
        
        doc_ref = Player.collection().document(player_id)
        doc_ref.update(updates)
        
        # Return updated player
        return Player.get(player_id)
    
    @staticmethod
    def delete(player_id):
        """Delete player"""
        Player.collection().document(player_id).delete()
    
    @staticmethod
    def get_all():
        """Get all players"""
        docs = Player.collection().stream()
        return [Player.to_dict(doc) for doc in docs]
    
    @staticmethod
    def get_active_players():
        """Get all active players"""
        docs = Player.collection().where('active', '==', True).stream()
        return [Player.to_dict(doc) for doc in docs]
    
    @staticmethod
    def get_leaderboard(category, limit=10):
        """
        Get the leaderboard for a specific category
        
        :param category: The category to get the leaderboard for ('fishCount', 'monsterKills', or 'money')
        :param limit: Maximum number of entries to return
        :return: List of players sorted by the specified category
        """
        print(f"Getting leaderboard for category: {category}")
        if category not in ['fishCount', 'monsterKills', 'money']:
            raise ValueError("Category must be 'fishCount', 'monsterKills', or 'money'")
        
        # Query active players sorted by the specified category
        docs = (Player.collection()
                .order_by(category, direction=firestore.Query.DESCENDING)
                .limit(limit)
                .stream())

        ret = [Player.to_dict(doc) for doc in docs]
        print(f"Leaderboard: {ret}")
        
        return ret
    
    @staticmethod
    def get_combined_leaderboard(limit=10):
        """
        Get leaderboards for all categories
        
        :param limit: Maximum number of entries to return per category
        :return: Dictionary containing leaderboards for each category
        """
        return {
            'fishCount': [
                {
                    'name': player['name'],
                    'value': player['fishCount'],
                    'color': player['color']
                } for player in Player.get_leaderboard('fishCount', limit)
            ],
            'monsterKills': [
                {
                    'name': player['name'],
                    'value': player['monsterKills'],
                    'color': player['color']
                } for player in Player.get_leaderboard('monsterKills', limit)
            ],
            'money': [
                {
                    'name': player['name'],
                    'value': player['money'],
                    'color': player['color']
                } for player in Player.get_leaderboard('money', limit)
            ]
        }
