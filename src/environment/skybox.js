import * as THREE from 'three';
import { scene, camera, directionalLight, ambientLight, getTime } from '../core/gameState.js';

const skyRadius = 20001; // Larger sky radius
const sunSize = 600; // Increased size for more impressive sun
const moonSize = 400; // Slightly smaller moon
let skyMaterial;
let skyMesh;
let lastTimeOfDay = "";
let skyboxTransitionProgress = 0;
let skyboxTransitionDuration = 20; // Seconds for transition
let sunMesh, moonMesh;
let sunGlow, moonGlow, sunFlare, moonHalo;

// Add a flag to track which skybox system is active
let useRealisticSky = false;
// Variables for sky system
let skyStars;

scene.add(ambientLight);

directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// Create a skybox with a single material
export function setupSkybox() {
    // Skybox size
    const skyboxSize = 10000;

    // Create a skybox geometry
    const skyboxGeometry = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);

    // Create a single material for all faces
    const skyboxMaterial = new THREE.MeshBasicMaterial({
        color: 0x4287f5, // Initial blue color
        side: THREE.BackSide
    });

    // Create the skybox with a single material
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);

    // Set renderOrder to ensure skybox is rendered behind everything
    skybox.renderOrder = -1000;

    // Add the skybox to the scene
    scene.add(skybox);

    // Store reference for later updates
    window.skybox = skybox;

    // Make sure camera far plane is sufficient to see the skybox
    if (camera.far < skyboxSize * 0.5) {
        camera.far = skyboxSize * 0.5;
        camera.updateProjectionMatrix();
    }

    return skybox;
}

// Get gradual sky color based on continuous time
export function getGradualSkyboxColor() {
    // Normalize time to 0-1 range for a full day cycle
    const dayPhase = (getTime() * 0.005) % 1;

    // Define key colors for different times of day with equal distribution
    const colors = [
        { phase: 0.0, color: new THREE.Color(0x191970) },   // Night (start)
        { phase: 0.2, color: new THREE.Color(0xffa07a) },   // Dawn
        { phase: 0.4, color: new THREE.Color(0x4287f5) },   // Day
        { phase: 0.6, color: new THREE.Color(0x6aa5e8) },   // Afternoon
        { phase: 0.8, color: new THREE.Color(0xff7f50) },   // Dusk
        { phase: 1.0, color: new THREE.Color(0x191970) }    // Back to Night (end)
    ];

    // Find the two colors to interpolate between
    let startColor, endColor, t;

    for (let i = 0; i < colors.length - 1; i++) {
        if (dayPhase >= colors[i].phase && dayPhase < colors[i + 1].phase) {
            // Calculate how far we are between these two color points (0-1)
            t = (dayPhase - colors[i].phase) / (colors[i + 1].phase - colors[i].phase);
            startColor = colors[i].color;
            endColor = colors[i + 1].color;
            break;
        }
    }

    // If we somehow didn't find a range, use the last color
    if (!startColor) {
        return colors[colors.length - 1].color;
    }

    // Create result color by interpolating
    const resultColor = new THREE.Color();
    resultColor.copy(startColor).lerp(endColor, t);

    return resultColor;
}

// Modify updateSkybox to respect the active skybox type
export function updateSkybox() {
    if (useRealisticSky && window.realisticSkyMesh) {
        // Use the new realistic sky system
        const deltaTime = 1 / 60; // Approximation when not provided
        updateRealisticSky(window.realisticSkyMesh, deltaTime);
    } else if (window.skybox) {
        // Use the traditional skybox system with simplified direct color approach
        const timeOfDay = getTimeOfDay().toLowerCase();
        const targetColor = getSkyColor(timeOfDay);

        // Smooth transition to the target color
        window.skybox.material.color.lerp(targetColor, 0.03);
        window.skybox.position.copy(camera.position);
    }
}

