import * as THREE from 'three';
import { scene, camera } from '../core/gameState.js';
import { gameUI } from '../ui/ui.js';
import { onFishCaught, onMoneyEarned, addToInventory } from '../core/network.js';
import { touchControlsActive } from '../controls/touchControls.js';

// Fishing system configuration
const FISHING_CAST_DISTANCE = 15;
const FISHING_LINE_COLOR = 0xFFFFFF;
const FISHING_BOBBER_COLOR = 0xFF0000;
const FISH_BITE_MIN_TIME = 3;
const FISH_BITE_MAX_TIME = 10;
const MINIGAME_DURATION = 5; // seconds
const MINIGAME_SPEED = 150; // pixels per second

// Fish types with their rarity and value
const FISH_TYPES = [
    { name: 'Anchovy', rarity: 0.3, value: 1, color: 0xCCCCCC, difficulty: 1 },
    { name: 'Cod', rarity: 0.25, value: 2, color: 0xBBBB88, difficulty: 1.2 },
    { name: 'Salmon', rarity: 0.2, value: 3, color: 0xFF9977, difficulty: 1.5 },
    { name: 'Tuna', rarity: 0.15, value: 5, color: 0x6688AA, difficulty: 2 },
    { name: 'Swordfish', rarity: 0.07, value: 10, color: 0x4477AA, difficulty: 3 },
    { name: 'Shark', rarity: 0.02, value: 20, color: 0x778899, difficulty: 4 },
    { name: 'Golden Fish', rarity: 0.01, value: 50, color: 0xFFD700, difficulty: 5 }
];

// Fishing state
let isFishing = false;
let fishingLine = null;
let fishingBobber = null;
let fishingTimeout = null;
let minigameActive = false;
let minigameInterval = null;
let minigameDirection = 1;
let minigameMarkerPosition = 0;
let fishCaught = 0;
let boat = null;
let fishingStartPosition = new THREE.Vector3();
let fishingEndPosition = new THREE.Vector3();
let fishInventory = {};
let bobberAnimationInterval = null;
let fishEscapeTimeout = null;
let minigameTimeout = null;

// Additional state variables for enhanced minigame
let currentHookedFish = null;
let minigameState = {};
let reelKeyPressed = false;
let tensionKeyPressed = false;

// Initialize fishing system
export function initFishing(playerBoat) {
    boat = playerBoat;

    // Set up event listeners for fishing UI
    gameUI.elements.fishing.castButton.onclick = toggleFishing;
    //gameUI.elements.fishing.minigame.catchButton.addEventListener('click', attemptCatch);

    // Update fish counter
    updateFishCounter();
}

// Toggle fishing on/off
function toggleFishing() {
    if (isTouchDevice()) {
        // Don't allow fishing on mobile devices
        return;
    }

    if (isFishing) {
        stopFishing();
    } else {
        startFishing();
    }
}

// Start fishing
function startFishing() {
    if (isTouchDevice() || isFishing) return;

    isFishing = true;
    if (gameUI.elements.fishing.castButton) {
        gameUI.elements.fishing.castButton.textContent = 'Reel In';
    }
    if (gameUI.elements.fishing.status) {
        gameUI.elements.fishing.status.textContent = 'Waiting for a bite...';
    }

    // Calculate fishing line start and end positions
    fishingStartPosition.copy(boat.position);
    fishingStartPosition.y += 2; // Start from slightly above the boat

    // Calculate end position (in front of the boat)
    const boatDirection = new THREE.Vector3(0, 0, -1);
    boatDirection.applyQuaternion(boat.quaternion);

    fishingEndPosition.copy(fishingStartPosition);
    fishingEndPosition.addScaledVector(boatDirection, FISHING_CAST_DISTANCE);
    fishingEndPosition.y = 0; // End at water level

    // Create fishing line
    createFishingLine();

    // Set timeout for fish bite
    const biteTime = FISH_BITE_MIN_TIME + Math.random() * (FISH_BITE_MAX_TIME - FISH_BITE_MIN_TIME);
    fishingTimeout = setTimeout(() => {
        if (isFishing) {
            fishBite();
        }
    }, biteTime * 1000);
}

// Stop fishing
function stopFishing() {
    if (!isFishing) return;

    isFishing = false;
    gameUI.elements.fishing.castButton.textContent = 'Cast Line';
    gameUI.elements.fishing.status.textContent = 'Ready to fish';
    gameUI.elements.fishing.castButton.onclick = toggleFishing;

    // Clear any pending timeouts
    if (fishingTimeout) {
        clearTimeout(fishingTimeout);
        fishingTimeout = null;
    }

    // Remove fishing line and bobber
    removeFishingLine();

    // Stop minigame if active
    if (minigameActive) {
        stopMinigame(false);
    }
}

// Create fishing line and bobber
function createFishingLine() {
    // Create line geometry
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        fishingStartPosition,
        fishingEndPosition
    ]);

    // Create line material
    const lineMaterial = new THREE.LineBasicMaterial({
        color: FISHING_LINE_COLOR,
        linewidth: 1
    });

    // Create line
    fishingLine = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(fishingLine);

    // Create bobber
    const bobberGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const bobberMaterial = new THREE.MeshBasicMaterial({ color: FISHING_BOBBER_COLOR });
    fishingBobber = new THREE.Mesh(bobberGeometry, bobberMaterial);
    fishingBobber.position.copy(fishingEndPosition);
    fishingBobber.position.y = 0.3; // Float slightly above water
    scene.add(fishingBobber);
}

