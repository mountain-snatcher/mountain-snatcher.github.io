// Plasma Field Background Animation
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

    class PlasmaBackground {
        constructor(container) {
            this.container = container;
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.clock = new THREE.Clock();
            
            // Particle systems
            this.electronSystem = null;
            this.ionSystem = null;
            this.neutralSystem = null;
            this.lightningLines = [];
            
            // Mouse interaction
            this.mouse = new THREE.Vector2();
            this.mouseWorld = new THREE.Vector3();
            this.mouseInfluence = 0;
            
            // Enhanced background parameters
            this.params = {
                electronCount: 800,         // Increased particle count
                ionCount: 600,
                neutralCount: 400,
                animationSpeed: 0.8,
                lightningIntensity: 0.6,
                mouseForce: 1.5,
                energyLevel: 1.2
            };

            this.init();
        }

        init() {
            this.createScene();
            this.createLighting();
            this.createParticles();
            this.createLightning();
            this.setupMouseInteraction();
            this.setupResize();
            this.animate();
        }

        createScene() {
            // Scene with deep space background
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x000008);
            this.scene.fog = new THREE.Fog(0x000008, 8, 25);

            // Camera - positioned for background effect
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
            this.camera.position.set(0, 2, 10);

            // Enhanced renderer for better visual quality
            this.renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                alpha: true,
                powerPreference: "default"
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.setClearColor(0x000008, 0);
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.0;
            this.container.appendChild(this.renderer.domElement);
        }

        createLighting() {
            // Hemisphere light for soft ambient illumination
            const hemiLight = new THREE.HemisphereLight(0x444444, 0x000011, 0.6);
            hemiLight.position.set(0, 20, 0);
            this.scene.add(hemiLight);

            // Directional light for highlights
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(10, 10, 5);
            this.scene.add(dirLight);

            // Point light for plasma glow
            const pointLight = new THREE.PointLight(0x00ff88, 1.2, 50);
            pointLight.position.set(0, 0, 5);
            this.scene.add(pointLight);
        }

        createParticleTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
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

        createParticleType(config) {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(config.count * 3);
            const velocities = new Float32Array(config.count * 3);

            // Enhanced clustered distribution
            for (let i = 0; i < config.count; i++) {
                const i3 = i * 3;
                
                // Create clusters and filaments
                const clusterIndex = Math.floor(Math.random() * 4);
                const clusterAngle = (clusterIndex / 4) * Math.PI * 2;
                const clusterRadius = 1.2 + Math.random() * 1.8;
                
                const localRadius = Math.pow(Math.random(), 0.6) * 0.9;
                const theta = clusterAngle + (Math.random() - 0.5) * Math.PI * 0.4;
                const phi = Math.acos(2 * Math.random() - 1);
                
                positions[i3] = clusterRadius * Math.cos(clusterAngle) + localRadius * Math.sin(phi) * Math.cos(theta);
                positions[i3 + 1] = clusterRadius * Math.sin(clusterAngle) + localRadius * Math.sin(phi) * Math.sin(theta);
                positions[i3 + 2] = localRadius * Math.cos(phi);

                // Type-specific velocities with swirl motion
                const swirl = 0.04 / config.mass;
                velocities[i3] = (Math.random() - 0.5) * config.speed + swirl * -positions[i3 + 1];
                velocities[i3 + 1] = (Math.random() - 0.5) * config.speed + swirl * positions[i3];
                velocities[i3 + 2] = (Math.random() - 0.5) * config.speed * 0.6;
            }
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            // Enhanced material with better rendering
            const material = new THREE.PointsMaterial({
                color: config.color,
                size: config.size,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending,
                map: this.createParticleTexture(),
                alphaTest: 0.001,
                depthWrite: false
            });
            
            const system = new THREE.Points(geometry, material);
            system.userData = {
                config: config,
                positions: positions,
                velocities: velocities
            };
            
            this.scene.add(system);
            return system;
        }

        createParticles() {
            // Electrons - blue, small, fast
            this.electronSystem = this.createParticleType({
                count: this.params.electronCount,
                color: 0x0088ff,
                size: 1.2,
                mass: 1,
                charge: -1,
                speed: 0.15
            });
            
            // Ions - red/orange, medium, slower
            this.ionSystem = this.createParticleType({
                count: this.params.ionCount,
                color: 0xff4400,
                size: 1.8,
                mass: 10,
                charge: 1,
                speed: 0.08
            });
            
            // Neutral atoms - purple/white, large, slow
            this.neutralSystem = this.createParticleType({
                count: this.params.neutralCount,
                color: 0xaa88ff,
                size: 2.2,
                mass: 15,
                charge: 0,
                speed: 0.04
            });
        }

        createLightning() {
            // Create lightning line objects for performance
            for (let i = 0; i < 15; i++) {
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

        setupResize() {
            window.addEventListener('resize', () => {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            });
        }

        updateParticleSystem(system, delta) {
            if (!system || !system.userData) return;

            const { config, positions, velocities } = system.userData;
            const positionsArray = system.geometry.attributes.position.array;
            const radius = 3.2;
            const time = this.clock.getElapsedTime();

            for (let i = 0; i < config.count; i++) {
                const i3 = i * 3;
                
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

                // Type-specific electromagnetic forces
                if (config.charge !== 0) {
                    const fieldStrength = 0.008 * (1 + 0.3 * Math.sin(time * 2)) / config.mass;
                    const dx = -x * fieldStrength;
                    const dy = -y * fieldStrength;
                    const dz = -z * fieldStrength * 0.5;
                    
                    // Cyclotron motion (charge-dependent)
                    const cyclotronFreq = 0.6 * config.charge / config.mass;
                    const cyclotronX = y * cyclotronFreq * delta;
                    const cyclotronY = -x * cyclotronFreq * delta;
                    
                    velocities[i3] += dx + cyclotronX;
                    velocities[i3 + 1] += dy + cyclotronY;
                    velocities[i3 + 2] += dz;
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

        animate() {
            requestAnimationFrame(() => this.animate());
            
            const delta = this.clock.getDelta() * this.params.animationSpeed;
            
            // Update particle systems
            this.updateParticleSystem(this.electronSystem, delta);
            this.updateParticleSystem(this.ionSystem, delta);
            this.updateParticleSystem(this.neutralSystem, delta);
            
            // Update lightning
            this.updateLightning(delta);
            
            // Render
            this.renderer.render(this.scene, this.camera);
        }
    }

    // Initialize plasma background
    new PlasmaBackground(container);
});