import * as THREE from 'three';
import { scene, getTime, addToScene, removeFromScene, isInScene } from '../core/gameState.js';
import { applyOutline, removeOutline } from '../theme/outlineStyles.js';

// Nanodredge Collective configuration constants
const NANODREDGE_CONFIG = {
    UNIT_COUNT: 50,          // Number of individual nanobots in a full collective
    MAX_COLLECTIVES: 8,        // Maximum number of collectives in the world
    BASE_SPEED: 0.15,          // Base movement speed
    SWARM_COHESION: 0.02,      // How strongly units are attracted to the center
    SWARM_SEPARATION: 0.01,    // How strongly units repel each other
    SWARM_ALIGNMENT: 0.03,     // How strongly units align with neighbors
    DETECTION_RANGE: 180,      // Range to detect player
    ATTACK_RANGE: 40,          // Range to start attacking player
    FORMATION_CHANGE_TIME: 15, // Seconds between formation changes
    PURSUIT_SPEED_MULTIPLIER: 1.8, // Speed multiplier when pursuing target
    BOID_NEIGHBOR_RADIUS: 5,   // Radius to consider other units as neighbors for flocking behavior
};

// Nanodredge Collective state constants
const COLLECTIVE_STATE = {
    DORMANT: 'dormant',         // Inactive, minimal movement
    GATHERING: 'gathering',      // Collecting into formation
    SEARCHING: 'searching',      // Actively searching for targets
    PURSUING: 'pursuing',        // Moving toward target
    ATTACKING: 'attacking',      // Engaging with target
    REFORMING: 'reforming',      // Reconfiguring formation after taking damage
    FLEEING: 'fleeing',          // Retreating when critically damaged
    DISSIPATING: 'dissipating'   // Collective is dying/breaking apart
};

// Nanodredge formations
const COLLECTIVE_FORMATION = {
    CLOUD: 'cloud',             // Default dispersed formation
    SPHERE: 'sphere',           // Defensive spherical formation
    VORTEX: 'vortex',           // Tornado-like offensive formation
    WAVE: 'wave',               // Wide wave pattern for sweeping
    DRILL: 'drill',             // Concentrated point formation for penetrating defenses
    WALL: 'wall',               // Flat barrier formation
    GEAR: 'gear',               // Rotating formation with extending spikes
    NET: 'net'                  // Dispersed formation for surrounding targets
};

// Current state
let collectives = [];
let targetEntity = null; // Will be set to player entity during integration

/**
 * Create a new Nanodredge Collective swarm
 * @param {THREE.Vector3} position - Initial spawn position
 * @returns {Object} - The created collective object
 */
