import discord
from discord import app_commands
from discord.ext import commands, tasks
import os
from dotenv import load_dotenv
import asyncio
import requests
from flask import Flask, request, jsonify
import threading
import logging
import hmac
import hashlib
import random
import time
from better_profanity import profanity
from googleapiclient.discovery import build

# --- Configuration ---
load_dotenv() # Load environment variables from .env

BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
CHANNEL_ID_STR = os.environ.get("DISCORD_CHANNEL_ID")
CHANNEL_ID = int(CHANNEL_ID_STR) if CHANNEL_ID_STR else None  # Channel to listen/post messages
GAME_SERVER_URL = os.environ.get("GAME_SERVER_URL", "http://127.0.0.1:5000") # URL of your app.py Flask server
BOT_API_PORT = int(os.environ.get("PORT", os.environ.get("DISCORD_BOT_API_PORT", 5002))) # Port for this bot's Flask API (Render sets PORT)
SHARED_SECRET = os.environ.get("DISCORD_SHARED_SECRET", "default_secret_key") # Secret key for API security
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY")
YOUTUBE_CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID")
DISCORD_YOUTUBE_CHANNEL_ID_STR = os.environ.get("DISCORD_YOUTUBE_CHANNEL_ID")
DISCORD_YOUTUBE_CHANNEL_ID = int(DISCORD_YOUTUBE_CHANNEL_ID_STR) if DISCORD_YOUTUBE_CHANNEL_ID_STR else None
DISCORD_GITHUB_CHANNEL_ID_STR = os.environ.get("DISCORD_GITHUB_CHANNEL_ID")
DISCORD_GITHUB_CHANNEL_ID = int(DISCORD_GITHUB_CHANNEL_ID_STR) if DISCORD_GITHUB_CHANNEL_ID_STR else None
GITHUB_WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET")  # Optional: for signature verification

youtube = None
if YOUTUBE_API_KEY:
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)

# --- Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Profanity Filter Setup ---
profanity.load_censor_words() # Load the default word list
# Optional: Add custom words if needed
profanity.add_censor_words(['hitler'])

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

# --- Feed Storage (for OBS overlay) ---
from collections import deque
import queue

feed_items = deque(maxlen=50)  # Store last 50 feed items
feed_subscribers = []  # SSE subscribers for real-time updates

# --- Working Status Storage (for OBS overlay) ---
current_working_status = {'text': None, 'timestamp': None, 'mode': 'working', 'end_time': None}
saved_working_status = {'text': None, 'timestamp': None}  # Saved status during breaks
working_subscribers = []  # SSE subscribers for working status updates

def update_working_status(text, mode='working', duration_minutes=None):
    """Update the current working status and notify all subscribers.

    Args:
        text: The status text to display
        mode: 'working' or 'break'
        duration_minutes: For break mode, how many minutes until break ends
    """
    global current_working_status, saved_working_status

    # If switching to break mode, save the current working status
    if mode == 'break' and current_working_status.get('mode') == 'working':
        saved_working_status = {
            'text': current_working_status.get('text'),
            'timestamp': current_working_status.get('timestamp')
        }

    end_time = None
    if mode == 'break' and duration_minutes:
        end_time = time.time() + (duration_minutes * 60)

    current_working_status = {
        'text': text,
        'timestamp': time.time() if text else None,
        'mode': mode,
        'end_time': end_time
    }

    # Notify all SSE subscribers
    _notify_working_subscribers(current_working_status)

def restore_working_status():
    """Restore the saved working status (used when canceling a break)."""
    global current_working_status, saved_working_status

    current_working_status = {
        'text': saved_working_status.get('text'),
        'timestamp': saved_working_status.get('timestamp'),
        'mode': 'working',
        'end_time': None
    }

    # Notify all SSE subscribers
    _notify_working_subscribers(current_working_status)

    return saved_working_status.get('text')

def _notify_working_subscribers(status):
    """Notify all SSE subscribers of a status update."""
    dead_subscribers = []
    for q in working_subscribers:
        try:
            q.put_nowait(status)
        except:
            dead_subscribers.append(q)

    # Clean up dead subscribers
    for q in dead_subscribers:
        if q in working_subscribers:
            working_subscribers.remove(q)

