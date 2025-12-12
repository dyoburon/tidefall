"""
Discord bot setup, events, and commands.
"""
import discord
from discord import app_commands
from discord.ext import commands, tasks
import requests
import time

from . import config
from .status import update_working_status, restore_working_status


# --- Discord Bot Setup ---
intents = discord.Intents.default()
intents.messages = True
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)


# --- YouTube Live Check Task ---
@tasks.loop(minutes=30)
async def check_youtube_live():
    if not config.youtube or not config.YOUTUBE_CHANNEL_ID or not config.DISCORD_YOUTUBE_CHANNEL_ID:
        return

    try:
        request = config.youtube.search().list(
            part="snippet",
            channelId=config.YOUTUBE_CHANNEL_ID,
            eventType="live",
            type="video"
        )
        response = request.execute()

        current_live_ids = set()

        for video_data in response.get('items', []):
            video_id = video_data['id']['videoId']
            current_live_ids.add(video_id)

            if video_id not in config.notified_livestreams:
                video_title = video_data['snippet']['title']
                video_url = f"https://www.youtube.com/watch?v={video_id}"

                message = f"🔴 **I am now LIVE!**\n\n**{video_title}**\n{video_url}"

                await send_youtube_notification(message)
                config.notified_livestreams.add(video_id)
                config.logger.info(f"Notified about new livestream: {video_id}")

        ended_streams = config.notified_livestreams - current_live_ids
        if ended_streams:
            config.notified_livestreams -= ended_streams
            config.logger.info(f"Cleared ended livestreams from tracking: {ended_streams}")

    except Exception as e:
        config.logger.error(f"Error checking YouTube status: {e}")


@check_youtube_live.before_loop
async def before_check_live():
    await bot.wait_until_ready()


# --- Helper Functions ---
async def send_youtube_notification(message):
    """Sends YouTube live notification to the dedicated YouTube Discord channel."""
    try:
        channel = bot.get_channel(config.DISCORD_YOUTUBE_CHANNEL_ID)
        if channel:
            async for last_message in channel.history(limit=1):
                if last_message.content == message:
                    config.logger.info("Skipping duplicate YouTube notification")
                    return
            await channel.send(message)
            config.logger.info(f"Sent YouTube notification to Discord channel {config.DISCORD_YOUTUBE_CHANNEL_ID}")
        else:
            config.logger.error(f"Could not find Discord YouTube channel with ID {config.DISCORD_YOUTUBE_CHANNEL_ID}")
    except Exception as e:
        config.logger.error(f"Error sending YouTube notification to Discord: {e}")


async def send_to_discord_channel(message):
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


async def send_to_game_server(message, content_to_send):
    """Sends a censored and sanitized message from Discord to the game server."""
    try:
        sanitized_content = discord.utils.escape_markdown(content_to_send)
        sanitized_content = discord.utils.escape_mentions(sanitized_content)

        censored_author = config.profanity.censor(message.author.display_name)

        payload = {
            'author': censored_author,
            'content': sanitized_content
        }
        headers = {
            'Content-Type': 'application/json',
            'X-Secret-Key': config.SHARED_SECRET
        }
        response = requests.post(f"{config.GAME_SERVER_URL}/discord_message", json=payload, headers=headers, timeout=5)
        response.raise_for_status()
        config.logger.info(f"Sent censored message to game server from {message.author.display_name}")

        await message.add_reaction('🚀')
    except (requests.exceptions.RequestException, Exception) as e:
        config.logger.error(f"Error sending message to game server: {e}")
        try:
            await message.add_reaction('🔴')
        except discord.HTTPException as reaction_error:
            config.logger.error(f"Failed to add error reaction: {reaction_error}")


# --- Bot Events ---
@bot.event
async def on_ready():
    config.logger.info(f'Discord bot logged in as {bot.user.name}')
    if config.CHANNEL_ID:
        config.logger.info(f'Monitoring channel ID: {config.CHANNEL_ID}')
        config.logger.info(f'Game server URL: {config.GAME_SERVER_URL}')
    config.logger.info(f'Flask API running on port {config.BOT_API_PORT}')

    if config.YOUTUBE_API_KEY and config.YOUTUBE_CHANNEL_ID and config.DISCORD_YOUTUBE_CHANNEL_ID:
        if not check_youtube_live.is_running():
            check_youtube_live.start()
            config.logger.info(f"YouTube live check started. Notifications will go to channel {config.DISCORD_YOUTUBE_CHANNEL_ID}")
    else:
        config.logger.warning("YouTube API Key, YouTube Channel ID, or Discord YouTube Channel ID missing. Live check skipped.")

    if config.DISCORD_GITHUB_CHANNEL_ID:
        config.logger.info(f"GitHub webhook enabled. Notifications will go to channel {config.DISCORD_GITHUB_CHANNEL_ID}")
        if config.GITHUB_WEBHOOK_SECRET:
            config.logger.info("GitHub webhook signature verification enabled")
    else:
        config.logger.warning("DISCORD_GITHUB_CHANNEL_ID not set. GitHub webhook integration disabled.")

    try:
        synced = await bot.tree.sync()
        config.logger.info(f"Synced {len(synced)} slash command(s)")
    except Exception as e:
        config.logger.error(f"Failed to sync slash commands: {e}")