function createNanodredgeCollective(position = null) {
    // Create main swarm group that will contain all elements
    const swarmGroup = new THREE.Group();

    // If no position provided, generate random position
    if (!position) {
        position = new THREE.Vector3(
            (Math.random() - 0.5) * 1000,
            -100 + Math.random() * 50, // Underwater
            (Math.random() - 0.5) * 1000
        );
    }

    swarmGroup.position.copy(position);

    // Create particle system for the main swarm body
    const particleCount = NANODREDGE_CONFIG.UNIT_COUNT;
    const particleGeometry = new THREE.BufferGeometry();

    // Create arrays for particle positions, sizes, and colors
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);

    // Define initial distribution of particles in a sphere
    const radius = 15;
    const color = new THREE.Color();

    for (let i = 0; i < particleCount; i++) {
        // Random position within a sphere
        const i3 = i * 3;
        const phi = Math.acos(-1 + (2 * Math.random()));
        const theta = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;

        positions[i3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = r * Math.cos(phi);

        // Random size variations for particles (nanobots)
        sizes[i] = 0.5 + Math.random() * 0.5;

        // Variations of technological/robotic colors
        const colorVariation = Math.random();
        if (colorVariation < 0.5) {
            // Electric blue color
            color.setHSL(0.6, 0.8, 0.5 + Math.random() * 0.3);
        } else if (colorVariation < 0.85) {
            // Metallic silver/chrome
            const brightness = 0.7 + Math.random() * 0.2;
            color.setRGB(brightness, brightness, brightness + 0.05);
        } else {
            // Occasional energy pulse (bright cyan)
            color.setHSL(0.5, 0.9, 0.7 + Math.random() * 0.3);
        }

        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
    }

    // Add attributes to the geometry
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom shader material for particles
    const particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            pointTexture: { value: createNanobotTexture() }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float time;
            
            void main() {
                vColor = color;
                
                // Add subtle movement based on position and time
                vec3 pos = position;
                float noise = sin(position.x * 2.0 + time) * 0.1 + 
                             sin(position.y * 2.0 + time * 0.8) * 0.1 +
                             sin(position.z * 2.0 + time * 0.6) * 0.1;
                             
                pos += noise * vec3(sin(time * 0.5), cos(time * 0.3), sin(time * 0.7));
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * (40.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D pointTexture;
            varying vec3 vColor;
            
            void main() {
                gl_FragColor = vec4(vColor, 1.0) * texture2D(pointTexture, gl_PointCoord);
                
                // Add slight glow effect
                float intensity = 1.0 - length(gl_PointCoord - vec2(0.5, 0.5)) * 2.0;
                intensity = max(0.0, intensity);
                gl_FragColor.rgb += vColor * intensity * 0.5;
            }
        `,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        transparent: true
    });

    // Create particle system and add to group
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    swarmGroup.add(particleSystem);

    // Add core element - denser center of the swarm
    const coreGeometry = new THREE.SphereGeometry(5, 16, 16);
    const coreMaterial = new THREE.MeshPhongMaterial({
        color: 0x00a5ff,
        emissive: 0x004466,
        transparent: true,
        opacity: 0.7,
        shininess: 90
    });

    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.scale.set(0.8, 0.8, 0.8); // Slightly smaller initially
    swarmGroup.add(core);

    // Add electrical arcs
    const arcs = createElectricalArcs();
    swarmGroup.add(arcs);

    // Add bubbles emitter
    const bubbles = createBubbleEmitter();
    swarmGroup.add(bubbles);

    // Add to scene
    scene.add(swarmGroup);

    // Create and return collective object with all properties and references
    const collective = {
        swarmGroup: swarmGroup,
        particleSystem: particleSystem,
        core: core,
        arcs: arcs,
        bubbles: bubbles,
        unitPositions: positions,  // Reference to position buffer for direct manipulation
        unitSizes: sizes,          // Reference to size buffer
        unitColors: colors,        // Reference to color buffer
        state: COLLECTIVE_STATE.DORMANT,
        previousState: null,
        stateTimer: 10 + Math.random() * 5,
        formation: COLLECTIVE_FORMATION.CLOUD,
        targetFormation: COLLECTIVE_FORMATION.CLOUD,
        formationBlend: 1.0,       // Fully formed
        velocity: new THREE.Vector3(),
        targetPosition: new THREE.Vector3(),
        health: 100,
        maxHealth: 100,
        boidData: initBoidData(particleCount), // For complex flocking behavior
        pulsePhase: Math.random() * Math.PI * 2,  // Random starting phase
        lastAttackTime: 0,
        formationChangeTimer: NANODREDGE_CONFIG.FORMATION_CHANGE_TIME * Math.random()
    };

    // Push to collectives array
    collectives.push(collective);

    // Apply outline style for visual enhancement
    applyOutline(swarmGroup, {
        color: 0x331100,
        scale: 1.05,
        recursive: true,
        opacity: 0.4
    });

    return collective;
}

/**
 * Creates particle texture for individual nanobots
 * @returns {THREE.Texture} The texture for nanobots
 */
function createNanobotTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');

    // Clear background
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, 64, 64);

    // Draw hexagonal shape
    context.beginPath();
    const sides = 6;
    const size = 28;
    const centerX = 32;
    const centerY = 32;

    for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
        const x = centerX + size * Math.cos(angle);
        const y = centerY + size * Math.sin(angle);

        if (i === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    }
    context.closePath();

    // Fill with gradient
    const gradient = context.createRadialGradient(32, 32, 5, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(150, 240, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(50, 170, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(30, 100, 200, 0.4)');
    gradient.addColorStop(1, 'rgba(5, 40, 100, 0)');

    context.fillStyle = gradient;
    context.fill();

    // Draw inner circuit pattern
    context.strokeStyle = 'rgba(200, 255, 255, 0.9)';
    context.lineWidth = 1;

    // Inner hexagon
    context.beginPath();
    for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
        const x = centerX + size * 0.6 * Math.cos(angle);
        const y = centerY + size * 0.6 * Math.sin(angle);

        if (i === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    }
    context.closePath();
    context.stroke();

    // Circuit lines
    context.beginPath();
    for (let i = 0; i < sides; i += 2) {
        const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
        const x1 = centerX + size * 0.6 * Math.cos(angle);
        const y1 = centerY + size * 0.6 * Math.sin(angle);

        context.moveTo(centerX, centerY);
        context.lineTo(x1, y1);
    }
    context.stroke();

    // Center dot
    context.beginPath();
    context.arc(32, 32, 4, 0, Math.PI * 2);
    context.fillStyle = 'rgba(50, 220, 255, 0.9)';
    context.fill();

    return new THREE.CanvasTexture(canvas);
}

/**
 * Creates electrical arcs for the swarm
 * @returns {THREE.Group} Group containing electrical arcs
 */
function createElectricalArcs() {
    const arcsGroup = new THREE.Group();
    const arcCount = 12;

    for (let i = 0; i < arcCount; i++) {
        // Create digital/stepped line for arc (more robotic looking)
        const points = [];
        const segments = 8; // More segments for a more complex path
        const radius = 12;

        // Starting point near center
        points.push(new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4
        ));

        // Create angular path outward (more digital looking)
        for (let j = 1; j < segments; j++) {
            const segmentRadius = (j / segments) * radius;

            // 90-degree angle changes for more digital look
            const angleStep = Math.floor(Math.random() * 4) * (Math.PI / 2);
            const prevPoint = points[j - 1];

            // Calculate next point with digital/stepped movement
            let newX, newY, newZ;

            // Choose which axis to move along (more digital/robotic movement)
            const axisChoice = Math.floor(Math.random() * 3);
            if (axisChoice === 0) {
                newX = prevPoint.x + (Math.random() > 0.5 ? 1 : -1) * segmentRadius * 0.5;
                newY = prevPoint.y;
                newZ = prevPoint.z;
            } else if (axisChoice === 1) {
                newX = prevPoint.x;
                newY = prevPoint.y + (Math.random() > 0.5 ? 1 : -1) * segmentRadius * 0.5;
                newZ = prevPoint.z;
            } else {
                newX = prevPoint.x;
                newY = prevPoint.y;
                newZ = prevPoint.z + (Math.random() > 0.5 ? 1 : -1) * segmentRadius * 0.5;
            }

            points.push(new THREE.Vector3(newX, newY, newZ));
        }

        // Create geometry from points
        const arcGeometry = new THREE.BufferGeometry().setFromPoints(points);

        // Material with more tech-like glow
        const arcMaterial = new THREE.LineBasicMaterial({
            color: 0x00eeff,
            transparent: true,
            opacity: 0.7
        });

        const arc = new THREE.Line(arcGeometry, arcMaterial);
        arcsGroup.add(arc);

        // Store animation data
        arc.userData = {
            lifespan: 0.3 + Math.random() * 0.3, // Shorter, more digital-like bursts
            age: 0,
            active: Math.random() > 0.5,
            points: points
        };
    }

    return arcsGroup;
}

/**
 * Creates a bubble emitter for underwater effect
 * @returns {THREE.Group} Group containing bubble particles
 */
function createBubbleEmitter() {
    const bubblesGroup = new THREE.Group();

    // Create bubble geometry and material
    const bubbleCount = 50;
    const bubbleGeometry = new THREE.BufferGeometry();
    const bubblePositions = new Float32Array(bubbleCount * 3);
    const bubbleSizes = new Float32Array(bubbleCount);

    // Initialize bubble positions and sizes
    for (let i = 0; i < bubbleCount; i++) {
        const i3 = i * 3;
        bubblePositions[i3] = (Math.random() - 0.5) * 20;
        bubblePositions[i3 + 1] = (Math.random() - 0.5) * 20;
        bubblePositions[i3 + 2] = (Math.random() - 0.5) * 20;

        bubbleSizes[i] = 0.2 + Math.random() * 0.6;
    }

    bubbleGeometry.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
    bubbleGeometry.setAttribute('size', new THREE.BufferAttribute(bubbleSizes, 1));

    // Custom shader for bubbles
    const bubbleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },
        vertexShader: `
            attribute float size;
            uniform float time;
            
            void main() {
                // Bubble rising effect
                vec3 pos = position;
                pos.y += time * 2.0 * size;
                
                // Loop bubbles back to bottom when they rise too high
                if (pos.y > 15.0) {
                    pos.y = -15.0;
                    pos.x = (position.x + sin(time) * 5.0);
                    pos.z = (position.z + cos(time) * 5.0);
                }
                
                // Add gentle side-to-side motion
                pos.x += sin(time * 2.0 + position.y) * 0.2;
                pos.z += cos(time * 1.5 + position.y) * 0.2;
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * (20.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            void main() {
                // Create circular bubble shape
                vec2 uv = gl_PointCoord - vec2(0.5);
                float r = length(uv);
                
                if (r > 0.5) discard;
                
                // Edge highlight effect
                float intensity = 1.0 - smoothstep(0.4, 0.5, r);
                
                // Color gradient from center to edge
                vec3 color = mix(
                    vec3(0.7, 0.9, 1.0), 
                    vec3(0.3, 0.6, 0.9), 
                    r * 2.0
                );
                
                // Bubble transparency and highlights
                float alpha = (0.2 + 0.8 * (1.0 - r * 1.5)) * intensity;
                
                // Add highlight spot
                vec2 highlightPos = vec2(0.35, 0.35);
                float highlight = 1.0 - length(uv - highlightPos) * 3.0;
                highlight = max(0.0, highlight);
                
                gl_FragColor = vec4(color + highlight, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const bubbles = new THREE.Points(bubbleGeometry, bubbleMaterial);
    bubblesGroup.add(bubbles);

    // Store data for animation
    bubbles.userData = {
        positions: bubblePositions,
        sizes: bubbleSizes
    };

    return bubblesGroup;
}

/**
 * Initialize data structures for boid flocking algorithm
 * @param {number} count - Number of boids/units in the swarm
 * @returns {Object} Boid data structure
 */
function initBoidData(count) {
    const velocities = new Float32Array(count * 3);
    const accelerations = new Float32Array(count * 3);

    // Initialize with random velocities
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        velocities[i3] = (Math.random() - 0.5) * 0.1;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;

        accelerations[i3] = 0;
        accelerations[i3 + 1] = 0;
        accelerations[i3 + 2] = 0;
    }

    return {
        velocities: velocities,
        accelerations: accelerations,
        maxSpeed: 0.5,
        maxForce: 0.03
    };
}

/**
 * Setup function to initialize Nanodredge Collectives
 * @param {Object} playerEntity - Reference to player entity for targeting
 * @returns {Array} Array of created collectives
 */
export function setupNanodredgeCollectives(playerEntity) {
    // Store player reference for targeting
    targetEntity = playerEntity;

    // Clear existing collectives if any
    collectives = [];

    // Create new collectives
    const collectiveCount = Math.floor(NANODREDGE_CONFIG.MAX_COLLECTIVES / 2); // Start with half capacity

    for (let i = 0; i < collectiveCount; i++) {
        createNanodredgeCollective();
    }

    return collectives;
}

/**
 * Main update function for all Nanodredge Collectives
 * @param {number} deltaTime - Time since last frame in seconds
 */
export function updateNanodredgeCollectives(deltaTime) {
    const time = getTime() / 1000; // Convert to seconds

    // Update each collective
    collectives.forEach((collective, index) => {
        // Skip if being removed
        if (collective.state === COLLECTIVE_STATE.DISSIPATING && collective.health <= 0) {
            return;
        }

        // Update state timer
        collective.stateTimer -= deltaTime;

        // Update formation change timer
        collective.formationChangeTimer -= deltaTime;

        // Handle state transitions
        handleStateTransitions(collective, deltaTime);

        // Process current state
        switch (collective.state) {
            case COLLECTIVE_STATE.DORMANT:
                updateDormantCollective(collective, deltaTime);
                break;
            case COLLECTIVE_STATE.GATHERING:
                updateGatheringCollective(collective, deltaTime);
                break;
            case COLLECTIVE_STATE.SEARCHING:
                updateSearchingCollective(collective, deltaTime);
                break;
            case COLLECTIVE_STATE.PURSUING:
                updatePursuingCollective(collective, deltaTime);
                break;
            case COLLECTIVE_STATE.ATTACKING:
                updateAttackingCollective(collective, deltaTime);
                break;
            case COLLECTIVE_STATE.REFORMING:
                updateReformingCollective(collective, deltaTime);
                break;
            case COLLECTIVE_STATE.FLEEING:
                updateFleeingCollective(collective, deltaTime);
                break;
            case COLLECTIVE_STATE.DISSIPATING:
                updateDissipatingCollective(collective, deltaTime);
                break;
        }

        // Apply swarm group velocity
        collective.swarmGroup.position.add(collective.velocity);

        // Update formation if transitioning
        if (collective.formation !== collective.targetFormation) {
            updateFormationTransition(collective, deltaTime);
        }

        // Update individual unit positions and behavior (boids algorithm)
        updateSwarmUnits(collective, deltaTime, time);

        // Update visual effects
        updateCollectiveEffects(collective, deltaTime, time);

        // Keep within world bounds
        keepCollectiveInWorld(collective);

        // Update materials uniform time values
        if (collective.particleSystem.material.uniforms.time) {
            collective.particleSystem.material.uniforms.time.value = time;
        }

        if (collective.bubbles.children[0] &&
            collective.bubbles.children[0].material.uniforms.time) {
            collective.bubbles.children[0].material.uniforms.time.value = time;
        }
    });

    // Remove any collectives marked for removal
    collectives = collectives.filter(collective => {
        if (collective.state === COLLECTIVE_STATE.DISSIPATING && collective.health <= 0 && collective.stateTimer <= 0) {
            scene.remove(collective.swarmGroup);
            return false;
        }
        return true;
    });
}

/**
 * Handles state transitions based on current state and conditions
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 */
function handleStateTransitions(collective, deltaTime) {
    const currentState = collective.state;

    // Save previous state before any transitions
    if (collective.previousState !== currentState) {
        collective.previousState = currentState;
    }

    // Check if player is in detection range
    let distanceToTarget = Number.MAX_VALUE;
    if (targetEntity) {
        distanceToTarget = collective.swarmGroup.position.distanceTo(targetEntity.position);
    }

    // Handle transitions based on current state
    switch (currentState) {
        case COLLECTIVE_STATE.DORMANT:
            // Wake up if timer expires or target is close
            if (collective.stateTimer <= 0 ||
                (targetEntity && distanceToTarget < NANODREDGE_CONFIG.DETECTION_RANGE)) {
                collective.state = COLLECTIVE_STATE.GATHERING;
                collective.stateTimer = 5 + Math.random() * 3;
            }
            break;

        case COLLECTIVE_STATE.GATHERING:
            // After gathering, start searching
            if (collective.stateTimer <= 0) {
                collective.state = COLLECTIVE_STATE.SEARCHING;
                collective.stateTimer = 15 + Math.random() * 10;
            }
            break;

        case COLLECTIVE_STATE.SEARCHING:
            // If target detected, start pursuing
            if (targetEntity && distanceToTarget < NANODREDGE_CONFIG.DETECTION_RANGE) {
                collective.state = COLLECTIVE_STATE.PURSUING;
                collective.stateTimer = 10 + Math.random() * 5;
            }
            // If search timer expires, go back to dormant
            else if (collective.stateTimer <= 0) {
                collective.state = COLLECTIVE_STATE.DORMANT;
                collective.stateTimer = 20 + Math.random() * 10;
            }
            break;

        case COLLECTIVE_STATE.PURSUING:
            // If close enough to target, start attacking
            if (targetEntity && distanceToTarget < NANODREDGE_CONFIG.ATTACK_RANGE) {
                collective.state = COLLECTIVE_STATE.ATTACKING;
                collective.stateTimer = 15 + Math.random() * 5;
            }
            // If target too far away, go back to searching
            else if (!targetEntity || distanceToTarget > NANODREDGE_CONFIG.DETECTION_RANGE * 1.5) {
                collective.state = COLLECTIVE_STATE.SEARCHING;
                collective.stateTimer = 15 + Math.random() * 5;
            }
            break;

        case COLLECTIVE_STATE.ATTACKING:
            // If target moves out of range, go back to pursuing
            if (!targetEntity || distanceToTarget > NANODREDGE_CONFIG.ATTACK_RANGE * 1.2) {
                collective.state = COLLECTIVE_STATE.PURSUING;
                collective.stateTimer = 10 + Math.random() * 5;
            }

            // If health gets low, consider fleeing
            if (collective.health < collective.maxHealth * 0.3 && Math.random() < 0.1) {
                collective.state = COLLECTIVE_STATE.FLEEING;
                collective.stateTimer = 8 + Math.random() * 4;
            }
            break;

        case COLLECTIVE_STATE.REFORMING:
            // After reforming, go back to previous state or searching
            if (collective.stateTimer <= 0) {
                if (collective.previousState === COLLECTIVE_STATE.ATTACKING &&
                    targetEntity &&
                    distanceToTarget < NANODREDGE_CONFIG.ATTACK_RANGE) {
                    collective.state = COLLECTIVE_STATE.ATTACKING;
                } else if (collective.previousState === COLLECTIVE_STATE.PURSUING &&
                    targetEntity &&
                    distanceToTarget < NANODREDGE_CONFIG.DETECTION_RANGE) {
                    collective.state = COLLECTIVE_STATE.PURSUING;
                } else {
                    collective.state = COLLECTIVE_STATE.SEARCHING;
                }
                collective.stateTimer = 10 + Math.random() * 5;
            }
            break;

        case COLLECTIVE_STATE.FLEEING:
            // After fleeing, reform and heal
            if (collective.stateTimer <= 0) {
                collective.state = COLLECTIVE_STATE.REFORMING;
                collective.stateTimer = 8 + Math.random() * 4;
                // Recover some health while reforming
                collective.health = Math.min(collective.maxHealth,
                    collective.health + collective.maxHealth * 0.3);
            }
            break;

        case COLLECTIVE_STATE.DISSIPATING:
            // No state transitions when dissipating - handled in main update loop
            break;
    }

    // Periodically change formation based on state and timer
    if (collective.formationChangeTimer <= 0 &&
        collective.state !== COLLECTIVE_STATE.DORMANT &&
        collective.state !== COLLECTIVE_STATE.DISSIPATING) {

        // Select new formation based on current state
        selectNewFormation(collective);
        collective.formationChangeTimer = NANODREDGE_CONFIG.FORMATION_CHANGE_TIME + Math.random() * 5;
    }
}

/**
 * Updates collective in dormant state - minimal movement, low energy
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 */
function updateDormantCollective(collective, deltaTime) {
    // Minimal random movement
    collective.velocity.x = Math.sin(getTime() * 0.001) * 0.02;
    collective.velocity.z = Math.cos(getTime() * 0.001) * 0.02;
    collective.velocity.y = Math.sin(getTime() * 0.0005) * 0.01;

    // Dormant collectives use cloud formation
    collective.targetFormation = COLLECTIVE_FORMATION.CLOUD;
}

/**
 * Updates collective in gathering state - units coming together
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 */
function updateGatheringCollective(collective, deltaTime) {
    // Slow movement while gathering
    collective.velocity.x = Math.sin(getTime() * 0.002) * 0.05;
    collective.velocity.z = Math.cos(getTime() * 0.002) * 0.05;
    collective.velocity.y = Math.sin(getTime() * 0.001) * 0.03;

    // Gathered collectives use sphere formation
    collective.targetFormation = COLLECTIVE_FORMATION.SPHERE;
}

/**
 * Updates collective in searching state - wider movement pattern looking for targets
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 */
function updateSearchingCollective(collective, deltaTime) {
    // More active searching behavior
    const time = getTime() * 0.001;
    const speed = NANODREDGE_CONFIG.BASE_SPEED * 0.7;

    // Complex movement pattern
    collective.velocity.x = Math.sin(time) * Math.cos(time * 0.7) * speed;
    collective.velocity.z = Math.cos(time) * Math.sin(time * 0.6) * speed;
    collective.velocity.y = Math.sin(time * 0.5) * 0.05; // Small vertical movement

    // Searching collectives switch between formations
    if (collective.formationChangeTimer <= 0) {
        // Choose between wave and cloud for searching
        collective.targetFormation = Math.random() < 0.5 ?
            COLLECTIVE_FORMATION.WAVE : COLLECTIVE_FORMATION.CLOUD;
    }
}

/**
 * Updates collective in pursuing state - moving toward target
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 */
function updatePursuingCollective(collective, deltaTime) {
    if (!targetEntity) return;

    // Calculate direction to target
    const directionToTarget = new THREE.Vector3()
        .subVectors(targetEntity.position, collective.swarmGroup.position)
        .normalize();

    // Set velocity toward target with pursuit speed multiplier
    collective.velocity.copy(
        directionToTarget.multiplyScalar(NANODREDGE_CONFIG.BASE_SPEED *
            NANODREDGE_CONFIG.PURSUIT_SPEED_MULTIPLIER)
    );

    // Add slight vertical movement based on sine wave
    collective.velocity.y += Math.sin(getTime() * 0.003) * 0.02;

    // Pursuing collectives use more aggressive formations
    if (collective.formationChangeTimer <= 0) {
        const formations = [
            COLLECTIVE_FORMATION.VORTEX,
            COLLECTIVE_FORMATION.DRILL,
            COLLECTIVE_FORMATION.GEAR
        ];
        collective.targetFormation = formations[Math.floor(Math.random() * formations.length)];
    }
}

/**
 * Updates collective in attacking state - engaging with target
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 */
function updateAttackingCollective(collective, deltaTime) {
    if (!targetEntity) return;

    // Calculate distance and direction to target
    const vectorToTarget = new THREE.Vector3()
        .subVectors(targetEntity.position, collective.swarmGroup.position);
    const distanceToTarget = vectorToTarget.length();
    const directionToTarget = vectorToTarget.normalize();

    // Different attack patterns based on current formation
    switch (collective.formation) {
        case COLLECTIVE_FORMATION.DRILL:
            // Direct charge attack
            collective.velocity.copy(
                directionToTarget.multiplyScalar(NANODREDGE_CONFIG.BASE_SPEED * 2.5)
            );
            break;

        case COLLECTIVE_FORMATION.VORTEX:
            // Circling attack
            const orbitSpeed = NANODREDGE_CONFIG.BASE_SPEED * 1.8;
            const orbitRadius = NANODREDGE_CONFIG.ATTACK_RANGE * 0.5;

            // Calculate orbit position
            const orbitAngle = getTime() * 0.002;
            const orbitTarget = new THREE.Vector3(
                targetEntity.position.x + Math.cos(orbitAngle) * orbitRadius,
                targetEntity.position.y,
                targetEntity.position.z + Math.sin(orbitAngle) * orbitRadius
            );

            // Move toward orbit position
            const orbitDirection = new THREE.Vector3()
                .subVectors(orbitTarget, collective.swarmGroup.position)
                .normalize();

            collective.velocity.copy(orbitDirection.multiplyScalar(orbitSpeed));
            break;

        case COLLECTIVE_FORMATION.NET:
            // Surround and slow approach
            if (distanceToTarget > NANODREDGE_CONFIG.ATTACK_RANGE * 0.3) {
                collective.velocity.copy(
                    directionToTarget.multiplyScalar(NANODREDGE_CONFIG.BASE_SPEED)
                );
            } else {
                // Very slow when close - like tightening a net
                collective.velocity.copy(
                    directionToTarget.multiplyScalar(NANODREDGE_CONFIG.BASE_SPEED * 0.2)
                );
            }
            break;

        case COLLECTIVE_FORMATION.GEAR:
            // Approach and retreat pattern
            const pulsePhase = Math.sin(getTime() * 0.003);
            const pulseMagnitude = NANODREDGE_CONFIG.BASE_SPEED *
                (1.5 + pulsePhase);

            collective.velocity.copy(
                directionToTarget.multiplyScalar(pulseMagnitude)
            );
            break;

        default:
            // Default attack behavior
            collective.velocity.copy(
                directionToTarget.multiplyScalar(NANODREDGE_CONFIG.BASE_SPEED * 1.5)
            );
            break;
    }

    // Check if we need to perform damage to target
    const currentTime = getTime() / 1000;
    if (distanceToTarget < NANODREDGE_CONFIG.ATTACK_RANGE * 0.5 &&
        currentTime - collective.lastAttackTime > 1.0) {

        // Simulate attack (to be integrated with damage system later)
        collective.lastAttackTime = currentTime;

        // Generate attack effect
        createAttackEffect(collective);
    }

    // Attacking collectives cycle through aggressive formations
    if (collective.formationChangeTimer <= 0) {
        const formations = [
            COLLECTIVE_FORMATION.DRILL,
            COLLECTIVE_FORMATION.VORTEX,
            COLLECTIVE_FORMATION.GEAR,
            COLLECTIVE_FORMATION.NET
        ];
        collective.targetFormation = formations[Math.floor(Math.random() * formations.length)];
    }
}

/**
 * Creates a visual effect for attacks
 * @param {Object} collective - The collective performing the attack
 */
function createAttackEffect(collective) {
    // Create digital pulse wave
    const pulseGeometry = new THREE.RingGeometry(0.5, 1.5, 16);
    const pulseMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    });

    const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
    pulse.position.copy(collective.swarmGroup.position);
    pulse.rotation.x = Math.PI / 2; // Make it horizontal
    scene.add(pulse);

    // Add additional energy beam effect
    const beamGeometry = new THREE.CylinderGeometry(0.5, 3, 15, 8, 1, true);
    const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });

    const beam = new THREE.Mesh(beamGeometry, beamMaterial);

    // Position beam to aim at target
    if (targetEntity) {
        const direction = new THREE.Vector3().subVectors(
            targetEntity.position,
            collective.swarmGroup.position
        ).normalize();

        beam.position.copy(collective.swarmGroup.position);
        beam.lookAt(targetEntity.position);
        beam.rotateX(Math.PI / 2); // Adjust to point along its length
    }

    scene.add(beam);

    // Animate pulse and beam
    const startTime = getTime();
    const pulseDuration = 1.0; // seconds
    const maxPulseSize = 25;

    function animatePulse() {
        const elapsed = (getTime() - startTime) / 1000;
        const progress = elapsed / pulseDuration;

        if (progress >= 1.0) {
            // Remove effects when animation completes
            scene.remove(pulse);
            scene.remove(beam);
            return;
        }

        // Scale up pulse
        const scale = progress * maxPulseSize;
        pulse.scale.set(scale, scale, scale);

        // Fade out effects
        pulse.material.opacity = 0.7 * (1 - progress);
        beam.material.opacity = 0.5 * (1 - Math.pow(progress, 2));

        // Shrink beam as it extends
        beam.scale.y = 1 - progress * 0.5;

        // Continue animation
        requestAnimationFrame(animatePulse);
    }

    // Start animation
    animatePulse();
}

/**
 * Updates collective in reforming state - regrouping after taking damage
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 */
function updateReformingCollective(collective, deltaTime) {
    // Minimal movement while reforming
    collective.velocity.x = Math.sin(getTime() * 0.0015) * 0.03;
    collective.velocity.z = Math.cos(getTime() * 0.0015) * 0.03;
    collective.velocity.y = Math.sin(getTime() * 0.001) * 0.02;

    // Reforming uses sphere formation for protection
    collective.targetFormation = COLLECTIVE_FORMATION.SPHERE;

    // Slowly regenerate health while reforming
    if (collective.health < collective.maxHealth) {
        collective.health += (collective.maxHealth * 0.05) * deltaTime;
        collective.health = Math.min(collective.health, collective.maxHealth);
    }
}

/**
 * Updates collective in fleeing state - retreating from danger
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 */
function updateFleeingCollective(collective, deltaTime) {
    // If target exists, move away from it
    if (targetEntity) {
        // Get direction away from target
        const fleeDirection = new THREE.Vector3()
            .subVectors(collective.swarmGroup.position, targetEntity.position)
            .normalize();

        // Set velocity away from target with high speed
        collective.velocity.copy(
            fleeDirection.multiplyScalar(NANODREDGE_CONFIG.BASE_SPEED * 2.0)
        );
    } else {
        // No target, just move randomly but quickly
        const time = getTime() * 0.001;
        const speed = NANODREDGE_CONFIG.BASE_SPEED * 1.5;

        collective.velocity.x = Math.sin(time * 1.1) * speed;
        collective.velocity.z = Math.cos(time * 0.9) * speed;
        collective.velocity.y = Math.sin(time * 0.7) * speed * 0.5;
    }

    // Fleeing collectives use cloud or sphere formations for protection
    if (collective.formationChangeTimer <= 0) {
        collective.targetFormation = Math.random() < 0.7 ?
            COLLECTIVE_FORMATION.CLOUD : COLLECTIVE_FORMATION.SPHERE;
    }
}

/**
 * Updates collective in dissipating state - breaking apart and dying
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 */
function updateDissipatingCollective(collective, deltaTime) {
    // Slow all movement down
    collective.velocity.multiplyScalar(0.95);

    // Calculate dissipation progress
    const progress = 1 - (collective.stateTimer / 5.0); // Assuming 5s dissipation time

    // Gradually spread out and fade the particles
    const positions = collective.unitPositions;
    const colors = collective.unitColors;
    const particleCount = NANODREDGE_CONFIG.UNIT_COUNT;

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;

        // Gradually move particles outward in random directions
        positions[i3] *= 1 + (0.2 * deltaTime);
        positions[i3 + 1] *= 1 + (0.2 * deltaTime);
        positions[i3 + 2] *= 1 + (0.2 * deltaTime);

        // Fade out colors
        colors[i3] *= 0.99;
        colors[i3 + 1] *= 0.98;
        colors[i3 + 2] *= 0.97;
    }

    // Update the geometry attributes
    collective.particleSystem.geometry.attributes.position.needsUpdate = true;
    collective.particleSystem.geometry.attributes.color.needsUpdate = true;

    // Shrink the core
    collective.core.scale.multiplyScalar(0.98);

    // Reduce health to zero
    collective.health = Math.max(0, collective.health - (collective.maxHealth * 0.2 * deltaTime));
}

