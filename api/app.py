# import eventlet # <-- REMOVE
# eventlet.monkey_patch(select=True, socket=True, thread=False, time=True) # <-- REMOVE

import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import json
import logging
import time
from datetime import datetime
import firebase_admin
from firebase import auth
from firebase_admin import credentials, firestore, auth as firebase_auth
import firestore_models  # Import our new Firestore models
from collections import defaultdict
import mimetypes
import cannon_handler  # Import the cannon handler module
import player_handler  # Import the player handler module
import harpoon_handler # <-- Import the new harpoon handler
import requests # <-- Add requests for HTTP calls
import projectile_manager # <-- Import the new manager
import sys # Import sys for stdout redirection
import httpx # <-- ADD
import asyncio # <-- ADD

# Configure logging to show logs even when running as WSGI
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(stream=sys.stdout)  # Force output to stdout for WSGI
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# --- Discord Integration Configuration ---
DISCORD_BOT_URL = os.environ.get("DISCORD_BOT_URL", "http://127.0.0.1:5002") # URL of your discord_bot.py Flask API
DISCORD_SHARED_SECRET = os.environ.get("DISCORD_SHARED_SECRET", "default_secret_key") # Secret key for API security
# --- End Discord Integration Configuration ---


# Configure logging based on environment
env = os.environ.get('FLASK_ENV_RUN', 'development')
log_level = logging.DEBUG if env == 'development' else logging.INFO

logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()  # Ensure logs go to console/terminal
    ]
)

# Change Werkzeug logger level to ERROR to hide HTTP request logs
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)  # Changed from INFO to ERROR to hide polling requests

# Set Firebase logging to a higher level to reduce token logging
firebase_logger = logging.getLogger('firebase_admin')
firebase_logger.setLevel(logging.WARNING)  # Changed from DEBUG to WARNING


# Initialize Flask app and Socket.IO
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'ship_game_secret_key')

# Set up Socket.IO with appropriate async mode for production compatibility
# Use 'asgi' for Uvicorn. Keep existing CORS settings. Remove ping settings for now unless needed later.
socketio = SocketIO(app,
                    cors_allowed_origins=os.environ.get('SOCKETIO_CORS_ALLOWED_ORIGINS', '*'),
                    async_mode='asgi') # <-- CHANGE 'eventlet' to 'asgi'

# Keep a session cache for quick access
players = {}
islands = {}

# Add this near your other global variables
last_db_update = defaultdict(float)  # Track last database update time for each player
DB_UPDATE_INTERVAL = 2  # seconds between database updates
# Add new distance threshold constant and tracking dictionary
MIN_POSITION_UPDATE_DISTANCE = 20  # minimum distance in units to trigger a database update
last_db_positions = {}  # Track last database position for each player

# Add this near your other global variables (at the top of the file)
socket_to_user_map = {}

# Add these MIME type registrations after your existing imports
# Register GLB and GLTF MIME types
mimetypes.add_type('model/gltf-binary', '.glb')
mimetypes.add_type('model/gltf+json', '.gltf')

# Set up the static file directory path
STATIC_FILES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
os.makedirs(STATIC_FILES_DIR, exist_ok=True)


def init_firebase():
    # Initialize Firebase and Firestore (instead of SQLAlchemy)
    firebase_cred_path = os.environ.get('FIREBASE_CREDENTIALS', 'firebasekey.json')
    cred = credentials.Certificate(firebase_cred_path)
    firebase_app = firebase_admin.initialize_app(cred)
    db = firestore.client()

    # Initialize our Firestore models with the Firestore client
    firestore_models.init_firestore(db)
    auth.init_auth(firebase_app)

    return firebase_app, db

# Call init_firebase and store results - needed for models
firebase_app, db = init_firebase()

