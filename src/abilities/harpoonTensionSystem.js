import { HARPOON_CONFIG, activeHarpoons, detachHarpoon } from './harpoonDamageSystem.js';
import { getTime, boat } from '../core/gameState.js';
import * as THREE from 'three';

// Configuration for the tension system
const TENSION_CONFIG = {
    MAX_TENSION_TIME: 5000, // 5000 milliseconds (5 seconds) at max tether length before breaking
    DEFAULT_LINE_COLOR: 0x000000 // Black as default rope color (changed from gray)
};

/**
 * Manages the tension and breaking of harpoon lines
 */
class HarpoonTensionSystem {
    constructor() {
        // Track tension time for each harpoon
        this.tensionTimes = new Map();
    }

    /**
     * Update the tension state for all active harpoons
     */
    update() {
        const currentTime = getTime();

        // Debug log to understand what's happening





        activeHarpoons.forEach((harpoonData, harpoonId) => {
            // Only check tension if attached to a monster and not reeling
            if (!harpoonData.isAttached || harpoonData.isReeling || !harpoonData.attachedMonster) {
                //this.tensionTimes.delete(harpoonId); // Make sure we clear tension when not attached
                this.resetLineColor(harpoonData);
                return;
            }

            const boatPosition = boat.position.clone();
            const monsterPosition = harpoonData.attachedMonster.mesh.position.clone();
            const distance = boatPosition.distanceTo(monsterPosition);



            // Check if at or beyond max tether length
            if (distance >= HARPOON_CONFIG.MAX_TETHER_LENGTH) {
                // Initialize or update tension time
                if (!this.tensionTimes.has(harpoonId)) {

                    this.tensionTimes.set(harpoonId, currentTime);
                    this.setWarningLineColor(harpoonData);
                    return;
                }

                const tensionStartTime = this.tensionTimes.get(harpoonId);
                const timeUnderTension = currentTime - tensionStartTime;







                // Calculate tension percentage for visual feedback
                const tensionPercentage = Math.min(100, (timeUnderTension / TENSION_CONFIG.MAX_TENSION_TIME) * 100);
                this.setLineColorByTension(harpoonData, tensionPercentage);



                // Break the line if tension exceeds max time
                if (tensionPercentage >= 1.0) {

                    this.breakLine(harpoonId);
                }
            } else {
                // Reset tension timer if not at max length
                if (this.tensionTimes.has(harpoonId)) {

                    //this.tensionTimes.delete(harpoonId);
                }
                this.resetLineColor(harpoonData);
            }
        });
    }

    /**
     * Sets warning color for the line when tension starts
     * @param {Object} harpoonData - Data for the specific harpoon
     */
    setWarningLineColor(harpoonData) {
        if (harpoonData.line && harpoonData.line.material) {
            harpoonData.line.material.color.set(0xFFAA00); // Warning orange
        }
    }

    /**
     * Break the harpoon line and notify the harpoon controls
     * @param {string} harpoonId - ID of the harpoon to break
     */
    breakLine(harpoonId) {
        const harpoonData = activeHarpoons.get(harpoonId);
        if (!harpoonData) {

            return;
        }

        // Log for debugging


        // Detach the harpoon from the monster via the damage system
        if (harpoonData.isAttached && harpoonData.attachedMonster) {
            detachHarpoon(harpoonId); // Ensure the damage system knows it's detached
        }

        // Notify HarpoonShot via the controls callback
        if (harpoonData.harpoonControls && harpoonData.harpoonControls.onLineBreak) {

            harpoonData.harpoonControls.onLineBreak();
        } else {

        }

        // Reset the monster state if it was tethered
        const monster = harpoonData.attachedMonster;
        if (monster && monster.originalState && monster.state === 'tethered') {

            monster.state = monster.originalState;
            delete monster.originalState;
            // Clear the dragging flag if it exists
            if (monster.isBeingDragged) {
                monster.isBeingDragged = false;
                cleanupDragEffects(monster); // Clean up drag effects explicitly
            }
        }

        // Clean up tension tracking
        this.tensionTimes.delete(harpoonId);

        // Update harpoonData to reflect the break
        harpoonData.isAttached = false;
        harpoonData.attachedMonster = null;
    }

    /**
     * Reset the harpoon line color to default
     * @param {Object} harpoonData - The harpoon data object
     */
    resetLineColor(harpoonData) {
        if (harpoonData.line && harpoonData.line.material) {
            harpoonData.line.material.color.set(new THREE.Color(TENSION_CONFIG.DEFAULT_LINE_COLOR));
        }
    }

    /**
     * Set the line color based on the tension percentage
     * @param {Object} harpoonData - The harpoon data object
     * @param {number} percentage - Tension percentage (0-100)
     */
    setLineColorByTension(harpoonData, percentage) {
        console.log(`[HarpoonTensionSystem] Setting line color for harpoon: ${harpoonData.id}, percentage: ${percentage}`);
        if (!harpoonData.line || !harpoonData.line.material) return;

        // Normalize percentage to 0-1 range
        let color;

        // Color transition: Black (0%) -> Orange (50%) -> Red (100%)
        if (percentage < 0.5) {
            // Black to Orange transition (0% - 50%)
            const t = percentage * 2; // Scale to 0-1 range
            // Black (0,0,0) to Orange (1,0.6,0)
            color = new THREE.Color(
                t,                // R: 0 -> 1
                t * 0.6,         // G: 0 -> 0.6
                0                // B: 0
            );
        } else {
            console.log(`[HarpoonTensionSystem] Setting line color for harpoon: ${harpoonData.id}, percentage: ${percentage}`);
            // Orange to Red transition (50% - 100%)
            const t = (percentage - 0.5) * 2; // Scale to 0-1 range
            // Orange (1,0.6,0) to Red (1,0,0)
            color = new THREE.Color(
                1,                // R: 1 -> 1 (stays at max)
                0.6 * (1 - t),   // G: 0.6 -> 0 (decreases)
                0                // B: 0 (stays at 0)
            );
        }

        harpoonData.harpoonLine.material.color.copy(color);

    }
}

// Singleton instance
const tensionSystem = new HarpoonTensionSystem();

export function updateHarpoonTension() {
    tensionSystem.update();
}

export default tensionSystem;