/**
 * Updates individual swarm units using boid flocking algorithm
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 * @param {number} time - Current game time
 */
function updateSwarmUnits(collective, deltaTime, time) {
    const positions = collective.unitPositions;
    const particleCount = NANODREDGE_CONFIG.UNIT_COUNT;
    const boidData = collective.boidData;
    const velocities = boidData.velocities;
    const accelerations = boidData.accelerations;
    const maxSpeed = boidData.maxSpeed;
    const maxForce = boidData.maxForce;

    // Reset accelerations
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        accelerations[i3] = 0;
        accelerations[i3 + 1] = 0;
        accelerations[i3 + 2] = 0;
    }

    // Calculate target positions based on current formation
    const targetPositions = calculateFormationPositions(collective);

    // Apply boid rules to each unit
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;

        // Current position vector
        const position = new THREE.Vector3(
            positions[i3],
            positions[i3 + 1],
            positions[i3 + 2]
        );

        // Current velocity vector
        const velocity = new THREE.Vector3(
            velocities[i3],
            velocities[i3 + 1],
            velocities[i3 + 2]
        );

        // Rule 1: Cohesion - steer towards target position from formation
        if (targetPositions[i]) {
            const cohesionForce = new THREE.Vector3()
                .copy(targetPositions[i])
                .sub(position)
                .multiplyScalar(NANODREDGE_CONFIG.SWARM_COHESION);

            accelerations[i3] += cohesionForce.x;
            accelerations[i3 + 1] += cohesionForce.y;
            accelerations[i3 + 2] += cohesionForce.z;
        }

        // Rule 2: Separation - avoid other boids that are too close
        const separationForce = new THREE.Vector3();
        let neighborCount = 0;

        for (let j = 0; j < particleCount; j++) {
            if (i === j) continue;

            const j3 = j * 3;
            const otherPosition = new THREE.Vector3(
                positions[j3],
                positions[j3 + 1],
                positions[j3 + 2]
            );

            const distance = position.distanceTo(otherPosition);

            if (distance < NANODREDGE_CONFIG.BOID_NEIGHBOR_RADIUS) {
                // Calculate repulsion vector (away from neighbor)
                const repulsion = new THREE.Vector3()
                    .subVectors(position, otherPosition)
                    .normalize()
                    .divideScalar(Math.max(0.1, distance)); // Stronger when closer

                separationForce.add(repulsion);
                neighborCount++;
            }
        }

        // Average and apply separation force
        if (neighborCount > 0) {
            separationForce.divideScalar(neighborCount);
            separationForce.multiplyScalar(NANODREDGE_CONFIG.SWARM_SEPARATION);

            accelerations[i3] += separationForce.x;
            accelerations[i3 + 1] += separationForce.y;
            accelerations[i3 + 2] += separationForce.z;
        }

        // Rule 3: Alignment - steer towards average heading of neighbors
        const alignmentForce = new THREE.Vector3();
        neighborCount = 0;

        for (let j = 0; j < particleCount; j++) {
            if (i === j) continue;

            const j3 = j * 3;
            const otherPosition = new THREE.Vector3(
                positions[j3],
                positions[j3 + 1],
                positions[j3 + 2]
            );

            const distance = position.distanceTo(otherPosition);

            if (distance < NANODREDGE_CONFIG.BOID_NEIGHBOR_RADIUS * 2) {
                // Add neighbor's velocity to alignment force
                alignmentForce.x += velocities[j3];
                alignmentForce.y += velocities[j3 + 1];
                alignmentForce.z += velocities[j3 + 2];
                neighborCount++;
            }
        }

        // Average and apply alignment force
        if (neighborCount > 0) {
            alignmentForce.divideScalar(neighborCount);
            alignmentForce.normalize();
            alignmentForce.multiplyScalar(NANODREDGE_CONFIG.SWARM_ALIGNMENT);

            accelerations[i3] += alignmentForce.x;
            accelerations[i3 + 1] += alignmentForce.y;
            accelerations[i3 + 2] += alignmentForce.z;
        }

        // Update velocity with acceleration
        velocities[i3] += accelerations[i3] * deltaTime;
        velocities[i3 + 1] += accelerations[i3 + 1] * deltaTime;
        velocities[i3 + 2] += accelerations[i3 + 2] * deltaTime;

        // Limit velocity to max speed
        const speed = Math.sqrt(
            velocities[i3] * velocities[i3] +
            velocities[i3 + 1] * velocities[i3 + 1] +
            velocities[i3 + 2] * velocities[i3 + 2]
        );

        if (speed > maxSpeed) {
            velocities[i3] = (velocities[i3] / speed) * maxSpeed;
            velocities[i3 + 1] = (velocities[i3 + 1] / speed) * maxSpeed;
            velocities[i3 + 2] = (velocities[i3 + 2] / speed) * maxSpeed;
        }

        // Update position with velocity
        positions[i3] += velocities[i3] * deltaTime;
        positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
        positions[i3 + 2] += velocities[i3 + 2] * deltaTime;
    }

    // Update the geometry
    collective.particleSystem.geometry.attributes.position.needsUpdate = true;
}

