import * as THREE from 'three';
import { sendChatMessage, getRecentMessages, onChatMessage, onRecentMessages } from '../core/network.js';
// Import the command system
import { initCommandSystem, isCommand, processCommand } from '../commands/commandSystem.js';
import { isTouchDevice } from '../controls/touchControls.js';

export class ChatSystem {
    constructor() {
        this.messages = [];
        this.visible = true; // Changed to true by default since it's the only UI element now

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
        // Create the integrated control panel container (styled as a wooden desk)
        this.controlPanel = document.createElement('div');
        this.controlPanel.className = 'ship-control-panel';
        this.controlPanel.style.position = 'absolute';
        this.controlPanel.style.bottom = isTouchDevice() ? '10px' : '20px';
        this.controlPanel.style.left = isTouchDevice() ? '10px' : '20px';
        this.controlPanel.style.width = isTouchDevice() ? '200px' : '300px'; // Doubled width
        this.controlPanel.style.backgroundColor = '#8B5A2B'; // Medium cedar wood
        this.controlPanel.style.borderRadius = '8px';
        this.controlPanel.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.7), inset 0 0 10px rgba(0, 0, 0, 0.3)'; // Worn wood look
        this.controlPanel.style.border = '4px solid #A67C52'; // Lighter wood border
        this.controlPanel.style.borderBottom = '6px solid #A67C52'; // Thicker bottom border for desk-like appearance
        this.controlPanel.style.overflow = 'hidden';
        this.controlPanel.style.zIndex = '900';
        document.body.appendChild(this.controlPanel);

        // Panel header with logbook look
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

        // Change label from HELM to LOGBOOK
        const systemsLabel = document.createElement('div');
        systemsLabel.textContent = 'CHAT';
        systemsLabel.style.color = '#DAA520'; // Golden text
        systemsLabel.style.fontFamily = 'serif';
        systemsLabel.style.fontWeight = 'bold';
        systemsLabel.style.fontSize = isTouchDevice() ? '11px' : '17px';
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

        // Content area
        const contentArea = document.createElement('div');
        contentArea.style.position = 'relative';
        contentArea.style.height = isTouchDevice() ? '200px' : '300px'; // Doubled height
        this.controlPanel.appendChild(contentArea);

        // Chat container (styled as a ship's logbook)
        this.chatContainer = document.createElement('div');
        this.chatContainer.className = 'chat-container';
        this.chatContainer.style.position = 'absolute';
        this.chatContainer.style.top = '0';
        this.chatContainer.style.left = '0';
        this.chatContainer.style.width = '100%';
        this.chatContainer.style.height = '100%';
        this.chatContainer.style.display = 'flex';
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
        this.messagesArea.style.fontSize = isTouchDevice() ? '8px' : '14px';
        this.messagesArea.style.fontFamily = 'serif';
        this.messagesArea.style.height = isTouchDevice() ? '140px' : '200px'; // Keep doubled height from previous request
        this.messagesArea.style.lineHeight = isTouchDevice() ? '12px' : '24px'; // Original: 10/20 -> 20% increase
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
        this.messageInput.style.fontSize = isTouchDevice() ? '8px' : '14px'; // Original: 7/12 -> 20% increase (Assuming same as messagesArea)
        this.messageInput.style.caretColor = '#3D1C00'; // Set text cursor color
        inputArea.appendChild(this.messageInput);

        // Send button (styled as a wax seal)
        this.sendButton = document.createElement('button');
        this.sendButton.textContent = isTouchDevice() ? '✓' : 'SEND';
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
        this.sendButton.style.fontSize = isTouchDevice() ? '10px' : '12px';
        this.sendButton.style.fontWeight = 'bold';
        this.sendButton.style.boxShadow = 'inset 0 0 5px rgba(0, 0, 0, 0.3)';
        this.sendButton.style.display = 'flex';
        this.sendButton.style.justifyContent = 'center';
        this.sendButton.style.alignItems = 'center';
        inputArea.appendChild(this.sendButton);

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

            // Add visual focus indicator
            this.messageInput.style.boxShadow = '0 0 5px #DAA520';
            this.messageInput.style.borderColor = '#DAA520'; // Gold border when focused
            this.messageInput.style.outline = 'none'; // Remove default browser outline
            this.messageInput.style.caretColor = '#3D1C00'; // Ensure text cursor is visible
        });

        this.messageInput.addEventListener('blur', () => {
            // Clear the global flag
            window.chatInputActive = false;

            // Remove focus indicator
            this.messageInput.style.boxShadow = 'none';
            this.messageInput.style.borderColor = '#8B4513'; // Restore original border color
        });
    }

    setupSocketEvents() {
        // Listen for new messages
        // Register callback for incoming messages
        onChatMessage((message) => {
            this.addMessage(message);
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
        messageEl.style.fontSize = isTouchDevice() ? '8px' : '14px';
        messageEl.style.lineHeight = isTouchDevice() ? '11px' : '24px';

        // Format timestamp
        let timeStr = '';
        if (typeof message === 'string') {
            // Handle simple string messages (backward compatibility)
            timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Sanitize the string message to prevent XSS
            const sanitizedMessage = this.sanitizeText(message);
            messageEl.innerHTML = `
                <span style="color: #8B4513; font-size: ${isTouchDevice() ? '7px' : '12px'}; font-style: italic;">${timeStr}</span>
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
                    // Use default if color parsing fails
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
                <span style="color: #8B4513; font-size: ${isTouchDevice() ? '7px' : '12px'}; font-style: italic;">${timeStr}</span>
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

        // Scroll to bottom if requested
        if (shouldScroll) {
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
        messageEl.style.fontSize = '13px';
        messageEl.style.fontFamily = 'serif';
        messageEl.style.textAlign = 'center';
        messageEl.textContent = `~ ${text} ~`;

        this.messagesArea.appendChild(messageEl);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
    }

    // Update layout if device detection changes
    updateLayoutForDevice() {
        // Get the current mobile state
        const isMobile = isTouchDevice();

        // Only update if the state has changed since last render
        if (this._lastMobileState !== isMobile) {
            this._lastMobileState = isMobile;

            // Update all the size-dependent properties
            this.controlPanel.style.width = isMobile ? '200px' : '300px'; // Doubled width
            this.controlPanel.style.bottom = isMobile ? '10px' : '20px';
            this.controlPanel.style.left = isMobile ? '10px' : '20px';

            // Update content area height
            const contentArea = this.controlPanel.querySelector('[style*="position: relative"]');
            if (contentArea) {
                contentArea.style.height = isMobile ? '200px' : '300px'; // Doubled height
            }

            // Update messages area
            if (this.messagesArea) {
                this.messagesArea.style.height = isMobile ? '140px' : '200px'; // Keep doubled height
                this.messagesArea.style.fontSize = isTouchDevice() ? '8px' : '14px';
                this.messagesArea.style.lineHeight = isTouchDevice() ? '12px' : '24px';
            }
        }
    }
}

// Export init function
export function initChat() {
    const chatSystem = new ChatSystem();

    // Initialize the command system and attach it to the chat system
    chatSystem.commandSystem = initCommandSystem();

    return chatSystem;
} 