// Abilities Bar UI component for the game
// Displays a row of ability icons with key bindings at the bottom of the screen - nautical theme
import { isTouchDevice } from '../controls/touchControls.js';

class AbilitiesBar {
    constructor() {
        // Access the global AbilityManager instance
        this.abilityManager = window.abilityManager;

        // Determine if we're on a mobile device
        this.isMobile = isTouchDevice();

        // Main container for the abilities bar
        this.container = document.createElement('div');
        this.container.id = 'abilities-bar';
        this.container.style.position = 'absolute';
        this.container.style.bottom = this.isMobile ? '10px' : '20px';
        this.container.style.left = '50%';
        this.container.style.transform = 'translateX(-50%)';
        this.container.style.width = this.isMobile ? '468px' : '715px'; // Increased by 30% (was 360px/550px)
        this.container.style.height = this.isMobile ? '68px' : '104px'; // Increased by 30% (was 52px/80px)
        this.container.style.backgroundColor = 'rgba(30, 25, 20, 0.9)'; // Darker brown background
        this.container.style.borderRadius = this.isMobile ? '5px' : '8px';
        this.container.style.border = this.isMobile ? '1px solid #8B4513' : '2px solid #8B4513'; // Thinner border on mobile
        this.container.style.boxShadow = this.isMobile ?
            '0 0 10px rgba(0, 0, 0, 0.7), inset 0 0 6px rgba(100, 70, 30, 0.3)' :
            '0 0 15px rgba(0, 0, 0, 0.7), inset 0 0 10px rgba(100, 70, 30, 0.3)';
        this.container.style.display = 'flex';
        this.container.style.justifyContent = 'space-evenly';
        this.container.style.alignItems = 'center';
        this.container.style.padding = this.isMobile ? '3px 6px' : '5px 10px';
        this.container.style.zIndex = '10';

        // Add wood grain texture to the bar
        this.container.style.backgroundImage = 'linear-gradient(to bottom, rgba(60, 40, 20, 0.9), rgba(40, 25, 15, 0.9))';

        // Define key bindings (added Shift at the beginning)
        this.keyBindings = ['SHIFT', 'Q', 'R', 'T', '1', '2', '3', '4'];

        // Fantasy ability names (now 8 abilities with Sprint at the beginning)
        this.abilityNames = [
            'Sprint', 'Cannonshot', 'Harpoon', 'Scattershot',
            'Arcane Shield', 'Poison Cloud', 'Windslash', 'Waterspout'
        ];

        // Create ability slots (8 instead of 7)
        this.abilitySlots = [];

        for (let i = 0; i < 8; i++) {
            this.abilitySlots.push(this.createAbilitySlot(i));
        }

        // Add to document
        document.body.appendChild(this.container);

        // Add resize and orientation change listeners to update the UI if needed
        window.addEventListener('resize', this.updateLayoutForDevice.bind(this));
        window.addEventListener('orientationchange', this.updateLayoutForDevice.bind(this));
    }