// Remove fishing line and bobber
function removeFishingLine() {
    if (fishingLine) {
        scene.remove(fishingLine);
        fishingLine = null;
    }

    if (fishingBobber) {
        scene.remove(fishingBobber);
        fishingBobber = null;
    }
}

// Update fishing line position (call this in the animation loop)
export function updateFishing() {
    if (!isFishing || !fishingLine || !fishingBobber) return;

    // Update fishing line start position (attached to boat)
    fishingStartPosition.copy(boat.position);
    fishingStartPosition.y += 2;

    // Update line geometry
    const positions = fishingLine.geometry.attributes.position.array;
    positions[0] = fishingStartPosition.x;
    positions[1] = fishingStartPosition.y;
    positions[2] = fishingStartPosition.z;
    fishingLine.geometry.attributes.position.needsUpdate = true;

    // Make bobber bob up and down slightly
    if (fishingBobber) {
        fishingBobber.position.y = 0.3 + Math.sin(Date.now() * 0.003) * 0.1;
    }
}

// Fish bite event
function fishBite() {
    gameUI.elements.fishing.status.textContent = 'Fish on! Click to catch!';
    gameUI.elements.fishing.status.style.color = 'rgba(255, 200, 0, 1)';

    // Clear any previous timeouts to prevent conflicts
    if (fishingTimeout) {
        clearTimeout(fishingTimeout);
        fishingTimeout = null;
    }

    // Make bobber move more vigorously
    if (fishingBobber) {
        fishingBobber.position.y = 0.3;
        // Store the animation interval to clear it properly later
        const bobberAnimation = setInterval(() => {
            if (fishingBobber) {
                fishingBobber.position.y = 0.3 + Math.sin(Date.now() * 0.01) * 0.3;
            } else {
                clearInterval(bobberAnimation);
            }
        }, 16);

        // Save the interval ID for reference
        bobberAnimationInterval = bobberAnimation;

        // Set timeout for fish to get away, but only if minigame isn't started
        fishEscapeTimeout = setTimeout(() => {
            // Only execute if still fishing and minigame not active
            if (isFishing && !minigameActive) {
                clearInterval(bobberAnimation);
                gameUI.elements.fishing.status.textContent = 'The fish got away!';
                gameUI.elements.fishing.status.style.color = 'rgba(255, 100, 100, 1)';

                // Reset after a moment
                setTimeout(() => {
                    if (isFishing) {
                        resetFishingState();
                    }
                }, 2000);
            }
        }, 5000);
    }

    // Start minigame when cast button is clicked
    gameUI.elements.fishing.castButton.textContent = 'Catch!';
    gameUI.elements.fishing.castButton.onclick = startMinigame;
}

// Start fishing minigame
function startMinigame() {
    // Prevent multiple minigame instances
    if (minigameActive) return;

    // Clear fish escape timeout since the player is attempting to catch
    if (fishEscapeTimeout) {
        clearTimeout(fishEscapeTimeout);
        fishEscapeTimeout = null;
    }

    // Reset cast button
    gameUI.elements.fishing.castButton.textContent = 'Reel In';
    gameUI.elements.fishing.castButton.onclick = toggleFishing;

    minigameActive = true;

    // Find which fish was caught based on rarity
    const rand = Math.random();
    let cumulativeRarity = 0;
    let hookedFish = FISH_TYPES[0]; // Default to most common fish

    for (const fish of FISH_TYPES) {
        cumulativeRarity += fish.rarity;
        if (rand <= cumulativeRarity) {
            hookedFish = fish;
            break;
        }
    }

    // Store the current hooked fish
    currentHookedFish = hookedFish;

    // Show minigame UI with enhanced elements
    setupEnhancedMinigameUI(hookedFish);

    // Set fish behavior based on type
    const fishDifficulty = hookedFish.difficulty || 1;

    // Initialize minigame state
    minigameState = {
        tension: 50, // Starting tension (0-100)
        fishStamina: 100 * fishDifficulty, // Fish stamina based on difficulty
        playerProgress: 0, // Progress toward catching (0-100)
        fishDirection: Math.random() > 0.5 ? 1 : -1, // Random initial direction
        fishStrength: fishDifficulty * 2, // How hard the fish pulls
        fishErratic: Math.min(fishDifficulty * 0.5, 1), // How erratically fish behaves (0-1)
        stage: 'fighting', // fighting, reeling, escaped, or caught
        reelSpeed: 0, // Current reeling speed
        markerPosition: 50, // Starting position for marker (center)
        targetZonePosition: 50, // Starting position for target zone (center)
        targetZoneSize: Math.max(30 - (fishDifficulty * 5), 10), // Size of target zone based on difficulty
        targetZoneMoving: fishDifficulty > 2 // Target zone moves for difficult fish
    };

    // Start the minigame loop
    minigameInterval = setInterval(updateEnhancedMinigame, 16);

    // Add keyboard event listeners for fishing controls
    document.addEventListener('keydown', handleFishingKeydown);
    document.addEventListener('keyup', handleFishingKeyup);

    // Set timeout for fish to potentially escape if player takes too long
    minigameTimeout = setTimeout(() => {
        if (minigameActive) {
            minigameState.stage = 'escaped';
            updateEnhancedMinigame(); // Update one more time to show escaped state
        }
    }, MINIGAME_DURATION * 3000); // Triple the normal duration for the enhanced game

    // Play initial "fish on" sound
    playSound('fishBite');
}

