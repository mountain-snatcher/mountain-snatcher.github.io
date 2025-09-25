import numpy as np
import json
import time
import os

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
    ti = None

# Always import fallback simulation
from simple_fluid_simulation import SimpleFluidSimulation

# Simulation parameters
N = 256  # Grid resolution
CFL = 0.3
gamma = 1.4  # Adiabatic index
t_end = 0.8
BCs = ["transmissive", "reflective"][1]

# Grid and time step
dx = 1.0 / N
dt = CFL * dx / 2.0
nt = int(t_end / dt) + 1

# Field definitions
rho = ti.field(ti.f32, shape=(N + 6, N + 6))  # Density
u = ti.field(ti.f32, shape=(N + 6, N + 6))    # x-velocity
v = ti.field(ti.f32, shape=(N + 6, N + 6))    # y-velocity
p = ti.field(ti.f32, shape=(N + 6, N + 6))    # Pressure

# Conservative variables
U1 = ti.field(ti.f32, shape=(N + 6, N + 6))  # rho
U2 = ti.field(ti.f32, shape=(N + 6, N + 6))  # rho*u
U3 = ti.field(ti.f32, shape=(N + 6, N + 6))  # rho*v
U4 = ti.field(ti.f32, shape=(N + 6, N + 6))  # Energy

# Flux arrays
F1 = ti.field(ti.f32, shape=(N + 5, N + 6))
F2 = ti.field(ti.f32, shape=(N + 5, N + 6))
F3 = ti.field(ti.f32, shape=(N + 5, N + 6))
F4 = ti.field(ti.f32, shape=(N + 5, N + 6))

G1 = ti.field(ti.f32, shape=(N + 6, N + 5))
G2 = ti.field(ti.f32, shape=(N + 6, N + 5))
G3 = ti.field(ti.f32, shape=(N + 6, N + 5))
G4 = ti.field(ti.f32, shape=(N + 6, N + 5))

@ti.func
def minmod(a, b):
    return 0.5 * (ti.abs(a + b) - ti.abs(a - b)) / ti.max(ti.abs(a) + ti.abs(b), 1e-10)

@ti.func
def HLLC_flux(rho_L, u_L, v_L, p_L, rho_R, u_R, v_R, p_R):
    # Calculate sound speeds
    c_L = ti.sqrt(gamma * p_L / rho_L)
    c_R = ti.sqrt(gamma * p_R / rho_R)
    
    # Calculate H_L and H_R
    H_L = (p_L * gamma / (gamma - 1) + 0.5 * rho_L * (u_L**2 + v_L**2)) / rho_L
    H_R = (p_R * gamma / (gamma - 1) + 0.5 * rho_R * (u_R**2 + v_R**2)) / rho_R
    
    # Roe averages
    sqrt_rho_L = ti.sqrt(rho_L)
    sqrt_rho_R = ti.sqrt(rho_R)
    u_roe = (sqrt_rho_L * u_L + sqrt_rho_R * u_R) / (sqrt_rho_L + sqrt_rho_R)
    v_roe = (sqrt_rho_L * v_L + sqrt_rho_R * v_R) / (sqrt_rho_L + sqrt_rho_R)
    H_roe = (sqrt_rho_L * H_L + sqrt_rho_R * H_R) / (sqrt_rho_L + sqrt_rho_R)
    
    c_roe = ti.sqrt((gamma - 1) * (H_roe - 0.5 * (u_roe**2 + v_roe**2)))
    
    # Wave speeds
    S_L = ti.min(u_L - c_L, u_roe - c_roe)
    S_R = ti.max(u_R + c_R, u_roe + c_roe)
    S_star = (p_R - p_L + rho_L * u_L * (S_L - u_L) - rho_R * u_R * (S_R - u_R)) / (rho_L * (S_L - u_L) - rho_R * (S_R - u_R))
    
    # Conservative variables
    U_L1 = rho_L
    U_L2 = rho_L * u_L
    U_L3 = rho_L * v_L
    U_L4 = p_L / (gamma - 1) + 0.5 * rho_L * (u_L**2 + v_L**2)
    
    U_R1 = rho_R
    U_R2 = rho_R * u_R
    U_R3 = rho_R * v_R
    U_R4 = p_R / (gamma - 1) + 0.5 * rho_R * (u_R**2 + v_R**2)
    
    # Fluxes
    F_L1 = rho_L * u_L
    F_L2 = rho_L * u_L**2 + p_L
    F_L3 = rho_L * u_L * v_L
    F_L4 = u_L * (U_L4 + p_L)
    
    F_R1 = rho_R * u_R
    F_R2 = rho_R * u_R**2 + p_R
    F_R3 = rho_R * u_R * v_R
    F_R4 = u_R * (U_R4 + p_R)
    
    # HLLC flux calculation
    flux1, flux2, flux3, flux4 = 0.0, 0.0, 0.0, 0.0
    
    if 0.0 <= S_L:
        flux1 = F_L1
        flux2 = F_L2
        flux3 = F_L3
        flux4 = F_L4
    elif S_L < 0.0 <= S_star:
        U_star_L1 = rho_L * (S_L - u_L) / (S_L - S_star)
        U_star_L2 = rho_L * (S_L - u_L) / (S_L - S_star) * S_star
        U_star_L3 = rho_L * (S_L - u_L) / (S_L - S_star) * v_L
        U_star_L4 = rho_L * (S_L - u_L) / (S_L - S_star) * (U_L4 / rho_L + (S_star - u_L) * (S_star + p_L / (rho_L * (S_L - u_L))))
        
        flux1 = F_L1 + S_L * (U_star_L1 - U_L1)
        flux2 = F_L2 + S_L * (U_star_L2 - U_L2)
        flux3 = F_L3 + S_L * (U_star_L3 - U_L3)
        flux4 = F_L4 + S_L * (U_star_L4 - U_L4)
    elif S_star < 0.0 <= S_R:
        U_star_R1 = rho_R * (S_R - u_R) / (S_R - S_star)
        U_star_R2 = rho_R * (S_R - u_R) / (S_R - S_star) * S_star
        U_star_R3 = rho_R * (S_R - u_R) / (S_R - S_star) * v_R
        U_star_R4 = rho_R * (S_R - u_R) / (S_R - S_star) * (U_R4 / rho_R + (S_star - u_R) * (S_star + p_R / (rho_R * (S_R - u_R))))
        
        flux1 = F_R1 + S_R * (U_star_R1 - U_R1)
        flux2 = F_R2 + S_R * (U_star_R2 - U_R2)
        flux3 = F_R3 + S_R * (U_star_R3 - U_R3)
        flux4 = F_R4 + S_R * (U_star_R4 - U_R4)
    else:  # 0.0 > S_R
        flux1 = F_R1
        flux2 = F_R2
        flux3 = F_R3
        flux4 = F_R4
    
    return flux1, flux2, flux3, flux4

