# Deploying Taichi Euler Simulation to Render

This guide walks you through deploying the Taichi backend to Render and configuring your GitHub Pages site to use it.

## 🚀 Step 1: Deploy Backend to Render

### 1.1 Create Render Account
- Go to [render.com](https://render.com)
- Sign up/login with GitHub

### 1.2 Deploy the Backend
1. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select this repository

2. **Configure Service**
   - **Name**: `taichi-euler-backend` (or your preferred name)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `cd src && python server_production.py`
   - **Plan**: Free (Starter)

3. **Environment Variables** (if needed)
   - `PYTHON_VERSION`: `3.9.16`
   - Render auto-sets `PORT`

4. **Deploy**
   - Click "Create Web Service"
   - Wait 5-10 minutes for build and deployment

### 1.3 Note Your App URL
After deployment, your backend will be available at:
```
https://YOUR_APP_NAME.onrender.com
```

## 🔧 Step 2: Configure Frontend

### 2.1 Update config.js
Edit `config.js` and replace `YOUR_RENDER_APP_NAME` with your actual Render app name:

```javascript
const CONFIG = {
    websocket: {
        productionHost: 'taichi-euler-backend.onrender.com', // Your actual URL
        // ...
    }
};
```

### 2.2 Test Connection
1. Open your GitHub Pages site
2. Open browser Developer Tools (F12)
3. Check Console for connection messages
4. Should see: `Connecting to: wss://your-app.onrender.com/ws`

## 🏗️ Step 3: Update GitHub Pages

### 3.1 Commit Changes
```bash
git add .
git commit -m "Configure production WebSocket connection"
git push origin main
```

### 3.2 GitHub Pages will auto-update
- Your site at `https://username.github.io/repository-name/taichi-euler-fluid.html`
- Should now connect to your Render backend

## 🔍 Step 4: Verify Deployment

### 4.1 Check Backend Health
Visit: `https://your-app.onrender.com/health`
Should return: "OK"

### 4.2 Check WebSocket Connection
Visit: `https://your-app.onrender.com/ws`
Should attempt WebSocket upgrade

### 4.3 Test Full Integration
1. Open `taichi-euler-fluid.html` on GitHub Pages
2. Click "Start" button
3. Should see fluid simulation running

## 🐛 Troubleshooting

### Backend Issues
- **Build Fails**: Check `requirements.txt` dependencies
- **Memory Issues**: Render Free tier has 512MB limit
- **Taichi GPU**: Render uses CPU-only, modify `euler_simulation.py`:
  ```python
  ti.init(arch=ti.cpu)  # Instead of ti.gpu
  ```

### Frontend Issues
- **CORS Errors**: Backend includes CORS headers
- **WebSocket Fails**: Check URL in config.js
- **Mixed Content**: Ensure using `wss://` not `ws://`

### Performance Issues
- **Slow Simulation**: Render Free tier "spins down" after 15min idle
- **First Load**: May take 30+ seconds to wake up
- **Reduce Grid Size**: Edit `euler_simulation.py`, change `N = 128`

## 📊 Performance Notes

### Render Free Tier Limitations
- **CPU Only**: No GPU acceleration
- **512MB RAM**: Limited memory
- **Spin Down**: Goes to sleep after 15 minutes
- **Cold Start**: 30-60 seconds wake up time

### Optimization Tips
1. **Reduce Grid Resolution**:
   ```python
   N = 128  # Instead of 256
   ```

2. **Lower Frame Rate**:
   ```python
   await asyncio.sleep(1.0 / 10.0)  # 10 FPS instead of 15
   ```

3. **Simplify Physics**:
   - Reduce CFL number for stability
   - Use simpler boundary conditions

## 🎯 Expected URLs

After deployment:
- **Backend Health**: `https://your-app.onrender.com/health`
- **WebSocket**: `wss://your-app.onrender.com/ws`
- **Frontend**: `https://username.github.io/repo/taichi-euler-fluid.html`

## 🔄 Updates

To update the backend:
1. Push changes to GitHub
2. Render auto-deploys from main branch
3. Frontend automatically uses new backend

## 💰 Cost

- **Render Free Tier**: $0/month
- **GitHub Pages**: Free
- **Total Cost**: $0

For production use, consider Render's paid tiers for better performance and uptime.