// Setup the enhanced minigame UI
function setupEnhancedMinigameUI(fish) {
    // Don't show fishing UI if touch controls are active
    if (window.touchControlsActive) {
        // Auto-catch fish on mobile with a success chance based on fish difficulty
        const successChance = Math.max(0.1, 1 - (currentHookedFish.difficulty * 0.15));
        const success = Math.random() < successChance;

        // Stop the minigame with the determined outcome
        stopEnhancedMinigame(success);
        return;
    }

    const container = gameUI.elements.fishing.minigame.container;

    // Reset container styles and content
    container.innerHTML = '';
    container.style.position = 'absolute';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.width = '350px';
    container.style.backgroundColor = '#3A2616';
    container.style.border = '2px solid #DAA520';
    container.style.borderRadius = '8px';
    container.style.padding = '20px';
    container.style.boxShadow = '0 0 25px rgba(0, 0, 0, 0.7)';
    container.style.color = '#E6C68A';
    container.style.fontFamily = 'serif';
    container.style.zIndex = '1000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    document.body.appendChild(container);

    // Create fish info header
    const fishInfo = document.createElement('div');
    fishInfo.className = 'fish-info';
    fishInfo.innerHTML = `<span style="color:#FFD700">Hooked:</span> <span style="color:#E6C68A">${fish.name}</span>`;
    fishInfo.style.marginBottom = '15px';
    fishInfo.style.textAlign = 'center';
    fishInfo.style.fontSize = '18px';
    fishInfo.style.fontWeight = 'bold';
    container.appendChild(fishInfo);

    // Create fishing rod tension meter
    const tensionContainer = document.createElement('div');
    tensionContainer.className = 'tension-container';
    tensionContainer.style.marginBottom = '15px';

    const tensionLabel = document.createElement('div');
    tensionLabel.textContent = 'Line Tension:';
    tensionLabel.style.marginBottom = '5px';
    tensionLabel.style.fontSize = '14px';
    tensionContainer.appendChild(tensionLabel);

    const tensionMeter = document.createElement('div');
    tensionMeter.className = 'tension-meter';
    tensionMeter.style.width = '100%';
    tensionMeter.style.height = '15px';
    tensionMeter.style.backgroundColor = '#333';
    tensionMeter.style.borderRadius = '10px';
    tensionMeter.style.overflow = 'hidden';
    tensionMeter.style.border = '1px solid #DAA520';

    const tensionBar = document.createElement('div');
    tensionBar.className = 'tension-bar';
    tensionBar.style.width = '50%';
    tensionBar.style.height = '100%';
    tensionBar.style.backgroundColor = '#DAA520';
    tensionBar.style.transition = 'width 0.1s, background-color 0.3s';
    tensionMeter.appendChild(tensionBar);
    tensionContainer.appendChild(tensionMeter);

    // Add danger zones
    const dangerZonesContainer = document.createElement('div');
    dangerZonesContainer.style.display = 'flex';
    dangerZonesContainer.style.justifyContent = 'space-between';
    dangerZonesContainer.style.width = '100%';
    dangerZonesContainer.style.marginTop = '2px';
    dangerZonesContainer.style.fontSize = '10px';

    const lowDanger = document.createElement('div');
    lowDanger.textContent = 'Too Loose';
    lowDanger.style.color = 'red';

    const goodZone = document.createElement('div');
    goodZone.textContent = 'Perfect';
    goodZone.style.color = 'green';

    const highDanger = document.createElement('div');
    highDanger.textContent = 'Too Tight';
    highDanger.style.color = 'red';

    dangerZonesContainer.appendChild(lowDanger);
    dangerZonesContainer.appendChild(goodZone);
    dangerZonesContainer.appendChild(highDanger);
    tensionContainer.appendChild(dangerZonesContainer);

    container.appendChild(tensionContainer);

    // Create catch progress
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.style.marginBottom = '15px';

    const progressLabel = document.createElement('div');
    progressLabel.textContent = 'Catch Progress:';
    progressLabel.style.marginBottom = '5px';
    progressLabel.style.fontSize = '14px';
    progressContainer.appendChild(progressLabel);

    const progressMeter = document.createElement('div');
    progressMeter.className = 'progress-meter';
    progressMeter.style.width = '100%';
    progressMeter.style.height = '15px';
    progressMeter.style.backgroundColor = '#333';
    progressMeter.style.borderRadius = '10px';
    progressMeter.style.overflow = 'hidden';
    progressMeter.style.border = '1px solid #4CAF50';

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.width = '0%';
    progressBar.style.height = '100%';
    progressBar.style.backgroundColor = '#4CAF50';
    progressBar.style.transition = 'width 0.2s';
    progressMeter.appendChild(progressBar);
    progressContainer.appendChild(progressMeter);
    container.appendChild(progressContainer);

    // Create fish stamina meter
    const staminaContainer = document.createElement('div');
    staminaContainer.className = 'stamina-container';
    staminaContainer.style.marginBottom = '15px';

    const staminaLabel = document.createElement('div');
    staminaLabel.textContent = 'Fish Stamina:';
    staminaLabel.style.marginBottom = '5px';
    staminaLabel.style.fontSize = '14px';
    staminaContainer.appendChild(staminaLabel);

    const staminaMeter = document.createElement('div');
    staminaMeter.className = 'stamina-meter';
    staminaMeter.style.width = '100%';
    staminaMeter.style.height = '15px';
    staminaMeter.style.backgroundColor = '#333';
    staminaMeter.style.borderRadius = '10px';
    staminaMeter.style.overflow = 'hidden';
    staminaMeter.style.border = '1px solid #F44336';

    const staminaBar = document.createElement('div');
    staminaBar.className = 'stamina-bar';
    staminaBar.style.width = '100%';
    staminaBar.style.height = '100%';
    staminaBar.style.backgroundColor = '#F44336';
    staminaBar.style.transition = 'width 0.3s';
    staminaMeter.appendChild(staminaBar);
    staminaContainer.appendChild(staminaMeter);
    container.appendChild(staminaContainer);

    // Create target zone game
    const targetGameContainer = document.createElement('div');
    targetGameContainer.className = 'target-game-container';
    targetGameContainer.style.marginBottom = '15px';

    const targetGameLabel = document.createElement('div');
    targetGameLabel.textContent = 'Reel Control:';
    targetGameLabel.style.marginBottom = '5px';
    targetGameLabel.style.fontSize = '14px';
    targetGameContainer.appendChild(targetGameLabel);

    const targetGame = document.createElement('div');
    targetGame.className = 'target-game';
    targetGame.style.width = '100%';
    targetGame.style.height = '40px';
    targetGame.style.backgroundColor = '#333';
    targetGame.style.borderRadius = '10px';
    targetGame.style.position = 'relative';
    targetGame.style.overflow = 'hidden';
    targetGame.style.border = '1px solid #DAA520';

    // Target zone (green area)
    const targetZone = document.createElement('div');
    targetZone.className = 'target-zone';
    targetZone.style.position = 'absolute';
    targetZone.style.height = '100%';
    targetZone.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
    targetZone.style.width = `${minigameState.targetZoneSize}%`;
    targetZone.style.left = `${minigameState.targetZonePosition - (minigameState.targetZoneSize / 2)}%`;
    targetZone.style.border = '1px dashed #4CAF50';
    targetZone.style.boxSizing = 'border-box';
    targetGame.appendChild(targetZone);

    // Marker (player controlled)
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.position = 'absolute';
    marker.style.height = '100%';
    marker.style.width = '5px';
    marker.style.backgroundColor = 'white';
    marker.style.left = `${minigameState.markerPosition}%`;
    marker.style.transform = 'translateX(-50%)';
    marker.style.boxShadow = '0 0 5px white';
    targetGame.appendChild(marker);

    targetGameContainer.appendChild(targetGame);
    container.appendChild(targetGameContainer);

    // Create controls info
    const controlsInfo = document.createElement('div');
    controlsInfo.className = 'controls-info';
    controlsInfo.style.marginBottom = '15px';
    controlsInfo.style.fontSize = '12px';
    controlsInfo.style.textAlign = 'center';
    controlsInfo.innerHTML = `
        <div style="color: #DAA520; margin-bottom: 5px;">Controls:</div>
        <div><span style="color: #DAA520;">Z Key:</span> <span style="color: #E6C68A;">Reel In (hold)</span></div>
        <div><span style="color: #DAA520;">X Key:</span> <span style="color: #E6C68A;">Increase Tension</span></div>
        <div><span style="color: #DAA520;">C Key:</span> <span style="color: #E6C68A;">Decrease Tension</span></div>
    `;
    container.appendChild(controlsInfo);

    // Create status message
    const statusMessage = document.createElement('div');
    statusMessage.className = 'status-message';
    statusMessage.textContent = 'Keep tension balanced while reeling in!';
    statusMessage.style.textAlign = 'center';
    statusMessage.style.color = '#FFD700';
    statusMessage.style.fontStyle = 'italic';
    statusMessage.style.marginBottom = '10px';
    container.appendChild(statusMessage);

    // Store these UI elements for later reference
    gameUI.elements.fishing.minigame.enhanced = {
        container: container,
        fishInfo: fishInfo,
        tensionBar: tensionBar,
        progressBar: progressBar,
        staminaBar: staminaBar,
        targetZone: targetZone,
        marker: marker,
        statusMessage: statusMessage
    };
}

