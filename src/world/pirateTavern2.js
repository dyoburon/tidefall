import * as THREE from 'three';
import { applyOutline } from '../theme/outlineStyles.js'; // Import our outline system

/**
 * Creates a Floating Market Dock with multiple platforms, bridges, and market stalls
 * @param {Object} params - Parameters for the dock
 * @returns {THREE.Group} - The created market dock object
 */
export function createPirateTavern2(params) {
    const {
        parent,
        random = Math.random,
        position = new THREE.Vector3(0, 0, 0),
        rotation = 0,
        scale = 1.0
    } = params;



    // Create container for the floating market
    const market = new THREE.Group();
    market.position.copy(position);
    market.rotation.y = rotation;
    parent.add(market);

    // Materials - Darker wood colors for Southeast Asian inspired market
    const woodMaterial = new THREE.MeshBasicMaterial({ color: 0x5D2906 });
    const darkWoodMaterial = new THREE.MeshBasicMaterial({ color: 0x2A1914 });
    const bambooDarkMaterial = new THREE.MeshBasicMaterial({ color: 0x59452A });
    const bambooLightMaterial = new THREE.MeshBasicMaterial({ color: 0x95864C });
    const ropeMaterial = new THREE.MeshBasicMaterial({ color: 0xAA8866 });

    // Canopy colors - less vibrant
    const canopyColors = [
        0xC64945,
        0x3B85C6,
        0xD4AA22,
        0x549E56,
        0x8A3B94,
        0xD35A37
    ];

    const canopyMaterials = canopyColors.map(color =>
        new THREE.MeshBasicMaterial({ color })
    );

    // Water-related materials
    const waterBaseMaterial = new THREE.MeshBasicMaterial({ color: 0x1A7DCB });
    const waterSurfaceMaterial = new THREE.MeshBasicMaterial({
        color: 0x4F92D1,
        transparent: true,
        opacity: 0.5
    });

    // Goods and merchandise materials
    const fruitsMaterial = new THREE.MeshBasicMaterial({ color: 0xFF9800 });
    const vegetablesMaterial = new THREE.MeshBasicMaterial({ color: 0x8BC34A });
    const fabricsMaterial = new THREE.MeshBasicMaterial({ color: 0x9C27B0 });
    const potteryMaterial = new THREE.MeshBasicMaterial({ color: 0x795548 });
    const metalMaterial = new THREE.MeshBasicMaterial({ color: 0xB0BEC5 });

    // Dimensions for positioning
    const mainWidth = 50 * scale; // Increased from 30 for more spread
    const mainLength = 55 * scale; // Increased from 35 for more spread  
    const platformHeight = 1 * scale;
    const waterLevel = -0.5 * scale;

    // Create individual stalls spread out more (no platforms)
    const stallCount = 2 + Math.floor(random() * 3); // 5-7 stalls

    for (let i = 0; i < stallCount; i++) {
        // Position stalls in a wider circle
        const angle = (i / stallCount) * Math.PI * 2;
        const distance = (mainWidth / 2) * (1 + random() * 0.5); // Much wider spread

        // Create a small platform for each stall - REDUCED SIZE
        const stallSize = 5 * scale + random() * 2 * scale;
        // Make platform just slightly larger than the stall (tighter fit)
        const stallPlatformSize = stallSize * 1.3; // Reduced from 8 * scale to be just a bit bigger than stall

        const stallPos = new THREE.Vector3(
            Math.cos(angle) * distance,
            waterLevel,
            Math.sin(angle) * distance
        );

        // Create a small individual platform for each stall
        const stallPlatform = createFloatingPlatform(
            market,
            stallPlatformSize,
            stallPlatformSize,
            platformHeight,
            stallPos,
            woodMaterial,
            waterSurfaceMaterial
        );

        // Randomize canopy color
        const canopyMaterial = canopyMaterials[Math.floor(random() * canopyMaterials.length)];

        // Create market stall on this small platform
        createMarketStall(
            market,
            new THREE.Vector3(stallPos.x, platformHeight, stallPos.z),
            random() * Math.PI * 2, // Random orientation
            stallSize,
            stallSize,
            bambooDarkMaterial,
            bambooLightMaterial,
            canopyMaterial,
            scale
        );

        // Randomly add a sitting person to about 1 in 4 stalls
        if (random() < 0.25) {
            addPersonSitting(
                market,
                new THREE.Vector3(
                    stallPos.x + (random() - 0.5) * stallSize * 0.4,
                    platformHeight,
                    stallPos.z + (random() - 0.5) * stallSize * 0.4
                ),
                random() * Math.PI * 2, // Random orientation
                scale
            );
        }

        // Add some hanging lanterns to each stall
        const lanternCount = 1 + Math.floor(random() * 2); // 1-2 lanterns per stall

        for (let j = 0; j < lanternCount; j++) {
            const lanternAngle = random() * Math.PI * 2;
            const lanternDistance = random() * stallPlatformSize * 0.4;

            const lanternPos = new THREE.Vector3(
                stallPos.x + Math.cos(lanternAngle) * lanternDistance,
                platformHeight + (2 + random() * 2) * scale, // Slightly lower
                stallPos.z + Math.sin(lanternAngle) * lanternDistance
            );

            // Create a slightly smaller lantern
            createLantern(
                market,
                lanternPos,
                0.6 * scale + random() * 0.3 * scale, // Reduced from 0.8 * scale + random() * 0.4
                canopyMaterials[Math.floor(random() * canopyMaterials.length)],
                bambooLightMaterial,
                ropeMaterial,
                scale
            );
        }

        // Add market goods to each stall
        const goodsCount = 2 + Math.floor(random() * 3);

        for (let k = 0; k < goodsCount; k++) {
            const goodsAngle = random() * Math.PI * 2;
            const goodsDistance = random() * stallPlatformSize * 0.3;

            const goodsPos = new THREE.Vector3(
                stallPos.x + Math.cos(goodsAngle) * goodsDistance,
                platformHeight,
                stallPos.z + Math.sin(goodsAngle) * goodsDistance
            );

            addRandomGoodsItem(
                market,
                goodsPos,
                [fruitsMaterial, vegetablesMaterial, fabricsMaterial, potteryMaterial],
                darkWoodMaterial,
                scale,
                random
            );
        }
    }

    // Add small boats between stalls
    const boatCount = Math.floor(stallCount * 0.7);
    for (let i = 0; i < boatCount; i++) {
        const angle = random() * Math.PI * 2;
        const distance = mainWidth * 0.7 * random();

        const boatPos = new THREE.Vector3(
            Math.cos(angle) * distance,
            waterLevel,
            Math.sin(angle) * distance
        );

        createSimpleBoat(
            market,
            boatPos,
            random() * Math.PI * 2,
            3 * scale + random() * 2 * scale,
            woodMaterial,
            darkWoodMaterial,
            scale
        );
    }

    // Add water ripples - REDUCED GLOW EFFECT
    const rippleCount = 15 + Math.floor(random() * 10);

    for (let i = 0; i < rippleCount; i++) {
        const angle = random() * Math.PI * 2;
        const distance = mainWidth * random();

        const ripplePos = new THREE.Vector3(
            Math.cos(angle) * distance,
            waterLevel + 0.05 * scale,
            Math.sin(angle) * distance
        );

        const rippleSize = 0.5 * scale + random() * scale;
        const ripple = new THREE.Mesh(
            new THREE.CircleGeometry(rippleSize, 8),
            new THREE.MeshBasicMaterial({
                color: 0xFFFFFF,
                transparent: true,
                opacity: 0.1 + random() * 0.1
            })
        );

        ripple.rotation.x = -Math.PI / 2; // Lay flat on water
        ripple.position.copy(ripplePos);

        market.add(ripple);
    }

    // Apply outline effect to the entire market structure
    applyOutline(market, {
        recursive: true,  // Apply to all children meshes
        // Don't outline transparent objects like water or windows
        filter: (mesh) => !mesh.material.transparent,
        // Slightly smaller outline than default for more subtle effect
        scale: 1.12
    });



    return market;
}

