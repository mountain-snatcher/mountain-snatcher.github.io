import asyncio
import json
import os
import logging
from typing import Dict, Any
import traceback
from aiohttp import web, web_ws
from aiohttp.web_ws import WSMsgType
from euler_simulation_safe import EulerSimulation

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimulationServer:
    def __init__(self):
        self.simulation = EulerSimulation()
        self.clients = set()
        self.running = False
        self.simulation_task = None
        
    async def register_client(self, websocket):
        """Register a new client"""
        self.clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.clients)}")
        
    async def unregister_client(self, websocket):
        """Unregister a client"""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.clients)}")
        
    async def broadcast_data(self, data: Dict[Any, Any]):
        """Broadcast data to all connected clients"""
        if self.clients:
            message = json.dumps(data)
            # Create a copy of clients to avoid modification during iteration
            clients_copy = self.clients.copy()
            for client in clients_copy:
                try:
                    if not client.closed:
                        await client.send_str(message)
                except (ConnectionResetError, ConnectionAbortedError):
                    self.clients.discard(client)
                except Exception as e:
                    logger.error(f"Error broadcasting to client: {e}")
                    self.clients.discard(client)
    
    async def simulation_loop(self):
        """Main simulation loop"""
        try:
            while self.running:
                # Perform simulation step
                self.simulation.step()
                
                # Get simulation data
                density_field = self.simulation.get_density_field()
                velocity_field = self.simulation.get_velocity_field()
                pressure_field = self.simulation.get_pressure_field()
                sim_info = self.simulation.get_simulation_info()
                
                # Prepare data packet
                data = {
                    'type': 'simulation_data',
                    'density': density_field,
                    'velocity': velocity_field,
                    'pressure': pressure_field,
                    'info': sim_info
                }
                
                # Broadcast to all clients
                await self.broadcast_data(data)
                
                # Control simulation speed (15 FPS for production)
                await asyncio.sleep(1.0 / 15.0)
                
        except Exception as e:
            logger.error(f"Error in simulation loop: {e}")
            traceback.print_exc()
    
    async def handle_client_message(self, websocket, message):
        """Handle messages from clients"""
        try:
            data = json.loads(message)
            message_type = data.get('type')
            
            if message_type == 'start_simulation':
                if not self.running:
                    self.running = True
                    self.simulation_task = asyncio.create_task(self.simulation_loop())
                    await websocket.send_str(json.dumps({
                        'type': 'status',
                        'message': 'Simulation started'
                    }))
                    logger.info("Simulation started")
                    
            elif message_type == 'stop_simulation':
                if self.running:
                    self.running = False
                    if self.simulation_task:
                        self.simulation_task.cancel()
                        try:
                            await self.simulation_task
                        except asyncio.CancelledError:
                            pass
                    await websocket.send_str(json.dumps({
                        'type': 'status',
                        'message': 'Simulation stopped'
                    }))
                    logger.info("Simulation stopped")
                    
            elif message_type == 'reset_simulation':
                # Stop current simulation
                if self.running:
                    self.running = False
                    if self.simulation_task:
                        self.simulation_task.cancel()
                        try:
                            await self.simulation_task
                        except asyncio.CancelledError:
                            pass
                
                # Reset simulation
                self.simulation.reset()
                await websocket.send_str(json.dumps({
                    'type': 'status',
                    'message': 'Simulation reset'
                }))
                logger.info("Simulation reset")
                
            elif message_type == 'get_initial_data':
                # Send initial simulation data
                density_field = self.simulation.get_density_field()
                velocity_field = self.simulation.get_velocity_field()
                pressure_field = self.simulation.get_pressure_field()
                sim_info = self.simulation.get_simulation_info()
                
                initial_data = {
                    'type': 'initial_data',
                    'density': density_field,
                    'velocity': velocity_field,
                    'pressure': pressure_field,
                    'info': sim_info
                }
                await websocket.send_str(json.dumps(initial_data))
                
            elif message_type == 'mouse_interaction':
                # Handle mouse interaction
                x = data.get('x', 0.5)  # Normalized coordinates (0-1)
                y = data.get('y', 0.5)
                strength = data.get('strength', 0.1)
                
                # Add interaction to simulation
                self.simulation.add_interaction(x, y, strength)
                logger.debug(f"Mouse interaction at ({x}, {y}) with strength {strength}")
                
            else:
                await websocket.send_str(json.dumps({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}'
                }))
                
        except json.JSONDecodeError:
            await websocket.send_str(json.dumps({
                'type': 'error',
                'message': 'Invalid JSON message'
            }))
        except Exception as e:
            logger.error(f"Error handling client message: {e}")
            await websocket.send_str(json.dumps({
                'type': 'error',
                'message': str(e)
            }))

# Global server instance
server_instance = SimulationServer()

async def websocket_handler(request):
    """Handle WebSocket connections with aiohttp"""
    ws = web_ws.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    
    logger.info("WebSocket connection established")
    
    try:
        # Register client
        await server_instance.register_client(ws)
        
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                await server_instance.handle_client_message(ws, msg.data)
            elif msg.type == WSMsgType.ERROR:
                logger.error(f'WebSocket error: {ws.exception()}')
                break
            elif msg.type == WSMsgType.CLOSE:
                break
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Unregister client
        await server_instance.unregister_client(ws)
        
    return ws

async def health_check(request):
    """Health check endpoint for Render"""
    return web.Response(text="OK", status=200)

async def cors_handler(request, handler):
    """CORS middleware"""
    response = await handler(request)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

def create_app():
    """Create and configure the aiohttp application"""
    app = web.Application(middlewares=[cors_handler])
    
    # Add routes
    app.router.add_get('/ws', websocket_handler)
    app.router.add_get('/health', health_check)
    app.router.add_get('/', lambda r: web.Response(text="Taichi Euler Simulation Server", content_type="text/plain"))
    
    return app

if __name__ == "__main__":
    # Get port from environment (for Render deployment)
    port = int(os.environ.get('PORT', 8765))
    host = '0.0.0.0'  # Bind to all interfaces for production
    
    logger.info(f"Starting Taichi Euler Simulation Server on {host}:{port}...")
    
    app = create_app()
    web.run_app(app, host=host, port=port)