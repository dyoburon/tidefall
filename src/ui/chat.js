import * as THREE from 'three';
import { sendChatMessage, getRecentMessages, onChatMessage, onRecentMessages } from '../core/network.js';
// Import the command system
import { initCommandSystem, isCommand, processCommand } from '../commands/commandSystem.js';
import { isTouchDevice } from '../controls/touchControls.js';

export class ChatSystem {
    constructor() {
        this.messages = [];
        this.visible = false;
        this.minimized = false;
        this.unreadCount = 0;

        // Initialize command system
        this.commandSystem = null;

        // Create the UI elements
        this.createChatUI();

        // Set up Socket.IO event listeners
        this.setupSocketEvents();

        // Add resize and orientation change listeners to update the UI if needed
        window.addEventListener('resize', this.updateLayoutForDevice.bind(this));
        window.addEventListener('orientationchange', this.updateLayoutForDevice.bind(this));
    }

    createChatUI() {
        // Create the integrated control panel container (styled as a wooden navigation desk)
        this.controlPanel = document.createElement('div');
        this.controlPanel.className = 'ship-control-panel';
        this.controlPanel.style.position = 'absolute';
        this.controlPanel.style.bottom = isTouchDevice() ? '10px' : '20px';
        this.controlPanel.style.right = isTouchDevice() ? '10px' : '20px';
        this.controlPanel.style.width = isTouchDevice() ? '100px' : '200px';
        //this.controlPanel.style.height = '100px';
        this.controlPanel.style.backgroundColor = '#8B5A2B'; // Medium cedar wood
        this.controlPanel.style.borderRadius = '8px';
        this.controlPanel.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.7), inset 0 0 10px rgba(0, 0, 0, 0.3)'; // Worn wood look
        this.controlPanel.style.border = '4px solid #A67C52'; // Lighter wood border
        this.controlPanel.style.borderBottom = '6px solid #A67C52'; // Thicker bottom border for desk-like appearance
        this.controlPanel.style.overflow = 'hidden';
        this.controlPanel.style.zIndex = '900';
        document.body.appendChild(this.controlPanel);

        // Panel header with navigation station look
        const panelHeader = document.createElement('div');
        panelHeader.className = 'control-panel-header';
        panelHeader.style.height = isTouchDevice() ? '18px' : '30px';
        panelHeader.style.backgroundColor = '#654321'; // Darker wood
        panelHeader.style.borderBottom = isTouchDevice() ? '1px solid #D2B48C' : '2px solid #D2B48C';
        panelHeader.style.display = 'flex';
        panelHeader.style.justifyContent = 'space-between';
        panelHeader.style.alignItems = 'center';
        panelHeader.style.padding = isTouchDevice() ? '0 4px' : '0 10px';
        this.controlPanel.appendChild(panelHeader);

        // Ship systems label (now NAVIGATION STATION)
        const systemsLabel = document.createElement('div');
        systemsLabel.textContent = 'HELM';
        systemsLabel.style.color = '#DAA520'; // Golden text
        systemsLabel.style.fontFamily = 'serif';
        systemsLabel.style.fontWeight = 'bold';
        systemsLabel.style.fontSize = isTouchDevice() ? '9px' : '14px';
        systemsLabel.style.letterSpacing = '1px';
        panelHeader.appendChild(systemsLabel);

        // Brass status light
        const statusLight = document.createElement('div');
        statusLight.style.width = '10px';
        statusLight.style.height = '10px';
        statusLight.style.borderRadius = '50%';
        statusLight.style.backgroundColor = '#B8860B'; // Darker gold/brass
        statusLight.style.boxShadow = '0 0 5px #B8860B';
        statusLight.style.border = '1px solid #FFD700'; // Gold border
        panelHeader.appendChild(statusLight);

        // Create tabbed interface (styled as weathered book tabs)
        const tabsContainer = document.createElement('div');
        tabsContainer.style.display = 'flex';
        tabsContainer.style.borderBottom = isTouchDevice() ? '0.5px solid #D2B48C' : '1px solid #D2B48C';
        this.controlPanel.appendChild(tabsContainer);

        // Navigator's Map tab (renamed from Radar)
        this.radarTab = document.createElement('div');
        this.radarTab.textContent = isTouchDevice() ? 'MAP' : 'CHART';
        this.radarTab.style.padding = isTouchDevice() ? '3px 3px' : '6px 10px';
        this.radarTab.style.backgroundColor = '#654321'; // Darker wood
        this.radarTab.style.color = '#DAA520'; // Golden text
        this.radarTab.style.fontFamily = 'serif';
        this.radarTab.style.fontSize = isTouchDevice() ? '8px' : '12px';
        this.radarTab.style.cursor = 'pointer';
        this.radarTab.style.flex = '1';
        this.radarTab.style.textAlign = 'center';
        this.radarTab.style.borderRight = isTouchDevice() ? '0.5px solid #D2B48C' : '1px solid #D2B48C';
        this.radarTab.style.borderTop = '2px solid #DAA520'; // Gold top accent
        this.radarTab.dataset.active = 'true';
        tabsContainer.appendChild(this.radarTab);