def add_feed_item(item_type, author, message, url=None, project=None):
    """Add an item to the feed and notify all subscribers."""
    item = {
        'id': f"{item_type}_{int(time.time() * 1000)}",
        'type': item_type,
        'author': author,
        'message': message,
        'url': url,
        'project': project,
        'timestamp': time.time()
    }
    feed_items.append(item)

    # Notify all SSE subscribers
    dead_subscribers = []
    for q in feed_subscribers:
        try:
            q.put_nowait(item)
        except:
            dead_subscribers.append(q)

    # Clean up dead subscribers
    for q in dead_subscribers:
        if q in feed_subscribers:
            feed_subscribers.remove(q)

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

    # Censor and Sanitize content coming *from* the game before sending to Discord
    message_to_send = ""
    if message_type == 'chat':
        sender_name = payload.get('sender_name', 'Unknown')
        content = payload.get('content', '')

        # Censor first
        censored_sender = profanity.censor(sender_name)
        censored_content = profanity.censor(content)

        # Then sanitize for Discord formatting
        safe_sender = discord.utils.escape_markdown(discord.utils.escape_mentions(censored_sender))
        safe_content = discord.utils.escape_markdown(discord.utils.escape_mentions(censored_content))
        message_to_send = f"**{safe_sender}**: {safe_content}"
    elif message_type == 'player_join':
        player_name = payload.get('name', 'Someone')

        # Censor first
        censored_player_name = profanity.censor(player_name)

        # Then sanitize for Discord formatting
        safe_player_name = discord.utils.escape_markdown(discord.utils.escape_mentions(censored_player_name))
        message_to_send = f":arrow_right: *Player **{safe_player_name}** has joined the game.*"
    # Add more event types here if needed (remember to censor and sanitize!)

    if message_to_send:
        # Use asyncio.run_coroutine_threadsafe for thread safety with discord.py
        asyncio.run_coroutine_threadsafe(send_to_discord_channel(message_to_send), bot.loop)

    return jsonify({"status": "success"}), 200

def verify_github_signature(payload_body, signature_header):
    """Verify the GitHub webhook signature if a secret is configured."""
    if not GITHUB_WEBHOOK_SECRET:
        return True  # Skip verification if no secret configured

    if not signature_header:
        return False

    hash_algorithm, signature = signature_header.split('=', 1)
    if hash_algorithm != 'sha256':
        return False

    expected_signature = hmac.new(
        GITHUB_WEBHOOK_SECRET.encode('utf-8'),
        payload_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)

@flask_app.route('/github-webhook', methods=['POST'])
def github_webhook():
    """Receives push events from GitHub and sends commit info to Discord."""
    # Verify signature if secret is configured
    if GITHUB_WEBHOOK_SECRET:
        signature = request.headers.get('X-Hub-Signature-256')
        if not verify_github_signature(request.data, signature):
            logger.warning("Received GitHub webhook with invalid signature")
            return jsonify({"error": "Invalid signature"}), 403

    # Only process push events
    event_type = request.headers.get('X-GitHub-Event')
    if event_type != 'push':
        logger.info(f"Ignoring GitHub event type: {event_type}")
        return jsonify({"status": "ignored", "reason": f"event type {event_type}"}), 200

    if not DISCORD_GITHUB_CHANNEL_ID:
        logger.warning("DISCORD_GITHUB_CHANNEL_ID not configured, ignoring GitHub webhook")
        return jsonify({"error": "GitHub channel not configured"}), 500

    data = request.json
    repo_name = data.get('repository', {}).get('name', 'Unknown repo')
    pusher = data.get('pusher', {}).get('name', 'Unknown')
    commits = data.get('commits', [])
    branch = data.get('ref', '').replace('refs/heads/', '')

    if not commits:
        logger.info(f"Push to {repo_name} with no commits (possibly branch delete)")
        return jsonify({"status": "ignored", "reason": "no commits"}), 200

    # Fun verbs for commit messages
    commit_verbs = [
        "shipped", "pushed", "deployed", "unleashed", "conjured",
        "manifested", "summoned", "crafted", "forged", "dropped",
        "launched", "beamed", "teleported", "cooked up"
    ]

    # Build the notification message
    for commit in commits:
        message_text = commit.get('message', 'No message')
        # Truncate long commit messages
        if len(message_text) > 200:
            message_text = message_text[:200] + '...'

        commit_url = commit.get('url', '')
        # Use GitHub username, not full name (username is in 'username' field, fallback to pusher)
        author = commit.get('author', {}).get('username') or pusher
        verb = random.choice(commit_verbs)

        # Sanitize for Discord
        safe_repo = discord.utils.escape_markdown(repo_name)
        safe_author = discord.utils.escape_markdown(author)
        safe_message = discord.utils.escape_markdown(message_text)

        discord_message = f"**{safe_author}** has {verb} `{safe_message}` to project **{safe_repo}** [→]({commit_url})"

        asyncio.run_coroutine_threadsafe(send_github_notification(discord_message), bot.loop)

        # Add to feed for OBS overlay
        add_feed_item(
            item_type='commit',
            author=author,
            message=f"has {verb} \"{message_text}\"",
            url=commit_url,
            project=repo_name
        )

    logger.info(f"Processed {len(commits)} commit(s) from {repo_name}")
    return jsonify({"status": "success", "commits_processed": len(commits)}), 200

