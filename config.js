// Configuration for Taichi Euler Simulation
const CONFIG = {
    // WebSocket configuration - Production only
    websocket: {
        // Render app URL
        productionHost: 'github-page-sankalp.onrender.com',
        
        getWebSocketUrl() {
            // Always use WSS for production (GitHub Pages uses HTTPS)
            return `wss://${this.productionHost}/ws`;
        }
    },
    
    // Simulation settings
    simulation: {
        targetFPS: 15,
        maxReconnectAttempts: 5,
        reconnectDelay: 2000
    }
};