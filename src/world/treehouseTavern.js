import * as THREE from 'three';

/**
 * Creates a Treehouse Tavern built around and between trees
 * @param {Object} params - Parameters for customizing the tavern
 * @param {THREE.Object3D} params.parent - Parent object to attach the tavern to
 * @param {Function} params.random - Random number generator function
 * @param {THREE.Vector3} params.position - Position offset for the tavern
 * @param {Number} params.rotation - Rotation of the tavern (in radians)
 * @param {Number} params.scale - Overall scale factor for the tavern
 * @returns {THREE.Object3D} - The created tavern object
 */
export function createTreehouseTavern(params) {
    const {
        parent,
        random = Math.random,
        position = new THREE.Vector3(0, 0, 0),
        rotation = 0,
        scale = 1.0
    } = params;



    // Create container for the tavern
    const tavern = new THREE.Group();
    tavern.position.copy(position);
    tavern.rotation.y = rotation;
    parent.add(tavern);

    // Materials
    const woodMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
    const darkWoodMaterial = new THREE.MeshBasicMaterial({ color: 0x3D2314 });
    const leafMaterial = new THREE.MeshBasicMaterial({ color: 0x2E8B57 });
    const ropeMaterial = new THREE.MeshBasicMaterial({ color: 0xA0522D });
    const barkMaterial = new THREE.MeshBasicMaterial({ color: 0x5D4037 });
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFCC, transparent: true, opacity: 0.7 });
    const mushroomCapMaterial = new THREE.MeshBasicMaterial({ color: 0x1E90FF });
    const mushroomStemMaterial = new THREE.MeshBasicMaterial({ color: 0xADD8E6 });
    const signMaterial = new THREE.MeshBasicMaterial({ color: 0xDEB887 });
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    // NEW: Add outline material
    const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    });

    // Helper function to add outline effect to any mesh
    function addOutlineEffect(mesh, parent, outlineScale = 1.15) {
        // Create outline mesh with same geometry but slightly larger
        const outlineMesh = new THREE.Mesh(
            mesh.geometry,
            outlineMaterial
        );

        // Copy position, rotation, and scale but make it slightly larger
        outlineMesh.position.copy(mesh.position);
        outlineMesh.rotation.copy(mesh.rotation);
        outlineMesh.scale.copy(mesh.scale).multiplyScalar(outlineScale);

        // Add outline first so it renders behind the main mesh
        parent.add(outlineMesh);

        return outlineMesh;
    }

    // Dimensions - based on the tree sizes in islands.js
    const trunkHeight = 12 * scale; // 60% of MIN_TREE_HEIGHT
    const trunkRadius = 1.2 * scale; // Slightly larger than MIN_TRUNK_RADIUS
    const platformRadius = 8 * scale; // Larger than MIN_FOLIAGE_RADIUS

    // Create "main" artificial tree trunk at center (hub of the tavern)
    const mainTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(trunkRadius * 1.2, trunkRadius * 1.5, trunkHeight * 1.5, 12),
        barkMaterial
    );
    mainTrunk.position.y = trunkHeight * 0.75;
    tavern.add(mainTrunk);

    // Add outline to main trunk
    addOutlineEffect(mainTrunk, tavern);

    // Add bark texture details to the trunk - skipping outlines for small details

    // Create main platform (central tavern area)
    const mainPlatform = new THREE.Mesh(
        new THREE.CylinderGeometry(platformRadius, platformRadius, 1 * scale, 16),
        woodMaterial
    );
    mainPlatform.position.y = trunkHeight * 0.8;
    tavern.add(mainPlatform);

    // Add outline to platform
    addOutlineEffect(mainPlatform, tavern);

    // Create central tavern structure (organic, non-rectangular)
    const tavernWalls = new THREE.Group();
    tavernWalls.position.y = trunkHeight * 0.8 + 0.5 * scale;
    tavern.add(tavernWalls);

    // Create wall sections with varying heights and positions
    const wallSegments = 10;
    const baseWallHeight = 5 * scale;
    const wallVariance = 1.5 * scale;

    for (let i = 0; i < wallSegments; i++) {
        const angle = (i / wallSegments) * Math.PI * 2;
        const nextAngle = ((i + 1) / wallSegments) * Math.PI * 2;

        // Calculate positions
        const x1 = Math.cos(angle) * (platformRadius * 0.9);
        const z1 = Math.sin(angle) * (platformRadius * 0.9);
        const x2 = Math.cos(nextAngle) * (platformRadius * 0.9);
        const z2 = Math.sin(nextAngle) * (platformRadius * 0.9);

        // Wall height varies to create organic look
        const wallHeight = baseWallHeight + (random() * wallVariance - wallVariance / 2);

        // Create wall geometry
        const wallGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            // Bottom vertices
            x1, 0, z1,
            x2, 0, z2,
            0, 0, 0,

            // Top vertices
            x1, wallHeight, z1,
            x2, wallHeight, z2,
            0, wallHeight + (random() * 2 * scale), 0
        ]);

        const indices = [
            // Side faces
            0, 3, 4,
            0, 4, 1,

            // Interior face
            0, 2, 3,
            1, 4, 2,

            // Exterior face
            2, 5, 3,
            2, 4, 5
        ];

        wallGeometry.setIndex(indices);
        wallGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        wallGeometry.computeVertexNormals();

        const wall = new THREE.Mesh(wallGeometry, woodMaterial);
        tavernWalls.add(wall);

        // Skip some segments to create doorways and windows
        if (i % 4 === 0 && i > 0) {
            // Window
            const windowSize = 1.5 * scale;
            const window = new THREE.Mesh(
                new THREE.CircleGeometry(windowSize, 16),
                windowMaterial
            );
            window.position.set(
                (x1 + x2) / 2,
                wallHeight / 2,
                (z1 + z2) / 2
            );
            const windowAngle = (angle + nextAngle) / 2;
            window.rotation.y = windowAngle + Math.PI / 2;
            tavernWalls.add(window);

            // Add outline to window
            addOutlineEffect(window, tavernWalls, 1.1);

            // Window frame
            const windowFrame = new THREE.Mesh(
                new THREE.TorusGeometry(windowSize, 0.3 * scale, 8, 24),
                darkWoodMaterial
            );
            windowFrame.position.copy(window.position);
            windowFrame.rotation.copy(window.rotation);
            tavernWalls.add(windowFrame);

            // Add outline to window frame
            addOutlineEffect(windowFrame, tavernWalls);
        }

        // Main entrance
        if (i === 2) {
            // Door frame
            const doorHeight = baseWallHeight * 0.8;
            const doorWidth = 3 * scale;

            const doorFrame = new THREE.Mesh(
                new THREE.BoxGeometry(doorWidth + 0.6 * scale, doorHeight + 0.6 * scale, 0.4 * scale),
                darkWoodMaterial
            );
            doorFrame.position.set(
                (x1 + x2) / 2,
                doorHeight / 2,
                (z1 + z2) / 2
            );
            const doorAngle = (angle + nextAngle) / 2;
            doorFrame.rotation.y = doorAngle + Math.PI / 2;
            tavernWalls.add(doorFrame);

            // Door (slightly open)
            const door = new THREE.Mesh(
                new THREE.BoxGeometry(doorWidth, doorHeight, 0.3 * scale),
                woodMaterial
            );
            door.position.set(
                (x1 + x2) / 2 + Math.cos(doorAngle + Math.PI / 2) * 0.2,
                doorHeight / 2,
                (z1 + z2) / 2 + Math.sin(doorAngle + Math.PI / 2) * 0.2
            );
            door.rotation.y = doorAngle + Math.PI / 2 - 0.3; // Slightly open
            tavernWalls.add(door);
        }
    }

    tavern.add(tavernWalls);

    // Create a thatched roof with organic shape
    const roofRadius = platformRadius * 1.2;
    const roofHeight = 4 * scale;
    const roofGeometry = new THREE.ConeGeometry(roofRadius, roofHeight, 16, 4);
    const roof = new THREE.Mesh(roofGeometry, leafMaterial);
    roof.position.y = trunkHeight * 0.8 + baseWallHeight + 2 * scale;
    tavern.add(roof);

    // Add outline to roof
    addOutlineEffect(roof, tavern);

    // Add some crossbeams on the ceiling inside
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const beam = new THREE.Mesh(
            new THREE.BoxGeometry(platformRadius * 2, 0.4 * scale, 0.4 * scale),
            darkWoodMaterial
        );
        beam.position.y = trunkHeight * 0.8 + baseWallHeight;
        beam.rotation.y = angle;
        tavern.add(beam);
    }

    // Create secondary platforms/balconies at different heights
    const platformCount = 3; // Number of satellite platforms

    for (let i = 0; i < platformCount; i++) {
        const platformAngle = (i / platformCount) * Math.PI * 2;
        const platformDistance = platformRadius * 1.5;
        const platformHeight = trunkHeight * (0.6 + i * 0.15); // Staggered heights
        const smallPlatformRadius = platformRadius * 0.4;

        // Create support tree trunk
        const supportTrunk = new THREE.Mesh(
            new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius * 0.9, platformHeight, 8),
            barkMaterial
        );
        supportTrunk.position.set(
            Math.cos(platformAngle) * platformDistance,
            platformHeight / 2,
            Math.sin(platformAngle) * platformDistance
        );
        tavern.add(supportTrunk);

        // Add outline to support trunk
        addOutlineEffect(supportTrunk, tavern);

        // Create platform
        const smallPlatform = new THREE.Mesh(
            new THREE.CylinderGeometry(smallPlatformRadius, smallPlatformRadius, 0.5 * scale, 12),
            woodMaterial
        );
        smallPlatform.position.set(
            Math.cos(platformAngle) * platformDistance,
            platformHeight,
            Math.sin(platformAngle) * platformDistance
        );
        tavern.add(smallPlatform);

        // Add outline to small platform
        addOutlineEffect(smallPlatform, tavern);

        // Create small hut on platform
        const hutHeight = 3 * scale;
        const hutRadius = smallPlatformRadius * 0.8;

        const hut = new THREE.Mesh(
            new THREE.CylinderGeometry(hutRadius, hutRadius, hutHeight, 8),
            woodMaterial
        );
        hut.position.set(
            Math.cos(platformAngle) * platformDistance,
            platformHeight + hutHeight / 2 + 0.25 * scale,
            Math.sin(platformAngle) * platformDistance
        );
        tavern.add(hut);

        // Add outline to hut
        addOutlineEffect(hut, tavern);

        // Hut roof
        const hutRoof = new THREE.Mesh(
            new THREE.ConeGeometry(hutRadius * 1.2, hutHeight * 0.6, 8),
            leafMaterial
        );
        hutRoof.position.set(
            Math.cos(platformAngle) * platformDistance,
            platformHeight + hutHeight + 0.5 * scale,
            Math.sin(platformAngle) * platformDistance
        );
        tavern.add(hutRoof);

        // Add outline to hut roof
        addOutlineEffect(hutRoof, tavern);

        // Create window in hut
        const hutWindow = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2 * scale, 1.2 * scale),
            windowMaterial
        );
        hutWindow.position.set(
            Math.cos(platformAngle) * platformDistance + Math.cos(platformAngle + Math.PI / 2) * hutRadius,
            platformHeight + hutHeight / 2 + 0.25 * scale,
            Math.sin(platformAngle) * platformDistance + Math.sin(platformAngle + Math.PI / 2) * hutRadius
        );
        hutWindow.rotation.y = platformAngle + Math.PI / 2;
        tavern.add(hutWindow);

        // Add outline to hut window
        addOutlineEffect(hutWindow, tavern, 1.05);

        // Create connecting rope bridge to main platform
        createRopeBridge(
            new THREE.Vector3(0, trunkHeight * 0.8 + 0.5 * scale, 0),
            new THREE.Vector3(
                Math.cos(platformAngle) * platformDistance,
                platformHeight + 0.25 * scale,
                Math.sin(platformAngle) * platformDistance
            ),
            tavern,
            woodMaterial,
            ropeMaterial,
            scale
        );
    }

    // Add ladder to main platform
    createLadder(
        new THREE.Vector3(platformRadius * 0.7, 0, 0),
        new THREE.Vector3(platformRadius * 0.7, trunkHeight * 0.8, 0),
        tavern,
        darkWoodMaterial,
        scale
    );

    // Add glowing fungi with outlines
    for (let i = 0; i < 16; i++) {
        const isOnTrunk = random() < 0.4;
        let fungiPosition;

        if (isOnTrunk) {
            // Place on main trunk
            const fungiAngle = random() * Math.PI * 2;
            const fungiHeight = random() * trunkHeight;
            fungiPosition = new THREE.Vector3(
                Math.cos(fungiAngle) * trunkRadius * 1.2,
                fungiHeight,
                Math.sin(fungiAngle) * trunkRadius * 1.2
            );
        } else {
            // Place around platforms
            const fungiAngle = random() * Math.PI * 2;
            const fungiRadius = random() * platformRadius * 1.1;
            const platformIndex = Math.floor(random() * platformCount);
            const fungiHeight = trunkHeight * (0.7 + platformIndex * 0.15);

            fungiPosition = new THREE.Vector3(
                Math.cos(fungiAngle) * fungiRadius,
                fungiHeight,
                Math.sin(fungiAngle) * fungiRadius
            );
        }

        createGlowingFungus(fungiPosition, tavern, scale, random, mushroomCapMaterial, mushroomStemMaterial, outlineMaterial);
    }

    // Add sign with outline
    const signWidth = 4 * scale;
    const signHeight = 2 * scale;

    // Sign post
    const signPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4 * scale, 0.4 * scale, 8 * scale, 8),
        darkWoodMaterial
    );
    signPost.position.set(platformRadius * 1.2, 4 * scale, 0);
    tavern.add(signPost);

    // Add outline to sign post
    addOutlineEffect(signPost, tavern);

    // Sign board
    const sign = new THREE.Mesh(
        new THREE.BoxGeometry(signWidth, signHeight, 0.3 * scale),
        signMaterial
    );
    sign.position.set(platformRadius * 1.2, 7 * scale, 0);
    tavern.add(sign);

    // Add outline to sign board
    addOutlineEffect(sign, tavern, 1.1);

    // Sign text (simplified)
    const textGeometry = new THREE.BoxGeometry(signWidth * 0.8, signHeight * 0.5, 0.1 * scale);
    const text = new THREE.Mesh(textGeometry, textMaterial);
    text.position.set(platformRadius * 1.2, 7 * scale, 0.2 * scale);
    tavern.add(text);

    // Add root structures extending from the main trunk
    for (let i = 0; i < 6; i++) {
        const rootAngle = (i / 6) * Math.PI * 2;
        const rootLength = (3 + random() * 5) * scale;

        // Create root geometry
        const points = [];
        const segments = 6;

        for (let j = 0; j <= segments; j++) {
            const t = j / segments;
            // Create a curved path down and out
            points.push(new THREE.Vector3(
                Math.cos(rootAngle) * rootLength * t,
                (1 - t) * 2 * scale - t * 0.5 * scale,
                Math.sin(rootAngle) * rootLength * t
            ));
        }

        const rootCurve = new THREE.CatmullRomCurve3(points);
        const rootGeometry = new THREE.TubeGeometry(
            rootCurve,
            segments,
            0.4 * scale * (1 - Math.pow(0.8, segments)), // Tapered thickness
            8,
            false
        );

        const root = new THREE.Mesh(rootGeometry, barkMaterial);
        tavern.add(root);
    }

    // Add some decorative elements

    // Hanging lanterns
    for (let i = 0; i < 4; i++) {
        const lanternAngle = (i / 4) * Math.PI * 2 + Math.PI / 8;

        // Rope
        const ropeHeight = 2 * scale;
        const rope = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, ropeHeight, 4),
            ropeMaterial
        );
        rope.position.set(
            Math.cos(lanternAngle) * platformRadius * 0.7,
            trunkHeight * 0.8 + baseWallHeight - ropeHeight / 2,
            Math.sin(lanternAngle) * platformRadius * 0.7
        );
        tavern.add(rope);

        // Lantern
        const lantern = new THREE.Mesh(
            new THREE.BoxGeometry(0.8 * scale, 1 * scale, 0.8 * scale),
            windowMaterial
        );
        lantern.position.set(
            Math.cos(lanternAngle) * platformRadius * 0.7,
            trunkHeight * 0.8 + baseWallHeight - ropeHeight - 0.5 * scale,
            Math.sin(lanternAngle) * platformRadius * 0.7
        );
        tavern.add(lantern);

        // Lantern frame
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(1 * scale, 1.2 * scale, 1 * scale),
            darkWoodMaterial
        );
        frame.position.copy(lantern.position);
        tavern.add(frame);
    }

    // Add some "branch supports" connecting to nearby trees
    for (let i = 0; i < 3; i++) {
        const branchAngle = (i / 3) * Math.PI * 2 + Math.PI / 6;
        const branchLength = platformRadius * 1.5;
        const branchStartHeight = trunkHeight * 0.6 + i * scale * 2;
        const branchEndHeight = branchStartHeight + scale * 3;

        const points = [];
        const segments = 5;

        for (let j = 0; j <= segments; j++) {
            const t = j / segments;
            points.push(new THREE.Vector3(
                Math.cos(branchAngle) * branchLength * t,
                branchStartHeight * (1 - t) + branchEndHeight * t + Math.sin(t * Math.PI) * 2 * scale,
                Math.sin(branchAngle) * branchLength * t
            ));
        }

        const branchCurve = new THREE.CatmullRomCurve3(points);
        const branchGeometry = new THREE.TubeGeometry(
            branchCurve,
            segments,
            0.5 * scale * (1 - 5 * 0.5), // Slightly tapered
            8,
            false
        );

        const branch = new THREE.Mesh(branchGeometry, barkMaterial);
        tavern.add(branch);
    }


    return tavern;
}

