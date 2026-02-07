import * as THREE from 'three';

// ============ CONSTANTS ============
const TRACK_LENGTH = 100;
const TRACK_WIDTH = 8;
const PLAYER_SPEED = 2;
const BOOST_SPEED = 5;
const BOOST_DURATION = 0.3;
const OBSTACLE_SPACING = 15;
const FINISH_LINE_POS = TRACK_LENGTH - 5;

// ============ GAME STATE ============
const state = {
  isPlaying: false,
  score: 0,
  distance: 0,
  playerZ: 0,
  playerLane: 1, // 0, 1, 2 (left, center, right)
  boosting: false,
  boostTimer: 0,
  gameOver: false,
  won: false,
  opponents: [],
  obstacles: []
};

// ============ THREE.JS SETUP ============
let scene, camera, renderer;
let player, walker;
let clock = new THREE.Clock();

// ============ PLAY.FUN SDK ============
let sdk = null;
let sdkReady = false;
let sessionPoints = 0;

function initPlayFun() {
  if (typeof OpenGameSDK !== 'undefined') {
    sdk = new OpenGameSDK({
      gameId: '4cd3aa62-066d-42e4-b5fa-6573496cf9e4',
      ui: { usePointsWidget: true, theme: 'light' },
      logLevel: 1
    });
    sdk.on('OnReady', () => {
      console.log('[PlayFun] Ready');
      sdkReady = true;
    });
    sdk.init();
  }
}

function addPoints(amount) {
  if (amount <= 0) return;
  sessionPoints += amount;
  if (sdk && sdkReady) {
    try { sdk.addPoints(amount); } catch(e) { console.error('[PlayFun] addPoints error:', e); }
  }
}

function deductPoints(amount) {
  sessionPoints = Math.max(0, sessionPoints - amount);
  // Note: SDK doesn't have deductPoints, but we track locally
}

function savePoints() {
  console.log('[PlayFun] Saving points, sdkReady:', sdkReady, 'sessionPoints:', sessionPoints);
  if (sdk && sdkReady) {
    try { sdk.savePoints(); } catch(e) { console.error('[PlayFun] savePoints error:', e); }
  }
}

// ============ INIT ============
function init() {
  initPlayFun();
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Sky blue
  scene.fog = new THREE.Fog(0x87CEEB, 20, 80);
  
  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 5, -8);
  camera.lookAt(0, 1, 10);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  document.getElementById('game-container').appendChild(renderer.domElement);
  
  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(10, 20, 10);
  sun.castShadow = true;
  scene.add(sun);
  
  // Ground / Track
  createTrack();
  
  // Player
  createPlayer();
  
  // Opponents
  createOpponents();
  
  // Obstacles
  createObstacles();
  
  // Finish line
  createFinishLine();
  
  // Events
  setupEvents();
  
  // Render loop
  animate();
}

function createTrack() {
  // Grass
  const grassGeo = new THREE.PlaneGeometry(50, TRACK_LENGTH + 20);
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x3d9140 });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.z = TRACK_LENGTH / 2;
  grass.receiveShadow = true;
  scene.add(grass);
  
  // Track (sidewalk)
  const trackGeo = new THREE.PlaneGeometry(TRACK_WIDTH, TRACK_LENGTH + 10);
  const trackMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const track = new THREE.Mesh(trackGeo, trackMat);
  track.rotation.x = -Math.PI / 2;
  track.position.y = 0.01;
  track.position.z = TRACK_LENGTH / 2;
  track.receiveShadow = true;
  scene.add(track);
  
  // Lane markers
  for (let z = 0; z < TRACK_LENGTH; z += 5) {
    const markerGeo = new THREE.PlaneGeometry(0.2, 2);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    
    for (let lane = -1; lane <= 1; lane += 2) {
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(lane * 1.5, 0.02, z);
      scene.add(marker);
    }
  }
}

