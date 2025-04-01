import * as THREE from 'three';
import { scene } from '../core/gameState.js';

/**
 * Creates a cloud of particles around a large portal
 */
export function createPortalParticles({
    position,
    color = 0x00ff66,
    portalScale = 50 // Default portal scale
}) {
    // Calculate volumes based on portal scale
    const radius = portalScale * 2;  // Wide area around portal
    const height = portalScale * 3;  // Tall area for particles
    const depth = portalScale * 2;   // Deep volume for particles

    // Create sprite texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Draw a bright, soft circle
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const group = new THREE.Group();
    const particles = [];
    const particleCount = 100; // Many more particles for the large volume

    // Create particles
    for (let i = 0; i < particleCount; i++) {
        const material = new THREE.SpriteMaterial({
            map: texture,
            color: color,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const sprite = new THREE.Sprite(material);

        // Random position within the volume
        sprite.position.x = (Math.random() - 0.5) * radius;
        sprite.position.y = (Math.random() - 0.5) * height;
        sprite.position.z = (Math.random() - 0.5) * depth;

        // Vary the size of particles
        const baseSize = portalScale * 0.2; // Base size relative to portal
        const randomScale = baseSize * (0.5 + Math.random() * 0.5);
        sprite.scale.set(randomScale, randomScale, 1);

        // Add to tracking with individual movement patterns
        particles.push({
            sprite: sprite,
            // Original position for oscillation
            originalPos: sprite.position.clone(),
            // Individual movement speeds
            speeds: {
                x: (Math.random() - 0.5) * 0.5,
                y: (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.5
            },
            // Individual oscillation parameters
            oscillation: {
                x: Math.random() * Math.PI * 2,
                y: Math.random() * Math.PI * 2,
                z: Math.random() * Math.PI * 2,
                speed: 0.1 + Math.random() * 0.2
            }
        });

        group.add(sprite);
    }

    // Position the entire group
    group.position.copy(position);

    // Add to scene
    scene.add(group);

    // Animation variables
    let time = 0;

    function update(deltaTime) {
        time += deltaTime;

        particles.forEach((particle) => {
            const sprite = particle.sprite;
            const orig = particle.originalPos;
            const osc = particle.oscillation;

            // Complex motion combining drift and oscillation
            sprite.position.x = orig.x + Math.sin(time * osc.speed + osc.x) * 100;
            sprite.position.y = orig.y + Math.sin(time * osc.speed + osc.y) * 50;
            sprite.position.z = orig.z + Math.sin(time * osc.speed + osc.z) * 50;

            // Slow drift of original position
            orig.x += particle.speeds.x * deltaTime * 10;
            orig.y += particle.speeds.y * deltaTime * 10;
            orig.z += particle.speeds.z * deltaTime * 10;

            // Reset particles that drift too far
            const distanceFromCenter = orig.length();
            if (distanceFromCenter > radius) {
                // Reset to random position near the center
                orig.x = (Math.random() - 0.5) * radius * 0.5;
                orig.y = (Math.random() - 0.5) * height * 0.5;
                orig.z = (Math.random() - 0.5) * depth * 0.5;
            }

            // Gentle size pulsing
            const pulseScale = 1 + Math.sin(time * 2 + osc.x) * 0.01;
            sprite.scale.x = sprite.scale.y *= pulseScale;
        });
    }

    function dispose() {
        particles.forEach(particle => {
            particle.sprite.material.map.dispose();
            particle.sprite.material.dispose();
        });
        scene.remove(group);
    }

    return {
        system: group,
        update,
        dispose
    };
} 