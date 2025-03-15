import * as THREE from 'three';
import { boat, boatVelocity, scene, keys, camera, addToScene, removeFromScene } from '../core/gameState.js';

// BoatFly command state - export this so shipController can check it
export const boatFlyState = {
    isFlying: false,
    wings: [],
    originalY: 0,
    flySpeed: 1.5,
    gravity: 10,
    waterLevel: 0,
    isFalling: false,
    updateIntervalId: null,
    // Custom keys for flight control
    keys: {
        forward: false,  // P key
        up: false,       // O key
        down: false      // I key
    }
};

/**
 * BoatFly command implementation - lets the boat fly with added wings
 * @param {Array<string>} args - Command arguments
 * @param {object} chatSystem - Reference to the chat system
 */
function boatFlyCommand(args, chatSystem) {
    if (boatFlyState.isFlying) {
        // Disable boat flying mode
        disableBoatFly(chatSystem);
    } else {
        // Enable boat flying mode
        enableBoatFly(args, chatSystem);
    }
}

/**
 * Enable boat flying mode
 * @param {Array<string>} args - Command arguments
 * @param {object} chatSystem - Reference to the chat system
 */
function enableBoatFly(args, chatSystem) {
    // Check for speed argument
    if (args.length > 0) {
        const speedArg = parseFloat(args[0]);
        if (!isNaN(speedArg) && speedArg > 0) {
            boatFlyState.flySpeed = speedArg;
        }
    }

    // Store original Y position
    boatFlyState.originalY = boat.position.y;

    // Add wings to the boat
    addWings();

    // Set up flying state
    boatFlyState.isFlying = true;
    boatFlyState.isFalling = false;

    // Reset all flight keys

    // IMPORTANT! Tell main.js that the boat is in flight mode
    // This prevents main.js from resetting the boat's Y position
    window.boatInParabolicFlight = true;

    // Also disable boat rocking while flying
    window.disableBoatRocking = true;

    // Register our key handlers - but DON'T interfere with WASD
    document.addEventListener('keydown', handleBoatFlyKeyDown);
    document.addEventListener('keyup', handleBoatFlyKeyUp);

    // Set up update interval for flight controls
    boatFlyState.updateIntervalId = setInterval(updateBoatFlight, 16); // ~60fps

    // Ensure we're starting above water
    if (boat.position.y <= boatFlyState.waterLevel) {
        boat.position.y = boatFlyState.waterLevel + 2;
    }

    chatSystem.addSystemMessage(
        `🦅 BOAT FLY MODE ACTIVATED! 🦅\n` +
        `Your boat now has wings! Use these keys to fly:\n` +
        `P - Forward thrust\n` +
        `O - Fly upward\n` +
        `I - Fly downward\n` +
        `WASD - Still controls boat rotation\n` +
        `Current flying speed: ${boatFlyState.flySpeed.toFixed(1)}x\n` +
        `Use /boatfly again to remove wings and return to sea.`
    );
}

/**
 * Disable boat flying mode
 * @param {object} chatSystem - Reference to the chat system
 */
function disableBoatFly(chatSystem) {
    // Remove wings
    removeWings();

    // Start falling
    boatFlyState.isFlying = false;
    boatFlyState.isFalling = true;

    // Remove our custom key handlers
    document.removeEventListener('keydown', handleBoatFlyKeyDown);
    document.removeEventListener('keyup', handleBoatFlyKeyUp);

    chatSystem.addSystemMessage("Wings removed! Your boat is now falling back to the sea...");
}

/**
 * Add wings to the boat
 */