function createPlayer() {
  player = new THREE.Group();
  
  // Body (old person)
  const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown cardigan
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1;
  body.castShadow = true;
  player.add(body);
  
  // Head
  const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xFFDBB4 }); // Skin tone
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.7;
  head.castShadow = true;
  player.add(head);
  
  // White hair
  const hairGeo = new THREE.SphereGeometry(0.27, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const hairMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.y = 1.75;
  player.add(hair);
  
  // Walker frame
  walker = new THREE.Group();
  
  const pipeMat = new THREE.MeshLambertMaterial({ color: 0xC0C0C0 });
  const pipeGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8);
  
  // Four legs
  const legPositions = [
    [-0.4, 0, 0.3], [0.4, 0, 0.3], [-0.4, 0, -0.3], [0.4, 0, -0.3]
  ];
  legPositions.forEach(pos => {
    const leg = new THREE.Mesh(pipeGeo, pipeMat);
    leg.position.set(pos[0], 0.4, pos[2]);
    walker.add(leg);
  });
  
  // Top bar
  const topBarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8);
  const topBar = new THREE.Mesh(topBarGeo, pipeMat);
  topBar.rotation.z = Math.PI / 2;
  topBar.position.set(0, 0.8, 0.3);
  walker.add(topBar);
  
  // Side bars
  const sideBarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
  [-0.4, 0.4].forEach(x => {
    const sideBar = new THREE.Mesh(sideBarGeo, pipeMat);
    sideBar.rotation.x = Math.PI / 2;
    sideBar.position.set(x, 0.8, 0);
    walker.add(sideBar);
  });
  
  // Tennis balls on legs (classic!)
  const ballGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const ballMat = new THREE.MeshLambertMaterial({ color: 0xccff00 });
  legPositions.forEach(pos => {
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(pos[0], 0, pos[2]);
    walker.add(ball);
  });
  
  walker.position.z = 0.5;
  player.add(walker);
  
  player.position.set(0, 0, 0);
  scene.add(player);
}

function createOpponents() {
  const colors = [0x4169E1, 0xFF69B4, 0x32CD32]; // Blue, pink, green cardigans
  
  for (let i = 0; i < 3; i++) {
    const opponent = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: colors[i] });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1;
    opponent.add(body);
    
    // Head
    const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xFFDBB4 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.7;
    opponent.add(head);
    
    // Hair (different colors)
    const hairColors = [0xcccccc, 0xffffff, 0x888888];
    const hairGeo = new THREE.SphereGeometry(0.27, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const hairMat = new THREE.MeshLambertMaterial({ color: hairColors[i] });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.75;
    opponent.add(hair);
    
    // Simple walker representation
    const walkerGeo = new THREE.BoxGeometry(0.8, 0.8, 0.6);
    const walkerMat = new THREE.MeshLambertMaterial({ color: 0xC0C0C0, wireframe: true });
    const walkerMesh = new THREE.Mesh(walkerGeo, walkerMat);
    walkerMesh.position.set(0, 0.4, 0.5);
    opponent.add(walkerMesh);
    
    const lane = i === 0 ? -2.5 : i === 1 ? 0 : 2.5;
    opponent.position.set(lane, 0, -2 - i * 2);
    scene.add(opponent);
    
    state.opponents.push({
      mesh: opponent,
      baseSpeed: 2.2 + Math.random() * 0.6, // Faster base speed (2.2-2.8)
      speed: 2.2 + Math.random() * 0.6,
      lane: lane,
      z: opponent.position.z,
      boostTimer: 0,
      boosting: false
    });
  }
}

function createObstacles() {
  const obstacleTypes = ['cat', 'puddle', 'newspaper'];
  
  for (let z = 10; z < TRACK_LENGTH - 20; z += OBSTACLE_SPACING) {
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    const lane = (Math.floor(Math.random() * 3) - 1) * 2.5;
    
    let obstacle;
    
    if (type === 'cat') {
      obstacle = createCat();
    } else if (type === 'puddle') {
      obstacle = createPuddle();
    } else {
      obstacle = createNewspaper();
    }
    
    obstacle.position.set(lane, 0, z);
    scene.add(obstacle);
    
    state.obstacles.push({
      mesh: obstacle,
      type: type,
      lane: lane,
      z: z
    });
  }
}

function createCat() {
  const cat = new THREE.Group();
  
  // Body
  const bodyGeo = new THREE.SphereGeometry(0.3, 8, 8);
  bodyGeo.scale(1, 0.8, 1.5);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xff8c00 }); // Orange cat
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.3;
  cat.add(body);
  
  // Head
  const headGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.set(0, 0.4, 0.35);
  cat.add(head);
  
  // Ears
  const earGeo = new THREE.ConeGeometry(0.08, 0.15, 4);
  [-0.1, 0.1].forEach(x => {
    const ear = new THREE.Mesh(earGeo, bodyMat);
    ear.position.set(x, 0.55, 0.35);
    cat.add(ear);
  });
  
  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  [-0.08, 0.08].forEach(x => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x, 0.45, 0.5);
    cat.add(eye);
  });
  
  // Tail
  const tailGeo = new THREE.CylinderGeometry(0.03, 0.02, 0.5, 8);
  const tail = new THREE.Mesh(tailGeo, bodyMat);
  tail.position.set(0, 0.4, -0.4);
  tail.rotation.x = Math.PI / 4;
  cat.add(tail);
  
  return cat;
}

