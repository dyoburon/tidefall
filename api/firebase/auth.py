import logging
from firebase_admin import auth as firebase_auth
import asyncio
import time

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

async def verify_firebase_token(token):
    """Verifies the Firebase ID token asynchronously using asyncio.to_thread."""
    if not firebase_app:
        logger.error("Firebase app not initialized before verifying token.")
        return None
    if not token:
        logger.warning("No token provided for verification.")
        return None

    try:
        start_time = time.time()
        logger.info(f"Starting token verification via asyncio.to_thread for token: {token[:10]}...")

        # --- Use asyncio.to_thread to run the blocking call ---
        # Pass the function and its arguments
        decoded_token = await asyncio.to_thread(firebase_auth.verify_id_token, token)
        # -----------------------------------------------------

        end_time = time.time()
        duration = end_time - start_time
        logger.info(f"Token verification via asyncio.to_thread completed in {duration:.4f} seconds.")

        logger.debug(f"Token successfully verified for UID: {decoded_token.get('uid')}")
        return decoded_token.get('uid')
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        logger.error("Token verification exception details:", exc_info=True)
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
