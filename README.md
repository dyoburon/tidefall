# Tidefall

![Tidefall Demo](demo.gif)

A multiplayer 3D sailing game built with Three.js where players navigate procedurally generated seas, battle sea monsters, explore islands, and compete on the leaderboard.

**Work in progress.**

https://x.com/dyoburon/status/1904003191534137528

## Features

- **Real-time Multiplayer** - Sail alongside other players with Socket.IO networking
- **Combat System** - Fire cannons, use harpoons, and battle sea monsters
- **Procedural World** - Dynamically generated islands and ocean chunks
- **Multiple Biomes** - Explore open seas, arctic waters, and volcanic regions
- **Abilities** - Cannon shots, scatter shots, harpoons, and sprint
- **Fishing** - Cast your line and catch various fish
- **Weather Effects** - Dynamic rain, snow, and wind that affects sailing
- **Day/Night Cycle** - Dynamic lighting and sky transitions
- **Mobile Support** - Touch controls with landscape orientation

## Getting Started

### Prerequisites

- Node.js (v16+)
- Python 3.8+ (for backend)

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The game will open at `http://localhost:1234`.

### Backend Setup

```bash
cd api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python app.py
```

The backend runs on `http://localhost:5000`.

## Controls

| Key | Action |
|-----|--------|
| W / Up Arrow | Move forward |
| S / Down Arrow | Move backward |
| A / Left Arrow | Turn left |
| D / Right Arrow | Turn right |
| Space | Fire cannon |
| C | Toggle camera control |
| Click | Interact / Use abilities |
| ESC | Open menu |

## Project Structure

```
tidefall/
├── src/
│   ├── abilities/      # Combat abilities (cannons, harpoons, etc.)
│   ├── animations/     # Ship and effect animations
│   ├── audio/          # Music and spatial audio
│   ├── biomes/         # Biome systems (arctic, volcanic, open)
│   ├── commands/       # Debug/admin command system
│   ├── controls/       # Camera and touch controls
│   ├── core/           # Main game loop, networking, state
│   ├── effects/        # Visual effects (particles, text)
│   ├── entities/       # Ships, monsters, NPCs, birds
│   ├── environment/    # Water, clouds, skybox, fog
│   ├── gameplay/       # Fishing, shop, treasure
│   ├── network/        # Player sync, connection handling
│   ├── physics/        # Gravity and physics
│   ├── portals/        # Vibeverse portal system
│   ├── ui/             # HUD, chat, inventory, leaderboard
│   ├── utils/          # Loaders, helpers
│   ├── weather/        # Rain, snow effects
│   └── world/          # Islands, chunks, spawning
├── api/                # Python/Flask backend
├── assets/             # 3D models, textures
├── public/             # Static files
└── index.html          # Entry point
```

## Tech Stack

**Frontend:**
- Three.js - 3D rendering
- Parcel - Bundler
- Socket.IO Client - Real-time networking
- Firebase - Authentication
- nipplejs - Mobile joystick controls

**Backend:**
- Flask + Flask-SocketIO - Server
- Firebase Admin - Database & auth
- Discord.py - Discord bot integration

## Building for Production

```bash
npm run build
```

Built files output to `dist/`.

## Deployment

Frontend is configured for Vercel deployment. Backend can be deployed separately (e.g., Railway, Render).
