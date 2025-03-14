import * as THREE from 'three';
import { boat, scene as gameScene } from '../core/gameState.js';
import { applyOutline, removeOutline } from '../theme/outlineStyles.js';

/**
 * FastShipEffect - Creates visual effects behind a ship when moving at high speed
 * Shows speed lines and particles to indicate rapid movement
 */
class FastShipEffect {
    constructor() {
        this.scene = gameScene;
        this.ship = boat;
        this.active = false;

        // Configuration
        this.maxLines = 15;          // Increased number of speed lines
        this.lineLength = 4;         // Length of speed lines
        this.lineWidth = 0.15;       // Slightly wider lines for better visibility
        this.lineFadeTime = 0.4;     // How quickly lines fade out
        this.particleCount = 30;     // Number of particles
        this.effectOffset = 1.5;     // Distance behind ship where effect starts
        this.linesPerSpawn = 3;      // Spawn multiple lines at once for better effect

        // Collections
        this.speedLines = [];
        this.particles = [];

        // Create materials with bright color for better visibility
        this.lineMaterial = new THREE.MeshBasicMaterial({
            color: 0x00FFFF, // Cyan color for better visibility 
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        this.particleMaterial = new THREE.MeshBasicMaterial({
            color: 0x87CEEB, // Sky blue
            transparent: true,
            opacity: 0.8
        });

        // Initialize speed lines and particles
        this.createSpeedLines();
        this.createParticles();

        console.log("FastShipEffect initialized with ship:", this.ship);
    }

    /**
     * Create speed lines that appear behind the ship
     */
    createSpeedLines() {
        for (let i = 0; i < this.maxLines; i++) {
            // Create line geometry
            const geometry = new THREE.PlaneGeometry(this.lineLength, this.lineWidth);

            // Create line mesh
            const line = new THREE.Mesh(geometry, this.lineMaterial.clone());
            line.material.opacity = 0; // Start invisible
            line.visible = false;
            line.name = `SpeedLine_${i}`;

            // Add to scene and collection
            this.scene.add(line);
            this.speedLines.push({
                mesh: line,
                life: 0,
                maxLife: Math.random() * 0.5 + 0.5, // Random lifespan
                active: false,
                outline: null
            });
        }
    }

    /**
     * Create particles for water spray effect
     */
    createParticles() {
        // Small sphere for water particles
        const particleGeometry = new THREE.SphereGeometry(0.08, 8, 8);

        for (let i = 0; i < this.particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, this.particleMaterial.clone());
            particle.material.opacity = 0; // Start invisible
            particle.visible = false;

            // Add to scene and collection
            this.scene.add(particle);
            this.particles.push({
                mesh: particle,
                life: 0,
                maxLife: Math.random() * 0.8 + 0.5, // Random lifespan
                velocity: new THREE.Vector3(),
                active: false
            });
        }
    }

    /**
     * Activate the speed effect
     */
    activate() {
        if (this.active) return;
        this.active = true;
        console.log("🚤 Fast ship effect activated!");
    }

    /**
     * Deactivate the speed effect
     */
    deactivate() {
        if (!this.active) return;
        this.active = false;
        console.log("🚤 Fast ship effect deactivated!");
    }

    /**
     * Spawn a new speed line
     */
    spawnSpeedLine() {
        // Spawn multiple lines at once
        for (let i = 0; i < this.linesPerSpawn; i++) {
            // Find an inactive line
            const line = this.speedLines.find(line => !line.active);
            if (!line) continue;

            // Get ship's position and orientation
            const shipPosition = this.ship.position.clone();
            const shipDirection = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.ship.rotation.y);

            // Calculate perpendicular direction for horizontal line width
            const perpDirection = new THREE.Vector3(shipDirection.z, 0, -shipDirection.x).normalize();

            // Position behind the ship
            const position = shipPosition.clone().sub(shipDirection.multiplyScalar(this.effectOffset + Math.random() * 2));
            position.y = 0.05 + Math.random() * 0.1; // Just above water with slight variation

            // Add random offset perpendicular to movement for wider spread
            position.add(perpDirection.clone().multiplyScalar((Math.random() - 0.5) * 2));

            // Set the line's position
            line.mesh.position.copy(position);

            // COMPLETELY REVISED ROTATION:
            // 1. Reset rotation to avoid accumulated errors
            line.mesh.rotation.set(0, 0, 0);

            // 2. First align with the ship's rotation
            line.mesh.rotation.y = this.ship.rotation.y;

            // 3. Rotate 90 degrees on X to make it horizontal with water
            line.mesh.rotateX(Math.PI / 2);

            // 4. Rotate 90 degrees on Z to make it perpendicular to ship's direction
            line.mesh.rotateZ(Math.PI / 2);

            // Randomize width of each line
            const lineWidth = 0.8 + Math.random() * 1.2;
            line.mesh.scale.set(lineWidth, 1, 1);

            // Apply outline to make it more visible
            if (!line.outline) {
                line.outline = applyOutline(line.mesh, {
                    scale: 3.4,
                    material: new THREE.MeshBasicMaterial({
                        color: 0x000000, // Blue outline
                        transparent: false,
                        opacity: 0.5,
                        side: THREE.BackSide
                    })
                });
            }

            // Activate the line
            line.active = true;
            line.life = 0;
            line.mesh.visible = true;
            line.mesh.material.opacity = 0.7 + Math.random() * 0.3; // Higher base opacity
        }
    }

