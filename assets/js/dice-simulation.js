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
            gravity: -9.81, // More realistic Earth gravity
            bounceStrength: 0.4, // Less bouncy for realism
            friction: 0.8, // More friction
            airResistance: 0.02, // Air drag
            angularDamping: 0.95, // Angular friction
            diceLifetime: 45, // seconds
            enableShadows: !this.isMobile(),
            enableReflections: true,
            pauseWhenHidden: true,
            realism: 1.0 // Realism factor (0-1)
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
        
        // Create more rounded dice geometry for realistic physics
        const diceGeometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
        
        // Apply slight rounding to edges for more realistic collision
        const vertices = diceGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const y = vertices[i + 1];
            const z = vertices[i + 2];
            
            // Slightly round the corners
            const roundFactor = 0.05;
            vertices[i] = x * (1 - roundFactor * Math.abs(y) * Math.abs(z));
            vertices[i + 1] = y * (1 - roundFactor * Math.abs(x) * Math.abs(z));
            vertices[i + 2] = z * (1 - roundFactor * Math.abs(x) * Math.abs(y));
        }
        diceGeometry.attributes.position.needsUpdate = true;
        diceGeometry.computeVertexNormals();
        
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
        
        // More realistic spawn positioning
        const spawnX = (Math.random() - 0.5) * 8;
        const spawnZ = (Math.random() - 0.5) * 8;
        const spawnY = 12 + Math.random() * 8; // Higher drop for more tumbling
        
        diceMesh.position.set(spawnX, spawnY, spawnZ);
        
        // Random initial rotation (slight tilt, not completely random)
        diceMesh.rotation.set(
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.4
        );
        
        this.scene.add(diceMesh);
        
        // More realistic physics properties
        const diceObj = {
            mesh: diceMesh,
            mass: 15, // Realistic dice mass in grams
            inertia: 0.1667, // Moment of inertia for cube (1/6 * m * a^2)
            velocity: {
                x: (Math.random() - 0.5) * 1.5, // Less initial horizontal velocity
                y: 0,
                z: (Math.random() - 0.5) * 1.5
            },
            angularVelocity: {
                x: (Math.random() - 0.5) * 8, // More realistic tumbling
                y: (Math.random() - 0.5) * 8,
                z: (Math.random() - 0.5) * 8
            },
            torque: { x: 0, y: 0, z: 0 },
            forces: { x: 0, y: 0, z: 0 },
            bounces: 0,
            age: 0,
            settled: false,
            lastCollisionTime: 0,
            settleThreshold: 0.1,
            cornerContacts: 0, // Track corner vs face contacts
            restingOrientation: null
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
            if (die.settled) {
                // Even settled dice can be nudged by other dice
                this.applySettledPhysics(die, deltaTime);
                return;
            }
            
            // Reset forces each frame
            die.forces = { x: 0, y: 0, z: 0 };
            die.torque = { x: 0, y: 0, z: 0 };
            
            // Apply gravitational force
            die.forces.y += this.settings.gravity * die.mass;
            
            // Apply air resistance (quadratic drag)
            const speed = Math.sqrt(die.velocity.x**2 + die.velocity.y**2 + die.velocity.z**2);
            if (speed > 0) {
                const dragCoeff = this.settings.airResistance * speed;
                die.forces.x -= die.velocity.x * dragCoeff;
                die.forces.y -= die.velocity.y * dragCoeff * 0.5; // Less air resistance vertically
                die.forces.z -= die.velocity.z * dragCoeff;
            }
            
            // Apply angular damping (air resistance on rotation)
            die.angularVelocity.x *= this.settings.angularDamping;
            die.angularVelocity.y *= this.settings.angularDamping;
            die.angularVelocity.z *= this.settings.angularDamping;
            
            // Update velocity from forces (F = ma, so a = F/m)
            die.velocity.x += (die.forces.x / die.mass) * deltaTime;
            die.velocity.y += (die.forces.y / die.mass) * deltaTime;
            die.velocity.z += (die.forces.z / die.mass) * deltaTime;
            
            // Update position from velocity
            die.mesh.position.x += die.velocity.x * deltaTime;
            die.mesh.position.y += die.velocity.y * deltaTime;
            die.mesh.position.z += die.velocity.z * deltaTime;
            
            // Update angular velocity from torque
            die.angularVelocity.x += (die.torque.x / die.inertia) * deltaTime;
            die.angularVelocity.y += (die.torque.y / die.inertia) * deltaTime;
            die.angularVelocity.z += (die.torque.z / die.inertia) * deltaTime;
            
            // Update rotation from angular velocity
            die.mesh.rotation.x += die.angularVelocity.x * deltaTime;
            die.mesh.rotation.y += die.angularVelocity.y * deltaTime;
            die.mesh.rotation.z += die.angularVelocity.z * deltaTime;
            
            // Collision with glass surface
            if (die.mesh.position.y <= this.groundLevel + 0.5) {
                this.handleGroundCollision(die, deltaTime);
            }
            
            // Boundary walls with more realistic collision
            this.handleWallCollisions(die, boundary);
            
            // Age the dice
            die.age += deltaTime;
            
            // Remove old dice
            if (die.age > this.settings.diceLifetime || die.mesh.position.y < -10) {
                this.scene.remove(die.mesh);
                this.dice.splice(index, 1);
            }
        });
    }
    
    handleGroundCollision(die, deltaTime) {
        die.mesh.position.y = this.groundLevel + 0.5;
        die.lastCollisionTime = die.age;
        die.bounces++;
        
        // More realistic collision response
        const collisionNormal = { x: 0, y: 1, z: 0 };
        
        // Calculate collision impulse
        const relativeVelocity = {
            x: die.velocity.x,
            y: die.velocity.y,
            z: die.velocity.z
        };
        
        const velocityAlongNormal = relativeVelocity.y;
        
        if (velocityAlongNormal > 0) return; // Objects separating
        
        // Calculate restitution based on impact force
        let restitution = this.settings.bounceStrength;
        const impactForce = Math.abs(velocityAlongNormal);
        
        // Reduce bounce for hard impacts (energy loss)
        if (impactForce > 5) {
            restitution *= 0.7;
        }
        
        // Apply collision impulse
        const impulse = -(1 + restitution) * velocityAlongNormal;
        die.velocity.y += impulse;
        
        // Apply friction
        const tangentialVelocity = {
            x: die.velocity.x,
            z: die.velocity.z
        };
        
        const tangentialSpeed = Math.sqrt(tangentialVelocity.x**2 + tangentialVelocity.z**2);
        if (tangentialSpeed > 0) {
            const frictionCoeff = this.settings.friction;
            const frictionForce = Math.min(frictionCoeff * Math.abs(impulse), tangentialSpeed);
            
            die.velocity.x -= (tangentialVelocity.x / tangentialSpeed) * frictionForce;
            die.velocity.z -= (tangentialVelocity.z / tangentialSpeed) * frictionForce;
        }
        
        // Apply rotational effects from collision
        const contactPoint = { x: 0, y: -0.5, z: 0 }; // Bottom of dice
        
        // Convert linear velocity to angular velocity (rolling)
        const rollingFactor = 0.4;
        die.angularVelocity.x += die.velocity.z * rollingFactor;
        die.angularVelocity.z -= die.velocity.x * rollingFactor;
        
        // Reduce existing angular velocity from collision
        die.angularVelocity.x *= 0.7;
        die.angularVelocity.y *= 0.8;
        die.angularVelocity.z *= 0.7;
        
        // Check for settling
        this.checkSettling(die);
    }
    
    checkSettling(die) {
        const velocityThreshold = 0.5;
        const angularThreshold = 1.0;
        const timeThreshold = 0.5; // Must be stable for this long
        
        const totalVelocity = Math.sqrt(die.velocity.x**2 + die.velocity.y**2 + die.velocity.z**2);
        const totalAngular = Math.sqrt(die.angularVelocity.x**2 + die.angularVelocity.y**2 + die.angularVelocity.z**2);
        
        if (totalVelocity < velocityThreshold && 
            totalAngular < angularThreshold &&
            die.age - die.lastCollisionTime > timeThreshold) {
            
            die.settled = true;
            die.velocity = { x: 0, y: 0, z: 0 };
            die.angularVelocity = { x: 0, y: 0, z: 0 };
            
            // Snap to stable orientation
            this.snapToStableOrientation(die);
        }
    }
    
    snapToStableOrientation(die) {
        // Find the closest face-down orientation
        const orientations = [
            { x: 0, y: 0, z: 0 },                    // 1 up
            { x: Math.PI, y: 0, z: 0 },             // 6 up
            { x: Math.PI/2, y: 0, z: 0 },           // 2 up  
            { x: -Math.PI/2, y: 0, z: 0 },          // 5 up
            { x: 0, y: 0, z: Math.PI/2 },           // 3 up
            { x: 0, y: 0, z: -Math.PI/2 }           // 4 up
        ];
        
        let closestOrientation = orientations[0];
        let minDistance = Infinity;
        
        orientations.forEach(orientation => {
            const distance = Math.abs(die.mesh.rotation.x - orientation.x) + 
                           Math.abs(die.mesh.rotation.y - orientation.y) + 
                           Math.abs(die.mesh.rotation.z - orientation.z);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestOrientation = orientation;
            }
        });
        
        // Smoothly rotate to stable position
        die.restingOrientation = closestOrientation;
    }
    
    applySettledPhysics(die, deltaTime) {
        // Smoothly rotate to final resting position
        if (die.restingOrientation) {
            const lerpFactor = 0.1;
            
            die.mesh.rotation.x += (die.restingOrientation.x - die.mesh.rotation.x) * lerpFactor;
            die.mesh.rotation.y += (die.restingOrientation.y - die.mesh.rotation.y) * lerpFactor;
            die.mesh.rotation.z += (die.restingOrientation.z - die.mesh.rotation.z) * lerpFactor;
        }
    }
    
    handleWallCollisions(die, boundary) {
        // X boundaries
        if (Math.abs(die.mesh.position.x) > boundary) {
            die.mesh.position.x = Math.sign(die.mesh.position.x) * boundary;
            die.velocity.x *= -0.3; // Energy loss
            die.angularVelocity.y += die.velocity.x * 0.5; // Add spin from wall collision
        }
        
        // Z boundaries  
        if (Math.abs(die.mesh.position.z) > boundary) {
            die.mesh.position.z = Math.sign(die.mesh.position.z) * boundary;
            die.velocity.z *= -0.3; // Energy loss
            die.angularVelocity.x -= die.velocity.z * 0.5; // Add spin from wall collision
        }
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
            
            <label>Gravity: <span id="gravityValue">${Math.abs(this.settings.gravity).toFixed(1)}</span></label>
            <input type="range" id="gravitySlider" min="2" max="20" step="0.1" value="${Math.abs(this.settings.gravity)}" style="width: 100%;">
            
            <label>Bounce: <span id="bounceValue">${this.settings.bounceStrength}</span></label>
            <input type="range" id="bounceSlider" min="0.1" max="0.8" step="0.05" value="${this.settings.bounceStrength}" style="width: 100%;">
            
            <label>Air Resistance: <span id="airValue">${this.settings.airResistance}</span></label>
            <input type="range" id="airSlider" min="0" max="0.1" step="0.005" value="${this.settings.airResistance}" style="width: 100%;">
            
            <label>Friction: <span id="frictionValue">${this.settings.friction}</span></label>
            <input type="range" id="frictionSlider" min="0.1" max="0.95" step="0.05" value="${this.settings.friction}" style="width: 100%;">
            
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
            document.getElementById('gravityValue').textContent = Math.abs(this.settings.gravity).toFixed(1);
        });
        
        // Bounce slider
        document.getElementById('bounceSlider').addEventListener('input', (e) => {
            this.settings.bounceStrength = parseFloat(e.target.value);
            document.getElementById('bounceValue').textContent = this.settings.bounceStrength;
        });
        
        // Air resistance slider
        document.getElementById('airSlider').addEventListener('input', (e) => {
            this.settings.airResistance = parseFloat(e.target.value);
            document.getElementById('airValue').textContent = this.settings.airResistance;
        });
        
        // Friction slider
        document.getElementById('frictionSlider').addEventListener('input', (e) => {
            this.settings.friction = parseFloat(e.target.value);
            document.getElementById('frictionValue').textContent = this.settings.friction;
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