function createPuddle() {
  const puddleGeo = new THREE.CircleGeometry(0.6, 16);
  const puddleMat = new THREE.MeshLambertMaterial({ 
    color: 0x4444ff, 
    transparent: true, 
    opacity: 0.7 
  });
  const puddle = new THREE.Mesh(puddleGeo, puddleMat);
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.y = 0.01;
  return puddle;
}

function createNewspaper() {
  const paper = new THREE.Group();
  
  const pageGeo = new THREE.PlaneGeometry(0.4, 0.6);
  const pageMat = new THREE.MeshLambertMaterial({ color: 0xf5f5dc, side: THREE.DoubleSide });
  
  for (let i = 0; i < 3; i++) {
    const page = new THREE.Mesh(pageGeo, pageMat);
    page.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    page.rotation.z = (Math.random() - 0.5) * 0.5;
    page.position.set(
      (Math.random() - 0.5) * 0.3,
      0.02 + i * 0.01,
      (Math.random() - 0.5) * 0.3
    );
    paper.add(page);
  }
  
  return paper;
}

function createFinishLine() {
  // Checkered finish line
  const group = new THREE.Group();
  
  // Banner poles
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  
  [-TRACK_WIDTH/2 - 0.5, TRACK_WIDTH/2 + 0.5].forEach(x => {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2, FINISH_LINE_POS);
    group.add(pole);
  });
  
  // Banner
  const bannerGeo = new THREE.PlaneGeometry(TRACK_WIDTH + 1, 1);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  
  // Checkerboard pattern
  const squareSize = 16;
  for (let x = 0; x < canvas.width; x += squareSize) {
    for (let y = 0; y < canvas.height; y += squareSize) {
      ctx.fillStyle = ((x + y) / squareSize) % 2 === 0 ? '#000' : '#fff';
      ctx.fillRect(x, y, squareSize, squareSize);
    }
  }
  
  const bannerTex = new THREE.CanvasTexture(canvas);
  const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 3.5, FINISH_LINE_POS);
  group.add(banner);
  
  // "FINISH" text on ground
  const textGeo = new THREE.PlaneGeometry(6, 1);
  const textCanvas = document.createElement('canvas');
  textCanvas.width = 256;
  textCanvas.height = 64;
  const textCtx = textCanvas.getContext('2d');
  textCtx.fillStyle = '#fff';
  textCtx.fillRect(0, 0, 256, 64);
  textCtx.fillStyle = '#000';
  textCtx.font = 'bold 48px Arial';
  textCtx.textAlign = 'center';
  textCtx.fillText('FINISH', 128, 48);
  
  const textTex = new THREE.CanvasTexture(textCanvas);
  const textMat = new THREE.MeshBasicMaterial({ map: textTex });
  const text = new THREE.Mesh(textGeo, textMat);
  text.rotation.x = -Math.PI / 2;
  text.position.set(0, 0.02, FINISH_LINE_POS - 2);
  group.add(text);
  
  scene.add(group);
}

function setupEvents() {
  window.addEventListener('resize', onResize);
  
  // Click/tap to boost
  document.addEventListener('pointerdown', onBoost);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') onBoost();
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') changeLane(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') changeLane(1);
  });
  
  // Touch swipe for lane change
  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  });
  document.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 50) {
      changeLane(diff > 0 ? 1 : -1);
    }
  });
  
  // UI buttons
  document.getElementById('play-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', restartGame);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onBoost() {
  if (!state.isPlaying || state.gameOver) return;
  state.boosting = true;
  state.boostTimer = BOOST_DURATION;
}

function changeLane(dir) {
  if (!state.isPlaying || state.gameOver) return;
  state.playerLane = Math.max(0, Math.min(2, state.playerLane + dir));
}

function startGame() {
  document.getElementById('start-screen').style.display = 'none';
  state.isPlaying = true;
  state.score = 0;
  state.distance = 0;
  state.playerZ = 0;
  state.playerLane = 1;
  state.gameOver = false;
  state.won = false;
  sessionPoints = 0;
  
  // Reset player position
  player.position.z = 0;
  
  // Reset opponents
  state.opponents.forEach((opp, i) => {
    opp.z = -2 - i * 2;
    opp.mesh.position.z = opp.z;
  });
}

function restartGame() {
  document.getElementById('game-over-screen').style.display = 'none';
  startGame();
}

