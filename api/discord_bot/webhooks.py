"""
Webhook handlers for GitHub and game server events.
"""
import hmac
import hashlib
import random
import discord
import asyncio

from flask import request, jsonify

from . import config
from .status import add_feed_item


def register_webhooks(app, bot):
    """Register webhook routes on the Flask app."""

    @app.route('/game_event', methods=['POST'])
    def handle_game_event():
        """Receives events (like chat, player join) from the game server."""
        auth_secret = request.headers.get('X-Secret-Key')
        if auth_secret != config.SHARED_SECRET:
            config.logger.warning("Received unauthorized request to /game_event")
            return jsonify({"error": "Unauthorized"}), 403

        data = request.json
        message_type = data.get('type')
        payload = data.get('payload')

        if not message_type or not payload:
            config.logger.warning("Received invalid data on /game_event")
            return jsonify({"error": "Invalid data"}), 400

        message_to_send = ""
        if message_type == 'chat':
            sender_name = payload.get('sender_name', 'Unknown')
            content = payload.get('content', '')

            censored_sender = config.profanity.censor(sender_name)
            censored_content = config.profanity.censor(content)

            safe_sender = discord.utils.escape_markdown(discord.utils.escape_mentions(censored_sender))
            safe_content = discord.utils.escape_markdown(discord.utils.escape_mentions(censored_content))
            message_to_send = f"**{safe_sender}**: {safe_content}"
        elif message_type == 'player_join':
            player_name = payload.get('name', 'Someone')

            censored_player_name = config.profanity.censor(player_name)

            safe_player_name = discord.utils.escape_markdown(discord.utils.escape_mentions(censored_player_name))
            message_to_send = f":arrow_right: *Player **{safe_player_name}** has joined the game.*"

        if message_to_send:
            asyncio.run_coroutine_threadsafe(_send_to_discord_channel(bot, message_to_send), bot.loop)

        return jsonify({"status": "success"}), 200

    @app.route('/github-webhook', methods=['POST'])
    def github_webhook():
        """Receives push events from GitHub and sends commit info to Discord."""
        if config.GITHUB_WEBHOOK_SECRET:
            signature = request.headers.get('X-Hub-Signature-256')
            if not _verify_github_signature(request.data, signature):
                config.logger.warning("Received GitHub webhook with invalid signature")
                return jsonify({"error": "Invalid signature"}), 403

        event_type = request.headers.get('X-GitHub-Event')
        if event_type != 'push':
            config.logger.info(f"Ignoring GitHub event type: {event_type}")
            return jsonify({"status": "ignored", "reason": f"event type {event_type}"}), 200

        if not config.DISCORD_GITHUB_CHANNEL_ID:
            config.logger.warning("DISCORD_GITHUB_CHANNEL_ID not configured, ignoring GitHub webhook")
            return jsonify({"error": "GitHub channel not configured"}), 500

        data = request.json
        repo_name = data.get('repository', {}).get('name', 'Unknown repo')
        pusher = data.get('pusher', {}).get('name', 'Unknown')
        commits = data.get('commits', [])

        if not commits:
            config.logger.info(f"Push to {repo_name} with no commits (possibly branch delete)")
            return jsonify({"status": "ignored", "reason": "no commits"}), 200

        commit_verbs = [
            "shipped", "pushed", "deployed", "unleashed", "conjured",
            "manifested", "summoned", "crafted", "forged", "dropped",
            "launched", "beamed", "teleported", "cooked up"
        ]

        for commit in commits:
            message_text = commit.get('message', 'No message')
            if len(message_text) > 200:
                message_text = message_text[:200] + '...'

            commit_url = commit.get('url', '')
            author = commit.get('author', {}).get('username') or pusher
            verb = random.choice(commit_verbs)

            safe_repo = discord.utils.escape_markdown(repo_name)
            safe_author = discord.utils.escape_markdown(author)
            safe_message = discord.utils.escape_markdown(message_text)

            discord_message = f"**{safe_author}** has {verb} `{safe_message}` to project **{safe_repo}** [→]({commit_url})"

            asyncio.run_coroutine_threadsafe(_send_github_notification(bot, discord_message), bot.loop)

            add_feed_item(
                item_type='commit',
                author=author,
                message=f"has {verb} \"{message_text}\"",
                url=commit_url,
                project=repo_name
            )

        config.logger.info(f"Processed {len(commits)} commit(s) from {repo_name}")
        return jsonify({"status": "success", "commits_processed": len(commits)}), 200


def _verify_github_signature(payload_body, signature_header):
    """Verify the GitHub webhook signature if a secret is configured."""
    if not config.GITHUB_WEBHOOK_SECRET:
        return True

    if not signature_header:
        return False

    hash_algorithm, signature = signature_header.split('=', 1)
    if hash_algorithm != 'sha256':
        return False

    expected_signature = hmac.new(
        config.GITHUB_WEBHOOK_SECRET.encode('utf-8'),
        payload_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)


async def _send_to_discord_channel(bot, message):
    """Sends a message to the configured Discord channel."""
    try:
        channel = bot.get_channel(config.CHANNEL_ID)
        if channel:
            await channel.send(message)
            config.logger.info(f"Sent message to Discord channel {config.CHANNEL_ID}")
        else:
            config.logger.error(f"Could not find Discord channel with ID {config.CHANNEL_ID}")
    except Exception as e:
        config.logger.error(f"Error sending message to Discord: {e}")


async def _send_github_notification(bot, message):
    """Sends GitHub commit notification to the dedicated GitHub Discord channel."""
    try:
        channel = bot.get_channel(config.DISCORD_GITHUB_CHANNEL_ID)
        if channel:
            await channel.send(message)
            config.logger.info(f"Sent GitHub notification to Discord channel {config.DISCORD_GITHUB_CHANNEL_ID}")
        else:
            config.logger.error(f"Could not find Discord GitHub channel with ID {config.DISCORD_GITHUB_CHANNEL_ID}")
    except Exception as e:
        config.logger.error(f"Error sending GitHub notification to Discord: {e}")
