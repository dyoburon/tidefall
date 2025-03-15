import * as THREE from 'three';
import { scene, camera, boat, keys } from '../core/gameState.js';
import { ShopUI } from '../ui/shopUI.js'; // Import the Shop UI

// Configuration
const SHOP_INTERACTION_DISTANCE = 50; // Reduced from 100 - Distance within which player can interact with shop
const SHOP_TEXT_VISIBILITY_DISTANCE = 150; // Reduced from 300 - Distance where shop text becomes visible
const shopPrompts = new Map(); // Map island IDs to their shop prompt objects
let canvasTextures = new Map(); // Cache for text textures
let shopUI = null; // Reference to the shop UI

// Initialize shop functionality
export function initShop(uiManager) {
    // Initialize the Shop UI
    shopUI = ShopUI.create();

    // Set up event listener for 'S' key
    document.addEventListener('keydown', handleShopKeyPress);


    return {
        update: updateShopAvailability
    };
}

// Create a text sprite that always faces the camera
function createTextSprite(text) {
    // Check if we already have this text in our cache
    if (canvasTextures.has(text)) {
        return createSpriteFromTexture(canvasTextures.get(text));
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Set canvas size - smaller overall canvas
    canvas.width = 220;
    canvas.height = 80;

    // Background with rounded corners - tighter padding around text
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    roundRect(context, 10, 10, canvas.width - 20, canvas.height - 20, 8, true);

    // Text styling
    context.font = 'bold 28px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Add glow effect
    context.shadowColor = 'rgba(255, 255, 255, 0.8)';
    context.shadowBlur = 8;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // Draw text
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);

    // Cache the texture
    canvasTextures.set(text, texture);

    return createSpriteFromTexture(texture);
}

// Create a sprite from a texture
function createSpriteFromTexture(texture) {
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false // Always draw on top of other objects
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(25, 12, 1); // Adjusted scale to maintain proportions

    return sprite;
}

// Helper function to draw rounded rectangles
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) {
        ctx.fill();
    }
    if (stroke) {
        ctx.stroke();
    }
}

// Main update function to manage shop prompts for islands
export function updateShopAvailability(activeIslands, playerPosition) {
    // Safety check
    if (!activeIslands || !playerPosition) return;

    // Keep track of active prompts to remove old ones
    const currentIslandIds = new Set();

    // Check each island and update or create prompts as needed
    activeIslands.forEach((island, islandId) => {
        currentIslandIds.add(islandId);

        if (!island || !island.collider) return;

        const islandPosition = island.collider.center.clone();
        const distance = playerPosition.distanceTo(islandPosition);

        // Only create/update prompts for islands within visibility range
        if (distance <= SHOP_TEXT_VISIBILITY_DISTANCE) {
            // Create a prompt if it doesn't exist
            if (!shopPrompts.has(islandId)) {
                const textSprite = createTextSprite('Press E to Shop');

                // Position above the island
                islandPosition.y += 15; // Adjust height above island
                textSprite.position.copy(islandPosition);

                // Add to scene and tracking
                scene.add(textSprite);
                shopPrompts.set(islandId, {
                    sprite: textSprite,
                    position: islandPosition.clone(),
                    isNear: true
                });
            }

            const prompt = shopPrompts.get(islandId);

            // Update visibility based on distance
            if (distance <= SHOP_INTERACTION_DISTANCE) {
                // Player is close enough to interact
                if (!prompt.isNear) {
                    prompt.isNear = true;
                    prompt.sprite.material.opacity = 1.0;
                    // Make it slightly larger when in interaction range
                    prompt.sprite.scale.set(28, 14, 1);
                }
            } else {
                // Player can see but not interact
                if (prompt.isNear) {
                    prompt.isNear = false;
                    prompt.sprite.scale.set(25, 12, 1);
                }

                // Fade based on distance
                const fadeStart = SHOP_INTERACTION_DISTANCE * 1.5;
                const opacity = 1 - Math.min(1, (distance - SHOP_INTERACTION_DISTANCE) /
                    (SHOP_TEXT_VISIBILITY_DISTANCE - fadeStart));
                prompt.sprite.material.opacity = Math.max(0.5, opacity);
            }

            // Billboard effect - always face camera
            prompt.sprite.position.copy(prompt.position);
        } else if (shopPrompts.has(islandId)) {
            // Remove if now too far
            const prompt = shopPrompts.get(islandId);
            scene.remove(prompt.sprite);
            shopPrompts.delete(islandId);
        }
    });

    // Clean up prompts for islands that no longer exist
    shopPrompts.forEach((prompt, islandId) => {
        if (!currentIslandIds.has(islandId)) {
            scene.remove(prompt.sprite);
            shopPrompts.delete(islandId);
        }
    });
}

// Handle 'E' key press to open the shop
function handleShopKeyPress(event) {
    if (event.key.toLowerCase() === 'e') {
        //
        // Check if player is near any shop
        let canOpenShop = false;
        let nearestIslandId = null;
        let shortestDistance = Infinity;

        shopPrompts.forEach((prompt, islandId) => {

            // print the prompt, shop prompts, and prompt.isNear
            // print the shop prompt map and its contents, cycle through the map and print the key and value
            for (const [key, value] of shopPrompts.entries()) {


            }

            if (!prompt.isNear) {
                const distance = boat.position.distanceTo(prompt.position);
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    nearestIslandId = islandId;
                    canOpenShop = true;
                }
            }
        });

        if (canOpenShop) {


            // Open the shop UI instead of just logging
            if (shopUI && !shopUI.isOpen()) {
                // Get fish data from the game state - this would connect to your actual fish inventory
                // For now we'll use the sample data already in shopUI

                // Example of how you would update with real data:
                // const playerFish = getPlayerFishInventory(); // You'd need to implement this
                // const playerMoney = getPlayerMoney(); // You'd need to implement this
                // shopUI.update(playerFish, playerMoney);

                // Open the shop UI
                shopUI.open();

                // Optionally pause other game controls while shop is open
                // pauseGameControls();
            }
        }
    }
}

// Clean up function for removing event listeners and prompts
export function cleanupShop() {
    document.removeEventListener('keydown', handleShopKeyPress);

    // Remove all prompts from scene
    shopPrompts.forEach(prompt => {
        scene.remove(prompt.sprite);
    });
    shopPrompts.clear();
    canvasTextures.clear();

    // Close shop UI if it's open
    if (shopUI && shopUI.isOpen()) {
        shopUI.close();
    }
} 