function addWings() {
    // Create left wing - smaller and more airplane-like
    const leftWing = createWing();
    // Position with more space from the boat's side
    leftWing.position.set(2, 0.3, 3); // Left side, slight upward offset
    // Rotate for horizontal orientation and forward alignment
    leftWing.rotation.x = -Math.PI / 2; // 90 degrees around X to make it horizontal
    leftWing.rotation.y = 0; // 90 degrees around Y to align leading edge with -Z (forward)
    // Remove rotation.z to avoid unnecessary flipping
    boat.add(leftWing);

    // Create right wing - smaller and more airplane-like
    const rightWing = createWing();
    // Position with more space from the boat's side
    rightWing.position.set(-2, 0.3, 3); // Right side, slight upward offset
    // Rotate for horizontal orientation and forward alignment
    rightWing.rotation.x = -Math.PI / 2; // 90 degrees around X to make it horizontal
    rightWing.rotation.y = -Math.PI; // 90 degrees around Y to align leading edge with -Z (forward)
    // Remove rotation.z to avoid unnecessary flipping
    boat.add(rightWing);

    // Store references to wings
    boatFlyState.wings = [leftWing, rightWing];
}

/**
 * Create a single wing mesh - now more airplane-like and glossy
 * @returns {THREE.Mesh} The wing mesh
 */
function createWing() {
    // Create wing shape - half the size and more aerodynamic
    const wingShape = new THREE.Shape();

    // Start at the attachment point
    wingShape.moveTo(0, 0);
    // Create curve instead of straight line for more aerodynamic shape
    wingShape.bezierCurveTo(
        0, 5,      // control point 1
        5, 10,     // control point 2
        30, 20     // end point - half the original size
    );
    // Tapered wing tip
    wingShape.lineTo(30, 18);
    // Curved bottom edge
    wingShape.bezierCurveTo(
        28, 10,    // control point 1
        25, 5,     // control point 2
        0, 0       // back to start
    );

    // Create geometry with more detail
    const wingGeometry = new THREE.ExtrudeGeometry(wingShape, {
        steps: 1,
        depth: 0.2,
        bevelEnabled: true,
        bevelThickness: 0.3,
        bevelSize: 0.2,
        bevelOffset: 0,
        bevelSegments: 3
    });

    // Create a glossy material with reflections
    const wingMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xf0f0f0,       // Slight off-white
        metalness: 0.3,         // Slightly metallic
        roughness: 0.2,         // Very smooth for glossiness
        clearcoat: 0.8,         // Add clear coat for extra shine
        clearcoatRoughness: 0.1, // Smooth clear coat
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,           // Slightly transparent
        envMapIntensity: 1.5    // Enhance reflection intensity
    });

    const wing = new THREE.Mesh(wingGeometry, wingMaterial);

    // Add aerodynamic details
    addWingDetails(wing);

    return wing;
}

/**
 * Add detailed features to the wing
 * @param {THREE.Mesh} wing - The wing to add details to
 */
function addWingDetails(wing) {
    // Add a winglet (vertical tip)
    const wingletShape = new THREE.Shape();
    wingletShape.moveTo(0, 0);
    wingletShape.lineTo(0, 5);  // Height of winglet
    wingletShape.lineTo(2, 4);  // Slight curve
    wingletShape.lineTo(2, 0);
    wingletShape.lineTo(0, 0);

    const wingletGeometry = new THREE.ExtrudeGeometry(wingletShape, {
        steps: 1,
        depth: 0.1,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 2
    });

    // Make the winglet in a contrasting color
    const wingletMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x3080ff,       // Blue accent
        metalness: 0.4,
        roughness: 0.2,
        clearcoat: 0.9,
        side: THREE.DoubleSide
    });

    const winglet = new THREE.Mesh(wingletGeometry, wingletMaterial);
    winglet.position.set(30, 18, 0);  // Place at wingtip
    winglet.rotation.z = Math.PI / 2;
    wing.add(winglet);

    // Add wing struts
    for (let i = 0; i < 2; i++) {
        const strutGeometry = new THREE.BoxGeometry(20, 0.2, 0.3);
        const strutMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xd0d0d0,
            metalness: 0.7,
            roughness: 0.3
        });

        const strut = new THREE.Mesh(strutGeometry, strutMaterial);
        strut.position.set(15, 3 + i * 7, 0.1);  // Position along the wing
        wing.add(strut);
    }

    // Add decorative line details
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x2060a0,
        linewidth: 1
    });

    // Create a curved line along the wing surface
    const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(2, 1, 0.2),
        new THREE.Vector3(10, 5, 0.2),
        new THREE.Vector3(20, 10, 0.2),
        new THREE.Vector3(28, 18, 0.2)
    );

    const points = curve.getPoints(20);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    wing.add(line);
}