@ti.kernel
def initialize():
    """Initialize the flow field with interesting initial conditions"""
    for i, j in ti.ndrange((3, N + 3), (3, N + 3)):
        x = (i - 3 + 0.5) * dx
        y = (j - 3 + 0.5) * dx
        
        # Create a more interesting initial condition - vortex
        r = ti.sqrt((x - 0.5)**2 + (y - 0.5)**2)
        
        if r < 0.3:
            # High density, low pressure vortex core
            rho[i, j] = 2.0
            u[i, j] = -2.0 * (y - 0.5) * ti.exp(-r / 0.1)
            v[i, j] = 2.0 * (x - 0.5) * ti.exp(-r / 0.1)
            p[i, j] = 0.5
        else:
            # Background fluid
            rho[i, j] = 1.0
            u[i, j] = 0.0
            v[i, j] = 0.0
            p[i, j] = 1.0
        
        # Convert to conservative variables
        U1[i, j] = rho[i, j]
        U2[i, j] = rho[i, j] * u[i, j]
        U3[i, j] = rho[i, j] * v[i, j]
        U4[i, j] = p[i, j] / (gamma - 1) + 0.5 * rho[i, j] * (u[i, j]**2 + v[i, j]**2)

@ti.kernel
def primitive_to_conservative():
    for i, j in ti.ndrange((0, N + 6), (0, N + 6)):
        U1[i, j] = rho[i, j]
        U2[i, j] = rho[i, j] * u[i, j]
        U3[i, j] = rho[i, j] * v[i, j]
        U4[i, j] = p[i, j] / (gamma - 1) + 0.5 * rho[i, j] * (u[i, j]**2 + v[i, j]**2)

@ti.kernel
def conservative_to_primitive():
    for i, j in ti.ndrange((0, N + 6), (0, N + 6)):
        rho[i, j] = U1[i, j]
        if U1[i, j] > 1e-10:
            u[i, j] = U2[i, j] / U1[i, j]
            v[i, j] = U3[i, j] / U1[i, j]
            p[i, j] = (gamma - 1) * (U4[i, j] - 0.5 * (U2[i, j]**2 + U3[i, j]**2) / U1[i, j])
        else:
            u[i, j] = 0.0
            v[i, j] = 0.0
            p[i, j] = 1e-10