# --- Discord Integration Helper ---
# Modify the inner task to be async and use httpx
async def send_to_discord_bot_task(event_type, payload):
    """Async task to send event to Discord bot using httpx."""
    try:
        url = f"{DISCORD_BOT_URL}/game_event"
        headers = {
            'Content-Type': 'application/json',
            'X-Secret-Key': DISCORD_SHARED_SECRET
        }
        data = {
            'type': event_type,
            'payload': payload
        }
        # Use httpx.AsyncClient for non-blocking HTTP POST
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, json=data, headers=headers)
            response.raise_for_status() # Raise exception for 4xx/5xx status codes
        logger.info(f"Sent '{event_type}' event to Discord bot via httpx.")
    except httpx.RequestError as e:
        logger.error(f"Failed to send event to Discord bot (httpx request error): {e}")
    except Exception as e:
        logger.error(f"Unexpected error sending event to Discord bot: {e}")

def send_to_discord_bot(event_type, payload):
    """Sends an event to the Discord bot's API endpoint in a background task."""
    if not DISCORD_BOT_URL:
        # logger.warning("DISCORD_BOT_URL not set. Skipping Discord notification.")
        return # Silently fail if not configured
    
    if os.environ.get('FLASK_ENV_RUN', 'development') == 'development':
        return # Silently fail if in development mode

    # Start the async task using socketio's background task manager
    socketio.start_background_task(send_to_discord_bot_task, event_type, payload)
# --- End Discord Integration Helper ---


# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    logger.error(f"Client disconnected: {request.sid}")
    
    # Look up the player ID from our mapping
    player_id = socket_to_user_map.pop(request.sid, None)
   # logger.error(f'request.sid: {request.sid}')
    #logger.error(f"Socket to user map: {socket_to_user_map}")
 
 #   logger.error(f"Player ID: {player_id}")
  #  logger.error(f"Players: {players}")
    
    # If this was a player, mark them as inactive
    if player_id and player_id in players:
        # Update player in Firestore and cache
        firestore_models.Player.update(player_id, active=False, last_update=time.time())
        if player_id in players:
            players[player_id]['active'] = False
            
            # Broadcast that the player disconnected
            emit('player_disconnected', {'id': player_id}, broadcast=True)
            logger.error(f"Player {player_id} marked as inactive after disconnect")

