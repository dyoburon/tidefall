"""
Discord Bot Package

A Discord bot with Flask API for stream overlays and webhooks.

Structure:
- config.py: Environment variables and shared state
- templates.py: HTML templates for overlays
- routes.py: Flask routes for overlays and API
- webhooks.py: GitHub and game server webhook handlers
- bot.py: Discord bot events and commands
"""
import threading
import logging
from flask import Flask

from . import config
from .bot import bot
from .routes import register_routes
from .webhooks import register_webhooks

# Disable Flask's default logging to avoid duplicate logs
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)

# Flask app setup
flask_app = Flask(__name__)

# Register all routes
register_routes(flask_app)
register_webhooks(flask_app, bot)


def run_flask():
    """Runs the Flask app in a separate thread."""
    try:
        flask_app.run(host='0.0.0.0', port=config.BOT_API_PORT, debug=False, use_reloader=False)
    except Exception as e:
        config.logger.error(f"Flask server failed: {e}")


def main():
    """Main entry point for the Discord bot."""
    if not config.BOT_TOKEN:
        config.logger.error("Error: DISCORD_BOT_TOKEN must be set in environment variables or .env file.")
        return

    if not config.CHANNEL_ID:
        config.logger.warning("DISCORD_CHANNEL_ID not set. Game server integration disabled.")

    # Start Flask in a separate thread
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    # Start the Discord bot
    try:
        bot.run(config.BOT_TOKEN)
    except Exception as e:
        config.logger.error(f"Discord login failed: {e}")


if __name__ == "__main__":
    main()
