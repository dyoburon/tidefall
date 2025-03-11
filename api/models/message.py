
class Message:
    """Message model for Firestore"""
    collection_name = 'messages'
    
    @staticmethod
    def collection():
        return db.collection(Message.collection_name)
    
    @staticmethod
    def to_dict(doc_snapshot):
        """Convert Firestore document to dictionary"""
        if not doc_snapshot.exists:
            return None
            
        data = doc_snapshot.to_dict()
        data['id'] = doc_snapshot.id
        
        # Simple string conversion for timestamp
        if 'timestamp' in data:
            data['timestamp'] = serialize_timestamp(data['timestamp'])
        
        return data
    
    @staticmethod
    def create(sender_id, content, message_type='global'):
        """Create new message"""
        # Create message data
        message_data = {
            'sender_id': sender_id,
            'content': content[:500],  # Limit message length
            'timestamp': time.time(),  # Use simple timestamp
            'message_type': message_type
        }
        
        # Create document with auto-generated ID
        doc_ref = Message.collection().document()
        doc_ref.set(message_data)
        
        # Get the created message
        created_message = Message.to_dict(doc_ref.get())
        
        # Also add sender info for convenience
        if created_message:
            sender = Player.get(sender_id)
            if sender:
                created_message['sender_name'] = sender.get('name', 'Unknown')
                created_message['sender_color'] = sender.get('color')
        
        return created_message
    
    @staticmethod
    def get(message_id):
        """Get message by ID"""
        doc_ref = Message.collection().document(message_id)
        message = Message.to_dict(doc_ref.get())
        
        # Add sender info
        if message:
            sender = Player.get(message['sender_id'])
            if sender:
                message['sender_name'] = sender.get('name', 'Unknown')
                message['sender_color'] = sender.get('color')
        
        return message
    
    @staticmethod
    def get_recent_messages(limit=50, message_type='global'):
        """
        Get recent messages of a specific type
        
        :param limit: Maximum number of messages to return
        :param message_type: Type of messages to retrieve ('global', 'team', etc.)
        :return: List of recent messages in chronological order
        """
        try:
            # Try the original query (will fail without index)
            docs = (Message.collection()
                    .where('message_type', '==', message_type)
                    .order_by('timestamp', direction=firestore.Query.DESCENDING)
                    .limit(limit)
                    .stream())
            
            # Convert to dictionaries
            messages = [Message.to_dict(doc) for doc in docs]
            
        except Exception as e:
            # Fallback: Get all messages of the specified type without ordering
            # Then sort them in memory (less efficient but works without index)
            print(f"Warning: Using fallback for message retrieval: {str(e)}")
            docs = Message.collection().where('message_type', '==', message_type).stream()
            messages = [Message.to_dict(doc) for doc in docs]
            
            # Sort by timestamp in memory
            messages.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
            
            # Limit the results
            messages = messages[:limit]
        
        # Add sender information to each message
        for message in messages:
            sender = Player.get(message['sender_id'])
            if sender:
                message['sender_name'] = sender.get('name', 'Unknown')
                message['sender_color'] = sender.get('color')
            else:
                message['sender_name'] = 'Unknown'
                message['sender_color'] = {'r': 0.5, 'g': 0.5, 'b': 0.5}
        
        # Reverse to get chronological order
        messages.reverse()
        return messages