        // Comms tab (styled as a logbook tab)
        this.commsTab = document.createElement('div');
        this.commsTab.textContent = isTouchDevice() ? 'LOG' : 'LOGBOOK';
        this.commsTab.style.padding = isTouchDevice() ? '3px 3px' : '6px 10px';
        this.commsTab.style.backgroundColor = 'transparent';
        this.commsTab.style.color = '#B8860B'; // Darker gold/brass
        this.commsTab.style.fontFamily = 'serif';
        this.commsTab.style.fontSize = isTouchDevice() ? '8px' : '12px';
        this.commsTab.style.cursor = 'pointer';
        this.commsTab.style.flex = '1';
        this.commsTab.style.textAlign = 'center';
        this.commsTab.style.borderTop = '1px solid transparent'; // For alignment
        this.commsTab.dataset.active = 'false';
        tabsContainer.appendChild(this.commsTab);

        // Content area
        const contentArea = document.createElement('div');
        contentArea.style.position = 'relative';
        contentArea.style.height = '200px';
        this.controlPanel.appendChild(contentArea);

        // Navigator's Map container (previously mini-map)
        this.miniMapContainer = document.createElement('div');
        this.miniMapContainer.id = 'navigators-map';
        this.miniMapContainer.style.position = 'absolute';
        this.miniMapContainer.style.top = '0';
        this.miniMapContainer.style.left = '0';
        this.miniMapContainer.style.width = '100%';
        this.miniMapContainer.style.height = '100%';
        this.miniMapContainer.style.backgroundColor = '#D2B48C'; // Tan color like parchment
        this.miniMapContainer.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg width=\'100%25\' height=\'100%25\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'smallGrid\' width=\'8\' height=\'8\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M 8 0 L 0 0 0 8\' fill=\'none\' stroke=\'%23C19A6B\' stroke-width=\'0.5\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%23D2B48C\'/%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'url(%23smallGrid)\'/%3E%3C/svg%3E")'; // Grid pattern for map
        this.miniMapContainer.style.display = 'flex';
        this.miniMapContainer.style.justifyContent = 'center';
        this.miniMapContainer.style.alignItems = 'center';
        contentArea.appendChild(this.miniMapContainer);

        // Map overlay (circular chart with directional compass)
        const radarScreen = document.createElement('div');
        radarScreen.style.position = 'absolute';
        radarScreen.style.top = '50%';
        radarScreen.style.left = '50%';
        radarScreen.style.transform = 'translate(-50%, -50%)';

        // Check if on mobile device
        if (isTouchDevice()) {
            // Mobile size (50% smaller)
            radarScreen.style.width = '75px';
            radarScreen.style.height = '75px';
            // Also make the container smaller
            contentArea.style.height = '100px'; // Half the original height
        } else {
            // Desktop size (original)
            radarScreen.style.width = '150px';
            radarScreen.style.height = '150px';
        }

        radarScreen.style.borderRadius = '50%';
        radarScreen.style.border = '2px solid #B8860B'; // Brass border
        radarScreen.style.boxShadow = 'inset 0 0 10px rgba(184, 134, 11, 0.4)'; // Darker gold inner glow
        radarScreen.style.background = 'radial-gradient(circle, #D2B48C 0%, #C19A6B 100%)'; // Parchment gradient
        radarScreen.style.overflow = 'hidden';

        // Add compass rose elements
        const directions = ['N', 'E', 'S', 'W'];
        directions.forEach((dir, i) => {
            const dirMarker = document.createElement('div');
            dirMarker.className = 'direction-marker';
            dirMarker.textContent = dir;
            dirMarker.style.position = 'absolute';
            dirMarker.style.color = '#8B4513'; // Dark brown text

            // Slightly larger font on mobile for better visibility
            if (isTouchDevice()) {
                dirMarker.style.fontSize = '7px';
            } else {
                dirMarker.style.fontSize = '10px';
            }

            dirMarker.style.fontFamily = 'serif';
            dirMarker.style.fontWeight = 'bold';

            // Position based on direction - move slightly further from edges
            if (dir === 'N') {
                dirMarker.style.top = isTouchDevice() ? '4px' : '5px';
            } else if (dir === 'E') {
                dirMarker.style.right = isTouchDevice() ? '4px' : '5px';
            } else if (dir === 'S') {
                dirMarker.style.bottom = isTouchDevice() ? '4px' : '5px';
            } else {
                dirMarker.style.left = isTouchDevice() ? '4px' : '5px';
            }

            radarScreen.appendChild(dirMarker);
        });

        // Add distance rings
        for (let i = 1; i <= 2; i++) {
            const ring = document.createElement('div');
            ring.className = 'radar-ring';
            ring.style.position = 'absolute';
            ring.style.top = `${50 - i * 25}%`;
            ring.style.left = `${50 - i * 25}%`;
            ring.style.width = `${i * 50}%`;
            ring.style.height = `${i * 50}%`;

            // Thinner border on mobile
            if (isTouchDevice()) {
                ring.style.border = '0.5px dashed #8B4513'; // Thinner dashed line for mobile
            } else {
                ring.style.border = '1px dashed #8B4513'; // Standard dashed line for desktop
            }

            ring.style.borderRadius = '50%';
            radarScreen.appendChild(ring);
        }

        this.miniMapContainer.appendChild(radarScreen);