async def send_github_notification(message):
    """Sends GitHub commit notification to the dedicated GitHub Discord channel."""
    try:
        channel = bot.get_channel(DISCORD_GITHUB_CHANNEL_ID)
        if channel:
            await channel.send(message)
            logger.info(f"Sent GitHub notification to Discord channel {DISCORD_GITHUB_CHANNEL_ID}")
        else:
            logger.error(f"Could not find Discord GitHub channel with ID {DISCORD_GITHUB_CHANNEL_ID}")
    except Exception as e:
        logger.error(f"Error sending GitHub notification to Discord: {e}")

# --- OBS Feed Endpoints ---
from flask import Response, stream_with_context
import json as json_module

FEED_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Feed</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
            background-color: rgba(0, 0, 0, 0) !important;
            background: transparent !important;
            overflow: hidden !important;
            font-family: 'JetBrains Mono', monospace;
        }

        #feed-container {
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        ::-webkit-scrollbar { display: none !important; }

        @keyframes slideIn {
            0% { opacity: 0; transform: translateX(-20px); }
            100% { opacity: 1; transform: translateX(0); }
        }

        @keyframes fadeOut {
            0% { opacity: 1; }
            100% { opacity: 0; }
        }

        .feed-item {
            animation: slideIn 0.3s ease-out both, fadeOut 1s ease-in forwards;
            animation-delay: 0s, 15s;
            background: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(4px);
            border-left: 4px solid #2ea043;
            border-radius: 4px 12px 12px 4px;
            padding: 14px 34px;
            width: fit-content;
            max-width: 90%;
            box-shadow: 2px 4px 10px rgba(0,0,0,0.5);
        }

        .feed-item.removing {
            animation: fadeOut 0.5s ease-out forwards;
        }

        .feed-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 6px;
        }

        .feed-icon {
            width: 36px;
            height: 36px;
            flex-shrink: 0;
        }

        .feed-author {
            font-size: 24px;
            font-weight: 700;
            color: #2ea043;
            letter-spacing: -0.5px;
        }

        .feed-message {
            font-size: 28px;
            color: #EEEEEE;
            line-height: 1.4;
            font-weight: 400;
        }

        .feed-project {
            color: #2ea043;
            font-weight: 700;
        }
    </style>
</head>
<body>
    <div id="feed-container"></div>

    <script>
        const container = document.getElementById('feed-container');
        const displayedItems = new Set();

        // GitHub icon SVG
        const githubIcon = `<svg class="feed-icon" viewBox="0 0 24 24" fill="#EEEEEE"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`;

        function addItem(item) {
            if (displayedItems.has(item.id)) return;
            displayedItems.add(item.id);

            const el = document.createElement('div');
            el.className = 'feed-item';
            el.id = item.id;

            let icon = githubIcon;
            let content = '';

            if (item.type === 'commit') {
                content = `
                    <div class="feed-header">
                        ${icon}
                        <span class="feed-author">${escapeHtml(item.author)}</span>
                    </div>
                    <div class="feed-message">
                        ${escapeHtml(item.message)} to <span class="feed-project">${escapeHtml(item.project)}</span>
                    </div>
                `;
            } else {
                content = `
                    <div class="feed-header">
                        ${icon}
                        <span class="feed-author">${escapeHtml(item.author || 'System')}</span>
                    </div>
                    <div class="feed-message">${escapeHtml(item.message)}</div>
                `;
            }

            el.innerHTML = content;
            container.insertBefore(el, container.firstChild);

            // Remove after animation completes (16 seconds = 15s delay + 1s fade)
            setTimeout(() => {
                el.classList.add('removing');
                setTimeout(() => {
                    el.remove();
                    displayedItems.delete(item.id);
                }, 500);
            }, 16000);

            // Keep only last 10 items visible
            while (container.children.length > 10) {
                const last = container.lastChild;
                displayedItems.delete(last.id);
                last.remove();
            }
        }

        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Server-Sent Events for real-time updates
        function connectSSE() {
            const evtSource = new EventSource('/feed/events');

            evtSource.onmessage = (event) => {
                try {
                    const item = JSON.parse(event.data);
                    addItem(item);
                } catch (e) {
                    console.error('Error parsing SSE data:', e);
                }
            };

            evtSource.onerror = () => {
                console.log('SSE connection lost, reconnecting...');
                evtSource.close();
                setTimeout(connectSSE, 3000);
            };
        }

        // Load existing items on page load
        fetch('/feed/items')
            .then(r => r.json())
            .then(items => {
                // Show last 5 items on load (oldest first so newest appears on top)
                items.slice(-5).forEach(item => addItem(item));
            })
            .catch(console.error);

        // Start SSE connection
        connectSSE();
    </script>