    createAbilitySlot(index) {
        // Create the slot container
        const slot = document.createElement('div');
        slot.className = 'ability-slot';
        slot.style.width = this.isMobile ? '51px' : '78px'; // Increased by 30% (was 39px/60px)
        slot.style.height = this.isMobile ? '51px' : '78px'; // Increased by 30% (was 39px/60px)
        slot.style.position = 'relative';
        slot.style.display = 'flex';
        slot.style.justifyContent = 'center';
        slot.style.alignItems = 'center';
        slot.style.borderRadius = this.isMobile ? '4px' : '6px';
        slot.style.backgroundColor = 'rgba(50, 40, 30, 0.7)';
        slot.style.border = this.isMobile ? '0.5px solid #B8860B' : '1px solid #B8860B';
        slot.style.boxShadow = this.isMobile ?
            'inset 0 0 5px rgba(20, 15, 10, 0.8)' :
            'inset 0 0 8px rgba(20, 15, 10, 0.8)';
        slot.style.transition = 'all 0.2s ease';
        slot.style.cursor = 'pointer';
        slot.style.touchAction = 'none'; // Prevent default touch actions

        // Add subtle wood grain to slots
        slot.style.backgroundImage = 'linear-gradient(to bottom, rgba(70, 50, 30, 0.5), rgba(40, 30, 20, 0.5))';

        // Element for the ability icon
        const iconPlaceholder = document.createElement('div');
        iconPlaceholder.className = 'ability-icon';
        iconPlaceholder.style.width = this.isMobile ? '39px' : '60px'; // Increased by 30% (was 30px/46px)
        iconPlaceholder.style.height = this.isMobile ? '39px' : '60px'; // Increased by 30% (was 30px/46px)
        iconPlaceholder.style.borderRadius = this.isMobile ? '3px' : '5px';
        iconPlaceholder.style.backgroundSize = 'cover';
        iconPlaceholder.style.backgroundPosition = 'center';
        iconPlaceholder.style.boxShadow = this.isMobile ?
            'inset 0 0 3px rgba(255, 215, 0, 0.2)' :
            'inset 0 0 5px rgba(255, 215, 0, 0.2)';

        // Add parchment-like texture to icon backgrounds
        iconPlaceholder.style.backgroundImage = 'radial-gradient(circle at center, rgba(225, 205, 170, 0.1) 0%, rgba(200, 180, 150, 0.1) 100%)';

        // Set image based on ability key
        if (this.keyBindings[index] === 'SHIFT') {
            iconPlaceholder.style.backgroundImage = 'url("./sprintability.jpeg")';
        } else if (this.keyBindings[index] === 'Q') {
            iconPlaceholder.style.backgroundImage = 'url("./cannonshotability.jpeg")';
        } else if (this.keyBindings[index] === 'R') {
            iconPlaceholder.style.backgroundImage = 'url("./harpoonshotability.jpeg")';
        } else if (this.keyBindings[index] === 'T') {
            iconPlaceholder.style.backgroundImage = 'url("./scattershotability.jpeg")';
        }

        // Create key binding label with nautical styling
        const keyLabel = document.createElement('div');
        keyLabel.className = 'key-binding';
        keyLabel.textContent = this.keyBindings[index];
        keyLabel.style.position = 'absolute';
        keyLabel.style.bottom = this.isMobile ? '-7px' : '-10px';
        keyLabel.style.left = '50%';
        keyLabel.style.transform = 'translateX(-50%)';
        keyLabel.style.backgroundColor = 'rgba(30, 20, 10, 0.9)'; // Very dark brown
        keyLabel.style.color = '#E6C68A'; // Parchment color
        keyLabel.style.padding = this.isMobile ? '1px 4px' : '2px 6px';
        keyLabel.style.borderRadius = this.isMobile ? '3px' : '4px';
        keyLabel.style.fontSize = this.isMobile ? '7px' : '10px'; // Larger on mobile (was 6px)
        keyLabel.style.fontWeight = 'bold';
        keyLabel.style.fontFamily = 'serif'; // More nautical-looking font
        keyLabel.style.boxShadow = this.isMobile ?
            '0 0 3px rgba(0, 0, 0, 0.5)' :
            '0 0 4px rgba(0, 0, 0, 0.5)';
        keyLabel.style.border = this.isMobile ?
            '0.5px solid #B8860B' :
            '1px solid #B8860B'; // Dark goldenrod border

        // Hide key labels completely on touch devices
        if (this.isMobile) {
            keyLabel.style.display = 'none';
        }

        // Make SHIFT key text smaller to fit
        if (this.keyBindings[index] === 'SHIFT') {
            keyLabel.style.fontSize = this.isMobile ? '6px' : '9px'; // Larger on mobile (was 5px)
        }

        // Cooldown overlay (hidden by default) - nautical styled
        const cooldownOverlay = document.createElement('div');
        cooldownOverlay.className = 'cooldown-overlay';
        cooldownOverlay.style.position = 'absolute';
        cooldownOverlay.style.top = '0';
        cooldownOverlay.style.left = '0';
        cooldownOverlay.style.width = '100%';
        cooldownOverlay.style.height = '100%';
        cooldownOverlay.style.borderRadius = this.isMobile ? '3px' : '5px';
        cooldownOverlay.style.backgroundColor = 'rgba(20, 15, 10, 0.7)'; // Dark brown overlay
        cooldownOverlay.style.display = 'none';
        cooldownOverlay.style.justifyContent = 'center';
        cooldownOverlay.style.alignItems = 'center';
        cooldownOverlay.style.color = '#DAA520'; // Golden text
        cooldownOverlay.style.fontWeight = 'bold';
        cooldownOverlay.style.fontSize = this.isMobile ? '12px' : '18px'; // Larger on mobile (was 9px)
        cooldownOverlay.style.fontFamily = 'serif';

        // Tooltip for ability name
        slot.title = this.abilityNames[index];

        // Update event listeners for better touch handling
        if (this.isMobile) {
            // Touch-specific event handlers
            slot.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Prevent default to avoid double-firing
                slot.style.transform = 'scale(0.95)';
                this.activateAbility(index);
            }, { passive: false });

