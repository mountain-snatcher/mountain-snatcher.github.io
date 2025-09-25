# Taichi Euler Fluid Simulation Backend

This backend provides a WebSocket server that runs Taichi-based Euler fluid simulations and streams the results to a web frontend in real-time.

## Features

- **High-Performance Computing**: Uses Taichi Lang for GPU-accelerated fluid simulation
- **Real-time Visualization**: WebSocket communication for live data streaming
- **Euler Equations**: Solves compressible fluid dynamics with HLLC Riemann solver
- **MUSCL Reconstruction**: Second-order spatial accuracy
- **Interactive Controls**: Start/stop/reset simulation remotely

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Run the Server

```bash
cd src
python server.py
```

The server will start on `ws://localhost:8765`

### 3. Open the Frontend

Open `taichi-euler-fluid.html` in your web browser. The page will automatically connect to the backend.

## Server Configuration

- **Host**: localhost
- **Port**: 8765
- **Protocol**: WebSocket
- **Max Message Size**: 10MB (for large simulation data)

## Simulation Parameters

- **Grid Resolution**: 256×256
- **CFL Number**: 0.3
- **Adiabatic Index**: 1.4 (air)
- **Boundary Conditions**: Reflective
- **Initial Condition**: Vortex with high-density core

## WebSocket API

### Client → Server Messages

```json
{"type": "start_simulation"}
{"type": "stop_simulation"}  
{"type": "reset_simulation"}
{"type": "get_initial_data"}
```

### Server → Client Messages

```json
{
  "type": "simulation_data",
  "density": [[...], [...]],
  "velocity": {"u": [[...]], "v": [[...]]},
  "pressure": [[...], [...]],
  "info": {
    "step": 1234,
    "time": 0.123,
    "dt": 0.001,
    "grid_size": 256
  }
}
```

## System Requirements

- **Python**: 3.8+
- **GPU**: CUDA-capable (recommended) or fallback to CPU
- **Memory**: 2GB+ RAM
- **Network**: Local WebSocket support

## Troubleshooting

### GPU Issues
If Taichi fails to initialize GPU:
```python
# In euler_simulation.py, change:
ti.init(arch=ti.gpu)
# To:
ti.init(arch=ti.cpu)
```

### Port Conflicts
Change the port in `server.py`:
```python
start_server = websockets.serve(
    server_instance.handle_client,
    "localhost", 
    8766,  # Change port here
    # ...
)
```

### Memory Issues
Reduce grid resolution in `euler_simulation.py`:
```python
N = 128  # Reduced from 256
```

## Development

### File Structure
```
backend/
├── src/
│   ├── euler_simulation.py  # Taichi fluid simulation
│   └── server.py           # WebSocket server
├── requirements.txt
└── README.md
```

### Adding New Features

1. **New Visualization Modes**: Extend `get_*_field()` methods in `euler_simulation.py`
2. **Interactive Parameters**: Add parameter update messages in WebSocket API
3. **Different Solvers**: Replace HLLC flux with other Riemann solvers

### Performance Tuning

- **Grid Size**: Larger grids need more memory but higher resolution
- **Time Step**: Smaller dt = more stable but slower simulation  
- **Broadcast Rate**: Reduce FPS in server loop for lower bandwidth

## References

- [Taichi Programming Language](https://www.taichi-lang.org/)
- [Euler Equations](https://en.wikipedia.org/wiki/Euler_equations_(fluid_dynamics))
- [HLLC Riemann Solver](https://doi.org/10.1016/0021-9991(94)90295-X)