/**
 * Helper function to create a rope bridge between two points
 */
function createRopeBridge(start, end, parent, floorMaterial, ropeMaterial, scale) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const bridgeWidth = 2 * scale;

    // Calculate orientation
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const segments = Math.ceil(length / (scale * 2));

    // Calculate the bridge curve (with a slight dip)
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;

        // Apply a slight curve downward in the middle
        const dip = Math.sin(t * Math.PI) * (length * 0.1);

        const slat = new THREE.Mesh(
            new THREE.BoxGeometry(bridgeWidth, 0.2 * scale, 0.8 * scale),
            floorMaterial
        );

        // Position along the bridge
        slat.position.copy(start).lerp(end, t);
        slat.position.y -= dip; // Apply the dip

        // Orient to face the direction
        slat.lookAt(t < 0.5 ? end : start);
        slat.rotation.x = Math.PI / 2;

        parent.add(slat);
    }

    // Add side ropes
    const leftRopePoints = [];
    const rightRopePoints = [];

    const bridgeDir = new THREE.Vector3().subVectors(end, start).normalize();
    const sideVector = new THREE.Vector3(-bridgeDir.z, 0, bridgeDir.x).normalize();

    // Calculate rope points with a nice hanging curve
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const pointOnBridge = new THREE.Vector3().copy(start).lerp(end, t);
        const dip = Math.sin(t * Math.PI) * (length * 0.1);
        pointOnBridge.y -= dip;

        leftRopePoints.push(new THREE.Vector3().copy(pointOnBridge).add(
            new THREE.Vector3().copy(sideVector).multiplyScalar(bridgeWidth / 2)
        ));

        rightRopePoints.push(new THREE.Vector3().copy(pointOnBridge).add(
            new THREE.Vector3().copy(sideVector).multiplyScalar(-bridgeWidth / 2)
        ));
    }

    // Create ropes
    const leftRopeCurve = new THREE.CatmullRomCurve3(leftRopePoints);
    const leftRope = new THREE.Mesh(
        new THREE.TubeGeometry(leftRopeCurve, segments, 0.15 * scale, 8, false),
        ropeMaterial
    );
    parent.add(leftRope);

    const rightRopeCurve = new THREE.CatmullRomCurve3(rightRopePoints);
    const rightRope = new THREE.Mesh(
        new THREE.TubeGeometry(rightRopeCurve, segments, 0.15 * scale, 8, false),
        ropeMaterial
    );
    parent.add(rightRope);

    // Add vertical supports connecting the floor to the side ropes
    for (let i = 1; i < segments; i++) {
        if (i % 2 === 0) continue; // Skip every other one for a more natural look

        const t = i / segments;
        const pointOnBridge = new THREE.Vector3().copy(start).lerp(end, t);
        const dip = Math.sin(t * Math.PI) * (length * 0.1);
        pointOnBridge.y -= dip;

        // Left support
        const leftSupport = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 1 * scale, 4),
            ropeMaterial
        );
        leftSupport.position.copy(pointOnBridge).add(
            new THREE.Vector3().copy(sideVector).multiplyScalar(bridgeWidth / 2)
        );
        leftSupport.position.y += 0.5 * scale;
        parent.add(leftSupport);

        // Right support
        const rightSupport = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 1 * scale, 4),
            ropeMaterial
        );
        rightSupport.position.copy(pointOnBridge).add(
            new THREE.Vector3().copy(sideVector).multiplyScalar(-bridgeWidth / 2)
        );
        rightSupport.position.y += 0.5 * scale;
        parent.add(rightSupport);
    }
}