// Handle keydown for fishing controls
function handleFishingKeydown(event) {
    if (!minigameActive) return;

    // Z key - Reel in
    if (event.key === 'z' && !reelKeyPressed) {
        reelKeyPressed = true;
        minigameState.reelSpeed = 1.5;
    }

    // X key - Increase tension
    if (event.key === 'x') {
        minigameState.tension += 2;
        playSound('tensionUp');
    }

    // C key - Decrease tension
    if (event.key === 'c') {
        minigameState.tension -= 2;
        playSound('tensionDown');
    }
}

// Handle keyup for fishing controls
function handleFishingKeyup(event) {
    if (!minigameActive) return;

    // Z key released - Stop reeling
    if (event.key === 'z') {
        reelKeyPressed = false;
        minigameState.reelSpeed = 0;
    }
}

// Update the enhanced minigame
function updateEnhancedMinigame() {
    if (!minigameActive) return;

    const ui = gameUI.elements.fishing.minigame.enhanced;

    // Check if game is over
    if (minigameState.stage === 'escaped') {
        stopEnhancedMinigame(false);
        return;
    }

    if (minigameState.stage === 'caught') {
        stopEnhancedMinigame(true);
        return;
    }

    // Update fish behavior
    updateFishBehavior();

    // Update game mechanics
    updateReelPosition();
    checkLineTension();
    updateCatchProgress();

    // Check for outcome
    checkMinigameOutcome();

    // Update UI elements
    updateMinigameUI();
}

