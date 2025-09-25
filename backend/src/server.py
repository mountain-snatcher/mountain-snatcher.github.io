import asyncio
import json
import websockets
import numpy as np
from euler_simulation import EulerSimulation
import logging
from typing import Dict, Any
import traceback

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
                    await client.send(message)
                except websockets.exceptions.ConnectionClosed:
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
                
                # Control simulation speed (30 FPS)
                await asyncio.sleep(1.0 / 30.0)
                
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
                    await websocket.send(json.dumps({
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
                    await websocket.send(json.dumps({
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
                await websocket.send(json.dumps({
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
                await websocket.send(json.dumps(initial_data))
                
            else:
                await websocket.send(json.dumps({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}'
                }))
                
        except json.JSONDecodeError:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid JSON message'
            }))
        except Exception as e:
            logger.error(f"Error handling client message: {e}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': str(e)
            }))
    
    async def handle_client(self, websocket, path):
        """Handle a client connection"""
        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self.handle_client_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"Error handling client: {e}")
        finally:
            await self.unregister_client(websocket)

# Global server instance
server_instance = SimulationServer()

async def main():
    """Main server function"""
    logger.info("Starting Taichi Euler Simulation Server...")
    
    # Start WebSocket server
    start_server = websockets.serve(
        server_instance.handle_client,
        "localhost",
        8765,
        ping_interval=20,
        ping_timeout=10,
        max_size=10**7  # 10MB max message size for large simulation data
    )
    
    logger.info("Server listening on ws://localhost:8765")
    
    await start_server
    
    # Keep the server running
    try:
        await asyncio.Future()  # Run forever
    except KeyboardInterrupt:
        logger.info("Server shutting down...")
        
        # Stop simulation if running
        if server_instance.running:
            server_instance.running = False
            if server_instance.simulation_task:
                server_instance.simulation_task.cancel()

if __name__ == "__main__":
    asyncio.run(main())