/**
 * Creates a floating platform with water surface effect
 */
function createFloatingPlatform(parent, width, length, height, position, floorMaterial, waterMaterial) {
    // Platform group
    const platform = new THREE.Group();
    platform.position.copy(position);

    // Main platform deck
    const deck = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, length),
        floorMaterial
    );
    deck.position.y = height / 2;
    platform.add(deck);

    // Create wood planks on top for detail
    const plankWidth = width * 1.05;
    const plankDepth = 1;
    const plankCount = Math.floor(length / (plankDepth * 1.5));

    for (let i = 0; i < plankCount; i++) {
        const plank = new THREE.Mesh(
            new THREE.BoxGeometry(plankWidth, height * 0.2, plankDepth),
            floorMaterial
        );
        plank.position.set(
            0,
            height,
            (i - plankCount / 2) * plankDepth * 1.5
        );
        platform.add(plank);
    }

    // Create a subtle water surface effect around the platform
    const waterPadding = 2;
    const water = new THREE.Mesh(
        new THREE.BoxGeometry(width + waterPadding, 0.1, length + waterPadding),
        waterMaterial
    );
    water.position.y = -0.5;
    platform.add(water);

    // Add flotation barrels underneath
    const barrelCount = Math.floor((width * length) / 50);
    for (let i = 0; i < barrelCount; i++) {
        const barrelRadius = 0.8;
        const barrelHeight = 2;

        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(barrelRadius, barrelRadius, barrelHeight, 8),
            floorMaterial
        );

        // Position randomly underneath the platform
        barrel.position.set(
            (Math.random() - 0.5) * (width - barrelRadius * 2),
            -barrelHeight / 2,
            (Math.random() - 0.5) * (length - barrelRadius * 2)
        );

        // Some barrels are horizontal
        if (Math.random() > 0.5) {
            barrel.rotation.z = Math.PI / 2;
            barrel.position.y = -barrelRadius;
        }

        platform.add(barrel);
    }

    parent.add(platform);
    return platform;
}

