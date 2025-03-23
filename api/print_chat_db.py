#!/usr/bin/env python3
import os
from dotenv import load_dotenv
from datetime import datetime
from flask import Flask
from models import db, Player, Island, Message

# Load environment variables from .env file (if present)
load_dotenv()

def setup_app():
    """Create a minimal Flask app to initialize the database connection"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///game.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    return app


def print_database_contents():
    """Print all contents of the database"""
    print("\n===== DATABASE CONTENTS REPORT =====")
    print(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Print players
    print("==== PLAYERS ====")
    players = Player.query.all()
    print(f"Total players: {len(players)}")
    
    if players:
        print("\nPlayers list:")
        for player in players:
            print(f"ID: {player.id}")
            print(f"  Name: {player.name}")
            print(f"  Color: {player.color}")
            print(f"  Position: {player.position}")
            print(f"  Rotation: {player.rotation}")
            print(f"  Mode: {player.mode}")
            print(f"  Last Update: {player.last_update}")
            print(f"  Fish Count: {player.fishCount}")
            print(f"  Monster Kills: {player.monsterKills}")
            print(f"  Money: {player.money}")
            print(f"  Active: {player.active}")
            print("-" * 50)
    else:
        print("No players found in database.")
    
    print("\n==== ISLANDS ====")
    islands = Island.query.all()
    print(f"Total islands: {len(islands)}")
    
    if islands:
        print("\nIslands list:")
        for island in islands:
            print(f"ID: {island.id}")
            print(f"  Position: {island.position}")
            print(f"  Radius: {island.radius}")
            print(f"  Type: {island.type}")
            print("-" * 50)
    else:
        print("No islands found in database.")
    
    # Print chat messages
    print("\n==== CHAT MESSAGES ====")
    
    # Get all message types in the database
    message_types = db.session.query(Message.message_type).distinct().all()
    message_types = [t[0] for t in message_types]
    
    if not message_types:
        print("No messages found in database.")
    else:
        # Print message type summary
        print(f"Message types found: {', '.join(message_types)}")
        total_messages = Message.query.count()
        print(f"Total messages in database: {total_messages}\n")
        
        # Get top chatters
        top_chatters = db.session.query(
            Message.sender_id, 
            db.func.count(Message.id).label('message_count')
        ).group_by(Message.sender_id).order_by(db.func.count(Message.id).desc()).limit(5).all()
        
        if top_chatters:
            print("TOP 5 MOST ACTIVE USERS:")
            player_dict = {p.id: p.name for p in Player.query.all()}
            
            for sender_id, count in top_chatters:
                sender_name = player_dict.get(sender_id, f"Unknown ({sender_id})")
                print(f"  {sender_name}: {count} messages")
            print()
        
        # Print recent messages for all types (using the model's method)
        print("==== RECENT MESSAGES (ACROSS ALL TYPES) ====")
        limit = 20  # Get most recent 20 messages
        recent_messages = (Message.query
                          .order_by(Message.timestamp.desc())
                          .limit(limit)
                          .all())
        
        if recent_messages:
            print(f"Most recent {len(recent_messages)} messages:\n")
            
            # Get a player name lookup dictionary
            player_ids = set(msg.sender_id for msg in recent_messages)
            players = {p.id: p.name for p in Player.query.filter(Player.id.in_(player_ids)).all()}
            
            for i, msg in enumerate(recent_messages):
                sender_name = players.get(msg.sender_id, f"Unknown ({msg.sender_id})")
                timestamp = msg.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                
                print(f"Message ID: {msg.id}")
                print(f"  Time: {timestamp}")
                print(f"  Sender: {sender_name} (ID: {msg.sender_id})")
                print(f"  Type: {msg.message_type}")
                print(f"  Content: {msg.content}")
                
                if i < len(recent_messages) - 1:
                    print("-" * 50)
            
            print()
        else:
            print("No recent messages found.\n")
        
        # Print recent messages by type (using the class method)
        for msg_type in message_types:
            print(f"==== RECENT {msg_type.upper()} MESSAGES (using get_recent_messages) ====")
            # Use the class method directly
            messages = Message.get_recent_messages(limit=10, message_type=msg_type)
            
            if not messages:
                print(f"No recent {msg_type} messages found.\n")
                continue
                
            print(f"Total recent {msg_type} messages: {len(messages)}\n")
            
            # Get a player name lookup dictionary
            player_ids = set(msg.sender_id for msg in messages)
            players = {p.id: p.name for p in Player.query.filter(Player.id.in_(player_ids)).all()}
            
            # Print each message with sender name
            for i, msg in enumerate(messages):
                sender_name = players.get(msg.sender_id, f"Unknown ({msg.sender_id})")
                timestamp = msg.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                
                print(f"Message ID: {msg.id}")
                print(f"  Time: {timestamp}")
                print(f"  Sender: {sender_name} (ID: {msg.sender_id})")
                print(f"  Type: {msg.message_type}")
                print(f"  Content: {msg.content}")
                
                # Add separator between messages unless it's the last message
                if i < len(messages) - 1:
                    print("-" * 50)
            
            print()  # Add blank line between message types
        
        # Print messages for each type
        for msg_type in message_types:
            print(f"==== ALL {msg_type.upper()} MESSAGES ====")
            messages = Message.query.filter_by(message_type=msg_type).order_by(Message.timestamp.desc()).all()
            
            if not messages:
                print(f"No {msg_type} messages found.\n")
                continue
                
            print(f"Total {msg_type} messages: {len(messages)}\n")
            
            # Get a player name lookup dictionary
            player_ids = set(msg.sender_id for msg in messages)
            players = {p.id: p.name for p in Player.query.filter(Player.id.in_(player_ids)).all()}
            
            # Print each message with sender name
            for i, msg in enumerate(messages):
                sender_name = players.get(msg.sender_id, f"Unknown ({msg.sender_id})")
                timestamp = msg.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                
                print(f"Message ID: {msg.id}")
                print(f"  Time: {timestamp}")
                print(f"  Sender: {sender_name} (ID: {msg.sender_id})")
                print(f"  Type: {msg.message_type}")
                print(f"  Content: {msg.content}")
                
                # Add separator between messages unless it's the last message
                if i < len(messages) - 1:
                    print("-" * 50)
            
            print()  # Add blank line between message types

if __name__ == "__main__":
    app = setup_app()
    with app.app_context():
        print_database_contents() 