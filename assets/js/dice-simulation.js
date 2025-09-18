class EnhancedDiceSimulation {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.dice = [];
        this.clock = new THREE.Clock();
        this.isVisible = true;
        
        // Enhanced controls
        this.settings = {
            maxDice: this.isMobile() ? 6 : 12,
            spawnRate: 2000, // milliseconds
            gravity: -15,
            bounceStrength: 0.6,
            friction: 0.95,
            diceLifetime: 30, // seconds
            enableShadows: !this.isMobile(),
            enableReflections: true,
            pauseWhenHidden: true
        };
        
        this.spawnTimer = 0;
        this.nextSpawnTime = this.settings.spawnRate;
        
        this.init();
        this.createControls();
        this.animate();
    }

    isMobile() {
        return window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    init() {
        // Get canvas element
        this.canvas = document.getElementById('diceCanvas');
        if (!this.canvas) {
            console.warn('Dice canvas not found');
            return;
        }
        
        // Scene setup
        this.scene = new THREE.Scene();
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: !this.isMobile(),
            alpha: false,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x0a0f1a);
        
        if (this.settings.enableShadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        this.setupLighting();
        this.createGlassSurface();
        this.setupVisibilityHandling();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        console.log('Enhanced dice simulation initialized');
    }

    setupVisibilityHandling() {
        if (this.settings.pauseWhenHidden) {
            document.addEventListener('visibilitychange', () => {
                this.isVisible = !document.hidden;
            });
        }
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 20, 5);
        
        if (this.settings.enableShadows) {
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 50;
            directionalLight.shadow.camera.left = -20;
            directionalLight.shadow.camera.right = 20;
            directionalLight.shadow.camera.top = 20;
            directionalLight.shadow.camera.bottom = -20;
        }
        
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

    createGlassSurface() {
        // Dark glass surface
        const glassGeometry = new THREE.PlaneGeometry(30, 30);
        
        let glassMaterial;
        if (this.settings.enableReflections) {
            glassMaterial = new THREE.MeshPhysicalMaterial({
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
        } else {
            glassMaterial = new THREE.MeshLambertMaterial({
                color: 0x333333,
                transparent: true,
                opacity: 0.8
            });
        }
        
        this.glassSurface = new THREE.Mesh(glassGeometry, glassMaterial);
        this.glassSurface.rotation.x = -Math.PI / 2;
        this.glassSurface.position.y = -2;
        this.glassSurface.receiveShadow = this.settings.enableShadows;
        this.scene.add(this.glassSurface);
        
        this.groundLevel = -1.5; // Surface level for physics
    }

    createDice() {
        if (this.dice.length >= this.settings.maxDice) return;
        
        // Dice geometry
        const diceGeometry = new THREE.BoxGeometry(1, 1, 1);
        const diceMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xf8f8f8,
            metalness: 0.1,
            roughness: 0.4,
            clearcoat: 0.3,
            clearcoatRoughness: 0.2
        });
        
        const diceMesh = new THREE.Mesh(diceGeometry, diceMaterial);
        diceMesh.castShadow = this.settings.enableShadows;
        diceMesh.receiveShadow = this.settings.enableShadows;
        
        // Add dots to dice faces
        this.addDiceDots(diceMesh);
        
        // Random spawn position
        const spawnX = (Math.random() - 0.5) * 10;
        const spawnZ = (Math.random() - 0.5) * 10;
        const spawnY = 15 + Math.random() * 5;
        
        diceMesh.position.set(spawnX, spawnY, spawnZ);
        
        // Random initial rotation
        diceMesh.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        
        this.scene.add(diceMesh);
        
        // Physics properties
        const diceObj = {
            mesh: diceMesh,
            velocity: {
                x: (Math.random() - 0.5) * 2,
                y: 0,
                z: (Math.random() - 0.5) * 2
            },
            angularVelocity: {
                x: (Math.random() - 0.5) * 0.2,
                y: (Math.random() - 0.5) * 0.2,
                z: (Math.random() - 0.5) * 0.2
            },
            bounces: 0,
            age: 0,
            settled: false
        };
        
        this.dice.push(diceObj);
        return diceObj;
    }

    addDiceDots(diceMesh) {
        const dotGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xcc0000 });
        
        // Define dot patterns for dice faces (1-6)
        const dotPatterns = [
            [[0, 0, 0.51]], // 1 dot
            [[-0.2, 0.2, 0.51], [0.2, -0.2, 0.51]], // 2 dots
            [[-0.25, 0.25, 0.51], [0, 0, 0.51], [0.25, -0.25, 0.51]], // 3 dots
            [[-0.2, 0.2, 0.51], [0.2, 0.2, 0.51], [-0.2, -0.2, 0.51], [0.2, -0.2, 0.51]], // 4 dots
            [[-0.2, 0.2, 0.51], [0.2, 0.2, 0.51], [0, 0, 0.51], [-0.2, -0.2, 0.51], [0.2, -0.2, 0.51]], // 5 dots
            [[-0.2, 0.3, 0.51], [0.2, 0.3, 0.51], [-0.2, 0, 0.51], [0.2, 0, 0.51], [-0.2, -0.3, 0.51], [0.2, -0.3, 0.51]] // 6 dots
        ];
        
        // Add dots to front face
        const faceIndex = Math.floor(Math.random() * 6);
        const pattern = dotPatterns[faceIndex];
        
        pattern.forEach(dotPos => {
            const dot = new THREE.Mesh(dotGeometry, dotMaterial);
            dot.position.set(dotPos[0], dotPos[1], dotPos[2]);
            diceMesh.add(dot);
        });
    }

    updatePhysics(deltaTime) {
        const boundary = 12;
        
        this.dice.forEach((die, index) => {
            if (die.settled) return;
            
            // Apply gravity
            die.velocity.y += this.settings.gravity * deltaTime;
            
            // Update position
            die.mesh.position.x += die.velocity.x * deltaTime;
            die.mesh.position.y += die.velocity.y * deltaTime;
            die.mesh.position.z += die.velocity.z * deltaTime;
            
            // Update rotation
            die.mesh.rotation.x += die.angularVelocity.x;
            die.mesh.rotation.y += die.angularVelocity.y;
            die.mesh.rotation.z += die.angularVelocity.z;
            
            // Collision with glass surface
            if (die.mesh.position.y <= this.groundLevel + 0.5) {
                die.mesh.position.y = this.groundLevel + 0.5;
                
                // Bounce
                die.velocity.y *= -this.settings.bounceStrength;
                die.velocity.x *= this.settings.friction;
                die.velocity.z *= this.settings.friction;
                
                // Reduce angular velocity on bounce
                die.angularVelocity.x *= 0.8;
                die.angularVelocity.y *= 0.8;
                die.angularVelocity.z *= 0.8;
                
                die.bounces++;
                
                // Check if dice has settled
                if (Math.abs(die.velocity.y) < 0.3 && 
                    Math.abs(die.velocity.x) < 0.1 && 
                    Math.abs(die.velocity.z) < 0.1) {
                    die.settled = true;
                    die.velocity = { x: 0, y: 0, z: 0 };
                    die.angularVelocity = { x: 0, y: 0, z: 0 };
                }
            }
            
            // Boundary walls
            if (Math.abs(die.mesh.position.x) > boundary) {
                die.mesh.position.x = Math.sign(die.mesh.position.x) * boundary;
                die.velocity.x *= -0.5;
            }
            if (Math.abs(die.mesh.position.z) > boundary) {
                die.mesh.position.z = Math.sign(die.mesh.position.z) * boundary;
                die.velocity.z *= -0.5;
            }
            
            // Age the dice
            die.age += deltaTime;
            
            // Remove old dice
            if (die.age > this.settings.diceLifetime || die.mesh.position.y < -10) {
                this.scene.remove(die.mesh);
                this.dice.splice(index, 1);
            }
        });
    }

    createControls() {
        // Create control panel
        const controlPanel = document.createElement('div');
        controlPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(11, 20, 38, 0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            z-index: 1000;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(0, 255, 136, 0.3);
            max-width: 200px;
            display: none;
        `;
        controlPanel.id = 'diceControls';
        
        controlPanel.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: #00ff88;">Dice Controls</h4>
            
            <label>Max Dice: <span id="maxDiceValue">${this.settings.maxDice}</span></label>
            <input type="range" id="maxDiceSlider" min="3" max="20" value="${this.settings.maxDice}" style="width: 100%;">
            
            <label>Spawn Rate: <span id="spawnRateValue">${this.settings.spawnRate}ms</span></label>
            <input type="range" id="spawnRateSlider" min="500" max="5000" step="250" value="${this.settings.spawnRate}" style="width: 100%;">
            
            <label>Gravity: <span id="gravityValue">${Math.abs(this.settings.gravity)}</span></label>
            <input type="range" id="gravitySlider" min="5" max="30" value="${Math.abs(this.settings.gravity)}" style="width: 100%;">
            
            <label>Bounce: <span id="bounceValue">${this.settings.bounceStrength}</span></label>
            <input type="range" id="bounceSlider" min="0.1" max="1.0" step="0.1" value="${this.settings.bounceStrength}" style="width: 100%;">
            
            <div style="margin-top: 10px;">
                <label><input type="checkbox" id="shadowsToggle" ${this.settings.enableShadows ? 'checked' : ''}> Shadows</label><br>
                <label><input type="checkbox" id="reflectionsToggle" ${this.settings.enableReflections ? 'checked' : ''}> Reflections</label><br>
                <label><input type="checkbox" id="pauseToggle" ${this.settings.pauseWhenHidden ? 'checked' : ''}> Pause when hidden</label>
            </div>
            
            <button id="clearDice" style="margin-top: 10px; padding: 5px 10px; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Clear All Dice</button>
        `;
        
        document.body.appendChild(controlPanel);
        
        // Toggle button
        const toggleButton = document.createElement('button');
        toggleButton.innerHTML = '⚙️';
        toggleButton.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 255, 136, 0.8);
            color: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            z-index: 1001;
            backdrop-filter: blur(10px);
        `;
        
        toggleButton.addEventListener('click', () => {
            const panel = document.getElementById('diceControls');
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                toggleButton.style.right = '220px';
            } else {
                panel.style.display = 'none';
                toggleButton.style.right = '10px';
            }
        });
        
        document.body.appendChild(toggleButton);
        
        this.setupControlEvents();
    }

    setupControlEvents() {
        // Max dice slider
        document.getElementById('maxDiceSlider').addEventListener('input', (e) => {
            this.settings.maxDice = parseInt(e.target.value);
            document.getElementById('maxDiceValue').textContent = this.settings.maxDice;
        });
        
        // Spawn rate slider
        document.getElementById('spawnRateSlider').addEventListener('input', (e) => {
            this.settings.spawnRate = parseInt(e.target.value);
            document.getElementById('spawnRateValue').textContent = this.settings.spawnRate + 'ms';
        });
        
        // Gravity slider
        document.getElementById('gravitySlider').addEventListener('input', (e) => {
            this.settings.gravity = -parseFloat(e.target.value);
            document.getElementById('gravityValue').textContent = Math.abs(this.settings.gravity);
        });
        
        // Bounce slider
        document.getElementById('bounceSlider').addEventListener('input', (e) => {
            this.settings.bounceStrength = parseFloat(e.target.value);
            document.getElementById('bounceValue').textContent = this.settings.bounceStrength;
        });
        
        // Clear dice button
        document.getElementById('clearDice').addEventListener('click', () => {
            this.dice.forEach(die => {
                this.scene.remove(die.mesh);
            });
            this.dice = [];
        });
        
        // Checkboxes (note: some require restart to take effect)
        document.getElementById('shadowsToggle').addEventListener('change', (e) => {
            this.settings.enableShadows = e.target.checked;
        });
        
        document.getElementById('reflectionsToggle').addEventListener('change', (e) => {
            this.settings.enableReflections = e.target.checked;
        });
        
        document.getElementById('pauseToggle').addEventListener('change', (e) => {
            this.settings.pauseWhenHidden = e.target.checked;
        });
    }

    spawnDice() {
        this.createDice();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Skip rendering if tab is not visible and setting is enabled
        if (!this.isVisible && this.settings.pauseWhenHidden) return;
        
        const deltaTime = this.clock.getDelta();
        const clampedDeltaTime = Math.min(deltaTime, 1/30);
        
        // Update physics
        this.updatePhysics(clampedDeltaTime);
        
        // Spawn new dice periodically
        this.spawnTimer += clampedDeltaTime * 1000;
        if (this.spawnTimer >= this.nextSpawnTime) {
            this.spawnDice();
            this.spawnTimer = 0;
            this.nextSpawnTime = this.settings.spawnRate + (Math.random() - 0.5) * 1000; // Add some randomness
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize enhanced dice simulation when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Three.js to load
    setTimeout(() => {
        if (typeof THREE !== 'undefined') {
            try {
                new EnhancedDiceSimulation();
                console.log('Enhanced dice simulation started successfully!');
            } catch (error) {
                console.error('Enhanced dice simulation failed to initialize:', error);
                // Hide canvas on error
                const canvas = document.getElementById('diceCanvas');
                if (canvas) {
                    canvas.style.display = 'none';
                }
            }
        } else {
            console.warn('Three.js not loaded. Hiding dice canvas.');
            const canvas = document.getElementById('diceCanvas');
            if (canvas) {
                canvas.style.display = 'none';
            }
        }
    }, 500);
});