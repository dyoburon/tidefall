import discord
from discord.ext import commands
import os
from dotenv import load_dotenv
import asyncio
import requests
from flask import Flask, request, jsonify
import threading
import logging

# --- Configuration ---
load_dotenv() # Load environment variables from .env

BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
CHANNEL_ID = int(os.environ.get("DISCORD_CHANNEL_ID")) # Channel to listen/post messages
GAME_SERVER_URL = os.environ.get("GAME_SERVER_URL", "http://127.0.0.1:5000") # URL of your app.py Flask server
BOT_API_PORT = int(os.environ.get("DISCORD_BOT_API_PORT", 5002)) # Port for this bot's Flask API
SHARED_SECRET = os.environ.get("DISCORD_SHARED_SECRET", "default_secret_key") # Secret key for API security

# --- Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Discord Bot Setup ---
intents = discord.Intents.default()
intents.messages = True
intents.message_content = True # Ensure message content intent is enabled in Discord Dev Portal
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)

# --- Flask App Setup (for receiving messages from game server) ---
flask_app = Flask(__name__)

# Disable Flask's default logging to avoid duplicate logs
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)

@flask_app.route('/game_event', methods=['POST'])
def handle_game_event():
    """Receives events (like chat, player join) from the game server."""
    # Security check
    auth_secret = request.headers.get('X-Secret-Key')
    if auth_secret != SHARED_SECRET:
        logger.warning("Received unauthorized request to /game_event")
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json
    message_type = data.get('type')
    payload = data.get('payload')

    if not message_type or not payload:
        logger.warning("Received invalid data on /game_event")
        return jsonify({"error": "Invalid data"}), 400

    # Use asyncio.run_coroutine_threadsafe for thread safety with discord.py
    if message_type == 'chat':
        message = f"**{payload.get('sender_name', 'Unknown')}**: {payload.get('content', '')}"
        asyncio.run_coroutine_threadsafe(send_to_discord_channel(message), bot.loop)
    elif message_type == 'player_join':
        message = f":arrow_right: *Player **{payload.get('name', 'Someone')}** has joined the game.*"
        asyncio.run_coroutine_threadsafe(send_to_discord_channel(message), bot.loop)
    # Add more event types here if needed

    return jsonify({"status": "success"}), 200

async def send_to_discord_channel(message):
    """Sends a message to the configured Discord channel."""
    try:
        channel = bot.get_channel(CHANNEL_ID)
        if channel:
            await channel.send(message)
            logger.info(f"Sent message to Discord channel {CHANNEL_ID}")
        else:
            logger.error(f"Could not find Discord channel with ID {CHANNEL_ID}")
    except Exception as e:
        logger.error(f"Error sending message to Discord: {e}")

# --- Discord Bot Events ---
@bot.event
async def on_ready():
    logger.info(f'Discord bot logged in as {bot.user.name}')
    logger.info(f'Monitoring channel ID: {CHANNEL_ID}')
    logger.info(f'Game server URL: {GAME_SERVER_URL}')
    logger.info(f'Flask API running on port {BOT_API_PORT}')

@bot.event
async def on_message(message):
    """Handles messages received from Discord."""
    # Ignore messages from the bot itself
    if message.author == bot.user:
        return

    # Only process messages from the designated channel
    if message.channel.id == CHANNEL_ID:
        logger.info(f"Received message from Discord channel {CHANNEL_ID}: '{message.content}' by {message.author.display_name}")
        await send_to_game_server(message)

    # Allow processing commands if needed (optional)
    # await bot.process_commands(message)

async def send_to_game_server(message):
    """Sends a message from Discord to the game server's API endpoint and adds a reaction."""
    try:
        payload = {
            'author': message.author.display_name,
            'content': message.content
        }
        headers = {
            'Content-Type': 'application/json',
            'X-Secret-Key': SHARED_SECRET # Include shared secret for security
        }
        response = requests.post(f"{GAME_SERVER_URL}/discord_message", json=payload, headers=headers, timeout=5)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        logger.info(f"Sent message to game server: {message.author.display_name}: {message.content}")
        
        # Add success reaction (rocket)
        await message.add_reaction('🚀')
    except (requests.exceptions.RequestException, Exception) as e:
        logger.error(f"Error sending message to game server: {e}")
        # Add failure reaction (red circle)
        await message.add_reaction('🔴')

# --- Main Execution ---
def run_flask():
    """Runs the Flask app in a separate thread."""
    try:
        # Use '0.0.0.0' to make it accessible externally if needed
        # Explicitly disable debug and reloader for threaded execution
        flask_app.run(host='0.0.0.0', port=BOT_API_PORT, debug=False, use_reloader=False)
    except Exception as e:
        logger.error(f"Flask server failed: {e}")

if __name__ == "__main__":
    if not BOT_TOKEN or not CHANNEL_ID:
        logger.error("Error: DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID must be set in environment variables or .env file.")
    else:
        # Start Flask in a separate thread
        flask_thread = threading.Thread(target=run_flask, daemon=True)
        flask_thread.start()

        # Start the Discord bot
        try:
            bot.run(BOT_TOKEN)
        except discord.LoginFailure:
            logger.error("Discord login failed. Check your BOT_TOKEN.")
        except Exception as e:
            logger.error(f"An error occurred running the Discord bot: {e}") 