// Update fish behavior
function updateFishBehavior() {
    // Fish changes direction randomly based on erratic level
    if (Math.random() < minigameState.fishErratic * 0.02) {
        minigameState.fishDirection *= -1;
    }

    // Fish stamina decreases over time
    minigameState.fishStamina -= 0.05;

    // Fish strength increases as stamina decreases (desperate fighting)
    if (minigameState.fishStamina < 30) {
        minigameState.fishStrength = minigameState.fishStrength * 1.002;
    }

    // Update target zone position if it's a moving target
    if (minigameState.targetZoneMoving) {
        // Move target zone based on fish direction and strength
        minigameState.targetZonePosition += minigameState.fishDirection * (minigameState.fishStrength * 0.1);

        // Bounce off edges
        if (minigameState.targetZonePosition > 100 - (minigameState.targetZoneSize / 2)) {
            minigameState.targetZonePosition = 100 - (minigameState.targetZoneSize / 2);
            minigameState.fishDirection *= -1;
        } else if (minigameState.targetZonePosition < (minigameState.targetZoneSize / 2)) {
            minigameState.targetZonePosition = (minigameState.targetZoneSize / 2);
            minigameState.fishDirection *= -1;
        }
    }

    // Tension increases when reeling against fish direction
    if (reelKeyPressed && minigameState.reelSpeed > 0) {
        // If fish is pulling away and player is reeling, increase tension
        if (minigameState.fishDirection < 0) {
            minigameState.tension += 0.5 * Math.abs(minigameState.fishStrength);
        } else {
            // If fish is coming toward player, tension decreases slightly
            minigameState.tension -= 0.1;
        }
    } else {
        // Tension naturally decreases when not reeling
        minigameState.tension -= 0.2;
    }
}

// Check and handle line tension
function checkLineTension() {
    // Clamp tension between 0 and 100
    minigameState.tension = Math.max(0, Math.min(100, minigameState.tension));

    // Line breaks if tension is too high
    if (minigameState.tension > 90) {
        // Increase chance of line breaking as tension increases
        const breakChance = (minigameState.tension - 90) * 0.01;
        if (Math.random() < breakChance) {
            minigameState.stage = 'escaped';
            gameUI.elements.fishing.status.textContent = 'Line snapped! The fish got away!';
            gameUI.elements.fishing.status.style.color = 'rgba(255, 100, 100, 1)';
            playSound('lineBreak');
        }
    }

    // Fish escapes if tension is too low
    if (minigameState.tension < 10) {
        // Increase chance of fish escaping as tension decreases
        const escapeChance = (10 - minigameState.tension) * 0.01;
        if (Math.random() < escapeChance) {
            minigameState.stage = 'escaped';
            gameUI.elements.fishing.status.textContent = 'No tension! The fish got away!';
            gameUI.elements.fishing.status.style.color = 'rgba(255, 100, 100, 1)';
            playSound('fishEscape');
        }
    }
}

// Update reel position
function updateReelPosition() {
    // Marker drifts toward center naturally
    if (minigameState.markerPosition > 50) {
        minigameState.markerPosition -= 0.5;
    } else if (minigameState.markerPosition < 50) {
        minigameState.markerPosition += 0.5;
    }

    // Fish pulls on the marker based on direction and strength
    minigameState.markerPosition += minigameState.fishDirection * (minigameState.fishStrength * 0.1);

    // Add player reel speed influence
    minigameState.markerPosition += minigameState.reelSpeed;

    // Clamp marker position between 0 and 100
    minigameState.markerPosition = Math.max(0, Math.min(100, minigameState.markerPosition));
}

// Update catch progress
function updateCatchProgress() {
    // Calculate target zone bounds
    const targetZoneMin = minigameState.targetZonePosition - (minigameState.targetZoneSize / 2);
    const targetZoneMax = minigameState.targetZonePosition + (minigameState.targetZoneSize / 2);

    // If marker is in the target zone, make progress
    if (minigameState.markerPosition >= targetZoneMin && minigameState.markerPosition <= targetZoneMax) {
        // Progress is faster when tension is in the sweet spot (40-60%)
        let progressRate = 0.1;
        if (minigameState.tension >= 40 && minigameState.tension <= 60) {
            progressRate = 0.3;
        }

        // Progress is boosted by reeling
        progressRate += minigameState.reelSpeed * 0.5;

        minigameState.playerProgress += progressRate;
    } else {
        // Slight progress loss when outside the zone
        minigameState.playerProgress -= 0.05;
        minigameState.playerProgress = Math.max(0, minigameState.playerProgress);
    }
}

