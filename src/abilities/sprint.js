import { shipSpeedConfig } from '../core/shipController.js';
import FastShipEffect from '../animations/fastShipEffect.js';
import { zoomOutForSpeed, resetZoom } from '../controls/cameraControls.js';

/**
 * Sprint - Ability that temporarily boosts the ship's movement speed
 * Activated by pressing Shift, deactivated by pressing Shift again or after duration expires
 */
class Sprint {
    constructor() {
        this.id = 'sprint';
        this.name = 'Sprint';
        this.canCancel = true;
        this.staysActiveAfterExecution = true;
        this.isActive = false;

        // Sprint configuration
        this.speedMultiplier = 25.0;
        this.originalMultiplier = 1.0;

        // Duration settings
        this.duration = 3.0;      // Active duration in seconds
        this.activeTimer = 0;     // Tracks how long sprint has been active

        // Visual effect properties
        this.effectTimer = 0;
        this.effectDuration = 0.5;

        // Fast ship effect reference (initialized on first activation)
        this.speedEffect = null;
        this.effectInitialized = false;
    }

    /**
     * Initialize visual effects (called on first activation)
     */
    initializeEffect() {
        if (this.effectInitialized) return;

        // Create the fast ship effect - now using the simplified constructor
        this.speedEffect = new FastShipEffect();
        this.effectInitialized = true;

        console.log("Fast ship effect initialized");
    }

    /**
     * Called when ability aiming starts
     */
    onAimStart(crosshair) {
        console.log('Sprint activated for ' + this.duration + ' seconds!');

        // Hide the crosshair since this ability doesn't need aiming
        crosshair.stopAiming();

        // Initialize visual effect if needed
        if (!this.effectInitialized) {
            this.initializeEffect();
        }

        // Store original multiplier to restore later
        this.originalMultiplier = shipSpeedConfig.speedMultiplier;

        // Apply speed boost
        shipSpeedConfig.speedMultiplier = this.originalMultiplier * this.speedMultiplier;

        // Set active state and reset active timer
        this.isActive = true;
        this.activeTimer = 0;

        // Reset effect timer
        this.effectTimer = this.effectDuration;

        // Activate fast ship effect
        if (this.speedEffect) {
            this.speedEffect.activate();
        }

        // Zoom camera out for dramatic speed effect
        zoomOutForSpeed();

        // Trigger visual effect if available
        if (window.showSpeedBoostEffect) {
            window.showSpeedBoostEffect(this.speedMultiplier);
        }

        return true; // Successful activation
    }

    /**
     * Called when ability is executed
     */
    onExecute(targetPosition) {
        // Sprint is activated in onAimStart
        return true;
    }

    /**
     * Called when ability is manually canceled
     */
    onCancel() {
        if (!this.isActive) return true;

        console.log('Sprint deactivated!');
        this.deactivateSprint();
        return true;
    }

    /**
     * Internal method to handle sprint deactivation
     * Called both from manual cancel and auto-timeout
     */
    deactivateSprint() {
        // Restore original speed
        shipSpeedConfig.speedMultiplier = this.originalMultiplier;

        // Set inactive state
        this.isActive = false;

        // Deactivate fast ship effect
        if (this.speedEffect) {
            this.speedEffect.deactivate();
        }

        // Reset camera zoom back to default
        resetZoom();

        console.log('Sprint ended');
    }

    /**
     * Update function called every frame
     */
    update(deltaTime) {
        // Handle active sprint duration
        if (this.isActive) {
            // Increment active timer
            this.activeTimer += deltaTime;

            // Check if sprint duration has expired
            if (this.activeTimer >= this.duration) {
                console.log('Sprint duration expired!');
                this.deactivateSprint();
            } else {
                // Update visual effect timer
                if (this.effectTimer > 0) {
                    this.effectTimer -= deltaTime;

                    // Periodic visual effect while sprinting
                    if (this.effectTimer <= 0 && window.showSpeedBoostEffect) {
                        window.showSpeedBoostEffect(this.speedMultiplier * 0.5);
                        this.effectTimer = this.effectDuration;
                    }
                }

                // Show remaining duration as console feedback
                if (Math.floor(this.activeTimer * 10) % 10 === 0) {
                    const remaining = (this.duration - this.activeTimer).toFixed(1);
                    console.log(`Sprint: ${remaining}s remaining`);
                }
            }
        }

        // Update speed effect
        if (this.speedEffect) {
            this.speedEffect.update(deltaTime);
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.speedEffect) {
            this.speedEffect.dispose();
            this.speedEffect = null;
        }
    }
}

export default Sprint; 