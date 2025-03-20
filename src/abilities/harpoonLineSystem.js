// harpoonLineSystem.js
import * as THREE from 'three';
import { getTime, boat } from '../core/gameState.js';
import { activeHarpoons, detachHarpoon, HARPOON_CONFIG } from './harpoonDamageSystem.js';

// Configuration for harpoon line breaking
const LINE_BREAK_CONFIG = {
    MAX_DRAG_TIME: 5000,       // Time in milliseconds before line breaks (5 seconds)
    VISUAL_WARNING_TIME: 3000,  // Time when to start visual warning (3 seconds)
    LINE_TENSION_THRESHOLD: 0.90 // How close to max tether length before timer starts (0-1)
};

// Tracks how long each harpoon has been at maximum tether
const tetherTimers = new Map();

/**
 * Initialize the harpoon line system
 */
export function initHarpoonLineSystem() {
    console.log('Harpoon line break system initialized');
    // Any initialization can go here if needed
}

/**
 * Update the harpoon line break system
 * Should be called from the main game loop
 */
export function updateLineBreakSystem() {
    const currentTime = getTime();

    activeHarpoons.forEach((harpoonData, harpoonId) => {
        // Only process attached harpoons with monsters (not islands)
        if (!harpoonData.isAttached || !harpoonData.attachedMonster || harpoonData.isAttachedToIsland) {
            // Reset timer if not attached or not dragging a monster
            tetherTimers.delete(harpoonId);
            return;
        }

        const monster = harpoonData.attachedMonster;

        // Check if the monster is being dragged at max tether length
        if (isMonsterAtMaxTether(harpoonData)) {
            // Start/update the timer for this harpoon
            if (!tetherTimers.has(harpoonId)) {
                tetherTimers.set(harpoonId, {
                    startTime: currentTime,
                    wasWarned: false
                });
                console.log(`Monster at max tether - starting break timer for harpoon ${harpoonId}`);
            }

            // Get elapsed time at max tether
            const timerData = tetherTimers.get(harpoonId);
            const timeAtMaxTether = currentTime - timerData.startTime;

            // Check if we should show warning effects
            if (timeAtMaxTether >= LINE_BREAK_CONFIG.VISUAL_WARNING_TIME && !timerData.wasWarned) {
                applyWarningEffect(harpoonData);
                timerData.wasWarned = true;
            }

            // Check if line should break
            if (timeAtMaxTether >= LINE_BREAK_CONFIG.MAX_DRAG_TIME) {
                breakHarpoonLine(harpoonId, harpoonData);
            }
        } else {
            // Reset timer if monster is no longer at max tether
            if (tetherTimers.has(harpoonId)) {
                console.log(`Monster no longer at max tether - resetting break timer for harpoon ${harpoonId}`);
                tetherTimers.delete(harpoonId);

                // Reset visual effects
                resetWarningEffect(harpoonData);
            }
        }
    });

    // Cleanup timers for harpoons that no longer exist
    for (const harpoonId of tetherTimers.keys()) {
        if (!activeHarpoons.has(harpoonId)) {
            tetherTimers.delete(harpoonId);
        }
    }
}

/**
 * Check if monster is at maximum tether length
 * @param {Object} harpoonData - The harpoon data object
 * @returns {boolean} True if monster is at max tether
 */
function isMonsterAtMaxTether(harpoonData) {
    if (!harpoonData.attachedMonster || !harpoonData.attachedMonster.mesh) {
        return false;
    }

    // Get monster and tether information
    const monster = harpoonData.attachedMonster;
    const monsterPosition = monster.mesh.position;

    // Use boat position directly from gameState
    const boatPosition = boat.position;

    // Use MAX_TETHER_LENGTH directly from HARPOON_CONFIG
    const maxTetherLength = HARPOON_CONFIG.MAX_TETHER_LENGTH;

    // Calculate distance
    const toMonster = new THREE.Vector3().subVectors(monsterPosition, boatPosition);
    const distanceToMonster = toMonster.length();

    // Calculate threshold based on percentage of max length
    const threshold = maxTetherLength * LINE_BREAK_CONFIG.LINE_TENSION_THRESHOLD;

    // Log distance occasionally for debugging
    if (Math.random() < 0.01) { // Only log occasionally to reduce spam
        console.log(`Monster distance: ${distanceToMonster.toFixed(1)}/${threshold.toFixed(1)} threshold (${maxTetherLength} max)`);
    }

    // Check if monster is at or beyond the threshold percentage of max tether length
    return distanceToMonster >= threshold;
}

/**
 * Apply visual warning effect before line breaks
 * @param {Object} harpoonData - The harpoon data object
 */