        // Self marker (styled as a boat-shaped directional indicator)
        this.selfMarker = document.createElement('div');
        this.selfMarker.style.position = 'absolute';

        // Create boat shape using CSS
        this.selfMarker.style.width = isTouchDevice() ? '10px' : '12px';
        this.selfMarker.style.height = isTouchDevice() ? '14px' : '16px';
        this.selfMarker.style.backgroundColor = '#DAA520'; // Gold for boat body
        this.selfMarker.style.borderRadius = '50% 50% 0 0'; // Rounded front
        this.selfMarker.style.transform = 'translate(-50%, -50%)';
        this.selfMarker.style.boxShadow = '0 0 3px #DAA520'; // Gold glow
        this.selfMarker.style.zIndex = '5';
        this.selfMarker.style.border = '1px solid #8B4513'; // Dark brown border

        // Add a directional pointer (bow of the ship)
        const shipPointer = document.createElement('div');
        shipPointer.style.position = 'absolute';
        shipPointer.style.top = '-2px'; // Position at the front of the boat
        shipPointer.style.left = '50%';
        shipPointer.style.width = '0';
        shipPointer.style.height = '0';
        shipPointer.style.borderLeft = isTouchDevice() ? '3px solid transparent' : '4px solid transparent';
        shipPointer.style.borderRight = isTouchDevice() ? '3px solid transparent' : '4px solid transparent';
        shipPointer.style.borderBottom = isTouchDevice() ? '4px solid #B8860B' : '6px solid #B8860B'; // Brass color
        shipPointer.style.transform = 'translateX(-50%)';
        this.selfMarker.appendChild(shipPointer);

        // Direction label for the bow
        const directionLabel = document.createElement('div');
        directionLabel.className = 'direction-indicator';
        directionLabel.style.position = 'absolute';
        directionLabel.style.top = isTouchDevice() ? '-18px' : '-20px';
        directionLabel.style.left = '50%';
        directionLabel.style.transform = 'translateX(-50%)';
        directionLabel.style.color = '#DAA520'; // Gold
        directionLabel.style.fontSize = isTouchDevice() ? '8px' : '10px';
        directionLabel.style.fontWeight = 'bold';
        directionLabel.style.textShadow = '0px 0px 2px #000';
        directionLabel.textContent = 'N';
        this.selfMarker.appendChild(directionLabel);

        radarScreen.appendChild(this.selfMarker);

        // Chat container (styled as a ship's logbook)
        this.chatContainer = document.createElement('div');
        this.chatContainer.className = 'chat-container';
        this.chatContainer.style.position = 'absolute';
        this.chatContainer.style.top = '0';
        this.chatContainer.style.left = '0';
        this.chatContainer.style.width = '100%';
        this.chatContainer.style.height = '100%';
        this.chatContainer.style.display = 'none';
        this.chatContainer.style.flexDirection = 'column';
        this.chatContainer.style.backgroundColor = '#D2B48C'; // Tan parchment
        this.chatContainer.style.backgroundImage = 'linear-gradient(to bottom, transparent 24px, #B8860B66 25px)'; // Lined paper
        this.chatContainer.style.backgroundSize = '100% 25px';
        contentArea.appendChild(this.chatContainer);

        // Messages area (logbook pages)
        this.messagesArea = document.createElement('div');
        this.messagesArea.className = 'chat-messages';
        this.messagesArea.style.flex = '1';
        this.messagesArea.style.padding = isTouchDevice() ? '2px 3px' : '5px 8px';
        this.messagesArea.style.overflowY = 'auto';
        this.messagesArea.style.color = '#8B4513'; // Dark brown text
        this.messagesArea.style.fontSize = isTouchDevice() ? '7px' : '12px';
        this.messagesArea.style.fontFamily = 'serif';
        this.messagesArea.style.height = isTouchDevice() ? '70px' : '140px';
        this.messagesArea.style.lineHeight = isTouchDevice() ? '10px' : '20px';
        this.chatContainer.appendChild(this.messagesArea);

        // Input area (quill and ink design)
        const inputArea = document.createElement('div');
        inputArea.className = 'chat-input-area';
        inputArea.style.display = 'flex';
        inputArea.style.padding = '5px';
        inputArea.style.borderTop = '1px solid #8B4513'; // Dark brown separator
        inputArea.style.backgroundColor = '#C19A6B'; // Slightly darker parchment
        this.chatContainer.appendChild(inputArea);

        // Message input (styled as a quill writing area)
        this.messageInput = document.createElement('input');
        this.messageInput.type = 'text';
        this.messageInput.placeholder = isTouchDevice() ? 'Write...' : 'Write in logbook...';
        this.messageInput.style.flex = '1';
        this.messageInput.style.padding = isTouchDevice() ? '1px 2px' : '5px';
        this.messageInput.style.border = '1px solid #8B4513'; // Dark brown border
        this.messageInput.style.borderRadius = '3px';
        this.messageInput.style.backgroundColor = '#E6D2B5'; // Lighter parchment
        this.messageInput.style.color = '#3D1C00'; // Very dark brown
        this.messageInput.style.fontFamily = 'serif';
        this.messageInput.style.fontStyle = 'italic';
        this.messageInput.style.height = isTouchDevice() ? '14px' : 'auto';
        inputArea.appendChild(this.messageInput);