// Check minigame outcome conditions
function checkMinigameOutcome() {
    // Win condition
    if (minigameState.playerProgress >= 100) {
        minigameState.stage = 'caught';
        playSound('fishCaught');
    }

    // Fish escapes if it has no more stamina and player hasn't made enough progress
    if (minigameState.fishStamina <= 0 && minigameState.playerProgress < 75) {
        minigameState.stage = 'escaped';
        gameUI.elements.fishing.status.textContent = 'The fish fought free and escaped!';
        gameUI.elements.fishing.status.style.color = 'rgba(255, 100, 100, 1)';
        playSound('fishEscape');
    }
}

// Update minigame UI based on current state
function updateMinigameUI() {
    const ui = gameUI.elements.fishing.minigame.enhanced;

    // Update tension bar
    ui.tensionBar.style.width = `${minigameState.tension}%`;

    // Update tension bar color based on level
    if (minigameState.tension > 80) {
        ui.tensionBar.style.backgroundColor = '#F44336'; // Red - danger
    } else if (minigameState.tension > 60) {
        ui.tensionBar.style.backgroundColor = '#FF9800'; // Orange - warning
    } else if (minigameState.tension >= 30) {
        ui.tensionBar.style.backgroundColor = '#4CAF50'; // Green - good
    } else if (minigameState.tension >= 20) {
        ui.tensionBar.style.backgroundColor = '#FF9800'; // Orange - warning
    } else {
        ui.tensionBar.style.backgroundColor = '#F44336'; // Red - danger
    }

    // Update progress bar
    ui.progressBar.style.width = `${minigameState.playerProgress}%`;

    // Update stamina bar
    ui.staminaBar.style.width = `${minigameState.fishStamina}%`;

    // Update marker position
    ui.marker.style.left = `${minigameState.markerPosition}%`;

    // Update target zone position
    ui.targetZone.style.left = `${minigameState.targetZonePosition - (minigameState.targetZoneSize / 2)}%`;
    ui.targetZone.style.width = `${minigameState.targetZoneSize}%`;

    // Update status message based on current state
    if (minigameState.tension > 80) {
        ui.statusMessage.textContent = 'Careful! Line tension too high!';
        ui.statusMessage.style.color = '#F44336';
    } else if (minigameState.tension < 20) {
        ui.statusMessage.textContent = 'More tension needed! Fish might escape!';
        ui.statusMessage.style.color = '#F44336';
    } else if (minigameState.markerPosition >= minigameState.targetZonePosition - (minigameState.targetZoneSize / 2) &&
        minigameState.markerPosition <= minigameState.targetZonePosition + (minigameState.targetZoneSize / 2)) {
        ui.statusMessage.textContent = 'Perfect! Keep reeling!';
        ui.statusMessage.style.color = '#4CAF50';
    } else {
        ui.statusMessage.textContent = 'Guide the marker into the green zone!';
        ui.statusMessage.style.color = '#FFD700';
    }
}

// Stop the enhanced minigame
function stopEnhancedMinigame(success) {
    if (!minigameActive) return;

    minigameActive = false;

    // Clear intervals and timeouts
    if (minigameInterval) {
        clearInterval(minigameInterval);
        minigameInterval = null;
    }

    if (minigameTimeout) {
        clearTimeout(minigameTimeout);
        minigameTimeout = null;
    }

    // Remove event listeners
    document.removeEventListener('keydown', handleFishingKeydown);
    document.removeEventListener('keyup', handleFishingKeyup);

    // Reset reeling state
    reelKeyPressed = false;

    // Hide minigame UI
    gameUI.elements.fishing.minigame.container.style.display = 'none';

    // Update inventory if fish was caught successfully
    if (success && currentHookedFish) {
        // Increment total fish caught
        fishCaught++;
        updateFishCounter();

        // Call network function to update global stats
        onFishCaught(1);

        // Update money earned based on fish value
        onMoneyEarned(currentHookedFish.value);

        // Add fish to inventory
        if (!fishInventory[currentHookedFish.name]) {
            fishInventory[currentHookedFish.name] = {
                count: 0,
                type: currentHookedFish.type,
                value: currentHookedFish.value,
                rarity: currentHookedFish.rarity,
                color: currentHookedFish.color,
                difficulty: currentHookedFish.difficulty
            };
        }

        // Increment count of this specific fish
        fishInventory[currentHookedFish.name].count++;

        // Add to network inventory if available
        if (typeof addToInventory === 'function') {
            addToInventory({
                item_type: 'fish',
                item_name: currentHookedFish.name,
                item_data: {
                    count: 1,
                    value: currentHookedFish.value,
                    rarity: currentHookedFish.rarity,
                    color: currentHookedFish.color,
                    difficulty: currentHookedFish.difficulty
                }
            });
        }

        // Update UI
        if (gameUI && gameUI.updateInventory) {
            gameUI.updateInventory(fishInventory);
        }
    }

    // Show results screen first
    showFishingResultsScreen(success, currentHookedFish);

    // Then create visual effect for caught fish after a short delay
    if (success && currentHookedFish) {
        setTimeout(() => {
            createCaughtFishEffect(currentHookedFish.type);
        }, 500); // Delay the effect so it doesn't interfere with the results screen
    }
}