/**
 * Calculates positions for each unit based on the current formation
 * @param {Object} collective - The collective to calculate for
 * @returns {Array} Array of Vector3 positions for each unit
 */
function calculateFormationPositions(collective) {
    const positions = [];
    const particleCount = NANODREDGE_CONFIG.UNIT_COUNT;
    const formation = collective.formation;
    const time = getTime() * 0.001;

    for (let i = 0; i < particleCount; i++) {
        let position = new THREE.Vector3();

        // Golden spiral distribution for most even coverage of a sphere
        const phi = Math.acos(1 - 2 * (i / particleCount));
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;

        // Base formation radius
        let radius = 15;

        switch (formation) {
            case COLLECTIVE_FORMATION.CLOUD:
                // Random cloud with Gaussian-like distribution
                radius = 20 * (0.5 + Math.random() * 0.5);
                position.x = (Math.random() - 0.5) * radius;
                position.y = (Math.random() - 0.5) * radius;
                position.z = (Math.random() - 0.5) * radius;
                break;

            case COLLECTIVE_FORMATION.SPHERE:
                // Even distribution on sphere surface
                position.x = radius * Math.sin(phi) * Math.cos(theta);
                position.y = radius * Math.sin(phi) * Math.sin(theta);
                position.z = radius * Math.cos(phi);
                break;

            case COLLECTIVE_FORMATION.VORTEX:
                // Spiral vortex formation
                const heightFactor = (i / particleCount) * 30 - 15; // -15 to 15 range
                const spiralRadius = 10 + 5 * Math.sin(i / 100);
                const angle = theta + time * 2;

                position.x = spiralRadius * Math.cos(angle);
                position.y = heightFactor;
                position.z = spiralRadius * Math.sin(angle);
                break;

            case COLLECTIVE_FORMATION.WAVE:
                // Undulating wave pattern
                const waveWidth = 30;
                const waveDepth = 10;
                const xPos = (i % 100) / 100 * waveWidth - waveWidth / 2;
                const zPos = Math.floor(i / 100) / (particleCount / 100) * waveDepth - waveDepth / 2;
                const yPos = 5 * Math.sin(xPos * 0.5 + time * 3) * Math.cos(zPos * 0.5 + time * 2);

                position.x = xPos;
                position.y = yPos;
                position.z = zPos;
                break;

            case COLLECTIVE_FORMATION.DRILL:
                // Concentrated point formation
                const drillProgress = i / particleCount;
                const drillRadius = 3 + 12 * (1 - drillProgress);
                const drillAngle = theta + time * 3;
                const drillHeight = -15 + drillProgress * 30;

                position.x = drillRadius * Math.cos(drillAngle);
                position.y = drillHeight;
                position.z = drillRadius * Math.sin(drillAngle);
                break;

            case COLLECTIVE_FORMATION.WALL:
                // Flat barrier formation
                const wallWidth = 30;
                const wallHeight = 20;

                position.x = (i % 100) / 100 * wallWidth - wallWidth / 2;
                position.y = (Math.floor(i / 100) / (particleCount / 100)) * wallHeight - wallHeight / 2;
                position.z = 2 * Math.sin(position.x * 0.2 + position.y * 0.3 + time * 2);
                break;

            case COLLECTIVE_FORMATION.GEAR:
                // Rotating gear with extending spikes
                const gearRadius = 12;
                const teethCount = 12;
                const toothPhase = (i % teethCount) / teethCount * Math.PI * 2;
                const toothLength = 6 * Math.sin(time * 2 + toothPhase);
                const gearAngle = theta + time;

                const distFromCenter = gearRadius + (i % teethCount === 0 ? toothLength : 0);
                position.x = distFromCenter * Math.cos(gearAngle);
                position.y = (i / particleCount - 0.5) * 20; // Distribute along y-axis
                position.z = distFromCenter * Math.sin(gearAngle);
                break;

            case COLLECTIVE_FORMATION.NET:
                // Net formation for surrounding targets
                const netSphereRadius = 25;
                const holeSize = 5 + 3 * Math.sin(time * 2);

                // Calculate position on sphere
                position.x = netSphereRadius * Math.sin(phi) * Math.cos(theta);
                position.y = netSphereRadius * Math.sin(phi) * Math.sin(theta);
                position.z = netSphereRadius * Math.cos(phi);

                // Create a "hole" in the direction of the target (if it exists)
                if (targetEntity) {
                    const dirToTarget = new THREE.Vector3()
                        .subVectors(targetEntity.position, collective.swarmGroup.position)
                        .normalize();

                    // Convert position to direction vector
                    const posDir = position.clone().normalize();

                    // Check if this unit is in the "hole" direction
                    const dotProduct = posDir.dot(dirToTarget);

                    if (dotProduct > 0.8) {
                        // Units in the hole move inward, creating an opening
                        const adjustment = (dotProduct - 0.8) / 0.2; // 0-1 value
                        position.multiplyScalar(1 - adjustment * holeSize / netSphereRadius);
                    }
                }
                break;
        }

        positions.push(position);
    }

    return positions;
}