        // Send button (styled as a wax seal)
        this.sendButton = document.createElement('button');
        this.sendButton.textContent = isTouchDevice() ? '✓' : 'SEAL';
        this.sendButton.style.marginLeft = isTouchDevice() ? '2px' : '5px';
        this.sendButton.style.padding = isTouchDevice() ? '0' : '5px';
        this.sendButton.style.border = '1px solid #8B4513'; // Dark brown border
        this.sendButton.style.borderRadius = '50%';
        this.sendButton.style.width = isTouchDevice() ? '16px' : '40px';
        this.sendButton.style.height = isTouchDevice() ? '16px' : '40px';
        this.sendButton.style.backgroundColor = '#B22222'; // Firebrick red for wax seal
        this.sendButton.style.color = '#FFD700'; // Gold text
        this.sendButton.style.cursor = 'pointer';
        this.sendButton.style.fontFamily = 'serif';
        this.sendButton.style.fontSize = isTouchDevice() ? '8px' : '10px';
        this.sendButton.style.fontWeight = 'bold';
        this.sendButton.style.boxShadow = 'inset 0 0 5px rgba(0, 0, 0, 0.3)';
        this.sendButton.style.display = 'flex';
        this.sendButton.style.justifyContent = 'center';
        this.sendButton.style.alignItems = 'center';
        inputArea.appendChild(this.sendButton);

        // Unread indicator (styled as a small ink blot)
        this.unreadIndicator = document.createElement('div');
        this.unreadIndicator.className = 'unread-indicator';
        this.unreadIndicator.style.position = 'absolute';
        this.unreadIndicator.style.top = '3px';
        this.unreadIndicator.style.right = '3px';
        this.unreadIndicator.style.width = '16px';
        this.unreadIndicator.style.height = '16px';
        this.unreadIndicator.style.backgroundColor = '#B22222'; // Firebrick red
        this.unreadIndicator.style.borderRadius = '50%';
        this.unreadIndicator.style.display = 'none';
        this.unreadIndicator.style.justifyContent = 'center';
        this.unreadIndicator.style.alignItems = 'center';
        this.unreadIndicator.style.fontSize = '10px';
        this.unreadIndicator.style.color = '#FFD700'; // Gold text
        this.unreadIndicator.style.fontWeight = 'bold';
        this.unreadIndicator.style.boxShadow = '0 0 3px #B22222';
        this.commsTab.appendChild(this.unreadIndicator);

        // Set up tab switching
        this.radarTab.addEventListener('click', () => {
            if (this.radarTab.dataset.active === 'true') return;

            this.radarTab.dataset.active = 'true';
            this.commsTab.dataset.active = 'false';

            this.radarTab.style.backgroundColor = '#654321'; // Darker wood
            this.radarTab.style.color = '#DAA520'; // Golden text
            this.commsTab.style.backgroundColor = 'transparent';
            this.commsTab.style.color = '#B8860B'; // Darker gold/brass

            this.miniMapContainer.style.display = 'flex';
            this.chatContainer.style.display = 'none';
        });

        this.commsTab.addEventListener('click', () => {
            if (this.commsTab.dataset.active === 'true') return;

            this.commsTab.dataset.active = 'true';
            this.radarTab.dataset.active = 'false';

            this.commsTab.style.backgroundColor = '#654321'; // Darker wood
            this.commsTab.style.color = '#DAA520'; // Golden text
            this.radarTab.style.backgroundColor = 'transparent';
            this.radarTab.style.color = '#B8860B'; // Darker gold/brass

            this.chatContainer.style.display = 'flex';
            this.miniMapContainer.style.display = 'none';

            // Clear unread count when switching to chat
            this.unreadCount = 0;
            this.updateUnreadIndicator();
            this.scrollToBottom();
        });

        // Set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Send message on send button click
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // Handle keys in the message input
        this.messageInput.addEventListener('keydown', (e) => {
            // Send message on Enter key
            if (e.key === 'Enter') {
                this.sendMessage();
                // Don't propagate Enter key to game controls
                e.preventDefault();
                e.stopPropagation();
            }

            // Prevent game controls from capturing input when typing in chat
            // This ensures keys like WASD don't control the boat while typing
            e.stopPropagation();
        });

        // Add focus and blur event handlers to track when chat is active
        this.messageInput.addEventListener('focus', () => {
            // Set a global flag that can be checked by other handlers
            window.chatInputActive = true;

        });

