import numpy as np
import json
import time

class SimpleFluidSimulation:
    def __init__(self):
        self.N = 64  # Smaller grid for simplicity
        self.dt = 0.01
        self.time = 0.0
        
        # Create simple fluid field
        self.density = np.ones((self.N, self.N), dtype=np.float32)
        self.velocity_x = np.zeros((self.N, self.N), dtype=np.float32)
        self.velocity_y = np.zeros((self.N, self.N), dtype=np.float32)
        self.pressure = np.ones((self.N, self.N), dtype=np.float32)
        
        # Initialize with some disturbance
        self._initialize_fluid()
        
    def _initialize_fluid(self):
        """Initialize with a simple fluid disturbance"""
        cx, cy = self.N // 2, self.N // 2
        for i in range(self.N):
            for j in range(self.N):
                r = np.sqrt((i - cx)**2 + (j - cy)**2)
                if r < 10:
                    self.density[i, j] = 2.0
                    self.pressure[i, j] = 1.5
    
    def add_interaction(self, x, y, strength=0.1):
        """Add mouse/touch interaction"""
        if 0 <= x < self.N and 0 <= y < self.N:
            # Add velocity disturbance
            for di in range(-3, 4):
                for dj in range(-3, 4):
                    ni, nj = int(x + di), int(y + dj)
                    if 0 <= ni < self.N and 0 <= nj < self.N:
                        r = np.sqrt(di*di + dj*dj)
                        if r < 3:
                            factor = (3 - r) / 3 * strength
                            self.velocity_x[ni, nj] += di * factor
                            self.velocity_y[ni, nj] += dj * factor
    
    def step(self):
        """Simple fluid simulation step"""
        # Simple advection
        self._advect()
        
        # Simple diffusion
        self._diffuse()
        
        # Update time
        self.time += self.dt
        
    def _advect(self):
        """Simple advection step"""
        new_density = self.density.copy()
        
        for i in range(1, self.N-1):
            for j in range(1, self.N-1):
                # Simple backwards advection
                vx = self.velocity_x[i, j] * self.dt
                vy = self.velocity_y[i, j] * self.dt
                
                # Clamp to grid bounds
                prev_x = max(0, min(self.N-1, i - vx))
                prev_y = max(0, min(self.N-1, j - vy))
                
                # Simple interpolation
                ix, iy = int(prev_x), int(prev_y)
                fx, fy = prev_x - ix, prev_y - iy
                
                if ix < self.N-1 and iy < self.N-1:
                    new_density[i, j] = (
                        (1-fx) * (1-fy) * self.density[ix, iy] +
                        fx * (1-fy) * self.density[ix+1, iy] +
                        (1-fx) * fy * self.density[ix, iy+1] +
                        fx * fy * self.density[ix+1, iy+1]
                    )
        
        self.density = new_density
    
    def _diffuse(self):
        """Simple diffusion step"""
        diffusion = 0.01
        
        new_vx = self.velocity_x.copy()
        new_vy = self.velocity_y.copy()
        
        for i in range(1, self.N-1):
            for j in range(1, self.N-1):
                # Diffuse velocity
                new_vx[i, j] = (
                    self.velocity_x[i, j] +
                    diffusion * (
                        self.velocity_x[i-1, j] + self.velocity_x[i+1, j] +
                        self.velocity_x[i, j-1] + self.velocity_x[i, j+1] -
                        4 * self.velocity_x[i, j]
                    )
                )
                
                new_vy[i, j] = (
                    self.velocity_y[i, j] +
                    diffusion * (
                        self.velocity_y[i-1, j] + self.velocity_y[i+1, j] +
                        self.velocity_y[i, j-1] + self.velocity_y[i, j+1] -
                        4 * self.velocity_y[i, j]
                    )
                )
        
        # Damping
        new_vx *= 0.99
        new_vy *= 0.99
        
        self.velocity_x = new_vx
        self.velocity_y = new_vy
    
    def get_visualization_data(self, mode="density"):
        """Get data for visualization"""
        if mode == "density":
            data = self.density
        elif mode == "velocity":
            data = np.sqrt(self.velocity_x**2 + self.velocity_y**2)
        elif mode == "pressure":
            data = self.pressure
        else:
            data = self.density
            
        # Normalize to 0-1 range
        data_min, data_max = data.min(), data.max()
        if data_max > data_min:
            data = (data - data_min) / (data_max - data_min)
        
        return {
            'data': data.tolist(),
            'width': self.N,
            'height': self.N,
            'time': self.time,
            'mode': mode
        }