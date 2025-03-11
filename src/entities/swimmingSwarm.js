import * as THREE from 'three';
import { scene, getTime, addToScene, removeFromScene, isInScene, boat } from '../core/gameState.js';
import { applyOutline, removeOutline } from '../theme/outlineStyles.js';

// Swarm configuration constants
const SWARM_CONFIG = {
    UNIT_COUNT: 200,           // Number of individual creatures in a full swarm
    MAX_SWARMS: 12,             // Increased from 2 to allow for larger clusters
    BASE_SPEED: 0.5,          // Base movement speed
    SWARM_COHESION: 0.25,      // How strongly units are attracted to the center
    SWARM_SEPARATION: 0.02,    // How strongly units repel each other
    SWARM_ALIGNMENT: 0.8,      // How strongly units align with neighbors
    DETECTION_RANGE: 180,      // Range to detect player
    ATTACK_RANGE: 100,          // Range to start attacking player
    FORMATION_CHANGE_TIME: 3, // Seconds between formation changes
    PURSUIT_SPEED_MULTIPLIER: 3.0, // Speed multiplier when pursuing target
    BOID_NEIGHBOR_RADIUS: 30,   // Radius to consider other units as neighbors for flocking behavior
    UNDULATION_SPEED: 5.0,     // Speed of swimming undulation
    UNDULATION_AMOUNT: 0.5,   // Amount of undulation movement
    SWARM_SPAWN_RADIUS: 20,    // Tighter initial spawn radius
    ROLE_SPACING: 0.3,          // Distance between different roles in formation
    AMBUSH_DISTANCE: 150,      // Distance to hide and prepare ambush
    INTELLIGENCE_LEVEL: 0.7,   // How smart the swarms are (0-1)
    COORDINATION_RADIUS: 200,  // Distance for swarms to coordinate attacks
    PLAYER_PREDICTION: 2.0,    // Seconds to predict player movement
    ATTACK_COOLDOWN: 5,        // Seconds between coordinated attacks
    ELECTRIC_EFFECT_DENSITY: 0.3, // Reduce electrical effects by 70%
};

// Swarm state constants
const SWARM_STATE = {
    DORMANT: 'dormant',         // Inactive, minimal movement
    GATHERING: 'gathering',      // Collecting into formation
    SEARCHING: 'searching',      // Actively searching for targets
    PURSUING: 'pursuing',        // Moving toward target
    ATTACKING: 'attacking',      // Engaging with target
    REFORMING: 'reforming',      // Reconfiguring formation after taking damage
    FLEEING: 'fleeing',          // Retreating when critically damaged
    DISSIPATING: 'dissipating'   // Swarm is dying/breaking apart
};

// Swarm formations
const SWARM_FORMATION = {
    CLOUD: 'cloud',             // Default dispersed formation
    SPHERE: 'sphere',           // Defensive spherical formation
    VORTEX: 'vortex',           // Tornado-like offensive formation
    WAVE: 'wave',               // Wide wave pattern for sweeping
    FUNNEL: 'funnel',           // Concentrated point formation for attacks
    WALL: 'wall',               // Flat barrier formation
    SPIRAL: 'spiral',           // Rotating formation with extending arms
    NET: 'net'                  // Dispersed formation for surrounding targets
};

// Current state
let swarms = [];
let targetEntity = null; // Will be set to player entity during integration

/**
 * Create a new swarm of swimming creatures
 * @param {THREE.Vector3} position - Initial spawn position
 * @returns {Object} - The created swarm object
 */
