// Enhanced UI system for the boat game
import * as THREE from 'three';
import { initChat, initMiniMap } from './chat.js';
import { initShop, updateShopAvailability } from '../gameplay/shop.js';
import InventoryUI from './inventoryUI.js';
import { getDiagnosticsData, ENABLE_DIAGNOSTICS, isBraveBrowser } from './diagnostics.js';
import { fireCannons } from '../gameplay/cannons.js';
import { setWaterStyle } from '../environment/water.js';
import { areShoreEffectsEnabled } from '../world/islands.js';
import playerList from './playerList.js';
import { initGameTerminal } from './gameTerminal.js';
import AbilitiesBar from './abilitiesBar.js'; // Import the new AbilitiesBar component

// Create a UI class to manage all interface elements
class GameUI {
    constructor() {
        // Initialize inventory UI first, before trying to use it
        this.inventoryUI = new InventoryUI();

        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'game-ui';
        this.container.style.position = 'absolute';
        this.container.style.top = '35px';
        this.container.style.left = '10px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'Arial, sans-serif';
        this.container.style.fontSize = '14px';
        this.container.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
        this.container.style.pointerEvents = 'none'; // Don't block mouse events
        document.body.appendChild(this.container);

        // Create settings button
        this.createSettingsPanel();

        // Create mini-map container
        this.miniMapContainer = document.createElement('div');
        this.miniMapContainer.id = 'mini-map';
        this.miniMapContainer.style.position = 'absolute';
        this.miniMapContainer.style.bottom = '20px';
        this.miniMapContainer.style.right = '20px';
        this.miniMapContainer.style.width = '150px';
        this.miniMapContainer.style.height = '150px';
        this.miniMapContainer.style.backgroundColor = 'rgba(0, 30, 60, 0.5)';
        this.miniMapContainer.style.borderRadius = '50%';
        this.miniMapContainer.style.border = '2px solid rgba(100, 200, 255, 0.7)';
        document.body.appendChild(this.miniMapContainer);

        // Initialize elements as an empty object first
        this.elements = {};

        // Create FPS counter (at the very top left, above all other elements)
        this.elements.fpsCounter = this.createFPSCounter();

        // Create basic UI elements
        this.elements.coordinates = this.createUIElement('Position: 0, 0');
        //this.elements.wind = this.createUIElement('Wind: Calm (0 knots)');
        this.elements.playerCount = this.createUIElement('Players: 0');
        this.elements.connectionStatus = this.createUIElement('Status: Connecting...');
        this.elements.speedometer = this.createSpeedometer();
        this.elements.fishing = this.createFishingUI();
        //this.elements.cannon = this.createCannonUI();
        this.elements.inventory = this.createInventory();

        // Initialize player markers and island markers
        this.islandMarkers = new Map();
        this.playerMarkers = new Map();

        // Create player marker (self)
        this.selfMarker = document.createElement('div');
        this.selfMarker.style.position = 'absolute';
        this.selfMarker.style.width = '8px';
        this.selfMarker.style.height = '8px';
        this.selfMarker.style.backgroundColor = '#ffff00';
        this.selfMarker.style.borderRadius = '50%';
        this.selfMarker.style.transform = 'translate(-50%, -50%)';
        this.miniMapContainer.appendChild(this.selfMarker);

        // Initialize the abilities bar
        this.abilitiesBar = new AbilitiesBar();
        this.abilitiesBar.enableKeyboardShortcuts();

        // Initialize the chat system
        this.chat = initChat();

        // Initialize the mini map and connect it to the chat system
        this.miniMap = initMiniMap();
        this.miniMap.setChatSystem(this.chat);

        // Initialize the shop UI
        this.elements.shop = initShop(this);

        // Initialize game terminal
        this.terminal = initGameTerminal();

        // Connect the fire button to the fireCannons function
        //this.elements.cannon.fireButton.addEventListener('click', fireCannons);
    }

    createUIElement(text) {
        const element = document.createElement('div');
        element.textContent = text;
        element.style.marginBottom = '8px';
        element.style.backgroundColor = 'rgba(60, 30, 0, 0.7)';
        element.style.padding = '5px 10px';
        element.style.borderRadius = '5px';
        element.style.border = '1px solid rgba(120, 80, 40, 0.8)';
        element.style.color = '#E6C68A';
        element.style.fontFamily = 'serif';

        // If this is the player count element, make it look clearly clickable
        if (text.startsWith('Players:')) {
            // Make it look more like a button
            element.style.backgroundColor = 'rgba(80, 50, 10, 0.85)'; // Slightly brighter by default
            element.style.border = '1px solid #DAA520'; // Gold border
            element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)'; // Add shadow for depth
            element.style.pointerEvents = 'auto'; // Enable clicking
            element.style.cursor = 'pointer'; // Show pointer cursor
            element.style.transition = 'all 0.2s ease'; // Smooth transitions
            element.style.display = 'flex'; // For better alignment
            element.style.alignItems = 'center'; // Center content vertically
            element.style.justifyContent = 'space-between'; // Space between text and icon

            // Create text container for the left side
            const textContainer = document.createElement('div');
            textContainer.textContent = text;
            element.textContent = ''; // Clear the original text
            element.appendChild(textContainer);

            // Create right side with icon and text
            const actionContainer = document.createElement('div');
            actionContainer.style.display = 'flex';
            actionContainer.style.alignItems = 'center';
            actionContainer.style.color = '#FFD700'; // Gold color
            actionContainer.style.fontSize = '13px';
            actionContainer.style.fontWeight = 'bold';

            // Add view text
            const viewText = document.createElement('span');
            viewText.textContent = 'VIEW';
            viewText.style.marginRight = '4px';
            actionContainer.appendChild(viewText);

            // Add icon
            const clickIcon = document.createElement('span');
            clickIcon.textContent = '👁️';
            clickIcon.style.fontSize = '14px';
            actionContainer.appendChild(clickIcon);

            element.appendChild(actionContainer);

            // Enhanced hover effect
            element.addEventListener('mouseover', () => {
                element.style.backgroundColor = 'rgba(100, 60, 20, 0.9)';
                element.style.borderColor = '#FFD700';
                element.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.4)';
                element.style.transform = 'translateY(-1px)';
            });

            element.addEventListener('mouseout', () => {
                if (!element.classList.contains('active')) {
                    element.style.backgroundColor = 'rgba(60, 30, 0, 0.7)';
                }
            });

