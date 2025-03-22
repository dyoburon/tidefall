import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Water } from './objects/Water';
import { scene, camera, renderer } from '../core/gameState.js';



// Animation
/*
const clock = new THREE.Clock();

// Scene setup
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Environment map
const cubeTextureLoader = new THREE.CubeTextureLoader();
cubeTextureLoader.setPath('./');
const environmentMap = cubeTextureLoader.load([
  'blackness.jpg', // positive x
  'blackness.jpg', // negative x 
  'blackness.jpg', // positive y
  'blackness.jpg', // negative y
  'blackness.jpg', // positive z
  'blackness.jpg'  // negative z
]);

const poolTexture = new THREE.TextureLoader().load('/threejs-water-shader/ocean_floor.png');

scene.background = environmentMap;
scene.environment = environmentMap;

// Camera position
camera.position.set(0.8, 0.03, 0);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Add some light to see the ground material
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const waterResolution = { size: 512 };
const water = new Water({
  environmentMap,
  resolution: waterResolution.size
});
scene.add(water);


function animate() {
  const elapsedTime = clock.getElapsedTime();
  water.update(elapsedTime);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

const geometry = new THREE.PlaneGeometry(1000, 1000, 32, 32); // 10x10 units, 32x32 segments for slight wave detail

const textureLoader = new THREE.TextureLoader();
const waterTexture = textureLoader.load('./hashingTexture.jpg'); // Update with correct path

// Set the texture to repeat
waterTexture.wrapS = THREE.RepeatWrapping;
waterTexture.wrapT = THREE.RepeatWrapping;
waterTexture.repeat.set(10, 10); // Adjust repeat values as needed for desired scale

// Create material with the texture
const material = new THREE.MeshBasicMaterial({
  map: waterTexture,
  color: 0xffffff, // Use white to show texture true colors, or keep 0xeee7d7 for tinting
  side: THREE.DoubleSide
});

const water = new THREE.Mesh(geometry, material);
water.rotation.x = -Math.PI / 2; // Rotate the plane to lie flat
scene.add(water);

// Animation loop with height map
function animate(time = 0) {
  requestAnimationFrame(animate);

  // Get the vertex positions
  const positions = water.geometry.attributes.position.array;

  // Update vertices for wave effect
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];

    // Simple sine wave displacement for water effect
    const waveHeight = 5; // Adjust this value for wave height
    positions[i + 2] = Math.sin(x * 0.1 + time * 0.001) * waveHeight +
      Math.sin(y * 0.1 + time * 0.001) * waveHeight;
  }

  // Mark positions as needing update
  water.geometry.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
}
animate();


*/



const geometry = new THREE.PlaneGeometry(5000, 5000, 512, 512); // Higher segments for smoother waves

// Load the 2D texture
const textureLoader = new THREE.TextureLoader();
const waterTexture = textureLoader.load('./hashingTexture.jpg'); // Update with correct path
waterTexture.wrapS = THREE.RepeatWrapping; // Repeat horizontally
waterTexture.wrapT = THREE.RepeatWrapping; // Repeat vertically
waterTexture.repeat.set(1, 1); // Default repeat (will be scaled in shader)