@bot.event
async def on_message(message):
    """Handles messages received from Discord."""
    if message.author == bot.user:
        return

    if config.CHANNEL_ID and message.channel.id == config.CHANNEL_ID:
        config.logger.info(f"Received message from Discord channel {config.CHANNEL_ID}: '{message.content}' by {message.author.display_name}")
        censored_content = config.profanity.censor(message.content)
        await send_to_game_server(message, censored_content)

    await bot.process_commands(message)


# --- Slash Commands ---
@bot.tree.command(name="working", description="Set your current working status for the stream overlay")
@app_commands.describe(task="What you're currently working on (leave empty to clear)")
async def working_command(interaction: discord.Interaction, task: str = None):
    """Set the working status displayed on the OBS overlay."""
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("You need administrator permissions to use this command.", ephemeral=True)
        return

    if task:
        update_working_status(task)
        await interaction.response.send_message(f"Working status set to: **{task}**", ephemeral=True)
        config.logger.info(f"Working status updated by {interaction.user.display_name}: {task}")
    else:
        update_working_status(None)
        await interaction.response.send_message("Working status cleared.", ephemeral=True)
        config.logger.info(f"Working status cleared by {interaction.user.display_name}")


@bot.tree.command(name="coffee", description="Show a coffee break message on the stream overlay")
async def coffee_command(interaction: discord.Interaction):
    """Show a coffee break message on the OBS overlay."""
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("You need administrator permissions to use this command.", ephemeral=True)
        return

    update_working_status("Coffee Break", mode='break')
    await interaction.response.send_message("☕ Coffee break started!", ephemeral=True)
    config.logger.info(f"Coffee break started by {interaction.user.display_name}")


@bot.tree.command(name="back", description="Cancel the break and restore the previous working status")
async def back_command(interaction: discord.Interaction):
    """Cancel break and restore previous working status."""
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("You need administrator permissions to use this command.", ephemeral=True)
        return

    if config.current_working_status.get('mode') != 'break':
        await interaction.response.send_message("No active break to cancel.", ephemeral=True)
        return

    restored_text = restore_working_status()
    if restored_text:
        await interaction.response.send_message(f"Welcome back! Restored status: **{restored_text}**", ephemeral=True)
    else:
        await interaction.response.send_message("Welcome back! (No previous status to restore)", ephemeral=True)
    config.logger.info(f"Break canceled by {interaction.user.display_name}")


# --- Prefix Commands ---
@bot.command(name='live')
@commands.has_permissions(administrator=True)
async def go_live(ctx, *, stream_url: str = None):
    """
    Manually announce that you're live. Bypasses the 30-min polling.
    Usage: !live [optional stream URL]
    """
    if not config.DISCORD_YOUTUBE_CHANNEL_ID:
        await ctx.send("YouTube notification channel not configured.")
        return

    manual_id = f"manual_{int(time.time())}"
    config.notified_livestreams.add(manual_id)

    if stream_url:
        message = f"🔴 **I am now LIVE!**\n\n{stream_url}"
    else:
        default_url = f"https://youtube.com/channel/{config.YOUTUBE_CHANNEL_ID}" if config.YOUTUBE_CHANNEL_ID else ""
        message = f"🔴 **I am now LIVE!**\n\n{default_url}"

    await send_youtube_notification(message)
    await ctx.send("Live notification sent!")
    config.logger.info(f"Manual live notification sent by {ctx.author.display_name}")


@go_live.error
async def go_live_error(ctx, error):
    if isinstance(error, commands.MissingPermissions):
        await ctx.send("You need administrator permissions to use this command.")
    else:
        await ctx.send(f"An error occurred: {error}")
        config.logger.error(f"Error in !live command: {error}")