        this.messageInput.addEventListener('blur', () => {
            // Clear the global flag
            window.chatInputActive = false;

        });
    }

    setupSocketEvents() {
        // Listen for new messages
        // Register callback for incoming messages
        onChatMessage((message) => {

            this.addMessage(message);

            // If chat tab is not active, increment unread count
            if (this.commsTab.dataset.active !== 'true') {
                this.unreadCount++;
                this.updateUnreadIndicator();
            }
        });

        // Register callback for receiving message history
        onRecentMessages((messages) => {

            // Clear existing messages
            this.messages = [];
            this.messagesArea.innerHTML = '';

            // Add each message to the UI
            if (messages && messages.length) {
                // Display messages in chronological order
                for (const message of messages) {
                    this.addMessage(message, false);
                }

                // Scroll to the bottom
                this.scrollToBottom();
            }
        });

        // Request recent messages when initialized
        getRecentMessages('global', 20);
    }

    sendMessage() {

        const content = this.messageInput.value.trim();
        if (!content) return;

        // Clear input field
        this.messageInput.value = '';

        // Check if this is a command
        if (this.commandSystem && isCommand(content)) {
            // Process the command
            const wasProcessed = processCommand(content, this);
            if (wasProcessed) {
                return; // Command processed, don't send as a chat message
            }
        }

        // Send message via network.js function
        sendChatMessage(content, 'global');
    }

    addMessage(message, shouldScroll = true) {



        // Create message element with quill-written appearance
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        messageEl.style.marginBottom = isTouchDevice() ? '2px' : '5px';
        messageEl.style.wordBreak = 'break-word';
        messageEl.style.fontFamily = 'serif';
        messageEl.style.fontSize = isTouchDevice() ? '7px' : '12px';
        messageEl.style.lineHeight = isTouchDevice() ? '9px' : '20px';

        // Format timestamp
        let timeStr = '';
        if (typeof message === 'string') {

            // Handle simple string messages (backward compatibility)
            timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Sanitize the string message to prevent XSS
            const sanitizedMessage = this.sanitizeText(message);
            messageEl.innerHTML = `
                <span style="color: #8B4513; font-size: ${isTouchDevice() ? '6px' : '10px'}; font-style: italic;">${timeStr}</span>
                <span style="color: #3D1C00;">${sanitizedMessage}</span>
            `;
        } else if (message && typeof message === 'object') {


            // Handle object messages (new format)
            // Format timestamp if available
            if (message.timestamp) {
                // Check if timestamp is a number (unix timestamp) or ISO string
                try {
                    const date = typeof message.timestamp === 'number' ?
                        new Date(message.timestamp) :
                        new Date(message.timestamp);
                    timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                } catch (e) {

                    timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            } else {
                timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            // Format message color based on sender color
            let colorStyle = '#8B4513'; // Default dark brown ink
            if (message.sender_color) {
                try {
                    const r = Math.floor(message.sender_color.r * 255);
                    const g = Math.floor(message.sender_color.g * 255);
                    const b = Math.floor(message.sender_color.b * 255);
                    colorStyle = `rgb(${r}, ${g}, ${b})`;

                } catch (e) {

                }
            }

            // Default sender name if not provided - sanitize it
            const rawSenderName = message.sender_name || "Unknown Sailor";
            const senderName = this.sanitizeText(rawSenderName);


            // Add special styling for messages with clan tags (matching [Tag] format)
            let formattedSenderName = senderName;

            // Check if the sender name has a clan tag
            try {
                if (senderName.includes('[') && senderName.includes(']')) {
                    // Apply special styling to clan tags
                    const tagMatch = senderName.match(/^(\[.*?\])\s*(.*?)$/);


                    if (tagMatch && tagMatch[1] && tagMatch[2]) {
                        // Both parts are already sanitized since we sanitized the whole name
                        const clanTag = tagMatch[1];
                        const baseName = tagMatch[2];

                        // Use gold color for clan tags
                        formattedSenderName = `<span style="color: #DAA520; font-style: italic;">${clanTag}</span> <span style="color: ${colorStyle};">${baseName}</span>`;

                    } else {
                        // Fallback if regex doesn't match as expected
                        formattedSenderName = `<span style="color: ${colorStyle};">${senderName}</span>`;

                    }
                } else {
                    // No clan tag, use normal styling
                    formattedSenderName = `<span style="color: ${colorStyle};">${senderName}</span>`;

                }
            } catch (e) {

                formattedSenderName = `<span style="color: ${colorStyle};">${senderName}</span>`;
            }

            // Sanitize message content
            const rawMessageContent = message.content || (typeof message === 'string' ? message : "");
            const messageContent = this.sanitizeText(rawMessageContent);

            // Create message HTML with quill writing style
            messageEl.innerHTML = `
                <span style="color: #8B4513; font-size: ${isTouchDevice() ? '6px' : '10px'}; font-style: italic;">${timeStr}</span>
                <span style="font-weight: bold;"> ${formattedSenderName}: </span>
                <span style="color: #3D1C00;">${messageContent}</span>
            `;

        } else {

            return; // Skip rendering invalid messages
        }

        // Add to messages area
        this.messagesArea.appendChild(messageEl);
        this.messages.push(message);

        // Limit number of displayed messages
        while (this.messagesArea.children.length > 100) {
            this.messagesArea.removeChild(this.messagesArea.firstChild);
        }

        // Update unread indicator if chat is minimized
        if (!this.visible || this.minimized) {
            this.unreadCount++;
            this.updateUnreadIndicator();
        }

        // Scroll to bottom if requested (and if chat is visible)
        if (shouldScroll && (this.visible && !this.minimized)) {
            this.scrollToBottom();
        }
    }

    /**
     * Sanitize text to prevent XSS attacks
     * @param {string} text - The text to sanitize
     * @returns {string} - The sanitized text
     */
    sanitizeText(text) {
        if (!text) return '';

        // Create a temporary element
        const tempElement = document.createElement('div');

        // Set the text as textContent which automatically handles HTML encoding
        tempElement.textContent = text;

        // Return the encoded HTML which now has special characters escaped
        return tempElement.innerHTML;
    }

    addSystemMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'system-message';
        messageEl.style.marginBottom = '5px';
        messageEl.style.color = '#B22222'; // Red ink for system messages
        messageEl.style.fontStyle = 'italic';
        messageEl.style.fontSize = '11px';
        messageEl.style.fontFamily = 'serif';
        messageEl.style.textAlign = 'center';
        messageEl.textContent = `~ ${text} ~`;

        this.messagesArea.appendChild(messageEl);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
    }

    updateUnreadIndicator() {
        if (this.unreadCount > 0) {
            this.unreadIndicator.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
            this.unreadIndicator.style.display = 'flex';
        } else {
            this.unreadIndicator.style.display = 'none';
        }
    }

    // New method to update layout if device detection changes
    updateLayoutForDevice() {
        // Get the current mobile state
        const isMobile = isTouchDevice();

        // Only update if the state has changed since last render
        if (this._lastMobileState !== isMobile) {
            this._lastMobileState = isMobile;

            // Update all the size-dependent properties
            // You could re-render the entire UI or just update specific properties
            this.controlPanel.style.width = isMobile ? '100px' : '200px';
            this.controlPanel.style.bottom = isMobile ? '10px' : '20px';
            this.controlPanel.style.right = isMobile ? '10px' : '20px';

            // ... update other properties as needed

            // Specifically update the radar screen size
            const radarScreen = this.radarScreen;
            if (radarScreen) {
                radarScreen.style.width = isMobile ? '75px' : '150px';
                radarScreen.style.height = isMobile ? '75px' : '150px';
            }

            // Update content area height
            const contentArea = this.controlPanel.querySelector('[style*="position: relative"]');
            if (contentArea) {
                contentArea.style.height = isMobile ? '100px' : '200px';
            }

            // Update messages area
            if (this.messagesArea) {
                this.messagesArea.style.height = isMobile ? '70px' : '140px';
                this.messagesArea.style.fontSize = isTouchDevice() ? '7px' : '12px';
            }

            // ... update other dynamic elements
        }
    }
}

