import * as THREE from 'three';
import { scene } from '../core/gameState.js';
import { getAllMonsters } from '../entities/monsterManager.js';

// Import the death effect from cannons.js (since it's defined there)
import { createMonsterDeathEffect } from '../gameplay/cannons.js';
import { onMonsterKilled } from '../core/network.js';

/**
 * KillAll command implementation - kills all sea monsters on the server
 * @param {Array<string>} args - Command arguments
 * @param {object} chatSystem - Reference to the chat system
 */
export function killallCommand(args, chatSystem) {
    // Get reference to monsters array
    const monsters = getAllMonsters();

    // Check if there are any monsters
    if (!monsters || monsters.length === 0) {
        chatSystem.addSystemMessage("🦑 No sea monsters found to kill.");
        return;
    }

    const monsterCount = monsters.length;

    // Loop through each monster and set it to the dying state
    monsters.forEach(monster => {
        // Only process monsters that aren't already dying
        if (monster.state !== 'dying') {
            // Create treasure drop before monster disappears

            // Set monster to dying state
            monster.state = 'dying';
            monster.stateTimer = 3; // Time for death animation
            monster.velocity.y = -0.2; // Start sinking

            // Create a death effect
            createMonsterDeathEffect(monster.mesh.position);

            // Update kill count in network
            onMonsterKilled(1);

            // Schedule removal after animation
            setTimeout(() => {
                if (monster.mesh && monster.mesh.parent) {
                    scene.remove(monster.mesh);

                    // Monster will be removed from the array during the next update cycle
                    // No need to manually splice here as that could cause issues during iteration
                }
            }, 3000);
        }
    });

    // Play a dramatic sound effect for mass monster elimination
    playMassMonsterDeathSound();

    chatSystem.addSystemMessage(`🔱 Eliminated ${monsterCount} sea ${monsterCount === 1 ? 'monster' : 'monsters'} from the world.`);
}

// Export all monster commands
export const monsterCommands = [
    {
        name: 'killall',
        handler: killallCommand,
        description: 'Kill all sea monsters in the world'
    }
    // Add more monster-related commands here in the future
];

// We'll create our own function for multiple monster deaths
function playMassMonsterDeathSound() {
    // Play a more dramatic version of the monster death sound
    // This would be a placeholder for an actual sound effect
    console.log("Mass monster death sound played");
} 