// Show fishing results screen after minigame
function showFishingResultsScreen(success, fish = null) {
    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.style.position = 'absolute';
    resultsContainer.style.top = '50%';
    resultsContainer.style.left = '50%';
    resultsContainer.style.transform = 'translate(-50%, -50%)';
    resultsContainer.style.width = '350px';
    resultsContainer.style.backgroundColor = '#3A2616';
    resultsContainer.style.border = '2px solid #DAA520';
    resultsContainer.style.borderRadius = '8px';
    resultsContainer.style.padding = '20px';
    resultsContainer.style.boxShadow = '0 0 25px rgba(0, 0, 0, 0.7)';
    resultsContainer.style.color = '#E6C68A';
    resultsContainer.style.fontFamily = 'serif';
    resultsContainer.style.zIndex = '1001'; // Higher than minigame
    resultsContainer.style.display = 'flex';
    resultsContainer.style.flexDirection = 'column';
    resultsContainer.style.alignItems = 'center';
    document.body.appendChild(resultsContainer);

    // Create header
    const header = document.createElement('div');
    header.style.width = '100%';
    header.style.textAlign = 'center';
    header.style.marginBottom = '15px';
    header.style.paddingBottom = '10px';
    header.style.borderBottom = '1px solid #DAA520';
    header.style.fontSize = '22px';
    header.style.fontWeight = 'bold';
    resultsContainer.appendChild(header);

    if (success && fish) {
        // Success content
        header.textContent = 'Fish Caught!';
        header.style.color = '#4CAF50';

        // Fish image/icon
        const fishIcon = document.createElement('div');
        fishIcon.style.width = '80px';
        fishIcon.style.height = '80px';
        fishIcon.style.borderRadius = '50%';
        fishIcon.style.backgroundColor = '#' + fish.color.toString(16).padStart(6, '0');
        fishIcon.style.border = '3px solid #DAA520';
        fishIcon.style.display = 'flex';
        fishIcon.style.alignItems = 'center';
        fishIcon.style.justifyContent = 'center';
        fishIcon.style.marginBottom = '15px';
        fishIcon.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.3)';

        // Fish icon text
        const fishIconText = document.createElement('div');
        fishIconText.textContent = '🐟';
        fishIconText.style.fontSize = '40px';
        fishIcon.appendChild(fishIconText);
        resultsContainer.appendChild(fishIcon);

        // Fish name
        const fishName = document.createElement('div');
        fishName.textContent = fish.name;
        fishName.style.fontSize = '24px';
        fishName.style.fontWeight = 'bold';
        fishName.style.marginBottom = '5px';
        fishName.style.color = '#FFD700';
        resultsContainer.appendChild(fishName);

        // Fish value
        const fishValue = document.createElement('div');
        fishValue.textContent = `Value: ${fish.value} gold`;
        fishValue.style.fontSize = '18px';
        fishValue.style.marginBottom = '20px';
        resultsContainer.appendChild(fishValue);

        // Fish stats table
        const statsTable = document.createElement('table');
        statsTable.style.width = '100%';
        statsTable.style.marginBottom = '20px';
        statsTable.style.borderCollapse = 'collapse';

        // Add rows for different stats
        const stats = [
            { label: 'Rarity', value: getRarityText(fish.rarity) },
            { label: 'Difficulty', value: getDifficultyText(fish.difficulty) },
            { label: 'Total Caught', value: (fishInventory[fish.name]?.count || 1) + ' fish' }
        ];

        stats.forEach(stat => {
            const row = document.createElement('tr');

            const labelCell = document.createElement('td');
            labelCell.textContent = stat.label + ':';
            labelCell.style.padding = '5px 10px';
            labelCell.style.borderBottom = '1px dotted #8B4513';
            labelCell.style.textAlign = 'left';
            labelCell.style.fontWeight = 'bold';
            row.appendChild(labelCell);

            const valueCell = document.createElement('td');
            valueCell.textContent = stat.value;
            valueCell.style.padding = '5px 10px';
            valueCell.style.borderBottom = '1px dotted #8B4513';
            valueCell.style.textAlign = 'right';
            row.appendChild(valueCell);

            statsTable.appendChild(row);
        });

        resultsContainer.appendChild(statsTable);

        // Congrats message
        const congrats = document.createElement('div');
        congrats.textContent = 'Added to your inventory!';
        congrats.style.fontSize = '16px';
        congrats.style.fontStyle = 'italic';
        congrats.style.marginBottom = '20px';
        congrats.style.color = '#4CAF50';
        resultsContainer.appendChild(congrats);
    } else {
        // Failure content
        header.textContent = 'Fish Escaped!';
        header.style.color = '#F44336';

        // Failed fish icon
        const failedIcon = document.createElement('div');
        failedIcon.style.fontSize = '50px';
        failedIcon.style.marginBottom = '15px';
        failedIcon.textContent = '🎣';
        resultsContainer.appendChild(failedIcon);

        // Failure message
        const failureMsg = document.createElement('div');
        failureMsg.textContent = 'The fish got away this time!';
        failureMsg.style.fontSize = '18px';
        failureMsg.style.marginBottom = '20px';
        resultsContainer.appendChild(failureMsg);

        // Instructions header
        const instructionsHeader = document.createElement('div');
        instructionsHeader.textContent = 'Fishing Tips:';
        instructionsHeader.style.fontSize = '18px';
        instructionsHeader.style.fontWeight = 'bold';
        instructionsHeader.style.width = '100%';
        instructionsHeader.style.textAlign = 'left';
        instructionsHeader.style.marginBottom = '10px';
        resultsContainer.appendChild(instructionsHeader);

        // Instructions list
        const tipsList = document.createElement('ul');
        tipsList.style.width = '100%';
        tipsList.style.textAlign = 'left';
        tipsList.style.paddingLeft = '20px';
        tipsList.style.margin = '0 0 20px 0';

        const tips = [
            'Keep the marker in the green target zone',
            'Maintain proper line tension (40-60% is ideal)',
            'Press Z or SPACE to reel in the fish',
            'Use X to increase tension, C to decrease',
            'Don\'t let the tension get too high or the line will break',
            'Don\'t let the tension get too low or the fish will escape',
            'Harder fish move more erratically - be patient!'
        ];

        tips.forEach(tip => {
            const tipItem = document.createElement('li');
            tipItem.textContent = tip;
            tipItem.style.margin = '5px 0';
            tipsList.appendChild(tipItem);
        });

        resultsContainer.appendChild(tipsList);
    }

    // Continue button
    const continueBtn = document.createElement('button');
    continueBtn.textContent = 'Continue Fishing';
    continueBtn.style.padding = '10px 20px';
    continueBtn.style.backgroundColor = '#4A2D17';
    continueBtn.style.color = '#FFD700';
    continueBtn.style.border = '2px solid #DAA520';
    continueBtn.style.borderRadius = '5px';
    continueBtn.style.fontSize = '16px';
    continueBtn.style.cursor = 'pointer';
    continueBtn.style.transition = 'all 0.2s';

    continueBtn.onmouseover = () => {
        continueBtn.style.backgroundColor = '#5A3D27';
        continueBtn.style.boxShadow = '0 0 10px rgba(218, 165, 32, 0.5)';
    };

    continueBtn.onmouseout = () => {
        continueBtn.style.backgroundColor = '#4A2D17';
        continueBtn.style.boxShadow = 'none';
    };

    continueBtn.onclick = () => {
        // Remove results screen
        document.body.removeChild(resultsContainer);

        // Continue fishing
        resetFishingState();
    };

    resultsContainer.appendChild(continueBtn);

    // Helper functions
    function getRarityText(rarity) {
        if (rarity <= 0.01) return 'Legendary';
        if (rarity <= 0.05) return 'Rare';
        if (rarity <= 0.15) return 'Uncommon';
        return 'Common';
    }

    function getDifficultyText(difficulty) {
        if (difficulty >= 4) return 'Master';
        if (difficulty >= 3) return 'Hard';
        if (difficulty >= 2) return 'Medium';
        return 'Easy';
    }
}