/**
 * Updates visual effects for the collective
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 * @param {number} time - Current game time
 */
function updateCollectiveEffects(collective, deltaTime, time) {
    // Update core pulsing based on health and state
    const healthRatio = collective.health / collective.maxHealth;
    const baseScale = 0.8 * healthRatio + 0.2; // 0.2-1.0 range
    const pulseAmount = 0.1 * Math.sin(time * 2 + collective.pulsePhase);

    collective.core.scale.set(
        baseScale + pulseAmount,
        baseScale + pulseAmount,
        baseScale + pulseAmount
    );

    // Update core material based on state
    switch (collective.state) {
        case COLLECTIVE_STATE.ATTACKING:
            // More intense glow when attacking
            collective.core.material.emissive.setRGB(0.7, 0.3, 0.1);
            collective.core.material.emissiveIntensity = 1.0 + 0.2 * Math.sin(time * 5);
            break;

        case COLLECTIVE_STATE.FLEEING:
            // Dim, unstable glow when fleeing
            collective.core.material.emissive.setRGB(0.4, 0.1, 0.0);
            collective.core.material.emissiveIntensity = 0.6 + 0.4 * Math.random();
            break;

        case COLLECTIVE_STATE.DISSIPATING:
            // Fading, flickering glow when dying
            collective.core.material.emissive.setRGB(0.3, 0.05, 0.0);
            collective.core.material.emissiveIntensity = 0.3 * Math.random();
            break;

        default:
            // Normal glow
            collective.core.material.emissive.setRGB(0.4, 0.1, 0.0);
            collective.core.material.emissiveIntensity = 0.8 + 0.2 * Math.sin(time * 2);
    }

    // Update electrical arcs
    for (let i = 0; i < collective.arcs.children.length; i++) {
        const arc = collective.arcs.children[i];

        // Update arc lifecycle
        if (arc.userData.active) {
            arc.userData.age += deltaTime;

            // Arc fadeout
            if (arc.userData.age >= arc.userData.lifespan) {
                arc.userData.active = false;
                arc.visible = false;
                arc.userData.age = 0;
            } else {
                // Update arc appearance
                const lifeProgress = arc.userData.age / arc.userData.lifespan;
                arc.material.opacity = 0.7 * (1 - lifeProgress);

                // Animate arc points
                const points = arc.userData.points;
                for (let j = 1; j < points.length - 1; j++) {
                    // Add jitter to middle points
                    points[j].x += (Math.random() - 0.5) * 0.3;
                    points[j].y += (Math.random() - 0.5) * 0.3;
                    points[j].z += (Math.random() - 0.5) * 0.3;
                }

                // Update arc geometry
                arc.geometry.setFromPoints(points);
            }
        } else {
            // Randomly activate inactive arcs
            if (Math.random() < 0.05) {
                arc.userData.active = true;
                arc.visible = true;

                // Reset arc points
                const segments = arc.userData.points.length;
                const radius = 12;

                // Starting point near center
                arc.userData.points[0].set(
                    (Math.random() - 0.5) * 4,
                    (Math.random() - 0.5) * 4,
                    (Math.random() - 0.5) * 4
                );

                // Create angular path outward (more digital looking)
                for (let j = 1; j < segments; j++) {
                    const segmentRadius = (j / segments) * radius;

                    // 90-degree angle changes for more digital look
                    const angleStep = Math.floor(Math.random() * 4) * (Math.PI / 2);
                    const prevPoint = arc.userData.points[j - 1];

                    // Calculate next point with digital/stepped movement
                    let newX, newY, newZ;

                    // Choose which axis to move along (more digital/robotic movement)
                    const axisChoice = Math.floor(Math.random() * 3);
                    if (axisChoice === 0) {
                        newX = prevPoint.x + (Math.random() > 0.5 ? 1 : -1) * segmentRadius * 0.5;
                        newY = prevPoint.y;
                        newZ = prevPoint.z;
                    } else if (axisChoice === 1) {
                        newX = prevPoint.x;
                        newY = prevPoint.y + (Math.random() > 0.5 ? 1 : -1) * segmentRadius * 0.5;
                        newZ = prevPoint.z;
                    } else {
                        newX = prevPoint.x;
                        newY = prevPoint.y;
                        newZ = prevPoint.z + (Math.random() > 0.5 ? 1 : -1) * segmentRadius * 0.5;
                    }

                    arc.userData.points[j].set(newX, newY, newZ);
                }

                arc.geometry.setFromPoints(arc.userData.points);
            }
        }
    }
}