/**
 * Creates a bridge connecting two points
 */
function createBridge(parent, start, end, floorMaterial, railMaterial, ropeMaterial, scale) {
    const bridge = new THREE.Group();

    // Calculate bridge dimensions
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const width = 3 * scale;

    // Create center position and orientation
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    bridge.position.copy(center);

    // Orient bridge to face the right direction
    bridge.lookAt(end);

    // Create bridge deck with planks
    const plankCount = Math.floor(length / (scale * 1.2));
    const plankSpacing = length / plankCount;

    for (let i = 0; i < plankCount; i++) {
        const plank = new THREE.Mesh(
            new THREE.BoxGeometry(width, 0.3 * scale, 0.8 * scale),
            floorMaterial
        );

        plank.position.z = (i - plankCount / 2 + 0.5) * plankSpacing;

        // Add slight curve to bridge (higher in middle)
        const curveHeight = Math.sin((i / plankCount) * Math.PI) * scale * 0.5;
        plank.position.y = curveHeight;

        bridge.add(plank);
    }

    // Create rope railings on both sides
    const postHeight = 2 * scale;
    const postCount = Math.floor(plankCount / 3) + 1;
    const postSpacing = length / (postCount - 1);

    // Create posts
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < postCount; i++) {
            const post = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, postHeight, 6),
                railMaterial
            );

            post.position.set(
                side * width / 2,
                postHeight / 2,
                (i - (postCount - 1) / 2) * postSpacing
            );

            // Add slight curve to match bridge
            const posZ = (i - (postCount - 1) / 2) * postSpacing;
            const normalizedPos = (posZ + length / 2) / length;
            const curveHeight = Math.sin(normalizedPos * Math.PI) * scale * 0.5;
            post.position.y += curveHeight;

            bridge.add(post);
        }

        // Create rope between posts
        for (let i = 0; i < postCount - 1; i++) {
            const ropeStart = new THREE.Vector3(
                side * width / 2,
                postHeight * 0.8,
                (i - (postCount - 1) / 2) * postSpacing
            );

            const ropeEnd = new THREE.Vector3(
                side * width / 2,
                postHeight * 0.8,
                (i + 1 - (postCount - 1) / 2) * postSpacing
            );

            // Add curve to ropes
            const startCurve = Math.sin(((i - (postCount - 1) / 2) * postSpacing + length / 2) / length * Math.PI) * scale * 0.5;
            const endCurve = Math.sin(((i + 1 - (postCount - 1) / 2) * postSpacing + length / 2) / length * Math.PI) * scale * 0.5;
            ropeStart.y += startCurve;
            ropeEnd.y += endCurve;

            // Create a series of small segments to simulate curved rope
            const segments = 8;
            let prevPoint = ropeStart.clone();

            for (let j = 1; j <= segments; j++) {
                const t = j / segments;
                const point = new THREE.Vector3().lerpVectors(ropeStart, ropeEnd, t);

                // Add a slight drooping effect
                point.y -= Math.sin(t * Math.PI) * 0.3 * scale;

                const segment = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, prevPoint.distanceTo(point), 4),
                    ropeMaterial
                );

                // Position and orient the segment
                const segmentCenter = new THREE.Vector3().addVectors(prevPoint, point).multiplyScalar(0.5);
                segment.position.copy(segmentCenter);

                // Orient segment to connect the points
                segment.lookAt(point);
                segment.rotation.x += Math.PI / 2;

                bridge.add(segment);
                prevPoint = point.clone();
            }
        }
    }

    parent.add(bridge);
    return bridge;
}

