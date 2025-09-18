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
        
        // Much more realistic physics properties
        const diceObj = {
            mesh: diceMesh,
            mass: 0.015, // 15 grams in kg for proper physics
            inertia: {
                x: 0.000025, // Moment of inertia for 1cm cube in kg*m^2
                y: 0.000025,
                z: 0.000025
            },
            velocity: {
                x: (Math.random() - 0.5) * 0.5, // Very small initial horizontal velocity
                y: 0,
                z: (Math.random() - 0.5) * 0.5
            },
            angularVelocity: {
                x: (Math.random() - 0.5) * 4, // Realistic tumbling rate (rad/s)
                y: (Math.random() - 0.5) * 4,
                z: (Math.random() - 0.5) * 4
            },
            torque: { x: 0, y: 0, z: 0 },
            forces: { x: 0, y: 0, z: 0 },
            bounces: 0,
            age: 0,
            settled: false,
            lastCollisionTime: 0,
            settleThreshold: 0.05,
            rollingThreshold: 0.1,
            restingOrientation: null,
            stabilityCounter: 0,
            lastPosition: { x: spawnX, y: spawnY, z: spawnZ },
            isRolling: false,
            contactNormal: { x: 0, y: 1, z: 0 },
            coefficientOfRestitution: 0.3 // How bouncy the dice is
        };
        
        this.dice.push(diceObj);
        return diceObj;
    }

    addDiceDots(diceMesh) {
        const dotGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xcc0000 });
        
        // Define dot patterns for dice faces (1-6)
        const dotPatterns = [
            [[0, 0, 0]], // 1 dot - center
            [[-0.25, 0.25, 0], [0.25, -0.25, 0]], // 2 dots - diagonal
            [[-0.25, 0.25, 0], [0, 0, 0], [0.25, -0.25, 0]], // 3 dots - diagonal with center
            [[-0.25, 0.25, 0], [0.25, 0.25, 0], [-0.25, -0.25, 0], [0.25, -0.25, 0]], // 4 dots - corners
            [[-0.25, 0.25, 0], [0.25, 0.25, 0], [0, 0, 0], [-0.25, -0.25, 0], [0.25, -0.25, 0]], // 5 dots - corners + center
            [[-0.25, 0.25, 0], [0.25, 0.25, 0], [-0.25, 0, 0], [0.25, 0, 0], [-0.25, -0.25, 0], [0.25, -0.25, 0]] // 6 dots - two columns
        ];
        
        // Define all 6 face orientations and their corresponding numbers
        // Standard dice: opposite faces add up to 7 (1-6, 2-5, 3-4)
        const faceData = [
            { normal: [0, 0, 1], number: 1 },   // Front face - 1
            { normal: [0, 0, -1], number: 6 },  // Back face - 6 
            { normal: [1, 0, 0], number: 2 },   // Right face - 2
            { normal: [-1, 0, 0], number: 5 },  // Left face - 5
            { normal: [0, 1, 0], number: 3 },   // Top face - 3
            { normal: [0, -1, 0], number: 4 }   // Bottom face - 4
        ];
        
        // Add dots to all 6 faces
        faceData.forEach(face => {
            const pattern = dotPatterns[face.number - 1]; // Convert to 0-based index
            
            pattern.forEach(dotPos => {
                const dot = new THREE.Mesh(dotGeometry, dotMaterial);
                
                // Position dot on the correct face
                if (face.normal[2] === 1) { // Front face (z+)
                    dot.position.set(dotPos[0], dotPos[1], 0.51);
                } else if (face.normal[2] === -1) { // Back face (z-)
                    dot.position.set(-dotPos[0], dotPos[1], -0.51); // Mirror x for back
                } else if (face.normal[0] === 1) { // Right face (x+)
                    dot.position.set(0.51, dotPos[1], -dotPos[0]);
                } else if (face.normal[0] === -1) { // Left face (x-)
                    dot.position.set(-0.51, dotPos[1], dotPos[0]);
                } else if (face.normal[1] === 1) { // Top face (y+)
                    dot.position.set(dotPos[0], 0.51, -dotPos[1]);
                } else if (face.normal[1] === -1) { // Bottom face (y-)
                    dot.position.set(dotPos[0], -0.51, dotPos[1]);
                }
                
                diceMesh.add(dot);
            });
        });
    }

    updatePhysics(deltaTime) {
        const boundary = 12;
        
        this.dice.forEach((die, index) => {
            if (die.settled) {
                this.applySettledPhysics(die, deltaTime);
                return;
            }
            
            // Store previous position for stability checking
            die.lastPosition = {
                x: die.mesh.position.x,
                y: die.mesh.position.y,
                z: die.mesh.position.z
            };
            
            // Reset forces each frame
            die.forces = { x: 0, y: 0, z: 0 };
            die.torque = { x: 0, y: 0, z: 0 };
            
            // Apply gravitational force (F = mg)
            die.forces.y += this.settings.gravity * die.mass;
            
            // Apply air resistance (quadratic drag: F = -½ρv²CdA)
            const speed = Math.sqrt(die.velocity.x**2 + die.velocity.y**2 + die.velocity.z**2);
            if (speed > 0.01) {
                const dragCoeff = this.settings.airResistance * speed * speed * 0.0001; // Realistic scale
                const dragX = -die.velocity.x * dragCoeff;
                const dragY = -die.velocity.y * dragCoeff * 0.7; // Less drag vertically  
                const dragZ = -die.velocity.z * dragCoeff;
                
                die.forces.x += dragX;
                die.forces.y += dragY;
                die.forces.z += dragZ;
                
                // Air resistance also creates torque opposing rotation
                die.torque.x -= die.angularVelocity.x * dragCoeff * 0.001;
                die.torque.y -= die.angularVelocity.y * dragCoeff * 0.001;
                die.torque.z -= die.angularVelocity.z * dragCoeff * 0.001;
            }
            
            // Apply angular damping
            die.angularVelocity.x *= this.settings.angularDamping;
            die.angularVelocity.y *= this.settings.angularDamping;
            die.angularVelocity.z *= this.settings.angularDamping;
            
            // Integration: Update velocity from forces (a = F/m)
            die.velocity.x += (die.forces.x / die.mass) * deltaTime;
            die.velocity.y += (die.forces.y / die.mass) * deltaTime;
            die.velocity.z += (die.forces.z / die.mass) * deltaTime;
            
            // Integration: Update position from velocity
            die.mesh.position.x += die.velocity.x * deltaTime;
            die.mesh.position.y += die.velocity.y * deltaTime;
            die.mesh.position.z += die.velocity.z * deltaTime;
            
            // Integration: Update angular velocity from torque (α = τ/I)
            die.angularVelocity.x += (die.torque.x / die.inertia.x) * deltaTime;
            die.angularVelocity.y += (die.torque.y / die.inertia.y) * deltaTime;
            die.angularVelocity.z += (die.torque.z / die.inertia.z) * deltaTime;
            
            // Integration: Update rotation from angular velocity
            die.mesh.rotation.x += die.angularVelocity.x * deltaTime;
            die.mesh.rotation.y += die.angularVelocity.y * deltaTime;
            die.mesh.rotation.z += die.angularVelocity.z * deltaTime;
            
            // Collision detection and response
            if (die.mesh.position.y <= this.groundLevel + 0.5) {
                this.handleAdvancedGroundCollision(die, deltaTime);
            }
            
            // Boundary walls
            this.handleWallCollisions(die, boundary);
            
            // Check for settling with improved stability detection
            this.checkAdvancedSettling(die, deltaTime);
            
            // Age the dice
            die.age += deltaTime;
            
            // Remove old dice
            if (die.age > this.settings.diceLifetime || die.mesh.position.y < -10) {
                this.scene.remove(die.mesh);
                this.dice.splice(index, 1);
            }
        });
    }
    
    handleAdvancedGroundCollision(die, deltaTime) {
        die.mesh.position.y = this.groundLevel + 0.5;
        die.lastCollisionTime = die.age;
        die.bounces++;
        
        const collisionNormal = { x: 0, y: 1, z: 0 };
        
        // Calculate relative velocity at contact point
        const relativeVelY = die.velocity.y;
        
        if (relativeVelY > 0) return; // Objects separating
        
        // Calculate impulse magnitude using coefficient of restitution
        const impactSpeed = Math.abs(relativeVelY);
        let restitution = die.coefficientOfRestitution;
        
        // Energy loss increases with impact speed (realistic)
        if (impactSpeed > 3) {
            restitution *= Math.max(0.1, 1 - (impactSpeed - 3) * 0.1);
        }
        
        // Calculate impulse
        const impulse = -(1 + restitution) * relativeVelY;
        
        // Apply normal impulse
        die.velocity.y += impulse;
        
        // Apply friction forces (Coulomb friction model)
        const normalForce = Math.abs(impulse * die.mass);
        const maxFriction = this.settings.friction * normalForce;
        
        const tangentialVel = Math.sqrt(die.velocity.x**2 + die.velocity.z**2);
        if (tangentialVel > 0.01) {
            const frictionDirection = {
                x: -die.velocity.x / tangentialVel,
                z: -die.velocity.z / tangentialVel
            };
            
            const frictionImpulse = Math.min(maxFriction, tangentialVel * die.mass);
            
            die.velocity.x += frictionDirection.x * frictionImpulse / die.mass;
            die.velocity.z += frictionDirection.z * frictionImpulse / die.mass;
            
            // Friction creates torque (τ = r × F)
            const contactRadius = 0.5;
            die.torque.x += frictionDirection.z * frictionImpulse * contactRadius;
            die.torque.z -= frictionDirection.x * frictionImpulse * contactRadius;
        }
        
        // Apply rolling resistance
        const rollingResistance = 0.01;
        die.angularVelocity.x *= (1 - rollingResistance);
        die.angularVelocity.z *= (1 - rollingResistance);
        
        // Collision damping on angular velocity
        const angularDamping = 0.85;
        die.angularVelocity.x *= angularDamping;
        die.angularVelocity.y *= angularDamping;
        die.angularVelocity.z *= angularDamping;
        
        // Sound/impact effects based on collision strength
        if (impactSpeed > 1.5) {
            // Could add collision sound here
        }
    }
    
    checkAdvancedSettling(die, deltaTime) {
        const velocityThreshold = 0.08; // Much stricter
        const angularThreshold = 0.3;   // Much stricter
        const positionThreshold = 0.01; // Position stability
        const timeThreshold = 1.0;      // Must be stable longer
        
        const totalVelocity = Math.sqrt(die.velocity.x**2 + die.velocity.y**2 + die.velocity.z**2);
        const totalAngular = Math.sqrt(die.angularVelocity.x**2 + die.angularVelocity.y**2 + die.angularVelocity.z**2);
        
        // Check position stability
        const positionChange = Math.sqrt(
            (die.mesh.position.x - die.lastPosition.x)**2 + 
            (die.mesh.position.y - die.lastPosition.y)**2 + 
            (die.mesh.position.z - die.lastPosition.z)**2
        );
        
        // Check if dice is in contact with ground
        const isGrounded = die.mesh.position.y <= this.groundLevel + 0.51;
        
        // All stability conditions must be met
        if (isGrounded && 
            totalVelocity < velocityThreshold && 
            totalAngular < angularThreshold &&
            positionChange < positionThreshold &&
            die.age - die.lastCollisionTime > timeThreshold) {
            
            die.stabilityCounter += deltaTime;
            
            // Must maintain stability for additional time
            if (die.stabilityCounter > 0.5) {
                die.settled = true;
                die.velocity = { x: 0, y: 0, z: 0 };
                die.angularVelocity = { x: 0, y: 0, z: 0 };
                
                // Snap to nearest stable face orientation
                this.snapToStableOrientation(die);
            }
        } else {
            // Reset stability counter if conditions not met
            die.stabilityCounter = 0;
        }
    }
    
    snapToStableOrientation(die) {
        // Normalize current rotation to 0-2π range
        const normalizeAngle = (angle) => {
            while (angle < 0) angle += Math.PI * 2;
            while (angle >= Math.PI * 2) angle -= Math.PI * 2;
            return angle;
        };
        
        const currentX = normalizeAngle(die.mesh.rotation.x);
        const currentY = normalizeAngle(die.mesh.rotation.y);
        const currentZ = normalizeAngle(die.mesh.rotation.z);
        
        // Define stable face orientations (proper dice faces)
        const stableOrientations = [
            { x: 0, y: 0, z: 0, face: 1 },                      // 1 face up
            { x: Math.PI, y: 0, z: 0, face: 6 },               // 6 face up  
            { x: Math.PI/2, y: 0, z: 0, face: 4 },             // 4 face up
            { x: -Math.PI/2, y: 0, z: 0, face: 3 },            // 3 face up
            { x: 0, y: 0, z: Math.PI/2, face: 2 },             // 2 face up
            { x: 0, y: 0, z: -Math.PI/2, face: 5 }             // 5 face up
        ];
        
        let closestOrientation = stableOrientations[0];
        let minDistance = Infinity;
        
        stableOrientations.forEach(orientation => {
            // Calculate angular distance considering periodic boundary
            const distX = Math.min(
                Math.abs(currentX - orientation.x),
                Math.abs(currentX - orientation.x + Math.PI * 2),
                Math.abs(currentX - orientation.x - Math.PI * 2)
            );
            const distY = Math.min(
                Math.abs(currentY - orientation.y),
                Math.abs(currentY - orientation.y + Math.PI * 2),
                Math.abs(currentY - orientation.y - Math.PI * 2)
            );
            const distZ = Math.min(
                Math.abs(currentZ - orientation.z),
                Math.abs(currentZ - orientation.z + Math.PI * 2),
                Math.abs(currentZ - orientation.z - Math.PI * 2)
            );
            
            const totalDistance = distX + distY + distZ;
            
            if (totalDistance < minDistance) {
                minDistance = totalDistance;
                closestOrientation = orientation;
            }
        });
        
        // Set target orientation for smooth interpolation
        die.restingOrientation = {
            x: closestOrientation.x,
            y: closestOrientation.y,
            z: closestOrientation.z,
            face: closestOrientation.face
        };
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