export class MiniMap {
    constructor() {
        this.islandMarkers = new Map();
        this.playerMarkers = new Map();
        this.monsterMarkers = new Map();

        // Reference the radar screen from ChatSystem
        this.chatSystem = null;
        this.radarScreen = null; // Store reference to the actual circular radar screen
    }

    setChatSystem(chatSystem) {
        this.chatSystem = chatSystem;

        // Find the circular radar screen within the miniMapContainer
        // This is the circular element that should contain our markers
        const radarScreen = this.chatSystem.miniMapContainer.querySelector('div');
        if (!radarScreen) {

            return;
        }


        this.miniMapContainer = this.chatSystem.miniMapContainer;
        this.radarScreen = radarScreen; // Store reference to actual radar screen
    }

    addIslandMarker(id, position, radius) {
        if (this.islandMarkers.has(id) || !this.radarScreen) return;

        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        marker.style.width = '6px';
        marker.style.height = '6px';
        marker.style.backgroundColor = '#00ff88';
        marker.style.borderRadius = '50%';
        marker.style.transform = 'translate(-50%, -50%)';
        marker.style.boxShadow = '0 0 3px #00ff88';
        marker.style.zIndex = '3';
        this.radarScreen.appendChild(marker);

        this.islandMarkers.set(id, {
            element: marker,
            position: position
        });
    }

    addPlayerMarker(id, position, color) {
        if (this.playerMarkers.has(id) || !this.radarScreen) return;

        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        marker.style.width = '5px';
        marker.style.height = '5px';
        marker.style.backgroundColor = color || '#ff3333';
        marker.style.borderRadius = '50%';
        marker.style.transform = 'translate(-50%, -50%)';
        marker.style.boxShadow = '0 0 3px ' + (color || '#ff3333');
        marker.style.zIndex = '4';
        this.radarScreen.appendChild(marker);

        this.playerMarkers.set(id, {
            element: marker,
            position: position
        });
    }

    removePlayerMarker(id) {
        if (!this.playerMarkers.has(id) || !this.radarScreen) return;

        const marker = this.playerMarkers.get(id);
        this.radarScreen.removeChild(marker.element);
        this.playerMarkers.delete(id);
    }

