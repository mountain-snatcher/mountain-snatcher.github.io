// Interactive Taichi Euler Fluid Background with WebSocket Connection
class EulerFluidBackground {
    constructor() {
        this.canvas = document.getElementById('eulerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.websocket = null;
        this.connected = false;
        this.simulationRunning = false;
        
        // Simulation data
        this.densityField = null;
        this.velocityField = null;
        this.pressureField = null;
        this.gridSize = 256;
        
        // Interactive state
        this.mousePosition = { x: 0, y: 0 };
        this.mousePressed = false;
        this.lastMousePosition = { x: 0, y: 0 };
        
        // Rendering state
        this.visualizationMode = 'density';
        this.colorMap = this.createColorMap();
        this.frameCount = 0;
        this.lastTime = Date.now();
        this.fps = 0;
        
        // UI elements
        this.statusElement = document.getElementById('statusText');
        this.stepElement = document.getElementById('stepCounter');
        this.fpsElement = document.getElementById('fpsCounter');
        this.toggleButton = document.getElementById('toggleSimulation');
        this.connectionIndicator = document.querySelector('#connectionIndicator .fas');
        
        this.initializeCanvas();
        this.setupEventListeners();
        this.connectToBackend();
    }
    
    initializeCanvas() {
        // Set canvas to full screen
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Clear canvas with gradient background
        this.clearCanvas();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.clearCanvas();
    }
    
    clearCanvas() {
        // Create subtle gradient background
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, Math.max(this.canvas.width, this.canvas.height)
        );
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
        gradient.addColorStop(0.5, 'rgba(0, 255, 136, 0.05)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    setupEventListeners() {
        // Mouse interaction
        this.canvas.addEventListener('mousemove', (e) => {
            this.lastMousePosition = { ...this.mousePosition };
            this.mousePosition = {
                x: e.clientX / this.canvas.width,
                y: e.clientY / this.canvas.height
            };
            
            if (this.mousePressed && this.connected) {
                this.sendMouseInteraction();
            }
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            this.mousePressed = true;
            this.mousePosition = {
                x: e.clientX / this.canvas.width,
                y: e.clientY / this.canvas.height
            };
            
            if (this.connected) {
                this.sendMouseInteraction();
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.mousePressed = false;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.mousePressed = false;
        });
        
        // Touch support for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.mousePressed = true;
            this.mousePosition = {
                x: touch.clientX / this.canvas.width,
                y: touch.clientY / this.canvas.height
            };
            
            if (this.connected) {
                this.sendMouseInteraction();
            }
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.lastMousePosition = { ...this.mousePosition };
            this.mousePosition = {
                x: touch.clientX / this.canvas.width,
                y: touch.clientY / this.canvas.height
            };
            
            if (this.mousePressed && this.connected) {
                this.sendMouseInteraction();
            }
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.mousePressed = false;
        });
        
        // Control buttons
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', () => {
                if (this.simulationRunning) {
                    this.stopSimulation();
                } else {
                    this.startSimulation();
                }
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ') {
                e.preventDefault();
                if (this.simulationRunning) {
                    this.stopSimulation();
                } else {
                    this.startSimulation();
                }
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                this.resetSimulation();
            }
        });
    }
    
    connectToBackend() {
        try {
            const wsUrl = CONFIG.websocket.getWebSocketUrl();
            console.log('Connecting to Taichi backend:', wsUrl);
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('Connected to Taichi Euler backend');
                this.connected = true;
                this.updateConnectionStatus('Connected', '#00ff88');
                
                // Request initial data
                this.sendMessage({ type: 'get_initial_data' });
                
                // Auto-start simulation after connection
                setTimeout(() => {
                    if (this.connected && !this.simulationRunning) {
                        this.startSimulation();
                    }
                }, 1000);
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            };
            
            this.websocket.onclose = () => {
                console.log('Disconnected from Taichi backend');
                this.connected = false;
                this.simulationRunning = false;
                this.updateConnectionStatus('Disconnected', '#ff6b35');
                this.updateToggleButton();
                
                // Try to reconnect after 3 seconds
                setTimeout(() => {
                    if (!this.connected) {
                        this.connectToBackend();
                    }
                }, 3000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('Connection Error', '#ff6b35');
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.updateConnectionStatus('Failed to Connect', '#ff6b35');
        }
    }
    
    handleServerMessage(data) {
        switch (data.type) {
            case 'simulation_data':
            case 'initial_data':
                this.densityField = data.density;
                this.velocityField = data.velocity;
                this.pressureField = data.pressure;
                this.gridSize = data.info.grid_size;
                
                // Update UI
                if (this.stepElement) this.stepElement.textContent = data.info.step;
                
                // Update FPS
                this.frameCount++;
                const currentTime = Date.now();
                if (currentTime - this.lastTime >= 1000) {
                    this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastTime));
                    if (this.fpsElement) this.fpsElement.textContent = this.fps;
                    this.frameCount = 0;
                    this.lastTime = currentTime;
                }
                
                this.renderFluidField();
                break;
                
            case 'status':
                console.log('Server status:', data.message);
                if (data.message.includes('started')) {
                    this.simulationRunning = true;
                } else if (data.message.includes('stopped') || data.message.includes('reset')) {
                    this.simulationRunning = false;
                }
                this.updateToggleButton();
                break;
                
            case 'error':
                console.error('Server error:', data.message);
                this.updateConnectionStatus('Server Error', '#ff6b35');
                break;
        }
    }
    
    renderFluidField() {
        if (!this.densityField) return;
        
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // Create image data for fluid visualization
        const imageData = this.ctx.createImageData(canvasWidth, canvasHeight);
        
        // Get the field to visualize
        let field = this.getVisualizationField();
        let minVal = Math.min(...field.flat());
        let maxVal = Math.max(...field.flat());
        
        // Avoid division by zero
        if (maxVal - minVal < 1e-10) {
            maxVal = minVal + 1e-10;
        }
        
        // Render field to canvas
        for (let y = 0; y < canvasHeight; y++) {
            for (let x = 0; x < canvasWidth; x++) {
                // Map canvas coordinates to simulation grid
                const gridX = Math.floor(x * this.gridSize / canvasWidth);
                const gridY = Math.floor(y * this.gridSize / canvasHeight);
                
                // Ensure we don't go out of bounds
                const safeX = Math.min(gridX, this.gridSize - 1);
                const safeY = Math.min(gridY, this.gridSize - 1);
                
                const value = field[safeY][safeX];
                const normalizedValue = (value - minVal) / (maxVal - minVal);
                const colorIndex = Math.floor(normalizedValue * 255);
                const color = this.colorMap[Math.min(colorIndex, 255)];
                
                const pixelIndex = (y * canvasWidth + x) * 4;
                imageData.data[pixelIndex] = color[0];     // Red
                imageData.data[pixelIndex + 1] = color[1]; // Green
                imageData.data[pixelIndex + 2] = color[2]; // Blue
                imageData.data[pixelIndex + 3] = Math.floor(255 * 0.6); // Alpha (60% opacity)
            }
        }
        
        // Clear and draw
        this.clearCanvas();
        this.ctx.putImageData(imageData, 0, 0);
        
        // Add mouse interaction visualization
        if (this.mousePressed) {
            this.drawMouseEffect();
        }
    }
    
    getVisualizationField() {
        switch (this.visualizationMode) {
            case 'density':
                return this.densityField;
            case 'pressure':
                return this.pressureField;
            case 'velocity':
                if (this.velocityField) {
                    // Calculate velocity magnitude
                    const velMag = [];
                    for (let i = 0; i < this.gridSize; i++) {
                        velMag[i] = [];
                        for (let j = 0; j < this.gridSize; j++) {
                            const u = this.velocityField.u[i][j];
                            const v = this.velocityField.v[i][j];
                            velMag[i][j] = Math.sqrt(u * u + v * v);
                        }
                    }
                    return velMag;
                }
                return this.densityField;
            default:
                return this.densityField;
        }
    }
    
    drawMouseEffect() {
        const x = this.mousePosition.x * this.canvas.width;
        const y = this.mousePosition.y * this.canvas.height;
        
        // Draw interaction point
        this.ctx.beginPath();
        this.ctx.arc(x, y, 20, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw ripple effect
        const time = Date.now() * 0.01;
        for (let i = 1; i <= 3; i++) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, 20 + i * 15 + Math.sin(time + i) * 5, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(139, 92, 246, ${0.3 / i})`;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }
    }
    
    createColorMap() {
        // Create a scientific colormap for fluid visualization
        const colors = [
            [0, 0, 64],      // Dark blue
            [0, 0, 255],     // Blue
            [0, 255, 255],   // Cyan
            [0, 255, 0],     // Green
            [255, 255, 0],   // Yellow
            [255, 128, 0],   // Orange
            [255, 0, 0]      // Red
        ];
        
        const colorMap = [];
        const numColors = 256;
        
        for (let i = 0; i < numColors; i++) {
            const t = i / (numColors - 1);
            const scaledT = t * (colors.length - 1);
            const colorIndex = Math.floor(scaledT);
            const localT = scaledT - colorIndex;
            
            if (colorIndex >= colors.length - 1) {
                colorMap.push(colors[colors.length - 1]);
            } else {
                const color1 = colors[colorIndex];
                const color2 = colors[colorIndex + 1];
                const r = Math.round(color1[0] + (color2[0] - color1[0]) * localT);
                const g = Math.round(color1[1] + (color2[1] - color1[1]) * localT);
                const b = Math.round(color1[2] + (color2[2] - color1[2]) * localT);
                colorMap.push([r, g, b]);
            }
        }
        
        return colorMap;
    }
    
    sendMessage(message) {
        if (this.websocket && this.connected) {
            this.websocket.send(JSON.stringify(message));
        }
    }
    
    sendMouseInteraction() {
        // Convert mouse position to simulation coordinates
        const simX = this.mousePosition.x;
        const simY = this.mousePosition.y;
        
        // Calculate velocity from mouse movement
        const velX = (this.mousePosition.x - this.lastMousePosition.x) * 100;
        const velY = (this.mousePosition.y - this.lastMousePosition.y) * 100;
        
        this.sendMessage({
            type: 'mouse_interaction',
            x: simX,
            y: simY,
            velX: velX,
            velY: velY,
            pressed: this.mousePressed
        });
    }
    
    startSimulation() {
        this.sendMessage({ type: 'start_simulation' });
    }
    
    stopSimulation() {
        this.sendMessage({ type: 'stop_simulation' });
    }
    
    resetSimulation() {
        this.sendMessage({ type: 'reset_simulation' });
    }
    
    updateConnectionStatus(status, color) {
        if (this.statusElement) {
            this.statusElement.textContent = status;
        }
        if (this.connectionIndicator) {
            this.connectionIndicator.style.color = color;
        }
    }
    
    updateToggleButton() {
        if (this.toggleButton) {
            this.toggleButton.textContent = this.simulationRunning ? 'Stop Simulation' : 'Start Simulation';
            this.toggleButton.disabled = !this.connected;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for CONFIG to be available
    setTimeout(() => {
        if (typeof CONFIG !== 'undefined') {
            window.eulerBackground = new EulerFluidBackground();
        } else {
            console.error('CONFIG not loaded, cannot initialize Euler background');
        }
    }, 100);
});