            // Add click event listener
            element.addEventListener('click', () => {

                playerList.toggle();
            });
        }

        this.container.appendChild(element);
        return element;
    }

    /*createCompass() {
        const compassContainer = document.createElement('div');
        compassContainer.style.width = '80px';
        compassContainer.style.height = '80px';
        compassContainer.style.borderRadius = '50%';
        compassContainer.style.border = '3px solid #B8860B';
        compassContainer.style.position = 'relative';
        compassContainer.style.marginTop = '10px';
        compassContainer.style.marginBottom = '15px';
        compassContainer.style.backgroundColor = '#D2B48C';
        compassContainer.style.backgroundImage = 'radial-gradient(circle, #D2B48C 0%, #C19A6B 100%)';
        compassContainer.style.display = 'flex';
        compassContainer.style.justifyContent = 'center';
        compassContainer.style.alignItems = 'center';
        compassContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';

        const directions = ['N', 'E', 'S', 'W'];
        directions.forEach((dir, i) => {
            const dirElement = document.createElement('div');
            dirElement.textContent = dir;
            dirElement.style.position = 'absolute';
            dirElement.style.fontWeight = 'bold';
            dirElement.style.color = '#8B4513';
            dirElement.style.fontFamily = 'serif';

            switch (dir) {
                case 'N':
                    dirElement.style.top = '5px';
                    dirElement.style.left = '50%';
                    dirElement.style.transform = 'translateX(-50%)';
                    break;
                case 'E':
                    dirElement.style.right = '5px';
                    dirElement.style.top = '50%';
                    dirElement.style.transform = 'translateY(-50%)';
                    break;
                case 'S':
                    dirElement.style.bottom = '5px';
                    dirElement.style.left = '50%';
                    dirElement.style.transform = 'translateX(-50%)';
                    break;
                case 'W':
                    dirElement.style.left = '5px';
                    dirElement.style.top = '50%';
                    dirElement.style.transform = 'translateY(-50%)';
                    break;
            }

            compassContainer.appendChild(dirElement);
        });

        const needle = document.createElement('div');
        needle.style.width = '3px';
        needle.style.height = '35px';
        needle.style.backgroundColor = '#B22222';
        needle.style.position = 'absolute';
        needle.style.top = '50%';
        needle.style.left = '50%';
        needle.style.transformOrigin = 'bottom center';
        needle.style.transform = 'translateX(-50%) translateY(-100%) rotate(0deg)';
        needle.style.borderRadius = '50% 50% 0 0';

        const needleBase = document.createElement('div');
        needleBase.style.width = '10px';
        needleBase.style.height = '10px';
        needleBase.style.backgroundColor = '#B8860B';
        needleBase.style.borderRadius = '50%';
        needleBase.style.position = 'absolute';
        needleBase.style.top = '50%';
        needleBase.style.left = '50%';
        needleBase.style.transform = 'translate(-50%, -50%)';
        needleBase.style.boxShadow = 'inset 0 0 3px rgba(0, 0, 0, 0.5)';

        compassContainer.appendChild(needle);
        compassContainer.appendChild(needleBase);
        this.container.appendChild(compassContainer);

        return { container: compassContainer, needle: needle };
    }*/

    createSpeedometer() {
        const speedContainer = document.createElement('div');
        speedContainer.style.width = '100px';
        speedContainer.style.height = '15px';
        speedContainer.style.backgroundColor = 'rgba(50, 25, 0, 0.7)';
        speedContainer.style.borderRadius = '10px';
        speedContainer.style.overflow = 'hidden';
        speedContainer.style.marginBottom = '15px';
        speedContainer.style.border = '1px solid #B8860B';

        const speedBar = document.createElement('div');
        speedBar.style.width = '0%';
        speedBar.style.height = '100%';
        speedBar.style.backgroundColor = '#B8860B';
        speedBar.style.backgroundImage = 'linear-gradient(to right, #B8860B, #DAA520)';
        speedBar.style.transition = 'width 0.3s ease-out';

        speedContainer.appendChild(speedBar);
        this.container.appendChild(speedContainer);

        return { container: speedContainer, bar: speedBar };
    }

    createFishingUI() {
        // Create fishing container with ornate ship control styling
        const fishingContainer = document.createElement('div');
        fishingContainer.id = 'fishing-ui';
        fishingContainer.style.position = 'absolute';
        fishingContainer.style.bottom = '20px';
        fishingContainer.style.left = '20px';
        fishingContainer.style.width = '180px';
        fishingContainer.style.backgroundColor = '#3A2616'; // Rich dark wood
        fishingContainer.style.padding = '0'; // No padding, will add internal container
        fishingContainer.style.borderRadius = '8px';
        fishingContainer.style.border = '2px solid #DAA520'; // Gold border
        fishingContainer.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.7), inset 0 0 5px rgba(0, 0, 0, 0.3)';
        fishingContainer.style.overflow = 'hidden';
        fishingContainer.style.pointerEvents = 'auto';
        document.body.appendChild(fishingContainer);

        // Create header bar with ornate styling
        const headerBar = document.createElement('div');
        headerBar.style.backgroundColor = '#4A2D17'; // Slightly lighter wood for header
        headerBar.style.padding = '6px 10px';
        headerBar.style.borderBottom = '2px solid #DAA520'; // Gold border
        headerBar.style.textAlign = 'center';
        headerBar.style.position = 'relative';
        headerBar.style.backgroundImage = 'linear-gradient(to bottom, #5A3D27, #4A2D17)'; // Wood grain effect
        fishingContainer.appendChild(headerBar);

        // Brass corner accents for header
        const corners = ['top-left', 'top-right'];
        corners.forEach(corner => {
            const accent = document.createElement('div');
            accent.style.position = 'absolute';
            accent.style.width = '10px';
            accent.style.height = '10px';
            accent.style.backgroundColor = '#DAA520';
            accent.style.borderRadius = corner.includes('top') ?
                (corner.includes('left') ? '5px 0 0 0' : '0 5px 0 0') :
                (corner.includes('left') ? '0 0 0 5px' : '0 0 5px 0');

            if (corner.includes('top')) accent.style.top = '0';
            if (corner.includes('bottom')) accent.style.bottom = '0';
            if (corner.includes('left')) accent.style.left = '0';
            if (corner.includes('right')) accent.style.right = '0';

            headerBar.appendChild(accent);
        });

        // Fishing label with ship manifest styling
        const fishingLabel = document.createElement('div');
        fishingLabel.textContent = 'FISHING STATION';
        fishingLabel.style.color = '#FFD700'; // Brighter gold for header
        fishingLabel.style.fontFamily = 'serif';
        fishingLabel.style.fontWeight = 'bold';
        fishingLabel.style.fontSize = '16px';
        fishingLabel.style.letterSpacing = '1px';
        fishingLabel.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
        headerBar.appendChild(fishingLabel);

        // Content container with internal padding
        const contentContainer = document.createElement('div');
        contentContainer.style.padding = '12px';
        contentContainer.style.backgroundColor = '#3A2616';
        contentContainer.style.backgroundImage = 'radial-gradient(circle at center, #3A2616 0%, #2A1606 100%)'; // Vignette effect
        fishingContainer.appendChild(contentContainer);

        // Cast button with ornate styling
        const castButton = document.createElement('button');
        castButton.textContent = 'Cast Line';
        castButton.style.width = '100%';
        castButton.style.padding = '8px 0';
        castButton.style.marginBottom = '10px';
        castButton.style.backgroundColor = '#5A3D27'; // Medium brown wood
        castButton.style.backgroundImage = 'linear-gradient(to bottom, #6A4D37, #5A3D27)'; // Wood grain effect
        castButton.style.border = '1px solid #DAA520'; // Gold border
        castButton.style.borderRadius = '5px';
        castButton.style.color = '#FFD700'; // Gold text
        castButton.style.fontWeight = 'bold';
        castButton.style.cursor = 'pointer';
        castButton.style.fontFamily = 'serif';
        castButton.style.fontSize = '15px';
        castButton.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
        castButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)';
        contentContainer.appendChild(castButton);

        // Add hover effect
        castButton.onmouseover = () => {
            castButton.style.backgroundImage = 'linear-gradient(to bottom, #7A5D47, #6A4D37)';
        };
        castButton.onmouseout = () => {
            castButton.style.backgroundImage = 'linear-gradient(to bottom, #6A4D37, #5A3D27)';
        };

        // Fishing status with parchment styling
        const fishingStatus = document.createElement('div');
        fishingStatus.textContent = 'Ready to fish';
        fishingStatus.style.color = '#FFD700'; // Gold
        fishingStatus.style.margin = '8px 0';
        fishingStatus.style.fontFamily = 'serif';
        fishingStatus.style.fontStyle = 'italic';
        fishingStatus.style.fontSize = '14px';
        fishingStatus.style.textAlign = 'center';
        fishingStatus.style.width = '100%';
        contentContainer.appendChild(fishingStatus);

        // Fish counter with brass instrument styling
        const fishCounter = document.createElement('div');
        fishCounter.textContent = 'Fish: 0';
        fishCounter.style.textAlign = 'center';
        fishCounter.style.width = '100%';
        fishCounter.style.padding = '6px 0';
        fishCounter.style.backgroundColor = '#28180A'; // Very dark wood
        fishCounter.style.backgroundImage = 'linear-gradient(to bottom, #28180A, #1A0D02)'; // Gradient
        fishCounter.style.border = '1px solid #DAA520'; // Gold border
        fishCounter.style.borderRadius = '5px';
        fishCounter.style.color = '#FFD700'; // Gold
        fishCounter.style.fontFamily = 'serif';
        fishCounter.style.fontWeight = 'bold';
        fishCounter.style.boxShadow = 'inset 0 0 5px rgba(0,0,0,0.5)';
        contentContainer.appendChild(fishCounter);

        // Create minigame container (hidden by default)
        const minigameContainer = document.createElement('div');
        minigameContainer.id = 'fishing-minigame';
        minigameContainer.style.position = 'absolute';
        minigameContainer.style.top = '50%';
        minigameContainer.style.left = '50%';
        minigameContainer.style.transform = 'translate(-50%, -50%)';
        minigameContainer.style.backgroundColor = 'rgba(60, 30, 0, 0.9)'; // Dark wood
        minigameContainer.style.padding = '20px';
        minigameContainer.style.borderRadius = '10px';
        minigameContainer.style.border = '3px solid #B8860B'; // Brass border
        minigameContainer.style.display = 'none';
        minigameContainer.style.flexDirection = 'column';
        minigameContainer.style.alignItems = 'center';
        minigameContainer.style.pointerEvents = 'auto';
        minigameContainer.style.zIndex = '100';
        minigameContainer.style.width = '300px';
        minigameContainer.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.8)';
        document.body.appendChild(minigameContainer);

        // Minigame title
        const minigameTitle = document.createElement('div');
        minigameTitle.textContent = 'Fish On!';
        minigameTitle.style.color = '#E6C68A'; // Muted gold
        minigameTitle.style.fontSize = '24px';
        minigameTitle.style.marginBottom = '20px';
        minigameTitle.style.fontFamily = 'serif';
        minigameTitle.style.fontWeight = 'bold';
        minigameContainer.appendChild(minigameTitle);

        // Minigame instructions
        const minigameInstructions = document.createElement('div');
        minigameInstructions.textContent = 'Click when the marker is in the green zone!';
        minigameInstructions.style.color = 'white';
        minigameInstructions.style.marginBottom = '20px';
        minigameContainer.appendChild(minigameInstructions);

        // Minigame progress bar container
        const progressBarContainer = document.createElement('div');
        progressBarContainer.style.width = '250px';
        progressBarContainer.style.height = '30px';
        progressBarContainer.style.backgroundColor = 'rgba(50, 50, 50, 0.7)';
        progressBarContainer.style.borderRadius = '15px';
        progressBarContainer.style.position = 'relative';
        progressBarContainer.style.overflow = 'hidden';
        progressBarContainer.style.marginBottom = '20px';
        minigameContainer.appendChild(progressBarContainer);

        // Target zone (green area)
        const targetZone = document.createElement('div');
        targetZone.style.position = 'absolute';
        targetZone.style.height = '100%';
        targetZone.style.backgroundColor = 'rgba(0, 255, 0, 0.5)';
        targetZone.style.width = '60px';
        targetZone.style.left = '95px'; // Centered in the progress bar
        progressBarContainer.appendChild(targetZone);

        // Marker (moving element)
        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        marker.style.height = '100%';
        marker.style.width = '10px';
        marker.style.backgroundColor = 'white';
        marker.style.left = '0px';
        marker.style.transition = 'left 0.1s linear';
        progressBarContainer.appendChild(marker);

        // Catch button
        const catchButton = document.createElement('button');
        catchButton.textContent = 'CATCH!';
        catchButton.style.padding = '10px 20px';
        catchButton.style.backgroundColor = 'rgba(255, 100, 100, 0.8)';
        catchButton.style.border = 'none';
        catchButton.style.borderRadius = '5px';
        catchButton.style.color = 'white';
        catchButton.style.fontWeight = 'bold';
        catchButton.style.fontSize = '18px';
        catchButton.style.cursor = 'pointer';
        minigameContainer.appendChild(catchButton);

        return {
            container: fishingContainer,
            castButton: castButton,
            status: fishingStatus,
            counter: fishCounter,
            minigame: {
                container: minigameContainer,
                marker: marker,
                targetZone: targetZone,
                catchButton: catchButton
            }
        };
    }

    createCannonUI() {
        // Create cannon control container with ornate styling
        /*
        const cannonContainer = document.createElement('div');
        cannonContainer.id = 'cannon-ui';
        cannonContainer.style.position = 'absolute';
        cannonContainer.style.bottom = '20px';
        cannonContainer.style.left = '210px'; // Position next to fishing UI
        cannonContainer.style.width = '180px';
        cannonContainer.style.backgroundColor = '#3A2616'; // Rich dark wood
        cannonContainer.style.padding = '0'; // No padding, will add internal container
        cannonContainer.style.borderRadius = '8px';
        cannonContainer.style.border = '2px solid #DAA520'; // Gold border
        cannonContainer.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.7), inset 0 0 5px rgba(0, 0, 0, 0.3)';
        cannonContainer.style.overflow = 'hidden';
        cannonContainer.style.pointerEvents = 'auto';
        document.body.appendChild(cannonContainer);

        // Create header bar with ornate styling matching fishing
        const headerBar = document.createElement('div');
        headerBar.style.backgroundColor = '#4A2D17'; // Slightly lighter wood for header
        headerBar.style.padding = '6px 10px';
        headerBar.style.borderBottom = '2px solid #DAA520'; // Gold border
        headerBar.style.textAlign = 'center';
        headerBar.style.position = 'relative';
        headerBar.style.backgroundImage = 'linear-gradient(to bottom, #5A3D27, #4A2D17)'; // Wood grain effect
        cannonContainer.appendChild(headerBar);

        // Brass corner accents for header
        const corners = ['top-left', 'top-right'];
        corners.forEach(corner => {
            const accent = document.createElement('div');
            accent.style.position = 'absolute';
            accent.style.width = '10px';
            accent.style.height = '10px';
            accent.style.backgroundColor = '#DAA520';
            accent.style.borderRadius = corner.includes('top') ?
                (corner.includes('left') ? '5px 0 0 0' : '0 5px 0 0') :
                (corner.includes('left') ? '0 0 0 5px' : '0 0 5px 0');

            if (corner.includes('top')) accent.style.top = '0';
            if (corner.includes('bottom')) accent.style.bottom = '0';
            if (corner.includes('left')) accent.style.left = '0';
            if (corner.includes('right')) accent.style.right = '0';

            headerBar.appendChild(accent);
        });

        /*

        // Cannon label
        const cannonLabel = document.createElement('div');
        cannonLabel.textContent = 'CANNON DECK';
        cannonLabel.style.color = '#FFD700'; // Brighter gold for header
        cannonLabel.style.fontFamily = 'serif';
        cannonLabel.style.fontWeight = 'bold';
        cannonLabel.style.fontSize = '16px';
        cannonLabel.style.letterSpacing = '1px';
        cannonLabel.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
        headerBar.appendChild(cannonLabel);

        // Content container with internal padding
        const contentContainer = document.createElement('div');
        contentContainer.style.padding = '12px';
        contentContainer.style.backgroundColor = '#3A2616';
        contentContainer.style.backgroundImage = 'radial-gradient(circle at center, #3A2616 0%, #2A1606 100%)'; // Vignette effect
        cannonContainer.appendChild(contentContainer);

        // Fire button with ornate styling
        const fireButton = document.createElement('button');
        fireButton.textContent = 'FIRE CANNONS';
        fireButton.style.width = '100%';
        fireButton.style.padding = '8px 0';
        fireButton.style.marginBottom = '5px';
        fireButton.style.backgroundColor = '#5A3D27'; // Medium brown wood
        fireButton.style.backgroundImage = 'linear-gradient(to bottom, #6A4D37, #5A3D27)'; // Wood grain effect
        fireButton.style.border = '1px solid #DAA520'; // Gold border
        fireButton.style.borderRadius = '5px';
        fireButton.style.color = '#FFD700'; // Gold text
        fireButton.style.fontWeight = 'bold';
        fireButton.style.cursor = 'pointer';
        fireButton.style.fontFamily = 'serif';
        fireButton.style.fontSize = '15px';
        fireButton.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
        fireButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)';
        fireButton.disabled = true; // Disabled by default
        contentContainer.appendChild(fireButton);

        // Add hover effect (only when enabled)
        fireButton.onmouseover = () => {
            if (!fireButton.disabled) {
                fireButton.style.backgroundImage = 'linear-gradient(to bottom, #7A5D47, #6A4D37)';
            }
        };
        fireButton.onmouseout = () => {
            if (!fireButton.disabled) {
                fireButton.style.backgroundImage = 'linear-gradient(to bottom, #6A4D37, #5A3D27)';
            }
        };

        // Spacebar hint with brass style
        const spaceHint = document.createElement('div');
        spaceHint.textContent = '(SPACE)';
        spaceHint.style.color = '#B8860B'; // Darker gold
        spaceHint.style.fontSize = '10px';
        spaceHint.style.fontFamily = 'serif';
        spaceHint.style.fontStyle = 'italic';
        spaceHint.style.textAlign = 'center';
        spaceHint.style.marginBottom = '8px';
        contentContainer.appendChild(spaceHint);

        // Cannon status with parchment styling
        const cannonStatus = document.createElement('div');
        cannonStatus.textContent = 'No targets in range';
        cannonStatus.style.color = '#FFD700'; // Gold
        cannonStatus.style.margin = '8px 0';
        cannonStatus.style.fontFamily = 'serif';
        cannonStatus.style.fontStyle = 'italic';
        cannonStatus.style.fontSize = '14px';
        cannonStatus.style.textAlign = 'center';
        cannonStatus.style.width = '100%';
        contentContainer.appendChild(cannonStatus);

        // Cooldown indicator with brass styling
        const cooldownIndicator = document.createElement('div');
        cooldownIndicator.style.width = '100%';
        cooldownIndicator.style.height = '10px';
        cooldownIndicator.style.backgroundColor = '#28180A'; // Very dark wood
        cooldownIndicator.style.backgroundImage = 'linear-gradient(to bottom, #28180A, #1A0D02)'; // Gradient
        cooldownIndicator.style.borderRadius = '5px';
        cooldownIndicator.style.overflow = 'hidden';
        cooldownIndicator.style.border = '1px solid #DAA520'; // Gold border
        cooldownIndicator.style.boxShadow = 'inset 0 0 5px rgba(0,0,0,0.5)';
        contentContainer.appendChild(cooldownIndicator);

        // Cooldown progress styled as glowing cannon fuse
        const cooldownProgress = document.createElement('div');
        cooldownProgress.style.width = '0%';
        cooldownProgress.style.height = '100%';
        cooldownProgress.style.backgroundColor = '#FFD700'; // Gold
        cooldownProgress.style.backgroundImage = 'linear-gradient(to right, #DAA520, #FFD700, #FFF8DC)'; // Glowing effect
        cooldownProgress.style.boxShadow = '0 0 10px #FFD700'; // Glow
        cooldownProgress.style.transition = 'width 0.1s linear';
        cooldownIndicator.appendChild(cooldownProgress);

        return {
            container: cannonContainer,
            fireButton: fireButton,
            status: cannonStatus,
            cooldown: {
                indicator: cooldownIndicator,
                progress: cooldownProgress
            }
        };
        */
    }

    createInventory() {
        // Create the inventory using the dedicated InventoryUI class
        const inventory = this.inventoryUI.createInventory();

        // Override the updateContent method to use our data
        this.inventoryUI.updateContent = () => {
            this.updateInventoryContent();
        };

        // Store references in elements
        this.elements.inventory = inventory;

        return inventory;
    }

    updateInventoryContent() {
        // This will be called from outside to update the inventory
        // Implementation will be added later
    }

    // Method to update player stats - can be called directly from fishing.js
    updatePlayerStats(stats) {
        if (!this.elements.playerStats) return;

        // Import getPlayerStats dynamically to avoid circular dependencies
        import('../core/network.js').then((network) => {
            // If stats parameter is provided, use it; otherwise get from network
            const playerStats = stats || network.getPlayerStats();

            // Update the UI elements with the latest stats
            if (playerStats.fishCount !== undefined) {
                this.elements.playerStats.fishCount.textContent = `Fish: ${playerStats.fishCount}`;
            }

            if (playerStats.monsterKills !== undefined) {
                this.elements.playerStats.monsterCount.textContent = `Monsters: ${playerStats.monsterKills}`;
            }

            if (playerStats.money !== undefined) {
                this.elements.playerStats.moneyCount.textContent = `Gold: ${playerStats.money}`;
            }
        });
    }

    addIslandMarker(id, position, radius) {
        this.miniMap.addIslandMarker(id, position, radius);
    }

    addPlayerMarker(id, position, color) {
        this.miniMap.addPlayerMarker(id, position, color);
    }

    removePlayerMarker(id) {
        this.miniMap.removePlayerMarker(id);
    }

    updateMiniMap(playerPosition, playerRotation, mapScale) {
        this.miniMap.updateMiniMap(playerPosition, playerRotation, mapScale);
    }

    update(data) {
        // Update speed
        if (data.speed !== undefined) {
            // Update speedometer (max speed of 10 knots)
            const speedPercent = Math.min(data.speed / 10 * 100, 100);
            this.elements.speedometer.bar.style.width = `${speedPercent}%`;

            // Change color based on speed
            if (data.speed > 7) {
                this.elements.speedometer.bar.style.backgroundColor = 'rgba(255, 50, 50, 0.7)';
            } else if (data.speed > 4) {
                this.elements.speedometer.bar.style.backgroundColor = 'rgba(255, 200, 50, 0.7)';
            } else {
                this.elements.speedometer.bar.style.backgroundColor = 'rgba(0, 255, 128, 0.7)';
            }
        }


        // Update coordinates
        if (data.position) {
            this.elements.coordinates.textContent = `Position: ${data.position.x.toFixed(0)}, ${data.position.z.toFixed(0)}`;
        }

        // Update wind
        /* if (data.windDirection !== undefined && data.windSpeed !== undefined) {
             const windDescription = this.getWindDescription(data.windSpeed);
             this.elements.wind.textContent = `Wind: ${windDescription} (${data.windSpeed.toFixed(1)} knots)`;
         }*/

        // Update time


        // Update player count
        if (data.playerCount !== undefined) {
            this.elements.playerCount.textContent = `Players: ${data.playerCount}`;
        }

        // Update connection status
        if (data.isConnected !== undefined) {
            this.elements.connectionStatus.textContent = data.isConnected ?
                'Status: Connected' : 'Status: Disconnected';
            this.elements.connectionStatus.style.color = data.isConnected ?
                'rgba(100, 255, 100, 1)' : 'rgba(255, 100, 100, 1)';
        }

        // Update fish count
        if (data.fishCount !== undefined) {
            this.elements.fishing.counter.textContent = `Fish: ${data.fishCount}`;
        }

        // Update mini-map
        if (data.position && data.heading !== undefined) {
            // First update monster markers if available
            if (data.monsters && this.miniMap) {
                this.miniMap.updateMonsterMarkers(
                    data.monsters,
                    data.position,
                    data.heading,
                    data.mapScale || 200
                );
            }

            // Then update the overall minimap with positions
            this.updateMiniMap(data.position, data.heading, data.mapScale || 200);
        }

        // Update player stats if requested
        if (data.updateStats) {
            this.updatePlayerStats();
        }

        // Update shop availability if we have position and island data
        if (data.position && data.nearestIsland) {
            updateShopAvailability(data.activeIslands, data.position);
        }

        // Update FPS counter
        this.updateFPS();

        // Add ability-related updates if needed
        if (data.abilityCooldowns) {
            data.abilityCooldowns.forEach((cooldown, index) => {
                if (cooldown > 0) {
                    this.abilitiesBar.startCooldown(index, cooldown);
                }
            });
        }
    }

    getCardinalDirection(degrees) {
        // Normalize to 0-360
        const normalized = ((degrees % 360) + 360) % 360;

        // Define direction ranges
        const directions = [
            { name: 'N', min: 337.5, max: 360 },
            { name: 'N', min: 0, max: 22.5 },
            { name: 'NE', min: 22.5, max: 67.5 },
            { name: 'E', min: 67.5, max: 112.5 },
            { name: 'SE', min: 112.5, max: 157.5 },
            { name: 'S', min: 157.5, max: 202.5 },
            { name: 'SW', min: 202.5, max: 247.5 },
            { name: 'W', min: 247.5, max: 292.5 },
            { name: 'NW', min: 292.5, max: 337.5 }
        ];

        // Find matching direction
        for (const dir of directions) {
            if ((dir.min <= normalized && normalized < dir.max) ||
                (dir.name === 'N' && normalized >= 337.5)) {
                return dir.name;
            }
        }

        return 'N'; // Default
    }

    getWindDescription(speed) {
        // Beaufort scale (simplified)
        if (speed < 1) return 'Calm';
        if (speed < 4) return 'Light Air';
        if (speed < 7) return 'Light Breeze';
        if (speed < 11) return 'Gentle Breeze';
        if (speed < 17) return 'Moderate Breeze';
        if (speed < 22) return 'Fresh Breeze';
        if (speed < 28) return 'Strong Breeze';
        if (speed < 34) return 'Near Gale';
        if (speed < 41) return 'Gale';
        if (speed < 48) return 'Strong Gale';
        if (speed < 56) return 'Storm';
        if (speed < 64) return 'Violent Storm';
        return 'Hurricane';
    }

    updateInventory(fishInventory) {
        // Use the inventory UI to update the display
        this.inventoryUI.updateInventory(fishInventory);
    }

    createFPSCounter() {
        const fpsElement = document.createElement('div');
        fpsElement.textContent = 'FPS: 0';
        fpsElement.style.position = 'absolute';
        fpsElement.style.top = '5px';
        fpsElement.style.left = '5px';
        fpsElement.style.fontSize = '12px';
        fpsElement.style.padding = '3px 6px';
        fpsElement.style.backgroundColor = 'rgba(50, 25, 0, 0.8)';
        fpsElement.style.color = '#E6C68A';
        fpsElement.style.fontFamily = 'serif';
        fpsElement.style.borderRadius = '3px';
        fpsElement.style.border = '1px solid #B8860B';
        document.body.appendChild(fpsElement);

        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.currentFps = 0;

        return fpsElement;
    }

    // New method to update FPS counter
    updateFPS() {
        // Increment frame count
        this.frameCount++;

        // Calculate FPS every 500ms for stability
        const now = performance.now();
        const elapsed = now - this.lastFpsUpdate;

        if (elapsed >= 500) {
            // Calculate FPS
            this.currentFps = Math.round((this.frameCount * 1000) / elapsed);

            // Update counter text with color based on performance
            let fpsColor = 'lime'; // Good performance

            if (this.currentFps < 30) {
                fpsColor = 'red'; // Poor performance
            } else if (this.currentFps < 50) {
                fpsColor = 'yellow'; // Moderate performance
            }

            this.elements.fpsCounter.textContent = `FPS: ${this.currentFps}`;
            this.elements.fpsCounter.style.color = fpsColor;

            // Reset counters
            this.lastFpsUpdate = now;
            this.frameCount = 0;
        }

        // Add this single line at the end of the existing method
        this.displayDiagnosticsInfo();
    }

    displayDiagnosticsInfo() {
        // Only do something if diagnostics is enabled
        if (!ENABLE_DIAGNOSTICS) return;

        const diagnosticsData = getDiagnosticsData();

        // Check if this is likely a browser-specific performance issue
        if (this.elements.fpsCounter && diagnosticsData.performanceScore > 0) {
            const fps = this.currentFps || 0;

            // If we have good hardware but low FPS, show a small indicator
            if (fps < 30 && diagnosticsData.performanceScore > 50) {
                // Only show browser warning if not already showing
                if (!this.elements.browserWarning) {
                    const browserWarning = document.createElement('div');
                    browserWarning.id = 'browser-performance-warning';
                    browserWarning.style.position = 'absolute';
                    browserWarning.style.top = '30px';
                    browserWarning.style.left = '5px';
                    browserWarning.style.backgroundColor = 'rgba(255, 60, 60, 0.8)';
                    browserWarning.style.color = 'white';
                    browserWarning.style.padding = '5px';
                    browserWarning.style.borderRadius = '3px';
                    browserWarning.style.fontSize = '12px';
                    browserWarning.style.zIndex = '9999';

                    // Different message for Brave
                    if (isBraveBrowser()) {
                        browserWarning.innerHTML = '⚠️ Performance may be affected by Brave settings. <a href="#" id="browser-help">Help</a>';
                    } else {
                        browserWarning.innerHTML = '⚠️ Browser settings may affect performance. <a href="#" id="browser-help">Help</a>';
                    }

                    document.body.appendChild(browserWarning);
                    this.elements.browserWarning = browserWarning;

                    // Add help click handler
                    document.getElementById('browser-help').addEventListener('click', (e) => {
                        e.preventDefault();
                        alert('To improve performance:\n\n' +
                            '1. Enable hardware acceleration in your browser settings\n' +
                            '2. Update your graphics drivers\n' +
                            '3. Close other browser tabs and applications\n' +
                            (isBraveBrowser() ?
                                '4. In Brave, go to brave://settings/system and ensure hardware acceleration is enabled' :
                                ''));
                    });
                }
            } else if (this.elements.browserWarning) {
                // Remove the warning if FPS is now good
                document.body.removeChild(this.elements.browserWarning);
                this.elements.browserWarning = null;
            }
        }
    }

    // Create a settings panel for game options
    createSettingsPanel() {
        // Create settings button (gear icon)
        const settingsButton = document.createElement('div');
        settingsButton.id = 'settings-button';
        settingsButton.innerHTML = '⚙️';
        settingsButton.style.position = 'absolute';
        settingsButton.style.top = '10px';
        settingsButton.style.right = '10px';
        settingsButton.style.fontSize = '24px';
        settingsButton.style.cursor = 'pointer';
        settingsButton.style.pointerEvents = 'auto';
        settingsButton.style.zIndex = '1000';
        settingsButton.title = "Game Settings";
        document.body.appendChild(settingsButton);

        // Create mute button with low-poly SVG icon
        const muteButton = document.createElement('div');
        muteButton.id = 'mute-button';

        // Create SVG unmuted icon (simple sound waves)
        const unmutedSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="white">
            <polygon points="3,9 3,15 7,15 12,20 12,4 7,9" />
            <path d="M16,7 L16,17 M20,4 L20,20" stroke="white" stroke-width="2" fill="none" />
        </svg>`;

        // Create SVG muted icon (speaker with X)
        const mutedSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="white">
            <polygon points="3,9 3,15 7,15 12,20 12,4 7,9" />
            <path d="M16,8 L22,14 M22,8 L16,14" stroke="white" stroke-width="2" fill="none" />
        </svg>`;

        muteButton.innerHTML = unmutedSVG; // Default unmuted icon
        muteButton.style.position = 'absolute';
        muteButton.style.top = '55px'; // Move down a bit more from the gear
        muteButton.style.right = '7px'; // Adjust to better center with the gear icon
        muteButton.style.cursor = 'pointer';
        muteButton.style.pointerEvents = 'auto';
        muteButton.style.zIndex = '1000';
        muteButton.style.backgroundColor = 'rgba(200, 50, 50, 0.8)'; // Red background
        muteButton.style.borderRadius = '50%';
        muteButton.style.width = '30px';
        muteButton.style.height = '30px';
        muteButton.style.display = 'flex';
        muteButton.style.justifyContent = 'center';
        muteButton.style.alignItems = 'center';
        muteButton.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.3)';
        muteButton.style.outline = 'none'; // Remove outline highlight
        muteButton.title = "Toggle Music";
        document.body.appendChild(muteButton);

        // Add event listener to toggle mute state
        muteButton.addEventListener('click', (e) => {
            // Access the MusicSystem from window scope
            const isMuted = window.MusicSystem.toggleMute();

            // Update the icon based on mute state
            muteButton.innerHTML = isMuted ? mutedSVG : unmutedSVG;
            muteButton.title = isMuted ? "Unmute Music" : "Mute Music";

            // Add visual feedback for the button - more subtle change
            muteButton.style.backgroundColor = isMuted ? 'rgba(150, 50, 50, 0.8)' : 'rgba(200, 50, 50, 0.8)';

            // Prevent any default browser highlight
            e.preventDefault();
        });

        // Remove animation and use more subtle transition
        muteButton.style.transition = 'background-color 0.2s ease';

        // Prevent highlight on click
        muteButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        // Create settings panel (initially hidden)
        const settingsPanel = document.createElement('div');
        settingsPanel.id = 'settings-panel';
        settingsPanel.style.position = 'absolute';
        settingsPanel.style.top = '40px';
        settingsPanel.style.right = '10px';
        settingsPanel.style.backgroundColor = 'rgba(50, 50, 70, 0.9)';
        settingsPanel.style.padding = '15px';
        settingsPanel.style.borderRadius = '8px';
        settingsPanel.style.border = '2px solid #4477aa';
        settingsPanel.style.width = '250px';
        settingsPanel.style.display = 'none';
        settingsPanel.style.pointerEvents = 'auto';
        settingsPanel.style.zIndex = '999';
        settingsPanel.style.maxHeight = '80vh';
        settingsPanel.style.overflowY = 'auto';
        document.body.appendChild(settingsPanel);

        // Add panel header
        const panelHeader = document.createElement('div');
        panelHeader.textContent = 'Game Settings';
        panelHeader.style.fontSize = '18px';
        panelHeader.style.fontWeight = 'bold';
        panelHeader.style.marginBottom = '15px';
        panelHeader.style.color = '#aaccff';
        panelHeader.style.borderBottom = '1px solid #4477aa';
        panelHeader.style.paddingBottom = '5px';
        settingsPanel.appendChild(panelHeader);

        // Add water style toggle section
        const waterStyleSection = document.createElement('div');
        waterStyleSection.style.marginBottom = '15px';
        settingsPanel.appendChild(waterStyleSection);

        // Add section header with description
        const waterHeader = document.createElement('div');
        waterHeader.innerHTML = '<span style="font-weight: bold;">Water Style</span>' +
            '<span style="font-size: 11px; opacity: 0.8; display: block; margin-top: 2px;">' +
            'Choose the visual style of the water</span>';
        waterHeader.style.marginBottom = '8px';
        waterHeader.style.color = '#ffffff';
        waterStyleSection.appendChild(waterHeader);

        // Create container for water style buttons
        const waterStyleButtons = document.createElement('div');
        waterStyleButtons.style.display = 'flex';
        waterStyleButtons.style.gap = '5px'; // Reduced gap for more buttons
        waterStyleButtons.style.flexWrap = 'wrap'; // Allow wrapping if needed
        waterStyleSection.appendChild(waterStyleButtons);

        // Create realistic button
        const realisticButton = this.createStyleButton('Realistic', 'realistic');
        realisticButton.classList.add('active'); // Default active
        waterStyleButtons.appendChild(realisticButton);

        // Create cartoony button
        const cartoonyButton = this.createStyleButton('Cartoony', 'cartoony');
        waterStyleButtons.appendChild(cartoonyButton);

        // Create toon button (cell-shaded)
        const toonButton = this.createStyleButton('Cell-Shaded', 'toon');
        waterStyleButtons.appendChild(toonButton);

        // Add status message area
        const statusMessage = document.createElement('div');
        statusMessage.id = 'water-style-status';
        statusMessage.style.marginTop = '8px';
        statusMessage.style.fontSize = '12px';
        statusMessage.style.color = '#aaffaa';
        statusMessage.style.opacity = '0';
        statusMessage.style.transition = 'opacity 0.5s ease';
        statusMessage.style.textAlign = 'center';
        waterStyleSection.appendChild(statusMessage);

        // Water style buttons functionality
        const waterButtons = [realisticButton, cartoonyButton, toonButton];
        waterButtons.forEach(button => {
            button.addEventListener('click', () => {
                try {
                    // Remove active class from all buttons
                    waterButtons.forEach(btn => btn.classList.remove('active'));
                    // Add active class to clicked button
                    button.classList.add('active');

                    // Show "changing" status
                    statusMessage.textContent = `Changing to ${button.textContent} water...`;
                    statusMessage.style.opacity = '1';
                    statusMessage.style.color = '#aaffaa';

                    // Set water style
                    setWaterStyle(button.dataset.style);

                    // Show success message
                    setTimeout(() => {
                        statusMessage.textContent = `Water style changed to ${button.textContent}!`;

                        // Fade out message after a delay
                        setTimeout(() => {
                            statusMessage.style.opacity = '0';
                        }, 2000);
                    }, 500);
                } catch (error) {
                    // Show error message
                    statusMessage.textContent = `Error: ${error.message || 'Could not change water style'}`;
                    statusMessage.style.color = '#ffaaaa';
                    statusMessage.style.opacity = '1';


                    // Reset active button to match current style
                    waterButtons.forEach(btn => {
                        btn.classList.remove('active');
                        if (btn.dataset.style === 'realistic') {
                            btn.classList.add('active');
                        }
                    });
                }
            });
        });

        // After water style section, add shore effects toggle

        // Add shore effects toggle section
        const shoreEffectsSection = document.createElement('div');
        shoreEffectsSection.style.marginBottom = '15px';
        settingsPanel.appendChild(shoreEffectsSection);

        // Add section header
        const shoreHeader = document.createElement('div');
        shoreHeader.textContent = 'Shore Effects';
        shoreHeader.style.fontWeight = 'bold';
        shoreHeader.style.marginBottom = '8px';
        shoreHeader.style.color = '#ffffff';
        shoreEffectsSection.appendChild(shoreHeader);

        // Create toggle switch
        const toggleContainer = document.createElement('div');
        toggleContainer.style.display = 'flex';
        toggleContainer.style.alignItems = 'center';
        toggleContainer.style.justifyContent = 'space-between';
        shoreEffectsSection.appendChild(toggleContainer);

        // Label
        const toggleLabel = document.createElement('div');
        toggleLabel.textContent = 'Show Foam at Shorelines';
        toggleLabel.style.flex = '1';
        toggleContainer.appendChild(toggleLabel);

        // Create toggle switch
        const toggleSwitch = document.createElement('div');
        toggleSwitch.style.width = '36px';
        toggleSwitch.style.height = '20px';
        toggleSwitch.style.backgroundColor = areShoreEffectsEnabled() ? 'rgba(80, 180, 120, 0.8)' : 'rgba(80, 80, 100, 0.5)';
        toggleSwitch.style.borderRadius = '10px';
        toggleSwitch.style.position = 'relative';
        toggleSwitch.style.cursor = 'pointer';
        toggleSwitch.style.transition = 'background-color 0.3s ease';
        toggleContainer.appendChild(toggleSwitch);

        // Create toggle button
        const toggleButton = document.createElement('div');
        toggleButton.style.width = '16px';
        toggleButton.style.height = '16px';
        toggleButton.style.backgroundColor = '#ffffff';
        toggleButton.style.borderRadius = '50%';
        toggleButton.style.position = 'absolute';
        toggleButton.style.top = '2px';
        toggleButton.style.left = areShoreEffectsEnabled() ? '18px' : '2px';
        toggleButton.style.transition = 'left 0.3s ease';
        toggleSwitch.appendChild(toggleButton);

        // Add click event
        toggleSwitch.addEventListener('click', () => {
            // Initialize gameSettings if needed
            window.gameSettings = window.gameSettings || {};

            // Toggle the shore effects setting
            window.gameSettings.enableShoreEffects = !areShoreEffectsEnabled();

            // Update UI
            toggleButton.style.left = window.gameSettings.enableShoreEffects ? '18px' : '2px';
            toggleSwitch.style.backgroundColor = window.gameSettings.enableShoreEffects ?
                'rgba(80, 180, 120, 0.8)' : 'rgba(80, 80, 100, 0.5)';

            // Show status message
            statusMessage.textContent = `Shore effects ${window.gameSettings.enableShoreEffects ? 'enabled' : 'disabled'}`;
            statusMessage.style.opacity = '1';
            statusMessage.style.color = '#aaffaa';

            // Fade out message after a delay
            setTimeout(() => {
                statusMessage.style.opacity = '0';
            }, 2000);
        });

        // Toggle settings panel when clicking the button
        settingsButton.addEventListener('click', () => {
            if (settingsPanel.style.display === 'none') {
                settingsPanel.style.display = 'block';
                try {
                    // Register this as an open UI if available
                    if (typeof registerOpenUI === 'function') {
                        registerOpenUI(settingsPanel);
                    }
                } catch (e) {

                }
            } else {
                settingsPanel.style.display = 'none';
                try {
                    // Unregister this as an open UI if available
                    if (typeof unregisterOpenUI === 'function') {
                        unregisterOpenUI(settingsPanel);
                    }
                } catch (e) {

                }
            }
        });

        // Add player list button
        const playerListSection = document.createElement('div');
        playerListSection.style.marginBottom = '15px';
        settingsPanel.appendChild(playerListSection);

        // Add section header
        const playerListHeader = document.createElement('div');
        playerListHeader.textContent = 'Players';
        playerListHeader.style.fontWeight = 'bold';
        playerListHeader.style.marginBottom = '8px';
        playerListHeader.style.color = '#ffffff';
        playerListSection.appendChild(playerListHeader);

        // Create button
        const playerListButton = document.createElement('button');
        playerListButton.textContent = 'Show Active Sailors';
        playerListButton.style.width = '100%';
        playerListButton.style.padding = '8px 10px';
        playerListButton.style.backgroundColor = '#5A3D27';
        playerListButton.style.backgroundImage = 'linear-gradient(to bottom, #6A4D37, #5A3D27)';
        playerListButton.style.border = '1px solid #DAA520';
        playerListButton.style.borderRadius = '5px';
        playerListButton.style.color = '#FFD700';
        playerListButton.style.fontWeight = 'bold';
        playerListButton.style.cursor = 'pointer';
        playerListButton.style.fontFamily = 'serif';
        playerListButton.style.fontSize = '14px';
        playerListButton.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
        playerListButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)';

        // Add hover effect
        playerListButton.addEventListener('mouseover', () => {
            playerListButton.style.backgroundImage = 'linear-gradient(to bottom, #7A5D47, #6A4D37)';
        });
        playerListButton.addEventListener('mouseout', () => {
            playerListButton.style.backgroundImage = 'linear-gradient(to bottom, #6A4D37, #5A3D27)';
        });

        // Click handler to open player list
        playerListButton.addEventListener('click', () => {

            // Hide settings panel
            settingsPanel.style.display = 'none';


            // Show player list

            playerList.show();

        });

        playerListSection.appendChild(playerListButton);

        // After the player list button section, add a terminal button section
        const terminalSection = document.createElement('div');
        terminalSection.style.marginBottom = '15px';
        settingsPanel.appendChild(terminalSection);

        // Add section header
        const terminalHeader = document.createElement('div');
        terminalHeader.textContent = 'Command Terminal';
        terminalHeader.style.fontWeight = 'bold';
        terminalHeader.style.marginBottom = '8px';
        terminalHeader.style.color = '#ffffff';
        terminalSection.appendChild(terminalHeader);

        // Create button
        const terminalButton = document.createElement('button');
        terminalButton.textContent = 'Open Command Terminal';
        terminalButton.style.width = '100%';
        terminalButton.style.padding = '8px 10px';
        terminalButton.style.backgroundColor = '#5A3D27';
        terminalButton.style.backgroundImage = 'linear-gradient(to bottom, #6A4D37, #5A3D27)';
        terminalButton.style.border = '1px solid #DAA520';
        terminalButton.style.borderRadius = '5px';
        terminalButton.style.color = '#FFD700';
        terminalButton.style.fontWeight = 'bold';
        terminalButton.style.cursor = 'pointer';
        terminalButton.style.fontFamily = 'serif';
        terminalButton.style.fontSize = '14px';
        terminalButton.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
        terminalButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)';

        // Add hover effect
        terminalButton.addEventListener('mouseover', () => {
            terminalButton.style.backgroundImage = 'linear-gradient(to bottom, #7A5D47, #6A4D37)';
        });
        terminalButton.addEventListener('mouseout', () => {
            terminalButton.style.backgroundImage = 'linear-gradient(to bottom, #6A4D37, #5A3D27)';
        });

        // Click handler to open terminal
        terminalButton.addEventListener('click', () => {
            // Hide settings panel
            settingsPanel.style.display = 'none';

            // Show terminal
            this.terminal.toggle(true);
        });

        terminalSection.appendChild(terminalButton);

        // Store references
        this.settingsButton = settingsButton;
        this.settingsPanel = settingsPanel;
        this.waterStyleStatus = statusMessage;
    }

    // Helper method to create a styled button for settings
    createStyleButton(text, styleValue) {
        const button = document.createElement('div');
        button.textContent = text;
        button.dataset.style = styleValue;
        button.style.padding = '6px 10px';
        button.style.backgroundColor = 'rgba(60, 80, 120, 0.5)';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.textAlign = 'center';
        button.style.flexGrow = '1';
        button.style.transition = 'all 0.2s ease';
        button.style.fontSize = '12px'; // Reduced font size for more buttons
        button.title = `Switch to ${text} water style`;

        // Add hover effects
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = 'rgba(80, 100, 140, 0.7)';
        });
        button.addEventListener('mouseout', () => {
            if (!button.classList.contains('active')) {
                button.style.backgroundColor = 'rgba(60, 80, 120, 0.5)';
            }
        });

        // Add active style with CSS
        const style = document.createElement('style');
        style.textContent = `
            #settings-panel div.active {
                background-color: rgba(100, 150, 200, 0.8) !important;
                box-shadow: 0 0 5px rgba(150, 200, 255, 0.8);
                transform: scale(1.05);
            }
        `;
        document.head.appendChild(style);

        return button;
    }
}