@ti.kernel
def apply_boundary_conditions():
    # Left and right boundaries
    for j in range(N + 6):
        if BCs == "transmissive":
            # Left boundary
            for k in range(3):
                U1[k, j] = U1[3, j]
                U2[k, j] = U2[3, j]
                U3[k, j] = U3[3, j]
                U4[k, j] = U4[3, j]
            # Right boundary
            for k in range(N + 3, N + 6):
                U1[k, j] = U1[N + 2, j]
                U2[k, j] = U2[N + 2, j]
                U3[k, j] = U3[N + 2, j]
                U4[k, j] = U4[N + 2, j]
        else:  # reflective
            # Left boundary
            for k in range(3):
                U1[k, j] = U1[5 - k, j]
                U2[k, j] = -U2[5 - k, j]
                U3[k, j] = U3[5 - k, j]
                U4[k, j] = U4[5 - k, j]
            # Right boundary
            for k in range(N + 3, N + 6):
                U1[k, j] = U1[2 * N + 5 - k, j]
                U2[k, j] = -U2[2 * N + 5 - k, j]
                U3[k, j] = U3[2 * N + 5 - k, j]
                U4[k, j] = U4[2 * N + 5 - k, j]
    
    # Top and bottom boundaries
    for i in range(N + 6):
        if BCs == "transmissive":
            # Bottom boundary
            for k in range(3):
                U1[i, k] = U1[i, 3]
                U2[i, k] = U2[i, 3]
                U3[i, k] = U3[i, 3]
                U4[i, k] = U4[i, 3]
            # Top boundary
            for k in range(N + 3, N + 6):
                U1[i, k] = U1[i, N + 2]
                U2[i, k] = U2[i, N + 2]
                U3[i, k] = U3[i, N + 2]
                U4[i, k] = U4[i, N + 2]
        else:  # reflective
            # Bottom boundary
            for k in range(3):
                U1[i, k] = U1[i, 5 - k]
                U2[i, k] = U2[i, 5 - k]
                U3[i, k] = -U3[i, 5 - k]
                U4[i, k] = U4[i, 5 - k]
            # Top boundary
            for k in range(N + 3, N + 6):
                U1[i, k] = U1[i, 2 * N + 5 - k]
                U2[i, k] = U2[i, 2 * N + 5 - k]
                U3[i, k] = -U3[i, 2 * N + 5 - k]
                U4[i, k] = U4[i, 2 * N + 5 - k]

@ti.kernel
def compute_fluxes():
    # X-direction fluxes
    for i, j in ti.ndrange((3, N + 3), (3, N + 3)):
        # MUSCL reconstruction
        drho_L = minmod(rho[i, j] - rho[i - 1, j], rho[i + 1, j] - rho[i, j])
        du_L = minmod(u[i, j] - u[i - 1, j], u[i + 1, j] - u[i, j])
        dv_L = minmod(v[i, j] - v[i - 1, j], v[i + 1, j] - v[i, j])
        dp_L = minmod(p[i, j] - p[i - 1, j], p[i + 1, j] - p[i, j])
        
        drho_R = minmod(rho[i + 1, j] - rho[i, j], rho[i + 2, j] - rho[i + 1, j])
        du_R = minmod(u[i + 1, j] - u[i, j], u[i + 2, j] - u[i + 1, j])
        dv_R = minmod(v[i + 1, j] - v[i, j], v[i + 2, j] - v[i + 1, j])
        dp_R = minmod(p[i + 1, j] - p[i, j], p[i + 2, j] - p[i + 1, j])
        
        # Left and right states
        rho_L = rho[i, j] + 0.5 * drho_L
        u_L = u[i, j] + 0.5 * du_L
        v_L = v[i, j] + 0.5 * dv_L
        p_L = p[i, j] + 0.5 * dp_L
        
        rho_R = rho[i + 1, j] - 0.5 * drho_R
        u_R = u[i + 1, j] - 0.5 * du_R
        v_R = v[i + 1, j] - 0.5 * dv_R
        p_R = p[i + 1, j] - 0.5 * dp_R
        
        F1[i, j], F2[i, j], F3[i, j], F4[i, j] = HLLC_flux(rho_L, u_L, v_L, p_L, rho_R, u_R, v_R, p_R)
    
    # Y-direction fluxes
    for i, j in ti.ndrange((3, N + 3), (3, N + 3)):
        # MUSCL reconstruction
        drho_L = minmod(rho[i, j] - rho[i, j - 1], rho[i, j + 1] - rho[i, j])
        du_L = minmod(u[i, j] - u[i, j - 1], u[i, j + 1] - u[i, j])
        dv_L = minmod(v[i, j] - v[i, j - 1], v[i, j + 1] - v[i, j])
        dp_L = minmod(p[i, j] - p[i, j - 1], p[i, j + 1] - p[i, j])
        
        drho_R = minmod(rho[i, j + 1] - rho[i, j], rho[i, j + 2] - rho[i, j + 1])
        du_R = minmod(u[i, j + 1] - u[i, j], u[i, j + 2] - u[i, j + 1])
        dv_R = minmod(v[i, j + 1] - v[i, j], v[i, j + 2] - v[i, j + 1])
        dp_R = minmod(p[i, j + 1] - p[i, j], p[i, j + 2] - p[i, j + 1])
        
        # Left and right states (note: u and v are swapped for y-direction)
        rho_L = rho[i, j] + 0.5 * drho_L
        v_L = v[i, j] + 0.5 * dv_L  # v becomes the normal velocity
        u_L = u[i, j] + 0.5 * du_L  # u becomes the tangential velocity
        p_L = p[i, j] + 0.5 * dp_L
        
        rho_R = rho[i, j + 1] - 0.5 * drho_R
        v_R = v[i, j + 1] - 0.5 * dv_R
        u_R = u[i, j + 1] - 0.5 * du_R
        p_R = p[i, j + 1] - 0.5 * dp_R
        
        # Note: For y-direction, we need to swap u and v in the flux calculation
        flux1, flux3, flux2, flux4 = HLLC_flux(rho_L, v_L, u_L, p_L, rho_R, v_R, u_R, p_R)
        G1[i, j] = flux1
        G2[i, j] = flux2
        G3[i, j] = flux3
        G4[i, j] = flux4

