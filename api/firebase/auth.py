import logging
from firebase_admin import auth as firebase_auth

# Configure logger
logger = logging.getLogger(__name__)

# This will be set during initialization
firebase_app = None

def init_auth(firebase_application):
    """Initialize the auth module with a Firebase application instance"""
    global firebase_app
    firebase_app = firebase_application
    logger.info("Firebase Auth module initialized")

# Socket to user mapping (moved from app.py)
socket_to_user_map = {}

def verify_firebase_token(token):
    """Verify Firebase token and return the UID if valid"""
    try:
        if not token:
            logger.warning("No token provided for verification")
            return None
            
        logger.info("Attempting to verify Firebase token")
        
        # Verify the token
        decoded_token = firebase_auth.verify_id_token(token)
        
        # Get user UID from the token
        uid = decoded_token['uid']
        logger.info(f"Successfully verified Firebase token for user: {uid}")
        return uid
    except Exception as e:
       # logger.error(f"Error verifying Firebase token: {e}")
        logger.exception("Token verification exception details:")  # This logs the full stack trace
        return None


def register_socket_user(socket_id, user_id):
    """Associate a socket ID with a user ID"""
    socket_to_user_map[socket_id] = user_id
    logger.info(f"Mapped socket {socket_id} to user {user_id}")
    return True

def get_user_from_socket(socket_id):
    """Get the user ID associated with a socket ID"""
    return socket_to_user_map.pop(socket_id, None)

def is_authenticated_id(player_id):
    """Check if a player ID is properly authenticated (has firebase_ prefix)"""
    return player_id and player_id.startswith('firebase_')

def format_firebase_id(uid):
    """Format a Firebase UID into our internal ID format"""
    return f"firebase_{uid}"
