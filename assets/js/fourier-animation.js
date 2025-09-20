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

    // Majorana particles
    const particles = [];
    const trails = [];
    const numParticles = 4;
    const colors = [0xff4444, 0x4488ff, 0x44ff44, 0xffaa44];
    
    // Create particles with glow effect
    for (let i = 0; i < numParticles; i++) {
        const geometry = new THREE.SphereGeometry(0.15, 16, 16);
        const material = new THREE.MeshBasicMaterial({ 
            color: colors[i],
            transparent: true,
            opacity: 1.0
        });
        const particle = new THREE.Mesh(geometry, material);
        
        // Initial positions in square formation
        const angle = (i / numParticles) * Math.PI * 2;
        const radius = 4;
        particle.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0
        );
        
        scene.add(particle);
        particles.push(particle);

        // Glow effect
        const glowGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: colors[i],
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(particle.position);
        scene.add(glow);
        particle.userData.glow = glow;

        // Trail setup
        const trailGeometry = new THREE.BufferGeometry();
        const trailMaterial = new THREE.LineBasicMaterial({
            color: colors[i],
            transparent: true,
            opacity: 0.8,
            linewidth: 3
        });
        const trailPoints = [];
        for (let j = 0; j < 100; j++) {
            trailPoints.push(particle.position.clone());
        }
        trailGeometry.setFromPoints(trailPoints);
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        scene.add(trail);
        trails.push({
            line: trail,
            points: trailPoints,
            index: 0
        });
    }

    // Animation parameters
    let time = 0;
    const clock = new THREE.Clock();
    let isVisible = true;

    // Majorana braiding equations (inspired by quantum topology)
    function majoranaBraiding(particleIndex, t) {
        const baseAngle = (particleIndex / numParticles) * Math.PI * 2;
        const braidFreq = 0.3 + particleIndex * 0.1;
        const radius = 3 + Math.sin(t * 0.5) * 0.5;
        
        // Complex braiding pattern
        const x = Math.cos(baseAngle + t * braidFreq) * radius + 
                  Math.sin(t * 0.7 + particleIndex) * 0.8;
        const y = Math.sin(baseAngle + t * braidFreq) * radius + 
                  Math.cos(t * 0.5 + particleIndex * 1.5) * 0.6;
        const z = Math.sin(t * 0.4 + particleIndex * 0.8) * 1.2;
        
        return { x, y, z };
    }

    // Update trails (similar to Lorenz attractor approach)
    function updateTrails() {
        particles.forEach((particle, i) => {
            const trail = trails[i];
            const currentPos = particle.position.clone();
            
            // Add new point to trail if moved significantly
            if (trail.points[trail.index].distanceTo(currentPos) > 0.05) {
                trail.index = (trail.index + 1) % trail.points.length;
                trail.points[trail.index].copy(currentPos);
                
                // Update trail geometry
                trail.line.geometry.setFromPoints(trail.points);
                trail.line.geometry.attributes.position.needsUpdate = true;
            }
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

        // Update particle positions with braiding motion
        particles.forEach((particle, i) => {
            const newPos = majoranaBraiding(i, time);
            particle.position.set(newPos.x, newPos.y, newPos.z);
            
            // Update glow position
            if (particle.userData.glow) {
                particle.userData.glow.position.copy(particle.position);
            }
            
            // Pulse effect
            const pulse = 1 + Math.sin(time * 3 + i) * 0.1;
            particle.scale.setScalar(pulse);
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

    console.log('Dynamic Majorana braiding animation loaded');
});