    updateMonsterMarkers(monsters, playerPosition, playerRotation, mapScale) {
        if (!this.radarScreen) return; // Use radarScreen instead of miniMapContainer

        // Debug log to check for monsters and their positions
        //
        if (monsters.length > 0) {
            //
        }

        // Use a much smaller scale for monsters to amplify their movement
        // This makes even small position changes very visible on the radar
        const monsterMapScale = mapScale / 13; // Make monsters appear to move 4x more on the radar

        // Clear existing monster markers that are no longer needed
        const activeMonsterIds = new Set(monsters.map((_, index) => `monster-${index}`));

        // Remove markers for monsters that no longer exist
        for (const id of this.monsterMarkers.keys()) {
            if (!activeMonsterIds.has(id)) {
                const marker = this.monsterMarkers.get(id);
                if (marker && marker.element && marker.element.parentNode) {
                    this.radarScreen.removeChild(marker.element); // Use radarScreen
                }
                this.monsterMarkers.delete(id);
            }
        }

        // Add or update markers for existing monsters
        monsters.forEach((monster, index) => {
            const monsterId = `monster-${index}`;
            let marker;

            // Calculate distance to monster
            const distanceToMonster = new THREE.Vector3()
                .subVectors(monster.mesh.position, playerPosition)
                .length();

            // Only show monsters within detection range (800 units)
            const detectionRange = 800;
            const shouldShow = distanceToMonster <= detectionRange;

            // Determine display style based on monster state
            let markerColor, markerSize, markerPulse;

            switch (monster.state) {
                case 'attacking':
                    markerColor = '#ff0000'; // Bright red for attacking monsters
                    markerSize = 10; // Make bigger for better visibility
                    markerPulse = true;
                    break;
                case 'surfacing':
                    markerColor = '#ff3333'; // Red for surfacing monsters
                    markerSize = 9; // Make bigger for better visibility
                    markerPulse = false;
                    break;
                case 'hunting':
                    markerColor = '#ff9900'; // Orange for hunting monsters
                    markerSize = 8; // Make bigger for better visibility
                    markerPulse = false;
                    break;
                default:
                    markerColor = '#aa3333'; // Darker red for lurking monsters
                    markerSize = 7; // Make bigger for better visibility
                    markerPulse = false;
                    break;
            }

            if (!this.monsterMarkers.has(monsterId) && shouldShow) {
                // Create new marker for this monster
                marker = document.createElement('div');
                marker.style.position = 'absolute';
                marker.style.width = `${markerSize}px`;
                marker.style.height = `${markerSize}px`;
                marker.style.backgroundColor = markerColor;
                marker.style.borderRadius = '50%';
                marker.style.transform = 'translate(-50%, -50%)';
                marker.style.boxShadow = `0 0 5px ${markerColor}`;
                marker.style.zIndex = '6'; // Higher than player marker

                // Calculate initial position - use monsterMapScale
                const centerX = this.radarScreen.clientWidth / 2; // Use radarScreen
                const centerY = this.radarScreen.clientHeight / 2; // Use radarScreen
                const relX = (monster.mesh.position.x - playerPosition.x) / monsterMapScale;
                const relZ = (monster.mesh.position.z - playerPosition.z) / monsterMapScale;
                const rotatedX = relX * Math.cos(-playerRotation) - relZ * Math.sin(-playerRotation);
                const rotatedZ = relX * Math.sin(-playerRotation) + relZ * Math.cos(-playerRotation);

                // Set initial position immediately
                marker.style.left = `${centerX + rotatedX}px`;
                marker.style.top = `${centerY + rotatedZ}px`;

                // Add pulsing animation for attacking monsters
                if (markerPulse) {
                    marker.style.animation = 'pulse 1s infinite alternate';

                    // Create style for pulse animation if it doesn't exist
                    if (!document.getElementById('radar-pulse-animation')) {
                        const style = document.createElement('style');
                        style.id = 'radar-pulse-animation';
                        style.textContent = `
                            @keyframes pulse {
                                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
                                100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.4; }
                            }
                        `;
                        document.head.appendChild(style);
                    }
                }

                this.radarScreen.appendChild(marker); // Use radarScreen


                this.monsterMarkers.set(monsterId, {
                    element: marker,
                    position: monster.mesh.position.clone(),
                    state: monster.state
                });
            } else if (this.monsterMarkers.has(monsterId)) {
                // Update existing marker
                marker = this.monsterMarkers.get(monsterId);
                marker.position = monster.mesh.position.clone();

                // Calculate updated position - use monsterMapScale
                const centerX = this.radarScreen.clientWidth / 2; // Use radarScreen
                const centerY = this.radarScreen.clientHeight / 2; // Use radarScreen
                const relX = (monster.mesh.position.x - playerPosition.x) / monsterMapScale;
                const relZ = (monster.mesh.position.z - playerPosition.z) / monsterMapScale;
                const rotatedX = relX * Math.cos(-playerRotation) - relZ * Math.sin(-playerRotation);
                const rotatedZ = relX * Math.sin(-playerRotation) + relZ * Math.cos(-playerRotation);

                // Update position immediately
                marker.element.style.left = `${centerX + rotatedX}px`;
                marker.element.style.top = `${centerY + rotatedZ}px`;

                // Update marker appearance if monster state changed
                if (marker.state !== monster.state) {
                    marker.state = monster.state;
                    marker.element.style.backgroundColor = markerColor;
                    marker.element.style.boxShadow = `0 0 5px ${markerColor}`;
                    marker.element.style.width = `${markerSize}px`;
                    marker.element.style.height = `${markerSize}px`;

                    // Update pulse animation
                    if (markerPulse) {
                        marker.element.style.animation = 'pulse 1s infinite alternate';
                    } else {
                        marker.element.style.animation = 'none';
                    }
                }

                // Hide if outside mini-map
                const distance = Math.sqrt(rotatedX * rotatedX + rotatedZ * rotatedZ);
                const radius = this.radarScreen.clientWidth / 2;
                if (distance > radius - 5) {
                    marker.element.style.display = 'none';
                } else {
                    marker.element.style.display = 'block';
                }
            }
        });
    }

