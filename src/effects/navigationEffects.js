// src/effects/navigationEffects.js
import * as THREE from 'three';
import { scene } from '../core/gameState.js';

// Track marker state
let destinationMarker = null;
let attackMarker = null;
let markerStartTime = 0;
const markerDuration = 3000; // 3 seconds

// Function to create a visual marker at the destination point
export function createDestinationMarker(position) {
    // Remove any existing markers
    if (window.destinationMarker) {
        scene.remove(window.destinationMarker);
    }
    if (window.attackMarker) {
        scene.remove(window.attackMarker);
        window.attackMarker = null;
    }

    // Create a simple marker (3x larger than before)
    const markerGeometry = new THREE.CylinderGeometry(1.5, 0, 6, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);

    // Position the marker at the click location (slightly above water)
    marker.position.set(position.x, 0.1, position.z);

    // Store the marker for later removal
    window.destinationMarker = marker;

    // Add to scene
    scene.add(marker);

    // Add a fading effect
    fadeOutMarker(marker);
}

// Function to create a visual attack marker (red) at the target point
export function createAttackMarker(position) {
    // Remove any existing markers
    if (window.attackMarker) {
        scene.remove(window.attackMarker);
    }
    if (window.destinationMarker) {
        scene.remove(window.destinationMarker);
        window.destinationMarker = null;
    }

    // Create a simple marker similar to destination marker but in red
    const markerGeometry = new THREE.CylinderGeometry(1.5, 0, 6, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color for attack
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);

    // Position the marker at the click location (slightly above water)
    marker.position.set(position.x, 0.1, position.z);

    // Store the marker for later removal
    window.attackMarker = marker;

    // Add to scene
    scene.add(marker);

    // Add a fading effect
    fadeOutMarker(marker);
}

// Function to remove the destination marker
export function removeDestinationMarker() {
    if (destinationMarker) {
        scene.remove(destinationMarker);
        destinationMarker = null;
    }
}

// Update function to be called in the main animation loop
export function updateNavigationEffects() {
    if (destinationMarker) {
        const elapsedTime = Date.now() - markerStartTime;
        const progress = elapsedTime / markerDuration;

        if (progress < 1.0) {
            // Fade out the opacity
            destinationMarker.material.opacity = 1.0 - progress;
        } else {
            // Remove the marker when animation is complete
            removeDestinationMarker();
        }
    }
}

// Function to fade out the marker over time
function fadeOutMarker(marker) {
    const startTime = Date.now();
    const duration = 3000; // 3 seconds

    function animate() {
        const elapsedTime = Date.now() - startTime;
        const progress = elapsedTime / duration;

        if (progress < 1.0) {
            // Fade out the opacity
            marker.material.opacity = 1.0 - progress;

            // Continue animation
            requestAnimationFrame(animate);
        } else {
            // Remove the marker when animation is complete
            scene.remove(marker);
            if (window.destinationMarker === marker) {
                window.destinationMarker = null;
            } else if (window.attackMarker === marker) {
                window.attackMarker = null;
            }
        }
    }

    // Set material to allow transparency
    marker.material.transparent = true;

    // Start the animation
    animate();
}

// Function to get current marker (useful for other systems)
export function getDestinationMarker() {
    return destinationMarker;
}