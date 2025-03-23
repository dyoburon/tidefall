/**
 * Noise utilities for procedural generation
 * Contains various noise functions and random number generators for consistent world generation
 */

// Simplex noise implementation for 2D noise
// Based on improved Perlin noise algorithm

// Permutation table
const permutation = new Uint8Array(512);
let seed = 1;

/**
 * Initialize the noise module with a specific seed
 * @param {number} seedValue - Seed value for random number generation
 */
export function initNoise(seedValue) {
    seed = seedValue;

    // Initialize permutation table with seed
    for (let i = 0; i < 256; i++) {
        permutation[i] = i;
    }

    // Shuffle based on seed
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }

    // Copy to second half of array for wrap-around
    for (let i = 0; i < 256; i++) {
        permutation[i + 256] = permutation[i];
    }
}

/**
 * Seeded random number generator
 * @param {number} s - Optional seed override
 * @returns {number} Random number between 0 and 1
 */
export function seededRandom(s) {
    const useSeed = s !== undefined ? s : seed++;

    // Simple but effective pseudo-random number generator
    // Using a variation of xorshift
    let x = useSeed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;

    // Normalize to 0-1 range
    const result = ((x >>> 0) / 4294967296) + 0.5;
    return result - Math.floor(result);
}

/**
 * Generate 2D simplex noise
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number} Noise value between -1 and 1
 */
export function noise2D(x, y) {
    // Simple implementation of 2D Perlin noise
    // For a procedural water game, this simplified version works well
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = fade(xf);
    const v = fade(yf);

    const A = permutation[X] + Y;
    const B = permutation[X + 1] + Y;

    return lerp(
        v,
        lerp(
            u,
            grad(permutation[A], xf, yf),
            grad(permutation[B], xf - 1, yf)
        ),
        lerp(
            u,
            grad(permutation[A + 1], xf, yf - 1),
            grad(permutation[B + 1], xf - 1, yf - 1)
        )
    );
}

/**
 * Generate octaved noise for more natural results
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate 
 * @param {number} octaves - Number of octaves to use
 * @param {number} persistence - How much each octave contributes
 * @returns {number} Combined noise value between -1 and 1
 */
export function octaveNoise2D(x, y, octaves = 4, persistence = 0.5) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        total += noise2D(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
    }

    return total / maxValue;
}

/**
 * Create ridged noise (absolute value of noise with inversion)
 * Good for terrain features like mountains
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} octaves - Number of octaves
 * @returns {number} Noise value between 0 and 1
 */
export function ridgedNoise2D(x, y, octaves = 4) {
    let result = 0;
    let frequency = 1;
    let amplitude = 0.5;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        // Get absolute noise value and invert
        const n = 1 - Math.abs(noise2D(x * frequency, y * frequency));
        // Square it for more pronounced ridges
        result += n * n * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return result / maxValue;
}

// Helper functions for noise generation

/**
 * Fade function for smoothing
 * @param {number} t - Input value
 * @returns {number} Smoothed value
 */
function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Linear interpolation
 * @param {number} t - Blend factor
 * @param {number} a - First value
 * @param {number} b - Second value
 * @returns {number} Interpolated value
 */
function lerp(t, a, b) {
    return a + t * (b - a);
}

/**
 * Gradient function
 * @param {number} hash - Hash value
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number} Gradient value
 */
function grad(hash, x, y) {
    const h = hash & 15;
    const grad_x = 1 + (h & 7); // Gradient value in x direction
    const grad_y = grad_x & 1 ? 1 : -1; // Gradient value in y direction

    return grad_x * x + grad_y * y;
}

// Initialize with a default seed
initNoise(Math.random() * 65536);