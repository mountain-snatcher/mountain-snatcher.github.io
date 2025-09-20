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

    // Wait for all dependencies to load
    setTimeout(() => {
        // Start the full simulation
        const simulation = new PlasmaFieldSimulation();
        simulation.init();
    }, 100);

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
        }

        // Initialize the simulation after dependency checks
        init() {
            // Step 1: Validate core dependencies
            if (typeof THREE === 'undefined') {
                console.error('THREE.js failed to load');
                return;
            }

            // Step 2: Check post-processing availability
            this.usePostProcessing = typeof THREE.EffectComposer !== 'undefined' &&
                                     typeof THREE.ShaderPass !== 'undefined' &&
                                     typeof THREE.RenderPass !== 'undefined' &&
                                     typeof THREE.UnrealBloomPass !== 'undefined';
            if (!this.usePostProcessing) {
                console.warn('Post-processing dependencies missing, falling back to basic rendering');
            }

            // Step 3: Setup scene, camera, renderer
            this.setupScene();
            this.setupCamera();
            this.setupRenderer();
            this.setupLighting();
            this.createEnvironment();
            this.createMultipleParticleTypes();
            this.createLightningSystem();
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
            // Static top-down view to show the complete circular plasma formation
            this.camera.position.set(0, 15, 0);
            this.camera.lookAt(0, 0, 0);
        }

        // Setup WebGL renderer with shadow support and high quality
        setupRenderer() {
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
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
                color: 0xaa88ff,
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
                opacity: 0.3,
                blending: THREE.AdditiveBlending,
                map: this.createParticleTexture(),
                alphaTest: 0.001,
                depthWrite: false
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
        
        // Reset particle position to start from center and spread out
        resetParticlePosition(positions, i3) {
            // Start particles near the center with small random spread
            const spreadRadius = 0.5; // Small initial spread
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = Math.random() * spreadRadius;
            
            positions[i3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = r * Math.cos(phi);
        }
        
        // Reset particle velocity with proper orbital motion
        resetParticleVelocity(velocities, positions, i3, config) {
            // Add initial outward velocity to spread particles from center
            const outwardForce = 0.1 / config.mass;
            const x = positions[i3];
            const y = positions[i3 + 1];
            const z = positions[i3 + 2];
            const distance = Math.sqrt(x*x + y*y + z*z) || 0.001;
            
            // Outward velocity
            velocities[i3] = (x / distance) * outwardForce;
            velocities[i3 + 1] = (y / distance) * outwardForce;
            velocities[i3 + 2] = (z / distance) * outwardForce * 0.5;
            
            // Add tangential velocity for orbital motion
            const swirl = 0.06 / config.mass;
            velocities[i3] += swirl * -y + (Math.random() - 0.5) * config.speed * 0.5;
            velocities[i3 + 1] += swirl * x + (Math.random() - 0.5) * config.speed * 0.5;
            velocities[i3 + 2] += (Math.random() - 0.5) * config.speed * 0.3;
        }

        // High-quality procedural texture for smooth circular particles
        createParticleTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 128;  // Higher resolution
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const center = 64;
            
            // Create smooth radial gradient with multiple stops
            const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.1, 'rgba(255,255,255,0.9)');
            gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
            gradient.addColorStop(0.6, 'rgba(255,255,255,0.3)');
            gradient.addColorStop(0.8, 'rgba(255,255,255,0.1)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 128, 128);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.generateMipmaps = false;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
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
            if (typeof THREE.OrbitControls !== 'undefined') {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.05;
                this.controls.enableZoom = true;
                this.controls.enableRotate = true;
                this.controls.enablePan = true;
                this.controls.maxDistance = 50;
                this.controls.minDistance = 5;
                this.controls.maxPolarAngle = Math.PI; // Allow full rotation
            }
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

                // Electromagnetic forces for all particles
                const fieldStrength = 0.012 * (1 + 0.3 * Math.sin(time * 2)) / config.mass;
                const dx = -x * fieldStrength;
                const dy = -y * fieldStrength;
                const dz = -z * fieldStrength * 0.5;
                
                if (config.charge !== 0) {
                    // Charged particles: strong electromagnetic forces
                    const cyclotronFreq = 0.8 * config.charge / config.mass;
                    const cyclotronX = y * cyclotronFreq * delta;
                    const cyclotronY = -x * cyclotronFreq * delta;
                    
                    velocities[i3] += dx + cyclotronX;
                    velocities[i3 + 1] += dy + cyclotronY;
                    velocities[i3 + 2] += dz;
                } else {
                    // Neutral particles: weaker magnetic field interaction
                    const neutralFieldStrength = fieldStrength * 0.3;
                    const neutralCyclotron = 0.2 / config.mass;
                    const neutralX = y * neutralCyclotron * delta;
                    const neutralY = -x * neutralCyclotron * delta;
                    
                    velocities[i3] += dx * 0.5 + neutralX;
                    velocities[i3 + 1] += dy * 0.5 + neutralY;
                    velocities[i3 + 2] += dz * 0.5;
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

                // Containment boundary
                const newDist = Math.sqrt(positionsArray[i3]**2 + positionsArray[i3 + 1]**2 + positionsArray[i3 + 2]**2);
                if (newDist > radius) {
                    const normalX = positionsArray[i3] / newDist;
                    const normalY = positionsArray[i3 + 1] / newDist;
                    const normalZ = positionsArray[i3 + 2] / newDist;
                    
                    positionsArray[i3] = normalX * radius;
                    positionsArray[i3 + 1] = normalY * radius;
                    positionsArray[i3 + 2] = normalZ * radius;
                    
                    // Elastic collision with energy loss
                    const dot = velocities[i3] * normalX + velocities[i3 + 1] * normalY + velocities[i3 + 2] * normalZ;
                    const damping = 0.7;
                    velocities[i3] -= 2 * dot * normalX * damping;
                    velocities[i3 + 1] -= 2 * dot * normalY * damping;
                    velocities[i3 + 2] -= 2 * dot * normalZ * damping;
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
    }
});