/**
 * Creates a market stall with canopy
 */
function createMarketStall(parent, position, orientation, width, depth, frameMaterial, counterMaterial, canopyMaterial, scale) {
    const stall = new THREE.Group();
    stall.position.copy(position);
    stall.rotation.y = orientation;

    // Counter/table
    const counterHeight = 1.2 * scale;
    const counter = new THREE.Mesh(
        new THREE.BoxGeometry(width, counterHeight, depth),
        counterMaterial
    );
    counter.position.y = counterHeight / 2;
    stall.add(counter);

    // Canopy posts (4 corners)
    const postHeight = 4 * scale;
    const postPositions = [
        [-width / 2, 0, -depth / 2],
        [width / 2, 0, -depth / 2],
        [width / 2, 0, depth / 2],
        [-width / 2, 0, depth / 2]
    ];

    postPositions.forEach(pos => {
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, postHeight, 6),
            frameMaterial
        );
        post.position.set(pos[0], postHeight / 2, pos[2]);
        stall.add(post);
    });

    // Canopy top
    const canopyHeight = 0.5 * scale;
    const canopyPadding = 0.8 * scale;
    const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(width + canopyPadding, canopyHeight, depth + canopyPadding),
        canopyMaterial
    );
    canopy.position.y = postHeight - canopyHeight / 2;
    stall.add(canopy);

    // Add hanging canopy sides
    const sides = [
        // Front
        {
            size: [width + canopyPadding, postHeight - counterHeight, 0.1 * scale],
            position: [0, (postHeight + counterHeight) / 2, depth / 2 + canopyPadding / 2]
        },
        // Back
        {
            size: [width + canopyPadding, postHeight - counterHeight, 0.1 * scale],
            position: [0, (postHeight + counterHeight) / 2, -depth / 2 - canopyPadding / 2]
        },
        // Left
        {
            size: [0.1 * scale, postHeight - counterHeight, depth + canopyPadding],
            position: [-width / 2 - canopyPadding / 2, (postHeight + counterHeight) / 2, 0]
        },
        // Right
        {
            size: [0.1 * scale, postHeight - counterHeight, depth + canopyPadding],
            position: [width / 2 + canopyPadding / 2, (postHeight + counterHeight) / 2, 0]
        }
    ];

    sides.forEach((side, index) => {
        // Only add side drapes sometimes
        if (index > 1 && Math.random() > 0.5) return;

        const drape = new THREE.Mesh(
            new THREE.BoxGeometry(side.size[0], side.size[1], side.size[2]),
            canopyMaterial
        );
        drape.position.set(side.position[0], side.position[1], side.position[2]);

        // Add slight waviness to drapes
        if (index <= 1) { // Front/back
            drape.geometry = new THREE.BoxGeometry(
                side.size[0],
                side.size[1],
                side.size[2],
                Math.ceil(side.size[0] / scale), // More segments for waviness
                1,
                1
            );

            // Manipulate vertices to create wavy bottom
            const positionAttribute = drape.geometry.getAttribute('position');
            for (let i = 0; i < positionAttribute.count; i++) {
                const y = positionAttribute.getY(i);
                const x = positionAttribute.getX(i);

                // Only modify bottom vertices
                if (y < -side.size[1] / 2 + 0.1) {
                    // Create wavy pattern
                    const wave = Math.sin(x * 5) * 0.2 * scale;
                    positionAttribute.setY(i, y + wave);
                }
            }

            drape.geometry.computeVertexNormals();
        }

        stall.add(drape);
    });

    parent.add(stall);
    return stall;
}