export function setupSky() {
    // Create a sphere for the sky
    const skyGeometry = new THREE.SphereGeometry(skyRadius, 32, 32);
    // Inside faces
    skyGeometry.scale(-1, 1, 1);

    // Create a basic material first, then set properties
    skyMaterial = new THREE.MeshBasicMaterial();

    // Set properties after creation
    skyMaterial.color = new THREE.Color(0x0a1a2a); // Dark blue for night
    skyMaterial.side = THREE.BackSide;
    skyMaterial.fog = false;
    skyMaterial.depthWrite = false; // Prevent sky from writing to depth buffer

    // Create the sky mesh
    const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
    skyMesh.renderOrder = -10000; // Ensure it renders behind absolutely everything
    skyMesh.frustumCulled = false; // Prevent it from being culled (always visible)
    scene.add(skyMesh);

    // ===== SUN IMPLEMENTATION =====
    // Create a sun mesh with larger size and more detailed geometry
    const sunGeometry = new THREE.SphereGeometry(sunSize, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffcc, // Warmer yellow color
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
        depthTest: false
    });

    // Add a primary glow effect to the sun
    const sunGlowGeometry = new THREE.SphereGeometry(sunSize * 1.4, 32, 32);
    const sunGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffdd88, // Warm orange-yellow glow
        transparent: true,
        opacity: 0.6,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending // Add additive blending for brighter effect
    });

    // Create an outer corona effect
    const sunCoronaGeometry = new THREE.SphereGeometry(sunSize * 2.5, 32, 32);
    const sunCoronaMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa44, // Orange corona
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
    });

    // Create sun lens flare effect (simplified circle)
    const sunFlareGeometry = new THREE.CircleGeometry(sunSize * 0.4, 32);
    const sunFlareMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });

    // Create meshes for all sun effects
    sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
    const sunCorona = new THREE.Mesh(sunCoronaGeometry, sunCoronaMaterial);
    sunFlare = new THREE.Mesh(sunFlareGeometry, sunFlareMaterial);

    // Position the flare slightly offset from the sun
    sunFlare.position.set(sunSize * 0.1, sunSize * 0.1, -sunSize * 0.5);

    // Create the main sun mesh and add all effects as children
    sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunMesh.add(sunGlow);
    sunMesh.add(sunCorona);
    sunMesh.add(sunFlare);
    sunMesh.renderOrder = 1000;
    sunMesh.frustumCulled = false;

    // ===== MOON IMPLEMENTATION =====
    // Create moon with craters texture effect (procedural)
    const moonGeometry = new THREE.SphereGeometry(moonSize, 32, 32);
    const moonMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff, // Pure white base color for better visibility
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
        depthTest: false
    });

    // Create procedural moon texture with more contrast
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 512;
    moonCanvas.height = 512;
    const moonContext = moonCanvas.getContext('2d');

    // Fill with base color
    moonContext.fillStyle = '#ffffff';
    moonContext.fillRect(0, 0, 512, 512);

    // Add more visible craters with higher contrast
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = 5 + Math.random() * 25;
        const shade = 120 + Math.floor(Math.random() * 70); // Darker craters for contrast

        // Create gradient for each crater
        const gradient = moonContext.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgb(${shade}, ${shade}, ${shade + 20})`);
        gradient.addColorStop(1, '#ffffff');

        moonContext.beginPath();
        moonContext.fillStyle = gradient;
        moonContext.arc(x, y, radius, 0, Math.PI * 2);
        moonContext.fill();
    }

    // Add distinctive mare patterns (darker areas)
    for (let i = 0; i < 5; i++) {
        const x = 100 + Math.random() * 312;
        const y = 100 + Math.random() * 312;
        const radius = 40 + Math.random() * 60;

        moonContext.beginPath();
        moonContext.fillStyle = `rgba(100, 110, 150, 0.15)`;
        moonContext.arc(x, y, radius, 0, Math.PI * 2);
        moonContext.fill();
    }

    // Create texture from canvas
    const moonTexture = new THREE.CanvasTexture(moonCanvas);
    moonMaterial.map = moonTexture;

    // Add a soft glow effect to the moon
    const moonGlowGeometry = new THREE.SphereGeometry(moonSize * 1.5, 32, 32);
    const moonGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xaaddff, // Blue-tinted glow
        transparent: true,
        opacity: 0.5, // Increased from 0.4
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
    });

    // Create a halo effect for the moon
    const moonHaloGeometry = new THREE.RingGeometry(moonSize * 1.6, moonSize * 2.5, 32);
    const moonHaloMaterial = new THREE.MeshBasicMaterial({
        color: 0x8899ff, // Stronger blue halo
        transparent: true,
        opacity: 0.3, // Increased from 0.2
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
    });

    // Create moon meshes
    moonGlow = new THREE.Mesh(moonGlowGeometry, moonGlowMaterial);
    moonHalo = new THREE.Mesh(moonHaloGeometry, moonHaloMaterial);

    // Create the main moon mesh and add effects
    moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    moonMesh.add(moonGlow);
    moonMesh.add(moonHalo);
    moonMesh.renderOrder = 1000;
    moonMesh.frustumCulled = false;

    // Initially hide the moon (will be shown at night)
    moonMesh.visible = false;

    // Position sun and moon based on directional light
    const lightDirection = new THREE.Vector3()
        .copy(directionalLight.position)
        .normalize();
    sunMesh.position.copy(lightDirection.multiplyScalar(skyRadius * 0.95));

    // Position moon on opposite side
    const moonDirection = lightDirection.clone().multiplyScalar(-1);
    moonMesh.position.copy(moonDirection.multiplyScalar(skyRadius * 0.95));

    // Add both to scene
    scene.add(sunMesh);
    scene.add(moonMesh);

    // Ensure camera far plane is sufficient
    if (camera.far < skyRadius * 2) {
        camera.far = skyRadius * 2;
        camera.updateProjectionMatrix();

    }
}

// Modify updateTimeOfDay to use the sun/moon transition
export function updateTimeOfDay(deltaTime) {
    const timeOfDay = getTimeOfDay().toLowerCase();

    // If time of day has changed, start transition
    if (timeOfDay !== lastTimeOfDay) {

        lastTimeOfDay = timeOfDay;
        skyboxTransitionProgress = 0;
    }

    // Update transition progress
    if (skyboxTransitionProgress < 1) {
        skyboxTransitionProgress += deltaTime / skyboxTransitionDuration;
        skyboxTransitionProgress = Math.min(skyboxTransitionProgress, 1);

        // Get target colors and settings
        const targetAmbientLight = getAmbientLight(timeOfDay);
        const targetDirectionalLight = getDirectionalLight(timeOfDay);

        // Skip skyMaterial update if using realistic sky
        if (skyMaterial && !useRealisticSky) {
            const targetSkyColor = getSkyColor(timeOfDay);
            skyMaterial.color.lerp(targetSkyColor, 0.05);
        }

        // Update ambient light with faster transition
        ambientLight.color.lerp(targetAmbientLight.color, 0.05);
        ambientLight.intensity += (targetAmbientLight.intensity - ambientLight.intensity) * 0.05;

        // Update directional light with faster transition - only for color and intensity
        // Position is now handled by updateSunPosition
        directionalLight.color.lerp(targetDirectionalLight.color, 0.05);
        directionalLight.intensity += (targetDirectionalLight.intensity - directionalLight.intensity) * 0.05;

        // Update skybox to match time of day - but only when NOT using realistic sky
        if (!useRealisticSky) {
            updateSkybox();
        }
    }

    // Always update moon glow when it's night
    if (lastTimeOfDay === 'night') {
        updateMoonGlow();
    } else {
        // Add subtle pulsing effect to sun during the day
        updateSunPulse(deltaTime);
    }
}

export function getDirectionalLight(timeOfDay) {
    switch (timeOfDay) {
        case 'dawn':
            return {
                color: new THREE.Color(0xffb55a), // Warmer orange sunrise
                intensity: 1.4, // Doubled from 0.7
                position: new THREE.Vector3(-500, 1000, 0)
            };
        case 'day':
            return {
                color: new THREE.Color(0xffefd1), // Warmer, less harsh sunlight
                intensity: 1.6, // Doubled from 0.8
                position: new THREE.Vector3(0, 1800, 0)
            };
        case 'dusk':
            return {
                color: new THREE.Color(0xff6a33), // Richer sunset color
                intensity: 1.4, // Doubled from 0.7
                position: new THREE.Vector3(500, 1000, 0)
            };
        case 'night':
            return {
                color: new THREE.Color(0x6a8abc), // Brighter, more blue-tinted moonlight (was 0x445e8c)
                intensity: 1.0, // Doubled from 0.5
                position: new THREE.Vector3(0, -1000, 1000)
            };
        default:
            return {
                color: new THREE.Color(0xffefd1),
                intensity: 1.6, // Doubled from 0.8
                position: new THREE.Vector3(0, 1800, 0)
            };
    }
}

// Update function to properly handle the sun and moon positions realistically
export function updateSunPosition() {
    // Use same day phase calculation as skybox for consistency
    const dayPhase = (getTime() * 0.005) % 1;

    // Get the positions for both sun and moon
    const sunPosition = calculateSunPosition(dayPhase);
    const moonPosition = calculateMoonPosition(dayPhase);

    // Update sun and moon positions and visibility
    updateCelestialBodyPositions(sunPosition, moonPosition, dayPhase);

    // Update directional light to follow the main light source (sun during day, moon during night)
    updateLightSource(sunPosition, moonPosition, dayPhase);
}

// Replace getGradualSunPosition with specific calculations for sun
function calculateSunPosition(dayPhase) {
    // Calculate angle: 0 at dawn (rising in east), π/2 at noon (directly above), π at dusk (setting in west)
    // Dawn: 0-0.2, Day: 0.2-0.4, Afternoon: 0.4-0.6, Dusk: 0.6-0.8, Night: 0.8-1.0

    // Map dayPhase to sun angle
    let sunAngle;

    // Create a continuous transition between night and dawn for sunrise
    // and between dusk and night for sunset
    if (dayPhase >= 0.8 || dayPhase < 0.2) {
        // Night to Dawn transition (0.8-1.0 and 0.0-0.2)
        // Normalize to 0-1 range
        let normalizedPhase;
        if (dayPhase >= 0.8) {
            // Map 0.8-1.0 to 0.0-0.5 (night part before midnight)
            normalizedPhase = (dayPhase - 0.8) * 2.5;
        } else {
            // Map 0.0-0.2 to 0.5-1.0 (dawn part after midnight) 
            normalizedPhase = 0.5 + (dayPhase / 0.2) * 0.5;
        }

        // Sun moves from -3π/4 (below horizon) to 0 (at horizon)
        // At normalizedPhase=0.5, sun is at its lowest point (-3π/4)
        // At normalizedPhase=1.0, sun is at horizon (0)
        if (normalizedPhase < 0.5) {
            // Moving down to lowest point
            sunAngle = -Math.PI / 2 - (normalizedPhase * 0.5);
        } else {
            // Moving up from lowest point to horizon
            const riseProgress = (normalizedPhase - 0.5) * 2; // 0 to 1
            sunAngle = -Math.PI / 2 - 0.25 + riseProgress * Math.PI / 2; // -3π/4 to 0
        }
    } else if (dayPhase < 0.4) {
        // Dawn to Day - rising from horizon to zenith
        const morningProgress = (dayPhase - 0.2) / 0.2; // 0 to 1
        sunAngle = morningProgress * Math.PI / 2; // 0 to π/2
    } else if (dayPhase < 0.6) {
        // Day to Afternoon - moving from zenith toward west, still above horizon
        const afternoonProgress = (dayPhase - 0.4) / 0.2; // 0 to 1
        sunAngle = Math.PI / 2 + afternoonProgress * Math.PI / 4; // π/2 to 3π/4
    } else if (dayPhase < 0.8) {
        // Afternoon to Dusk - setting toward and below horizon
        const duskProgress = (dayPhase - 0.6) / 0.2; // 0 to 1
        sunAngle = 3 * Math.PI / 4 + duskProgress * Math.PI / 4; // 3π/4 to π
    }

    // Calculate position in 3D space with smooth height transitions
    const distance = skyRadius * 0.9; // Distance from center

    // Calculate height based on sine of angle, with additional adjustment for smoother transitions
    let height = Math.sin(sunAngle) * distance;

    // For extra smoothness at horizon, apply a small vertical adjustment when near horizon
    if (sunAngle < 0.1 && sunAngle > -0.1) { // Near eastern horizon
        height = height * (0.5 + sunAngle * 5); // Gradual appearance
    } else if (sunAngle > Math.PI - 0.1 && sunAngle < Math.PI + 0.1) { // Near western horizon
        height = height * (0.5 + (Math.PI - sunAngle) * 5); // Gradual disappearance
    }

    // Calculate x,z position
    const x = Math.cos(sunAngle) * distance;
    // Add a small z offset to make the sun's path slightly tilted for visual interest
    const z = Math.sin(sunAngle * 0.2) * distance * 0.2;

    return new THREE.Vector3(x, height, z);
}

// New function to calculate moon position based on dayPhase
function calculateMoonPosition(dayPhase) {
    // The moon follows opposite cycle to the sun
    // When sun is at noon, moon is below horizon
    // When sun sets, moon rises from opposite horizon

    // Offset moon phase by 0.5 to place it opposite the sun in the cycle
    const moonPhase = (dayPhase + 0.5) % 1;

    // Use the same smooth transition logic as the sun
    let moonAngle;

    // Create a continuous transition between night and dawn for moon
    if (moonPhase >= 0.8 || moonPhase < 0.2) {
        // Night to Dawn transition for moon (0.8-1.0 and 0.0-0.2)
        // Normalize to 0-1 range
        let normalizedPhase;
        if (moonPhase >= 0.8) {
            // Map 0.8-1.0 to 0.0-0.5
            normalizedPhase = (moonPhase - 0.8) * 2.5;
        } else {
            // Map 0.0-0.2 to 0.5-1.0
            normalizedPhase = 0.5 + (moonPhase / 0.2) * 0.5;
        }

        // Moon moves from -3π/4 (below horizon) to 0 (at horizon)
        if (normalizedPhase < 0.5) {
            // Moving down to lowest point
            moonAngle = -Math.PI / 2 - (normalizedPhase * 0.5);
        } else {
            // Moving up from lowest point to horizon
            const riseProgress = (normalizedPhase - 0.5) * 2; // 0 to 1
            moonAngle = -Math.PI / 2 - 0.25 + riseProgress * Math.PI / 2; // -3π/4 to 0
        }
    } else if (moonPhase < 0.4) {
        // Dawn to Day for moon
        const morningProgress = (moonPhase - 0.2) / 0.2; // 0 to 1
        moonAngle = morningProgress * Math.PI / 2; // 0 to π/2
    } else if (moonPhase < 0.6) {
        // Day to Afternoon for moon
        const afternoonProgress = (moonPhase - 0.4) / 0.2; // 0 to 1
        moonAngle = Math.PI / 2 + afternoonProgress * Math.PI / 4; // π/2 to 3π/4
    } else if (moonPhase < 0.8) {
        // Afternoon to Dusk for moon
        const duskProgress = (moonPhase - 0.6) / 0.2; // 0 to 1
        moonAngle = 3 * Math.PI / 4 + duskProgress * Math.PI / 4; // 3π/4 to π
    }

    // Calculate position - similar to sun but slightly different parameters
    const distance = skyRadius * 0.85; // Slightly closer than sun

    // Calculate height with the same smooth transition effect as the sun
    let height = Math.sin(moonAngle) * distance;

    // Apply smoothing effect at horizon
    if (moonAngle < 0.1 && moonAngle > -0.1) { // Near eastern horizon
        height = height * (0.5 + moonAngle * 5); // Gradual appearance
    } else if (moonAngle > Math.PI - 0.1 && moonAngle < Math.PI + 0.1) { // Near western horizon
        height = height * (0.5 + (Math.PI - moonAngle) * 5); // Gradual disappearance
    }

    // Calculate x,z position - opposite from sun
    const x = -Math.cos(moonAngle) * distance; // Negative to place moon opposite sun
    // Add a small tilt in a different direction from the sun
    const z = Math.sin(moonAngle * 0.2) * distance * -0.2;

    return new THREE.Vector3(x, height, z);
}

// New function to update both celestial bodies based on their calculated positions
function updateCelestialBodyPositions(sunPosition, moonPosition, dayPhase) {
    if (!sunMesh || !moonMesh) return;

    // Position sun and moon
    sunMesh.position.copy(sunPosition);
    moonMesh.position.copy(moonPosition);

    // Add some transition to avoid abrupt appearing/disappearing
    // Increased transition zone for smoother fading
    const horizonBuffer = 100; // Larger buffer for more gradual transition

    // Sun visibility based on height - improved fading transition
    if (sunPosition.y < -horizonBuffer * 1.5) {
        // Well below horizon - completely invisible
        sunMesh.visible = false;
    } else if (sunPosition.y < horizonBuffer) {
        // Transition zone near horizon - gradually fade in/out
        sunMesh.visible = true;
        // Calculate opacity based on height with a smoother curve
        const normalizedHeight = (sunPosition.y + horizonBuffer * 1.5) / (2.5 * horizonBuffer);
        // Use a smoother curve for opacity (ease-in-out effect)
        const opacity = Math.sin(normalizedHeight * Math.PI / 2);
        sunMesh.material.opacity = opacity;

        // Also adjust children opacity with proper scaling
        sunMesh.children.forEach(child => {
            if (child.material && child.material.opacity !== undefined) {
                // Get the natural max opacity for this child
                let maxOpacity = 0.6; // Default for glow
                if (child === sunGlow) maxOpacity = 0.6;
                else if (child === sunFlare) maxOpacity = 0.7;
                else maxOpacity = 0.5; // Default for other sun components

                // Scale the child's opacity proportionally
                child.material.opacity = maxOpacity * opacity;
            }
        });
    } else {
        // Well above horizon - fully visible
        sunMesh.visible = true;
        sunMesh.material.opacity = 1.0;
        // Reset children opacity to their natural values
        sunMesh.children.forEach(child => {
            if (child.material && child.material.opacity !== undefined) {
                // Reset to natural opacity based on child type
                if (child === sunGlow) {
                    child.material.opacity = 0.6;
                } else if (child === sunFlare) {
                    child.material.opacity = 0.7;
                } else {
                    // Default opacity for any other child elements
                    child.material.opacity = 0.5;
                }
            }
        });
    }

    // Moon visibility based on height - use the same smooth approach as sun
    if (moonPosition.y < -horizonBuffer * 1.5) {
        // Well below horizon - completely invisible
        moonMesh.visible = false;
    } else if (moonPosition.y < horizonBuffer) {
        // Transition zone near horizon - gradually fade in/out
        moonMesh.visible = true;
        // Calculate opacity based on height with a smoother curve
        const normalizedHeight = (moonPosition.y + horizonBuffer * 1.5) / (2.5 * horizonBuffer);
        // Use a smoother curve for opacity (ease-in-out effect)
        const opacity = Math.sin(normalizedHeight * Math.PI / 2);
        moonMesh.material.opacity = opacity;

        // Also adjust children opacity with proper scaling
        moonMesh.children.forEach(child => {
            if (child.material && child.material.opacity !== undefined) {
                // Get the natural max opacity for this child
                let maxOpacity = 0.5; // Default
                if (child === moonGlow) maxOpacity = 0.5;
                else if (child === moonHalo) maxOpacity = 0.3;

                // Scale the child's opacity proportionally
                child.material.opacity = maxOpacity * opacity;
            }
        });
    } else {
        // Well above horizon - fully visible
        moonMesh.visible = true;
        moonMesh.material.opacity = 1.0;
        // Reset children opacity to their natural values
        moonMesh.children.forEach(child => {
            if (child.material && child.material.opacity !== undefined) {
                // Reset to natural opacity based on child type
                if (child === moonGlow) {
                    child.material.opacity = 0.5;
                } else if (child === moonHalo) {
                    child.material.opacity = 0.3;
                }
            }
        });
    }

    // Always face celestial bodies toward the camera
    sunMesh.lookAt(camera.position);
    moonMesh.lookAt(camera.position);

    // Update sun appearance based on phase
    updateSunAppearance(dayPhase);
}

// Update directional light to follow the active celestial body (sun or moon)
function updateLightSource(sunPosition, moonPosition, dayPhase) {
    // Determine which celestial body is the primary light source
    let primaryLightPosition;
    let primaryLightColor;
    let lightIntensity;

    // Night is from 0.8 to 0.2 (20% of day cycle)
    const isNight = (dayPhase >= 0.8 || dayPhase < 0.2);

    if (isNight) {
        // Use moon as light source during night
        primaryLightPosition = moonPosition;
        primaryLightColor = new THREE.Color(0x6a8abc); // Moonlight color
        lightIntensity = 1.0; // Moon light intensity
    } else {
        // Use sun as light source during day
        primaryLightPosition = sunPosition;

        // Adjust color based on sun position
        if (dayPhase < 0.3) {
            // Dawn (transition period after night)
            primaryLightColor = new THREE.Color(0xffb55a);
            lightIntensity = 1.4;
        } else if (dayPhase >= 0.7) {
            // Dusk (transition period before night)
            primaryLightColor = new THREE.Color(0xff6a33);
            lightIntensity = 1.4;
        } else {
            // Day (full sun)
            primaryLightColor = new THREE.Color(0xffefd1);
            lightIntensity = 1.6;
        }
    }

    // Update directional light
    directionalLight.position.lerp(primaryLightPosition, 0.05);
    directionalLight.color.lerp(primaryLightColor, 0.05);
    directionalLight.intensity = directionalLight.intensity * 0.95 + lightIntensity * 0.05;

    // Update ambient light intensity based on time (brighter during day)
    const ambientIntensity = isNight ? 0.5 : 0.2 + lightIntensity * 0.3;
    ambientLight.intensity = ambientLight.intensity * 0.95 + ambientIntensity * 0.05;

    // Update ambient light color
    const ambientColor = isNight
        ? new THREE.Color(0x2a3045)  // Night ambient
        : new THREE.Color(0x89a7c5); // Day ambient
    ambientLight.color.lerp(ambientColor, 0.05);
}

// Update sun appearance based on the time of day
function updateSunAppearance(dayPhase) {
    if (!sunMesh) return;

    let sunColor, glowColor, flareOpacity, sunScale;

    if (dayPhase < 0.2) {
        // Dawn
        sunColor = new THREE.Color(0xff8800);
        glowColor = new THREE.Color(0xff6600);
        flareOpacity = 0.8;
        sunScale = 1.2;
    } else if (dayPhase < 0.6) {
        // Day and Afternoon
        sunColor = new THREE.Color(0xffffcc);
        glowColor = new THREE.Color(0xffdd88);
        flareOpacity = 0.7;
        sunScale = 1.0;
    } else if (dayPhase < 0.8) {
        // Dusk
        sunColor = new THREE.Color(0xff8800);
        glowColor = new THREE.Color(0xff6600);
        flareOpacity = 0.8;
        sunScale = 1.2;
    } else {
        // Night (sun not visible, but update anyway)
        sunColor = new THREE.Color(0xff8800);
        glowColor = new THREE.Color(0xff6600);
        flareOpacity = 0.7;
        sunScale = 1.0;
    }

    // Apply changes with smooth transitions
    sunMesh.material.color.lerp(sunColor, 0.05);
    sunMesh.scale.lerp(new THREE.Vector3(sunScale, sunScale, sunScale), 0.05);

    // Update sun effects
    if (sunGlow) {
        sunGlow.material.color.lerp(glowColor, 0.05);
    }

    if (sunFlare && sunFlare.material) {
        sunFlare.material.opacity = sunFlare.material.opacity * 0.95 + flareOpacity * 0.05;
    }
}

export function getTimeOfDay() {
    // Cycle through different times of day
    const dayPhase = (getTime() * 0.005) % 1; // 0 to 1 representing full day cycle

    // Equal distribution - each time of day gets 20% of the cycle
    if (dayPhase < 0.2) return "Dawn";       // 20% for dawn
    if (dayPhase < 0.4) return "Day";        // 20% for day 
    if (dayPhase < 0.6) return "Afternoon";  // 20% for afternoon
    if (dayPhase < 0.8) return "Dusk";       // 20% for dusk
    return "Night";                          // 20% for night
}

function getSkyColor(timeOfDay) {
    switch (timeOfDay) {
        case 'dawn':
            return new THREE.Color(0xff9e7a); // Brighter peachy dawn
        case 'day':
            return new THREE.Color(0x4287f5); // Clear blue sky
        case 'afternoon':
            return new THREE.Color(0x6aa5e8); // Slightly lighter afternoon blue
        case 'dusk':
            return new THREE.Color(0xff7f50); // Coral sunset
        case 'night':
            return new THREE.Color(0x0a1a4a); // Deep night blue
        default:
            return new THREE.Color(0x4287f5); // Default to day blue
    }
}

function getAmbientLight(timeOfDay) {
    switch (timeOfDay) {
        case 'dawn':
            return {
                color: new THREE.Color(0x7a5c70), // Purple-tinted for dawn
                intensity: 0.4 // Doubled from 0.2
            };
        case 'day':
            return {
                color: new THREE.Color(0x89a7c5), // Slightly bluer sky ambient
                intensity: 0.5 // Doubled from 0.25
            };
        case 'dusk':
            return {
                color: new THREE.Color(0x614b5a), // Deeper dusk ambient
                intensity: 0.4 // Doubled from 0.2
            };
        case 'night':
            return {
                color: new THREE.Color(0x2a3045), // Lighter night ambient (was 0x1a2035)
                intensity: 0.5 // Doubled from 0.25
            };
        default:
            return {
                color: new THREE.Color(0x89a7c5),
                intensity: 0.5 // Doubled from 0.25
            };
    }
}

// Enhanced function to update moon glow with subtle animation
function updateMoonGlow() {
    if (moonMesh && (lastTimeOfDay === 'night' || moonMesh.visible)) {
        // Create more dynamic pulsing effect for moon glow
        const time = getTime() * 0.001;
        const pulseAmount = Math.sin(time * 0.5) * 0.08 + 0.96; // 0.88 to 1.04 range
        const secondaryPulse = Math.sin(time * 0.2) * 0.03; // Second subtle pulse

        // Apply to moon glow with enhanced effects
        if (moonGlow) {
            // Determine base opacity based on time of day
            const baseOpacity = lastTimeOfDay === 'night' ? 0.8 : 0.4;
            moonGlow.material.opacity = baseOpacity * (pulseAmount + secondaryPulse);

            // More dynamic scaling
            const glowScale = lastTimeOfDay === 'night' ? 1.5 : 1.3;
            moonGlow.scale.set(
                glowScale * pulseAmount,
                glowScale * pulseAmount,
                glowScale * pulseAmount
            );

            // Update glow color based on time
            if (lastTimeOfDay === 'night') {
                // Slightly shift color for visual interest
                const blueShift = 0.9 + secondaryPulse * 0.2;
                moonGlow.material.color.setRGB(0.7, 0.85 * blueShift, 1.0 * blueShift);
            }
        }

        // Apply to moon halo with enhanced rotation
        if (moonHalo) {
            // Rotate the halo at varying speeds
            moonHalo.rotation.z += 0.0003 + Math.sin(time * 0.1) * 0.0001;

            // Determine base opacity based on time of day
            const baseOpacity = lastTimeOfDay === 'night' ? 0.4 : 0.2;
            moonHalo.material.opacity = baseOpacity * pulseAmount;

            // Scale halo slightly with pulse
            const haloScale = 1.0 + secondaryPulse * 0.5;
            moonHalo.scale.set(haloScale, haloScale, 1);
        }

        // Make the moon itself brighter at night with subtle color variations
        if (moonMesh.material) {
            if (lastTimeOfDay === 'night') {
                // Subtle color shift for visual interest
                const blueShift = 1.0 + secondaryPulse * 0.05;
                moonMesh.material.color.setRGB(1, 1, blueShift);

                // Slightly enlarged moon at night for better visibility
                const moonScale = 1.2 + secondaryPulse * 0.1;
                moonMesh.scale.set(moonScale, moonScale, moonScale);
            } else {
                moonMesh.material.color.set(0xddddff); // Slightly blue-tinted during day
                moonMesh.scale.set(1.0, 1.0, 1.0); // Normal size during day
            }
        }
    }
}

// Add function to create subtle pulsing/flickering effect for the sun
function updateSunPulse(deltaTime) {
    if (sunMesh && sunMesh.visible) {
        // Create subtle pulsing effect for sun
        const time = getTime() * 0.001;

        // Combine multiple sine waves for a more organic effect
        const pulse1 = Math.sin(time * 0.5) * 0.03;
        const pulse2 = Math.sin(time * 1.3) * 0.015;
        const pulseAmount = 1.0 + pulse1 + pulse2; // Range from ~0.955 to ~1.045

        // Apply to sun glow
        if (sunGlow) {
            const baseScale = 1.4;
            sunGlow.scale.set(
                baseScale * pulseAmount,
                baseScale * pulseAmount,
                baseScale * pulseAmount
            );

            // Also slightly vary the opacity
            sunGlow.material.opacity = 0.6 * (0.95 + 0.1 * Math.sin(time * 0.7));
        }

        // Apply subtle rotation to sun flare
        if (sunFlare) {
            sunFlare.rotation.z += deltaTime * 0.1;
        }
    }
}

// Toggle between the simple skybox and realistic sky
export function toggleSkySystem() {
    useRealisticSky = !useRealisticSky;

    if (useRealisticSky) {
        // Hide the old skybox
        if (window.skybox) window.skybox.visible = false;

        // Always remove any existing sky mesh to ensure a fresh creation
        if (window.realisticSkyMesh) {
            scene.remove(window.realisticSkyMesh);
            window.realisticSkyMesh = null;
        }

        // Create a new realistic sky

        const skyMesh = createRealisticSky();

        // Ensure sky is visible
        if (skyMesh) {

            skyMesh.visible = true;

            // Force update once
            updateRealisticSky(skyMesh, 1 / 60);

            // Center on camera immediately
            skyMesh.position.copy(camera.position);


            // Debugging
        } else {

        }
    } else {

        // Show the old skybox
        if (window.skybox) window.skybox.visible = true;

        // Hide the realistic sky
        if (window.realisticSkyMesh) window.realisticSkyMesh.visible = true;

        // Hide star system
        if (skyStars) skyStars.visible = false;
    }

    // Update UI indicator
    updateSkyModeIndicator();


    return useRealisticSky;
}

// Create a small on-screen indicator for sky mode
function updateSkyModeIndicator() {
    /*let indicator = document.getElementById('sky-mode-indicator');

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'sky-mode-indicator';
        indicator.style.position = 'fixed';
        indicator.style.bottom = '10px';
        indicator.style.right = '10px';
        indicator.style.padding = '5px 10px';
        indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        indicator.style.color = 'white';
        indicator.style.fontFamily = 'Arial, sans-serif';
        indicator.style.fontSize = '12px';
        indicator.style.borderRadius = '4px';
        indicator.style.zIndex = '1000';
        document.body.appendChild(indicator);

        // Add debug menu button
        const debugBtn = document.createElement('button');
        debugBtn.textContent = 'Debug Sky';
        debugBtn.style.marginLeft = '10px';
        debugBtn.style.backgroundColor = '#555';
        debugBtn.style.border = 'none';
        debugBtn.style.color = 'white';
        debugBtn.style.padding = '2px 5px';
        debugBtn.style.borderRadius = '2px';
        debugBtn.style.cursor = 'pointer';

        debugBtn.onclick = showSkyDebugMenu;

        indicator.appendChild(debugBtn);
    }

    indicator.textContent = useRealisticSky ? 'Enhanced Sky: ON (T)' : 'Enhanced Sky: OFF (T)';
    indicator.style.backgroundColor = useRealisticSky ? 'rgba(0, 100, 0, 0.5)' : 'rgba(100, 0, 0, 0.5)';

    // Re-add the debug button after changing text
    const debugBtn = document.createElement('button');
    debugBtn.textContent = 'Debug Sky';
    debugBtn.style.marginLeft = '10px';
    debugBtn.style.backgroundColor = '#555';
    debugBtn.style.border = 'none';
    debugBtn.style.color = 'white';
    debugBtn.style.padding = '2px 5px';
    debugBtn.style.borderRadius = '2px';
    debugBtn.style.cursor = 'pointer';

    debugBtn.onclick = showSkyDebugMenu;

    indicator.appendChild(debugBtn);*/
}

// Debug menu to help troubleshoot sky visibility
function showSkyDebugMenu() {
    // Remove existing debug menu if any
    const existingMenu = document.getElementById('sky-debug-menu');
    if (existingMenu) {
        document.body.removeChild(existingMenu);
        return;
    }

    // Create debug menu
    const menu = document.createElement('div');
    menu.id = 'sky-debug-menu';
    menu.style.position = 'fixed';
    menu.style.top = '50%';
    menu.style.left = '50%';
    menu.style.transform = 'translate(-50%, -50%)';
    menu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    menu.style.color = 'white';
    menu.style.padding = '20px';
    menu.style.borderRadius = '8px';
    menu.style.zIndex = '2000';
    menu.style.minWidth = '300px';
    menu.style.maxHeight = '80vh';
    menu.style.overflowY = 'auto';

    // Header
    const header = document.createElement('h3');
    header.textContent = 'Sky Debug Info';
    header.style.margin = '0 0 15px 0';
    menu.appendChild(header);

    // Sky status
    addDebugInfo(menu, 'Sky System', useRealisticSky ? 'Realistic' : 'Simple');

    // Camera info
    addDebugInfo(menu, 'Camera Near', camera.near);
    addDebugInfo(menu, 'Camera Far', camera.far);
    addDebugInfo(menu, 'Camera FOV', camera.fov);
    addDebugInfo(menu, 'Camera Position', `X: ${camera.position.x.toFixed(1)}, Y: ${camera.position.y.toFixed(1)}, Z: ${camera.position.z.toFixed(1)}`);

    // Sky mesh info
    if (window.realisticSkyMesh) {
        addDebugInfo(menu, 'Sky Mesh Exists', 'Yes');
        addDebugInfo(menu, 'Sky Mesh Visible', window.realisticSkyMesh.visible ? 'Yes' : 'No');
        addDebugInfo(menu, 'Sky Radius', window.realisticSkyMesh.geometry.parameters.radius);
        addDebugInfo(menu, 'Sky Position', `X: ${window.realisticSkyMesh.position.x.toFixed(1)}, Y: ${window.realisticSkyMesh.position.y.toFixed(1)}, Z: ${window.realisticSkyMesh.position.z.toFixed(1)}`);
    } else {
        addDebugInfo(menu, 'Sky Mesh Exists', 'No');
    }

    // Action buttons
    const btnContainer = document.createElement('div');
    btnContainer.style.marginTop = '15px';
    btnContainer.style.display = 'flex';
    btnContainer.style.flexDirection = 'column';
    btnContainer.style.gap = '10px';

    // Toggle sky button
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Toggle Sky System';
    toggleBtn.style.padding = '5px';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.onclick = () => {
        toggleSkySystem();
        showSkyDebugMenu(); // Refresh menu
    };
    btnContainer.appendChild(toggleBtn);

    // Increase camera far plane button
    const farPlaneBtn = document.createElement('button');
    farPlaneBtn.textContent = 'Set Camera Far Plane (50,000)';
    farPlaneBtn.style.padding = '5px';
    farPlaneBtn.style.cursor = 'pointer';
    farPlaneBtn.onclick = () => {
        camera.far = 50000;
        camera.updateProjectionMatrix();
        showSkyDebugMenu(); // Refresh menu
    };
    btnContainer.appendChild(farPlaneBtn);

    // Force sky rebuild button
    const rebuildBtn = document.createElement('button');
    rebuildBtn.textContent = 'Force Recreate Sky';
    rebuildBtn.style.padding = '5px';
    rebuildBtn.style.cursor = 'pointer';
    rebuildBtn.onclick = () => {
        if (window.realisticSkyMesh) {
            scene.remove(window.realisticSkyMesh);
            window.realisticSkyMesh = null;
        }
        toggleSkySystem();
        showSkyDebugMenu(); // Refresh menu
    };
    btnContainer.appendChild(rebuildBtn);

    // Center sky on camera button
    const centerSkyBtn = document.createElement('button');
    centerSkyBtn.textContent = 'Center Sky on Camera';
    centerSkyBtn.style.padding = '5px';
    centerSkyBtn.style.cursor = 'pointer';
    centerSkyBtn.onclick = () => {
        if (window.realisticSkyMesh) {
            window.realisticSkyMesh.position.copy(camera.position);
            showSkyDebugMenu(); // Refresh menu
        }
    };
    btnContainer.appendChild(centerSkyBtn);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.padding = '5px';
    closeBtn.style.marginTop = '10px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => {
        document.body.removeChild(menu);
    };
    btnContainer.appendChild(closeBtn);

    menu.appendChild(btnContainer);
    document.body.appendChild(menu);
}

// Helper function to add debug info to menu
function addDebugInfo(container, label, value) {
    const item = document.createElement('div');
    item.style.marginBottom = '8px';

    const labelEl = document.createElement('strong');
    labelEl.textContent = label + ': ';

    const valueEl = document.createElement('span');
    valueEl.textContent = value;

    item.appendChild(labelEl);
    item.appendChild(valueEl);
    container.appendChild(item);
}

// Create a realistic sky with atmospheric scattering shader, stars and clouds
function createRealisticSky() {


    // === ATMOSPHERIC SCATTERING SKY ===
    // Create a sphere larger than our regular skybox but not too large
    // Reduce the sky radius to ensure it's within camera far plane
    const effectiveSkyRadius = Math.min(skyRadius, 10000);
    const skyGeometry = new THREE.SphereGeometry(effectiveSkyRadius, 64, 64);
    skyGeometry.scale(-1, 1, 1); // Flip faces inward

    // Create a simpler sky shader material with more basic effects
    // This is more reliable and should work on most devices
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x0077ff) },  // Blue sky at top
            bottomColor: { value: new THREE.Color(0x87ceeb) }, // Light blue at horizon
            offset: { value: 33 },
            exponent: { value: 0.6 },
            sunPosition: { value: new THREE.Vector3(0, 1, 0) },
            sunColor: { value: new THREE.Color(0xffffcc) }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            uniform vec3 sunPosition;
            uniform vec3 sunColor;
            
            varying vec3 vWorldPosition;
            
            void main() {
                float h = normalize(vWorldPosition).y;
                float sunInfluence = max(dot(normalize(vWorldPosition), normalize(sunPosition)), 0.0);
                
                // Create gradient from bottom to top
                vec3 skyGradient = mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0));
                
                // Add sun highlight at horizon when sun is near horizon
                vec3 sunHighlight = sunColor * pow(sunInfluence, 32.0) * 2.0;
                
                gl_FragColor = vec4(skyGradient + sunHighlight, 1.0);
            }
        `,
        side: THREE.BackSide,
        depthWrite: false
    });

    // Create the sky mesh
    const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
    skyMesh.renderOrder = -10000; // Render behind everything
    skyMesh.frustumCulled = false; // Prevent it from being culled (always visible)
    scene.add(skyMesh);

    // Store the mesh for updates
    window.realisticSkyMesh = skyMesh;

    // === STARS SYSTEM ===
    // Create stars for night sky

    createSkyStarField();

    // Set realistic sky as active
    useRealisticSky = true;

    // Update UI indicator
    updateSkyModeIndicator();

    // Make sure camera far plane is large enough to see the sky

    if (camera.far < effectiveSkyRadius * 2) {
        camera.far = effectiveSkyRadius * 2;
        camera.updateProjectionMatrix();

    }

    return skyMesh;
}