</body>
</html>'''

@flask_app.route('/feed')
def serve_feed():
    """Serve the OBS overlay feed page."""
    return FEED_HTML

@flask_app.route('/feed/items')
def get_feed_items():
    """Get recent feed items as JSON."""
    return jsonify(list(feed_items))

@flask_app.route('/feed/events')
def feed_events():
    """Server-Sent Events endpoint for real-time feed updates."""
    def generate():
        q = queue.Queue()
        feed_subscribers.append(q)
        try:
            # Send initial ping
            yield f"data: {json_module.dumps({'type': 'ping'})}\n\n"

            while True:
                try:
                    # Wait for new items with timeout (for keep-alive)
                    item = q.get(timeout=30)
                    yield f"data: {json_module.dumps(item)}\n\n"
                except queue.Empty:
                    # Send keep-alive ping
                    yield f": ping\n\n"
        except GeneratorExit:
            pass
        finally:
            if q in feed_subscribers:
                feed_subscribers.remove(q)

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        }
    )

# --- Working Status OBS Overlay ---
BRB_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coffee Break - Be Right Back</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400&display=swap');

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            background: #1a1612;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        canvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }

        .content {
            position: relative;
            z-index: 10;
            text-align: center;
            color: #f5f0eb;
        }

        .coffee-icon {
            font-size: 64px;
            margin-bottom: 20px;
            animation: steam 2s ease-in-out infinite;
            display: inline-block;
        }

        @keyframes steam {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
        }

        .title {
            font-family: 'Playfair Display', serif;
            font-size: 72px;
            font-weight: 700;
            letter-spacing: 4px;
            text-transform: uppercase;
            margin-bottom: 16px;
            text-shadow: 0 4px 30px rgba(139, 90, 43, 0.5);
            background: linear-gradient(135deg, #f5f0eb 0%, #d4a574 50%, #f5f0eb 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .subtitle {
            font-family: 'Inter', sans-serif;
            font-size: 24px;
            font-weight: 300;
            letter-spacing: 8px;
            text-transform: uppercase;
            opacity: 0.8;
            color: #d4a574;
        }

        .divider {
            width: 200px;
            height: 2px;
            background: linear-gradient(90deg, transparent, #d4a574, transparent);
            margin: 30px auto;
        }
    </style>
</head>
<body>
    <canvas id="swirls"></canvas>

    <div class="content">
        <div class="coffee-icon">&#9749;</div>
        <h1 class="title">Coffee Break</h1>
        <div class="divider"></div>
        <p class="subtitle">Be Right Back</p>
    </div>

    <script>
        const canvas = document.getElementById('swirls');
        const ctx = canvas.getContext('2d');

        let width, height;
        let particles = [];
        let time = 0;

        // Latte color palette
        const colors = [
            { r: 139, g: 90, b: 43 },   // Coffee brown
            { r: 212, g: 165, b: 116 }, // Latte
            { r: 245, g: 240, b: 235 }, // Cream
            { r: 180, g: 130, b: 80 },  // Caramel
            { r: 100, g: 60, b: 30 },   // Dark roast
            { r: 230, g: 210, b: 180 }, // Milk foam
        ];

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initParticles();
        }

        function initParticles() {
            particles = [];
            const count = Math.floor((width * height) / 8000);

            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 150 + 50,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    speedX: (Math.random() - 0.5) * 0.3,
                    speedY: (Math.random() - 0.5) * 0.3,
                    angle: Math.random() * Math.PI * 2,
                    angleSpeed: (Math.random() - 0.5) * 0.008,
                    noiseOffsetX: Math.random() * 1000,
                    noiseOffsetY: Math.random() * 1000,
                    opacity: Math.random() * 0.3 + 0.1
                });
            }
        }

        // Simple noise function for organic movement
        function noise(x, y, t) {
            return Math.sin(x * 0.01 + t) * Math.cos(y * 0.01 + t * 0.7) *
                   Math.sin((x + y) * 0.005 + t * 0.5);
        }

        function drawSwirl(p) {
            const noiseVal = noise(p.x + p.noiseOffsetX, p.y + p.noiseOffsetY, time * 0.5);

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle + noiseVal * 0.5);

            // Create gradient for swirl
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
            gradient.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity})`);
            gradient.addColorStop(0.5, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity * 0.5})`);
            gradient.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);

            ctx.fillStyle = gradient;

            // Draw organic swirl shape
            ctx.beginPath();
            const points = 6;
            for (let i = 0; i <= points * 20; i++) {
                const t = (i / (points * 20)) * Math.PI * 2 * 3;
                const r = p.size * (1 - i / (points * 20)) * (0.8 + 0.2 * Math.sin(t * 2 + time));
                const x = Math.cos(t) * r * (1 + 0.3 * Math.sin(t * 3));
                const y = Math.sin(t) * r * (1 + 0.3 * Math.cos(t * 2));

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        function update() {
            particles.forEach(p => {
                const noiseX = noise(p.x * 0.01, p.y * 0.01, time * 0.3);
                const noiseY = noise(p.y * 0.01, p.x * 0.01, time * 0.3 + 100);

                p.x += p.speedX + noiseX * 0.5;
                p.y += p.speedY + noiseY * 0.5;
                p.angle += p.angleSpeed;

                // Wrap around edges
                if (p.x < -p.size) p.x = width + p.size;
                if (p.x > width + p.size) p.x = -p.size;
                if (p.y < -p.size) p.y = height + p.size;
                if (p.y > height + p.size) p.y = -p.size;
            });
        }

        function draw() {
            // Dark coffee background with slight fade effect
            ctx.fillStyle = 'rgba(26, 22, 18, 0.08)';
            ctx.fillRect(0, 0, width, height);

            // Sort by size for depth effect
            particles.sort((a, b) => a.size - b.size);

            particles.forEach(drawSwirl);
        }

        function animate() {
            time += 0.016;
            update();
            draw();
            requestAnimationFrame(animate);
        }

        // Add flowing cream streams
        function addCreamStreams() {
            const streamCount = 5;
            for (let i = 0; i < streamCount; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 300 + 200,
                    color: colors[2], // Cream color
                    speedX: (Math.random() - 0.5) * 0.15,
                    speedY: (Math.random() - 0.5) * 0.15,
                    angle: Math.random() * Math.PI * 2,
                    angleSpeed: (Math.random() - 0.5) * 0.003,
                    noiseOffsetX: Math.random() * 1000,
                    noiseOffsetY: Math.random() * 1000,
                    opacity: Math.random() * 0.15 + 0.05
                });
            }
        }

        window.addEventListener('resize', resize);
        resize();
        addCreamStreams();

        // Initial fill with dark background
        ctx.fillStyle = '#1a1612';
        ctx.fillRect(0, 0, width, height);

        animate();
    </script>
</body>
</html>'''