    updateMiniMap(playerPosition, playerRotation, mapScale) {
        if (!this.radarScreen) return;

        // Get radar dimensions
        const radarRadius = this.radarScreen.offsetWidth / 2;

        // Boat direction compass labels - adjust for THREE.js coordinate system
        // In THREE.js, rotation.y of 0 means facing negative Z (South on our map)
        // So we need to adjust by adding PI to get correct compass direction
        const getCompassDirection = (angle) => {
            // Convert rotation to degrees and normalize to 0-360
            // Adjust by 180 degrees (PI radians) to match THREE.js coordinate system
            const invertedAngle = -angle;
            const adjustedAngle = invertedAngle + Math.PI;
            const degrees = (adjustedAngle * (180 / Math.PI)) % 360;
            const normalizedDegrees = degrees < 0 ? degrees + 360 : degrees;

            // Map degrees to compass directions
            if (normalizedDegrees >= 337.5 || normalizedDegrees < 22.5) return 'N';
            if (normalizedDegrees >= 22.5 && normalizedDegrees < 67.5) return 'NE';
            if (normalizedDegrees >= 67.5 && normalizedDegrees < 112.5) return 'E';
            if (normalizedDegrees >= 112.5 && normalizedDegrees < 157.5) return 'SE';
            if (normalizedDegrees >= 157.5 && normalizedDegrees < 202.5) return 'S';
            if (normalizedDegrees >= 202.5 && normalizedDegrees < 247.5) return 'SW';
            if (normalizedDegrees >= 247.5 && normalizedDegrees < 292.5) return 'W';
            if (normalizedDegrees >= 292.5 && normalizedDegrees < 337.5) return 'NW';
            return 'N';
        };

        // Center the player on the mini-map
        const centerX = this.radarScreen.offsetWidth / 2;
        const centerY = this.radarScreen.offsetHeight / 2;

        // Update self marker and its rotation
        if (this.chatSystem && this.chatSystem.selfMarker) {
            this.chatSystem.selfMarker.style.left = `${centerX}px`;
            this.chatSystem.selfMarker.style.top = `${centerY}px`;

            // Apply rotation to show boat direction
            // THREE.js uses a different coordinate system - rotation.y of 0 means facing negative Z
            // We add 180 degrees to align the boat marker with the actual movement direction
            const rotationDegrees = ((playerRotation * (180 / Math.PI)) + 180);
            this.chatSystem.selfMarker.style.transform = `translate(-50%, -50%) rotate(${rotationDegrees}deg)`;

            // Update compass direction label
            const directionLabel = this.chatSystem.selfMarker.querySelector('.direction-indicator');
            if (directionLabel) {
                // Always keep text upright regardless of boat rotation
                directionLabel.style.transform = `translateX(-50%) rotate(${-rotationDegrees}deg)`;
                directionLabel.textContent = getCompassDirection(playerRotation);
            }
        }

        // Update island markers
        this.islandMarkers.forEach((marker, id) => {
            const relX = (marker.position.x - playerPosition.x) / mapScale;
            const relZ = (marker.position.z - playerPosition.z) / mapScale;

            // Rotate relative to player heading
            const rotatedX = relX * Math.cos(-playerRotation) - relZ * Math.sin(-playerRotation);
            const rotatedZ = relX * Math.sin(-playerRotation) + relZ * Math.cos(-playerRotation);

            marker.element.style.left = `${centerX + rotatedX}px`;
            marker.element.style.top = `${centerY + rotatedZ}px`;

            // Hide if outside mini-map
            const distance = Math.sqrt(rotatedX * rotatedX + rotatedZ * rotatedZ);
            const radius = this.radarScreen.offsetWidth / 2;
            if (distance > radius - 5) {
                marker.element.style.display = 'none';
            } else {
                marker.element.style.display = 'block';
            }
        });

        // Update other player markers
        this.playerMarkers.forEach((marker, id) => {
            const relX = (marker.position.x - playerPosition.x) / mapScale;
            const relZ = (marker.position.z - playerPosition.z) / mapScale;

            // Rotate relative to player heading
            const rotatedX = relX * Math.cos(-playerRotation) - relZ * Math.sin(-playerRotation);
            const rotatedZ = relX * Math.sin(-playerRotation) + relZ * Math.cos(-playerRotation);

            marker.element.style.left = `${centerX + rotatedX}px`;
            marker.element.style.top = `${centerY + rotatedZ}px`;

            // Hide if outside mini-map
            const distance = Math.sqrt(rotatedX * rotatedX + rotatedZ * rotatedZ);
            const radius = this.radarScreen.offsetWidth / 2;
            if (distance > radius - 5) {
                marker.element.style.display = 'none';
            } else {
                marker.element.style.display = 'block';
            }
        });

        // Note: Monster markers are now updated directly in updateMonsterMarkers method
        // instead of here to ensure immediate positioning on creation
    }
}

// Export init functions
export function initChat() {
    const chatSystem = new ChatSystem();

    // Initialize the command system and attach it to the chat system
    chatSystem.commandSystem = initCommandSystem();

    return chatSystem;
}

export function initMiniMap() {
    const miniMap = new MiniMap();
    return miniMap;
} 