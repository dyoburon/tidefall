import * as THREE from 'three';

/**
 * Manages positional audio sources that change volume based on player distance
 */
class SpatialAudioSystem {
    constructor(camera, scene) {
        // Create an audio listener attached to the camera
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);

        // Store references to important objects
        this.scene = scene;
        this.audioSources = new Map();

        // Default settings
        this.defaultMaxDistance = 1000;
        this.defaultRefDistance = 50;
        this.defaultRolloffFactor = 1;

        console.log("🔊 Spatial Audio System initialized");
    }

    /**
     * Creates a new audio source at a specific position
     * 
     * @param {string} id - Unique identifier for this audio source
     * @param {THREE.Vector3} position - 3D position in world space
     * @param {string} soundUrl - URL to the sound file
     * @param {Object} options - Optional configuration
     * @returns {THREE.PositionalAudio} The created audio source
     */
    createAudioSource(id, position, soundUrl, options = {}) {
        // Create options with defaults
        const config = {
            loop: options.loop !== undefined ? options.loop : true,
            volume: options.volume !== undefined ? options.volume : 1.0,
            maxDistance: options.maxDistance || this.defaultMaxDistance,
            refDistance: options.refDistance || this.defaultRefDistance,
            rolloffFactor: options.rolloffFactor || this.defaultRolloffFactor,
            autoplay: options.autoplay !== undefined ? options.autoplay : true
        };

        // Create a positional audio source
        const sound = new THREE.PositionalAudio(this.listener);

        // Create a sphere to represent the audio source position
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(5, 8, 8),
            new THREE.MeshBasicMaterial({ color: options.debugColor || 0xff0000 })
        );
        sphere.position.copy(position);

        // Only add the debug sphere if requested
        if (options.debug) {
            this.scene.add(sphere);
        }

        // Load the sound file
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load(soundUrl, (buffer) => {
            sound.setBuffer(buffer);
            sound.setRefDistance(config.refDistance);
            sound.setMaxDistance(config.maxDistance);
            sound.setRolloffFactor(config.rolloffFactor);
            sound.setVolume(config.volume);
            sound.setLoop(config.loop);

            if (config.autoplay) {
                sound.play();
            }

            console.log(`🔊 Loaded audio source: ${id} at position:`, position);
        });

        // Add the sound to the sphere
        sphere.add(sound);

        // Store the audio source with its ID
        this.audioSources.set(id, {
            sound,
            sphere,
            position
        });

        return sound;
    }

    /**
     * Creates a beacon sound that repeats at intervals
     * 
     * @param {string} id - Unique identifier
     * @param {THREE.Vector3} position - 3D position
     * @param {Object} options - Configuration options
     */
    createBeacon(id, position, options = {}) {
        // Default beacon options
        const config = {
            beepUrl: options.beepUrl || '/sounds/beacon-beep.mp3',
            interval: options.interval || 2000, // Time between beeps in ms
            maxDistance: options.maxDistance || 800,
            refDistance: options.refDistance || 100,
            volume: options.volume || 0.7,
            debug: options.debug || false,
            debugColor: options.debugColor || 0x00ffff
        };

        // Create a sound source that doesn't loop
        const sound = this.createAudioSource(id, position, config.beepUrl, {
            loop: false,
            autoplay: false,
            maxDistance: config.maxDistance,
            refDistance: config.refDistance,
            volume: config.volume,
            debug: config.debug,
            debugColor: config.debugColor
        });

        // Create an interval to play the sound repeatedly
        const interval = setInterval(() => {
            if (sound.isPlaying) {
                sound.stop();
            }
            sound.play();
        }, config.interval);

        // Store the interval so it can be cleared if needed
        this.audioSources.get(id).interval = interval;

        console.log(`🔊 Created beacon: ${id} at position:`, position, "interval:", config.interval + "ms");

        return this.audioSources.get(id);
    }

    /**
     * Update all audio sources - call this in your game loop
     * 
     * @param {THREE.Vector3} playerPosition - Current player position
     */
    update(playerPosition) {
        // Update debug visualizations or other dynamic properties
        this.audioSources.forEach((source, id) => {
            // Calculate distance to player
            const distance = playerPosition.distanceTo(source.position);

            // For debugging purposes, we could log the distance and current volume
            // but only if the sound is playing to avoid console spam
            if (source.sound.isPlaying && Math.random() < 0.01) { // Only log occasionally
                console.log(`🔊 Sound ${id}: distance=${distance.toFixed(2)}, volume=${source.sound.getVolume().toFixed(2)}`);
            }
        });
    }

    /**
     * Remove an audio source by ID
     * 
     * @param {string} id - The ID of the audio source to remove
     */
    removeAudioSource(id) {
        const source = this.audioSources.get(id);
        if (source) {
            // Stop any intervals
            if (source.interval) {
                clearInterval(source.interval);
            }

            // Stop the sound
            if (source.sound.isPlaying) {
                source.sound.stop();
            }

            // Remove the mesh from the scene
            if (source.sphere.parent) {
                source.sphere.parent.remove(source.sphere);
            }

            // Remove from our collection
            this.audioSources.delete(id);
            console.log(`🔊 Removed audio source: ${id}`);
        }
    }

    /**
     * Move an existing audio source to a new position
     * 
     * @param {string} id - The ID of the audio source
     * @param {THREE.Vector3} newPosition - The new position
     */
    moveAudioSource(id, newPosition) {
        const source = this.audioSources.get(id);
        if (source) {
            source.sphere.position.copy(newPosition);
            source.position.copy(newPosition);
        }
    }

    /**
     * Creates a simple beeping sound for testing
     * 
     * @param {THREE.Vector3} position - The position for the beacon
     * @param {Object} options - Optional configuration
     * @returns {string} The ID of the created beacon
     */
    createTestBeacon(position, options = {}) {
        const id = 'test-beacon-' + Date.now();

        // Generate a beep sound dynamically for testing
        // (in a real game, you would use an actual sound file)
        const audioContext = this.listener.context;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.frequency.value = options.frequency || 440; // 440 Hz (A4)
        oscillator.type = options.type || 'sine'; // sine, square, sawtooth, triangle

        // Connect oscillator to gain node
        oscillator.connect(gainNode);

        // Create buffer from oscillator
        const sampleRate = audioContext.sampleRate;
        const duration = options.duration || 0.2; // seconds
        const numSamples = duration * sampleRate;
        const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
        const data = buffer.getChannelData(0);

        // Generate beep waveform
        for (let i = 0; i < numSamples; i++) {
            data[i] = Math.sin(2 * Math.PI * oscillator.frequency.value * i / sampleRate);

            // Apply simple envelope
            if (i < sampleRate * 0.01) { // 10ms attack
                data[i] *= i / (sampleRate * 0.01);
            } else if (i > numSamples - sampleRate * 0.01) { // 10ms release
                data[i] *= (numSamples - i) / (sampleRate * 0.01);
            }
        }

        // Create the positional audio
        const sound = new THREE.PositionalAudio(this.listener);
        sound.setBuffer(buffer);
        sound.setRefDistance(options.refDistance || 100);
        sound.setMaxDistance(options.maxDistance || 800);
        sound.setRolloffFactor(options.rolloffFactor || 1);
        sound.setVolume(options.volume || 0.7);
        sound.setLoop(false);

        // Create a sphere to represent the audio source position
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(10, 8, 8),
            new THREE.MeshBasicMaterial({
                color: options.debugColor || 0x00ffff,
                transparent: true,
                opacity: 0.6
            })
        );
        sphere.position.copy(position);

        // Only add the debug sphere if requested or default to true for test beacon
        if (options.debug !== false) {
            this.scene.add(sphere);
        }

        // Add the sound to the sphere
        sphere.add(sound);

        // Create interval for repeated beeps
        const interval = setInterval(() => {
            if (sound.isPlaying) {
                sound.stop();
            }
            sound.play();
        }, options.interval || 2000);

        // Store the audio source
        this.audioSources.set(id, {
            sound,
            sphere,
            position,
            interval
        });

        console.log(`🔊 Created test beacon: ${id} at position:`, position);
        return id;
    }
}

export default SpatialAudioSystem; 