// Simpler update function for the enhanced sky
export function updateRealisticSky(skyMesh, deltaTime) {
    if (!skyMesh || !skyMesh.material || !skyMesh.material.uniforms) {

        return;
    }

    // Get time of day and phase
    const timeOfDay = getTimeOfDay().toLowerCase();
    const dayPhase = (getTime() * 0.005) % 1;

    // Calculate sun and moon positions
    const sunPosition = calculateSunPosition(dayPhase);
    const moonPosition = calculateMoonPosition(dayPhase);

    // Determine which celestial body to use for the sky shader
    const isNight = (dayPhase >= 0.8 || dayPhase < 0.2);

    // SIMPLIFIED COLOR APPROACH - direct color mapping instead of gradients
    // Use basic colors from getSkyColor for both top and bottom with slight variation
    const baseColor = getSkyColor(timeOfDay);
    let topColor, bottomColor;

    // Simple sky color mapping with slightly darker bottom color
    switch (timeOfDay) {
        case 'dawn':
            topColor = new THREE.Color(0xffa07a);      // Light salmon
            bottomColor = new THREE.Color(0xe08060);   // Slightly darker salmon
            break;
        case 'day':
        case 'afternoon':
            topColor = new THREE.Color(0x4287f5);      // Sky blue
            bottomColor = new THREE.Color(0x87ceeb);   // Lighter sky blue
            break;
        case 'dusk':
            topColor = new THREE.Color(0xff7f50);      // Coral
            bottomColor = new THREE.Color(0xdb6b42);   // Darker coral
            break;
        case 'night':
            topColor = new THREE.Color(0x191970);      // Midnight blue
            bottomColor = new THREE.Color(0x0a0a3a);   // Darker midnight blue
            break;
        default:
            topColor = new THREE.Color(0x4287f5);      // Default sky blue
            bottomColor = new THREE.Color(0x87ceeb);   // Default lighter blue
    }

    // Fixed values for atmosphere parameters - simplify for consistent look
    const exponent = 0.8;  // Fixed exponent (higher = sharper transition)
    const offset = 0.1;    // Fixed offset value

    // Apply updated uniforms
    if (skyMesh.material.uniforms) {
        // Apply simplified colors
        skyMesh.material.uniforms.topColor.value = topColor;
        skyMesh.material.uniforms.bottomColor.value = bottomColor;
        skyMesh.material.uniforms.exponent.value = exponent;
        skyMesh.material.uniforms.offset.value = offset;

        // Sun/moon positioning still works as before
        if (isNight) {
            // Use moon for night
            skyMesh.material.uniforms.sunPosition.value.copy(moonPosition);
        } else {
            // Use sun for day
            skyMesh.material.uniforms.sunPosition.value.copy(sunPosition);
        }

        // Always update celestial positions for visual effects
        updateCelestialBodyPositions(sunPosition, moonPosition, dayPhase);
        updateLightSource(sunPosition, moonPosition, dayPhase);

        // Update star visibility
        updateSkyStars(dayPhase);
    } else {

    }

    // Keep skybox centered on camera
    skyMesh.position.copy(camera.position);

    // Debug information (only when debug is enabled)
    const skyDebug = false; // Set to true to enable debugging
    if (skyDebug) {




    }
}

