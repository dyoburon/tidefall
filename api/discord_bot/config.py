"""
Configuration and shared state for the Discord bot.
"""
import os
import logging
from dotenv import load_dotenv
from collections import deque
from googleapiclient.discovery import build
from better_profanity import profanity

# Load environment variables
load_dotenv()

# --- Environment Variables ---
BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
CHANNEL_ID_STR = os.environ.get("DISCORD_CHANNEL_ID")
CHANNEL_ID = int(CHANNEL_ID_STR) if CHANNEL_ID_STR else None
GAME_SERVER_URL = os.environ.get("GAME_SERVER_URL", "http://127.0.0.1:5000")
BOT_API_PORT = int(os.environ.get("PORT", os.environ.get("DISCORD_BOT_API_PORT", 5002)))
SHARED_SECRET = os.environ.get("DISCORD_SHARED_SECRET", "default_secret_key")
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY")
YOUTUBE_CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID")
DISCORD_YOUTUBE_CHANNEL_ID_STR = os.environ.get("DISCORD_YOUTUBE_CHANNEL_ID")
DISCORD_YOUTUBE_CHANNEL_ID = int(DISCORD_YOUTUBE_CHANNEL_ID_STR) if DISCORD_YOUTUBE_CHANNEL_ID_STR else None
DISCORD_GITHUB_CHANNEL_ID_STR = os.environ.get("DISCORD_GITHUB_CHANNEL_ID")
DISCORD_GITHUB_CHANNEL_ID = int(DISCORD_GITHUB_CHANNEL_ID_STR) if DISCORD_GITHUB_CHANNEL_ID_STR else None
GITHUB_WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET")

# --- YouTube API Client ---
youtube = None
if YOUTUBE_API_KEY:
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)

# --- Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('discord_bot')

# --- Profanity Filter ---
profanity.load_censor_words()
profanity.add_censor_words(['hitler'])

# --- Shared State ---
feed_items = deque(maxlen=50)
feed_subscribers = []
working_subscribers = []
current_working_status = {'text': None, 'timestamp': None, 'mode': 'working', 'end_time': None}
saved_working_status = {'text': None, 'timestamp': None}
notified_livestreams = set()