function endGame(won, placement = 4) {
  state.gameOver = true;
  state.isPlaying = false;
  state.won = won;
  
  const title = document.getElementById('game-over-title');
  if (won && placement === 1) {
    title.textContent = '🥇 1ST PLACE! 🥇';
  } else if (won && placement === 2) {
    title.textContent = '🥈 2ND PLACE 🥈';
  } else if (won && placement === 3) {
    title.textContent = '🥉 3RD PLACE 🥉';
  } else if (won) {
    title.textContent = '😅 4TH PLACE 😅';
  } else {
    // Didn't finish - opponents won
    state.score = Math.max(0, state.score - 200); // Penalty for not finishing
    title.textContent = '💀 TOO SLOW! 💀';
  }
  
  document.getElementById('final-score').textContent = `Score: ${state.score}`;
  document.getElementById('game-over-screen').style.display = 'flex';
  
  // Always save points at end
  savePoints();
}

function update(delta) {
  if (!state.isPlaying || state.gameOver) return;
  
  // Boost timer
  if (state.boosting) {
    state.boostTimer -= delta;
    if (state.boostTimer <= 0) {
      state.boosting = false;
    }
  }
  
  // Player movement
  const speed = state.boosting ? BOOST_SPEED : PLAYER_SPEED;
  state.playerZ += speed * delta;
  player.position.z = state.playerZ;
  
  // Lane movement (smooth)
  const targetX = (state.playerLane - 1) * 2.5;
  player.position.x += (targetX - player.position.x) * 5 * delta;
  
  // Walker bobbing animation
  const bobSpeed = state.boosting ? 15 : 8;
  walker.position.y = Math.sin(state.playerZ * bobSpeed) * 0.05;
  walker.rotation.z = Math.sin(state.playerZ * bobSpeed) * 0.05;
  
  // Camera follow
  camera.position.z = state.playerZ - 8;
  camera.lookAt(player.position.x, 1, state.playerZ + 10);
  
  // Update opponents (more competitive!)
  state.opponents.forEach(opp => {
    // Random boost bursts
    if (!opp.boosting && Math.random() < 0.01) {
      opp.boosting = true;
      opp.boostTimer = 0.5 + Math.random() * 0.5;
    }
    
    if (opp.boosting) {
      opp.boostTimer -= delta;
      opp.speed = opp.baseSpeed * 1.8; // Boost speed
      if (opp.boostTimer <= 0) {
        opp.boosting = false;
        opp.speed = opp.baseSpeed;
      }
    }
    
    // Speed up as race progresses (rubber banding)
    const progressBonus = Math.min(opp.z / FINISH_LINE_POS, 1) * 0.5;
    const effectiveSpeed = opp.speed + progressBonus;
    
    opp.z += effectiveSpeed * delta;
    opp.mesh.position.z = opp.z;
    
    // Check if opponent won
    if (opp.z >= FINISH_LINE_POS && !state.won) {
      endGame(false);
    }
  });
  
  // Check collisions with obstacles
  state.obstacles.forEach(obs => {
    const playerLaneX = (state.playerLane - 1) * 2.5;
    const dist = Math.abs(obs.z - state.playerZ);
    const laneDist = Math.abs(obs.lane - playerLaneX);
    
    if (dist < 1 && laneDist < 1.5) {
      // Hit obstacle - slow down AND lose points!
      state.playerZ -= 2;
      player.position.z = state.playerZ;
      
      // Point penalty based on obstacle type
      const penalty = obs.type === 'cat' ? 50 : obs.type === 'puddle' ? 30 : 20;
      state.score = Math.max(0, state.score - penalty);
      deductPoints(penalty);
      
      obs.z = -100; // Move obstacle away
      obs.mesh.position.z = -100;
    }
  });
  
  // Check win condition
  if (state.playerZ >= FINISH_LINE_POS) {
    state.won = true;
    
    // Calculate placement (how many opponents finished before us)
    const opponentsAhead = state.opponents.filter(o => o.z >= FINISH_LINE_POS).length;
    const placement = opponentsAhead + 1; // 1st, 2nd, 3rd, or 4th
    
    // Placement bonuses/penalties
    const placementBonus = placement === 1 ? 500 : placement === 2 ? 200 : placement === 3 ? 50 : -100;
    state.score += placementBonus;
    state.score = Math.max(0, state.score);
    
    addPoints(state.score);
    endGame(true, placement);
    return;
  }
  
  // Update score based on distance (accumulate during gameplay)
  const newScore = Math.floor(state.playerZ * 10);
  if (newScore > state.score) {
    const diff = newScore - state.score;
    state.score = newScore;
    addPoints(diff); // Add points as we progress
  }
  state.distance = Math.floor(FINISH_LINE_POS - state.playerZ);
  
  // Update UI
  document.getElementById('score').textContent = `Score: ${state.score}`;
  document.getElementById('distance').textContent = `${Math.max(0, state.distance)}m to finish`;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  update(delta);
  renderer.render(scene, camera);
}

// Start
init();