/**
 * Keeps collective within world boundaries
 * @param {Object} collective - The collective to check
 */
function keepCollectiveInWorld(collective) {
    const worldBounds = 2000; // World boundary limit
    const pos = collective.swarmGroup.position;
    const bounced = false;

    // Check each dimension and bounce if needed
    if (pos.x < -worldBounds) {
        pos.x = -worldBounds;
        collective.velocity.x *= -0.5;
        bounced = true;
    } else if (pos.x > worldBounds) {
        pos.x = worldBounds;
        collective.velocity.x *= -0.5;
        bounced = true;
    }

    if (pos.y < -200) { // Lower underwater limit
        pos.y = -200;
        collective.velocity.y *= -0.5;
        bounced = true;
    } else if (pos.y > 50) { // Upper water surface limit
        pos.y = 50;
        collective.velocity.y *= -0.5;
        bounced = true;
    }

    if (pos.z < -worldBounds) {
        pos.z = -worldBounds;
        collective.velocity.z *= -0.5;
        bounced = true;
    } else if (pos.z > worldBounds) {
        pos.z = worldBounds;
        collective.velocity.z *= -0.5;
        bounced = true;
    }

    // If bouncing occurred, temporarily change to reforming state
    if (bounced && collective.state !== COLLECTIVE_STATE.REFORMING &&
        collective.state !== COLLECTIVE_STATE.DISSIPATING) {
        collective.previousState = collective.state;
        collective.state = COLLECTIVE_STATE.REFORMING;
        collective.stateTimer = 2 + Math.random();
    }
}