/**
 * Creates a hanging lantern
 */
function createLantern(parent, position, size, colorMaterial, frameMaterial, ropeMaterial, scale) {
    const lantern = new THREE.Group();
    lantern.position.copy(position);

    // Lantern body
    const lanternBody = new THREE.Mesh(
        new THREE.BoxGeometry(size, size * 1.5, size),
        colorMaterial
    );
    lantern.add(lanternBody);

    // Lantern frame
    const frameThickness = 0.1 * scale;
    const frameSize = size + frameThickness;

    // Vertical frame pieces
    for (let x = -1; x <= 1; x += 2) {
        for (let z = -1; z <= 1; z += 2) {
            const vertical = new THREE.Mesh(
                new THREE.BoxGeometry(frameThickness, size * 1.5, frameThickness),
                frameMaterial
            );
            vertical.position.set(x * size / 2, 0, z * size / 2);
            lantern.add(vertical);
        }
    }

    // Horizontal frame pieces - top and bottom
    for (let y = -1; y <= 1; y += 2) {
        const horizontal = new THREE.Mesh(
            new THREE.BoxGeometry(frameSize, frameThickness, frameSize),
            frameMaterial
        );
        horizontal.position.y = y * size * 0.75;
        lantern.add(horizontal);
    }

    // Top ornament
    const topPiece = new THREE.Mesh(
        new THREE.ConeGeometry(size / 2, size / 2, 4),
        frameMaterial
    );
    topPiece.position.y = size * 0.75 + size / 4;
    lantern.add(topPiece);

    // Hanging rope
    const ropeLength = 2 * scale + Math.random() * 3 * scale;
    const rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, ropeLength, 4),
        ropeMaterial
    );
    rope.position.y = size * 0.75 + size / 2 + ropeLength / 2;
    lantern.add(rope);

    parent.add(lantern);
    return lantern;
}

/**
 * Adds market goods and merchandise to platforms
 */
function addMarketGoods(parent, mainWidth, mainLength, platformHeight, satellitePlatforms, materialOptions, cratesMaterial, scale, random) {
    // Add crates and goods on main platform
    const mainGoodsCount = 15 + Math.floor(random() * 10);

    for (let i = 0; i < mainGoodsCount; i++) {
        // Position randomly but not in the center (leave walking space)
        const minDist = mainWidth * 0.25;
        const maxDist = mainWidth * 0.45;
        const angle = random() * Math.PI * 2;
        const distance = minDist + random() * (maxDist - minDist);

        const goodsPos = new THREE.Vector3(
            Math.cos(angle) * distance,
            platformHeight,
            Math.sin(angle) * distance
        );

        addRandomGoodsItem(parent, goodsPos, materialOptions, cratesMaterial, scale, random);
    }

    // Add goods on satellite platforms - FIXED WITH SAFETY CHECKS
    if (!Array.isArray(satellitePlatforms)) {

        return;
    }

    satellitePlatforms.forEach((platform, index) => {
        try {
            // Verify platform has required properties
            if (!platform) {

                return;
            }

            if (typeof platform.size === 'undefined') {

                platform.size = 12 * scale; // Set a default size
            }

            if (!platform.position) {

                platform.position = new THREE.Vector3(0, 0, 0);
            }

            const goodsCount = 3 + Math.floor(random() * 4);

            for (let i = 0; i < goodsCount; i++) {
                const angle = random() * Math.PI * 2;
                const distance = random() * platform.size * 0.3;

                const goodsPos = new THREE.Vector3(
                    platform.position.x + Math.cos(angle) * distance,
                    platformHeight,
                    platform.position.z + Math.sin(angle) * distance
                );

                addRandomGoodsItem(parent, goodsPos, materialOptions, cratesMaterial, scale, random);
            }
        } catch (error) {

        }
    });
}

