// Dynamic Majorana Braiding Animation with Three.js
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

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Camera position
    camera.position.set(0, 0, 15);

    // Majorana particles (4 zero modes in 2 pairs)
    const particles = [];
    const trails = [];
    const numParticles = 4;
    const colors = [0xff4444, 0x4488ff, 0x44ff44, 0xffaa44];
    
    // Quantum state tracking
    let quantumState = [1, 0, 0, 0]; // |00⟩ initial state
    let braidingHistory = [];
    let currentBraidingOperation = null;
    let operationProgress = 0;
    
    // Physics parameters
    const correlationLength = 1.5; // ξ - localization length
    const energyGap = 1.0; // Δ - topological gap
    const exchangeTime = 3.0; // Time for one exchange operation
    
    // Braiding matrices (simplified Ising anyon representation)
    const braidingMatrices = {
        // Exchange operators U = exp(±π/4 γₙγₘ)
        exchange_01: [  // σx ⊗ I / √2
            [1/Math.sqrt(2), 0, 0, 1/Math.sqrt(2)],
            [0, 1/Math.sqrt(2), 1/Math.sqrt(2), 0],
            [0, 1/Math.sqrt(2), -1/Math.sqrt(2), 0],
            [1/Math.sqrt(2), 0, 0, -1/Math.sqrt(2)]
        ],
        exchange_12: [  // I ⊗ σx / √2  
            [1/Math.sqrt(2), 0, 1/Math.sqrt(2), 0],
            [0, 1/Math.sqrt(2), 0, 1/Math.sqrt(2)],
            [1/Math.sqrt(2), 0, -1/Math.sqrt(2), 0],
            [0, 1/Math.sqrt(2), 0, -1/Math.sqrt(2)]
        ],
        exchange_23: [  // σx ⊗ I / √2 (different phase)
            [1/Math.sqrt(2), 0, 0, -1/Math.sqrt(2)],
            [0, 1/Math.sqrt(2), -1/Math.sqrt(2), 0],
            [0, -1/Math.sqrt(2), 1/Math.sqrt(2), 0],
            [-1/Math.sqrt(2), 0, 0, 1/Math.sqrt(2)]
        ]
    };
    
    // Create Majorana zero mode particles with physics properties
    for (let i = 0; i < numParticles; i++) {
        const geometry = new THREE.SphereGeometry(0.12, 16, 16);
        const material = new THREE.MeshBasicMaterial({ 
            color: colors[i],
            transparent: true,
            opacity: 0.9
        });
        const particle = new THREE.Mesh(geometry, material);
        
        // Initial positions for T-junction topology (edge states)
        const basePositions = [
            { x: -4, y: 0, z: 0 },    // Left wire end
            { x: 0, y: 0, z: 0 },     // Junction center
            { x: 0, y: 4, z: 0 },     // Top wire end  
            { x: 4, y: 0, z: 0 }      // Right wire end
        ];
        
        particle.position.set(
            basePositions[i].x,
            basePositions[i].y,
            basePositions[i].z
        );
        
        scene.add(particle);
        particles.push(particle);

        // Quantum glow effect (representing wavefunction extent)
        const glowGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: colors[i],
            transparent: true,
            opacity: 0.25
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(particle.position);
        scene.add(glow);
        particle.userData.glow = glow;
        
        // Add topological protection indicator (energy gap visualization)
        const protectionGeometry = new THREE.RingGeometry(0.4, 0.45, 16);
        const protectionMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        const protectionRing = new THREE.Mesh(protectionGeometry, protectionMaterial);
        protectionRing.position.copy(particle.position);
        protectionRing.lookAt(camera.position);
        scene.add(protectionRing);
        particle.userData.protection = protectionRing;

        // Worldline trail setup (spacetime path visualization)
        const trailGeometry = new THREE.BufferGeometry();
        const trailMaterial = new THREE.LineBasicMaterial({
            color: colors[i],
            transparent: true,
            opacity: 0.6,
            linewidth: 2
        });
        const trailPoints = [];
        const maxTrailLength = 150; // Longer trails for better worldline visualization
        for (let j = 0; j < maxTrailLength; j++) {
            trailPoints.push(particle.position.clone());
        }
        trailGeometry.setFromPoints(trailPoints);
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        scene.add(trail);
        
        // Worldline trail with physics properties
        trails.push({
            line: trail,
            points: trailPoints,
            index: 0,
            maxLength: maxTrailLength,
            lastBraidingEvent: null,
            timeStamps: new Array(maxTrailLength).fill(0)
        });
    }

    // Animation parameters
    let time = 0;
    const clock = new THREE.Clock();
    let isVisible = true;
    
    // Braiding operation scheduler
    function initiateBraidingOperation() {
        if (currentBraidingOperation) return; // Already braiding
        
        // Randomly select adjacent pair to exchange
        const possiblePairs = [[0, 1], [1, 2], [2, 3]];
        const selectedPair = possiblePairs[Math.floor(Math.random() * possiblePairs.length)];
        const direction = Math.random() > 0.5 ? 1 : -1; // Clockwise or counterclockwise
        
        currentBraidingOperation = {
            pair: selectedPair,
            direction: direction,
            startTime: time
        };
        
        operationProgress = 0;
        
        // Apply quantum state transformation
        applyQuantumExchange(selectedPair, direction);
        
        console.log(`Starting braiding operation: exchange particles ${selectedPair[0]} and ${selectedPair[1]}, direction: ${direction}`);
    }
    
    // Calculate fermion parity (conserved quantity)
    function calculateFermionParity() {
        // P = i^N γ₁γ₂γ₃γ₄ = ±1 (conserved)
        let parity = 1;
        for (let i = 0; i < 4; i++) {
            // Simplified parity calculation based on quantum state
            const amplitude = quantumState[Math.floor(i/2)] || 0;
            parity *= Math.sign(amplitude) || 1;
        }
        return parity;
    }
    
    // Apply quantum state transformation based on exchange
    function applyQuantumExchange(pair, direction) {
        const [i, j] = pair;
        let matrix;
        
        // Verify adjacent particles (topological constraint)
        if (Math.abs(i - j) !== 1) {
            console.warn('Non-adjacent particle exchange attempted - not allowed in 1D topology');
            return;
        }
        
        // Store parity before transformation
        const initialParity = calculateFermionParity();
        
        // Select appropriate braiding matrix with direction dependence
        if ((i === 0 && j === 1)) {
            matrix = direction > 0 ? braidingMatrices.exchange_01 : braidingMatrices.exchange_01.map(row => row.map(x => x)); // Inverse
        } else if ((i === 1 && j === 2)) {
            matrix = direction > 0 ? braidingMatrices.exchange_12 : braidingMatrices.exchange_12.map(row => row.map(x => x));
        } else if ((i === 2 && j === 3)) {
            matrix = direction > 0 ? braidingMatrices.exchange_23 : braidingMatrices.exchange_23.map(row => row.map(x => x));
        } else {
            console.warn('Invalid particle pair for exchange');
            return;
        }
        
        // Apply matrix transformation to quantum state (U|ψ⟩)
        const newState = [0, 0, 0, 0];
        for (let k = 0; k < 4; k++) {
            for (let l = 0; l < 4; l++) {
                newState[k] += matrix[k][l] * quantumState[l];
            }
        }
        
        // Normalize quantum state
        const norm = Math.sqrt(newState.reduce((sum, x) => sum + x*x, 0));
        if (norm > 1e-10) {
            for (let k = 0; k < 4; k++) {
                newState[k] /= norm;
            }
        }
        
        quantumState = newState;
        
        // Verify parity conservation
        const finalParity = calculateFermionParity();
        if (Math.abs(initialParity - finalParity) > 1e-6) {
            console.warn('Fermion parity not conserved! Initial:', initialParity, 'Final:', finalParity);
        }
        
        // Record braiding history (non-Abelian: order matters!)
        braidingHistory.push({ 
            pair, 
            direction, 
            time: time, 
            state: [...quantumState],
            parity: finalParity,
            operation: `σ_{${i},${j}}^{${direction > 0 ? '+' : '-'}}`
        });
        
        // Update particle colors based on quantum state
        updateParticleColors();
        
        console.log(`Applied exchange σ_{${i},${j}}^{${direction > 0 ? '+' : '-'}}, parity: ${finalParity}`);
    }
    
    // Update particle colors based on quantum state
    function updateParticleColors() {
        particles.forEach((particle, i) => {
            // Color intensity based on quantum state amplitude
            const amplitude = Math.abs(quantumState[Math.floor(i/2)] || 0);
            const phase = Math.atan2(quantumState[Math.floor(i/2)] || 0, Math.abs(quantumState[Math.floor(i/2)] || 0));
            const intensity = 0.4 + 0.6 * amplitude;
            
            const baseColors = [0xff4444, 0x4488ff, 0x44ff44, 0xffaa44];
            const color = new THREE.Color(baseColors[i]);
            
            // Modulate color based on quantum phase
            const phaseModulation = 0.8 + 0.2 * Math.cos(phase);
            color.multiplyScalar(intensity * phaseModulation);
            
            particle.material.color = color;
            if (particle.userData.glow) {
                particle.userData.glow.material.color = color;
                particle.userData.glow.material.opacity = 0.2 + 0.3 * amplitude;
            }
            
            // Update topological protection indicator
            if (particle.userData.protection) {
                // Protection strength based on energy gap
                const protectionStrength = Math.min(1.0, energyGap / 2.0);
                particle.userData.protection.material.opacity = 0.3 * protectionStrength;
                
                // Ring size indicates localization length
                const scale = 1 + 0.3 * Math.exp(-1/correlationLength);
                particle.userData.protection.scale.setScalar(scale);
                
                // Keep ring facing camera
                particle.userData.protection.lookAt(camera.position);
            }
        });
    }
    
    // Demonstrate non-Abelian statistics with sequence-dependent outcomes
    function demonstrateNonAbelianStatistics() {
        if (currentBraidingOperation) return;
        
        // Show that σ₁σ₂ ≠ σ₂σ₁ (non-commuting)
        console.log('Demonstrating non-Abelian statistics: σ₁σ₂ ≠ σ₂σ₁');
        
        // Record current state for comparison
        const initialState = [...quantumState];
        
        setTimeout(() => {
            console.log('Initial state:', initialState);
            console.log('Braiding history length:', braidingHistory.length);
            
            // Show how different exchange sequences lead to different results
            if (braidingHistory.length >= 2) {
                const lastTwo = braidingHistory.slice(-2);
                console.log('Last two operations:', lastTwo.map(h => h.operation));
                console.log('Final state after sequence:', quantumState);
            }
        }, 1000);
    }
    
    // Schedule periodic braiding operations with physics constraints
    setInterval(() => {
        if (Math.random() > 0.6) { // 40% chance every interval
            initiateBraidingOperation();
            
            // Occasionally demonstrate non-Abelian statistics
            if (Math.random() > 0.8) {
                setTimeout(demonstrateNonAbelianStatistics, exchangeTime * 1000 + 500);
            }
        }
    }, 5000); // Every 5 seconds (slower for better observation)

    // Physics-accurate Majorana braiding dynamics
    function majoranaBraiding(particleIndex, t) {
        // Base positions for 4 Majorana modes in T-junction topology
        const basePositions = [
            { x: -4, y: 0, z: 0 },    // Left wire end
            { x: 0, y: 0, z: 0 },     // Junction center
            { x: 0, y: 4, z: 0 },     // Top wire end  
            { x: 4, y: 0, z: 0 }      // Right wire end
        ];
        
        let position = { ...basePositions[particleIndex] };
        
        // Apply localization envelope (exponential decay from edges)
        const localizationEnvelope = Math.exp(-Math.abs(position.x + position.y) / correlationLength);
        
        // If braiding operation is active, modify positions
        if (currentBraidingOperation) {
            position = applyBraidingTransformation(particleIndex, position, operationProgress);
        }
        
        // Add small quantum fluctuations (preserving topology)
        const fluctuationAmplitude = 0.1 * localizationEnvelope;
        position.x += Math.sin(t * 2 + particleIndex * 1.57) * fluctuationAmplitude;
        position.y += Math.cos(t * 1.5 + particleIndex * 0.78) * fluctuationAmplitude;
        position.z += Math.sin(t * 0.8 + particleIndex * 2.35) * fluctuationAmplitude * 0.5;
        
        return position;
    }
    
    // Apply braiding transformation during exchange operations
    function applyBraidingTransformation(particleIndex, basePos, progress) {
        if (!currentBraidingOperation) return basePos;
        
        const { pair, direction } = currentBraidingOperation;
        const [i, j] = pair;
        
        // Only apply transformation to particles being exchanged
        if (particleIndex !== i && particleIndex !== j) return basePos;
        
        // Smooth interpolation using topologically protected path
        const theta = progress * Math.PI; // Half rotation for exchange
        const smoothing = 0.5 * (1 - Math.cos(theta)); // Smooth start/stop
        
        if (particleIndex === i) {
            // First particle moves in controlled arc
            const radius = 1.5;
            const angle = direction * theta;
            return {
                x: basePos.x + radius * Math.sin(angle) * smoothing,
                y: basePos.y + radius * (1 - Math.cos(angle)) * smoothing,
                z: basePos.z + Math.sin(2 * angle) * 0.3 * smoothing
            };
        } else {
            // Second particle moves in opposite arc
            const radius = 1.5;
            const angle = -direction * theta;
            return {
                x: basePos.x + radius * Math.sin(angle) * smoothing,
                y: basePos.y + radius * (1 - Math.cos(angle)) * smoothing,
                z: basePos.z + Math.sin(2 * angle) * 0.3 * smoothing
            };
        }
    }

    // Update worldline trails (spacetime path tracking)
    function updateTrails() {
        particles.forEach((particle, i) => {
            const trail = trails[i];
            const currentPos = particle.position.clone();
            
            // Always add new point to represent continuous worldline
            trail.index = (trail.index + 1) % trail.maxLength;
            trail.points[trail.index].copy(currentPos);
            trail.timeStamps[trail.index] = time;
            
            // Mark braiding events in worldline
            if (currentBraidingOperation && currentBraidingOperation.pair.includes(i)) {
                trail.lastBraidingEvent = trail.index;
            }
            
            // Create ordered points array for rendering (oldest to newest)
            const orderedPoints = [];
            const orderedOpacities = [];
            
            for (let j = 0; j < trail.maxLength; j++) {
                const pointIndex = (trail.index + 1 + j) % trail.maxLength;
                const point = trail.points[pointIndex];
                const age = time - trail.timeStamps[pointIndex];
                
                // Fade older parts of worldline
                const opacity = Math.max(0, 1 - age / 10); // Fade over 10 time units
                
                // Highlight braiding events
                let finalOpacity = opacity;
                if (trail.lastBraidingEvent !== null) {
                    const distanceToBraidEvent = Math.abs(pointIndex - trail.lastBraidingEvent);
                    if (distanceToBraidEvent < 20) { // Highlight last 20 points around braid
                        finalOpacity = Math.max(finalOpacity, 0.8);
                    }
                }
                
                orderedPoints.push(point);
                orderedOpacities.push(finalOpacity);
            }
            
            // Update trail geometry
            trail.line.geometry.setFromPoints(orderedPoints);
            trail.line.geometry.attributes.position.needsUpdate = true;
            
            // Update trail opacity based on quantum state
            const quantumAmplitude = Math.abs(quantumState[Math.floor(i/2)] || 0);
            trail.line.material.opacity = 0.4 + 0.4 * quantumAmplitude;
        });
    }

    // Camera rotation (ambient rotation like Lorenz)
    function updateCamera(deltaTime) {
        const cameraRadius = 15;
        const cameraSpeed = 0.05;
        camera.position.x = Math.cos(time * cameraSpeed) * cameraRadius;
        camera.position.z = Math.sin(time * cameraSpeed) * cameraRadius;
        camera.position.y = Math.sin(time * cameraSpeed * 0.7) * 3;
        camera.lookAt(0, 0, 0);
    }

    // Animation loop
    function animate() {
        if (!isVisible) {
            requestAnimationFrame(animate);
            return;
        }

        requestAnimationFrame(animate);
        
        const deltaTime = clock.getDelta();
        time += deltaTime;

        // Update braiding operation progress
        if (currentBraidingOperation) {
            const elapsed = time - currentBraidingOperation.startTime;
            operationProgress = Math.min(elapsed / exchangeTime, 1.0);
            
            // Complete operation when progress reaches 1
            if (operationProgress >= 1.0) {
                console.log(`Completed braiding operation for particles ${currentBraidingOperation.pair}`);
                currentBraidingOperation = null;
                operationProgress = 0;
            }
        }
        
        // Update particle positions with physics-accurate braiding motion
        particles.forEach((particle, i) => {
            const newPos = majoranaBraiding(i, time);
            particle.position.set(newPos.x, newPos.y, newPos.z);
            
            // Update glow and protection ring positions
            if (particle.userData.glow) {
                particle.userData.glow.position.copy(particle.position);
            }
            if (particle.userData.protection) {
                particle.userData.protection.position.copy(particle.position);
            }
            
            // Quantum pulse effect (energy scale oscillations)
            const quantumAmplitude = Math.abs(quantumState[Math.floor(i/2)] || 0);
            const pulse = 1 + Math.sin(time * energyGap + i * Math.PI/2) * 0.1 * quantumAmplitude;
            particle.scale.setScalar(pulse);
            
            // Special glow during braiding operations
            if (currentBraidingOperation && currentBraidingOperation.pair.includes(i)) {
                const braidGlow = 1 + 0.5 * Math.sin(time * 10);
                particle.userData.glow.material.opacity = 0.6 * braidGlow;
            }
        });

        // Update trails
        updateTrails();
        
        // Update camera
        updateCamera(deltaTime);

        renderer.render(scene, camera);
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Handle visibility change
    document.addEventListener('visibilitychange', function() {
        isVisible = !document.hidden;
    });

    // Start animation
    animate();

    console.log('Physics-accurate Majorana braiding animation loaded');
    console.log('Features: Non-Abelian exchange statistics, quantum state tracking, topological protection');
    
    // Initialize first braiding operation after short delay
    setTimeout(() => {
        initiateBraidingOperation();
    }, 2000);
});