// Define the shader material with corrected water.vert and water.frag
const waterMaterial = new THREE.ShaderMaterial({
  vertexShader: `
    precision highp float;

    uniform float uTime;
    uniform float uWavesAmplitude;
    uniform float uWavesSpeed;
    uniform float uWavesFrequency;
    uniform float uWavesPersistence;
    uniform float uWavesLacunarity;
    uniform float uWavesIterations;
    uniform float uPlaneSize; // Add uniform for plane size

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    vec4 permute(vec4 x) {
      return mod(((x * 34.0) + 1.0) * x, 289.0);
    }
    vec4 taylorInvSqrt(vec4 r) {
      return 1.79284291400159 - 0.85373472095314 * r;
    }
    vec3 permute(vec3 x) {
      return mod(((x * 34.0) + 1.0) * x, 289.0); // Fixed: removed "returnUpdater"
    }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m;
      m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    float getElevation(float x, float z) {
      vec2 pos = vec2(x, z);
      float elevation = 0.0;
      float amplitude = 1.0;
      float frequency = uWavesFrequency;
      vec2 p = pos.xy;
      for(float i = 0.0; i < uWavesIterations; i++) {
        float noiseValue = snoise(p * frequency + uTime * uWavesSpeed);
        elevation += amplitude * noiseValue;
        amplitude *= uWavesPersistence;
        frequency *= uWavesLacunarity;
      }
      elevation *= uWavesAmplitude;
      return elevation;
    }


    void main() {
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);
      float elevation = getElevation(modelPosition.x, modelPosition.z);
      modelPosition.y += elevation;

      float eps = 0.001;
      vec3 tangent = normalize(vec3(eps, getElevation(modelPosition.x - eps, modelPosition.z) - elevation, 0.0));
      vec3 bitangent = normalize(vec3(0.0, getElevation(modelPosition.x, modelPosition.z - eps) - elevation, eps));
      vec3 objectNormal = normalize(cross(tangent, bitangent));

      vNormal = objectNormal;
      vWorldPosition = modelPosition.xyz;

      // Scale UVs to repeat texture every 100 units
      float repeatFactor = uPlaneSize / 100.0; // e.g., 5000 / 100 = 50 repeats
      vUv = uv * repeatFactor; // Tile the texture

      gl_Position = projectionMatrix * viewMatrix * modelPosition;
    }
  `,
  fragmentShader: `
    precision highp float;

    uniform float uOpacity;
    uniform vec3 uTroughColor;
    uniform vec3 uSurfaceColor;
    uniform vec3 uPeakColor;
    uniform float uPeakThreshold;
    uniform float uPeakTransition;
    uniform float uTroughThreshold;
    uniform float uTroughTransition;
    uniform float uFresnelScale;
    uniform float uFresnelPower;
    uniform sampler2D uTexture; // Using sampler2D for the texture

    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv; // Receive UV coordinates

    void main() {
      vec3 viewDirection = normalize(vWorldPosition - cameraPosition);
      float fresnel = uFresnelScale * pow(1.0 - clamp(dot(viewDirection, vNormal), 0.0, 1.0), uFresnelPower);

      // Sample the 2D texture
      vec4 textureColor = texture2D(uTexture, vUv);

      float elevation = vWorldPosition.y;
      float peakFactor = smoothstep(uPeakThreshold - uPeakTransition, uPeakThreshold + uPeakTransition, elevation);
      float troughFactor = smoothstep(uTroughThreshold - uTroughTransition, uTroughThreshold + uTroughTransition, elevation);
      vec3 mixedColor1 = mix(uTroughColor, uSurfaceColor, troughFactor);
      vec3 mixedColor2 = mix(mixedColor1, uPeakColor, peakFactor);

      // Combine texture color with elevation-based color
      vec3 finalColor = mix(mixedColor2, textureColor.rgb, 0.5); // Adjust mix factor as needed
      finalColor = mix(finalColor, vec3(1.0), fresnel); // Optional Fresnel effect

      gl_FragColor = vec4(finalColor, uOpacity);
    }
  `,
  uniforms: {
    uTime: { value: 0.0 },
    uWavesAmplitude: { value: 1.0 },
    uWavesSpeed: { value: 0.5 },
    uWavesFrequency: { value: 0.02 },
    uWavesPersistence: { value: 0.5 },
    uWavesLacunarity: { value: 2.0 },
    uWavesIterations: { value: 4.0 },
    uOpacity: { value: 1.0 },
    uTroughColor: { value: new THREE.Vector3(0.0, 0.0, 0.0) }, // Dark blue
    uSurfaceColor: { value: new THREE.Vector3(0.0, 0.0, 0.0) }, // Mid blue
    uPeakColor: { value: new THREE.Vector3(0.0, 0.0, 0.0) }, // White peaks
    uPeakThreshold: { value: 0.5 },
    uPeakTransition: { value: 0.3 },
    uTroughThreshold: { value: -0.5 },
    uTroughTransition: { value: 0.3 },
    uFresnelScale: { value: 1.0 },
    uFresnelPower: { value: 3.0 },
    uTexture: { value: waterTexture }, // Set the 2D texture here
    uPlaneSize: { value: 200.0 } // Set initial plane size (update later if resized)
  },
  side: THREE.DoubleSide, // Optional: render both sides of the plane
  transparent: true // Needed for uOpacity to work
});

// Create the water mesh
waterMaterial.uniforms.uPlaneSize.value = 5000.0; // Update uniform to match
const water = new THREE.Mesh(geometry, waterMaterial);
water.rotation.x = -Math.PI / 2; // Rotate to lie flat
scene.add(water);

// Animation loop
function animate(time = 0) {
  requestAnimationFrame(animate);
  waterMaterial.uniforms.uTime.value = time * 0.001; // Convert to seconds
  renderer.render(scene, camera);
}
animate();


// Export function to integrate water with existing scene
export function integrateWaterSystem(targetScene, targetCamera, options = {}) {
  // Default options

  // const waterOptions = {
  //   resolution: options.resolution || 512,
  //   environmentMap: options.environmentMap || scene.environment,
  // };

  // // Create water instance with provided options
  // const integratedWater = new Water({
  //   environmentMap: waterOptions.environmentMap,
  //   resolution: waterOptions.resolution
  // });

  // // Add water to the provided scene
  // targetScene.add(integratedWater);

  // // Update function that can be called in the main animation loop
  // const updateWaterSystem = (elapsedTime) => {
  //   integratedWater.update(elapsedTime);
  // };

  // // Return objects and update function
  // return {
  //   water: integratedWater,
  //   update: updateWaterSystem
  // };
}
