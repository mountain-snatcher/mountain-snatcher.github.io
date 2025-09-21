// Full Plasma Field Simulation 
document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('fourierContainer');
    if (!container) return;

    // Check if Three.js is available
    if (typeof THREE === 'undefined') {
        console.log('Three.js not available, using fallback background');
        container.style.background = `
            linear-gradient(135deg, 
                rgba(0, 255, 136, 0.02) 0%, 
                rgba(100, 255, 218, 0.02) 25%,
                rgba(139, 92, 246, 0.02) 50%,
                rgba(0, 255, 136, 0.02) 75%,
                rgba(100, 255, 218, 0.02) 100%)
        `;
        return;
    }

    // Wait for dependencies to load
    setTimeout(() => {
        console.log('Starting plasma simulation...');
        const simulation = new PlasmaFieldSimulation();
        simulation.init();
    }, 200);

    // Full Plasma Field Simulation Class with multiple particle types and enhanced effects
    class PlasmaFieldSimulation {
        constructor() {
            // Core Three.js objects
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.controls = null;
            this.gui = null;
            this.composer = null;
            this.usePostProcessing = false;

            // Enhanced simulation parameters (optimized for background)
            this.params = {
                animationSpeed: 1.0,      // Speed of particle movement
                electronCount: 1000,      // Number of electrons (blue, small, fast)
                ionCount: 500,           // Number of ions (red, medium, slower)
                neutralCount: 100,        // Number of neutrals (white, large, slow)
                bloomStrength: 0.8,       // Intensity of glow effect
                bloomRadius: 0.5,         // Spread of bloom
                bloomThreshold: 0.7,      // Brightness threshold for bloom
                lightningIntensity: 0.6,  // Lightning frequency
                mouseForce: 1.8,          // Mouse interaction strength
                energyLevel: 1.0,         // Overall energy level
                particleCycleDuration: 150, // Particle lifecycle in seconds (2.5 minutes)
                deathPhaseDuration: 30,   // Time for particles to die out (30 seconds)
                birthPhaseDuration: 30    // Time for particles to recreate (30 seconds)
            };
            
            // Particle lifecycle tracking
            this.particleLifecycle = {
                time: 0,
                phase: 'active', // 'active', 'dying', 'dead', 'birthing'
                phaseProgress: 0,
                cycleProgress: 0
            };

            // Plasma-specific objects - multiple particle types
            this.electronSystem = null;
            this.ionSystem = null;
            this.neutralSystem = null;
            this.lightningSystem = null;
            this.lightningLines = [];
            this.clock = new THREE.Clock();
            
            // Mouse interaction
            this.mouse = new THREE.Vector2();
            this.mouseWorld = new THREE.Vector3();
            this.mouseInfluence = 0;
            
            // Magnetic reconnection system
            this.reconnectionEvents = [];
            this.reconnectionFlashes = [];
            
            // Plasma instability system
            this.stabilityFactor = 1.0;
            this.instabilityPhase = 'stable'; // 'stable', 'unstable', 'disrupting', 'recovering'
            this.instabilityTimer = 0;
            this.disruptionSectors = [];
            
            // Fusion reaction system
            this.fusionEvents = [];
            this.fusionFlashes = [];
            
            // Turbulent cascade system
            this.turbulenceTime = 0;
            this.turbulenceIntensity = 0.3;
        }

        // Initialize the simulation after dependency checks
        init() {
            // Step 1: Validate core dependencies
            if (typeof THREE === 'undefined') {
                console.error('THREE.js failed to load');
                return;
            }
            
            console.log('THREE.js loaded:', typeof THREE);
            console.log('OrbitControls available:', typeof THREE.OrbitControls);

            // Disable post-processing for now to simplify dependencies
            this.usePostProcessing = false;
            console.log('Post-processing disabled for compatibility');

            // Step 3: Setup scene, camera, renderer
            this.setupScene();
            this.setupCamera();
            this.setupRenderer();
            this.setupLighting();
            this.createEnvironment();
            this.createMultipleParticleTypes();
            this.createLightningSystem();
            this.createReconnectionSystem();
            this.createFusionSystem();
            this.setupContainment();
            this.setupMouseInteraction();
            if (this.usePostProcessing) {
                this.setupPostProcessing();
            }
            this.setupControls();
            // Skip GUI for background use

            // Step 4: Start animation loop
            this.animate();
        }

        // Setup the main scene
        setupScene() {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x000008); // Deep space black
            // Add subtle fog for depth
            this.scene.fog = new THREE.Fog(0x000008, 8, 25);
        }

        // Setup perspective camera
        setupCamera() {
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            // Position camera at optimal distance to view the donut
            this.camera.position.set(0, 0, 10);
            this.camera.lookAt(0, 0, 0);
            console.log('Camera positioned at:', this.camera.position.x, this.camera.position.y, this.camera.position.z);
        }

        // Setup WebGL renderer with shadow support and high quality
        setupRenderer() {
            // Try to create renderer with MSAA first
            let renderer;
            try {
                renderer = new THREE.WebGLRenderer({ 
                    antialias: true, 
                    alpha: true,
                    powerPreference: "high-performance",
                    precision: "highp"
                });
                
                // Check if we can enable MSAA
                const gl = renderer.getContext();
                const samples = gl.getParameter(gl.SAMPLES);
                console.log('MSAA samples:', samples);
                
                this.renderer = renderer;
            } catch (e) {
                console.warn('Failed to create high-performance renderer, falling back:', e);
                this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            }
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Crisp pixels
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows for realism
            this.renderer.physicallyCorrectLights = true; // Enable PBR lighting model
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 0.7;
            this.renderer.setClearColor(0x000008, 0); // Transparent background
            container.appendChild(this.renderer.domElement);

            // Handle window resize for responsiveness
            window.addEventListener('resize', () => {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                if (this.usePostProcessing && this.composer) {
                    this.composer.setSize(window.innerWidth, window.innerHeight);
                }
            }, false);
        }

        // Setup physically-accurate lighting: Hemisphere for ambient, Directional for key light and shadows
        setupLighting() {
            // Hemisphere light for soft, natural ambient illumination
            const hemiLight = new THREE.HemisphereLight(0x444444, 0x000011, 0.6);
            hemiLight.position.set(0, 20, 0);
            this.scene.add(hemiLight);

            // Directional light for sharp shadows and highlights (simulating a strong energy source)
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
            dirLight.position.set(10, 10, 5);
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 2048;
            dirLight.shadow.mapSize.height = 2048;
            dirLight.shadow.camera.near = 0.5;
            dirLight.shadow.camera.far = 50;
            dirLight.shadow.camera.left = -10;
            dirLight.shadow.camera.right = 10;
            dirLight.shadow.camera.top = 10;
            dirLight.shadow.camera.bottom = -10;
            this.scene.add(dirLight);
        }

        // Create environment: Pure space environment
        createEnvironment() {
            // No ground plane - pure floating space effect
            // Set scene background to deep space
            this.scene.background = new THREE.Color(0x000008);
        }

        // Create multiple particle types for plasma composition
        createMultipleParticleTypes() {
            // Electrons: Small, fast, blue particles
            this.electronSystem = this.createParticleType({
                count: this.params.electronCount,
                color: 0x0088ff,
                size: 0.8,
                mass: 1,
                charge: -1,
                speed: 0.15
            });

            // Ions: Medium, slower, red/orange particles  
            this.ionSystem = this.createParticleType({
                count: this.params.ionCount,
                color: 0xff4400,
                size: 1.2,
                mass: 10,
                charge: 1,
                speed: 0.08
            });

            // Neutral atoms: Large, slow, white/purple particles
            this.neutralSystem = this.createParticleType({
                count: this.params.neutralCount,
                color: 0x6644bb,
                size: 1.6,
                mass: 15,
                charge: 0,
                speed: 0.04
            });
        }

        // Create individual particle type system
        createParticleType(config) {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(config.count * 3);
            const velocities = new Float32Array(config.count * 3);
            const lifetimes = new Float32Array(config.count); // Particle individual lifetimes
            const maxLifetimes = new Float32Array(config.count); // Max lifetime for each particle

            // Initialize particles with clustered distribution
            for (let i = 0; i < config.count; i++) {
                const i3 = i * 3;
                
                // Initialize positions
                this.resetParticlePosition(positions, i3);
                
                // Type-specific velocities
                this.resetParticleVelocity(velocities, positions, i3, config);
                
                // Initialize lifetimes
                lifetimes[i] = 1.0; // Start fully alive
                maxLifetimes[i] = 0.8 + Math.random() * 0.4; // Varied max lifetimes
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            // Type-specific material
            const material = new THREE.PointsMaterial({
                color: config.color,
                size: config.size,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.4,
                blending: THREE.AdditiveBlending,
                map: this.createParticleTexture(),
                alphaTest: 0.01,  // Higher alpha test for sharper edges
                depthWrite: false,
                vertexColors: false
            });

            const system = new THREE.Points(geometry, material);
            system.userData = {
                config: config,
                velocities: velocities,
                lifetimes: lifetimes,
                maxLifetimes: maxLifetimes,
                baseOpacity: 0.3
            };

            this.scene.add(system);
            return system;
        }
        
        // Reset particle position to create toroidal (donut) distribution
        resetParticlePosition(positions, i3) {
            // Create torus (donut) shape parameters
            const majorRadius = 2.5; // Distance from center to tube center
            const minorRadius = 0.8;  // Tube thickness
            
            // Toroidal coordinates
            const theta = Math.random() * Math.PI * 2; // Around the major circle
            const phi = Math.random() * Math.PI * 2;   // Around the minor circle
            
            // Add some randomness to the radii for organic look
            const majorR = majorRadius + (Math.random() - 0.5) * 0.3;
            const minorR = minorRadius * Math.random();
            
            // Convert to Cartesian coordinates (torus standing vertically in X-Y plane)
            positions[i3] = (majorR + minorR * Math.cos(phi)) * Math.cos(theta);     // X
            positions[i3 + 1] = (majorR + minorR * Math.cos(phi)) * Math.sin(theta); // Y 
            positions[i3 + 2] = minorR * Math.sin(phi);                              // Z (height)
        }
        
        // Reset particle velocity for toroidal motion
        resetParticleVelocity(velocities, positions, i3, config) {
            const x = positions[i3];
            const y = positions[i3 + 1];
            const z = positions[i3 + 2];
            
            // Calculate distance from Z-axis (center of torus)
            const rho = Math.sqrt(x*x + y*y) || 0.001;
            
            // Toroidal velocity: particles flow around the major radius
            const toroidalSpeed = 0.08 / config.mass;
            velocities[i3] = toroidalSpeed * (-y / rho);     // Tangential in X-Y plane
            velocities[i3 + 1] = toroidalSpeed * (x / rho);  // Tangential in X-Y plane
            velocities[i3 + 2] = 0;                          // No initial Z velocity
            
            // Add some poloidal motion (around the minor radius)
            const poloidalSpeed = 0.02 / config.mass;
            const theta = Math.atan2(y, x);
            velocities[i3 + 2] += poloidalSpeed * (Math.random() - 0.5);
            
            // Add small random motion
            velocities[i3] += (Math.random() - 0.5) * config.speed * 0.3;
            velocities[i3 + 1] += (Math.random() - 0.5) * config.speed * 0.3;
            velocities[i3 + 2] += (Math.random() - 0.5) * config.speed * 0.2;
        }

        // High-quality procedural texture for smooth circular particles
        createParticleTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 256;  // Much higher resolution for sharper particles
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            const center = 128;
            
            // Create smooth radial gradient with multiple stops
            const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.1, 'rgba(255,255,255,0.9)');
            gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
            gradient.addColorStop(0.6, 'rgba(255,255,255,0.3)');
            gradient.addColorStop(0.8, 'rgba(255,255,255,0.1)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 256, 256);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.generateMipmaps = false;  // Disable mipmaps to avoid issues
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.ClampToEdgeWrap;
            texture.wrapT = THREE.ClampToEdgeWrap;
            return texture;
        }

        // Create lightning system for electrical arcing effects
        createLightningSystem() {
            this.lightningLines = [];
            
            // Pre-create lightning line objects for performance
            for (let i = 0; i < 20; i++) {
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(6); // 2 points, 3 coords each
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                
                const material = new THREE.LineBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0,
                    linewidth: 2,
                    blending: THREE.AdditiveBlending
                });
                
                const line = new THREE.Line(geometry, material);
                this.scene.add(line);
                
                this.lightningLines.push({
                    line: line,
                    active: false,
                    lifetime: 0,
                    maxLifetime: 0.3,
                    intensity: 0
                });
            }
        }

        // Create magnetic reconnection system for dramatic energy events
        createReconnectionSystem() {
            // Pre-create reconnection flash objects for performance
            for (let i = 0; i < 5; i++) {
                const geometry = new THREE.SphereGeometry(0.1, 8, 6);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0,
                    blending: THREE.AdditiveBlending
                });
                
                const flash = new THREE.Mesh(geometry, material);
                this.scene.add(flash);
                
                this.reconnectionFlashes.push({
                    mesh: flash,
                    active: false,
                    lifetime: 0,
                    maxLifetime: 0.5,
                    intensity: 0,
                    maxScale: 3.0
                });
            }
        }

        // Create fusion reaction system for particle collisions
        createFusionSystem() {
            // Pre-create fusion flash objects for performance
            for (let i = 0; i < 10; i++) {
                const geometry = new THREE.SphereGeometry(0.05, 6, 4);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xfff8dc, // Bright yellow-white
                    transparent: true,
                    opacity: 0,
                    blending: THREE.AdditiveBlending
                });
                
                const flash = new THREE.Mesh(geometry, material);
                this.scene.add(flash);
                
                this.fusionFlashes.push({
                    mesh: flash,
                    active: false,
                    lifetime: 0,
                    maxLifetime: 0.3,
                    intensity: 0,
                    maxScale: 2.0
                });
            }
        }

        // No visible containment - particles contained by physics boundaries
        setupContainment() {
            // Containment sphere removed for cleaner visualization
        }

        // Setup mouse interaction for disturbing the plasma field
        setupMouseInteraction() {
            const canvas = this.renderer.domElement;
            
            canvas.addEventListener('mousemove', (event) => {
                const rect = canvas.getBoundingClientRect();
                this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                
                // Convert mouse to world coordinates
                const vector = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5);
                vector.unproject(this.camera);
                const dir = vector.sub(this.camera.position).normalize();
                const distance = -this.camera.position.z / dir.z;
                this.mouseWorld.copy(this.camera.position).add(dir.multiplyScalar(distance));
            });

            canvas.addEventListener('mouseenter', () => {
                this.mouseInfluence = 1.0;
            });

            canvas.addEventListener('mouseleave', () => {
                this.mouseInfluence = 0.0;
            });
        }

        // Setup OrbitControls for interaction (mouse/touch)
        setupControls() {
            // Use the dedicated interaction overlay instead of the canvas
            const controlElement = document.getElementById('plasmaInteractionOverlay');
            
            if (typeof THREE.OrbitControls !== 'undefined' && controlElement) {
                console.log('Setting up OrbitControls with overlay...');
                this.controls = new THREE.OrbitControls(this.camera, controlElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.05;
                this.controls.enableZoom = true;
                this.controls.enableRotate = true;
                this.controls.enablePan = true;
                this.controls.maxDistance = 50;
                this.controls.minDistance = 5;
                this.controls.maxPolarAngle = Math.PI; // Allow full rotation
                
                console.log('OrbitControls setup complete with overlay');
            } else {
                console.warn('Setting up manual controls with overlay');
                this.setupManualControls();
            }
        }
        
        // Manual camera controls as fallback
        setupManualControls() {
            this.cameraControls = {
                isMouseDown: false,
                lastMouseX: 0,
                lastMouseY: 0,
                cameraDistance: 10,
                cameraAngleX: 0,
                cameraAngleY: 0 // Start looking straight at center
            };
            
            const canvas = document.getElementById('plasmaInteractionOverlay') || this.renderer.domElement;
            
            canvas.addEventListener('mousedown', (event) => {
                this.cameraControls.isMouseDown = true;
                this.cameraControls.lastMouseX = event.clientX;
                this.cameraControls.lastMouseY = event.clientY;
            });
            
            canvas.addEventListener('mousemove', (event) => {
                if (this.cameraControls.isMouseDown) {
                    const deltaX = event.clientX - this.cameraControls.lastMouseX;
                    const deltaY = event.clientY - this.cameraControls.lastMouseY;
                    
                    this.cameraControls.cameraAngleX += deltaX * 0.01;
                    this.cameraControls.cameraAngleY += deltaY * 0.01;
                    
                    // Limit vertical rotation
                    this.cameraControls.cameraAngleY = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraControls.cameraAngleY));
                    
                    this.updateCameraPosition();
                    
                    this.cameraControls.lastMouseX = event.clientX;
                    this.cameraControls.lastMouseY = event.clientY;
                }
            });
            
            canvas.addEventListener('mouseup', () => {
                this.cameraControls.isMouseDown = false;
            });
            
            canvas.addEventListener('wheel', (event) => {
                event.preventDefault();
                this.cameraControls.cameraDistance += event.deltaY * 0.01;
                this.cameraControls.cameraDistance = Math.max(5, Math.min(50, this.cameraControls.cameraDistance));
                this.updateCameraPosition();
            });
            
            console.log('Manual camera controls setup complete');
        }
        
        updateCameraPosition() {
            const x = this.cameraControls.cameraDistance * Math.sin(this.cameraControls.cameraAngleY) * Math.cos(this.cameraControls.cameraAngleX);
            const y = this.cameraControls.cameraDistance * Math.cos(this.cameraControls.cameraAngleY);
            const z = this.cameraControls.cameraDistance * Math.sin(this.cameraControls.cameraAngleY) * Math.sin(this.cameraControls.cameraAngleX);
            
            this.camera.position.set(x, y, z);
            this.camera.lookAt(0, 0, 0);
        }

        // Setup post-processing pipeline for cinematic bloom effect on plasma
        setupPostProcessing() {
            this.composer = new THREE.EffectComposer(this.renderer);
            const renderPass = new THREE.RenderPass(this.scene, this.camera);
            this.composer.addPass(renderPass);

            // UnrealBloomPass for glowing plasma highlights
            const bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                this.params.bloomStrength, // Strength
                this.params.bloomRadius,   // Radius
                this.params.bloomThreshold // Threshold
            );
            this.composer.addPass(bloomPass);
        }

        // Animation loop: Update particles, controls, and render
        animate() {
            requestAnimationFrame(() => this.animate());

            const delta = this.clock.getDelta() * this.params.animationSpeed;

            // Update controls if available
            if (this.controls) {
                this.controls.update();
            }

            // Update particle lifecycle
            this.updateParticleLifecycle(delta);

            // Update all particle systems with enhanced physics
            this.updateParticleSystem(this.electronSystem, delta);
            this.updateParticleSystem(this.ionSystem, delta);
            this.updateParticleSystem(this.neutralSystem, delta);

            // Update lightning effects
            this.updateLightning(delta);

            // Update magnetic reconnection events
            this.updateReconnectionEvents(delta);

            // Update plasma instabilities
            this.updatePlasmaInstabilities(delta);

            // Update fusion reactions
            this.updateFusionSystem(delta);

            // Update turbulent cascades
            this.updateTurbulentCascades(delta);

            // Render the scene (use composer if available)
            if (this.usePostProcessing && this.composer) {
                this.composer.render();
            } else {
                this.renderer.render(this.scene, this.camera);
            }
        }

        // Update particle lifecycle phases
        updateParticleLifecycle(delta) {
            this.particleLifecycle.time += delta;
            
            const cycleDuration = this.params.particleCycleDuration;
            const deathDuration = this.params.deathPhaseDuration;
            const birthDuration = this.params.birthPhaseDuration;
            const activeDuration = cycleDuration - deathDuration - birthDuration;
            
            this.particleLifecycle.cycleProgress = (this.particleLifecycle.time % cycleDuration) / cycleDuration;
            const cycleTime = this.particleLifecycle.time % cycleDuration;
            
            // Determine current phase
            if (cycleTime < activeDuration) {
                // Active phase
                this.particleLifecycle.phase = 'active';
                this.particleLifecycle.phaseProgress = cycleTime / activeDuration;
            } else if (cycleTime < activeDuration + deathDuration) {
                // Dying phase
                this.particleLifecycle.phase = 'dying';
                this.particleLifecycle.phaseProgress = (cycleTime - activeDuration) / deathDuration;
            } else {
                // Birthing phase (recreating)
                this.particleLifecycle.phase = 'birthing';
                this.particleLifecycle.phaseProgress = (cycleTime - activeDuration - deathDuration) / birthDuration;
            }
        }

        // Enhanced particle system update with type-specific physics
        updateParticleSystem(system, delta) {
            if (!system || !system.userData) return;

            const { config, velocities, lifetimes, maxLifetimes, baseOpacity } = system.userData;
            const positionsArray = system.geometry.attributes.position.array;
            const radius = 3.2;
            const time = this.clock.getElapsedTime();
            
            // Constants for torus geometry (declare once outside loop)
            const majorRadius = 2.5;
            const minorRadius = 1.2;
            const maxVertical = 1.5;
            
            // Update system opacity based on lifecycle phase
            let systemOpacity = baseOpacity;
            if (this.particleLifecycle.phase === 'dying') {
                systemOpacity = baseOpacity * (1.0 - this.particleLifecycle.phaseProgress);
            } else if (this.particleLifecycle.phase === 'birthing') {
                systemOpacity = baseOpacity * this.particleLifecycle.phaseProgress;
            }
            system.material.opacity = systemOpacity;

            for (let i = 0; i < config.count; i++) {
                const i3 = i * 3;
                
                // Handle particle recreation during birthing phase
                if (this.particleLifecycle.phase === 'birthing' && Math.random() < delta * 2.0) {
                    // Randomly recreate particles during birthing phase
                    if (lifetimes[i] <= 0) {
                        this.resetParticlePosition(positionsArray, i3);
                        this.resetParticleVelocity(velocities, positionsArray, i3, config);
                        lifetimes[i] = maxLifetimes[i];
                    }
                }
                
                // Update individual particle lifetime
                if (this.particleLifecycle.phase === 'dying') {
                    lifetimes[i] -= delta * (1.0 + Math.random() * 0.5) / this.params.deathPhaseDuration;
                    lifetimes[i] = Math.max(0, lifetimes[i]);
                }
                
                // Skip physics for dead particles
                if (lifetimes[i] <= 0) continue;
                
                // Current position
                const x = positionsArray[i3];
                const y = positionsArray[i3 + 1];
                const z = positionsArray[i3 + 2];

                // Mouse interaction force
                if (this.mouseInfluence > 0) {
                    const mouseDistX = x - this.mouseWorld.x;
                    const mouseDistY = y - this.mouseWorld.y;
                    const mouseDistZ = z - this.mouseWorld.z;
                    const mouseDist = Math.sqrt(mouseDistX*mouseDistX + mouseDistY*mouseDistY + mouseDistZ*mouseDistZ);
                    
                    if (mouseDist < 2.0 && mouseDist > 0.1) {
                        const mouseForce = this.params.mouseForce * this.mouseInfluence / (mouseDist * mouseDist);
                        const forceDirection = config.charge; // Electrons attracted, ions repelled
                        velocities[i3] += (mouseDistX / mouseDist) * mouseForce * forceDirection * delta;
                        velocities[i3 + 1] += (mouseDistY / mouseDist) * mouseForce * forceDirection * delta;
                        velocities[i3 + 2] += (mouseDistZ / mouseDist) * mouseForce * forceDirection * delta * 0.5;
                    }
                }

                // Magnetic reconnection forces - dramatic particle acceleration
                this.reconnectionEvents.forEach(event => {
                    const reconnectDistX = x - event.position.x;
                    const reconnectDistY = y - event.position.y;
                    const reconnectDistZ = z - event.position.z;
                    const reconnectDist = Math.sqrt(reconnectDistX*reconnectDistX + reconnectDistY*reconnectDistY + reconnectDistZ*reconnectDistZ);
                    
                    if (reconnectDist < event.radius && reconnectDist > 0.1) {
                        // Strong acceleration away from reconnection point
                        const reconnectForce = event.strength * (1.0 - reconnectDist / event.radius) / config.mass;
                        const progress = 1.0 - (event.lifetime / event.maxLifetime);
                        const timeMultiplier = progress * (2.0 - progress); // Peak at 50% of lifetime
                        
                        velocities[i3] += (reconnectDistX / reconnectDist) * reconnectForce * timeMultiplier * delta * 15;
                        velocities[i3 + 1] += (reconnectDistY / reconnectDist) * reconnectForce * timeMultiplier * delta * 15;
                        velocities[i3 + 2] += (reconnectDistZ / reconnectDist) * reconnectForce * timeMultiplier * delta * 8;
                    }
                });

                // Apply plasma instability forces
                this.applyInstabilityForces(x, y, z, velocities, i3, config, delta);

                // Apply fusion energy release forces
                this.applyFusionForces(x, y, z, velocities, i3, config, delta);

                // Apply turbulent cascade forces
                this.applyTurbulentForces(x, y, z, velocities, i3, config, delta);

                // Toroidal plasma forces
                const rho = Math.sqrt(x*x + y*y) || 0.001; // Distance from Z-axis
                
                // Magnetic confinement force (keeps particles in torus shape) - affected by stability
                const baseConfinement = 0.015 * (1 + 0.3 * Math.sin(time * 2)) / config.mass;
                const confinementStrength = baseConfinement * this.stabilityFactor;
                
                // Radial restoring force toward major radius  
                const radialDeviation = rho - majorRadius;
                const radialForce = -radialDeviation * confinementStrength;
                const radialX = radialForce * (x / rho);
                const radialY = radialForce * (y / rho);
                
                // Vertical confinement (keeps particles near midplane)
                const verticalForce = -z * confinementStrength * 0.8;
                
                if (config.charge !== 0) {
                    // Charged particles: toroidal and poloidal motion
                    const toroidalFreq = 0.6 * config.charge / config.mass;
                    const poloidalFreq = 0.3 * config.charge / config.mass;
                    
                    // Toroidal drift (around major radius)
                    const toroidalX = toroidalFreq * (-y / rho) * delta;
                    const toroidalY = toroidalFreq * (x / rho) * delta;
                    
                    // Poloidal motion (around minor radius)
                    const poloidalZ = poloidalFreq * (x * Math.sin(time) + y * Math.cos(time)) * delta * 0.1;
                    
                    velocities[i3] += radialX + toroidalX;
                    velocities[i3 + 1] += radialY + toroidalY;
                    velocities[i3 + 2] += verticalForce + poloidalZ;
                } else {
                    // Neutral particles: weaker confinement
                    const neutralConfinement = confinementStrength * 0.4;
                    const neutralToroidal = 0.2 / config.mass;
                    
                    velocities[i3] += radialX * 0.5 + neutralToroidal * (-y / rho) * delta;
                    velocities[i3 + 1] += radialY * 0.5 + neutralToroidal * (x / rho) * delta;
                    velocities[i3 + 2] += verticalForce * 0.5;
                }

                // Thermal motion (mass-dependent)
                const thermalForce = 0.02 * this.params.energyLevel / Math.sqrt(config.mass);
                velocities[i3] += (Math.random() - 0.5) * thermalForce * delta;
                velocities[i3 + 1] += (Math.random() - 0.5) * thermalForce * delta;
                velocities[i3 + 2] += (Math.random() - 0.5) * thermalForce * delta * 0.5;

                // Update positions
                positionsArray[i3] += velocities[i3] * delta;
                positionsArray[i3 + 1] += velocities[i3 + 1] * delta;
                positionsArray[i3 + 2] += velocities[i3 + 2] * delta;

                // Toroidal containment boundary
                const rhoNew = Math.sqrt(positionsArray[i3]**2 + positionsArray[i3 + 1]**2);
                
                // Check if particle is outside torus bounds
                const distFromMajorRadius = Math.abs(rhoNew - majorRadius);
                const verticalDist = Math.abs(positionsArray[i3 + 2]);
                
                if (distFromMajorRadius > minorRadius || verticalDist > maxVertical) {
                    // Reset particle back into torus
                    this.resetParticlePosition(positionsArray, i3);
                    this.resetParticleVelocity(velocities, positionsArray, i3, config);
                    
                    // Apply some damping
                    velocities[i3] *= 0.5;
                    velocities[i3 + 1] *= 0.5;
                    velocities[i3 + 2] *= 0.5;
                }

                // Velocity damping
                velocities[i3] *= 0.998;
                velocities[i3 + 1] *= 0.998;
                velocities[i3 + 2] *= 0.998;
            }

            system.geometry.attributes.position.needsUpdate = true;
        }

        // Update lightning/arcing effects
        updateLightning(delta) {
            const time = this.clock.getElapsedTime();
            
            // Update existing lightning
            this.lightningLines.forEach(lightning => {
                if (lightning.active) {
                    lightning.lifetime -= delta;
                    lightning.intensity = lightning.lifetime / lightning.maxLifetime;
                    lightning.line.material.opacity = lightning.intensity * 0.8;
                    
                    if (lightning.lifetime <= 0) {
                        lightning.active = false;
                        lightning.line.material.opacity = 0;
                    }
                }
            });

            // Create new lightning bolts randomly
            if (Math.random() < this.params.lightningIntensity * delta * 2) {
                this.createLightningBolt();
            }
        }

        // Create individual lightning bolt between particle clusters
        createLightningBolt() {
            // Find inactive lightning line
            const lightning = this.lightningLines.find(l => !l.active);
            if (!lightning) return;

            // Get random particles from different systems for connection
            const systems = [this.electronSystem, this.ionSystem, this.neutralSystem].filter(s => s);
            if (systems.length < 2) return;

            const system1 = systems[Math.floor(Math.random() * systems.length)];
            const system2 = systems[Math.floor(Math.random() * systems.length)];

            const pos1 = system1.geometry.attributes.position.array;
            const pos2 = system2.geometry.attributes.position.array;

            const idx1 = Math.floor(Math.random() * system1.userData.config.count) * 3;
            const idx2 = Math.floor(Math.random() * system2.userData.config.count) * 3;

            // Check if particles are close enough for arcing
            const dx = pos1[idx1] - pos2[idx2];
            const dy = pos1[idx1 + 1] - pos2[idx2 + 1];
            const dz = pos1[idx1 + 2] - pos2[idx2 + 2];
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

            if (distance < 1.5 && distance > 0.2) { // Suitable distance for arcing
                const positions = lightning.line.geometry.attributes.position.array;
                positions[0] = pos1[idx1];
                positions[1] = pos1[idx1 + 1];
                positions[2] = pos1[idx1 + 2];
                positions[3] = pos2[idx2];
                positions[4] = pos2[idx2 + 1];
                positions[5] = pos2[idx2 + 2];

                lightning.line.geometry.attributes.position.needsUpdate = true;
                lightning.active = true;
                lightning.lifetime = lightning.maxLifetime;
                lightning.intensity = 1.0;
                
                // Color based on particle types
                const color = new THREE.Color().lerpColors(
                    new THREE.Color(system1.material.color),
                    new THREE.Color(system2.material.color),
                    0.5
                );
                lightning.line.material.color = color;
            }
        }

        // Trigger a magnetic reconnection event at a random location
        triggerReconnectionEvent() {
            // Find inactive flash
            const flash = this.reconnectionFlashes.find(f => !f.active);
            if (!flash) return;

            // Random position along the torus
            const theta = Math.random() * Math.PI * 2;
            const majorRadius = 2.5;
            
            const x = majorRadius * Math.cos(theta);
            const y = majorRadius * Math.sin(theta);
            const z = (Math.random() - 0.5) * 0.4; // Small z variation
            
            flash.mesh.position.set(x, y, z);
            flash.mesh.scale.set(0.1, 0.1, 0.1);
            flash.active = true;
            flash.lifetime = flash.maxLifetime;
            flash.intensity = 1.0;
            
            // Create reconnection zone for particle acceleration
            this.reconnectionEvents.push({
                position: new THREE.Vector3(x, y, z),
                lifetime: 2.0,
                maxLifetime: 2.0,
                strength: 0.3,
                radius: 1.5
            });
        }

        // Update magnetic reconnection events
        updateReconnectionEvents(delta) {
            // Trigger random reconnection events
            if (Math.random() < 0.0008 * delta * 60) { // About every 20 seconds on average
                this.triggerReconnectionEvent();
            }

            // Update reconnection flashes
            this.reconnectionFlashes.forEach(flash => {
                if (flash.active) {
                    flash.lifetime -= delta;
                    flash.intensity = flash.lifetime / flash.maxLifetime;
                    
                    // Scale and fade the flash
                    const scale = 0.1 + (1.0 - flash.intensity) * flash.maxScale;
                    flash.mesh.scale.set(scale, scale, scale);
                    flash.mesh.material.opacity = flash.intensity * 0.8;
                    
                    if (flash.lifetime <= 0) {
                        flash.active = false;
                        flash.mesh.material.opacity = 0;
                    }
                }
            });

            // Update reconnection zones and remove expired ones
            this.reconnectionEvents = this.reconnectionEvents.filter(event => {
                event.lifetime -= delta;
                return event.lifetime > 0;
            });
        }

        // Update plasma instability system
        updatePlasmaInstabilities(delta) {
            this.instabilityTimer += delta;
            
            // Instability cycle: 60-120 seconds stable, then 15-30 seconds of disruption
            const cycleDuration = 90 + Math.sin(this.instabilityTimer * 0.01) * 30; // 60-120 seconds
            const cycleProgress = (this.instabilityTimer % cycleDuration) / cycleDuration;
            
            if (cycleProgress < 0.8) {
                // Stable phase - slowly build up towards instability
                this.instabilityPhase = 'stable';
                this.stabilityFactor = 1.0 - cycleProgress * 0.3; // Slowly decrease stability
            } else if (cycleProgress < 0.9) {
                // Unstable phase - rapid destabilization
                this.instabilityPhase = 'unstable';
                const unstableProgress = (cycleProgress - 0.8) / 0.1;
                this.stabilityFactor = 0.7 - unstableProgress * 0.5; // Rapid decrease
                
                // Create disruption sectors randomly
                if (Math.random() < delta * 3 && this.disruptionSectors.length < 8) {
                    const sector = {
                        angle: Math.random() * Math.PI * 2,
                        width: 0.3 + Math.random() * 0.5,
                        strength: 0.3 + Math.random() * 0.4,
                        lifetime: 5.0 + Math.random() * 10.0,
                        maxLifetime: 15.0
                    };
                    this.disruptionSectors.push(sector);
                }
            } else {
                // Recovery phase - gradually restabilize
                this.instabilityPhase = 'recovering';
                const recoveryProgress = (cycleProgress - 0.9) / 0.1;
                this.stabilityFactor = 0.2 + recoveryProgress * 0.8; // Gradual increase
                
                // Remove disruption sectors
                this.disruptionSectors = this.disruptionSectors.filter(sector => {
                    sector.lifetime -= delta * 2; // Faster decay during recovery
                    return sector.lifetime > 0;
                });
            }
            
            // Update existing disruption sectors
            this.disruptionSectors.forEach(sector => {
                sector.lifetime -= delta;
                sector.strength *= 0.998; // Gradually weaken
            });
            
            // Remove expired sectors
            this.disruptionSectors = this.disruptionSectors.filter(sector => sector.lifetime > 0);
        }

        // Apply instability forces to particles
        applyInstabilityForces(x, y, z, velocities, i3, config, delta) {
            if (this.instabilityPhase === 'stable') return;
            
            const angle = Math.atan2(y, x);
            const rho = Math.sqrt(x*x + y*y);
            
            // Check if particle is in a disruption sector
            this.disruptionSectors.forEach(sector => {
                let angleDiff = Math.abs(angle - sector.angle);
                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                
                if (angleDiff < sector.width) {
                    // Particle is in disruption zone - apply strong outward force
                    const sectorIntensity = sector.strength * (1.0 - angleDiff / sector.width);
                    const instabilityForce = sectorIntensity * 0.4 / config.mass;
                    
                    // Radial ejection force
                    const radialX = instabilityForce * (x / rho);
                    const radialY = instabilityForce * (y / rho);
                    const verticalZ = instabilityForce * (Math.random() - 0.5) * 0.5;
                    
                    velocities[i3] += radialX * delta * 20;
                    velocities[i3 + 1] += radialY * delta * 20;
                    velocities[i3 + 2] += verticalZ * delta * 10;
                    
                    // Add some chaotic motion
                    velocities[i3] += (Math.random() - 0.5) * instabilityForce * delta * 10;
                    velocities[i3 + 1] += (Math.random() - 0.5) * instabilityForce * delta * 10;
                    velocities[i3 + 2] += (Math.random() - 0.5) * instabilityForce * delta * 5;
                }
            });
        }

        // Detect and create fusion reactions between particles
        detectFusionReactions(delta) {
            // Only check a subset of particles each frame for performance
            const electronPos = this.electronSystem?.geometry.attributes.position.array;
            const ionPos = this.ionSystem?.geometry.attributes.position.array;
            const electronVel = this.electronSystem?.userData.velocities;
            const ionVel = this.ionSystem?.userData.velocities;
            
            if (!electronPos || !ionPos) return;
            
            // Check random pairs for fusion potential
            for (let checks = 0; checks < 20; checks++) {
                const eIdx = Math.floor(Math.random() * (electronPos.length / 3)) * 3;
                const iIdx = Math.floor(Math.random() * (ionPos.length / 3)) * 3;
                
                const dx = electronPos[eIdx] - ionPos[iIdx];
                const dy = electronPos[eIdx + 1] - ionPos[iIdx + 1];
                const dz = electronPos[eIdx + 2] - ionPos[iIdx + 2];
                const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                // Very close approach needed for fusion
                if (distance < 0.08) {
                    // Calculate relative velocity
                    const dvx = electronVel[eIdx] - ionVel[iIdx];
                    const dvy = electronVel[eIdx + 1] - ionVel[iIdx + 1];
                    const dvz = electronVel[eIdx + 2] - ionVel[iIdx + 2];
                    const relativeSpeed = Math.sqrt(dvx*dvx + dvy*dvy + dvz*dvz);
                    
                    // Fusion probability based on kinetic energy
                    const fusionProbability = Math.min(0.02, relativeSpeed * 0.001);
                    
                    if (Math.random() < fusionProbability) {
                        this.createFusionEvent(
                            (electronPos[eIdx] + ionPos[iIdx]) * 0.5,
                            (electronPos[eIdx + 1] + ionPos[iIdx + 1]) * 0.5,
                            (electronPos[eIdx + 2] + ionPos[iIdx + 2]) * 0.5,
                            relativeSpeed
                        );
                    }
                }
            }
        }

        // Create a fusion event at the specified location
        createFusionEvent(x, y, z, energy) {
            // Find inactive flash
            const flash = this.fusionFlashes.find(f => !f.active);
            if (!flash) return;
            
            flash.mesh.position.set(x, y, z);
            flash.mesh.scale.set(0.05, 0.05, 0.05);
            flash.active = true;
            flash.lifetime = flash.maxLifetime;
            flash.intensity = 1.0;
            
            // Create fusion energy release zone
            this.fusionEvents.push({
                position: new THREE.Vector3(x, y, z),
                lifetime: 1.0,
                maxLifetime: 1.0,
                energy: energy * 0.1,
                radius: 0.5
            });
        }

        // Update fusion system
        updateFusionSystem(delta) {
            // Detect new fusion reactions
            this.detectFusionReactions(delta);
            
            // Update fusion flashes
            this.fusionFlashes.forEach(flash => {
                if (flash.active) {
                    flash.lifetime -= delta;
                    flash.intensity = flash.lifetime / flash.maxLifetime;
                    
                    // Quick bright flash that fades rapidly
                    const scale = 0.05 + (1.0 - flash.intensity) * flash.maxScale;
                    flash.mesh.scale.set(scale, scale, scale);
                    flash.mesh.material.opacity = flash.intensity * 1.0;
                    
                    if (flash.lifetime <= 0) {
                        flash.active = false;
                        flash.mesh.material.opacity = 0;
                    }
                }
            });
            
            // Update fusion energy zones and remove expired ones
            this.fusionEvents = this.fusionEvents.filter(event => {
                event.lifetime -= delta;
                return event.lifetime > 0;
            });
        }

        // Apply fusion energy release forces to nearby particles
        applyFusionForces(x, y, z, velocities, i3, config, delta) {
            this.fusionEvents.forEach(event => {
                const dx = x - event.position.x;
                const dy = y - event.position.y;
                const dz = z - event.position.z;
                const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (distance < event.radius && distance > 0.01) {
                    // Moderate outward force from fusion energy release
                    const fusionForce = event.energy * (1.0 - distance / event.radius) / config.mass;
                    const progress = 1.0 - (event.lifetime / event.maxLifetime);
                    const timeMultiplier = progress * (2.0 - progress); // Peak at 50% of lifetime
                    
                    velocities[i3] += (dx / distance) * fusionForce * timeMultiplier * delta * 8;
                    velocities[i3 + 1] += (dy / distance) * fusionForce * timeMultiplier * delta * 8;
                    velocities[i3 + 2] += (dz / distance) * fusionForce * timeMultiplier * delta * 4;
                }
            });
        }

        // Update turbulent cascade system
        updateTurbulentCascades(delta) {
            this.turbulenceTime += delta;
            
            // Vary turbulence intensity over time
            this.turbulenceIntensity = 0.2 + 0.15 * Math.sin(this.turbulenceTime * 0.3) + 
                                      0.1 * Math.sin(this.turbulenceTime * 0.7) +
                                      0.05 * Math.sin(this.turbulenceTime * 1.3);
        }

        // Apply turbulent forces using Perlin-like noise
        applyTurbulentForces(x, y, z, velocities, i3, config, delta) {
            const time = this.turbulenceTime;
            
            // Multi-scale turbulent field using sine waves (simplified Perlin noise)
            // Large scale vortices
            const largeScale = 0.3;
            const largeTurbX = Math.sin(x * largeScale + time * 0.5) * Math.cos(y * largeScale + time * 0.3);
            const largeTurbY = Math.cos(x * largeScale + time * 0.7) * Math.sin(y * largeScale + time * 0.4);
            const largeTurbZ = Math.sin(z * largeScale * 2 + time * 0.6) * 0.5;
            
            // Medium scale eddies
            const mediumScale = 0.8;
            const mediumTurbX = Math.sin(x * mediumScale + time * 1.2) * Math.cos(y * mediumScale + time * 0.9);
            const mediumTurbY = Math.cos(x * mediumScale + time * 1.5) * Math.sin(y * mediumScale + time * 1.1);
            const mediumTurbZ = Math.sin(z * mediumScale * 2 + time * 1.3) * 0.3;
            
            // Small scale turbulence
            const smallScale = 2.0;
            const smallTurbX = Math.sin(x * smallScale + time * 2.1) * Math.cos(y * smallScale + time * 1.8);
            const smallTurbY = Math.cos(x * smallScale + time * 2.4) * Math.sin(y * smallScale + time * 2.2);
            const smallTurbZ = Math.sin(z * smallScale * 2 + time * 2.0) * 0.2;
            
            // Combine scales with different strengths (energy cascade)
            const turbX = largeTurbX * 0.6 + mediumTurbX * 0.3 + smallTurbX * 0.1;
            const turbY = largeTurbY * 0.6 + mediumTurbY * 0.3 + smallTurbY * 0.1;
            const turbZ = largeTurbZ * 0.6 + mediumTurbZ * 0.3 + smallTurbZ * 0.1;
            
            // Apply turbulent forces
            const turbulentForce = this.turbulenceIntensity * 0.02 / config.mass;
            
            velocities[i3] += turbX * turbulentForce * delta;
            velocities[i3 + 1] += turbY * turbulentForce * delta;
            velocities[i3 + 2] += turbZ * turbulentForce * delta * 0.5; // Reduce vertical turbulence
        }
    }
});