WORKING_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Working Status</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
            background-color: rgba(0, 0, 0, 0) !important;
            background: transparent !important;
            overflow: hidden !important;
            font-family: 'JetBrains Mono', monospace;
        }

        #working-container {
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        ::-webkit-scrollbar { display: none !important; }

        @keyframes slideIn {
            0% { opacity: 0; transform: translateX(-20px); }
            100% { opacity: 1; transform: translateX(0); }
        }

        @keyframes slideOut {
            0% { opacity: 1; transform: translateX(0); }
            100% { opacity: 0; transform: translateX(-20px); }
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        @keyframes steam {
            0%, 100% { opacity: 0; transform: translateY(0) scale(1); }
            50% { opacity: 0.6; transform: translateY(-8px) scale(1.1); }
        }

        .working-item {
            animation: slideIn 0.3s ease-out both;
            background: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(4px);
            border-left: 4px solid #f59e0b;
            border-radius: 4px 12px 12px 4px;
            padding: 14px 34px;
            width: fit-content;
            max-width: 90%;
            box-shadow: 2px 4px 10px rgba(0,0,0,0.5);
            transition: border-color 0.3s ease;
        }

        .working-item.break-mode {
            border-left-color: #8b5cf6;
        }

        .working-item.removing {
            animation: slideOut 0.3s ease-out forwards;
        }

        .working-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 6px;
        }

        .working-icon {
            width: 36px;
            height: 36px;
            flex-shrink: 0;
            animation: pulse 2s ease-in-out infinite;
        }

        .working-label {
            font-size: 24px;
            font-weight: 700;
            color: #f59e0b;
            letter-spacing: -0.5px;
            transition: color 0.3s ease;
        }

        .break-mode .working-label {
            color: #8b5cf6;
        }

        .working-text {
            font-size: 28px;
            color: #EEEEEE;
            line-height: 1.4;
            font-weight: 400;
        }

        .countdown {
            font-variant-numeric: tabular-nums;
        }

        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div id="working-container">
        <div id="working-item" class="working-item hidden">
            <div class="working-header">
                <svg id="working-icon" class="working-icon" viewBox="0 0 24 24" fill="#f59e0b">
                    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                </svg>
                <span id="working-label" class="working-label">Working on</span>
            </div>
            <div id="working-text" class="working-text"></div>
        </div>
    </div>

    <script>
        const workingItem = document.getElementById('working-item');
        const workingIcon = document.getElementById('working-icon');
        const workingLabel = document.getElementById('working-label');
        const workingText = document.getElementById('working-text');

        // Icons
        const wrenchIcon = '<path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>';
        const coffeeIcon = '<path d="M2 21h18v-2H2v2zm16-8.18c.64-.37 1.14-.93 1.43-1.61.29-.68.37-1.44.23-2.16-.14-.73-.51-1.39-1.05-1.9-.54-.52-1.24-.85-1.98-.96V4h1V2H4v2h1v2.19c-.74.11-1.44.44-1.98.96-.54.51-.91 1.17-1.05 1.9-.14.72-.06 1.48.23 2.16.29.68.79 1.24 1.43 1.61L2 21h2l.52-3h12.96l.52 3h2l-2-8.18zM9 4h6v2H9V4zM6.14 10c-.04-.17-.06-.35-.06-.52 0-.82.39-1.59 1.03-2.06.24-.18.51-.31.8-.41V7h8.18v-.01c.29.1.56.23.8.41.64.47 1.03 1.24 1.03 2.06 0 .17-.02.35-.06.52-.14.68-.52 1.27-1.05 1.68-.53.4-1.19.63-1.87.63H9.06c-.68 0-1.34-.23-1.87-.63-.53-.41-.91-1-1.05-1.68V10z"/>';

        let currentStatus = null;
        let countdownInterval = null;

        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatTime(seconds) {
            if (seconds <= 0) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + secs.toString().padStart(2, '0');
        }

        function updateCountdown() {
            if (!currentStatus || currentStatus.mode !== 'break' || !currentStatus.end_time) {
                return;
            }

            const now = Date.now() / 1000;
            const remaining = currentStatus.end_time - now;

            if (remaining <= 0) {
                // Break is over - clear the display
                clearInterval(countdownInterval);
                countdownInterval = null;
                hideStatus();
            } else {
                workingText.innerHTML = '<span class="countdown">' + formatTime(remaining) + '</span>';
            }
        }

        function hideStatus() {
            workingItem.classList.add('removing');
            setTimeout(() => {
                workingItem.classList.add('hidden');
                workingItem.classList.remove('removing', 'break-mode');
            }, 300);
        }

        function updateStatus(status) {
            // Clear any existing countdown
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }

            currentStatus = status;

            if (status.text || (status.mode === 'break' && status.end_time)) {
                // Update icon and label based on mode
                if (status.mode === 'break') {
                    workingIcon.innerHTML = coffeeIcon;
                    workingIcon.setAttribute('fill', '#8b5cf6');
                    workingLabel.textContent = 'Coffee break';
                    workingItem.classList.add('break-mode');

                    // Start countdown
                    updateCountdown();
                    countdownInterval = setInterval(updateCountdown, 1000);
                } else {
                    workingIcon.innerHTML = wrenchIcon;
                    workingIcon.setAttribute('fill', '#f59e0b');
                    workingLabel.textContent = 'Working on';
                    workingItem.classList.remove('break-mode');
                    workingText.innerHTML = escapeHtml(status.text);
                }

                workingItem.classList.remove('hidden', 'removing');
                // Trigger re-animation
                workingItem.style.animation = 'none';
                workingItem.offsetHeight; // Force reflow
                workingItem.style.animation = null;
            } else {
                hideStatus();
            }
        }

        // Server-Sent Events for real-time updates
        function connectSSE() {
            const evtSource = new EventSource('/working/events');

            evtSource.onmessage = (event) => {
                try {
                    const status = JSON.parse(event.data);
                    if (status.type !== 'ping') {
                        updateStatus(status);
                    }
                } catch (e) {
                    console.error('Error parsing SSE data:', e);
                }
            };

            evtSource.onerror = () => {
                console.log('SSE connection lost, reconnecting...');
                evtSource.close();
                setTimeout(connectSSE, 3000);
            };
        }

        // Load current status on page load
        fetch('/working/status')
            .then(r => r.json())
            .then(status => {
                if (status.text || (status.mode === 'break' && status.end_time)) {
                    updateStatus(status);
                }
            })
            .catch(console.error);

        // Start SSE connection
        connectSSE();
    </script>