@socketio.on('player_join')
async def handle_player_join(data): # <-- Add async
    # Get the Firebase token and UID from the request
    firebase_token = data.get('firebaseToken')
    claimed_firebase_uid = data.get('player_id')
    player_doc_id = None # Variable to store the docid for notification

    # ONLY proceed with database storage if Firebase authentication is provided and valid
    if firebase_token and claimed_firebase_uid:
        # Await the async verification function
        verified_uid = await auth.verify_firebase_token(firebase_token) # <-- Add await

        if verified_uid and verified_uid == claimed_firebase_uid:
            #logger.info(f"Authentication successful for Firebase user: {verified_uid}")
            player_id = verified_uid
            
            # Store player_id directly on request for simplicity
            request.player_id = player_id
            
            # Store in our socket-to-user mapping
            #logger.info(f"Mapped socket {request.sid} to user {player_id}")
            
            # Now proceed with database operations
            docid = "firebase_" + player_id
            player_doc_id = docid # Store for later use

            socket_to_user_map[request.sid] = docid

            # --- Blocking Firestore Call ---
            existing_player = firestore_models.Player.get(docid)
            # --- Consider wrapping above line in asyncio.to_thread if needed ---
            # existing_player = await asyncio.to_thread(firestore_models.Player.get, docid)

            if existing_player:
                # Update the existing player in database
                player_data = {
                    'active': True,
                    'last_update': time.time(),
                    'health': 100,  # Reset health when player rejoins
                }
                
                # --- Blocking Firestore Call ---
                firestore_models.Player.update(docid, **player_data)
                # --- Consider wrapping above line in asyncio.to_thread if needed ---
                # await asyncio.to_thread(firestore_models.Player.update, docid, **player_data)
                
                # Update cache
                players[docid] = {**existing_player, **player_data}
            else:
                # Create new player entry with stats
                player_data = {
                    'name': data.get('name', f'Sailor {player_id[:4]}'),
                    'color': data.get('color', {'r': 0.3, 'g': 0.6, 'b': 0.8}),
                    'position': data.get('position', {'x': 0, 'y': 0, 'z': 0}),
                    'rotation': data.get('rotation', 0),
                    'mode': data.get('mode', 'boat'),
                    'last_update': time.time(),
                    'fishCount': 0,
                    'monsterKills': 0,
                    'money': 0,
                    'health': 100,  # Default health for new players
                    'active': True,  # Mark as active when they join
                    'firebase_uid': verified_uid
                }
                
                # --- Blocking Firestore Call ---
                player = firestore_models.Player.create(docid, **player_data)
                # --- Consider wrapping above line in asyncio.to_thread if needed ---
                # player = await asyncio.to_thread(firestore_models.Player.create, docid, **player_data)
                players[docid] = player


             # Get existing player from Firestore before sending connection response
            
            auth_player_data = existing_player if existing_player else player_data
            
            emit('connection_response', auth_player_data)

            # Broadcast to all clients that a new player joined
            emit('player_joined', players[docid], broadcast=True)

            # --- Send notification to Discord ---
            if player_doc_id and player_doc_id in players:
                 send_to_discord_bot('player_join', {'name': players[player_doc_id].get('name', 'Unknown')})
            # --- End Discord notification ---


        else:
            logger.warning(f"Firebase token verification failed. No data will be stored.")
            emit('auth_error', {'message': 'Authentication failed'})
            return
    else:
        logger.warning(f"No Firebase authentication provided. No data will be stored.")
        emit('auth_required', {'message': 'Firebase authentication required'})
        return
    
    # Send game data regardless of auth status (read-only operations)
    # Send existing ACTIVE players to the new player
    active_players = [p for p in players.values() if p.get('active', False)]
    emit('all_players', active_players)
    
    # Send all islands to the new player
    emit('all_islands', list(islands.values()))
    
    # Send recent messages to the new player
    recent_messages = firestore_models.Message.get_recent_messages(limit=20)
    emit('chat_history', recent_messages)
    
    # Send leaderboard data to the new player
    emit('leaderboard_update', firestore_models.Player.get_combined_leaderboard())

@socketio.on('update_position')
def handle_position_update(data):
    # Get the player ID from the request data
    player_id = data.get('player_id')
    if not player_id:
        logger.warning("Missing player ID in position update. Ignoring.")
        return

    # Extract individual position components
    x = data.get('x')
    y = data.get('y')
    z = data.get('z')
    rotation = data.get('rotation')
    mode = data.get('mode')
    
    # Validate required fields
    if x is None or z is None:  # y can be 0, so check None specifically
        logger.warning("Missing position data in update. Ignoring.")
        return
    
    # Ensure player exists in cache
    if player_id not in players:
        logger.warning(f"Player ID {player_id} not found in cache. Ignoring position update.")
        return
    
    # Periodically clean up expired cannons (approximately every 5 position updates)
    # This spreads the cleanup task across multiple players/requests
    if hash(player_id) % 5 == 0:  # Simple way to select ~20% of updates to perform cleanup
        try:
            cannon_handler.cleanup_expired_cannons()
        except Exception as e:
            logger.error(f"Error cleaning up cannons: {str(e)}")
    
    current_time = time.time()
    
    # Construct position object for storage
    position = {
        'x': x,
        'y': y,
        'z': z
    }
    
    # Always update in-memory cache immediately for responsive gameplay
    players[player_id]['position'] = position
    if rotation is not None:
        players[player_id]['rotation'] = rotation
    if mode is not None:
        players[player_id]['mode'] = mode
    players[player_id]['last_update'] = current_time
    
    # Calculate distance from last stored database position (if available)
    should_update_db = False
    if player_id not in last_db_positions:
        # First time seeing this player, always update
        should_update_db = True
    else:
        # Calculate distance between current and last stored position
        last_pos = last_db_positions[player_id]
        dx = x - last_pos['x']
        dy = y - last_pos['y']
        dz = z - last_pos['z']
        distance = (dx*dx + dy*dy + dz*dz) ** 0.5  # Euclidean distance

        # logger.info(f"Distance between current and last stored position: {distance}")
        
        # Update if moved more than threshold distance
        if distance > MIN_POSITION_UPDATE_DISTANCE:
            should_update_db = True
    
    # Throttle database updates to reduce Firestore writes
    if current_time - last_db_update.get(player_id, 0) > DB_UPDATE_INTERVAL and should_update_db:
        last_db_update[player_id] = current_time
        last_db_positions[player_id] = position  # Update the last known DB position
        
        # Build update data with only necessary fields
        update_data = {
            'position': position,
            'last_update': current_time
        }
        if rotation is not None:
            update_data['rotation'] = rotation
        if mode is not None:
            update_data['mode'] = mode
        
        # Update in Firestore
        firestore_models.Player.update(player_id, **update_data)
        logger.debug(f"Updated player {player_id} position in Firestore (distance threshold)")
    
    # Broadcast to all other clients (not back to sender)
    emit_data = {
        'id': player_id,
        'position': position
    }
    if rotation is not None:
        emit_data['rotation'] = rotation
    if mode is not None:
        emit_data['mode'] = mode
        
    emit('player_moved', emit_data, broadcast=True, include_self=False)