/**
 * Adds a random market goods item (crate, bowl, stack of fabric, etc.)
 */
function addRandomGoodsItem(parent, position, materialOptions, cratesMaterial, scale, random) {
    // Safety check for parameters
    if (!parent || !position || !materialOptions || !cratesMaterial || !random) {

        return null;
    }

    const itemType = Math.floor(random() * 4);
    const material = materialOptions[Math.floor(random() * materialOptions.length)];

    let goods;

    try {
        switch (itemType) {
            case 0: // Crate of goods
                goods = new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.8 * scale + random() * 0.6 * scale,
                        0.8 * scale + random() * 0.6 * scale,
                        0.8 * scale + random() * 0.6 * scale
                    ),
                    cratesMaterial
                );
                if (goods && goods.position && position) {
                    goods.position.y = position.y + goods.geometry.parameters.height / 2;
                }
                break;

            case 1: // Bowl/basket of items
                const radius = 0.7 * scale + random() * 0.5 * scale;
                const height = 0.5 * scale + random() * 0.3 * scale;

                goods = new THREE.Group();

                const bowl = new THREE.Mesh(
                    new THREE.CylinderGeometry(radius, radius * 0.7, height, 8),
                    cratesMaterial
                );

                const contents = new THREE.Mesh(
                    new THREE.SphereGeometry(radius * 0.9, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
                    material
                );
                contents.position.y = height * 0.3;

                goods.add(bowl);
                goods.add(contents);

                if (goods && goods.position && position) {
                    goods.position.copy(position);
                    goods.position.y += height / 2;
                }
                break;

            case 2: // Stack of fabric/goods
                const layers = 1 + Math.floor(random() * 4);
                goods = new THREE.Group();

                for (let i = 0; i < layers; i++) {
                    const layer = new THREE.Mesh(
                        new THREE.BoxGeometry(
                            1 * scale + random() * 0.5 * scale,
                            0.2 * scale,
                            1 * scale + random() * 0.5 * scale
                        ),
                        i % 2 === 0 ? material : materialOptions[Math.floor(random() * materialOptions.length)]
                    );
                    layer.position.y = i * 0.2 * scale;
                    goods.add(layer);
                }

                if (goods && goods.position && position) {
                    goods.position.copy(position);
                    goods.position.y += 0.1 * scale;
                }
                break;

            case 3: // Pile of goods
                goods = new THREE.Group();
                const itemCount = 3 + Math.floor(random() * 5);

                for (let i = 0; i < itemCount; i++) {
                    const itemSize = 0.3 * scale + random() * 0.2 * scale;
                    const item = new THREE.Mesh(
                        random() > 0.5
                            ? new THREE.SphereGeometry(itemSize, 8, 6)
                            : new THREE.BoxGeometry(itemSize * 1.5, itemSize, itemSize * 1.2),
                        material
                    );

                    if (item && item.position) {
                        item.position.set(
                            (random() - 0.5) * scale * 0.6,
                            (i * 0.5 + random() * 0.2) * itemSize,
                            (random() - 0.5) * scale * 0.6
                        );
                    }

                    // Random rotation - ADDED SAFETY CHECK
                    if (item && item.rotation) {
                        item.rotation.set(
                            random() * Math.PI,
                            random() * Math.PI,
                            random() * Math.PI
                        );
                    }

                    goods.add(item);
                }

                if (goods && goods.position && position) {
                    goods.position.copy(position);
                    goods.position.y += 0.15 * scale;
                }
                break;
        }

        // Random rotation for variety - ADDED SAFETY CHECK
        if (goods && goods.rotation) {
            goods.rotation.y = random() * Math.PI * 2;
        } else {

        }

        if (parent && goods) {
            parent.add(goods);
            return goods;
        } else {

            return null;
        }
    } catch (error) {

        return null;
    }
}

/**
 * Adds ambient details - boats, etc.
 */