// Create a star field for night sky
function createSkyStarField() {
    // Remove existing stars if any
    if (skyStars) {
        scene.remove(skyStars);
    }

    const starRadius = skyRadius * 0.99;
    const starCount = 2000;

    // Create star material with glow effect
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 4,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true // Enable vertex colors
    });

    // Create star geometry with random positions and colors
    const starGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        // Generate random position on sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const x = starRadius * Math.sin(phi) * Math.cos(theta);
        const y = starRadius * Math.sin(phi) * Math.sin(theta);
        const z = starRadius * Math.cos(phi);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Vary star colors slightly
        const starType = Math.random();
        if (starType > 0.95) {
            // Blue-white hot stars
            colors[i * 3] = 0.8 + Math.random() * 0.2;
            colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
            colors[i * 3 + 2] = 1.0;
        } else if (starType > 0.8) {
            // Yellow stars
            colors[i * 3] = 1.0;
            colors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
            colors[i * 3 + 2] = 0.6 + Math.random() * 0.2;
        } else {
            // White stars
            const brightness = 0.8 + Math.random() * 0.2;
            colors[i * 3] = brightness;
            colors[i * 3 + 1] = brightness;
            colors[i * 3 + 2] = brightness;
        }

        // Make some stars twinkle
        if (Math.random() > 0.7) {
            const twinkleFactor = 0.7 + Math.random() * 0.3;
            colors[i * 3] *= twinkleFactor;
            colors[i * 3 + 1] *= twinkleFactor;
            colors[i * 3 + 2] *= twinkleFactor;
        }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create stars mesh
    skyStars = new THREE.Points(starGeometry, starMaterial);
    skyStars.userData = {
        originalOpacity: starMaterial.opacity,
        twinkleTime: 0
    };
    scene.add(skyStars);
}