@ti.kernel
def time_step():
    for i, j in ti.ndrange((3, N + 3), (3, N + 3)):
        U1[i, j] -= dt / dx * (F1[i, j] - F1[i - 1, j] + G1[i, j] - G1[i, j - 1])
        U2[i, j] -= dt / dx * (F2[i, j] - F2[i - 1, j] + G2[i, j] - G2[i, j - 1])
        U3[i, j] -= dt / dx * (F3[i, j] - F3[i - 1, j] + G3[i, j] - G3[i, j - 1])
        U4[i, j] -= dt / dx * (F4[i, j] - F4[i - 1, j] + G4[i, j] - G4[i, j - 1])

class EulerSimulation:
    def __init__(self):
        self.step_count = 0
        self.time = 0.0
        
        if TAICHI_AVAILABLE:
            initialize()
            self.use_fallback = False
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
            conservative_to_primitive()
            apply_boundary_conditions()
            compute_fluxes()
            time_step()
            self.step_count += 1
            self.time += dt
        
    def get_density_field(self):
        """Get density field for visualization"""
        if self.use_fallback:
            data = self.fallback_sim.get_visualization_data("density")
            return data['data']
        else:
            conservative_to_primitive()
            rho_data = rho.to_numpy()[3:N+3, 3:N+3]
            return rho_data.tolist()
    
    def get_velocity_field(self):
        """Get velocity field for visualization"""
        if self.use_fallback:
            # Return velocity data in expected format
            vel_data = self.fallback_sim.get_visualization_data("velocity")['data']
            return {
                'u': self.fallback_sim.velocity_x.tolist(),
                'v': self.fallback_sim.velocity_y.tolist()
            }
        else:
            conservative_to_primitive()
            u_data = u.to_numpy()[3:N+3, 3:N+3]
            v_data = v.to_numpy()[3:N+3, 3:N+3]
            return {
                'u': u_data.tolist(),
                'v': v_data.tolist()
            }
    
    def get_pressure_field(self):
        """Get pressure field for visualization"""
        if self.use_fallback:
            data = self.fallback_sim.get_visualization_data("pressure")
            return data['data']
        else:
            conservative_to_primitive()
            p_data = p.to_numpy()[3:N+3, 3:N+3]
            return p_data.tolist()
    
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
                'dt': float(dt),
                'grid_size': N
            }
    
    def reset(self):
        """Reset the simulation"""
        self.step_count = 0
        self.time = 0.0
        if self.use_fallback:
            self.fallback_sim = SimpleFluidSimulation()
        else:
            initialize()
    
    def add_interaction(self, x, y, strength=0.1):
        """Add mouse/touch interaction"""
        if self.use_fallback:
            # Convert normalized coordinates to grid coordinates
            grid_x = x * self.fallback_sim.N
            grid_y = y * self.fallback_sim.N
            self.fallback_sim.add_interaction(grid_x, grid_y, strength)
        else:
            # For Taichi version, you could add similar interaction logic here
            pass