function applyWarningEffect(harpoonData) {
    if (!harpoonData.harpoonLine || !harpoonData.harpoonLine.material) {
        return;
    }

    // Create a pulsing effect on the line
    const line = harpoonData.harpoonLine;

    // Store original line properties if not already stored
    if (!line.originalLineWidth) {
        line.originalLineWidth = line.material.linewidth || 1;
        line.originalColor = line.material.color.clone();
    }

    // Make line flash between bright red and white
    const flashRate = 0.2; // seconds per flash
    const t = (getTime() % (flashRate * 1000)) / (flashRate * 1000);

    if (t < 0.5) {
        // Bright red
        line.material.color.setRGB(1.0, 0.0, 0.0);
    } else {
        // White flash
        line.material.color.setRGB(1.0, 1.0, 1.0);
    }

    // Make line thicker
    if (line.material.linewidth) {
        line.material.linewidth = line.originalLineWidth * 2;
    }

    // Play audio or other warning effects could be added here

    console.log('Harpoon line warning effect applied - about to break');
}

/**
 * Reset warning visual effects
 * @param {Object} harpoonData - The harpoon data object
 */
function resetWarningEffect(harpoonData) {
    if (!harpoonData.harpoonLine || !harpoonData.harpoonLine.material) {
        return;
    }

    const line = harpoonData.harpoonLine;

    // Restore original properties if we stored them
    if (line.originalLineWidth) {
        if (line.material.linewidth) {
            line.material.linewidth = line.originalLineWidth;
        }

        if (line.originalColor) {
            line.material.color.copy(line.originalColor);
        }

        delete line.originalLineWidth;
        delete line.originalColor;
    } else {
        // Default reset if originals weren't stored
        if (line.material.linewidth) {
            line.material.linewidth = 1;
        }
        line.material.color.setRGB(1.0, 0.27, 0.27); // Default color
    }
}

/**
 * Break the harpoon line and reset monster state
 * @param {string} harpoonId - ID of the harpoon to break
 * @param {Object} harpoonData - The harpoon data object
 */
function breakHarpoonLine(harpoonId, harpoonData) {
    console.log(`=== BREAKING HARPOON LINE ${harpoonId} AFTER MAX DRAG TIME ===`);

    // Verify harpoon data is valid before proceeding
    if (!harpoonData) {
        console.error(`Cannot break line - invalid harpoon data for ${harpoonId}`);
        return;
    }

    const monster = harpoonData.attachedMonster;

    // Store monster reference before detaching
    if (monster) {
        console.log(`Breaking line for monster type: ${monster.typeId}, state: ${monster.state}`);

        // Reset monster state to ensure it's completely free
        monster.isBeingDragged = false;

        // Reset the tethered state if it was set
        if (monster.originalState && monster.state === 'tethered') {
            console.log(`Restoring monster from tethered state to original state: ${monster.originalState}`);
            monster.state = monster.originalState;
            delete monster.originalState;
        }
    } else {
        console.warn('No monster attached to harpoon when breaking line');
    }

    // Detach the harpoon - this call should reset isAttached, attachedMonster, etc.
    detachHarpoon(harpoonId);

    // Verify detachment worked
    const harpoonAfterDetach = activeHarpoons.get(harpoonId);
    if (harpoonAfterDetach && harpoonAfterDetach.isAttached) {
        console.error(`ERROR: Harpoon ${harpoonId} is still attached after detach call!`);
    } else {
        console.log(`Harpoon ${harpoonId} successfully detached`);
    }

    // Clear the timer
    tetherTimers.delete(harpoonId);

    // Play break effect
    playLineBreakEffect(harpoonData);

    // If harpoon controls has an onLineBreak handler, call it
    if (harpoonData.harpoonControls && harpoonData.harpoonControls.onLineBreak) {
        harpoonData.harpoonControls.onLineBreak();
    }

    console.log(`=== HARPOON LINE BREAK COMPLETE FOR ${harpoonId} ===`);
}

/**
 * Play visual/audio effects when line breaks
 * @param {Object} harpoonData - The harpoon data object
 */
function playLineBreakEffect(harpoonData) {
    // This could include:
    // - Particles at break point
    // - Sound effect
    // - Screen shake or flash
    // - Controller vibration

    console.log('Line break effect played');

    // Example of what could be added here:
    // if (harpoonData.attachPoint && window.particleSystem) {
    //     window.particleSystem.createParticleEmitter({
    //         position: harpoonData.attachPoint,
    //         count: 20,
    //         color: 0xFFFFFF,
    //         lifetime: 1.0
    //     });
    // }

    // Audio effects could be played here
    // if (window.audioSystem) {
    //     window.audioSystem.playSound('lineBreak', harpoonData.attachPoint);
    // }
}