// Update stars visibility based on time of day
function updateSkyStars(dayPhase) {
    if (!skyStars) return;

    // Stars visible during night and partially during dawn/dusk transitions
    const isNight = (dayPhase >= 0.8 || dayPhase < 0.2);
    skyStars.visible = isNight;

    if (isNight) {
        // Base opacity depends on how deep into night we are
        let baseOpacity = 0;
        if (dayPhase >= 0.9 || dayPhase < 0.1) {
            // Deep night - full stars
            baseOpacity = 1.0;
        } else if (dayPhase >= 0.8 && dayPhase < 0.9) {
            // Dusk transition - stars fading in
            baseOpacity = (dayPhase - 0.8) / 0.1;
        } else {
            // Dawn transition - stars fading out (0.1-0.2)
            baseOpacity = 1.0 - ((dayPhase - 0.1) / 0.1);
        }

        // Apply twinkle effect
        skyStars.userData.twinkleTime += 0.016; // Approx for 60fps

        // Get colors attribute
        const colors = skyStars.geometry.attributes.color;

        // Add subtle twinkling to some stars
        for (let i = 0; i < colors.count; i++) {
            if (i % 5 === 0) { // Twinkle only some stars
                const twinkle = 0.7 + 0.3 * Math.sin(skyStars.userData.twinkleTime * 2 + i);

                // Update star brightness
                colors.array[i * 3] *= twinkle;
                colors.array[i * 3 + 1] *= twinkle;
                colors.array[i * 3 + 2] *= twinkle;
            }
        }

        colors.needsUpdate = true;
        skyStars.material.opacity = baseOpacity * skyStars.userData.originalOpacity;
    }
}

