// Abilities Bar UI component for the game
// Displays a row of ability icons with key bindings at the bottom of the screen - nautical theme

class AbilitiesBar {
    constructor() {
        // Main container for the abilities bar
        this.container = document.createElement('div');
        this.container.id = 'abilities-bar';
        this.container.style.position = 'absolute';
        this.container.style.bottom = '20px';
        this.container.style.left = '50%';
        this.container.style.transform = 'translateX(-50%)';
        this.container.style.width = '550px'; // Increased width to accommodate 8 abilities
        this.container.style.height = '80px';
        this.container.style.backgroundColor = 'rgba(30, 25, 20, 0.9)'; // Darker brown background
        this.container.style.borderRadius = '8px';
        this.container.style.border = '2px solid #8B4513'; // Saddle brown border
        this.container.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.7), inset 0 0 10px rgba(100, 70, 30, 0.3)'; // Brown inner glow
        this.container.style.display = 'flex';
        this.container.style.justifyContent = 'space-evenly';
        this.container.style.alignItems = 'center';
        this.container.style.padding = '5px 10px';
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
    }

    createAbilitySlot(index) {
        // Create the slot container
        const slot = document.createElement('div');
        slot.className = 'ability-slot';
        slot.style.width = '60px';
        slot.style.height = '60px';
        slot.style.position = 'relative';
        slot.style.display = 'flex';
        slot.style.justifyContent = 'center';
        slot.style.alignItems = 'center';
        slot.style.borderRadius = '6px';
        slot.style.backgroundColor = 'rgba(50, 40, 30, 0.7)'; // Dark wood
        slot.style.border = '1px solid #B8860B'; // Dark goldenrod border
        slot.style.boxShadow = 'inset 0 0 8px rgba(20, 15, 10, 0.8)';
        slot.style.transition = 'all 0.2s ease';
        slot.style.cursor = 'pointer';

        // Add subtle wood grain to slots
        slot.style.backgroundImage = 'linear-gradient(to bottom, rgba(70, 50, 30, 0.5), rgba(40, 30, 20, 0.5))';

        // Element for the ability icon
        const iconPlaceholder = document.createElement('div');
        iconPlaceholder.className = 'ability-icon';
        iconPlaceholder.style.width = '46px';
        iconPlaceholder.style.height = '46px';
        iconPlaceholder.style.borderRadius = '5px';
        iconPlaceholder.style.backgroundSize = 'cover';
        iconPlaceholder.style.backgroundPosition = 'center';
        iconPlaceholder.style.boxShadow = 'inset 0 0 5px rgba(255, 215, 0, 0.2)'; // Golden inner glow

        // Add parchment-like texture to icon backgrounds
        iconPlaceholder.style.backgroundImage = 'radial-gradient(circle at center, rgba(225, 205, 170, 0.1) 0%, rgba(200, 180, 150, 0.1) 100%)';

        // Set image based on ability key
        if (this.keyBindings[index] === 'SHIFT') {
            iconPlaceholder.style.backgroundImage = 'url("./sprintability.jpeg")';
            // If image doesn't exist yet, create a Sprint icon with CSS
            /*
            if (!imageExists('./sprintability.jpeg')) {
                iconPlaceholder.style.backgroundImage = 'none';
                iconPlaceholder.style.backgroundColor = 'rgba(70, 130, 180, 0.3)'; // Steel blue for sprint
                const speedIcon = document.createElement('div');
                speedIcon.innerHTML = '⚡'; // Lightning bolt for speed
                speedIcon.style.fontSize = '28px';
                speedIcon.style.color = '#FFD700'; // Gold color
                speedIcon.style.textShadow = '0 0 5px rgba(255, 215, 0, 0.7)';
                iconPlaceholder.appendChild(speedIcon);
            }*/
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
        keyLabel.style.bottom = '-10px';
        keyLabel.style.left = '50%';
        keyLabel.style.transform = 'translateX(-50%)';
        keyLabel.style.backgroundColor = 'rgba(30, 20, 10, 0.9)'; // Very dark brown
        keyLabel.style.color = '#E6C68A'; // Parchment color
        keyLabel.style.padding = '2px 6px';
        keyLabel.style.borderRadius = '4px';
        keyLabel.style.fontSize = '10px'; // Slightly smaller for "SHIFT"
        keyLabel.style.fontWeight = 'bold';
        keyLabel.style.fontFamily = 'serif'; // More nautical-looking font
        keyLabel.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.5)';
        keyLabel.style.border = '1px solid #B8860B'; // Dark goldenrod border

        // Make SHIFT key text smaller to fit
        if (this.keyBindings[index] === 'SHIFT') {
            keyLabel.style.fontSize = '9px';
        }

        // Cooldown overlay (hidden by default) - nautical styled
        const cooldownOverlay = document.createElement('div');
        cooldownOverlay.className = 'cooldown-overlay';
        cooldownOverlay.style.position = 'absolute';
        cooldownOverlay.style.top = '0';
        cooldownOverlay.style.left = '0';
        cooldownOverlay.style.width = '100%';
        cooldownOverlay.style.height = '100%';
        cooldownOverlay.style.borderRadius = '5px';
        cooldownOverlay.style.backgroundColor = 'rgba(20, 15, 10, 0.7)'; // Dark brown overlay
        cooldownOverlay.style.display = 'none';
        cooldownOverlay.style.justifyContent = 'center';
        cooldownOverlay.style.alignItems = 'center';
        cooldownOverlay.style.color = '#DAA520'; // Golden text
        cooldownOverlay.style.fontWeight = 'bold';
        cooldownOverlay.style.fontSize = '18px';
        cooldownOverlay.style.fontFamily = 'serif';

        // Tooltip for ability name
        slot.title = this.abilityNames[index];

        // Interactive effects with nautical highlights
        slot.addEventListener('mouseover', () => {
            slot.style.boxShadow = 'inset 0 0 12px rgba(218, 165, 32, 0.5)'; // Golden glow
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
        // Example implementation
        console.log(`Activated ability: ${this.abilityNames[index]}`);

        // Flash the ability slot to give feedback - using gold highlight for nautical theme
        const slot = this.abilitySlots[index].container;
        slot.style.boxShadow = 'inset 0 0 15px rgba(218, 165, 32, 0.8)'; // Golden flash

        // Reset after animation
        setTimeout(() => {
            slot.style.boxShadow = 'inset 0 0 8px rgba(20, 15, 10, 0.8)';
        }, 200);

        // Here you would trigger the actual ability in the game
        // For example: gameEngine.castAbility(index);
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
        });
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