    /**
     * Spawn a water particle
     */
    spawnParticle() {
        // Find an inactive particle
        const particle = this.particles.find(p => !p.active);
        if (!particle) return;

        // Get ship's position and orientation
        const shipPosition = this.ship.position.clone();
        const shipDirection = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.ship.rotation.y);

        // Position behind the ship
        const position = shipPosition.clone().sub(shipDirection.multiplyScalar(this.effectOffset));
        position.y = 0.05; // Just above water

        // Randomize position
        position.x += (Math.random() - 0.5) * 2;
        position.z += (Math.random() - 0.5) * 2;

        // Set position
        particle.mesh.position.copy(position);

        // Set velocity - mostly backward but with some randomness
        const velocity = shipDirection.clone().negate();
        velocity.x += (Math.random() - 0.5) * 0.5;
        velocity.z += (Math.random() - 0.5) * 0.5;
        velocity.y = Math.random() * 0.2; // Small upward component

        // Scale velocity by random amount
        velocity.multiplyScalar(Math.random() * 2 + 2);
        particle.velocity = velocity;

        // Activate particle
        particle.active = true;
        particle.life = 0;
        particle.mesh.visible = true;
        particle.mesh.material.opacity = 0.8;

        // Random size for variety
        const scale = Math.random() * 0.15 + 0.05;
        particle.mesh.scale.set(scale, scale, scale);
    }

    /**
     * Update the effect
     * @param {number} deltaTime - Time elapsed since last update
     */
    update(deltaTime) {
        // Only spawn new effects if active
        if (this.active) {
            // Spawn speed lines more frequently
            if (Math.random() < 0.5) { // Increased spawn chance
                this.spawnSpeedLine();
            }

            // Spawn particles more frequently
            if (Math.random() < 0.6) {
                this.spawnParticle();
            }
        }

        // Update active speed lines
        this.speedLines.forEach(line => {
            if (!line.active) return;

            // Update lifetime
            line.life += deltaTime;

            // Check if line should be deactivated
            if (line.life >= line.maxLife) {
                line.active = false;
                line.mesh.visible = false;

                // Remove outline when deactivating
                if (line.outline && line.outline.length > 0) {
                    removeOutline(line.mesh);
                    line.outline = null;
                }
                return;
            }

            // Fade out based on lifetime
            const lifeRatio = line.life / line.maxLife;
            line.mesh.material.opacity = 0.8 * (1 - lifeRatio);

            // Expand the line as it ages
            const scaleZ = 1 + lifeRatio * 3;
            line.mesh.scale.z = scaleZ;
        });

        // Update active particles
        this.particles.forEach(particle => {
            if (!particle.active) return;

            // Update lifetime
            particle.life += deltaTime;

            // Check if particle should be deactivated
            if (particle.life >= particle.maxLife) {
                particle.active = false;
                particle.mesh.visible = false;
                return;
            }

            // Move particle according to velocity
            particle.mesh.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

            // Apply "gravity" to make particles fall
            particle.velocity.y -= deltaTime * 2;

            // Fade out based on lifetime
            const lifeRatio = particle.life / particle.maxLife;
            particle.mesh.material.opacity = 0.8 * (1 - lifeRatio);
        });
    }

    /**
     * Clean up resources
     */
    dispose() {
        // Remove all speed lines
        this.speedLines.forEach(line => {
            // Remove outline if it exists
            if (line.outline && line.outline.length > 0) {
                removeOutline(line.mesh);
            }

            this.scene.remove(line.mesh);
            line.mesh.geometry.dispose();
            line.mesh.material.dispose();
        });

        // Remove all particles
        this.particles.forEach(particle => {
            this.scene.remove(particle.mesh);
            particle.mesh.geometry.dispose();
            particle.mesh.material.dispose();
        });

        this.speedLines = [];
        this.particles = [];
    }
}

export default FastShipEffect;