// Update the existing game with the new functions
function resetFishingState() {
    gameUI.elements.fishing.status.textContent = 'Waiting for a bite...';
    gameUI.elements.fishing.status.style.color = 'white';

    // Set timeout for next fish bite
    const biteTime = FISH_BITE_MIN_TIME + Math.random() * (FISH_BITE_MAX_TIME - FISH_BITE_MIN_TIME);
    fishingTimeout = setTimeout(() => {
        if (isFishing) {
            fishBite();
        }
    }, biteTime * 1000);
}

// Create visual effect for caught fish
function createCaughtFishEffect(fishType) {
    // Create fish geometry
    const fishGeometry = new THREE.ConeGeometry(0.5, 2, 8);
    fishGeometry.rotateZ(Math.PI / 2);

    // Create fish material with the fish's color
    const fishMaterial = new THREE.MeshPhongMaterial({
        color: fishType.color,
        specular: 0xffffff,
        shininess: 30
    });

    // Create fish mesh
    const fish = new THREE.Mesh(fishGeometry, fishMaterial);

    // Position fish at bobber
    fish.position.copy(fishingBobber.position);

    // Add fish to scene
    scene.add(fish);

    // Create animation for fish jumping out of water
    const startTime = Date.now();
    const jumpDuration = 1500; // ms
    const jumpHeight = 5;

    const animateFish = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / jumpDuration, 1);

        // Parabolic jump
        const jumpProgress = progress * 2 - 1; // -1 to 1
        const height = jumpHeight * (1 - jumpProgress * jumpProgress);

        // Move fish up and slightly toward boat
        fish.position.copy(fishingBobber.position);
        fish.position.y += height;

        // Rotate fish
        fish.rotation.z = progress * Math.PI * 4;

        // Continue animation if not complete
        if (progress < 1) {
            requestAnimationFrame(animateFish);
        } else {
            // Remove fish after animation
            scene.remove(fish);
        }
    };

    // Start animation
    animateFish();
}

// Update fish counter
function updateFishCounter() {
    gameUI.elements.fishing.counter.textContent = `Fish: ${fishCaught}`;
}

// Get current fish count
export function getFishCount() {
    return fishCaught;
}

// Add this function to get the fish inventory
export function getFishInventory() {
    return fishInventory;
}

// Example function to determine fish value (implement based on your game design)
function getFishValue(fishType) {
    // Return money value based on fish type
    switch (fishType) {
        case 'common': return 10;
        case 'uncommon': return 25;
        case 'rare': return 50;
        case 'legendary': return 100;
        default: return 5;
    }
}

// Sound effects function placeholder
function playSound(soundName) {
    // Implement sound effects later
    console.log(`Playing sound: ${soundName}`);
}

// Helper function to check if the device is a touch device
function isTouchDevice() {
    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0
    );
} 