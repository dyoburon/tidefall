from firebase_admin import firestore
from datetime import datetime
import time


class Island:
    """Island model for Firestore"""
    collection_name = 'islands'
    
    @staticmethod
    def collection():
        return db.collection(Island.collection_name)
    
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
    def get(island_id):
        """Get island by ID"""
        doc_ref = Island.collection().document(island_id)
        return Island.to_dict(doc_ref.get())
    
    @staticmethod
    def create(island_id, **data):
        """Create new island"""
        # Set defaults if not provided
        defaults = {
            'position': {'x': 0, 'y': 0, 'z': 0},
            'radius': 50,
            'type': 'default',
            'created_at': time.time()  # Use simple timestamp
        }
        
        # Update defaults with provided data
        island_data = {**defaults, **data}
        
        # Create the document
        doc_ref = Island.collection().document(island_id)
        doc_ref.set(island_data)
        
        # Return the created island
        return Island.get(island_id)
    
    @staticmethod
    def update(island_id, **updates):
        """Update island fields"""
        # Add updated_at timestamp
        updates['updated_at'] = time.time()  # Use simple timestamp
        
        doc_ref = Island.collection().document(island_id)
        doc_ref.update(updates)
        
        # Return updated island
        return Island.get(island_id)
    
    @staticmethod
    def delete(island_id):
        """Delete island"""
        Island.collection().document(island_id).delete()
    
    @staticmethod
    def get_all():
        """Get all islands"""
        docs = Island.collection().stream()
        return [Island.to_dict(doc) for doc in docs]