@socketio.on('player_action')
def handle_player_action(data):
    # Get both action and type fields (to handle client inconsistencies)
    action_type = data.get('action') or data.get('type')
    
    # Simplified: Just use the player_id from the current request
    player_id = data.get('player_id')

    logger.info(f"Player action data: {data}, player_id: {player_id}")
    
    # Check if player_id is available and valid
    if not player_id or not player_id.startswith('firebase_'):
        logger.warning(f"Missing or invalid player ID. Ignoring action.")
        return
    
    # Ensure player exists
    if player_id not in players:
        logger.warning(f"Player ID {player_id} not found in cache. Ignoring action.")
        return
    
    if action_type == 'fish_caught':
        # Increment fish count
        if 'fishCount' not in players[player_id]:
            players[player_id]['fishCount'] = 0
        players[player_id]['fishCount'] += 1
        
        # Update player in Firestore
        firestore_models.Player.update(player_id, 
                                     fishCount=players[player_id]['fishCount'])
        
        # Broadcast achievement to all players
        emit('player_achievement', {
            'id': player_id,
            'name': players[player_id]['name'],
            'achievement': 'Caught a fish!',
            'fishCount': players[player_id]['fishCount']
        }, broadcast=True)
        
        # Update leaderboard
        emit('leaderboard_update', 
             firestore_models.Player.get_combined_leaderboard(), 
             broadcast=True)
    
    elif action_type == 'monster_killed':
        # Increment monster kills
        if 'monsterKills' not in players[player_id]:
            players[player_id]['monsterKills'] = 0
        players[player_id]['monsterKills'] += 1
        
        # Update player in Firestore
        firestore_models.Player.update(player_id, 
                                     monsterKills=players[player_id]['monsterKills'])
        
        # Broadcast achievement to all players
        emit('player_achievement', {
            'id': player_id,
            'name': players[player_id]['name'],
            'achievement': 'Defeated a sea monster!',
            'monsterKills': players[player_id]['monsterKills']
        }, broadcast=True)
        
        # Update leaderboard
        emit('leaderboard_update', 
             firestore_models.Player.get_combined_leaderboard(), 
             broadcast=True)
    
    elif action_type == 'money_earned':
        amount = data.get('amount', 0)
        
        # Add money
        if 'money' not in players[player_id]:
            players[player_id]['money'] = 0
        players[player_id]['money'] += amount
        
        # Update player in Firestore
        firestore_models.Player.update(player_id, 
                                     money=players[player_id]['money'])
        
        # Broadcast achievement to all players
        emit('player_achievement', {
            'id': player_id,
            'name': players[player_id]['name'],
            'achievement': f'Earned {amount} coins!',
            'money': players[player_id]['money']
        }, broadcast=True)
        
        # Update leaderboard
        emit('leaderboard_update', 
             firestore_models.Player.get_combined_leaderboard(), 
             broadcast=True)

