/**
 * HugeFloatingText Effect System
 * 
 * Enhanced version of FloatingText that specializes in rendering massive,
 * visually striking text elements in the 3D space.
 */

import * as THREE from 'three';
import { scene } from '../core/gameState.js';

// Base settings for huge floating text
const DEFAULT_FONT_SIZE = 128; // Base font size for canvas
const DEFAULT_DURATION = 2.0;
const DEFAULT_COLOR = 0xffffff;

/**
 * Create a massive floating text element with enhanced visual presence
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.text - The text to display
 * @param {THREE.Vector3} config.position - The starting position
 * @param {number} [config.color=0xffffff] - Text color (hex)
 * @param {number} [config.size=1000] - Text size scale
 * @param {number} [config.duration=2.0] - Duration in seconds before removal
 * @param {number} [config.riseFactor=1.5] - How quickly text rises
 * @param {boolean} [config.fadeOut=true] - Whether text should fade out
 * @param {boolean} [config.glow=true] - Whether to add a glow effect
 * @param {function} [config.onComplete] - Optional callback when animation completes
 * @returns {Object} The created text object and its dispose function
 */
export function createHugeFloatingText({
    text,
    position,
    color = DEFAULT_COLOR,
    size = 1000,
    duration = DEFAULT_DURATION,
    disappear = true,
    riseFactor = 1.5,
    fadeOut = true,
    glow = true,
    onComplete
}) {
    if (!scene) {
        console.error("Cannot create huge floating text: scene is not available");
        return null;
    }

    // Create canvas with fixed dimensions for consistent text rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set fixed canvas size - large enough for high quality text
    canvas.width = 1024;
    canvas.height = 512;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Configure text style
    ctx.font = `bold ${DEFAULT_FONT_SIZE}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Set up colors
    const hexColor = new THREE.Color(color);
    ctx.fillStyle = `rgb(${Math.floor(hexColor.r * 255)}, ${Math.floor(hexColor.g * 255)}, ${Math.floor(hexColor.b * 255)})`;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 16;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Draw glow effect
    if (glow) {
        ctx.shadowColor = `rgba(${Math.floor(hexColor.r * 255)}, ${Math.floor(hexColor.g * 255)}, ${Math.floor(hexColor.b * 255)}, 0.5)`;
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    // Draw text multiple times for stronger appearance
    for (let i = 0; i < 3; i++) {
        ctx.strokeText(text, centerX, centerY);
        ctx.fillText(text, centerX, centerY);
    }

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Create material
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 1.0,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: true // This is key for proper scaling
    });

    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);

    // Apply world-space scaling
    const worldScale = size;
    sprite.scale.set(worldScale, worldScale / 2, 1);

    // Add to scene
    scene.add(sprite);

    // Animation timing
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);

    // Keep track of original position
    const originalY = position.y;

    // Animation function
    function animate() {
        const now = Date.now();
        const elapsedTime = (now - startTime) / 1000;
        const progress = elapsedTime / duration;

        // Update position
        if (riseFactor > 0) {
            sprite.position.y = originalY + (elapsedTime * riseFactor);
        }

        // Update opacity
        if (fadeOut && progress > 0.5) {
            const fadeProgress = (progress - 0.5) * 2;
            sprite.material.opacity = 1.0 - fadeProgress;
        }

        // Continue animation or cleanup
        if (now < endTime) {
            requestAnimationFrame(animate);
        } else if (disappear) {
            scene.remove(sprite);
            sprite.material.dispose();
            sprite.material.map.dispose();
            if (onComplete) onComplete();
        }
    }

    // Start animation
    if (duration > 0) {
        animate();
    }

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
 * Creates a group of huge floating text elements
 * 
 * @param {Object} config - Base configuration
 * @param {Array<string>} config.lines - Array of text lines
 * @param {number} [config.lineSpacing=1.0] - Vertical spacing between lines
 * @returns {Array} Array of created text objects
 */
export function createHugeFloatingTextGroup({
    lines,
    position,
    lineSpacing = 1.0,
    ...config
}) {
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
        return [];
    }

    const textObjects = [];

    lines.forEach((line, index) => {
        const linePosition = position.clone();
        linePosition.y += (lines.length - 1 - index) * lineSpacing * DEFAULT_FONT_SIZE;

        const textObject = createHugeFloatingText({
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