/**
 * Selects a new formation based on collective state
 * @param {Object} collective - The collective to update
 */
function selectNewFormation(collective) {
    const state = collective.state;

    switch (state) {
        case COLLECTIVE_STATE.DORMANT:
            collective.targetFormation = COLLECTIVE_FORMATION.CLOUD;
            break;

        case COLLECTIVE_STATE.GATHERING:
            collective.targetFormation = COLLECTIVE_FORMATION.SPHERE;
            break;

        case COLLECTIVE_STATE.SEARCHING:
            // Random between cloud, wave, or sphere
            const searchFormations = [
                COLLECTIVE_FORMATION.CLOUD,
                COLLECTIVE_FORMATION.WAVE,
                COLLECTIVE_FORMATION.SPHERE
            ];
            collective.targetFormation = searchFormations[Math.floor(Math.random() * searchFormations.length)];
            break;

        case COLLECTIVE_STATE.PURSUING:
            // More aggressive formations for pursuit
            const pursuitFormations = [
                COLLECTIVE_FORMATION.VORTEX,
                COLLECTIVE_FORMATION.DRILL,
                COLLECTIVE_FORMATION.GEAR
            ];
            collective.targetFormation = pursuitFormations[Math.floor(Math.random() * pursuitFormations.length)];
            break;

        case COLLECTIVE_STATE.ATTACKING:
            // Attack-oriented formations
            const attackFormations = [
                COLLECTIVE_FORMATION.DRILL,
                COLLECTIVE_FORMATION.VORTEX,
                COLLECTIVE_FORMATION.GEAR,
                COLLECTIVE_FORMATION.NET
            ];
            collective.targetFormation = attackFormations[Math.floor(Math.random() * attackFormations.length)];
            break;

        case COLLECTIVE_STATE.REFORMING:
            // Defensive formations for reforming
            collective.targetFormation = COLLECTIVE_FORMATION.SPHERE;
            break;

        case COLLECTIVE_STATE.FLEEING:
            // Defensive or fast formations for fleeing
            collective.targetFormation = Math.random() < 0.7 ?
                COLLECTIVE_FORMATION.CLOUD : COLLECTIVE_FORMATION.SPHERE;
            break;

        case COLLECTIVE_STATE.DISSIPATING:
            // Always cloud formation when dissipating
            collective.targetFormation = COLLECTIVE_FORMATION.CLOUD;
            break;
    }
}