@socketio.on('send_message')
def handle_chat_message(data):
    # Log the entire data payload
    #print(f"=====================================")
    #logger.error(f"CHAT DEBUG: Message data received: {data}")
    #ogger.error(f"CHAT DEBUG: Message data received: {data}")
    
    # Handle different message formats
    if isinstance(data, str):
        #print(f"CHAT DEBUG: Data is a string, converting to object")
        content = data.strip()
        player_id = None
        player_name = None
    else:
        content = data.get('content', '').strip()
        player_id = data.get('player_id', None)
        player_name = data.get('player_name', None)

   # print(f"CHAT DEBUG: Content: '{content}'")
    #print(f"CHAT DEBUG: Player ID: '{player_id}'")
    #print(f"CHAT DEBUG: Player Name: '{player_name}'")
    
    # Validate message
    if not content or len(content) > 500:
        logger.warning(f"CHAT DEBUG: Invalid message content (empty or too long): '{content}'")
        return
    
    # Check if player_id is available and valid
    if not player_id or not player_id.startswith('firebase_'):
        logger.warning(f"CHAT DEBUG: Missing or invalid player ID: {player_id}. Ignoring chat message.")
        return

    # If player_name wasn't provided, try to get it from our players cache
    if not player_name and player_id in players:
        player_name = players[player_id].get('name', 'Unknown Sailor')
        #print(f"CHAT DEBUG: Retrieved player name from cache: {player_name}")

    # IMPORTANT: Always use the client-provided name if available
    final_name = player_name or 'Unknown Sailor'
    #print(f"CHAT DEBUG: FINAL NAME FOR CHAT: {final_name}")
    
    # Send message object with more info instead of just content
    message_obj = {
        'content': content,
        'player_id': player_id,
        'sender_name': final_name,
        'timestamp': datetime.now().isoformat()
    }
    
    #print(f"CHAT DEBUG: Broadcasting message object: {message_obj}")
    logger.info(f"CHAT DEBUG: Broadcasting message with player name: '{final_name}'")
    
    # IMPORTANT: Make sure we're sending the OBJECT, not just the content string
    try:
        # Send as JSON to ensure proper serialization
        emit('new_message', message_obj, broadcast=True)
        # --- Send chat message to Discord ---
        send_to_discord_bot('chat', message_obj)
        # --- End Discord chat sending ---
    except Exception as e:
        #print(f"CHAT DEBUG: ERROR BROADCASTING MESSAGE: {str(e)}")
        logger.error(f"CHAT DEBUG: Error broadcasting message: {str(e)}")
    
    #print(f"=====================================")

@socketio.on('update_player_color')
def handle_update_player_color(data):
    """
    Update a player's color
    Expects: { player_id, color: {r, g, b} }
    """
    player_id = data.get('player_id')
    if not player_id:
        logger.warning("Missing player ID in color update. Ignoring.")
        return
    
    color = data.get('color')
    if not color:
        logger.warning("Missing color data in update. Ignoring.")
        return
    
    # Ensure player exists in cache
    if player_id not in players:
        logger.warning(f"Player ID {player_id} not found in cache. Ignoring color update.")
        return
    
    # Update in-memory cache
    players[player_id]['color'] = color
    
    # Update in Firestore directly with the data
    firestore_models.Player.update(player_id, color=color)
    logger.info(f"Updated player {player_id} color to {color}")
    
    # Broadcast to all other clients
    emit('player_updated', {
        'id': player_id,
        'color': color
    }, broadcast=True)

