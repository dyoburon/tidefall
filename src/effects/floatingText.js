/**
 * Floating Text Effect System
 * 
 * This module provides functionality to create text elements that float upward
 * and fade out, typically used for damage numbers, pickups, etc.
 */

import * as THREE from 'three';
import { scene } from '../core/gameState.js';

// Font settings for the floating text
const DEFAULT_FONT_SIZE = 50.0;
const DEFAULT_DURATION = 1.0; // seconds
const DEFAULT_DISAPPEAR = true; // seconds
const DEFAULT_RISE_FACTOR = 3.0; // units per second
const DEFAULT_COLOR = 0xffffff; // white

/**
 * Create a floating text element that rises and fades out
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.text - The text to display
 * @param {THREE.Vector3} config.position - The starting position
 * @param {number} [config.color=0xffffff] - Text color (hex)
 * @param {number} [config.size=1.0] - Text size scale
 * @param {number} [config.duration=1.0] - Duration in seconds before removal
 * @param {number} [config.riseFactor=3.0] - How quickly text rises
 * @param {boolean} [config.fadeOut=true] - Whether text should fade out
 * @param {function} [config.onComplete] - Optional callback when animation completes
 * @returns {Object} The created text object and its dispose function
 */
export function createFloatingText({
    text,
    position,
    color = DEFAULT_COLOR,
    size = DEFAULT_FONT_SIZE,
    duration = DEFAULT_DURATION,
    disappear = DEFAULT_DISAPPEAR,
    riseFactor = DEFAULT_RISE_FACTOR,
    fadeOut = true,
    onComplete
}) {
    if (!scene) {
        console.error("Cannot create floating text: scene is not available");
        return null;
    }

    // Create a canvas for the text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Calculate size multiplier - used for scaling various aspects
    const sizeMultiplier = Math.max(1, size / DEFAULT_FONT_SIZE);

    // Set canvas size - adjusting based on text length and size
    const textLength = text.length;
    // Make canvas extremely large to accommodate any size text
    canvas.width = Math.max(2048, textLength * 256) * sizeMultiplier;
    canvas.height = 1024 * sizeMultiplier;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Configure text style - use a more moderate scaling for font size
    // to prevent excessive sizing while still allowing large text
    const fontSize = Math.min(canvas.height / 2, 64 * Math.pow(sizeMultiplier, 0.7));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Create a gradient or use solid color
    const hexColor = new THREE.Color(color);
    ctx.fillStyle = `rgb(${Math.floor(hexColor.r * 255)}, ${Math.floor(hexColor.g * 255)}, ${Math.floor(hexColor.b * 255)})`;

    // Add stroke/outline to make text more readable
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = Math.max(4, 6 * Math.pow(sizeMultiplier, 0.5)); // Scale stroke with size

    // Draw the text
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create material with the texture
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 1.0
    });

    // Create a sprite
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);

    // Scale the sprite based on size - adjust this to make the text
    // appear at the desired scale in the 3D world
    sprite.scale.set(size * 2, size, 1);

    // Add to scene
    scene.add(sprite);

    // Timer for animation
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);

    // Keep track of the original position
    const originalY = position.y + 10;

    // Create animation function
    const animate = () => {
        const now = Date.now();
        const elapsedTime = (now - startTime) / 1000; // seconds
        const progress = elapsedTime / duration;

        // Update position - move upward
        sprite.position.y = originalY + (elapsedTime * riseFactor);

        // Update opacity if fadeOut is enabled
        if (fadeOut) {
            // Fade starts at 50% of duration
            if (progress > 0.5) {
                const fadeProgress = (progress - 0.5) * 2; // 0 to 1 in the second half
                sprite.material.opacity = 1.0 - fadeProgress;
            }
        }

        // Check if animation is complete
        if (now < endTime) {
            requestAnimationFrame(animate);
        } else {
            if (disappear) {
                // Cleanup
                scene.remove(sprite);
                sprite.material.dispose();
                sprite.material.map.dispose();

                // Call onComplete callback if provided
                if (typeof onComplete === 'function') {
                    onComplete();
                }
            }
        }
    };

    // Start animation
    animate();

    // Return the sprite and a dispose function
    return {
        sprite,
        dispose: () => {
            scene.remove(sprite);
            sprite.material.dispose();
            sprite.material.map.dispose();
        }
    };
}

/**
 * Creates a group of floating text elements, useful for multi-line messages
 * 
 * @param {Object} config - Base configuration
 * @param {Array<string>} config.lines - Array of text lines
 * @param {number} [config.lineSpacing=0.5] - Vertical spacing between lines
 * @returns {Array} Array of created text objects
 */
export function createFloatingTextGroup({
    lines,
    position,
    lineSpacing = 0.5,
    ...config
}) {
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
        return [];
    }

    const textObjects = [];

    lines.forEach((line, index) => {
        // Calculate vertical offset for this line
        const linePosition = position.clone();
        linePosition.y += (lines.length - 1 - index) * lineSpacing;

        // Create the text
        const textObject = createFloatingText({
            ...config,
            text: line,
            position: linePosition
        });

        if (textObject) {
            textObjects.push(textObject);
        }
    });

    return textObjects;
}