function createSwimmingSwarm(position = null) {
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
    const particleCount = SWARM_CONFIG.UNIT_COUNT;
    const particleGeometry = new THREE.BufferGeometry();

    // Create arrays for particle positions, sizes, and colors
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    const rotations = new Float32Array(particleCount); // For swimming direction
    const types = new Float32Array(particleCount); // CREATE TYPES ARRAY HERE FIRST

    // Define initial distribution of particles in a tighter formation
    const radius = SWARM_CONFIG.SWARM_SPAWN_RADIUS; // Using the new config value
    const color = new THREE.Color();

    // Create a more organized initial distribution
    for (let i = 0; i < particleCount; i++) {
        // Assign type first to organize by type
        let type;
        if (i < particleCount * 0.25) {
            type = 0; // Scouts
        } else if (i < particleCount * 0.5) {
            type = 1; // Attackers
        } else if (i < particleCount * 0.75) {
            type = 2; // Support
        } else {
            type = 3; // Disruptors
        }
        types[i] = type; // Now this works because types is defined above

        // Position based on type for initial organization
        const i3 = i * 3;
        const typeGroup = Math.floor(type);
        const angleOffset = typeGroup * Math.PI / 2; // Different angle for each type
        const radiusOffset = radius * (0.6 + 0.4 * (typeGroup / 3)); // Different radius by type

        // Spherical distribution with type-based organization
        const phi = Math.acos(-1 + (2 * (i % (particleCount / 4)) / (particleCount / 4)));
        const theta = Math.PI * (1 + Math.sqrt(5)) * (i % (particleCount / 4)) + angleOffset;

        positions[i3] = radiusOffset * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radiusOffset * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radiusOffset * Math.cos(phi);

        // Size variations based on type
        if (type === 0) { // Scouts
            sizes[i] = 0.6 + Math.random() * 0.4;
        } else if (type === 1) { // Attackers
            sizes[i] = 0.9 + Math.random() * 0.6;
        } else if (type === 2) { // Support
            sizes[i] = 0.8 + Math.random() * 0.5;
        } else { // Disruptors
            sizes[i] = 0.7 + Math.random() * 0.7;
        }

        // Store random rotation
        rotations[i] = Math.random() * Math.PI * 2;

        // Color variations based on type
        if (type === 0) {
            // Scouts - Blue-cyan
            color.setHSL(0.6, 0.7, 0.5 + Math.random() * 0.3);
        } else if (type === 1) {
            // Attackers - Red-orange
            color.setHSL(0.05, 0.8, 0.5 + Math.random() * 0.3);
        } else if (type === 2) {
            // Support - Purple-pink
            color.setHSL(0.75, 0.7, 0.5 + Math.random() * 0.3);
        } else {
            // Disruptors - Yellow-green
            color.setHSL(0.25, 0.7, 0.5 + Math.random() * 0.3);
        }

        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
    }

    // Add attributes to the geometry
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));
    particleGeometry.setAttribute('type', new THREE.BufferAttribute(types, 1));

    // Custom shader material for swimming creatures
    const textures = [
        createCreatureTexture(0),
        createCreatureTexture(1),
        createCreatureTexture(2),
        createCreatureTexture(3)
    ];

    // Create a types array to track which type each unit is
    // const types = new Float32Array(particleCount);  <- DELETE THIS LINE

    // Assign types based on roles (25% each type)
    // for (let i = 0; i < particleCount; i++) {      <- DELETE THIS BLOCK
    //    // Assign different roles based on index     <- DELETE THIS BLOCK
    //    if (i < particleCount * 0.25) {             <- DELETE THIS BLOCK
    //        types[i] = 0; // Scouts                  <- DELETE THIS BLOCK
    //    } else if (i < particleCount * 0.5) {       <- DELETE THIS BLOCK
    //        types[i] = 1; // Attackers               <- DELETE THIS BLOCK
    //    } else if (i < particleCount * 0.75) {      <- DELETE THIS BLOCK
    //        types[i] = 2; // Support                 <- DELETE THIS BLOCK
    //    } else {                                     <- DELETE THIS BLOCK
    //        types[i] = 3; // Disruptors              <- DELETE THIS BLOCK
    //    }                                            <- DELETE THIS BLOCK
    // }                                              <- DELETE THIS BLOCK

    // particleGeometry.setAttribute('type', new THREE.BufferAttribute(types, 1)); <- DELETE THIS LINE (moved above)

    const particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            pointTexture0: { value: textures[0] },
            pointTexture1: { value: textures[1] },
            pointTexture2: { value: textures[2] },
            pointTexture3: { value: textures[3] }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            attribute float rotation;
            attribute float type;
            
            varying vec3 vColor;
            varying float vRotation;
            varying float vType;
            
            uniform float time;
            
            void main() {
                vColor = color;
                vRotation = rotation;
                vType = type;
                
                // Add swimming motion based on position and time
                vec3 pos = position;
                
                // Adjust swimming motion based on creature type
                float typeMultiplier = 1.0;
                if (vType < 0.5) { // Scout - faster
                    typeMultiplier = 1.5;
                } else if (vType < 1.5) { // Attacker - aggressive
                    typeMultiplier = 1.2;
                } else if (vType < 2.5) { // Support - gentle
                    typeMultiplier = 0.8;
                } else { // Disruptor - erratic
                    typeMultiplier = 1.0 + sin(time * 5.0) * 0.5;
                }
                
                // Sinusoidal swimming motion
                float swimCycle = time * 3.0 + position.x * 0.5 + position.y * 0.3 + position.z * 0.7;
                float lateralMovement = sin(swimCycle) * 0.15 * typeMultiplier;
                float verticalMovement = cos(swimCycle * 0.7) * 0.075 * typeMultiplier;
                
                // Apply swimming motion based on position to create wave-like patterns
                pos.x += lateralMovement * (0.5 + sin(position.z * 0.2));
                pos.y += verticalMovement * (0.5 + cos(position.x * 0.3));
                pos.z += sin(swimCycle * 0.5) * 0.105 * typeMultiplier;
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                
                // Size based on type
                float typeSize = 1.0;
                if (vType < 0.5) { // Scout - smaller
                    typeSize = 0.85;
                } else if (vType < 1.5) { // Attacker - larger
                    typeSize = 1.3;
                } else if (vType < 2.5) { // Support
                    typeSize = 1.1;
                } else { // Disruptor
                    typeSize = 1.2;
                }
                
                gl_PointSize = size * typeSize * (40.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D pointTexture0;
            uniform sampler2D pointTexture1;
            uniform sampler2D pointTexture2;
            uniform sampler2D pointTexture3;
            varying vec3 vColor;
            varying float vRotation;
            varying float vType;
            
            void main() {
                // Apply rotation to texture coordinates
                vec2 rotatedUV = vec2(
                    cos(vRotation) * (gl_PointCoord.x - 0.5) + sin(vRotation) * (gl_PointCoord.y - 0.5) + 0.5,
                    cos(vRotation) * (gl_PointCoord.y - 0.5) - sin(vRotation) * (gl_PointCoord.x - 0.5) + 0.5
                );
                
                // Choose texture based on type
                vec4 texColor;
                if (vType < 0.5) {
                    texColor = texture2D(pointTexture0, rotatedUV);
                } else if (vType < 1.5) {
                    texColor = texture2D(pointTexture1, rotatedUV);
                } else if (vType < 2.5) {
                    texColor = texture2D(pointTexture2, rotatedUV);
                } else {
                    texColor = texture2D(pointTexture3, rotatedUV);
                }
                
                // Discard transparent pixels
                if (texColor.a < 0.3) discard;
                
                gl_FragColor = vec4(vColor, 1.0) * texColor;
                
                // Add subtle glow effect
                float intensity = 1.0 - length(gl_PointCoord - vec2(0.5, 0.5)) * 1.8;
                intensity = max(0.0, intensity);
                gl_FragColor.rgb += vColor * intensity * 0.3;
            }
        `,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        transparent: true
    });

    // Create particle system and add to group
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    swarmGroup.add(particleSystem);

    // Add alpha/leader creature - larger central fish
    const alphaGeometry = new THREE.SphereGeometry(5, 16, 16);
    const alphaMaterial = new THREE.MeshPhongMaterial({
        color: 0x2288ff,  // Blue color for alpha fish
        emissive: 0x004488,
        transparent: true,
        opacity: 0.7,
        shininess: 70
    });

    const alpha = new THREE.Mesh(alphaGeometry, alphaMaterial);
    alpha.scale.set(0.8, 0.5, 1.2); // More fish-like proportions
    swarmGroup.add(alpha);

    // Add trailing effects for swimming motion
    const trails = createSwimmingTrails();
    swarmGroup.add(trails);

    // Add bubbles emitter
    const bubbles = createBubbleEmitter();
    swarmGroup.add(bubbles);

    // Add to scene
    scene.add(swarmGroup);

    // Create and return swarm object with all properties and references
    const swarm = {
        swarmGroup: swarmGroup,
        particleSystem: particleSystem,
        alpha: alpha,
        trails: trails,
        bubbles: bubbles,
        unitPositions: positions,  // Reference to position buffer for direct manipulation
        unitSizes: sizes,          // Reference to size buffer
        unitColors: colors,        // Reference to color buffer
        unitRotations: rotations,  // Reference to rotation buffer
        state: SWARM_STATE.DORMANT,
        previousState: null,
        stateTimer: 10 + Math.random() * 5,
        formation: SWARM_FORMATION.CLOUD,
        targetFormation: SWARM_FORMATION.CLOUD,
        formationBlend: 1.0,       // Fully formed
        velocity: new THREE.Vector3(),
        targetPosition: new THREE.Vector3(),
        health: 100,
        maxHealth: 100,
        boidData: initBoidData(particleCount), // For complex flocking behavior
        pulsePhase: Math.random() * Math.PI * 2,  // Random starting phase
        lastAttackTime: 0,
        formationChangeTimer: SWARM_CONFIG.FORMATION_CHANGE_TIME * Math.random(),
        physicalFeaturesTimer: 1.0, // Initialize timer
        isAmbushing: false,
        lastAlertTime: 0,
    };

    // Push to swarms array
    swarms.push(swarm);

    // Apply subtle outline for visibility
    applyOutline(swarmGroup, {
        color: 0x0044aa,
        scale: 1.05,
        recursive: true,
        opacity: 0.3
    });

    // Add physical features to the swarm
    addPhysicalFeatures(swarm);

    return swarm;
}

/**
 * Creates different creature textures based on type
 * @param {number} type - Type of creature (0-3)
 * @returns {THREE.Texture} The texture for the specific creature type
 */
function createCreatureTexture(type = -1) {
    // If no specific type provided, choose randomly
    if (type === -1) {
        type = Math.floor(Math.random() * 4);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');

    // Clear background
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, 64, 64);

    const centerX = 32;
    const centerY = 32;

    // Common gradient setup
    const gradient = context.createRadialGradient(
        centerX + 5, centerY, 2,
        centerX, centerY, 25
    );

    // Different creature types
    switch (type) {
        case 0: // Scout - Fast, small fish shape
            // Fish body - sleek and arrow-like
            context.beginPath();
            context.moveTo(centerX - 20, centerY); // Tail
            context.quadraticCurveTo(
                centerX - 5, centerY - 8,
                centerX + 12, centerY
            );
            context.quadraticCurveTo(
                centerX - 5, centerY + 8,
                centerX - 20, centerY
            );

            // Blue-cyan coloration
            gradient.addColorStop(0, 'rgba(130, 220, 255, 1)');
            gradient.addColorStop(0.4, 'rgba(80, 170, 255, 0.9)');
            gradient.addColorStop(1, 'rgba(40, 120, 220, 0)');

            context.fillStyle = gradient;
            context.fill();

            // Sharp tail fin
            context.beginPath();
            context.moveTo(centerX - 20, centerY - 10);
            context.lineTo(centerX - 30, centerY); // Tail tip
            context.lineTo(centerX - 20, centerY + 10);
            context.fillStyle = 'rgba(200, 230, 255, 0.7)';
            context.fill();

            // Small eye
            context.beginPath();
            context.arc(centerX + 7, centerY - 2, 1.5, 0, Math.PI * 2);
            context.fillStyle = 'rgba(0, 0, 0, 0.8)';
            context.fill();
            break;

        case 1: // Attacker - Aggressive predator with teeth
            // Predator body - more robust
            context.beginPath();
            context.moveTo(centerX - 18, centerY);
            context.quadraticCurveTo(
                centerX - 2, centerY - 12,
                centerX + 15, centerY - 4
            );
            context.lineTo(centerX + 15, centerY + 4);
            context.quadraticCurveTo(
                centerX - 2, centerY + 12,
                centerX - 18, centerY
            );

            // Red-orange coloration
            gradient.addColorStop(0, 'rgba(255, 180, 130, 1)');
            gradient.addColorStop(0.4, 'rgba(255, 120, 80, 0.9)');
            gradient.addColorStop(1, 'rgba(220, 80, 40, 0)');

            context.fillStyle = gradient;
            context.fill();

            // Teeth
            context.beginPath();
            context.moveTo(centerX + 15, centerY - 4);
            for (let i = 0; i < 4; i++) {
                const offset = i * 2;
                context.lineTo(centerX + 17, centerY - 3 + offset);
                context.lineTo(centerX + 15, centerY - 2 + offset);
            }
            context.fillStyle = 'rgba(255, 255, 255, 0.9)';
            context.fill();

            // Sharper fins
            context.beginPath();
            context.moveTo(centerX - 10, centerY - 12);
            context.lineTo(centerX - 5, centerY - 18);
            context.lineTo(centerX, centerY - 12);
            context.fillStyle = 'rgba(255, 100, 60, 0.7)';
            context.fill();

            // Menacing eye
            context.beginPath();
            context.arc(centerX + 10, centerY - 2, 2.5, 0, Math.PI * 2);
            context.fillStyle = 'rgba(255, 255, 0, 0.9)';
            context.fill();

            // Pupil
            context.beginPath();
            context.arc(centerX + 10, centerY - 2, 1.2, 0, Math.PI * 2);
            context.fillStyle = 'rgba(0, 0, 0, 1)';
            context.fill();
            break;

        case 2: // Support - Jellyfish-like
            // Bell shape
            context.beginPath();
            context.arc(centerX, centerY - 8, 15, 0, Math.PI, false);
            context.quadraticCurveTo(
                centerX, centerY + 10,
                centerX, centerY + 15
            );

            // Purple-pink coloration
            gradient.addColorStop(0, 'rgba(230, 150, 255, 1)');
            gradient.addColorStop(0.4, 'rgba(180, 100, 220, 0.9)');
            gradient.addColorStop(1, 'rgba(120, 50, 180, 0)');

            context.fillStyle = gradient;
            context.fill();

            // Tentacles
            for (let i = -6; i <= 6; i += 3) {
                context.beginPath();
                context.moveTo(centerX + i, centerY + 5);
                context.quadraticCurveTo(
                    centerX + i + (i > 0 ? 3 : -3), centerY + 15,
                    centerX + i, centerY + 25
                );
                context.lineWidth = 1.5;
                context.strokeStyle = 'rgba(200, 150, 220, 0.6)';
                context.stroke();
            }

            // Bioluminescent spots
            for (let i = 0; i < 5; i++) {
                const angle = i * Math.PI * 2 / 5;
                const spotX = centerX + Math.cos(angle) * 8;
                const spotY = centerY - 8 + Math.sin(angle) * 8;

                context.beginPath();
                context.arc(spotX, spotY, 2, 0, Math.PI * 2);
                context.fillStyle = 'rgba(220, 220, 255, 0.9)';
                context.fill();
            }
            break;

        case 3: // Disruptor - Spiky pufferfish-like
            // Round body
            context.beginPath();
            context.arc(centerX, centerY, 14, 0, Math.PI * 2);

            // Yellow-green coloration
            gradient.addColorStop(0, 'rgba(220, 255, 150, 1)');
            gradient.addColorStop(0.4, 'rgba(180, 230, 80, 0.9)');
            gradient.addColorStop(1, 'rgba(120, 200, 40, 0)');

            context.fillStyle = gradient;
            context.fill();

            // Spikes
            for (let i = 0; i < 16; i++) {
                const angle = i * Math.PI * 2 / 16;
                const spikeLength = 6 + Math.random() * 4;

                context.beginPath();
                context.moveTo(
                    centerX + Math.cos(angle) * 14,
                    centerY + Math.sin(angle) * 14
                );
                context.lineTo(
                    centerX + Math.cos(angle) * (14 + spikeLength),
                    centerY + Math.sin(angle) * (14 + spikeLength)
                );
                context.lineWidth = 2;
                context.strokeStyle = 'rgba(255, 255, 100, 0.8)';
                context.stroke();
            }

            // Small eyes
            context.beginPath();
            context.arc(centerX + 7, centerY - 5, 2, 0, Math.PI * 2);
            context.fillStyle = 'rgba(0, 0, 0, 0.8)';
            context.fill();

            context.beginPath();
            context.arc(centerX + 7, centerY + 5, 2, 0, Math.PI * 2);
            context.fillStyle = 'rgba(0, 0, 0, 0.8)';
            context.fill();
            break;
    }

    return new THREE.CanvasTexture(canvas);
}

/**
 * Creates trailing effects for swimming motion
 * @returns {THREE.Group} Group containing water trail effects
 */
function createSwimmingTrails() {
    const trailsGroup = new THREE.Group();
    const trailCount = 15;

    for (let i = 0; i < trailCount; i++) {
        // Create trail line for swimming motion
        const points = [];
        const segments = 8;
        const trailLength = 10;

        // Starting point
        points.push(new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4
        ));

        // Create curvy path for trail
        for (let j = 1; j < segments; j++) {
            const segmentLength = (j / segments) * trailLength;

            // Add wave-like pattern to trail
            const waveAmplitude = 0.3 * (1 - j / segments); // Diminishing amplitude
            const prevPoint = points[j - 1];

            points.push(new THREE.Vector3(
                prevPoint.x - 0.5 - Math.random() * 0.5 + Math.sin(j) * waveAmplitude,
                prevPoint.y + (Math.random() - 0.5) * 0.3 + Math.sin(j * 1.5) * waveAmplitude,
                prevPoint.z + (Math.random() - 0.5) * 0.3 + Math.sin(j * 0.7) * waveAmplitude
            ));
        }

        // Create geometry from points
        const trailGeometry = new THREE.BufferGeometry().setFromPoints(points);

        // Material with water-like effect
        const trailMaterial = new THREE.LineBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.5
        });

        const trail = new THREE.Line(trailGeometry, trailMaterial);
        trailsGroup.add(trail);

        // Store animation data
        trail.userData = {
            lifespan: 0.4 + Math.random() * 0.3,  // Short lifespan for water trails
            age: 0,
            active: Math.random() > 0.5,
            points: points
        };
    }

    return trailsGroup;
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
 * @param {number} count - Number of creatures in the swarm
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
 * Setup function to initialize Swimming Swarms in a clustered formation
 * @param {Object} playerEntity - Reference to player entity for targeting
 * @returns {Array} Array of created swarms
 */
export function setupSwimmingSwarms(playerEntity) {
    // Store player reference for targeting
    targetEntity = playerEntity;

    // Also directly reference boat for more intelligent tracking
    if (!boat) {
        console.warn("Boat reference not found for swarm targeting");
    }

    // Clear existing swarms if any
    swarms = [];

    // Create a central spawn point for the cluster
    const clusterCenter = new THREE.Vector3(
        (Math.random() - 0.5) * 800,
        -120 + Math.random() * 40, // Underwater
        (Math.random() - 0.5) * 800
    );

    // Define number of swarms to create in the cluster
    const swarmCount = 10; // Fixed number of swarms in a cluster

    // Create swarms in a tight cluster
    for (let i = 0; i < swarmCount; i++) {
        // Calculate position offset from cluster center
        // Small random offsets to keep them close but not exactly in the same spot
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 60,  // 60 units of spread in X
            (Math.random() - 0.5) * 30,  // 30 units of spread in Y
            (Math.random() - 0.5) * 60   // 60 units of spread in Z
        );

        // Create spawn position near cluster center
        const spawnPosition = new THREE.Vector3().addVectors(clusterCenter, offset);

        // Create swarm at this position
        createSwimmingSwarm(spawnPosition);
    }

    return swarms;
}

/**
 * Main update function for all Swimming Swarms
 * @param {number} deltaTime - Time since last frame in seconds
 */
export function updateSwimmingSwarms(deltaTime) {
    const time = getTime() / 1000; // Convert to seconds

    // Update each swarm
    swarms.forEach((swarm, index) => {
        // Skip if being removed
        if (swarm.state === SWARM_STATE.DISSIPATING && swarm.health <= 0) {
            return;
        }

        // Update state timer
        swarm.stateTimer -= deltaTime;

        // Update formation change timer
        swarm.formationChangeTimer -= deltaTime;

        // Apply intelligent targeting to track the player
        updateIntelligentTargeting(swarm, deltaTime);

        // Handle state transitions
        handleStateTransitions(swarm, deltaTime);

        // Process current state
        switch (swarm.state) {
            case SWARM_STATE.DORMANT:
                updateDormantSwarm(swarm, deltaTime);
                break;
            case SWARM_STATE.GATHERING:
                updateGatheringSwarm(swarm, deltaTime);
                break;
            case SWARM_STATE.SEARCHING:
                updateSearchingSwarm(swarm, deltaTime);
                break;
            case SWARM_STATE.PURSUING:
                updatePursuingSwarm(swarm, deltaTime);
                break;
            case SWARM_STATE.ATTACKING:
                updateAttackingSwarm(swarm, deltaTime);
                break;
            case SWARM_STATE.REFORMING:
                updateReformingSwarm(swarm, deltaTime);
                break;
            case SWARM_STATE.FLEEING:
                updateFleeingSwarm(swarm, deltaTime);
                break;
            case SWARM_STATE.DISSIPATING:
                updateDissipatingSwarm(swarm, deltaTime);
                break;
        }

        // Apply swarm group velocity
        swarm.swarmGroup.position.add(swarm.velocity);

        // Update formation if transitioning
        if (swarm.formation !== swarm.targetFormation) {
            updateFormationTransition(swarm, deltaTime);
        }

        // Update individual unit positions and behavior (boids algorithm)
        updateSwarmUnits(swarm, deltaTime, time);

        // Update visual effects
        updateSwarmEffects(swarm, deltaTime, time);

        // Keep within world bounds
        keepSwarmInWorld(swarm);

        // Update materials uniform time values
        if (swarm.particleSystem.material.uniforms.time) {
            swarm.particleSystem.material.uniforms.time.value = time;
        }

        if (swarm.bubbles.children[0] &&
            swarm.bubbles.children[0].material.uniforms.time) {
            swarm.bubbles.children[0].material.uniforms.time.value = time;
        }

        // Update physical features
        if (swarm.features) {
            updatePhysicalFeatures(swarm, deltaTime, time);
        }
    });

    // Remove any swarms marked for removal
    swarms = swarms.filter(swarm => {
        if (swarm.state === SWARM_STATE.DISSIPATING && swarm.health <= 0 && swarm.stateTimer <= 0) {
            scene.remove(swarm.swarmGroup);
            return false;
        }
        return true;
    });
}

/**
 * Handles state transitions based on current state and conditions
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 */
function handleStateTransitions(swarm, deltaTime) {
    const currentState = swarm.state;

    // Save previous state before any transitions
    if (swarm.previousState !== currentState) {
        swarm.previousState = currentState;
    }

    // Check if player is in detection range
    let distanceToTarget = Number.MAX_VALUE;
    if (targetEntity) {
        distanceToTarget = swarm.swarmGroup.position.distanceTo(targetEntity.position);
    }

    // Handle transitions based on current state
    switch (currentState) {
        case SWARM_STATE.DORMANT:
            // Wake up if timer expires or target is close
            if (swarm.stateTimer <= 0 ||
                (targetEntity && distanceToTarget < SWARM_CONFIG.DETECTION_RANGE)) {
                swarm.state = SWARM_STATE.GATHERING;
                swarm.stateTimer = 5 + Math.random() * 3;
            }
            break;

        case SWARM_STATE.GATHERING:
            // After gathering, start searching
            if (swarm.stateTimer <= 0) {
                swarm.state = SWARM_STATE.SEARCHING;
                swarm.stateTimer = 15 + Math.random() * 10;
            }
            break;

        case SWARM_STATE.SEARCHING:
            // If target detected, start pursuing
            if (targetEntity && distanceToTarget < SWARM_CONFIG.DETECTION_RANGE) {
                swarm.state = SWARM_STATE.PURSUING;
                swarm.stateTimer = 10 + Math.random() * 5;
            }
            // If search timer expires, go back to dormant
            else if (swarm.stateTimer <= 0) {
                swarm.state = SWARM_STATE.DORMANT;
                swarm.stateTimer = 20 + Math.random() * 10;
            }
            break;

        case SWARM_STATE.PURSUING:
            // If close enough to target, start attacking
            if (targetEntity && distanceToTarget < SWARM_CONFIG.ATTACK_RANGE) {
                swarm.state = SWARM_STATE.ATTACKING;
                swarm.stateTimer = 15 + Math.random() * 5;
            }
            // If target too far away, go back to searching
            else if (!targetEntity || distanceToTarget > SWARM_CONFIG.DETECTION_RANGE * 1.5) {
                swarm.state = SWARM_STATE.SEARCHING;
                swarm.stateTimer = 15 + Math.random() * 5;
            }
            break;

        case SWARM_STATE.ATTACKING:
            // If target moves out of range, go back to pursuing
            if (!targetEntity || distanceToTarget > SWARM_CONFIG.ATTACK_RANGE * 1.2) {
                swarm.state = SWARM_STATE.PURSUING;
                swarm.stateTimer = 10 + Math.random() * 5;
            }

            // If health gets low, consider fleeing
            if (swarm.health < swarm.maxHealth * 0.3 && Math.random() < 0.1) {
                swarm.state = SWARM_STATE.FLEEING;
                swarm.stateTimer = 8 + Math.random() * 4;
            }
            break;

        case SWARM_STATE.REFORMING:
            // After reforming, go back to previous state or searching
            if (swarm.stateTimer <= 0) {
                if (swarm.previousState === SWARM_STATE.ATTACKING &&
                    targetEntity &&
                    distanceToTarget < SWARM_CONFIG.ATTACK_RANGE) {
                    swarm.state = SWARM_STATE.ATTACKING;
                } else if (swarm.previousState === SWARM_STATE.PURSUING &&
                    targetEntity &&
                    distanceToTarget < SWARM_CONFIG.DETECTION_RANGE) {
                    swarm.state = SWARM_STATE.PURSUING;
                } else {
                    swarm.state = SWARM_STATE.SEARCHING;
                }
                swarm.stateTimer = 10 + Math.random() * 5;
            }
            break;

        case SWARM_STATE.FLEEING:
            // After fleeing, reform and heal
            if (swarm.stateTimer <= 0) {
                swarm.state = SWARM_STATE.REFORMING;
                swarm.stateTimer = 8 + Math.random() * 4;
                // Recover some health while reforming
                swarm.health = Math.min(swarm.maxHealth,
                    swarm.health + swarm.maxHealth * 0.3);
            }
            break;

        case SWARM_STATE.DISSIPATING:
            // No state transitions when dissipating - handled in main update loop
            break;
    }

    // Periodically change formation based on state and timer
    if (swarm.formationChangeTimer <= 0 &&
        swarm.state !== SWARM_STATE.DORMANT &&
        swarm.state !== SWARM_STATE.DISSIPATING) {

        // Select new formation based on current state
        selectNewFormation(swarm);
        swarm.formationChangeTimer = SWARM_CONFIG.FORMATION_CHANGE_TIME + Math.random() * 5;
    }
}

/**
 * Updates swarm in dormant state - minimal movement, low energy
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 */
function updateDormantSwarm(swarm, deltaTime) {
    // Minimal random movement
    swarm.velocity.x = Math.sin(getTime() * 0.001) * 0.02;
    swarm.velocity.z = Math.cos(getTime() * 0.001) * 0.02;
    swarm.velocity.y = Math.sin(getTime() * 0.0005) * 0.01;

    // Dormant swarms use cloud formation
    swarm.targetFormation = SWARM_FORMATION.CLOUD;
}

/**
 * Updates swarm in gathering state - units coming together
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 */
function updateGatheringSwarm(swarm, deltaTime) {
    // Slow movement while gathering
    swarm.velocity.x = Math.sin(getTime() * 0.002) * 0.05;
    swarm.velocity.z = Math.cos(getTime() * 0.002) * 0.05;
    swarm.velocity.y = Math.sin(getTime() * 0.001) * 0.03;

    // Gathered swarms use sphere formation
    swarm.targetFormation = SWARM_FORMATION.SPHERE;
}

/**
 * Updates swarm in searching state - wider movement pattern looking for targets
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 */
function updateSearchingSwarm(swarm, deltaTime) {
    // More active searching behavior
    const time = getTime() * 0.001;
    const speed = SWARM_CONFIG.BASE_SPEED * 0.7;

    // Complex movement pattern
    swarm.velocity.x = Math.sin(time) * Math.cos(time * 0.7) * speed;
    swarm.velocity.z = Math.cos(time) * Math.sin(time * 0.6) * speed;
    swarm.velocity.y = Math.sin(time * 0.5) * 0.05; // Small vertical movement

    // Searching swarms switch between formations
    if (swarm.formationChangeTimer <= 0) {
        // Choose between wave and cloud for searching
        swarm.targetFormation = Math.random() < 0.5 ?
            SWARM_FORMATION.WAVE : SWARM_FORMATION.CLOUD;
    }
}

/**
 * Updates swarm in pursuing state - moving toward target
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 */
function updatePursuingSwarm(swarm, deltaTime) {
    if (!targetEntity) return;

    // Calculate direction to target
    const directionToTarget = new THREE.Vector3()
        .subVectors(targetEntity.position, swarm.swarmGroup.position)
        .normalize();

    // Set velocity toward target with pursuit speed multiplier
    swarm.velocity.copy(
        directionToTarget.multiplyScalar(SWARM_CONFIG.BASE_SPEED *
            SWARM_CONFIG.PURSUIT_SPEED_MULTIPLIER)
    );

    // Add slight vertical movement based on sine wave
    swarm.velocity.y += Math.sin(getTime() * 0.003) * 0.02;

    // Pursuing swarms use more aggressive formations
    if (swarm.formationChangeTimer <= 0) {
        const formations = [
            SWARM_FORMATION.VORTEX,
            SWARM_FORMATION.FUNNEL,
            SWARM_FORMATION.SPIRAL
        ];
        swarm.targetFormation = formations[Math.floor(Math.random() * formations.length)];
    }
}

/**
 * Update attacking swarm with coordinated role-based attack patterns
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 */
function updateAttackingSwarm(swarm, deltaTime) {
    if (!targetEntity) return;

    // Calculate distance and direction to target
    const vectorToTarget = new THREE.Vector3()
        .subVectors(targetEntity.position, swarm.swarmGroup.position);
    const distanceToTarget = vectorToTarget.length();
    const directionToTarget = vectorToTarget.normalize();

    // Different attack patterns based on current formation
    switch (swarm.formation) {
        case SWARM_FORMATION.FUNNEL:
            // Coordinated spear attack
            swarm.velocity.copy(
                directionToTarget.multiplyScalar(SWARM_CONFIG.BASE_SPEED * 2.5)
            );
            break;

        case SWARM_FORMATION.VORTEX:
            // Circling attack with role-based positions
            const orbitSpeed = SWARM_CONFIG.BASE_SPEED * 1.8;
            const orbitRadius = SWARM_CONFIG.ATTACK_RANGE * 0.4;

            // Calculate orbit position
            const orbitAngle = getTime() * 0.003;
            const orbitTarget = new THREE.Vector3(
                targetEntity.position.x + Math.cos(orbitAngle) * orbitRadius,
                targetEntity.position.y,
                targetEntity.position.z + Math.sin(orbitAngle) * orbitRadius
            );

            // Move toward orbit position
            const orbitDirection = new THREE.Vector3()
                .subVectors(orbitTarget, swarm.swarmGroup.position)
                .normalize();

            swarm.velocity.copy(orbitDirection.multiplyScalar(orbitSpeed));
            break;

        case SWARM_FORMATION.NET:
            // Surround target and coordinate by roles
            if (distanceToTarget > SWARM_CONFIG.ATTACK_RANGE * 0.25) {
                // Approach target
                swarm.velocity.copy(
                    directionToTarget.multiplyScalar(SWARM_CONFIG.BASE_SPEED)
                );
            } else {
                // When close, circle and attack
                const circleDirection = new THREE.Vector3(
                    -directionToTarget.z,
                    0,
                    directionToTarget.x
                ).normalize();

                swarm.velocity.copy(
                    circleDirection.multiplyScalar(SWARM_CONFIG.BASE_SPEED * 0.5)
                );

                // Periodically send units to attack
                coordSendUnitsTotarget(swarm);
            }
            break;

        case SWARM_FORMATION.SPIRAL:
            // Dynamic spiral attack with waves of attackers
            const time = getTime() * 0.001;
            const attackInterval = Math.sin(time * 2);

            if (attackInterval > 0.7) {
                // Rush forward periodically
                swarm.velocity.copy(
                    directionToTarget.multiplyScalar(SWARM_CONFIG.BASE_SPEED * 3.0)
                );
            } else {
                // Circle when not rushing
                const circleDir = new THREE.Vector3(
                    -directionToTarget.z,
                    directionToTarget.y * 0.2,
                    directionToTarget.x
                ).normalize();

                swarm.velocity.copy(
                    circleDir.multiplyScalar(SWARM_CONFIG.BASE_SPEED * 1.2)
                );
            }
            break;

        default:
            // Default attack with role specialization
            swarm.velocity.copy(
                directionToTarget.multiplyScalar(SWARM_CONFIG.BASE_SPEED * 1.5)
            );
            break;
    }

    // Check if we need to perform damage to target
    const currentTime = getTime() / 1000;
    if (distanceToTarget < SWARM_CONFIG.ATTACK_RANGE * 0.5 &&
        currentTime - swarm.lastAttackTime > 1.0) {

        // Simulate attack with coordinated visuals
        swarm.lastAttackTime = currentTime;

        // Generate attack effect
        createAttackEffect(swarm);
    }

    // Attacking swarms cycle through aggressive formations
    if (swarm.formationChangeTimer <= 0) {
        const formations = [
            SWARM_FORMATION.FUNNEL,
            SWARM_FORMATION.VORTEX,
            SWARM_FORMATION.SPIRAL,
            SWARM_FORMATION.NET
        ];
        swarm.targetFormation = formations[Math.floor(Math.random() * formations.length)];
    }
}

/**
 * Sends units toward target in a coordinated manner
 */
function coordSendUnitsTotarget(swarm) {
    const time = getTime() * 0.001;
    const positions = swarm.unitPositions;
    const velocities = swarm.boidData.velocities;
    const types = swarm.particleSystem.geometry.attributes.type.array;

    // Get the direction to the target
    const toTarget = new THREE.Vector3()
        .subVectors(targetEntity.position, swarm.swarmGroup.position)
        .normalize();

    // Only send attackers (type 1) toward target
    for (let i = 0; i < SWARM_CONFIG.UNIT_COUNT; i++) {
        // Check if this is an attacker
        if (Math.floor(types[i]) === 1) {
            // Only send some attackers based on time
            if (Math.sin(time * 2 + i * 0.1) > 0.7) {
                const i3 = i * 3;

                // Add velocity toward target
                velocities[i3] += toTarget.x * 0.1;
                velocities[i3 + 1] += toTarget.y * 0.1;
                velocities[i3 + 2] += toTarget.z * 0.1;
            }
        }
    }
}

/**
 * Creates a visual effect for attacks
 * @param {Object} swarm - The swarm performing the attack
 */
function createAttackEffect(swarm) {
    // Create ripple wave in water
    const rippleGeometry = new THREE.RingGeometry(0.5, 1.5, 32);
    const rippleMaterial = new THREE.MeshBasicMaterial({
        color: 0x88bbff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });

    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
    ripple.position.copy(swarm.swarmGroup.position);
    ripple.rotation.x = Math.PI / 2; // Make it horizontal
    scene.add(ripple);

    // Create bubble burst effect
    const burstCount = 30;
    const burstGeometry = new THREE.BufferGeometry();
    const burstPositions = new Float32Array(burstCount * 3);
    const burstSizes = new Float32Array(burstCount);

    for (let i = 0; i < burstCount; i++) {
        const i3 = i * 3;
        // Start at center
        burstPositions[i3] = 0;
        burstPositions[i3 + 1] = 0;
        burstPositions[i3 + 2] = 0;

        burstSizes[i] = 0.3 + Math.random() * 0.5;
    }

    burstGeometry.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3));
    burstGeometry.setAttribute('size', new THREE.BufferAttribute(burstSizes, 1));

    const burstMaterial = new THREE.PointsMaterial({
        color: 0xaaddff,
        size: 1.0,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
    });

    const burstParticles = new THREE.Points(burstGeometry, burstMaterial);
    swarm.swarmGroup.add(burstParticles);

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
    const burstDuration = 1.5; // seconds

    function animateBurst() {
        const elapsed = (getTime() - startTime) / 1000;
        const progress = elapsed / burstDuration;

        if (progress >= 1.0) {
            // Remove burst when animation completes
            swarm.swarmGroup.remove(burstParticles);
            return;
        }

        // Update particle positions
        for (let i = 0; i < burstCount; i++) {
            const i3 = i * 3;

            // Move particles outward
            burstPositions[i3] += velocities[i].x * 0.1;
            burstPositions[i3 + 1] += velocities[i].y * 0.1;
            burstPositions[i3 + 2] += velocities[i].z * 0.1;

            // Slow down over time with drag in water
            velocities[i].multiplyScalar(0.96);
        }

        // Update opacity - blood disperses in water
        burstMaterial.opacity = 0.8 * (1 - progress);

        // Change color slightly as it disperses
        const hue = 0.05 * progress; // Slightly shift from red
        burstMaterial.color.setHSL(hue, 0.9, 0.5);

        // Update geometry
        burstGeometry.attributes.position.needsUpdate = true;

        // Continue animation
        requestAnimationFrame(animateBurst);
    }

    // Start animation
    animateBurst();
}

/**
 * Updates swarm in reforming state - regrouping after taking damage
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 */
function updateReformingSwarm(swarm, deltaTime) {
    // Minimal movement while reforming
    swarm.velocity.x = Math.sin(getTime() * 0.0015) * 0.03;
    swarm.velocity.z = Math.cos(getTime() * 0.0015) * 0.03;
    swarm.velocity.y = Math.sin(getTime() * 0.001) * 0.02;

    // Reforming uses sphere formation for protection
    swarm.targetFormation = SWARM_FORMATION.SPHERE;

    // Slowly regenerate health while reforming
    if (swarm.health < swarm.maxHealth) {
        swarm.health += (swarm.maxHealth * 0.05) * deltaTime;
        swarm.health = Math.min(swarm.health, swarm.maxHealth);
    }
}

/**
 * Updates swarm in fleeing state - retreating from danger
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 */
function updateFleeingSwarm(swarm, deltaTime) {
    // If target exists, move away from it
    if (targetEntity) {
        // Get direction away from target
        const fleeDirection = new THREE.Vector3()
            .subVectors(swarm.swarmGroup.position, targetEntity.position)
            .normalize();

        // Set velocity away from target with high speed
        swarm.velocity.copy(
            fleeDirection.multiplyScalar(SWARM_CONFIG.BASE_SPEED * 2.0)
        );
    } else {
        // No target, just move randomly but quickly
        const time = getTime() * 0.001;
        const speed = SWARM_CONFIG.BASE_SPEED * 1.5;

        swarm.velocity.x = Math.sin(time * 1.1) * speed;
        swarm.velocity.z = Math.cos(time * 0.9) * speed;
        swarm.velocity.y = Math.sin(time * 0.7) * speed * 0.5;
    }

    // Fleeing swarms use cloud or sphere formations for protection
    if (swarm.formationChangeTimer <= 0) {
        swarm.targetFormation = Math.random() < 0.7 ?
            SWARM_FORMATION.CLOUD : SWARM_FORMATION.SPHERE;
    }
}

/**
 * Updates swarm in dissipating state - breaking apart and dying
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 */
function updateDissipatingSwarm(swarm, deltaTime) {
    // Slow all movement down
    swarm.velocity.multiplyScalar(0.95);

    // Calculate dissipation progress
    const progress = 1 - (swarm.stateTimer / 5.0); // Assuming 5s dissipation time

    // Gradually spread out and fade the particles
    const positions = swarm.unitPositions;
    const colors = swarm.unitColors;
    const particleCount = SWARM_CONFIG.UNIT_COUNT;

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
    swarm.particleSystem.geometry.attributes.position.needsUpdate = true;
    swarm.particleSystem.geometry.attributes.color.needsUpdate = true;

    // Shrink the alpha creature
    swarm.alpha.scale.multiplyScalar(0.98);

    // Reduce health to zero
    swarm.health = Math.max(0, swarm.health - (swarm.maxHealth * 0.2 * deltaTime));
}

/**
 * Updates individual swarm units using boid flocking algorithm
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 * @param {number} time - Current game time
 */
function updateSwarmUnits(swarm, deltaTime, time) {
    const positions = swarm.unitPositions;
    const rotations = swarm.unitRotations;
    const particleCount = SWARM_CONFIG.UNIT_COUNT;
    const boidData = swarm.boidData;
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
    const targetPositions = calculateFormationPositions(swarm);

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
                .multiplyScalar(SWARM_CONFIG.SWARM_COHESION);

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

            if (distance < SWARM_CONFIG.BOID_NEIGHBOR_RADIUS) {
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
            separationForce.multiplyScalar(SWARM_CONFIG.SWARM_SEPARATION);

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

            if (distance < SWARM_CONFIG.BOID_NEIGHBOR_RADIUS * 2) {
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
            alignmentForce.multiplyScalar(SWARM_CONFIG.SWARM_ALIGNMENT);

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

        // Update rotation angle to face the direction of movement
        if (speed > 0.01) {
            rotations[i] = Math.atan2(velocities[i3], velocities[i3 + 2]);
        }
    }

    // Update the geometry
    swarm.particleSystem.geometry.attributes.position.needsUpdate = true;
    swarm.particleSystem.geometry.attributes.rotation.needsUpdate = true;
}

/**
 * Calculates positions for each unit based on the current formation
 * @param {Object} swarm - The swarm to calculate for
 * @returns {Array} Array of Vector3 positions for each unit
 */
function calculateFormationPositions(swarm) {
    const positions = [];
    const particleCount = SWARM_CONFIG.UNIT_COUNT;
    const formation = swarm.formation;
    const time = getTime() * 0.001;

    for (let i = 0; i < particleCount; i++) {
        let position = new THREE.Vector3();

        // Golden spiral distribution for most even coverage of a sphere
        const phi = Math.acos(1 - 2 * (i / particleCount));
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;

        // Base formation radius
        let radius = 15;

        switch (formation) {
            case SWARM_FORMATION.CLOUD:
                // Random cloud with Gaussian-like distribution
                radius = 20 * (0.5 + Math.random() * 0.5);
                position.x = (Math.random() - 0.5) * radius;
                position.y = (Math.random() - 0.5) * radius;
                position.z = (Math.random() - 0.5) * radius;
                break;

            case SWARM_FORMATION.SPHERE:
                // Even distribution on sphere surface
                position.x = radius * Math.sin(phi) * Math.cos(theta);
                position.y = radius * Math.sin(phi) * Math.sin(theta);
                position.z = radius * Math.cos(phi);
                break;

            case SWARM_FORMATION.VORTEX:
                // Spiral vortex formation
                const heightFactor = (i / particleCount) * 30 - 15; // -15 to 15 range
                const spiralRadius = 10 + 5 * Math.sin(i / 100);
                const angle = theta + time * 2;

                position.x = spiralRadius * Math.cos(angle);
                position.y = heightFactor;
                position.z = spiralRadius * Math.sin(angle);
                break;

            case SWARM_FORMATION.WAVE:
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

            case SWARM_FORMATION.FUNNEL:
                // Concentrated point formation like funnel or school of fish
                const funnelProgress = i / particleCount;
                const funnelRadius = 3 + 15 * (1 - funnelProgress);
                const funnelAngle = theta + time * 3;
                const funnelHeight = -15 + funnelProgress * 30;

                position.x = funnelRadius * Math.cos(funnelAngle);
                position.y = funnelHeight;
                position.z = funnelRadius * Math.sin(funnelAngle);
                break;

            case SWARM_FORMATION.WALL:
                // Flat wall formation like fish school
                const wallWidth = 30;
                const wallHeight = 20;

                position.x = (i % 100) / 100 * wallWidth - wallWidth / 2;
                position.y = (Math.floor(i / 100) / (particleCount / 100)) * wallHeight - wallHeight / 2;
                position.z = 2 * Math.sin(position.x * 0.2 + position.y * 0.3 + time * 2);
                break;

            case SWARM_FORMATION.SPIRAL:
                // Rotating spiral with multiple arms
                const armCount = 5;
                const arm = i % armCount;
                const armOffset = (arm / armCount) * Math.PI * 2;
                const distFromCenter = 5 + (Math.floor(i / armCount) / (particleCount / armCount)) * 15;
                const spiralAngle = distFromCenter * 0.2 + time * 2 + armOffset;

                position.x = distFromCenter * Math.cos(spiralAngle);
                position.y = (i / particleCount - 0.5) * 15; // Distribute along y-axis
                position.z = distFromCenter * Math.sin(spiralAngle);
                break;

            case SWARM_FORMATION.NET:
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
                        .subVectors(targetEntity.position, swarm.swarmGroup.position)
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
 * Updates visual effects for the swarm
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 * @param {number} time - Current game time
 */
function updateSwarmEffects(swarm, deltaTime, time) {
    // Update alpha creature movement based on health and state
    const healthRatio = swarm.health / swarm.maxHealth;

    // Alpha creature swims with undulating motion
    const swimSpeed = 2 + (swarm.state === SWARM_STATE.ATTACKING ? 4 : 0);
    const swimAmount = 0.1 + (swarm.state === SWARM_STATE.PURSUING ? 0.15 : 0);

    // Scale the alpha fish based on health
    const baseScale = 0.8 * healthRatio + 0.2; // 0.2-1.0 range
    swarm.alpha.scale.set(
        baseScale * 1.2, // Wider
        baseScale * 0.5, // Thinner
        baseScale * 1.5  // Longer
    );

    // Undulating swim motion for alpha
    swarm.alpha.rotation.y = Math.sin(time * swimSpeed) * 0.3; // Head swings side to side
    swarm.alpha.rotation.x = Math.sin(time * swimSpeed * 0.7) * 0.1; // Small up/down pitch
    swarm.alpha.rotation.z = Math.sin(time * swimSpeed * 0.5) * 0.15; // Roll slightly

    // Adjust alpha color based on state
    switch (swarm.state) {
        case SWARM_STATE.ATTACKING:
            // More intense color when attacking
            swarm.alpha.material.color.setRGB(0.9, 0.3, 0.2); // More reddish
            swarm.alpha.material.emissive.setRGB(0.5, 0.1, 0.0);
            break;

        case SWARM_STATE.FLEEING:
            // Pale, stressed color when fleeing
            swarm.alpha.material.color.setRGB(0.5, 0.5, 0.7); // Pale blue
            swarm.alpha.material.emissive.setRGB(0.1, 0.1, 0.2);
            break;

        case SWARM_STATE.DISSIPATING:
            // Fading when dying
            swarm.alpha.material.color.setRGB(0.4, 0.4, 0.5);
            swarm.alpha.material.emissive.setRGB(0.1, 0.1, 0.1);
            swarm.alpha.material.opacity = 0.5 * (1 - time % 0.5); // Flickering fade
            break;

        default:
            // Normal swimming color
            swarm.alpha.material.color.setRGB(0.1, 0.5, 0.8); // Blue
            swarm.alpha.material.emissive.setRGB(0.0, 0.2, 0.4);
            swarm.alpha.material.opacity = 0.7 + 0.3 * Math.sin(time * 2); // Slight pulse
    }

    // Update swimming trails
    for (let i = 0; i < swarm.trails.children.length; i++) {
        const trail = swarm.trails.children[i];

        // Update trail lifecycle
        if (trail.userData.active) {
            trail.userData.age += deltaTime;

            // Trail fadeout
            if (trail.userData.age >= trail.userData.lifespan) {
                trail.userData.active = false;
                trail.visible = false;
                trail.userData.age = 0;
            } else {
                // Update trail appearance
                const lifeProgress = trail.userData.age / trail.userData.lifespan;
                trail.material.opacity = 0.5 * (1 - lifeProgress);

                // Animate trail points - add subtle wave motion
                const points = trail.userData.points;
                for (let j = 1; j < points.length; j++) {
                    // Add wave motion that progresses along trail
                    const wavePhase = time * 5 + j * 0.8;
                    const waveAmplitude = 0.1 * (1 - j / points.length);

                    points[j].y += Math.sin(wavePhase) * waveAmplitude;
                    points[j].x += Math.cos(wavePhase * 0.7) * waveAmplitude;
                }

                // Update trail geometry
                trail.geometry.setFromPoints(points);
            }
        } else {
            // Randomly activate inactive trails
            if (Math.random() < 0.05) {
                trail.userData.active = true;
                trail.visible = true;

                // Reset trail points - start from a random position within the swarm
                const startX = (Math.random() - 0.5) * 10;
                const startY = (Math.random() - 0.5) * 10;
                const startZ = (Math.random() - 0.5) * 10;

                const points = trail.userData.points;
                points[0].set(startX, startY, startZ);

                // Create wavy trail behind
                for (let j = 1; j < points.length; j++) {
                    const curveAmount = 0.2 * Math.sin(j * 0.7);
                    points[j].set(
                        startX - j * 0.5 + curveAmount,
                        startY + curveAmount,
                        startZ + curveAmount
                    );
                }

                trail.geometry.setFromPoints(points);
            }
        }
    }

    // Update physical features positions
    if (swarm.physicalFeatures) {
        updatePhysicalFeatures(swarm, time);
    }

    // Create visual connections between units to emphasize swarm behavior
    // Only do this in certain states to reduce lag
    if (swarm.state === SWARM_STATE.ATTACKING || swarm.state === SWARM_STATE.PURSUING) {
        updateSwarmConnections(swarm, time);
    } else if (swarm.connections) {
        // Remove connections when not needed
        swarm.swarmGroup.remove(swarm.connections);
        swarm.connections = null;
    }
}

/**
 * Keeps swarm within world boundaries
 * @param {Object} swarm - The swarm to check
 */
function keepSwarmInWorld(swarm) {
    const worldBounds = 2000; // World boundary limit
    const pos = swarm.swarmGroup.position;
    let bounced = false;

    // Check each dimension and bounce if needed
    if (pos.x < -worldBounds) {
        pos.x = -worldBounds;
        swarm.velocity.x *= -0.5;
        bounced = true;
    } else if (pos.x > worldBounds) {
        pos.x = worldBounds;
        swarm.velocity.x *= -0.5;
        bounced = true;
    }

    if (pos.y < -200) { // Lower underwater limit
        pos.y = -200;
        swarm.velocity.y *= -0.5;
        bounced = true;
    } else if (pos.y > 50) { // Upper water surface limit
        pos.y = 50;
        swarm.velocity.y *= -0.5;
        bounced = true;
    }

    if (pos.z < -worldBounds) {
        pos.z = -worldBounds;
        swarm.velocity.z *= -0.5;
        bounced = true;
    } else if (pos.z > worldBounds) {
        pos.z = worldBounds;
        swarm.velocity.z *= -0.5;
        bounced = true;
    }

    // If bouncing occurred, temporarily change to reforming state
    if (bounced && swarm.state !== SWARM_STATE.REFORMING &&
        swarm.state !== SWARM_STATE.DISSIPATING) {
        swarm.previousState = swarm.state;
        swarm.state = SWARM_STATE.REFORMING;
        swarm.stateTimer = 2 + Math.random();
    }
}

/**
 * Selects a new formation based on swarm state
 * @param {Object} swarm - The swarm to update
 */
function selectNewFormation(swarm) {
    const state = swarm.state;

    switch (state) {
        case SWARM_STATE.DORMANT:
            swarm.targetFormation = SWARM_FORMATION.CLOUD;
            break;

        case SWARM_STATE.GATHERING:
            swarm.targetFormation = SWARM_FORMATION.SPHERE;
            break;

        case SWARM_STATE.SEARCHING:
            // Random between cloud, wave, or sphere
            const searchFormations = [
                SWARM_FORMATION.CLOUD,
                SWARM_FORMATION.WAVE,
                SWARM_FORMATION.SPHERE
            ];
            swarm.targetFormation = searchFormations[Math.floor(Math.random() * searchFormations.length)];
            break;

        case SWARM_STATE.PURSUING:
            // More aggressive formations for pursuit
            const pursuitFormations = [
                SWARM_FORMATION.VORTEX,
                SWARM_FORMATION.FUNNEL,
                SWARM_FORMATION.SPIRAL
            ];
            swarm.targetFormation = pursuitFormations[Math.floor(Math.random() * pursuitFormations.length)];
            break;

        case SWARM_STATE.ATTACKING:
            // Attack-oriented formations
            const attackFormations = [
                SWARM_FORMATION.FUNNEL,
                SWARM_FORMATION.VORTEX,
                SWARM_FORMATION.SPIRAL,
                SWARM_FORMATION.NET
            ];
            swarm.targetFormation = attackFormations[Math.floor(Math.random() * attackFormations.length)];
            break;

        case SWARM_STATE.REFORMING:
            // Defensive formations for reforming
            swarm.targetFormation = SWARM_FORMATION.SPHERE;
            break;

        case SWARM_STATE.FLEEING:
            // Defensive or fast formations for fleeing
            swarm.targetFormation = Math.random() < 0.7 ?
                SWARM_FORMATION.CLOUD : SWARM_FORMATION.SPHERE;
            break;

        case SWARM_STATE.DISSIPATING:
            // Always cloud formation when dissipating
            swarm.targetFormation = SWARM_FORMATION.CLOUD;
            break;
    }
}

/**
 * Updates formation when transitioning between formations
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 */
function updateFormationTransition(swarm, deltaTime) {
    // Transition speed depends on state
    let transitionSpeed = 0.5; // Default transition speed

    switch (swarm.state) {
        case SWARM_STATE.ATTACKING:
            transitionSpeed = 2.0; // Fast transitions during attack
            break;
        case SWARM_STATE.REFORMING:
            transitionSpeed = 0.3; // Slow, deliberate transitions when reforming
            break;
        case SWARM_STATE.FLEEING:
            transitionSpeed = 1.5; // Fast transitions when fleeing
            break;
    }

    // Progress the transition
    swarm.formationBlend += transitionSpeed * deltaTime;

    // Complete transition
    if (swarm.formationBlend >= 1.0) {
        swarm.formation = swarm.targetFormation;
        swarm.formationBlend = 1.0;
    }
}

/**
 * Handles damage to a swarm
 * @param {Object} swarm - The swarm that was damaged
 * @param {number} amount - Amount of damage to apply
 */
export function damageSwarm(swarm, amount) {
    // Apply damage
    swarm.health -= amount;

    // Check if the swarm should die
    if (swarm.health <= 0) {
        // Transition to dissipating state
        swarm.previousState = swarm.state;
        swarm.state = SWARM_STATE.DISSIPATING;
        swarm.stateTimer = 5.0; // Give 5 seconds for death animation
        return;
    }

    // For significant damage, transition to reforming state
    if (amount > 10 && swarm.state !== SWARM_STATE.REFORMING) {
        swarm.previousState = swarm.state;
        swarm.state = SWARM_STATE.REFORMING;
        swarm.stateTimer = 3 + Math.random() * 2;
    }

    // Create damage effect
    createDamageEffect(swarm);
}

/**
 * Creates visual effect for damage
 * @param {Object} swarm - The damaged swarm
 */
function createDamageEffect(swarm) {
    // Create particle burst for damage
    const burstCount = 25;
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

    // Burst material - blood in water effect
    const burstMaterial = new THREE.PointsMaterial({
        color: 0xdd3333,
        size: 1.0,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    const burstParticles = new THREE.Points(burstGeometry, burstMaterial);
    swarm.swarmGroup.add(burstParticles);

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
    const burstDuration = 1.5; // seconds

    function animateBurst() {
        const elapsed = (getTime() - startTime) / 1000;
        const progress = elapsed / burstDuration;

        if (progress >= 1.0) {
            // Remove burst when animation completes
            swarm.swarmGroup.remove(burstParticles);
            return;
        }

        // Update particle positions
        for (let i = 0; i < burstCount; i++) {
            const i3 = i * 3;

            // Move particles outward
            burstPositions[i3] += velocities[i].x * 0.1;
            burstPositions[i3 + 1] += velocities[i].y * 0.1;
            burstPositions[i3 + 2] += velocities[i].z * 0.1;

            // Slow down over time with drag in water
            velocities[i].multiplyScalar(0.96);
        }

        // Update opacity - blood disperses in water
        burstMaterial.opacity = 0.8 * (1 - progress);

        // Change color slightly as it disperses
        const hue = 0.05 * progress; // Slightly shift from red
        burstMaterial.color.setHSL(hue, 0.9, 0.5);

        // Update geometry
        burstGeometry.attributes.position.needsUpdate = true;

        // Continue animation
        requestAnimationFrame(animateBurst);
    }

    // Start animation
    animateBurst();
}

/**
 * Create visual connections between units to emphasize swarm behavior
 * @param {Object} swarm - The swarm to update
 * @param {number} time - Current game time
 */
function updateSwarmConnections(swarm, time) {
    // Remove existing connections if any
    if (swarm.connections) {
        swarm.swarmGroup.remove(swarm.connections);
    }

    // Create new connections
    const connectionsGroup = new THREE.Group();

    // Only create connections when in active states and not too many swarm units
    if ((swarm.state === SWARM_STATE.ATTACKING || swarm.state === SWARM_STATE.PURSUING) &&
        swarm.state !== SWARM_STATE.DISSIPATING) {

        const positions = swarm.unitPositions;
        const colors = swarm.unitColors;
        const types = swarm.particleSystem.geometry.attributes.type.array;

        // REDUCED: Much fewer connections for better performance
        const maxConnections = 100; // Reduced from 300
        const connectionCount = Math.min(maxConnections, SWARM_CONFIG.UNIT_COUNT);
        const maxDistance = 10; // Shorter connection distance

        // Create connection instances
        const connections = [];
        let current = 0;

        // Connect only important units (every 5th unit) to reduce calculations
        for (let type = 0; type < 4; type++) {
            // Find units of this type
            const sameTypeUnits = [];
            for (let i = 0; i < SWARM_CONFIG.UNIT_COUNT; i += 5) { // Sample fewer units
                if (Math.floor(types[i]) === type) {
                    sameTypeUnits.push(i);
                }
            }

            // Only process a subset of connections
            for (let i = 0; i < sameTypeUnits.length && current < connectionCount; i += 2) {
                // ... rest of the function remains similar but will create fewer connections
                // ... existing connection code
            }
        }

        // ... rest of the function
    }

    // Add to swarm group
    swarm.connections = connectionsGroup;
    swarm.swarmGroup.add(connectionsGroup);
}

/**
 * Add physical features to swarm units
 * @param {Object} swarm - The swarm to update
 */
function addPhysicalFeatures(swarm) {
    const particleCount = SWARM_CONFIG.UNIT_COUNT;
    const positions = swarm.unitPositions;
    const types = swarm.particleSystem.geometry.attributes.type.array;
    const physicalFeaturesGroup = new THREE.Group();

    // Create fewer physical features for performance (one per 20 particles)
    const featureCount = Math.min(50, Math.floor(particleCount / 20));

    for (let i = 0; i < featureCount; i++) {
        // Get a random unit index
        const unitIndex = Math.floor(Math.random() * particleCount);
        const i3 = unitIndex * 3;
        const type = Math.floor(types[unitIndex]);

        // Position for the physical feature
        const position = new THREE.Vector3(
            positions[i3],
            positions[i3 + 1],
            positions[i3 + 2]
        );

        // Create different features based on creature type
        let feature;

        switch (type) {
            case 0: // Scouts - Streamlined with eyes and fins
                // Eyes
                const scoutEye = new THREE.Mesh(
                    new THREE.SphereGeometry(0.8, 8, 8),
                    new THREE.MeshBasicMaterial({ color: 0xddffff })
                );
                scoutEye.position.copy(position);

                // Fin
                const scoutFin = new THREE.Mesh(
                    new THREE.ConeGeometry(0.6, 2.0, 4),
                    new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.6 })
                );
                scoutFin.rotation.set(0, 0, Math.PI / 2);
                scoutFin.position.copy(position);
                scoutFin.position.x -= 1.5;

                physicalFeaturesGroup.add(scoutEye);
                physicalFeaturesGroup.add(scoutFin);
                break;

            case 1: // Attackers - Menacing with engine-like propulsion
                // Engine
                const attackerEngine = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.8, 1.2, 2.5, 6),
                    new THREE.MeshBasicMaterial({ color: 0xff6622 })
                );
                attackerEngine.rotation.set(Math.PI / 2, 0, 0);
                attackerEngine.position.copy(position);
                attackerEngine.position.x -= 2.0;

                // Eyes (menacing)
                const attackerEye = new THREE.Mesh(
                    new THREE.SphereGeometry(0.5, 8, 8),
                    new THREE.MeshBasicMaterial({ color: 0xffff00 })
                );
                attackerEye.position.copy(position);
                attackerEye.position.y += 0.6;

                physicalFeaturesGroup.add(attackerEngine);
                physicalFeaturesGroup.add(attackerEye);
                break;

            case 2: // Support - Jellyfish with tech
                // Glowing orb
                const supportOrb = new THREE.Mesh(
                    new THREE.SphereGeometry(1.0, 8, 8),
                    new THREE.MeshBasicMaterial({
                        color: 0xcc88ff,
                        transparent: true,
                        opacity: 0.7
                    })
                );
                supportOrb.position.copy(position);

                // Tech component
                const supportTech = new THREE.Mesh(
                    new THREE.BoxGeometry(0.8, 0.8, 0.8),
                    new THREE.MeshBasicMaterial({ color: 0x8866aa })
                );
                supportTech.position.copy(position);
                supportTech.position.y += 1.5;

                physicalFeaturesGroup.add(supportOrb);
                physicalFeaturesGroup.add(supportTech);
                break;

            case 3: // Disruptors - Mechanical pufferfish
                // Central body
                const disruptorCore = new THREE.Mesh(
                    new THREE.OctahedronGeometry(1.0, 1),
                    new THREE.MeshBasicMaterial({ color: 0xaadd66 })
                );
                disruptorCore.position.copy(position);

                // Spikes (fewer, more geometric)
                for (let j = 0; j < 3; j++) {
                    const angle = j * Math.PI * 2 / 3;
                    const spike = new THREE.Mesh(
                        new THREE.ConeGeometry(0.3, 1.5, 4),
                        new THREE.MeshBasicMaterial({ color: 0xffff66 })
                    );

                    spike.position.set(
                        position.x + Math.cos(angle) * 1.3,
                        position.y + Math.sin(angle) * 1.3,
                        position.z
                    );

                    spike.lookAt(position);

                    physicalFeaturesGroup.add(spike);
                }

                physicalFeaturesGroup.add(disruptorCore);
                break;
        }
    }

    // Store reference and add to swarm
    swarm.physicalFeatures = physicalFeaturesGroup;
    swarm.swarmGroup.add(physicalFeaturesGroup);
}

/**
 * Update physical features positions
 * @param {Object} swarm - The swarm to update
 * @param {number} time - Current game time
 */
function updatePhysicalFeatures(swarm, time) {
    // Remove existing features if needed
    if (swarm.physicalFeatures && swarm.physicalFeaturesTimer <= 0) {
        swarm.swarmGroup.remove(swarm.physicalFeatures);
        addPhysicalFeatures(swarm); // Recreate with new positions
        swarm.physicalFeaturesTimer = 1.0; // Update every second
        return;
    }

    // Update timer
    swarm.physicalFeaturesTimer -= 0.016; // Approximate for 60fps

    // If being removed, don't update further
    if (swarm.state === SWARM_STATE.DISSIPATING && swarm.health <= 0) {
        if (swarm.physicalFeatures) {
            swarm.swarmGroup.remove(swarm.physicalFeatures);
            swarm.physicalFeatures = null;
        }
    }
}

/**
 * Update a swarm to intelligently target the player boat
 * @param {Object} swarm - The swarm to update
 * @param {number} deltaTime - Time since last frame
 */
function updateIntelligentTargeting(swarm, deltaTime) {
    if (!boat) return;

    // Store current player position and calculate velocity
    const playerPos = boat.position.clone();

    // Calculate distance to player
    const distanceToPlayer = swarm.swarmGroup.position.distanceTo(playerPos);

    // Basic targeting logic based on SWARM_CONFIG.INTELLIGENCE_LEVEL
    if (Math.random() < SWARM_CONFIG.INTELLIGENCE_LEVEL * deltaTime) {
        // Predict player movement based on their velocity
        if (boat.userData && boat.userData.velocity) {
            const playerVelocity = boat.userData.velocity.clone();
            const predictionTime = SWARM_CONFIG.PLAYER_PREDICTION;

            // Calculate predicted position
            const predictedPosition = playerPos.clone().add(
                playerVelocity.clone().multiplyScalar(predictionTime)
            );

            // Set as target position with some randomness
            swarm.targetPosition.copy(predictedPosition);
            swarm.targetPosition.x += (Math.random() - 0.5) * 20;
            swarm.targetPosition.z += (Math.random() - 0.5) * 20;
        } else {
            // If no velocity data, just target current position
            swarm.targetPosition.copy(playerPos);
        }
    }

    // Implement different behaviors based on state and distance
    switch (swarm.state) {
        case SWARM_STATE.SEARCHING:
            // If player is nearby but not detected yet, chance to detect based on intelligence
            if (distanceToPlayer < SWARM_CONFIG.DETECTION_RANGE &&
                Math.random() < SWARM_CONFIG.INTELLIGENCE_LEVEL * deltaTime * 5) {
                console.log("Swarm detected player!");
                swarm.state = SWARM_STATE.PURSUING;
                swarm.stateTimer = 10 + Math.random() * 5;
            }
            break;

        case SWARM_STATE.PURSUING:
            // During pursuit, occasionally flank the player instead of direct pursuit
            if (Math.random() < SWARM_CONFIG.INTELLIGENCE_LEVEL * deltaTime * 2) {
                // Calculate perpendicular direction for flanking
                const toPlayer = new THREE.Vector3().subVectors(playerPos, swarm.swarmGroup.position).normalize();
                const flankDir = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x); // Perpendicular

                // Randomly choose left or right flank
                if (Math.random() > 0.5) flankDir.negate();

                // Calculate flanking position
                const flankDist = 30 + Math.random() * 50; // Distance to flank
                const flankPos = playerPos.clone().add(flankDir.multiplyScalar(flankDist));

                // Set as target
                swarm.targetPosition.copy(flankPos);
            }
            break;

        case SWARM_STATE.ATTACKING:
            // During attack, attempt to cut off player's escape route
            if (boat.userData && boat.userData.velocity && Math.random() < SWARM_CONFIG.INTELLIGENCE_LEVEL * deltaTime) {
                const playerDir = boat.userData.velocity.clone().normalize();

                // Calculate interception point slightly ahead of player
                const interceptPoint = playerPos.clone().add(
                    playerDir.multiplyScalar(15 + Math.random() * 25)
                );

                swarm.targetPosition.copy(interceptPoint);
            }
            break;
    }

    // Implement ambush behavior - hide then suddenly attack
    if (swarm.state === SWARM_STATE.DORMANT &&
        distanceToPlayer < SWARM_CONFIG.AMBUSH_DISTANCE &&
        distanceToPlayer > SWARM_CONFIG.DETECTION_RANGE &&
        Math.random() < SWARM_CONFIG.INTELLIGENCE_LEVEL * deltaTime) {

        // Set up ambush
        console.log("Swarm setting up ambush!");
        swarm.isAmbushing = true;
        swarm.state = SWARM_STATE.GATHERING;
        swarm.targetPosition.copy(playerPos);
        swarm.stateTimer = 3 + Math.random() * 2;
    }

    // Execute ambush when player is close enough
    if (swarm.isAmbushing &&
        distanceToPlayer < SWARM_CONFIG.ATTACK_RANGE * 1.5) {

        console.log("Swarm executing ambush!");
        swarm.isAmbushing = false;
        swarm.state = SWARM_STATE.ATTACKING;
        swarm.stateTimer = 10 + Math.random() * 5;

        // Notify nearby swarms to join the attack
        notifyNearbySwarms(swarm);
    }
}

// Function to coordinate attacks between swarms
function notifyNearbySwarms(originSwarm) {
    if (!originSwarm) return;

    // Only alert if we haven't recently
    if (originSwarm.lastAlertTime &&
        getTime() - originSwarm.lastAlertTime < SWARM_CONFIG.ATTACK_COOLDOWN * 1000) {
        return;
    }

    originSwarm.lastAlertTime = getTime();

    // Check all other swarms
    for (let i = 0; i < swarms.length; i++) {
        const otherSwarm = swarms[i];

        // Skip self or dissipating swarms
        if (otherSwarm === originSwarm ||
            otherSwarm.state === SWARM_STATE.DISSIPATING) {
            continue;
        }

        // Calculate distance between swarms
        const distance = originSwarm.swarmGroup.position.distanceTo(
            otherSwarm.swarmGroup.position
        );

        // If within coordination range, alert to join attack
        if (distance < SWARM_CONFIG.COORDINATION_RADIUS) {
            console.log("Coordinating swarm attack!");

            // Transition to attacking or pursuing depending on distance to player
            if (otherSwarm.state !== SWARM_STATE.ATTACKING) {
                if (boat) {
                    const distToPlayer = otherSwarm.swarmGroup.position.distanceTo(boat.position);

                    if (distToPlayer < SWARM_CONFIG.ATTACK_RANGE) {
                        otherSwarm.state = SWARM_STATE.ATTACKING;
                        otherSwarm.stateTimer = 10 + Math.random() * 5;
                    } else {
                        otherSwarm.state = SWARM_STATE.PURSUING;
                        otherSwarm.stateTimer = 15 + Math.random() * 5;
                    }
                }
            }

            // Choose a different attack formation for coordinated attacks
            const formations = [
                SWARM_FORMATION.FUNNEL,
                SWARM_FORMATION.VORTEX,
                SWARM_FORMATION.NET,
                SWARM_FORMATION.SPIRAL
            ];

            // Force different formations for better coordination
            let formationIndex = Math.floor(Math.random() * formations.length);
            while (formations[formationIndex] === originSwarm.targetFormation) {
                formationIndex = Math.floor(Math.random() * formations.length);
            }

            otherSwarm.targetFormation = formations[formationIndex];
        }
    }
}

// Function to update the features' positions and animations
function updatePhysicalFeatures(swarm, deltaTime, time) {
    if (!swarm.features) return;

    // Update all feature positions based on unit positions
    swarm.features.children.forEach(feature => {
        const unitIndex = feature.userData.unitIndex;
        if (unitIndex !== undefined) {
            const i3 = unitIndex * 3;

            // Update position
            feature.position.set(
                swarm.unitPositions[i3],
                swarm.unitPositions[i3 + 1],
                swarm.unitPositions[i3 + 2]
            );

            // For support units, animate orbiting component
            if (feature.userData.type === 2 && feature.userData.orbiter) {
                feature.userData.time += deltaTime;
                const orbitAngle = feature.userData.time * 3;

                feature.userData.orbiter.position.set(
                    Math.cos(orbitAngle) * 0.4,
                    Math.sin(orbitAngle) * 0.4,
                    0
                );
            }

            // Update rotation to face direction of movement
            const rotY = swarm.particleSystem.geometry.attributes.rotation.array[unitIndex];
            feature.rotation.y = rotY;
        }
    });

    // Animate propeller on alpha fish
    if (swarm.alpha.children.length > 0) {
        const propeller = swarm.alpha.children[0];
        propeller.rotation.z += deltaTime * 10; // Spin based on current speed
    }
}

/**
 * Exports an API for external interaction with Swimming Swarms
 */
export default {
    createSwimmingSwarm,
    setupSwimmingSwarms,
    updateSwimmingSwarms,
    damageSwarm,
    getSwarms: () => swarms,
    SWARM_STATE,
    SWARM_FORMATION
};