@socketio.on('update_player_name')
def handle_update_player_name(data):
    """
    Update a player's name
    Expects: { player_id, name }
    """
    print(f"DEBUG: Received player name update: {data}")
    logger.info(f"Received player name update: {data}")
    
    player_id = data.get('player_id')
    if not player_id:
        logger.warning("Missing player ID in name update. Ignoring.")
        return
    
    name = data.get('name')
    print(f"DEBUG: Name from update: '{name}'")
    
    if not name or not isinstance(name, str):
        logger.warning(f"Invalid name in update (empty or not a string): '{name}'. Ignoring.")
        return
    
    # Apply server-side sanitization for extra security
    sanitized_name = sanitize_player_name(name)
    print(f"DEBUG: Sanitized name: '{sanitized_name}'")
    
    if not sanitized_name or len(sanitized_name) < 2:
        logger.warning(f"Name invalid after sanitization: '{name}' -> '{sanitized_name}'. Ignoring.")
        return
        
    if len(sanitized_name) > 50:
        logger.warning(f"Name too long ({len(sanitized_name)} chars): '{sanitized_name}'. Truncating.")
        sanitized_name = sanitized_name[:50]
    
    # Ensure player exists in cache
    if player_id not in players:
        logger.warning(f"Player ID {player_id} not found in cache. Ignoring name update.")
        return
    
    # Log previous player name for debugging
    prev_name = players[player_id].get('name', 'Unknown')
    print(f"DEBUG: Updating player {player_id} name from '{prev_name}' to '{sanitized_name}'")
    
    # Update in-memory cache
    players[player_id]['name'] = sanitized_name
    
    # Update in Firestore directly
    firestore_models.Player.update(player_id, name=sanitized_name)
    logger.info(f"Updated player {player_id} name to {sanitized_name}")
    
    # Broadcast to all other clients
    emit('player_updated', {
        'id': player_id,
        'name': sanitized_name
    }, broadcast=True)
    
    print(f"DEBUG: Broadcast player name update: {player_id} = '{sanitized_name}'")

def sanitize_player_name(name):
    """
    Sanitize player names to prevent XSS attacks and ensure valid formatting
    """
    # Skip if name is None
    if name is None:
        return None
        
    # Basic HTML sanitization
    import re
    
    # Remove potentially dangerous HTML/JS characters
    sanitized = re.sub(r'<[^>]*>', '', name)  # Remove HTML tags
    sanitized = re.sub(r'&[^;]+;', '', sanitized)  # Remove HTML entities
    
    # Remove other potentially problematic characters
    sanitized = sanitized.replace('\\', '')
    sanitized = sanitized.replace('/', '')
    sanitized = sanitized.replace('"', '')
    sanitized = sanitized.replace("'", '')
    
    # Allow clan tags in square brackets but sanitize their content
    def sanitize_clan_tags(match):
        # Extract the clan tag content (without brackets)
        clan_content = match.group(1)
        # Sanitize the clan content
        clean_content = re.sub(r'[<>&\\/\'"]', '', clan_content)
        # Return with brackets
        return f"[{clean_content}]"
    
    # Pattern matches [anything]
    sanitized = re.sub(r'\[(.*?)\]', sanitize_clan_tags, sanitized)
    
    # Trim whitespace and return
    return sanitized.strip()

# API endpoints
@app.route('/api/players', methods=['GET'])
def get_players():
    """Get all active players"""
    active_players = [p for p in players.values() if p.get('active', False)]
    return jsonify(active_players)

@app.route('/api/players/<player_id>', methods=['GET'])
def get_player(player_id):
    """Get a specific player"""
    player = firestore_models.Player.get(player_id)
    if player:
        return jsonify(player)
    return jsonify({'error': 'Player not found'}), 404

@app.route('/api/islands', methods=['GET'])
def get_islands():
    """Get all islands"""
    return jsonify(list(islands.values()))

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    """Get the combined leaderboard"""
    return jsonify(firestore_models.Player.get_combined_leaderboard())

@app.route('/api/messages', methods=['GET'])
def get_messages():
    """Get recent chat messages"""
    message_type = request.args.get('type', 'global')
    limit = int(request.args.get('limit', 50))
    messages = firestore_models.Message.get_recent_messages(limit=limit, message_type=message_type)
    return jsonify(messages)

