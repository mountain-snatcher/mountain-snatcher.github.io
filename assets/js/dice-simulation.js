class DiceSimulation {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.dice = [];
        this.maxDice = this.isMobile() ? 6 : 12; // Fewer dice on mobile
        this.spawnTimer = 0;
        this.spawnInterval = 2000; // milliseconds
        this.clock = new THREE.Clock();
        this.isVisible = true;
        
        // Performance monitoring
        this.setupVisibilityHandling();
        
        this.init();
        this.animate();
    }

    isMobile() {
        return window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    setupVisibilityHandling() {
        // Pause animation when tab is not visible to save battery
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
        });
    }

    init() {
        // Get canvas element
        this.canvas = document.getElementById('diceCanvas');
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0f1a); // Dark background matching the video
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer setup with performance optimizations
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: !this.isMobile(), // Disable antialiasing on mobile for performance
            alpha: false,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
        this.renderer.shadowMap.enabled = !this.isMobile(); // Disable shadows on mobile
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        // Physics world setup
        this.world = new CANNON.World();
        this.world.gravity.set(0, -15, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 10;
        
        // Create ground/glass surface
        this.createGlassSurface();
        
        // Add lighting
        this.setupLighting();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Initial dice spawn
        this.spawnDice();
    }

    createGlassSurface() {
        // Visual glass surface
        const glassGeometry = new THREE.PlaneGeometry(30, 30);
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x222222,
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.2,
            transparent: true,
            opacity: 0.8,
            reflectivity: 0.9,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });
        
        const glassSurface = new THREE.Mesh(glassGeometry, glassMaterial);
        glassSurface.rotation.x = -Math.PI / 2;
        glassSurface.position.y = -2;
        glassSurface.receiveShadow = true;
        this.scene.add(glassSurface);
        
        // Physics ground
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        groundBody.position.set(0, -2, 0);
        groundBody.material = new CANNON.Material({ friction: 0.4, restitution: 0.6 });
        this.world.add(groundBody);
        
        // Add invisible walls to contain dice
        this.createWalls();
    }

    createWalls() {
        const wallMaterial = new CANNON.Material({ friction: 0.4, restitution: 0.8 });
        
        // Create invisible boundary walls
        const wallPositions = [
            { x: 15, y: 5, z: 0, rotation: [0, 0, Math.PI/2] },   // Right wall
            { x: -15, y: 5, z: 0, rotation: [0, 0, -Math.PI/2] }, // Left wall
            { x: 0, y: 5, z: 15, rotation: [Math.PI/2, 0, 0] },   // Back wall
            { x: 0, y: 5, z: -15, rotation: [-Math.PI/2, 0, 0] }  // Front wall
        ];
        
        wallPositions.forEach(pos => {
            const wallShape = new CANNON.Plane();
            const wallBody = new CANNON.Body({ mass: 0 });
            wallBody.addShape(wallShape);
            wallBody.position.set(pos.x, pos.y, pos.z);
            if (pos.rotation) {
                wallBody.quaternion.setFromEuler(pos.rotation[0], pos.rotation[1], pos.rotation[2]);
            }
            wallBody.material = wallMaterial;
            this.world.add(wallBody);
        });
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 20, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        this.scene.add(directionalLight);
        
        // Aurora-themed accent lights
        const greenLight = new THREE.PointLight(0x00ff88, 0.3, 20);
        greenLight.position.set(-8, 6, -8);
        this.scene.add(greenLight);
        
        const cyanLight = new THREE.PointLight(0x64ffda, 0.2, 20);
        cyanLight.position.set(8, 6, 8);
        this.scene.add(cyanLight);
        
        const purpleLight = new THREE.PointLight(0x8b5cf6, 0.2, 20);
        purpleLight.position.set(0, 8, -10);
        this.scene.add(purpleLight);
    }

    createDice() {
        // Dice geometry with rounded edges
        const diceGeometry = new THREE.BoxGeometry(1, 1, 1);
        
        // Create dice material with subtle glow
        const diceMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xf8f8f8,
            metalness: 0.1,
            roughness: 0.4,
            clearcoat: 0.3,
            clearcoatRoughness: 0.2
        });
        
        // Create visual dice
        const diceMesh = new THREE.Mesh(diceGeometry, diceMaterial);
        diceMesh.castShadow = true;
        diceMesh.receiveShadow = true;
        
        // Add dots to dice faces
        this.addDiceDots(diceMesh);
        
        // Create physics body
        const diceShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
        const diceBody = new CANNON.Body({ mass: 1 });
        diceBody.addShape(diceShape);
        diceBody.material = new CANNON.Material({ friction: 0.4, restitution: 0.6 });
        
        // Random spawn position and rotation
        const spawnX = (Math.random() - 0.5) * 10;
        const spawnZ = (Math.random() - 0.5) * 10;
        const spawnY = 15 + Math.random() * 5;
        
        diceBody.position.set(spawnX, spawnY, spawnZ);
        diceMesh.position.copy(diceBody.position);
        
        // Random initial rotation
        diceBody.quaternion.set(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            Math.random() * 2 - 1
        );
        diceBody.quaternion.normalize();
        diceMesh.quaternion.copy(diceBody.quaternion);
        
        // Add to scene and physics world
        this.scene.add(diceMesh);
        this.world.add(diceBody);
        
        return { mesh: diceMesh, body: diceBody, age: 0 };
    }

    addDiceDots(diceMesh) {
        const dotGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xcc0000 });
        
        // Define dot patterns for each face (1-6)
        const dotPatterns = [
            [[0, 0, 0.51]], // 1 dot
            [[-0.2, 0.2, 0.51], [0.2, -0.2, 0.51]], // 2 dots
            [[-0.25, 0.25, 0.51], [0, 0, 0.51], [0.25, -0.25, 0.51]], // 3 dots
            [[-0.2, 0.2, 0.51], [0.2, 0.2, 0.51], [-0.2, -0.2, 0.51], [0.2, -0.2, 0.51]], // 4 dots
            [[-0.2, 0.2, 0.51], [0.2, 0.2, 0.51], [0, 0, 0.51], [-0.2, -0.2, 0.51], [0.2, -0.2, 0.51]], // 5 dots
            [[-0.2, 0.3, 0.51], [0.2, 0.3, 0.51], [-0.2, 0, 0.51], [0.2, 0, 0.51], [-0.2, -0.3, 0.51], [0.2, -0.3, 0.51]] // 6 dots
        ];
        
        // Add dots to front face (just for visual detail)
        const faceIndex = Math.floor(Math.random() * 6);
        const pattern = dotPatterns[faceIndex];
        
        pattern.forEach(dotPos => {
            const dot = new THREE.Mesh(dotGeometry, dotMaterial);
            dot.position.set(dotPos[0], dotPos[1], dotPos[2]);
            diceMesh.add(dot);
        });
    }

    spawnDice() {
        if (this.dice.length < this.maxDice) {
            const dice = this.createDice();
            this.dice.push(dice);
        }
    }

    cleanupDice() {
        this.dice = this.dice.filter(dice => {
            // Remove dice that have fallen too far or are too old
            if (dice.body.position.y < -10 || dice.age > 30000) {
                this.scene.remove(dice.mesh);
                this.world.remove(dice.body);
                return false;
            }
            return true;
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Skip rendering if tab is not visible
        if (!this.isVisible) return;
        
        const deltaTime = this.clock.getDelta();
        
        // Cap deltaTime to prevent physics instability
        const clampedDeltaTime = Math.min(deltaTime, 1/30);
        
        // Update physics
        this.world.step(clampedDeltaTime);
        
        // Update dice positions and age
        this.dice.forEach(dice => {
            dice.mesh.position.copy(dice.body.position);
            dice.mesh.quaternion.copy(dice.body.quaternion);
            dice.age += clampedDeltaTime * 1000; // Convert to milliseconds
        });
        
        // Spawn new dice periodically
        this.spawnTimer += clampedDeltaTime * 1000;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnDice();
            this.spawnTimer = 0;
            // Vary spawn interval for more natural feeling
            this.spawnInterval = 1500 + Math.random() * 2000;
        }
        
        // Cleanup old dice
        this.cleanupDice();
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize dice simulation when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if Three.js and Cannon.js are loaded
    if (typeof THREE !== 'undefined' && typeof CANNON !== 'undefined') {
        try {
            new DiceSimulation();
        } catch (error) {
            console.warn('Dice simulation failed to initialize:', error);
            // Fallback: hide canvas and show aurora background
            const canvas = document.getElementById('diceCanvas');
            if (canvas) {
                canvas.style.display = 'none';
            }
        }
    } else {
        console.warn('Three.js or Cannon.js not loaded. Falling back to aurora background.');
        // Hide canvas if libraries aren't loaded
        const canvas = document.getElementById('diceCanvas');
        if (canvas) {
            canvas.style.display = 'none';
        }
    }
});