// --- Scene, Camera, Renderer ---
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000)
camera.position.set(5, 5, 10)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
const container = document.getElementById('diceContainer')
if (container) {
  container.appendChild(renderer.domElement)
} else {
  document.body.appendChild(renderer.domElement)
}

// Optional orbit controls (for background effect, we don't need camera controls)
let controls = null
if (typeof THREE.OrbitControls !== 'undefined') {
  controls = new THREE.OrbitControls(camera, renderer.domElement)
}

// --- Lights ---
const light = new THREE.PointLight(0xffffff, 1.2)
light.position.set(10, 10, 10)
scene.add(light)
scene.add(new THREE.AmbientLight(0x404040, 0.8))

// --- Physics World ---
const world = new CANNON.World()
world.gravity.set(0, -1.62, 0) // 🌙 Moon gravity (1.62 m/s²)

// --- Floor ---
const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.3 })
const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), floorMat)
floorMesh.rotation.x = -Math.PI / 2
scene.add(floorMesh)

const floorBody = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: new CANNON.Material({ friction: 0.3, restitution: 0.7 })
})
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
world.addBody(floorBody)

// --- Dice Array ---
const dice = []
const diceBodies = []

function createDie(x, y, z) {
  const size = 1
  const geometry = new THREE.BoxGeometry(size, size, size)
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(`hsl(${Math.random() * 360}, 100%, 50%)`),
    emissive: 0x111111,
    emissiveIntensity: 0.6
  })
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  const shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2))
  const body = new CANNON.Body({ mass: 1, shape })
  body.position.set(x, y, z)
  body.angularVelocity.set(Math.random(), Math.random(), Math.random())
  body.linearDamping = 0.1
  world.addBody(body)

  dice.push(mesh)
  diceBodies.push(body)

  // Glow trail effect
  const trailGeo = new THREE.SphereGeometry(0.05, 8, 8)
  const trailMat = new THREE.MeshBasicMaterial({ color: material.color, transparent: true, opacity: 0.6 })
  const trail = new THREE.Mesh(trailGeo, trailMat)
  scene.add(trail)
  mesh.userData.trail = trail
}

// --- Click to Spawn Dice ---
window.addEventListener('click', () => {
  createDie(Math.random()*2 - 1, 5, Math.random()*2 - 1)
})

// --- Slow Motion Toggle ---
let slowMo = false
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 's') {
    slowMo = !slowMo
  }
})

// --- Animation Loop ---
const clock = new THREE.Clock()
function animate() {
  requestAnimationFrame(animate)

  const delta = clock.getDelta()
  const step = slowMo ? delta * 0.2 : delta // 🐢 Slow motion

  world.step(1/60, step, 3)

  dice.forEach((mesh, i) => {
    const body = diceBodies[i]
    mesh.position.copy(body.position)
    mesh.quaternion.copy(body.quaternion)

    // Update trail
    if (mesh.userData.trail) {
      mesh.userData.trail.position.copy(mesh.position)
    }
  })

  if (controls) controls.update()
  renderer.render(scene, camera)
}

// --- Window Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// Start animation
animate()

