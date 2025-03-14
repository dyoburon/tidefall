import AbilityCrosshair from './abilitycrosshair.js';
import CannonShot from './cannonshot.js';
import HarpoonShot from './harpoonshot.js';
import ScatterShot from './scattershot.js';

/**
 * Central manager for all game abilities
 * Handles registration, activation, and updates for all abilities
 */
class AbilityManager {
    constructor(scene, camera, player) {
        this.scene = scene;
        this.camera = camera;
        this.player = player;

        // Create the shared crosshair
        this.crosshair = new AbilityCrosshair(camera, scene);

        // Initialize ability collections
        this.abilities = new Map();  // All registered abilities
        this.keyBindings = new Map(); // Key -> ability mapping

        // Track currently active ability
        this.activeAbility = null;

        // Bind methods
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);

        // Initialize input handlers
        this.setupInputHandlers();

        // Register a test ability (THIS IS NEW)
        this.registerTestAbility();

        // Register abilities
        this.registerAbility('cannonShot', new CannonShot(), 'q');
        this.registerHarpoonShot(); // Added dedicated method for consistency
        this.registerScatterShot(); // Register the new scatter shot ability
    }

    /**
     * Set up event listeners for inputs
     */
    setupInputHandlers() {
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        document.addEventListener('mousedown', this.handleMouseDown);
    }

    /**
     * Register a new ability with the manager
     * @param {string} id - Unique identifier for the ability
     * @param {Object} ability - The ability object to register
     * @param {string} keyBinding - Key that activates this ability
     */
    registerAbility(id, ability, keyBinding) {
        // Store the ability
        this.abilities.set(id, ability);

        // Set up key binding if provided
        if (keyBinding) {
            // Store the key binding as is (preserve case)
            this.keyBindings.set(keyBinding.toLowerCase(), id);
        }

        console.log(`Ability '${id}' registered with key binding '${keyBinding}'`);

        return ability;
    }

    /**
     * Registers a test ability for demonstration purposes.
     */
    registerTestAbility() {
        const testAbility = {
            id: 'testAbility',
            name: 'Test Ability',
            canCancel: true, // Allow canceling with key release
            staysActiveAfterExecution: false, // Don't stay active

            onAimStart: (crosshair) => {
                console.log('Test Ability Aiming Started');
                // You could change crosshair appearance here if needed
            },

            onExecute: (targetPosition) => {
                console.log('Test Ability Executed at:', targetPosition);
                // This is where you'd implement the ability's effect
            },

            onCancel: () => {
                console.log('Test Ability Canceled');
            },

            update: (deltaTime) => {
                //  Any continuous updates for the ability (if needed)
            }
        };

        this.registerAbility(testAbility.id, testAbility, 'q');
    }

    /**
     * Registers the CannonShot ability.
     */
    registerCannonShot() {
        const cannonShot = new CannonShot();
        this.registerAbility(cannonShot.id, cannonShot, 'c'); // Bind to 'c' key
    }

    /**
     * Registers the HarpoonShot ability.
     */
    registerHarpoonShot() {
        const harpoonShot = new HarpoonShot();
        this.registerAbility(harpoonShot.id, harpoonShot, 'R'); // Explicitly bind to 'E' key
        console.log("Harpoon Shot registered with key binding 'R'");
    }

    /**
     * Registers the ScatterShot ability.
     */
    registerScatterShot() {
        const scatterShot = new ScatterShot();
        this.registerAbility(scatterShot.id, scatterShot, 't'); // Bind to 't' key
        console.log("Scatter Shot registered with key binding 't'");
    }

    /**
     * Get an ability by ID
     * @param {string} id - The ability ID
     * @returns {Object} The ability object or undefined
     */
    getAbility(id) {
        return this.abilities.get(id);
    }

    /**
     * Handle keydown events
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleKeyDown(event) {
        // Skip if chat or any text input is focused
        if (window.chatInputActive ||
            (document.activeElement &&
                (document.activeElement.tagName === 'INPUT' ||
                    document.activeElement.tagName === 'TEXTAREA' ||
                    document.activeElement.isContentEditable))) {
            return;
        }

        const key = event.key.toLowerCase();
        console.log(`Key pressed: '${event.key}', looking up as '${key}'`); // Debug log

        // Check if this key is bound to an ability
        if (this.keyBindings.has(key)) {
            const abilityId = this.keyBindings.get(key);
            const ability = this.abilities.get(abilityId);

            console.log(`Key '${key}' is bound to ability '${abilityId}'`); // Debug log

            if (ability) {
                // Check if this ability is already active - if so, cancel it (toggle behavior)
                if (this.activeAbility && this.activeAbility.id === ability.id) {
                    console.log(`${abilityId} is already active - cancelling (toggle off)`);
                    this.cancelActiveAbility();
                    return;
                }

                // If another ability is active, cancel it first
                if (this.activeAbility) {
                    console.log(`Cancelling active ability ${this.activeAbility.id} before activating ${abilityId}`);
                    this.cancelActiveAbility();
                }

                // Start aiming with this ability (toggle on)
                this.startAbilityAiming(ability);
            }
        } else {
            console.log(`Key '${key}' is not bound to any ability`); // Debug log
        }
    }

    /**
     * Handle keyup events
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleKeyUp(event) {
        // With toggle mode, we don't need to cancel on key up
        // This function is kept for future expansion or alternative modes
    }

    /**
     * Handle mouse click events
     * @param {MouseEvent} event - The mouse event
     */
    handleMouseDown(event) {
        // Skip if no active ability
        if (!this.activeAbility) return;

        // If left mouse button clicked and we're aiming
        if (event.button === 0 && this.crosshair.isActive) {
            // Get target position
            const targetPosition = this.crosshair.getTargetPosition();

            // Execute the ability
            this.executeActiveAbility(targetPosition);
        }
    }

    /**
     * Start the aiming process for an ability
     * @param {Object} ability - The ability to activate
     */
    startAbilityAiming(ability) {
        console.log(`Starting ability aiming for: ${ability.id}`);

        // Set as active ability
        this.activeAbility = ability;

        // Start aiming with crosshair
        this.crosshair.startAiming();

        // Call ability's onAimStart if available
        if (ability.onAimStart) {
            ability.onAimStart(this.crosshair);
        }
    }

    /**
     * Cancel the currently active ability
     */
    cancelActiveAbility() {
        if (!this.activeAbility) return;

        console.log(`Cancelling ability: ${this.activeAbility.id}`);

        // Call ability's onCancel if available
        if (this.activeAbility.onCancel) {
            this.activeAbility.onCancel();
        }

        // Stop crosshair aiming
        this.crosshair.stopAiming();

        // Clear active ability
        this.activeAbility = null;
    }

    /**
     * Execute the currently active ability
     * @param {THREE.Vector3} targetPosition - World position to target
     */
    executeActiveAbility(targetPosition) {
        if (!this.activeAbility) return;

        console.log(`Executing ability: ${this.activeAbility.id}`);

        // Call ability's onExecute function
        if (this.activeAbility.onExecute) {
            this.activeAbility.onExecute(targetPosition);
        }

        // Stop aiming
        this.crosshair.stopAiming();

        // Clear active ability if it doesn't stay active
        if (!this.activeAbility.staysActiveAfterExecution) {
            this.activeAbility = null;
        }
    }

    /**
     * Main update function called from game loop
     * @param {number} deltaTime - Time elapsed since last frame
     */
    update(deltaTime) {
        // Update crosshair
        this.crosshair.update();

        // Update active ability if present
        if (this.activeAbility && this.activeAbility.update) {
            this.activeAbility.update(deltaTime);
        }

        // Update all abilities that need continuous updates
        this.abilities.forEach(ability => {
            if (ability.alwaysUpdate && ability.update && ability !== this.activeAbility) {
                ability.update(deltaTime);
            }
        });

        // Check if testAbility is active and log a message
        if (this.isAbilityActive('testAbility')) {
            console.log("Test Ability is currently active!");
        }
    }

    /**
     * Clean up event listeners
     */
    dispose() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('mousedown', this.handleMouseDown);
    }

    /**
     * Check if a specific ability is currently active.
     * @param {string} abilityId - The ID of the ability to check.
     * @returns {boolean} True if the ability is active, false otherwise.
     */
    isAbilityActive(abilityId) {
        return this.activeAbility !== null && this.activeAbility.id === abilityId;
    }
}

export default AbilityManager; 