function addAmbientDetails(parent, waterLevel, mainWidth, mainLength, woodMaterial, darkWoodMaterial, waterMaterial, scale, random) {
    // Small boats around the market
    const boatCount = 2 + Math.floor(random() * 3);

    for (let i = 0; i < boatCount; i++) {
        const angle = random() * Math.PI * 2;
        const distance = (mainWidth / 2 + 10 * scale) + random() * 15 * scale;

        const boatPos = new THREE.Vector3(
            Math.cos(angle) * distance,
            waterLevel,
            Math.sin(angle) * distance
        );

        // Create a simple boat
        createSimpleBoat(
            parent,
            boatPos,
            angle + Math.PI, // Face toward market
            3 * scale + random() * 2 * scale,
            woodMaterial,
            darkWoodMaterial,
            scale
        );
    }

    // Water ripples/effects
    const rippleCount = 20 + Math.floor(random() * 15);

    for (let i = 0; i < rippleCount; i++) {
        const angle = random() * Math.PI * 2;
        const distance = 5 * scale + random() * mainWidth;

        const ripplePos = new THREE.Vector3(
            Math.cos(angle) * distance,
            waterLevel + 0.05 * scale,
            Math.sin(angle) * distance
        );

        // Create a simple ripple effect
        const rippleSize = 0.5 * scale + random() * scale;
        const ripple = new THREE.Mesh(
            new THREE.CircleGeometry(rippleSize, 8),
            new THREE.MeshBasicMaterial({
                color: 0xFFFFFF,
                transparent: true,
                opacity: 0.2 + random() * 0.2
            })
        );

        ripple.rotation.x = -Math.PI / 2; // Lay flat on water
        ripple.position.copy(ripplePos);

        parent.add(ripple);
    }
}

/**
 * Creates a simple boat
 */
function createSimpleBoat(parent, position, orientation, size, bodyMaterial, detailMaterial, scale) {
    const boat = new THREE.Group();
    boat.position.copy(position);
    boat.rotation.y = orientation;

    // Boat hull - using a custom shape
    const hullLength = size * 3;
    const hullWidth = size;
    const hullHeight = size * 0.8;

    // Create custom geometry for boat hull
    const hullGeometry = new THREE.BufferGeometry();

    // Define hull shape vertices
    const vertices = [
        // Bottom vertices
        -hullLength / 2, 0, 0,                 // 0: back bottom
        hullLength / 2, 0, 0,                  // 1: front bottom

        // Side vertices
        -hullLength / 2, hullHeight, -hullWidth / 2,  // 2: back left
        -hullLength / 2, hullHeight, hullWidth / 2,   // 3: back right
        0, hullHeight, -hullWidth / 2,              // 4: middle left
        0, hullHeight, hullWidth / 2,               // 5: middle right
        hullLength / 2, hullHeight, 0,              // 6: front point
    ];

    // Define faces using indices
    const indices = [
        // Bottom faces
        0, 1, 3,
        1, 5, 3,
        0, 2, 1,
        1, 2, 4,
        1, 4, 6,
        1, 6, 5,

        // Side faces
        2, 0, 3,
        4, 2, 3,
        4, 3, 5,
        4, 5, 6
    ];

    hullGeometry.setIndex(indices);
    hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    hullGeometry.computeVertexNormals();

    const hull = new THREE.Mesh(hullGeometry, bodyMaterial);
    boat.add(hull);

    // Add bench seats
    const benchCount = 2 + Math.floor(Math.random() * 2);
    const benchSpacing = hullLength * 0.7 / (benchCount + 1);

    for (let i = 1; i <= benchCount; i++) {
        const bench = new THREE.Mesh(
            new THREE.BoxGeometry(0.5 * scale, 0.2 * scale, hullWidth * 0.8),
            detailMaterial
        );
        bench.position.set(
            -hullLength / 2 + benchSpacing * i,
            hullHeight,
            0
        );
        boat.add(bench);
    }

    // Add a simple paddle/oar
    const paddleLength = hullLength * 0.8;
    const paddle = new THREE.Group();

    const paddleHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, paddleLength, 6),
        detailMaterial
    );
    paddleHandle.rotation.z = Math.PI / 2;
    paddleHandle.position.y = 0.2 * scale;
    paddle.add(paddleHandle);

    const paddleBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 * scale, 0.1 * scale, 0.4 * scale),
        detailMaterial
    );
    paddleBlade.position.set(paddleLength / 2 - 0.4 * scale, 0.2 * scale, 0);
    paddle.add(paddleBlade);

    // Position paddle in boat
    paddle.rotation.y = Math.PI / 6 * (Math.random() > 0.5 ? 1 : -1); // Slight angle
    paddle.position.set(-hullLength / 4, hullHeight, hullWidth / 2 * 0.7 * (Math.random() > 0.5 ? 1 : -1));
    boat.add(paddle);

    // Add some random cargo if needed
    if (Math.random() > 0.3) {
        const cargo = new THREE.Mesh(
            new THREE.BoxGeometry(hullLength * 0.3, hullHeight * 0.6, hullWidth * 0.6),
            detailMaterial
        );
        cargo.position.set(hullLength * 0.1, hullHeight + hullHeight * 0.3, 0);
        boat.add(cargo);
    }

    parent.add(boat);
    return boat;
}

