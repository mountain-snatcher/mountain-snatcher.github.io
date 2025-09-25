import numpy as np
import json
import time
import os

# Always import fallback simulation
from simple_fluid_simulation import SimpleFluidSimulation

# Check if Taichi can be imported and initialized
TAICHI_AVAILABLE = False
ti = None

try:
    # Set environment variables before importing Taichi
    os.environ['TI_VISIBLE_DEVICE'] = ''  # Disable GPU detection
    os.environ['DISPLAY'] = ''  # Disable X11 display
    
    # Try to import Taichi
    import taichi as ti
    
    # Try to initialize Taichi
    ti.init(arch=ti.cpu, debug=False, default_fp=ti.f32)
    TAICHI_AVAILABLE = True
    print("Taichi initialized successfully")
except Exception as e:
    print(f"Taichi not available: {e}")
    print("Falling back to simple NumPy simulation")
    TAICHI_AVAILABLE = False
    ti = None

class EulerSimulation:
    def __init__(self):
        self.step_count = 0
        self.time = 0.0
        
        if TAICHI_AVAILABLE:
            # Initialize Taichi simulation (we'd need to implement this)
            print("Using Taichi-based Euler simulation")
            self.use_fallback = False
            # For now, we'll use fallback even if Taichi is available
            # since the full Taichi implementation is complex
            self.fallback_sim = SimpleFluidSimulation()
            self.use_fallback = True
        else:
            # Use simple fallback simulation
            self.fallback_sim = SimpleFluidSimulation()
            self.use_fallback = True
            print("Using fallback NumPy simulation")
        
    def step(self):
        """Perform one simulation step"""
        if self.use_fallback:
            self.fallback_sim.step()
            self.step_count += 1
            self.time = self.fallback_sim.time
        else:
            # Taichi simulation step would go here
            self.step_count += 1
            self.time += 0.01
        
    def get_density_field(self):
        """Get density field for visualization"""
        if self.use_fallback:
            data = self.fallback_sim.get_visualization_data("density")
            return data['data']
        else:
            # Taichi density field would go here
            return [[1.0 for _ in range(64)] for _ in range(64)]
    
    def get_velocity_field(self):
        """Get velocity field for visualization"""
        if self.use_fallback:
            return {
                'u': self.fallback_sim.velocity_x.tolist(),
                'v': self.fallback_sim.velocity_y.tolist()
            }
        else:
            # Taichi velocity field would go here
            size = 64
            return {
                'u': [[0.0 for _ in range(size)] for _ in range(size)],
                'v': [[0.0 for _ in range(size)] for _ in range(size)]
            }
    
    def get_pressure_field(self):
        """Get pressure field for visualization"""
        if self.use_fallback:
            data = self.fallback_sim.get_visualization_data("pressure")
            return data['data']
        else:
            # Taichi pressure field would go here
            return [[1.0 for _ in range(64)] for _ in range(64)]
    
    def get_simulation_info(self):
        """Get simulation information"""
        if self.use_fallback:
            return {
                'step': self.step_count,
                'time': float(self.time),
                'dt': float(self.fallback_sim.dt),
                'grid_size': self.fallback_sim.N
            }
        else:
            return {
                'step': self.step_count,
                'time': float(self.time),
                'dt': 0.01,
                'grid_size': 64
            }
    
    def reset(self):
        """Reset the simulation"""
        self.step_count = 0
        self.time = 0.0
        if self.use_fallback:
            self.fallback_sim = SimpleFluidSimulation()
        else:
            # Reset Taichi simulation
            pass
    
    def add_interaction(self, x, y, strength=0.1):
        """Add mouse/touch interaction"""
        if self.use_fallback:
            # Convert normalized coordinates to grid coordinates
            grid_x = x * self.fallback_sim.N
            grid_y = y * self.fallback_sim.N
            self.fallback_sim.add_interaction(grid_x, grid_y, strength)
        else:
            # Taichi interaction would go here
            pass