            slot.addEventListener('touchend', (e) => {
                e.preventDefault();
                slot.style.transform = 'scale(1)';
            }, { passive: false });
        } else {
            // Keep existing mouse event handlers for desktop
            slot.addEventListener('mouseover', () => {
                slot.style.boxShadow = 'inset 0 0 12px rgba(218, 165, 32, 0.5)';
                slot.style.transform = 'scale(1.05)';
            });

            slot.addEventListener('mouseout', () => {
                slot.style.boxShadow = 'inset 0 0 8px rgba(20, 15, 10, 0.8)';
                slot.style.transform = 'scale(1)';
            });

            slot.addEventListener('mousedown', () => {
                slot.style.transform = 'scale(0.95)';
            });

            slot.addEventListener('mouseup', () => {
                slot.style.transform = 'scale(1.05)';
            });

            slot.addEventListener('click', () => {
                this.activateAbility(index);
            });
        }

        // Assemble the slot components
        slot.appendChild(iconPlaceholder);
        slot.appendChild(keyLabel);
        slot.appendChild(cooldownOverlay);
        this.container.appendChild(slot);

        return {
            container: slot,
            icon: iconPlaceholder,
            keyLabel: keyLabel,
            cooldown: cooldownOverlay
        };
    }

    // Method to activate an ability
    activateAbility(index) {
        // Get the key binding for this ability slot
        const keyBinding = this.keyBindings[index].toLowerCase();

        console.log(`Clicked ability: ${this.abilityNames[index]} (${keyBinding})`);

        // Flash the ability slot to give feedback - using gold highlight for nautical theme
        const slot = this.abilitySlots[index].container;
        slot.style.boxShadow = this.isMobile ?
            'inset 0 0 10px rgba(218, 165, 32, 0.8)' :
            'inset 0 0 15px rgba(218, 165, 32, 0.8)'; // Golden flash

        // Reset after animation
        setTimeout(() => {
            slot.style.boxShadow = this.isMobile ?
                'inset 0 0 5px rgba(20, 15, 10, 0.8)' :
                'inset 0 0 8px rgba(20, 15, 10, 0.8)';
        }, 200);

        // Get the ability manager from the window

        this.abilityManager = window.abilityManager;
        console.log('i am here');

        // If we have an ability manager, call its activateAbilityByKey method
        if (this.abilityManager) {
            console.log('Ability manager found');

            // Call the method directly with the key binding
            this.abilityManager.activateAbilityByKey(keyBinding);
        }
    }

    // Method to start a cooldown on an ability
    startCooldown(index, durationSeconds) {
        const cooldownOverlay = this.abilitySlots[index].cooldown;
        const slot = this.abilitySlots[index].container;

        // Display the cooldown
        cooldownOverlay.style.display = 'flex';
        cooldownOverlay.textContent = durationSeconds;

        // Disable the slot
        slot.style.cursor = 'default';
        slot.style.filter = 'grayscale(80%)';

        // Start the countdown
        let timeLeft = durationSeconds;
        const countdownInterval = setInterval(() => {
            timeLeft -= 1;
            cooldownOverlay.textContent = timeLeft;

            if (timeLeft <= 0) {
                // End the cooldown
                clearInterval(countdownInterval);
                cooldownOverlay.style.display = 'none';
                slot.style.cursor = 'pointer';
                slot.style.filter = 'none';
            }
        }, 1000);
    }

    // Method to set an ability icon
    setAbilityIcon(index, iconUrl) {
        const icon = this.abilitySlots[index].icon;
        icon.style.backgroundImage = `url(${iconUrl})`;
    }

    // Check for key presses to activate abilities
    enableKeyboardShortcuts() {
        /*
        document.addEventListener('keydown', (event) => {
            // Handle the Shift key separately
            if (event.key === 'Shift') {
                this.activateAbility(0); // Sprint is at index 0
                return;
            }

            const key = event.key.toUpperCase();
            const index = this.keyBindings.indexOf(key);

            if (index !== -1) {
                this.activateAbility(index);
            }
        });*/
    }

    // New method to update layout if device detection changes
    updateLayoutForDevice() {
        // Get the current mobile state
        const isMobile = isTouchDevice();

        // Only update if the state has changed since last render
        if (this.isMobile !== isMobile) {
            this.isMobile = isMobile;

            // Update container
            this.container.style.bottom = isMobile ? '10px' : '20px';
            this.container.style.width = isMobile ? '468px' : '715px'; // Increased by 30% (was 360px/550px)
            this.container.style.height = isMobile ? '68px' : '104px'; // Increased by 30% (was 52px/80px)
            this.container.style.borderRadius = isMobile ? '5px' : '8px';
            this.container.style.border = isMobile ? '1px solid #8B4513' : '2px solid #8B4513';
            this.container.style.boxShadow = isMobile ?
                '0 0 10px rgba(0, 0, 0, 0.7), inset 0 0 6px rgba(100, 70, 30, 0.3)' :
                '0 0 15px rgba(0, 0, 0, 0.7), inset 0 0 10px rgba(100, 70, 30, 0.3)';
            this.container.style.padding = isMobile ? '3px 6px' : '5px 10px';

            // Update each ability slot
            this.abilitySlots.forEach(slot => {
                // Update container
                slot.container.style.width = isMobile ? '51px' : '78px'; // Increased by 30% (was 39px/60px)
                slot.container.style.height = isMobile ? '51px' : '78px'; // Increased by 30% (was 39px/60px)
                slot.container.style.borderRadius = isMobile ? '4px' : '6px';
                slot.container.style.border = isMobile ? '0.5px solid #B8860B' : '1px solid #B8860B';
                slot.container.style.boxShadow = isMobile ?
                    'inset 0 0 5px rgba(20, 15, 10, 0.8)' :
                    'inset 0 0 8px rgba(20, 15, 10, 0.8)';

                // Update icon
                slot.icon.style.width = isMobile ? '39px' : '60px'; // Increased by 30% (was 30px/46px)
                slot.icon.style.height = isMobile ? '39px' : '60px'; // Increased by 30% (was 30px/46px)
                slot.icon.style.borderRadius = isMobile ? '3px' : '5px';
                slot.icon.style.boxShadow = isMobile ?
                    'inset 0 0 3px rgba(255, 215, 0, 0.2)' :
                    'inset 0 0 5px rgba(255, 215, 0, 0.2)';

                // Update key label
                slot.keyLabel.style.bottom = isMobile ? '-7px' : '-10px';
                slot.keyLabel.style.padding = isMobile ? '1px 4px' : '2px 6px';
                slot.keyLabel.style.borderRadius = isMobile ? '3px' : '4px';
                slot.keyLabel.style.fontSize = isMobile ? '7px' : '10px';
                slot.keyLabel.style.boxShadow = isMobile ?
                    '0 0 3px rgba(0, 0, 0, 0.5)' :
                    '0 0 4px rgba(0, 0, 0, 0.5)';
                slot.keyLabel.style.border = isMobile ?
                    '0.5px solid #B8860B' :
                    '1px solid #B8860B';

                // Special case for SHIFT key
                if (slot.keyLabel.textContent === 'SHIFT') {
                    slot.keyLabel.style.fontSize = isMobile ? '6px' : '9px';
                }

                // Update cooldown overlay
                slot.cooldown.style.borderRadius = isMobile ? '3px' : '5px';
                slot.cooldown.style.fontSize = isMobile ? '12px' : '18px';
            });
        }
    }
}

// Helper function to check if an image exists
function imageExists(url) {
    const img = new Image();
    img.src = url;
    return img.height !== 0;
}

// Export the class
export default AbilitiesBar;
