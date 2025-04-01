/**
 * Simple Music System
 * Loads and plays background music and ambient sounds from the server
 */

const MusicSystem = (() => {
    // Main background music and ocean sounds
    let backgroundMusic = null;
    let oceanSound = null;
    let musicVolume = 0.2;
    let oceanVolume = 0.3; // Half of music volume
    let isMuted = true;
    let musicStartedByUserInteraction = false;

    /**
     * Initialize the music system and load the main track
     */
    const init = () => {
        // Create the audio element for background music
        backgroundMusic = new Audio('./music.mp3');
        backgroundMusic.loop = true;
        backgroundMusic.volume = musicVolume;

        // Create the audio element for ocean sounds
        oceanSound = new Audio('./ocean.mp3');
        oceanSound.loop = true;
        oceanSound.volume = oceanVolume;

        // Preload the audio
        backgroundMusic.load();
        oceanSound.load();

        // Check if mute state is saved in localStorage
        if (localStorage.getItem('musicMuted') === 'true') {
            isMuted = true;
        }

        // Apply initial mute state
        if (backgroundMusic) {
            backgroundMusic.volume = isMuted ? 0 : musicVolume;
        }
        if (oceanSound) {
            oceanSound.volume = isMuted ? 0 : oceanVolume;
        }

        // Also load volume if available
        if (localStorage.getItem('musicVolume') !== null) {
            musicVolume = parseFloat(localStorage.getItem('musicVolume'));
            //oceanVolume = musicVolume * 0.5; // Keep ocean at half music volume
        }

        // Add user interaction listeners to start music
        setupUserInteractionListeners();

        // Make MusicSystem available globally for UI components
        window.MusicSystem = MusicSystem;
    };

    /**
     * Set up listeners to start music on user interaction
     * This works around browser autoplay restrictions
     */
    const setupUserInteractionListeners = () => {
        const startMusicOnInteraction = () => {
            if (!musicStartedByUserInteraction) {
                playMusic();
                playOceanSound();
                musicStartedByUserInteraction = true;

                // Remove listeners once music has started
                document.removeEventListener('click', startMusicOnInteraction);
                document.removeEventListener('keydown', startMusicOnInteraction);
                document.removeEventListener('touchstart', startMusicOnInteraction);
            }
        };

        // Add listeners for common user interactions
        document.addEventListener('click', startMusicOnInteraction);
        document.addEventListener('keydown', startMusicOnInteraction);
        document.addEventListener('touchstart', startMusicOnInteraction);
    };

    /**
     * Play the background music and ocean sound
     */
    const playMusic = () => {
        if (backgroundMusic) {
            backgroundMusic.play()
                .catch(error => {
                    console.error('Error playing background music:', error);
                });
        }
    };

    /**
     * Play the ocean sound
     */
    const playOceanSound = () => {
        if (oceanSound) {
            oceanSound.play()
                .catch(error => {
                    console.error('Error playing ocean sound:', error);
                });
        }
    };

    /**
     * Pause the background music and ocean sound
     */
    const pauseMusic = () => {
        if (backgroundMusic) {
            backgroundMusic.pause();
        }
        if (oceanSound) {
            oceanSound.pause();
        }
    };

    /**
     * Set the volume of the background music and adjust ocean sound accordingly
     * @param {number} volume - Volume level (0-1)
     */
    const setVolume = (volume) => {
        musicVolume = Math.max(0, Math.min(1, volume));
        //oceanVolume = musicVolume; // Keep ocean at half music volume

        if (backgroundMusic && !isMuted) {
            backgroundMusic.volume = musicVolume;
        }
        if (oceanSound && !isMuted) {
            oceanSound.volume = oceanVolume;
        }

        // Save volume to localStorage
        localStorage.setItem('musicVolume', musicVolume);
    };

    /**
     * Mute or unmute all sounds
     * @param {boolean} mute - Whether to mute
     */
    const setMute = (mute) => {
        isMuted = mute;

        if (backgroundMusic) {
            backgroundMusic.volume = mute ? 0 : musicVolume;
        }
        if (oceanSound) {
            oceanSound.volume = mute ? 0 : oceanVolume;
        }

        // Save mute state to localStorage
        localStorage.setItem('musicMuted', isMuted);
    };

    /**
     * Toggle mute state
     * @returns {boolean} - New mute state
     */
    const toggleMute = () => {
        setMute(!isMuted);
        // Save mute state to localStorage
        localStorage.setItem('musicMuted', isMuted);
        return isMuted;
    };

    // Placeholder for future ambient sound system
    const updateWaveSound = (waveIntensity) => {
        // To be implemented in the future
        // Could adjust wave sound volume based on wave intensity
    };

    // Placeholder for future weather sounds
    const updateWeatherSounds = (weatherType) => {
        // To be implemented in the future
        // Could play different weather sounds based on type
    };

    // Return public API
    return {
        init,
        playMusic,
        playOceanSound,
        pauseMusic,
        setVolume,
        setMute,
        toggleMute,
        updateWaveSound,    // Placeholder for future functionality
        updateWeatherSounds // Placeholder for future functionality
    };
})();

// Initialize when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    MusicSystem.init();

    // After other UI elements are initialized
    initMusicIcon();
});

/**
 * Initialize music icon state based on localStorage
 * Call this when UI elements are being set up
 */
function initMusicIcon() {
    // Get the music icon element (replace with your actual selector)
    const musicIcon = document.querySelector('.music-icon'); // Update this selector

    // Check localStorage for saved mute state
    const isMuted = localStorage.getItem('musicMuted') === 'true';

    // Update icon appearance based on mute state
    if (musicIcon) {
        if (isMuted) {
            // Show muted icon
            musicIcon.classList.add('muted');
            musicIcon.classList.remove('unmuted');
        } else {
            // Show unmuted icon
            musicIcon.classList.add('unmuted');
            musicIcon.classList.remove('muted');
        }
    }

    // Make sure MusicSystem state matches localStorage
    if (MusicSystem && typeof MusicSystem.setMute === 'function') {
        MusicSystem.setMute(isMuted);
    }
}

// Export the music system
export default MusicSystem; 