</body>
</html>'''

@flask_app.route('/brb')
def serve_brb():
    """Serve the Coffee Break / BRB overlay page."""
    return BRB_HTML

@flask_app.route('/working')
def serve_working():
    """Serve the OBS overlay working status page."""
    return WORKING_HTML

@flask_app.route('/working/status')
def get_working_status():
    """Get current working status as JSON."""
    return jsonify(current_working_status)

@flask_app.route('/working/events')
def working_events():
    """Server-Sent Events endpoint for real-time working status updates."""
    def generate():
        q = queue.Queue()
        working_subscribers.append(q)
        try:
            # Send initial ping
            yield f"data: {json_module.dumps({'type': 'ping'})}\n\n"

            while True:
                try:
                    # Wait for new status with timeout (for keep-alive)
                    status = q.get(timeout=30)
                    yield f"data: {json_module.dumps(status)}\n\n"
                except queue.Empty:
                    # Send keep-alive ping
                    yield f": ping\n\n"
        except GeneratorExit:
            pass
        finally:
            if q in working_subscribers:
                working_subscribers.remove(q)

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        }
    )

# Track which livestreams we've already notified about (by video ID)
notified_livestreams = set()

@tasks.loop(minutes=30) # Check every 30 minutes (to stay within YouTube API quota)
async def check_youtube_live():
    global notified_livestreams

    if not youtube or not YOUTUBE_CHANNEL_ID or not DISCORD_YOUTUBE_CHANNEL_ID:
        return

    try:
        # Request the channel's live streaming details
        request = youtube.search().list(
            part="snippet",
            channelId=YOUTUBE_CHANNEL_ID,
            eventType="live",
            type="video"
        )
        response = request.execute()

        # Get current live video IDs
        current_live_ids = set()

        for video_data in response.get('items', []):
            video_id = video_data['id']['videoId']
            current_live_ids.add(video_id)

            # Only notify if we haven't notified about this stream yet
            if video_id not in notified_livestreams:
                video_title = video_data['snippet']['title']
                video_url = f"https://www.youtube.com/watch?v={video_id}"

                message = f"🔴 **I am now LIVE!**\n\n**{video_title}**\n{video_url}"

                await send_youtube_notification(message)
                notified_livestreams.add(video_id)
                logger.info(f"Notified about new livestream: {video_id}")

        # Clean up: remove IDs that are no longer live (stream ended)
        ended_streams = notified_livestreams - current_live_ids
        if ended_streams:
            notified_livestreams -= ended_streams
            logger.info(f"Cleared ended livestreams from tracking: {ended_streams}")

    except Exception as e:
        logger.error(f"Error checking YouTube status: {e}")

@check_youtube_live.before_loop
async def before_check_live():
    await bot.wait_until_ready()

async def send_youtube_notification(message):
    """Sends YouTube live notification to the dedicated YouTube Discord channel."""
    try:
        channel = bot.get_channel(DISCORD_YOUTUBE_CHANNEL_ID)
        if channel:
            # Check last message to avoid duplicates on redeploy
            async for last_message in channel.history(limit=1):
                if last_message.content == message:
                    logger.info("Skipping duplicate YouTube notification")
                    return
            await channel.send(message)
            logger.info(f"Sent YouTube notification to Discord channel {DISCORD_YOUTUBE_CHANNEL_ID}")
        else:
            logger.error(f"Could not find Discord YouTube channel with ID {DISCORD_YOUTUBE_CHANNEL_ID}")
    except Exception as e:
        logger.error(f"Error sending YouTube notification to Discord: {e}")

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
    if CHANNEL_ID:
        logger.info(f'Monitoring channel ID: {CHANNEL_ID}')
        logger.info(f'Game server URL: {GAME_SERVER_URL}')
    logger.info(f'Flask API running on port {BOT_API_PORT}')

    # Start the YouTube loop
    if YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID and DISCORD_YOUTUBE_CHANNEL_ID:
        if not check_youtube_live.is_running():
            check_youtube_live.start()
            logger.info(f"YouTube live check started. Notifications will go to channel {DISCORD_YOUTUBE_CHANNEL_ID}")
    else:
        logger.warning("YouTube API Key, YouTube Channel ID, or Discord YouTube Channel ID missing. Live check skipped.")

    # Log GitHub webhook status
    if DISCORD_GITHUB_CHANNEL_ID:
        logger.info(f"GitHub webhook enabled. Notifications will go to channel {DISCORD_GITHUB_CHANNEL_ID}")
        if GITHUB_WEBHOOK_SECRET:
            logger.info("GitHub webhook signature verification enabled")
    else:
        logger.warning("DISCORD_GITHUB_CHANNEL_ID not set. GitHub webhook integration disabled.")

    # Sync slash commands
    try:
        synced = await bot.tree.sync()
        logger.info(f"Synced {len(synced)} slash command(s)")
    except Exception as e:
        logger.error(f"Failed to sync slash commands: {e}")

# --- Working Status Slash Command ---
@bot.tree.command(name="working", description="Set your current working status for the stream overlay")
@app_commands.describe(task="What you're currently working on (leave empty to clear)")
async def working_command(interaction: discord.Interaction, task: str = None):
    """Set the working status displayed on the OBS overlay."""
    # Only allow admins to use this command
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("You need administrator permissions to use this command.", ephemeral=True)
        return

    if task:
        update_working_status(task)
        await interaction.response.send_message(f"Working status set to: **{task}**", ephemeral=True)
        logger.info(f"Working status updated by {interaction.user.display_name}: {task}")
    else:
        update_working_status(None)
        await interaction.response.send_message("Working status cleared.", ephemeral=True)
        logger.info(f"Working status cleared by {interaction.user.display_name}")

# --- Break Timer Slash Command ---
@bot.tree.command(name="coffee", description="Show a coffee break message on the stream overlay")
async def coffee_command(interaction: discord.Interaction):
    """Show a coffee break message on the OBS overlay."""
    # Only allow admins to use this command
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("You need administrator permissions to use this command.", ephemeral=True)
        return

    update_working_status("Coffee Break", mode='break')
    await interaction.response.send_message("☕ Coffee break started!", ephemeral=True)
    logger.info(f"Coffee break started by {interaction.user.display_name}")

# --- Back From Break Slash Command ---
@bot.tree.command(name="back", description="Cancel the break and restore the previous working status")
async def back_command(interaction: discord.Interaction):
    """Cancel break and restore previous working status."""
    # Only allow admins to use this command
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("You need administrator permissions to use this command.", ephemeral=True)
        return

    if current_working_status.get('mode') != 'break':
        await interaction.response.send_message("No active break to cancel.", ephemeral=True)
        return

    restored_text = restore_working_status()
    if restored_text:
        await interaction.response.send_message(f"Welcome back! Restored status: **{restored_text}**", ephemeral=True)
    else:
        await interaction.response.send_message("Welcome back! (No previous status to restore)", ephemeral=True)
    logger.info(f"Break canceled by {interaction.user.display_name}")

# --- Manual Live Command ---
@bot.command(name='live')
@commands.has_permissions(administrator=True)  # Only admins can use this
async def go_live(ctx, *, stream_url: str = None):
    """
    Manually announce that you're live. Bypasses the 30-min polling.
    Usage: !live [optional stream URL]
    Example: !live https://youtube.com/watch?v=abc123
    """
    global notified_livestreams

    if not DISCORD_YOUTUBE_CHANNEL_ID:
        await ctx.send("YouTube notification channel not configured.")
        return

    # Generate a unique ID for this manual notification to prevent auto-check duplicates
    manual_id = f"manual_{int(time.time())}"
    notified_livestreams.add(manual_id)

    # Build the notification message
    if stream_url:
        message = f"🔴 **I am now LIVE!**\n\n{stream_url}"
    else:
        # Default to YouTube channel if no URL provided
        default_url = f"https://youtube.com/channel/{YOUTUBE_CHANNEL_ID}" if YOUTUBE_CHANNEL_ID else ""
        message = f"🔴 **I am now LIVE!**\n\n{default_url}"

    await send_youtube_notification(message)
    await ctx.send("Live notification sent!")
    logger.info(f"Manual live notification sent by {ctx.author.display_name}")

@go_live.error
async def go_live_error(ctx, error):
    if isinstance(error, commands.MissingPermissions):
        await ctx.send("You need administrator permissions to use this command.")
    else:
        await ctx.send(f"An error occurred: {error}")
        logger.error(f"Error in !live command: {error}")

@bot.event
async def on_message(message):
    """Handles messages received from Discord."""
    # Ignore messages from the bot itself
    if message.author == bot.user:
        return

    # Only process messages from the designated channel (if configured)
    if CHANNEL_ID and message.channel.id == CHANNEL_ID:
        logger.info(f"Received message from Discord channel {CHANNEL_ID}: '{message.content}' by {message.author.display_name}")
        # Censor the message content *before* sending to the game server
        censored_content = profanity.censor(message.content)
        # Pass the original message object but provide the censored content separately for sending
        await send_to_game_server(message, censored_content)

    # Process commands (like !live)
    await bot.process_commands(message)

async def send_to_game_server(message, content_to_send):
    """Sends a censored and sanitized message from Discord to the game server."""
    try:
        # Sanitize content further for Discord specifics (mentions, markdown)
        # Although censoring might remove some markdown/mentions, apply escapes just in case
        # CENSORING HAPPENS *BEFORE* this function is called now.
        sanitized_content = discord.utils.escape_markdown(content_to_send) # Use content_to_send
        sanitized_content = discord.utils.escape_mentions(sanitized_content)

        # Censor the author's display name as well
        censored_author = profanity.censor(message.author.display_name)

        payload = {
            'author': censored_author, # Send censored author name
            'content': sanitized_content # Send censored & sanitized content
        }
        headers = {
            'Content-Type': 'application/json',
            'X-Secret-Key': SHARED_SECRET
        }
        response = requests.post(f"{GAME_SERVER_URL}/discord_message", json=payload, headers=headers, timeout=5)
        response.raise_for_status()
        # Log the original content for debugging/context if needed, but be mindful of privacy
        logger.info(f"Sent censored message to game server from {message.author.display_name}") # Avoid logging the raw message if sensitive

        await message.add_reaction('🚀')
    except (requests.exceptions.RequestException, Exception) as e:
        logger.error(f"Error sending message to game server: {e}")
        try:
            await message.add_reaction('🔴')
        except discord.HTTPException as reaction_error:
             logger.error(f"Failed to add error reaction: {reaction_error}")

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
    if not BOT_TOKEN:
        logger.error("Error: DISCORD_BOT_TOKEN must be set in environment variables or .env file.")
    else:
        if not CHANNEL_ID:
            logger.warning("DISCORD_CHANNEL_ID not set. Game server integration disabled.")

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