/**
 * Creates a simple person sitting on a chair/stool
 */
function addPersonSitting(parent, position, orientation, scale) {
    const person = new THREE.Group();
    person.position.copy(position);
    person.rotation.y = orientation;

    // Chair/stool
    const stoolHeight = 0.8 * scale;
    const stoolRadius = 0.6 * scale;
    const stool = new THREE.Mesh(
        new THREE.CylinderGeometry(stoolRadius, stoolRadius * 0.8, stoolHeight, 6),
        new THREE.MeshBasicMaterial({ color: 0x3A2611 }) // Dark wood color
    );
    stool.position.y = stoolHeight / 2;
    person.add(stool);

    // Person's body
    const bodyHeight = 1.3 * scale;
    const bodyWidth = 0.7 * scale;
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyWidth),
        new THREE.MeshBasicMaterial({ color: 0x4A6572 }) // Muted blue/gray for clothing
    );
    body.position.y = stoolHeight + bodyHeight / 2;
    person.add(body);

    // Person's head
    const headRadius = 0.4 * scale;
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xD2B48C }) // Tan skin color
    );
    head.position.y = stoolHeight + bodyHeight - bodyWidth * 0.1 + headRadius;
    person.add(head);

    // Person's arms
    const armLength = 0.8 * scale;
    const armWidth = 0.25 * scale;

    // Left arm
    const leftArm = new THREE.Mesh(
        new THREE.BoxGeometry(armWidth, armLength, armWidth),
        new THREE.MeshBasicMaterial({ color: 0x4A6572 }) // Same color as body
    );
    leftArm.position.set(
        -bodyWidth / 2 - armWidth / 2,
        stoolHeight + bodyHeight * 0.7,
        0
    );
    // Rotate arm forward slightly
    leftArm.rotation.z = -Math.PI / 8;
    person.add(leftArm);

    // Right arm
    const rightArm = new THREE.Mesh(
        new THREE.BoxGeometry(armWidth, armLength, armWidth),
        new THREE.MeshBasicMaterial({ color: 0x4A6572 }) // Same color as body
    );
    rightArm.position.set(
        bodyWidth / 2 + armWidth / 2,
        stoolHeight + bodyHeight * 0.7,
        0
    );
    // Rotate arm forward slightly
    rightArm.rotation.z = Math.PI / 8;
    person.add(rightArm);

    // Legs (simplified to be sitting)
    const legLength = 0.6 * scale;
    const legWidth = 0.3 * scale;

    // Left leg
    const leftLeg = new THREE.Mesh(
        new THREE.BoxGeometry(legWidth, legWidth, legLength),
        new THREE.MeshBasicMaterial({ color: 0x333333 }) // Dark pants
    );
    leftLeg.position.set(
        -bodyWidth / 4,
        stoolHeight + legWidth / 2,
        legLength / 2
    );
    person.add(leftLeg);

    // Right leg
    const rightLeg = new THREE.Mesh(
        new THREE.BoxGeometry(legWidth, legWidth, legLength),
        new THREE.MeshBasicMaterial({ color: 0x333333 }) // Dark pants
    );
    rightLeg.position.set(
        bodyWidth / 4,
        stoolHeight + legWidth / 2,
        legLength / 2
    );
    person.add(rightLeg);

    parent.add(person);
    return person;
} 