/**
 * Updates formation when transitioning between formations
 * @param {Object} collective - The collective to update
 * @param {number} deltaTime - Time since last frame
 */
function updateFormationTransition(collective, deltaTime) {
    // Transition speed depends on state
    let transitionSpeed = 0.5; // Default transition speed

    switch (collective.state) {
        case COLLECTIVE_STATE.ATTACKING:
            transitionSpeed = 2.0; // Fast transitions during attack
            break;
        case COLLECTIVE_STATE.REFORMING:
            transitionSpeed = 0.3; // Slow, deliberate transitions when reforming
            break;
        case COLLECTIVE_STATE.FLEEING:
            transitionSpeed = 1.5; // Fast transitions when fleeing
            break;
    }

    // Progress the transition
    collective.formationBlend += transitionSpeed * deltaTime;

    // Complete transition
    if (collective.formationBlend >= 1.0) {
        collective.formation = collective.targetFormation;
        collective.formationBlend = 1.0;
    }
}

/**
 * Handles damage to a collective
 * @param {Object} collective - The collective that was damaged
 * @param {number} amount - Amount of damage to apply
 */
export function damageCollective(collective, amount) {
    // Apply damage
    collective.health -= amount;

    // Check if the collective should die
    if (collective.health <= 0) {
        // Transition to dissipating state
        collective.previousState = collective.state;
        collective.state = COLLECTIVE_STATE.DISSIPATING;
        collective.stateTimer = 5.0; // Give 5 seconds for death animation
        return;
    }

    // For significant damage, transition to reforming state
    if (amount > 10 && collective.state !== COLLECTIVE_STATE.REFORMING) {
        collective.previousState = collective.state;
        collective.state = COLLECTIVE_STATE.REFORMING;
        collective.stateTimer = 3 + Math.random() * 2;
    }

    // Create damage effect
    createDamageEffect(collective);
}

/**
 * Creates visual effect for damage
 * @param {Object} collective - The damaged collective
 */
function createDamageEffect(collective) {
    // Create particle burst for damage
    const burstCount = 20;
    const burstGeometry = new THREE.BufferGeometry();
    const burstPositions = new Float32Array(burstCount * 3);
    const burstSizes = new Float32Array(burstCount);

    // Initialize particles at core position
    for (let i = 0; i < burstCount; i++) {
        const i3 = i * 3;
        burstPositions[i3] = 0;
        burstPositions[i3 + 1] = 0;
        burstPositions[i3 + 2] = 0;

        burstSizes[i] = 0.5 + Math.random() * 1.0;
    }

    burstGeometry.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3));
    burstGeometry.setAttribute('size', new THREE.BufferAttribute(burstSizes, 1));

    // Burst material
    const burstMaterial = new THREE.PointsMaterial({
        color: 0xff6600,
        size: 1.0,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    const burstParticles = new THREE.Points(burstGeometry, burstMaterial);
    collective.swarmGroup.add(burstParticles);

    // Particle velocities
    const velocities = [];
    for (let i = 0; i < burstCount; i++) {
        velocities.push(new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        ));
    }

    // Animate burst
    const startTime = getTime();
    const burstDuration = 1.0; // seconds

    function animateBurst() {
        const elapsed = (getTime() - startTime) / 1000;
        const progress = elapsed / burstDuration;

        if (progress >= 1.0) {
            // Remove burst when animation completes
            collective.swarmGroup.remove(burstParticles);
            return;
        }

        // Update particle positions
        for (let i = 0; i < burstCount; i++) {
            const i3 = i * 3;

            // Move particles outward
            burstPositions[i3] += velocities[i].x * 0.1;
            burstPositions[i3 + 1] += velocities[i].y * 0.1;
            burstPositions[i3 + 2] += velocities[i].z * 0.1;
        }

        // Update opacity
        burstMaterial.opacity = 0.8 * (1 - progress);

        // Update geometry
        burstGeometry.attributes.position.needsUpdate = true;

        // Continue animation
        requestAnimationFrame(animateBurst);
    }

    // Start animation
    animateBurst();
}

/**
 * Exports an API for external interaction with Nanodredge Collectives
 */
export default {
    createNanodredgeCollective,
    setupNanodredgeCollectives,
    updateNanodredgeCollectives,
    damageCollective,
    getCollectives: () => collectives
};