@app.route('/api/admin/create_island', methods=['POST'])
def create_island():
    """Admin endpoint to create an island"""
    data = request.json
    
    # Basic validation
    if not data or 'position' not in data:
        return jsonify({'error': 'Invalid island data'}), 400
    
    # Generate island ID
    island_id = f"island_{int(time.time())}"
    
    # Create island in Firestore
    island = firestore_models.Island.create(island_id, **data)
    
    # Add to cache
    islands[island_id] = island
    
    # Broadcast to all clients
    socketio.emit('island_created', island)
    
    return jsonify(island)

@socketio.on('add_to_inventory')
def handle_add_to_inventory(data):
    """
    Handle adding items to player's inventory
    Expects: { player_id, item_type (fish/treasure), item_name, item_data }
    """
    player_id = data.get('player_id')
    if not player_id:
        logger.warning("Missing player ID in inventory update. Ignoring.")
        return
    
    # Ensure player exists in cache
    if player_id not in players:
        logger.warning(f"Player ID {player_id} not found in cache. Ignoring inventory update.")
        return
    
    item_type = data.get('item_type')
    item_name = data.get('item_name')
    item_data = data.get('item_data', {})
    
    if not item_type or not item_name:
        logger.warning("Missing item type or name in inventory update. Ignoring.")
        return
    
    result = None
    
    # Add to appropriate inventory type
    if item_type == 'fish':
        result = firestore_models.Inventory.add_fish(player_id, item_name, item_data)
        logger.info(f"Added fish '{item_name}' to player {player_id}'s inventory")
    elif item_type == 'treasure':
        result = firestore_models.Inventory.add_treasure(player_id, item_name, item_data)
        logger.info(f"Added treasure '{item_name}' to player {player_id}'s inventory")
    else:
        logger.warning(f"Unknown item type '{item_type}' in inventory update. Ignoring.")
        return
    
    # Send updated inventory to the player
    if result:
        emit('inventory_updated', result)

# Add API endpoint to get player inventory
@app.route('/api/players/<player_id>/inventory', methods=['GET'])
def get_player_inventory(player_id):
    print(f"DEBUG: Getting player inventory for {player_id}")
    #logger.error(f"DEBUG: Getting player inventory for {player_id}")
    """Get a player's inventory"""
    inventory = firestore_models.Inventory.get(player_id)
    if inventory:
        return jsonify(inventory)
    return jsonify({'error': 'Inventory not found'}), 404

@socketio.on('get_inventory')
def handle_get_inventory(data):
    """
    Handle request for player inventory
    Expects: { player_id }
    """
    #print(f"DEBUG: Getting inventory for {data}")
    #logger.error(f"DEBUG: Getting inventory for {data}")
    player_id = data.get('player_id')
    if not player_id:
        logger.warning("Missing player ID in inventory request. Ignoring.")
        return
    
    # Get inventory
    inventory = firestore_models.Inventory.get(player_id)
    
    # Send inventory data back to the requesting client only
    if inventory:
        emit('inventory_data', inventory)
    else:
        emit('inventory_data', {'error': 'Inventory not found'})

# --- Discord Integration Endpoint ---
@app.route('/discord_message', methods=['POST'])
def handle_discord_message():
    """Receives messages from the Discord bot."""
    # Security check
    auth_secret = request.headers.get('X-Secret-Key')
    if auth_secret != DISCORD_SHARED_SECRET:
        logger.warning("Received unauthorized request to /discord_message")
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json
    author = data.get('author')
    content = data.get('content')

    if not author or not content:
        logger.warning("Received invalid data on /discord_message")
        return jsonify({"error": "Invalid data"}), 400

    # Format message for in-game chat
    # Using a distinct name format to indicate it's from Discord
    sender_name = f"[Discord] {author}"
    message_obj = {
        'content': content,
        'player_id': 'discord_bot', # Use a special ID for bot messages
        'sender_name': sender_name,
        'timestamp': datetime.now().isoformat()
    }

    # Broadcast the message to all connected game clients
    try:
        socketio.emit('new_message', message_obj)
        logger.info(f"Broadcasted Discord message from '{author}' to game clients.")
        return jsonify({"status": "success"}), 200
    except Exception as e:
        logger.error(f"Error broadcasting Discord message to game clients: {e}")
        return jsonify({"error": "Failed to broadcast message"}), 500