// Create a global UI instance
const gameUI = new GameUI();

// Track open UI elements in a stack to handle multiple open UIs
const openUIElements = [];

// Global escape key handler
function handleEscapeKey(event) {
    if (event.key === 'Escape' && openUIElements.length > 0) {
        // Get the most recently opened UI
        const lastUI = openUIElements[openUIElements.length - 1];
        // Close it using its close method
        if (lastUI && typeof lastUI.close === 'function') {
            lastUI.close();
        }
        // UI's close function should handle removing itself from the stack
    }
}

// Register a UI element as open
export function registerOpenUI(uiElement) {

    // Add the UI to the stack of open elements
    if (uiElement && !openUIElements.includes(uiElement)) {
        openUIElements.push(uiElement);

        // Ensure escape key handler is attached
        if (openUIElements.length === 1) {
            document.addEventListener('keydown', handleEscapeKey);
        }
    }
}

// Unregister a UI element when closed
export function unregisterOpenUI(uiElement) {
    const index = openUIElements.indexOf(uiElement);
    if (index !== -1) {
        openUIElements.splice(index, 1);

        // Remove escape key handler if no more UIs are open
        if (openUIElements.length === 0) {
            document.removeEventListener('keydown', handleEscapeKey);
        }
    }
}

// Export the UI instance
export { gameUI }; 