/**
 * Remove wings from the boat
 */
function removeWings() {
    if (boatFlyState.wings) {
        for (const wing of boatFlyState.wings) {
            if (wing.parent) {
                wing.parent.remove(wing);
            }
            // Properly dispose of geometries and materials
            if (wing.geometry) wing.geometry.dispose();
            if (wing.material) {
                if (Array.isArray(wing.material)) {
                    wing.material.forEach(m => m.dispose());
                } else {
                    wing.material.dispose();
                }
            }

            // Clean up child objects too
            if (wing.children && wing.children.length > 0) {
                wing.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
        }
        boatFlyState.wings = [];
    }
}

/**
 * Handle keydown events in boat fly mode with new controls
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleBoatFlyKeyDown(event) {
    // Skip if chat input is active
    if (window.chatInputActive ||
        (document.activeElement &&
            (document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA'))) {
        return;
    }

    const key = event.key.toUpperCase();

    // Only handle our custom flight keys - don't interfere with WASD
    if (key === 'P') {
        boatFlyState.keys.forward = true;
        // Don't call preventDefault here - let event bubble for other handlers
    }
    else if (key === 'O') {
        boatFlyState.keys.up = true;
        // Don't call preventDefault here - let event bubble for other handlers
    }
    else if (key === 'I') {
        boatFlyState.keys.down = true;
        // Don't call preventDefault here - let event bubble for other handlers
    }
}

/**
 * Handle keyup events in boat fly mode with new controls
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleBoatFlyKeyUp(event) {
    // Skip if chat input is active
    if (window.chatInputActive ||
        (document.activeElement &&
            (document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA'))) {
        return;
    }

    const key = event.key.toUpperCase();

    // Only handle our custom flight keys - don't interfere with WASD
    if (key === 'P') {
        boatFlyState.keys.forward = false;
        // Don't call preventDefault here - let event bubble for other handlers
    }
    else if (key === 'O') {
        boatFlyState.keys.up = false;
        // Don't call preventDefault here - let event bubble for other handlers
    }
    else if (key === 'I') {
        boatFlyState.keys.down = false;
        // Don't call preventDefault here - let event bubble for other handlers
    }
}

/**
 * Update boat flight position based on dedicated flight controls
 */
function updateBoatFlight() {
    if (!boat) return;

    if (boatFlyState.isFlying) {
        // Keep track of whether any movement occurred for wing flapping
        let isMoving = false;

        // Handle forward thrust (in boat's forward direction)
        if (boatFlyState.keys.forward) {
            // Get boat's forward direction - FIXED: now using correct forward direction
            // Using -Z as forward instead of Z (inverting the direction)
            const forward = new THREE.Vector3(0, 0, 5).applyAxisAngle(
                new THREE.Vector3(0, 1, 0), boat.rotation.y
            );

            // Apply forward movement
            boat.position.x += forward.x * boatFlyState.flySpeed;
            boat.position.z += forward.z * boatFlyState.flySpeed;

            isMoving = true;
        }

        // Handle upward movement (always straight up regardless of orientation)
        if (boatFlyState.keys.up) {
            boat.position.y += boatFlyState.flySpeed * 0.8;
            isMoving = true;
        }

        // Handle downward movement (always straight down)
        if (boatFlyState.keys.down) {
            boat.position.y -= boatFlyState.flySpeed * 0.8;

            // Don't go below water
            if (boat.position.y <= boatFlyState.waterLevel) {
                boat.position.y = boatFlyState.waterLevel;
            }

            isMoving = true;
        }

        // If no keys are pressed, still make it go up slightly for a better hover effect
        if (!boatFlyState.keys.forward && !boatFlyState.keys.up && !boatFlyState.keys.down) {
            // Very slight upward drift for a hovering effect
            boat.position.y += 0.01;
        }

        // Animate wings flapping up and down instead of side to side
        if (boatFlyState.wings.length === 2) {
            const baseFlap = Math.sin(Date.now() * 0.005) * 0.1;
            // More dramatic flapping when actively flying
            const flapAmount = isMoving ? baseFlap * 3 : baseFlap;
            // Changed from rotation.z to rotation.z + a rotation.x component for up/down motion
            boatFlyState.wings[0].rotation.z = 0; // Reset side-to-side rotation
            boatFlyState.wings[1].rotation.z = 0; // Reset side-to-side rotation
            // Apply vertical flapping (add to existing rotation.x which is PI/2)
            boatFlyState.wings[0].rotation.x = (-Math.PI / 2) + flapAmount;
            boatFlyState.wings[1].rotation.x = (-Math.PI / 2) + flapAmount;
        }

    } else if (boatFlyState.isFalling) {
        // Apply gravity for falling
        boat.position.y -= boatFlyState.gravity;

        // Check if we've hit the water
        if (boat.position.y <= boatFlyState.waterLevel) {
            boat.position.y = boatFlyState.waterLevel;
            boatFlyState.isFalling = false;

            // IMPORTANT: Reset flight flags when we hit water
            window.boatInParabolicFlight = false;
            window.disableBoatRocking = false;

            // Stop the update interval
            if (boatFlyState.updateIntervalId) {
                clearInterval(boatFlyState.updateIntervalId);
                boatFlyState.updateIntervalId = null;
            }

            // Create splash effect
            createSplashEffect(boat.position.x, boat.position.z);
        }
    }
}

/**
 * Create a splash effect when the boat hits the water
 * @param {number} x - X position
 * @param {number} z - Z position
 */
function createSplashEffect(x, z) {
    // Create particles for splash effect - bigger splash for bigger boat
    const particleCount = 60; // More particles
    const particleGeometry = new THREE.SphereGeometry(0.5, 8, 8); // Larger particles
    const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0x8888ff,
        transparent: true,
        opacity: 0.8
    });

    const particles = [];

    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);

        // Position around the boat with larger radius
        const theta = Math.random() * Math.PI * 2;
        const radius = 3 + Math.random() * 10; // Larger radius
        particle.position.set(
            x + radius * Math.cos(theta),
            0.1,
            z + radius * Math.sin(theta)
        );

        // Set random velocity - higher for bigger splash
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5, // Faster horizontal spread
            0.2 + Math.random() * 0.5,   // Higher jump
            (Math.random() - 0.5) * 0.5
        );

        // Add to scene
        scene.add(particle);
        particles.push(particle);
    }

    // Animate particles
    let splashTime = 0;
    const maxSplashTime = 90; // Longer animation

    function animateSplash() {
        splashTime++;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            // Update position
            p.position.x += p.userData.velocity.x;
            p.position.y += p.userData.velocity.y;
            p.position.z += p.userData.velocity.z;

            // Apply gravity
            p.userData.velocity.y -= 0.01;

            // Fade out
            p.material.opacity = 0.8 * (1 - splashTime / maxSplashTime);
        }

        if (splashTime < maxSplashTime) {
            requestAnimationFrame(animateSplash);
        } else {
            // Remove particles
            for (const p of particles) {
                scene.remove(p);
                p.geometry.dispose();
                p.material.dispose();
            }
        }
    }

    // Start animation
    animateSplash();
}

// Export boat fly command
export const boatFlyCommands = [
    {
        name: 'boatfly',
        handler: boatFlyCommand,
        description: 'Toggle boat flying mode with wings. Use P for forward, O for up, I for down. WASD to rotate.'
    }
]; 