# --- End Discord Integration Endpoint ---

# --- Asynchronous Data Loading ---
# Modify the inner task to be async and use asyncio.to_thread for blocking calls
async def load_initial_data_task():
    """Async task to load initial data using asyncio.to_thread for blocking calls."""
    try:
        logger.info("Starting asynchronous Firestore data load task...")

        # Load players using asyncio.to_thread
        logger.debug("Loading players from Firestore...")
        db_players = await asyncio.to_thread(firestore_models.Player.get_all)
        logger.debug(f"Found {len(db_players)} player documents.")
        loaded_player_count = 0
        for player_doc in db_players:
            player_id = player_doc.get('id')
            if not player_id:
                logger.warning("Skipping player document with missing ID.")
                continue

            # Set all players to inactive on server start
            if player_doc.get('active', False):
                try:
                    # Update Firestore document to inactive using asyncio.to_thread
                    await asyncio.to_thread(firestore_models.Player.update, player_id, active=False)
                    player_doc['active'] = False # Update the dictionary we're about to cache
                    logger.debug(f"Marked player {player_id} as inactive during startup.")
                except Exception as update_err:
                    logger.error(f"Failed to mark player {player_id} inactive during startup load: {update_err}")

            players[player_id] = player_doc # Add player data to cache
            loaded_player_count += 1

        # Load islands using asyncio.to_thread
        logger.debug("Loading islands from Firestore...")
        db_islands = await asyncio.to_thread(firestore_models.Island.get_all)
        logger.debug(f"Found {len(db_islands)} island documents.")
        loaded_island_count = 0
        for island_doc in db_islands:
             island_id = island_doc.get('id')
             if not island_id:
                 logger.warning("Skipping island document with missing ID.")
                 continue
             islands[island_id] = island_doc
             loaded_island_count += 1

        logger.info(f"Asynchronous load task complete: Loaded {loaded_player_count} players and {loaded_island_count} islands.")

    except Exception as e:
        logger.error(f"Error during asynchronous Firestore data load task: {e}", exc_info=True)

def load_initial_data_from_firestore():
    """Initiates the asynchronous loading of initial data from Firestore."""
    # Start the async task. SocketIO under ASGI should handle this correctly.
    socketio.start_background_task(load_initial_data_task)
    logger.info("Initiated asynchronous Firestore data loading task.")
# --- End Asynchronous Data Loading ---

if __name__ == '__main__':
    # Get environment setting with development as default
    env = os.environ.get('FLASK_ENV_RUN', 'development')
    port = int(os.environ.get('PORT', 5001))
    
    # Initialize Handlers and Managers
    projectile_manager.init_manager(socketio)
    cannon_handler.init_socketio(socketio, players)
    player_handler.init_handler(socketio, players)
    harpoon_handler.init_socketio(socketio, players)

    # Start loading data asynchronously after everything else is set up
    load_initial_data_from_firestore()

    if env == 'development':
        # Run the Socket.IO server with debug and reloader enabled for development
        socketio.run(app, host='0.0.0.0', port=port, debug=True, use_reloader=False)
    else:
        # In production, this app will be run using Gunicorn with Eventlet workers
        # Command: gunicorn --worker-class eventlet -w 1 app:app
        # The WSGI server will use the Flask app directly, not socketio.run
        print(f"Running in production mode - use Gunicorn to serve this application")
        print(f"Example command: gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:{port} app:app")
        
        # For direct execution in production mode without Gunicorn, we can still run with
        # socketio but with production-appropriate settings
        # socketio.run(app, host='0.0.0.0', port=port, debug=False, use_reloader=False)

# For WSGI servers (Gunicorn) - this is the WSGI application to run
# The Socket.IO instance works as a WSGI application
# application = socketio.wsgi_app
