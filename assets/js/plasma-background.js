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
            
            // Background optimized parameters
            this.params = {
                electronCount: 200,
                ionCount: 150,
                neutralCount: 100,
                animationSpeed: 0.5,
                interactionRadius: 2.0,
                lightningFrequency: 0.3,
                mouseInfluence: 0.8
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
            // Scene
            this.scene = new THREE.Scene();
            this.scene.fog = new THREE.Fog(0x000511, 10, 100);

            // Camera - positioned for background effect
            this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
            this.camera.position.set(0, 0, 8);

            // Renderer with optimized settings for background
            this.renderer = new THREE.WebGLRenderer({ 
                antialias: false, // Disabled for performance
                alpha: true,
                powerPreference: "low-power"
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit pixel ratio
            this.renderer.setClearColor(0x000000, 0);
            this.container.appendChild(this.renderer.domElement);
        }

        createLighting() {
            const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
            this.scene.add(ambientLight);

            const pointLight = new THREE.PointLight(0x00ff88, 0.8, 50);
            pointLight.position.set(0, 0, 5);
            this.scene.add(pointLight);
        }

        createParticleTexture(size = 64) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
            
            const texture = new THREE.CanvasTexture(canvas);
            return texture;
        }

        createParticleType(config) {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(config.count * 3);
            const velocities = new Float32Array(config.count * 3);
            
            const range = 6;
            for (let i = 0; i < config.count; i++) {
                const i3 = i * 3;
                positions[i3] = (Math.random() - 0.5) * range;
                positions[i3 + 1] = (Math.random() - 0.5) * range;
                positions[i3 + 2] = (Math.random() - 0.5) * range;
                
                velocities[i3] = (Math.random() - 0.5) * config.speed;
                velocities[i3 + 1] = (Math.random() - 0.5) * config.speed;
                velocities[i3 + 2] = (Math.random() - 0.5) * config.speed;
            }
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            const material = new THREE.PointsMaterial({
                color: config.color,
                size: config.size,
                map: this.createParticleTexture(32), // Smaller texture for performance
                blending: THREE.AdditiveBlending,
                transparent: true,
                opacity: 0.8
            });
            
            const system = new THREE.Points(geometry, material);
            system.userData = {
                velocities: velocities,
                mass: config.mass,
                charge: config.charge,
                baseSpeed: config.speed
            };
            
            this.scene.add(system);
            return system;
        }

        createParticles() {
            // Electrons - blue, small, fast
            this.electronSystem = this.createParticleType({
                count: this.params.electronCount,
                color: 0x0088ff,
                size: 0.8,
                mass: 1,
                charge: -1,
                speed: 0.1
            });
            
            // Ions - red, medium, moderate speed
            this.ionSystem = this.createParticleType({
                count: this.params.ionCount,
                color: 0xff4444,
                size: 1.2,
                mass: 10,
                charge: 1,
                speed: 0.05
            });
            
            // Neutrals - white, small, slow
            this.neutralSystem = this.createParticleType({
                count: this.params.neutralCount,
                color: 0xffffff,
                size: 0.6,
                mass: 5,
                charge: 0,
                speed: 0.02
            });
        }

        createLightning() {
            // Create fewer lightning lines for performance
            for (let i = 0; i < 8; i++) {
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(6); // 2 points
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                
                const material = new THREE.LineBasicMaterial({
                    color: 0x88ffff,
                    transparent: true,
                    opacity: 0.6,
                    blending: THREE.AdditiveBlending
                });
                
                const line = new THREE.Line(geometry, material);
                line.visible = false;
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
            
            const onMouseMove = (event) => {
                this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
                
                // Convert to world coordinates
                const vector = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5);
                vector.unproject(this.camera);
                const dir = vector.sub(this.camera.position).normalize();
                const distance = -this.camera.position.z / dir.z;
                this.mouseWorld.copy(this.camera.position).add(dir.multiplyScalar(distance));
            };
            
            canvas.addEventListener('mousemove', onMouseMove);
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
            
            const positions = system.geometry.attributes.position.array;
            const velocities = system.userData.velocities;
            const charge = system.userData.charge;
            const count = positions.length / 3;
            
            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                
                // Mouse interaction
                if (charge !== 0) {
                    const dx = positions[i3] - this.mouseWorld.x;
                    const dy = positions[i3 + 1] - this.mouseWorld.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < this.params.interactionRadius) {
                        const force = this.params.mouseInfluence * charge / (distance + 0.1);
                        velocities[i3] += force * dx * delta;
                        velocities[i3 + 1] += force * dy * delta;
                    }
                }
                
                // Update positions
                positions[i3] += velocities[i3] * delta * this.params.animationSpeed;
                positions[i3 + 1] += velocities[i3 + 1] * delta * this.params.animationSpeed;
                positions[i3 + 2] += velocities[i3 + 2] * delta * this.params.animationSpeed;
                
                // Boundary containment
                const boundary = 5;
                ['x', 'y', 'z'].forEach((axis, axisIndex) => {
                    const pos = positions[i3 + axisIndex];
                    if (Math.abs(pos) > boundary) {
                        positions[i3 + axisIndex] = pos > 0 ? boundary : -boundary;
                        velocities[i3 + axisIndex] *= -0.8;
                    }
                });
            }
            
            system.geometry.attributes.position.needsUpdate = true;
        }

        updateLightning(delta) {
            // Update existing lightning
            this.lightningLines.forEach(lightning => {
                if (lightning.active) {
                    lightning.lifetime -= delta;
                    lightning.intensity = lightning.lifetime / lightning.maxLifetime;
                    lightning.line.material.opacity = lightning.intensity * 0.6;
                    
                    if (lightning.lifetime <= 0) {
                        lightning.active = false;
                        lightning.line.visible = false;
                    }
                }
            });
            
            // Create new lightning occasionally
            if (Math.random() < this.params.lightningFrequency * delta) {
                const inactiveLightning = this.lightningLines.find(l => !l.active);
                if (inactiveLightning) {
                    // Connect random particles
                    const systems = [this.electronSystem, this.ionSystem];
                    const system1 = systems[Math.floor(Math.random() * systems.length)];
                    const system2 = systems[Math.floor(Math.random() * systems.length)];
                    
                    const pos1 = system1.geometry.attributes.position.array;
                    const pos2 = system2.geometry.attributes.position.array;
                    
                    const idx1 = Math.floor(Math.random() * pos1.length / 3) * 3;
                    const idx2 = Math.floor(Math.random() * pos2.length / 3) * 3;
                    
                    const positions = inactiveLightning.line.geometry.attributes.position.array;
                    positions[0] = pos1[idx1];
                    positions[1] = pos1[idx1 + 1];
                    positions[2] = pos1[idx1 + 2];
                    positions[3] = pos2[idx2];
                    positions[4] = pos2[idx2 + 1];
                    positions[5] = pos2[idx2 + 2];
                    
                    inactiveLightning.line.geometry.attributes.position.needsUpdate = true;
                    inactiveLightning.line.visible = true;
                    inactiveLightning.active = true;
                    inactiveLightning.lifetime = inactiveLightning.maxLifetime;
                }
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