/**
 * Helper function to create a ladder between two points
 */
function createLadder(start, end, parent, material, scale) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const ladderWidth = 1.5 * scale;

    // Create side rails
    const leftRail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, length, 8),
        material
    );
    leftRail.position.copy(start).add(new THREE.Vector3(ladderWidth / 2, length / 2, 0));
    leftRail.rotation.x = Math.PI / 2;
    parent.add(leftRail);

    const rightRail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, length, 8),
        material
    );
    rightRail.position.copy(start).add(new THREE.Vector3(-ladderWidth / 2, length / 2, 0));
    rightRail.rotation.x = Math.PI / 2;
    parent.add(rightRail);

    // Create rungs
    const rungCount = Math.floor(length / (scale * 0.8));
    for (let i = 0; i < rungCount; i++) {
        const t = i / (rungCount - 1);
        const rung = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, ladderWidth + 0.2 * scale, 8),
            material
        );
        rung.rotation.z = Math.PI / 2;
        rung.position.copy(start).lerp(end, t);
        rung.position.y += 0.1 * scale; // Slight offset
        parent.add(rung);
    }
}

/**
 * Helper function to create a glowing fungus
 */
function createGlowingFungus(position, parent, scale, random, capMaterial, stemMaterial, outlineMaterial) {
    const stemHeight = (0.3 + random() * 0.5) * scale;
    const capRadius = (0.3 + random() * 0.4) * scale;

    // Stem
    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(capRadius * 0.3, capRadius * 0.4, stemHeight, 8),
        stemMaterial
    );
    stem.position.copy(position);
    stem.position.y += stemHeight / 2;
    parent.add(stem);

    // Stem outline
    const stemOutline = new THREE.Mesh(
        stem.geometry,
        outlineMaterial
    );
    stemOutline.position.copy(stem.position);
    stemOutline.rotation.copy(stem.rotation);
    stemOutline.scale.copy(stem.scale).multiplyScalar(1.15);
    parent.add(stemOutline);

    // Cap
    const cap = new THREE.Mesh(
        new THREE.SphereGeometry(capRadius, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
        capMaterial
    );
    cap.position.copy(position);
    cap.position.y += stemHeight;
    cap.rotation.x = Math.PI;
    parent.add(cap);

    // Cap outline
    const capOutline = new THREE.Mesh(
        cap.geometry,
        outlineMaterial
    );
    capOutline.position.copy(cap.position);
    capOutline.rotation.copy(cap.rotation);
    capOutline.scale.copy(cap.scale).multiplyScalar(1.15);
    parent.add(capOutline);
} 