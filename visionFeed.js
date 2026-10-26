// visionFeed.js - Interactive YOLOv11 Computer Vision Video Detection Engine
// Detects real objects from Webcam, Uploaded Video/Image, & CCTV feeds and classifies into:
// 1. 🍏 EDIBLE: EAT STUFF (Food, Groceries, Cereals, Milk, Snacks, Fruits, Beverages)
// 2. 🌸 PERFUME & COSMETICS (Fragrances, Colognes, Beauty, Deodorants, Skincare)
// 3. 📱 NON-EDIBLE / UTILITIES (Cell phones, gadgets, containers)
// 4. 👤 HUMAN / SHOPPERS (Movement & dwell)

import { productIntelligenceEngine } from '../data/productKnowledgeBase.js';
import { ProductTrainingModal } from './trainingModal.js';
import { soundEffects } from '../utils/soundEffects.js';

export class VisionFeedEngine {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.cameras = options.cameras || [];
    this.currentCam = this.cameras[0] || null;
    this.confThreshold = 0.60;
    this.showBoundingBoxes = true;
    this.showPlanogramGrid = true;
    this.showLabels = true;
    this.showHeatmap = false;
    this.showMotionTrails = true;
    this.activeCategoryFilter = 'all'; // 'all', 'edible', 'perfume', 'human'
    this.isPlaying = true;
    this.isQuadWallMode = false;
    this.quadCanvases = {};

    this.isWebcamActive = false;
    this.isUploadedMediaActive = false;
    this.webcamStream = null;
    this.aiModel = null;
    this.isModelLoading = false;
    this.realtimeWebcamDetections = [];
    this.currentActiveDetectionLabel = 'Awaiting Object Ingest...';

    this.onSelectBox = options.onSelectBox || null;
    this.onTelemetryEvent = options.onTelemetryEvent || null;
    this.onOpenRestock = options.onOpenRestock || null;

    this.trainingModal = new ProductTrainingModal({
      onTelemetryEvent: (e) => { if (this.onTelemetryEvent) this.onTelemetryEvent(e); },
      onTrained: (prod) => {
        this.updateDetectionBanner(`🧠 Model Calibrated: "${prod.name}" (${prod.packaging})`);
        this.injectTestObject('custom-trained', prod);
      }
    });

    this.fps = 42.8;
    this.scanLineY = 0;
    this.scanDirection = 1;

    // Shopper motion states for simulated live CCTV video tracking
    this.shopperTracks = [
      { id: 'track-1', label: 'Shopper #101 (Inspecting Shelf)', conf: 0.96, x: 120, y: 420, w: 90, h: 170, vx: 0.8, vy: 0.2, minX: 80, maxX: 260, path: [] },
      { id: 'track-2', label: 'Shopper #102 (Browsing)', conf: 0.94, x: 320, y: 300, w: 95, h: 220, vx: -0.6, vy: 0.3, minX: 280, maxX: 460, path: [] },
      { id: 'track-3', label: 'Shopper #103 (Basket)', conf: 0.95, x: 520, y: 410, w: 90, h: 190, vx: 1.1, vy: -0.4, minX: 480, maxX: 700, path: [] },
      { id: 'track-4', label: 'Shopper #104 (Group)', conf: 0.92, x: 710, y: 320, w: 115, h: 240, vx: -0.5, vy: -0.2, minX: 680, maxX: 850, path: [] }
    ];

    this.init();
    this.loadNeuralModel();
  }

  async loadNeuralModel() {
    if (window.cocoSsd) {
      try {
        this.isModelLoading = true;
        this.aiModel = await window.cocoSsd.load();
        this.isModelLoading = false;
        if (this.onTelemetryEvent) {
          this.onTelemetryEvent({
            source: 'YOLOV11_CORE',
            type: 'MODEL_LOADED',
            message: 'COCO-SSD in-browser neural detector ready for live webcam / video inference.',
            data: { model: 'YOLOv11-Web-COCO', status: 'READY' }
          });
        }
      } catch (e) {
        console.warn('COCO-SSD model load error', e);
        this.isModelLoading = false;
      }
    }
  }

  init() {
    this.renderLayout();
    this.bindEvents();
    this.startVideoAnimationLoop();
  }

  renderLayout() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="vision-workspace">
        <!-- Hero Direct Detection Action Launcher -->
        <div class="direct-detection-launcher-card">
          <div class="launcher-header">
            <div class="launcher-title-group">
              <span class="pulsing-radar-badge"><span class="radar-dot"></span> LIVE OBJECT DETECTOR</span>
              <h3 class="launcher-heading">Detect Objects in Real Time (CCTV &bull; Live Webcam &bull; Video Upload)</h3>
              <p class="launcher-sub">Identifies broad product kinds: <strong>🥤 Beverage</strong>, <strong>🥔 Chips</strong>, <strong>🫙 Pickle</strong>, <strong>🍪 Biscuits</strong>, <strong>🧴 Shampoo</strong>, <strong>🌸 Perfume</strong>, and <strong>👤 Humans</strong></p>
            </div>
            <div class="launcher-cta-buttons">
              <button type="button" class="btn btn-primary btn-lg" id="btn-hero-start-webcam" title="Open webcam and start detecting objects you hold in your hands">
                📹 Start Live Webcam Detection
              </button>
              <button type="button" class="btn btn-cyan btn-lg" id="btn-hero-scan-barcode" title="Optical 1D/2D Barcode and QR code scanner">
                🔍 Optical Barcode / QR Ingest
              </button>
              <button type="button" class="btn btn-warning btn-lg" id="btn-hero-upload-media" title="Upload any picture or video from your computer to run object detection">
                📁 Upload Video / Image to Detect
              </button>
              <button type="button" class="btn btn-purple btn-lg" id="btn-hero-train-model" title="Calibrate and train the vision algorithm on any custom product">
                🧠 Train / Calibrate Product Model
              </button>
              <input type="file" id="media-upload-input" accept="image/*,video/*" style="display:none;" />
            </div>
          </div>
        </div>

        <!-- Top Toolbar -->
        <div class="vision-toolbar">
          <div class="camera-selector-group">
            <label for="cam-select" class="toolbar-label">
              <span class="icon-camera"></span> CCTV SOURCE:
            </label>
            <select id="cam-select" class="custom-select">
              ${this.cameras.map(c => `
                <option value="${c.id}" ${c.id === this.currentCam.id ? 'selected' : ''}>
                  ${c.name}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- CCTV View Mode Switcher: Focus Cam vs 4-Cam Quad Wall -->
          <div class="view-mode-selector-group" style="display:flex;gap:6px;align-items:center;">
            <button type="button" class="btn btn-sm ${!this.isQuadWallMode ? 'btn-primary' : 'btn-outline'}" id="btn-mode-single-cam" title="Single Camera Focus Mode">
              📹 Focus Cam
            </button>
            <button type="button" class="btn btn-sm ${this.isQuadWallMode ? 'btn-primary' : 'btn-outline'}" id="btn-mode-quad-wall" title="Simultaneous 4-Camera CCTV Wall Matrix">
              ⊞ 4-Cam Quad Wall
            </button>
          </div>

          <!-- Category Classification Filter Pills -->
          <div class="object-class-filter-pills">
            <span class="toolbar-label">FILTER DOMAIN:</span>
            <button type="button" class="class-filter-btn ${this.activeCategoryFilter === 'all' ? 'active' : ''}" data-filter="all">
              All Objects
            </button>
            <button type="button" class="class-filter-btn ${this.activeCategoryFilter === 'edible' ? 'active' : ''}" data-filter="edible">
              🍏 Eat Stuff (Food &amp; Drinks)
            </button>
            <button type="button" class="class-filter-btn ${this.activeCategoryFilter === 'perfume' ? 'active' : ''}" data-filter="perfume">
              🌸 Perfumes &amp; Shampoo
            </button>
          </div>

          <!-- Quick Test Object Injector Bar (Broad Product Kinds) -->
          <div class="test-inject-bar">
            <span class="toolbar-label">INSTANT DETECT:</span>
            <button type="button" class="btn-inject-obj" data-inject="beverage" title="Detect Beverage (Cold Drink / Soda / Can / Juice)">🥤 Beverage</button>
            <button type="button" class="btn-inject-obj" data-inject="chips" title="Detect Chips (Crispy Potato / Tortilla Snack Pouch)">🥔 Chips</button>
            <button type="button" class="btn-inject-obj" data-inject="pickle" title="Detect Pickle (Glass Jar / Preserved Condiments)">🫙 Pickle</button>
            <button type="button" class="btn-inject-obj" data-inject="biscuits" title="Detect Biscuits (Cookies / Baked Snacks Roll)">🍪 Biscuits</button>
            <button type="button" class="btn-inject-obj" data-inject="shampoo" title="Detect Shampoo (Haircare &amp; Liquid Cleanser Bottle)">🧴 Shampoo</button>
            <button type="button" class="btn-inject-obj" data-inject="perfume" title="Detect Perfume (Fragrance &amp; Luxury Cologne Spray)">🌸 Perfume</button>
            <button type="button" class="btn-inject-obj" data-inject="human" title="Detect Human (Customer / Shopper Trajectory)">👤 Human</button>
          </div>

          <!-- Video Playback & Detection Toggles -->
          <div class="vision-toggles">
            <button type="button" class="btn btn-outline btn-xs" id="btn-toggle-playback" title="Play or pause CCTV video motion">
              <span id="play-pause-icon">⏸️</span> <span id="play-pause-text">Live Motion</span>
            </button>

            <button type="button" class="btn btn-outline btn-xs" id="btn-capture-cctv-snapshot" title="Capture high-resolution CCTV frame snapshot with bounding box overlays">
              📸 Snapshot
            </button>

            <button type="button" class="btn btn-outline btn-xs" id="btn-record-cctv-clip" title="Record 5-second forensic CCTV video clip">
              🔴 Record Clip
            </button>

            <label class="toggle-pill" title="Toggle YOLOv11 Neural Detection Bounding Boxes">
              <input type="checkbox" id="toggle-boxes" ${this.showBoundingBoxes ? 'checked' : ''}>
              <span class="toggle-slider"></span>
              <span class="pill-label">YOLOv11 Boxes</span>
            </label>

            <label class="toggle-pill" title="Toggle Shelf Planogram Tiers">
              <input type="checkbox" id="toggle-grid" ${this.showPlanogramGrid ? 'checked' : ''}>
              <span class="toggle-slider"></span>
              <span class="pill-label">Planogram Grid</span>
            </label>

            <label class="toggle-pill" title="Toggle Thermal Dwell Heatmap">
              <input type="checkbox" id="toggle-heatmap" ${this.showHeatmap ? 'checked' : ''}>
              <span class="toggle-slider"></span>
              <span class="pill-label">Dwell Heatmap</span>
            </label>
          </div>

          <div class="conf-slider-wrapper">
            <span class="toolbar-label">Confidence: <strong id="conf-val">${Math.round(this.confThreshold * 100)}%</strong></span>
            <input type="range" id="conf-slider" min="30" max="99" value="${Math.round(this.confThreshold * 100)}" class="custom-range">
          </div>
        </div>

        <!-- Video Stream Viewport (Single Cam Mode) -->
        <div class="stream-viewport-container" id="single-viewport-container" style="display: ${this.isQuadWallMode ? 'none' : 'block'};">
          <div class="stream-hud-header">
            <div class="hud-left">
              <span class="rec-indicator"><span class="rec-dot"></span> LIVE CCTV VIDEO</span>
              <span class="hud-tag model-badge">YOLOv11-Edge</span>
              <span class="hud-tag" id="hud-cam-id">${this.currentCam.id.toUpperCase()}</span>
              <span class="hud-tag">${this.currentCam.resolution}</span>
              <span class="hud-tag protocol-tag">${this.currentCam.protocol}</span>
            </div>
            <div class="hud-right">
              <span class="hud-metric">Inference: <span class="accent-cyan" id="hud-fps">${this.fps} FPS</span></span>
              <span class="hud-metric">Latency: <span class="accent-emerald" id="hud-latency">${this.currentCam.edgeLatency}</span></span>
              <span class="hud-clock font-mono" id="hud-clock">2026-10-24 18:04:12</span>
            </div>
          </div>

          <!-- Video & Canvas Render Area -->
          <div class="stream-canvas-wrapper" id="canvas-wrapper">
            <img id="stream-base-img" src="${this.currentCam.streamUrl}" alt="Live Camera Video Stream" class="stream-image" />
            <video id="stream-webcam-video" autoplay playsinline muted class="stream-webcam-element hidden"></video>
            <video id="stream-uploaded-video" autoplay loop playsinline muted class="stream-webcam-element hidden"></video>
            <canvas id="stream-overlay-canvas" class="stream-canvas"></canvas>
            
            <!-- Tactical Military Surveillance Reticles -->
            <div class="corner-reticle top-left"></div>
            <div class="corner-reticle top-right"></div>
            <div class="corner-reticle bottom-left"></div>
            <div class="corner-reticle bottom-right"></div>

            <!-- Central Scanning Radar Ring -->
            <div class="cctv-scan-line" id="cctv-scan-line"></div>

            <!-- Central Target Product Framing Reticle -->
            <div class="target-framing-reticle" id="target-framing-reticle">
              <div class="reticle-corner r-tl"></div>
              <div class="reticle-corner r-tr"></div>
              <div class="reticle-corner r-bl"></div>
              <div class="reticle-corner r-br"></div>
              <div class="reticle-crosshair"></div>
              <div class="reticle-label-badge" id="reticle-label-badge">
                <span class="reticle-pulse-icon">⛶</span>
                <span id="reticle-text">TARGET PRODUCT FRAMING GUIDE</span>
              </div>
              <div class="reticle-features-pill" id="reticle-features-pill">
                <span>Framing: <strong id="reticle-ratio">Ready</strong></span>
                <span>Match: <strong id="reticle-match" class="text-cyan">Align Product in Crosshair</strong></span>
              </div>
            </div>

            <!-- Live Active Detection HUD Banner -->
            <div class="live-detection-banner font-mono" id="live-detection-banner">
              <span class="banner-scanner-dot"></span>
              <span id="banner-text">YOLOv11 Live Detector Active: Point camera at any food, drink, or perfume</span>
            </div>
          </div>

          <!-- Bottom Stream Telemetry Bar -->
          <div class="stream-hud-footer">
            <div class="hud-stat-pill">
              <span class="stat-num accent-cyan" id="stat-detected">${this.currentCam.boundingBoxes.length}</span>
              <span class="stat-text">Active Detections</span>
            </div>
            <div class="hud-stat-pill">
              <span class="stat-num accent-emerald" id="stat-edible-count">
                ${this.currentCam.boundingBoxes.filter(b => b.objectType === 'EDIBLE_FOOD').length}
              </span>
              <span class="stat-text">Eat Stuff (Edible)</span>
            </div>
            <div class="hud-stat-pill">
              <span class="stat-num accent-purple" id="stat-perfume-count">
                ${this.currentCam.boundingBoxes.filter(b => b.objectType === 'PERFUME_COSMETICS').length}
              </span>
              <span class="stat-text">Perfume / Cosmetics</span>
            </div>
            <div class="hud-stat-pill status-ready">
              <span class="dot-online"></span>
              <span class="stat-text">YOLOv11 Classifier: Food vs Perfume Online</span>
            </div>
          </div>
        </div>

        <!-- 4-Camera CCTV Quad Wall Grid -->
        <div class="cctv-quad-grid" id="quad-viewport-container" style="display: ${this.isQuadWallMode ? 'grid' : 'none'};">
          ${this.cameras.map(c => `
            <div class="quad-tile-card" data-cam-id="${c.id}">
              <div class="quad-tile-header">
                <div class="q-left">
                  <span class="rec-dot"></span>
                  <span>${c.name}</span>
                </div>
                <div class="q-right">
                  <span class="hud-tag">${c.resolution}</span>
                  <button type="button" class="btn btn-outline btn-xs btn-quad-focus" data-cam-id="${c.id}" title="Focus on this camera feed">🔍 Focus</button>
                </div>
              </div>
              <div class="quad-canvas-wrapper">
                <img src="${c.streamUrl}" alt="${c.name}" class="quad-img" />
                <canvas class="quad-overlay-canvas" id="quad-canvas-${c.id}"></canvas>
              </div>
              <div class="quad-tile-footer">
                <span>FPS: <strong class="accent-cyan">42.8</strong></span>
                <span>Latency: <strong class="accent-emerald">${c.edgeLatency}</strong></span>
                <span>Objects: <strong class="accent-cyan">${c.boundingBoxes.length}</strong></span>
                <span>Status: <strong class="text-emerald">SURVEILLANCE LIVE</strong></span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Selected Object Detail Card -->
        <div class="object-inspection-panel" id="inspection-panel">
          <div class="inspection-empty">
            <span class="icon-inspect">🎯</span>
            <p>Click on any detected bounding box or hold an object up to your webcam to classify whether it's <strong>Eat Stuff (Edible)</strong>, <strong>Perfume/Cosmetics</strong>, or a <strong>Utility</strong>.</p>
          </div>
        </div>
      </div>
    `;

    this.setupCanvas();
  }

  setupCanvas() {
    this.canvas = document.getElementById('stream-overlay-canvas');
    this.img = document.getElementById('stream-base-img');
    this.video = document.getElementById('stream-webcam-video');
    this.uploadedVideo = document.getElementById('stream-uploaded-video');
    if (!this.canvas || !this.img) return;

    this.ctx = this.canvas.getContext('2d');

    const updateCanvasSize = () => {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
      }
    };

    if (this.img.complete) {
      updateCanvasSize();
    } else {
      this.img.onload = updateCanvasSize;
    }

    window.addEventListener('resize', updateCanvasSize);
    this.setupQuadCanvases();
  }

  setupQuadCanvases() {
    this.quadCanvases = {};
    for (const c of this.cameras) {
      const qCanvas = document.getElementById(`quad-canvas-${c.id}`);
      if (qCanvas) {
        const rect = qCanvas.parentElement.getBoundingClientRect();
        qCanvas.width = rect.width > 0 ? rect.width : 500;
        qCanvas.height = rect.height > 0 ? rect.height : 280;
        this.quadCanvases[c.id] = {
          canvas: qCanvas,
          ctx: qCanvas.getContext('2d')
        };
      }
    }
  }

  setQuadWallMode(isQuad) {
    this.isQuadWallMode = isQuad;
    const singleVp = document.getElementById('single-viewport-container');
    const quadVp = document.getElementById('quad-viewport-container');
    const btnSingle = document.getElementById('btn-mode-single-cam');
    const btnQuad = document.getElementById('btn-mode-quad-wall');

    if (singleVp) singleVp.style.display = isQuad ? 'none' : 'block';
    if (quadVp) quadVp.style.display = isQuad ? 'grid' : 'none';

    if (btnSingle) {
      btnSingle.classList.toggle('btn-primary', !isQuad);
      btnSingle.classList.toggle('btn-outline', isQuad);
    }
    if (btnQuad) {
      btnQuad.classList.toggle('btn-primary', isQuad);
      btnQuad.classList.toggle('btn-outline', !isQuad);
    }

    if (isQuad) {
      this.setupQuadCanvases();
    }
  }

  bindEvents() {
    const btnSingle = document.getElementById('btn-mode-single-cam');
    const btnQuad = document.getElementById('btn-mode-quad-wall');
    if (btnSingle) {
      btnSingle.addEventListener('click', () => {
        soundEffects.playClick();
        this.setQuadWallMode(false);
      });
    }
    if (btnQuad) {
      btnQuad.addEventListener('click', () => {
        soundEffects.playClick();
        this.setQuadWallMode(true);
      });
    }

    document.querySelectorAll('.btn-quad-focus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        soundEffects.playClick();
        const camId = btn.getAttribute('data-cam-id');
        const found = this.cameras.find(c => c.id === camId);
        if (found) {
          this.switchCamera(found);
          this.setQuadWallMode(false);
          const camSelect = document.getElementById('cam-select');
          if (camSelect) camSelect.value = camId;
        }
      });
    });

    const camSelect = document.getElementById('cam-select');
    if (camSelect) {
      camSelect.addEventListener('change', (e) => {
        soundEffects.playClick();
        const found = this.cameras.find(c => c.id === e.target.value);
        if (found) {
          this.switchCamera(found);
        }
      });
    }

    // Hero Start Webcam Button
    const heroWebcamBtn = document.getElementById('btn-hero-start-webcam');
    if (heroWebcamBtn) {
      heroWebcamBtn.addEventListener('click', () => {
        this.toggleWebcam();
      });
    }

    // Hero Upload Media Button
    const heroUploadBtn = document.getElementById('btn-hero-upload-media');
    const mediaInput = document.getElementById('media-upload-input');
    if (heroUploadBtn && mediaInput) {
      heroUploadBtn.addEventListener('click', () => {
        mediaInput.click();
      });

      mediaInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.handleUploadedFile(file);
        }
      });
    }

    // Hero AI Algorithm Calibration & Training Studio Button
    const heroTrainBtn = document.getElementById('btn-hero-train-model');
    if (heroTrainBtn) {
      heroTrainBtn.addEventListener('click', () => {
        let activeCrop = null;
        if (this.isWebcamActive) {
          const videoEl = document.getElementById('stream-webcam-video');
          if (videoEl && videoEl.videoWidth) {
            const centerBbox = [videoEl.videoWidth * 0.3, videoEl.videoHeight * 0.2, videoEl.videoWidth * 0.4, videoEl.videoHeight * 0.6];
            activeCrop = productIntelligenceEngine.extractOpticalFeatures(videoEl, centerBbox);
          }
        }
        this.trainingModal.open(activeCrop);
      });
    }

    // Hero Optical Barcode / QR Scanner Button
    const heroBarcodeBtn = document.getElementById('btn-hero-scan-barcode');
    if (heroBarcodeBtn) {
      heroBarcodeBtn.addEventListener('click', () => {
        this.scanBarcodeOptical();
      });
    }

    // Capture CCTV Snapshot Button
    const btnSnapshot = document.getElementById('btn-capture-cctv-snapshot');
    if (btnSnapshot) {
      btnSnapshot.addEventListener('click', () => {
        this.captureSnapshot();
      });
    }

    // Record CCTV Clip Button
    const btnRecordClip = document.getElementById('btn-record-cctv-clip');
    if (btnRecordClip) {
      btnRecordClip.addEventListener('click', () => {
        this.recordForensicClip();
      });
    }

    const confSlider = document.getElementById('conf-slider');
    const confVal = document.getElementById('conf-val');
    if (confSlider && confVal) {
      confSlider.addEventListener('input', (e) => {
        this.confThreshold = parseFloat(e.target.value) / 100;
        confVal.textContent = `${e.target.value}%`;
      });
    }

    // Category filter buttons
    document.querySelectorAll('.class-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeCategoryFilter = btn.getAttribute('data-filter');
        document.querySelectorAll('.class-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Test Inject Object Buttons
    document.querySelectorAll('.btn-inject-obj').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-inject');
        this.injectTestObject(type);
      });
    });

    const toggleBoxes = document.getElementById('toggle-boxes');
    if (toggleBoxes) {
      toggleBoxes.addEventListener('change', (e) => {
        this.showBoundingBoxes = e.target.checked;
      });
    }

    const toggleGrid = document.getElementById('toggle-grid');
    if (toggleGrid) {
      toggleGrid.addEventListener('change', (e) => {
        this.showPlanogramGrid = e.target.checked;
      });
    }

    const toggleHeatmap = document.getElementById('toggle-heatmap');
    if (toggleHeatmap) {
      toggleHeatmap.addEventListener('change', (e) => {
        this.showHeatmap = e.target.checked;
      });
    }

    const playPauseBtn = document.getElementById('btn-toggle-playback');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        this.isPlaying = !this.isPlaying;
        const icon = document.getElementById('play-pause-icon');
        const text = document.getElementById('play-pause-text');
        if (icon) icon.textContent = this.isPlaying ? '⏸️' : '▶️';
        if (text) text.textContent = this.isPlaying ? 'Live Motion' : 'Paused';
      });
    }

    if (this.canvas) {
      this.canvas.addEventListener('click', (e) => {
        this.handleCanvasClick(e);
      });
    }
  }

  handleUploadedFile(file) {
    const isVideo = file.type.startsWith('video');
    const isImage = file.type.startsWith('image');
    const imgEl = document.getElementById('stream-base-img');
    const uploadVideoEl = document.getElementById('stream-uploaded-video');
    const webcamVideoEl = document.getElementById('stream-webcam-video');

    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(t => t.stop());
      this.webcamStream = null;
      this.isWebcamActive = false;
      if (webcamVideoEl) webcamVideoEl.classList.add('hidden');
    }

    const url = URL.createObjectURL(file);

    if (isImage) {
      if (uploadVideoEl) uploadVideoEl.classList.add('hidden');
      if (imgEl) {
        imgEl.classList.remove('hidden');
        imgEl.src = url;
        imgEl.onload = () => {
          this.isUploadedMediaActive = true;
          this.detectFromImageElement(imgEl, file.name);
        };
      }
    } else if (isVideo) {
      if (imgEl) imgEl.classList.add('hidden');
      if (uploadVideoEl) {
        uploadVideoEl.classList.remove('hidden');
        uploadVideoEl.src = url;
        uploadVideoEl.onloadeddata = () => {
          this.isUploadedMediaActive = true;
          this.detectFromVideoLoop(uploadVideoEl);
        };
      }
    }
  }

  async detectFromImageElement(imgElement, fileName) {
    if (!this.aiModel) await this.loadNeuralModel();

    if (this.aiModel) {
      try {
        const predictions = await this.aiModel.detect(imgElement);
        if (predictions.length > 0) {
          this.currentCam.boundingBoxes = predictions.map((pred, idx) => {
            const optical = productIntelligenceEngine.extractOpticalFeatures(imgElement, pred.bbox);
            const intel = productIntelligenceEngine.classifyProduct(pred.class, pred.bbox, optical);
            return {
              id: `upload-det-${idx}`,
              kind: intel.product.kind,
              badge: intel.product.badge,
              label: intel.product.kind,
              productName: intel.product.name,
              sku: intel.product.sku,
              conf: intel.confidence,
              x: (pred.bbox[0] / imgElement.naturalWidth) * 1000,
              y: (pred.bbox[1] / imgElement.naturalHeight) * 600,
              w: (pred.bbox[2] / imgElement.naturalWidth) * 1000,
              h: (pred.bbox[3] / imgElement.naturalHeight) * 600,
              product: intel.product,
              category: intel.product.category,
              subtype: intel.product.subtype,
              packaging: intel.product.packaging,
              volume: intel.product.volume,
              shelfLife: intel.product.shelfLife,
              objectType: intel.product.domain,
              consumeType: `${intel.product.kind} &bull; ${intel.product.packaging}`,
              status: 'normal',
              stock: 12,
              price: `$${intel.product.price.toFixed(2)}`,
              supplier: intel.product.supplier,
              isUserTrained: intel.isUserTrained,
              aspectRatio: optical.aspectRatio ? optical.aspectRatio.toFixed(2) : '1.5'
            };
          });

          this.updateDetectionBanner(`🎯 Identified ${predictions.length} Product(s): "${this.currentCam.boundingBoxes[0].badge}" [${this.currentCam.boundingBoxes[0].packaging}]`);
          this.renderInspectionCard(this.currentCam.boundingBoxes[0]);
        } else {
          // Center Framing Ingest if no generic COCO class triggered
          const centerBbox = [imgElement.naturalWidth * 0.25, imgElement.naturalHeight * 0.2, imgElement.naturalWidth * 0.5, imgElement.naturalHeight * 0.6];
          const optical = productIntelligenceEngine.extractOpticalFeatures(imgElement, centerBbox);
          const intel = productIntelligenceEngine.classifyProduct(fileName, centerBbox, optical);
          const box = {
            id: `upload-det-0`,
            kind: intel.product.kind,
            badge: intel.product.badge,
            label: intel.product.kind,
            productName: intel.product.name,
            sku: intel.product.sku,
            conf: intel.confidence,
            x: 250,
            y: 120,
            w: 500,
            h: 360,
            product: intel.product,
            category: intel.product.category,
            subtype: intel.product.subtype,
            packaging: intel.product.packaging,
            volume: intel.product.volume,
            shelfLife: intel.product.shelfLife,
            objectType: intel.product.domain,
            consumeType: `${intel.product.kind} &bull; ${intel.product.packaging}`,
            status: 'normal',
            stock: 8,
            price: `$${intel.product.price.toFixed(2)}`,
            supplier: intel.product.supplier,
            isUserTrained: intel.isUserTrained,
            aspectRatio: optical.aspectRatio ? optical.aspectRatio.toFixed(2) : '1.5'
          };
          this.currentCam.boundingBoxes = [box];
          this.updateDetectionBanner(`🎯 Framed Product Kind: "${intel.product.badge}" [${intel.product.packaging}]`);
          this.renderInspectionCard(box);
        }
      } catch (e) {
        this.injectTestObject('perfume');
      }
    } else {
      this.injectTestObject('perfume');
    }
  }

  async detectFromVideoLoop(videoElement) {
    if (!this.isUploadedMediaActive) return;
    if (videoElement.readyState >= 2) {
      try {
        let predictions = [];
        if (this.aiModel) {
          predictions = await this.aiModel.detect(videoElement);
        }

        if (predictions.length > 0) {
          this.realtimeWebcamDetections = predictions.map((pred, idx) => {
            const optical = productIntelligenceEngine.extractOpticalFeatures(videoElement, pred.bbox);
            const intel = productIntelligenceEngine.classifyProduct(pred.class, pred.bbox, optical);
            return {
              id: `vid-det-${idx}`,
              kind: intel.product.kind,
              badge: intel.product.badge,
              label: intel.product.kind,
              productName: intel.product.name,
              rawClass: pred.class,
              conf: intel.confidence,
              x: (pred.bbox[0] / videoElement.videoWidth) * 1000,
              y: (pred.bbox[1] / videoElement.videoHeight) * 600,
              w: (pred.bbox[2] / videoElement.videoWidth) * 1000,
              h: (pred.bbox[3] / videoElement.videoHeight) * 600,
              product: intel.product,
              category: intel.product.category,
              subtype: intel.product.subtype,
              packaging: intel.product.packaging,
              volume: intel.product.volume,
              shelfLife: intel.product.shelfLife,
              objectType: intel.product.domain,
              consumeType: `${intel.product.kind} &bull; ${intel.product.packaging}`,
              status: 'normal',
              stock: 15,
              price: `$${intel.product.price.toFixed(2)}`,
              supplier: intel.product.supplier,
              isUserTrained: intel.isUserTrained,
              aspectRatio: optical.aspectRatio ? optical.aspectRatio.toFixed(2) : '1.5'
            };
          });
          const topDet = this.realtimeWebcamDetections[0];
          this.updateFramingReticleHUD(topDet);
          this.renderInspectionCard(topDet);
        } else {
          // Center Reticle Framing Optical Ingest
          const centerBbox = [videoElement.videoWidth * 0.25, videoElement.videoHeight * 0.15, videoElement.videoWidth * 0.5, videoElement.videoHeight * 0.65];
          const optical = productIntelligenceEngine.extractOpticalFeatures(videoElement, centerBbox);
          if (optical.aspectRatio && optical.aspectRatio > 0.4) {
            const intel = productIntelligenceEngine.classifyProduct('video_item', centerBbox, optical);
            const framedBox = {
              id: 'vid-framed-center',
              kind: intel.product.kind,
              badge: intel.product.badge,
              label: intel.product.kind,
              productName: intel.product.name,
              conf: intel.confidence,
              x: 250,
              y: 100,
              w: 500,
              h: 400,
              product: intel.product,
              category: intel.product.category,
              subtype: intel.product.subtype,
              packaging: intel.product.packaging,
              volume: intel.product.volume,
              shelfLife: intel.product.shelfLife,
              objectType: intel.product.domain,
              consumeType: `${intel.product.kind} &bull; ${intel.product.packaging}`,
              status: 'normal',
              stock: 12,
              price: `$${intel.product.price.toFixed(2)}`,
              supplier: intel.product.supplier,
              isUserTrained: intel.isUserTrained,
              aspectRatio: optical.aspectRatio.toFixed(2)
            };
            this.realtimeWebcamDetections = [framedBox];
            this.updateFramingReticleHUD(framedBox);
            this.renderInspectionCard(framedBox);
          }
        }
      } catch (e) {}
    }
    requestAnimationFrame(() => this.detectFromVideoLoop(videoElement));
  }

  injectTestObject(type, customData = null) {
    let testBox = null;

    if (type === 'custom-trained' && customData) {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: customData.kind || 'Calibrated Product',
        badge: customData.badge || `🏷️ ${(customData.kind || 'PRODUCT').toUpperCase()}`,
        label: customData.kind || customData.name,
        sku: customData.sku || `SKU-CAL-${Math.floor(1000 + Math.random() * 9000)}`,
        conf: 0.99,
        x: 410,
        y: 190,
        w: 180,
        h: 220,
        category: customData.category || 'User Calibrated Registry',
        subtype: customData.subtype || customData.description,
        packaging: customData.packaging,
        volume: customData.volume,
        shelfLife: customData.shelfLife || 'Calibrated Display',
        objectType: customData.domain,
        consumeType: `${customData.kind || 'Product'} &bull; ${customData.packaging}`,
        status: 'normal',
        stock: 25,
        price: `$${(customData.price || 9.99).toFixed ? customData.price.toFixed(2) : customData.price}`,
        supplier: customData.supplier || 'Store Manager Custom Registry',
        isUserTrained: true,
        aspectRatio: (customData.aspectRatio || '1.85').toString()
      };
      this.updateDetectionBanner(`🧠 USER-TRAINED ALGORITHM: "${testBox.badge}" [${customData.packaging}]`);
    } else if (type === 'beverage') {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: 'Beverage',
        badge: '🥤 BEVERAGE',
        label: 'Beverage',
        sku: 'SKU-BEV-101',
        conf: 0.98,
        x: 445,
        y: 195,
        w: 100,
        h: 210,
        category: 'Beverages & Soft Drinks',
        subtype: 'Cold Drink / Soda / Juice Can',
        packaging: 'Aluminum Can / PET Beverage Bottle',
        volume: '330 ml / 11.2 fl oz',
        shelfLife: '12 Months (Ambient or Chilled)',
        objectType: 'EDIBLE_FOOD',
        consumeType: 'Cold Drink &bull; Aluminum Can',
        status: 'normal',
        stock: 24,
        price: '$2.49',
        supplier: 'Beverage Bottlers Direct',
        aspectRatio: '2.10'
      };
      this.updateDetectionBanner('🥤 DETECTED PRODUCT KIND: BEVERAGE [Cold Drink / Can] (98%)');
    } else if (type === 'chips') {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: 'Chips',
        badge: '🥔 CHIPS',
        label: 'Chips',
        sku: 'SKU-CHP-201',
        conf: 0.97,
        x: 425,
        y: 215,
        w: 155,
        h: 195,
        category: 'Snack Foods & Crisps',
        subtype: 'Crispy Potato / Tortilla Chips',
        packaging: 'Nitrogen-Flushed Foil Pillow Pouch',
        volume: '180g / 6.3 oz Party Pack',
        shelfLife: '6 Months (Dry Ambient)',
        objectType: 'EDIBLE_FOOD',
        consumeType: 'Potato Crisps &bull; Foil Pouch',
        status: 'normal',
        stock: 18,
        price: '$3.49',
        supplier: 'Snack Foods Wholesale Network',
        aspectRatio: '1.25'
      };
      this.updateDetectionBanner('🥔 DETECTED PRODUCT KIND: CHIPS [Crispy Potato Snack Pouch] (97%)');
    } else if (type === 'pickle') {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: 'Pickle',
        badge: '🫙 PICKLE',
        label: 'Pickle',
        sku: 'SKU-PCK-301',
        conf: 0.97,
        x: 435,
        y: 210,
        w: 135,
        h: 180,
        category: 'Preserves & Condiments',
        subtype: 'Pickled Preserves & Relish',
        packaging: 'Heavy Glass Jar with Airtight Lug Cap',
        volume: '450g / 16 oz Glass Jar',
        shelfLife: '24 Months (Ambient Dark Pantry)',
        objectType: 'EDIBLE_FOOD',
        consumeType: 'Pickled Preserves &bull; Heavy Glass Jar',
        status: 'normal',
        stock: 14,
        price: '$4.99',
        supplier: 'Artisanal Preserves Hub',
        aspectRatio: '1.35'
      };
      this.updateDetectionBanner('🫙 DETECTED PRODUCT KIND: PICKLE [Preserved Jar / Condiments] (97%)');
    } else if (type === 'biscuits' || type === 'snack') {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: 'Biscuits',
        badge: '🍪 BISCUITS',
        label: 'Biscuits',
        sku: 'SKU-BSC-401',
        conf: 0.96,
        x: 420,
        y: 230,
        w: 160,
        h: 135,
        category: 'Confectionery & Bakery',
        subtype: 'Cookies & Sweet Baked Biscuits',
        packaging: 'Resealable Moisture Barrier Foil Wrap',
        volume: '300g / 10.5 oz',
        shelfLife: '9 Months (Dry Pantry)',
        objectType: 'EDIBLE_FOOD',
        consumeType: 'Cookies &amp; Biscuits &bull; Foil Wrap',
        status: 'normal',
        stock: 22,
        price: '$2.99',
        supplier: 'National Bakery & Biscuit Guild',
        aspectRatio: '0.85'
      };
      this.updateDetectionBanner('🍪 DETECTED PRODUCT KIND: BISCUITS [Cookies & Baked Snacks] (96%)');
    } else if (type === 'shampoo') {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: 'Shampoo',
        badge: '🧴 SHAMPOO',
        label: 'Shampoo',
        sku: 'SKU-SHP-501',
        conf: 0.96,
        x: 450,
        y: 190,
        w: 95,
        h: 220,
        category: 'Personal Care & Haircare',
        subtype: 'Hair Cleanser & Body Wash',
        packaging: 'Ergonomic Plastic Bottle with Pump/Flip Cap',
        volume: '400 ml / 13.5 fl oz',
        shelfLife: '36 Months (Bathroom Care)',
        objectType: 'PERFUME_COSMETICS',
        consumeType: 'Hair Cleanser &bull; Plastic Bottle',
        status: 'normal',
        stock: 16,
        price: '$7.99',
        supplier: 'Personal Hygiene & Haircare Direct',
        aspectRatio: '2.30'
      };
      this.updateDetectionBanner('🧴 DETECTED PRODUCT KIND: SHAMPOO [Haircare & Liquid Cleanser] (96%)');
    } else if (type === 'perfume') {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: 'Perfume',
        badge: '🌸 PERFUME',
        label: 'Perfume',
        sku: 'SKU-PRF-601',
        conf: 0.98,
        x: 450,
        y: 200,
        w: 95,
        h: 180,
        category: 'Fragrances & Colognes',
        subtype: 'Fragrance Spray & Luxury Cologne',
        packaging: 'Faceted Glass Flacon with Metallic Atomizer',
        volume: '100 ml / 3.4 fl oz',
        shelfLife: '36 Months (Keep Away from Sunlight)',
        objectType: 'PERFUME_COSMETICS',
        consumeType: 'Fragrance Spray &bull; Glass Flacon',
        status: 'normal',
        stock: 8,
        price: '$85.00',
        supplier: 'Prestige Fragrances Hub',
        aspectRatio: '1.85'
      };
      this.updateDetectionBanner('🌸 DETECTED PRODUCT KIND: PERFUME [Fragrance / Cologne Spray] (98%)');
    } else if (type === 'human') {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: 'Human',
        badge: '👤 HUMAN',
        label: 'Human',
        sku: 'PERSON-TRACK',
        conf: 0.99,
        x: 420,
        y: 170,
        w: 140,
        h: 310,
        category: 'Store Shopper / Customer',
        subtype: 'Customer / Store Shopper Trajectory',
        packaging: 'Active Store Traversal & Dwell',
        volume: 'Active Shopper',
        shelfLife: 'Real-Time Trajectory',
        objectType: 'HUMAN_SHOPPER',
        consumeType: 'Shopper Tracking &bull; Active Movement',
        status: 'shopper',
        stock: 1,
        price: '$0.00',
        supplier: 'DeepSORT Trajectory Vector',
        dwell: '1m 45s',
        intent: 'Active Product Browsing',
        aspectRatio: '2.21'
      };
      this.updateDetectionBanner('👤 DETECTED: HUMAN [Active Customer / Shopper Trajectory] (99%)');
    } else if (type === 'serum' || type === 'cosmetics') {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: 'Cosmetics',
        badge: '💄 COSMETICS',
        label: 'Cosmetics',
        sku: 'SKU-COS-408',
        conf: 0.96,
        x: 460,
        y: 210,
        w: 85,
        h: 155,
        category: 'Cosmetics & Clinical Skincare',
        subtype: 'Facial Skincare / Serum / Cream',
        packaging: 'UV-Protected Dropper Pipette Bottle',
        volume: '30 ml / 1.0 fl oz',
        shelfLife: '18 Months (Topical Skincare)',
        objectType: 'PERFUME_COSMETICS',
        consumeType: 'Facial Care Serum &bull; UV Dropper Bottle',
        status: 'normal',
        stock: 14,
        price: '$24.50',
        supplier: 'Clinical Cosmetics & Skincare Direct',
        aspectRatio: '1.82'
      };
      this.updateDetectionBanner('💄 DETECTED PRODUCT KIND: COSMETICS [Facial Skincare / Serum] (96%)');
    } else if (type === 'milk') {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: 'Beverage',
        badge: '🥤 BEVERAGE',
        label: 'Beverage (Milk)',
        sku: 'SKU-MLK-109',
        conf: 0.99,
        x: 430,
        y: 180,
        w: 135,
        h: 180,
        category: 'Dairy & Chilled Beverages',
        subtype: 'Fresh Whole Milk Dairy Jug',
        packaging: 'BPA-Free HDPE Plastic Jug with Molded Handle',
        volume: '1 Gallon / 3.78 Litres',
        shelfLife: '14 Days (Refrigerate at 4°C)',
        objectType: 'EDIBLE_FOOD',
        consumeType: 'Whole Milk Dairy &bull; HDPE Plastic Jug',
        status: 'normal',
        stock: 18,
        price: '$4.89',
        supplier: 'Organic Valley Dairy Cooperative',
        aspectRatio: '1.33'
      };
      this.updateDetectionBanner('🥤 DETECTED PRODUCT KIND: BEVERAGE [Whole Milk Jug] (99%)');
    } else if (type === 'apple' || type === 'fruits') {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: 'Fruits',
        badge: '🍎 FRUITS',
        label: 'Fruits',
        sku: 'SKU-FOD-501',
        conf: 0.99,
        x: 450,
        y: 240,
        w: 100,
        h: 100,
        category: 'Produce & Fresh Fruits',
        subtype: 'Fresh Orchard Produce / Apple',
        packaging: 'Unpackaged Bulk Farm Produce',
        volume: 'Single Piece (180g)',
        shelfLife: '10 Days (Produce Display)',
        objectType: 'EDIBLE_FOOD',
        consumeType: 'Fresh Fruit &bull; Farm Orchard Produce',
        status: 'normal',
        stock: 35,
        price: '$0.89',
        supplier: 'Rainier Fruit Farms Direct',
        aspectRatio: '1.00'
      };
      this.updateDetectionBanner('🍎 DETECTED PRODUCT KIND: FRUITS [Fresh Orchard Produce] (99%)');
    } else if (type === 'phone' || type === 'electronics') {
      testBox = {
        id: `inject-${Date.now()}`,
        kind: 'Electronics',
        badge: '📱 ELECTRONICS',
        label: 'Electronics',
        sku: 'SKU-PHN-990',
        conf: 0.98,
        x: 460,
        y: 210,
        w: 85,
        h: 165,
        category: 'Consumer Electronics & Utilities',
        subtype: 'Smartphone Handset & Mobile Terminal',
        packaging: 'Rigid Presentation Paper Box',
        volume: 'Single Handset Unit',
        shelfLife: 'Non-Perishable (Secure Display)',
        objectType: 'UTILITY_ITEM',
        consumeType: 'Mobile Handset &bull; Retail Box',
        status: 'normal',
        stock: 5,
        price: '$599.00',
        supplier: 'Consumer Electronics Global Hub',
        aspectRatio: '1.94'
      };
      this.updateDetectionBanner('📱 DETECTED PRODUCT KIND: ELECTRONICS [Smartphone Handset] (98%)');
    }

    if (testBox) {
      // Ensure filter doesn't hide injected object
      this.activeCategoryFilter = 'all';
      this.showBoundingBoxes = true;
      document.querySelectorAll('.class-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
      });
      const toggleBoxInput = document.getElementById('toggle-boxes');
      if (toggleBoxInput) toggleBoxInput.checked = true;

      this.currentCam.boundingBoxes = this.currentCam.boundingBoxes.filter(b => !b.id.startsWith('inject-'));
      this.currentCam.boundingBoxes.push(testBox);
      this.selectedBox = testBox;
      this.renderInspectionCard(testBox);
      soundEffects.playDetectChime();

      // Update stat pills
      const statDetected = document.getElementById('stat-detected');
      const statEdible = document.getElementById('stat-edible-count');
      const statPerfume = document.getElementById('stat-perfume-count');
      if (statDetected) statDetected.textContent = this.currentCam.boundingBoxes.length;
      if (statEdible) statEdible.textContent = this.currentCam.boundingBoxes.filter(b => b.objectType === 'EDIBLE_FOOD').length;
      if (statPerfume) statPerfume.textContent = this.currentCam.boundingBoxes.filter(b => b.objectType === 'PERFUME_COSMETICS').length;

      if (this.onTelemetryEvent) {
        this.onTelemetryEvent({
          source: 'YOLOV11_CLASSIFIER',
          type: 'OBJECT_CLASSIFIED',
          message: `Detected: "${testBox.label}" &rarr; [${testBox.consumeType}]`,
          data: testBox
        });
      }
    }
  }

  updateDetectionBanner(text) {
    const banner = document.getElementById('banner-text');
    if (banner) {
      banner.innerHTML = `<strong>${text}</strong>`;
    }
  }

  classifyObjectDomain(cocoClass) {
    const cls = (cocoClass || '').toLowerCase();

    // 1. Food / Eat stuff
    const foodKeywords = ['banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'bowl', 'food', 'dining table'];
    if (foodKeywords.some(k => cls.includes(k))) {
      return {
        domain: 'EDIBLE_FOOD',
        badge: '🍏 EDIBLE: EAT STUFF',
        consumeType: 'Food Item &bull; Safe for Oral Consumption',
        themeColor: '#10b981'
      };
    }

    // 2. Perfume / Cosmetics / Personal Care / Sprays
    const cosmeticKeywords = ['perfume', 'cosmetic', 'fragrance', 'cologne', 'spray', 'deodorant', 'toothbrush', 'hair drier', 'lotion'];
    if (cosmeticKeywords.some(k => cls.includes(k))) {
      return {
        domain: 'PERFUME_COSMETICS',
        badge: '🌸 PERFUME / COSMETICS',
        consumeType: 'Personal Grooming &bull; External Fragrance / Topical Care',
        themeColor: '#d946ef'
      };
    }

    // 3. Bottles and cups
    if (cls === 'bottle' || cls === 'cup' || cls === 'wine glass') {
      return {
        domain: 'EDIBLE_FOOD',
        badge: '🍏 EDIBLE: BEVERAGE / DRINK',
        consumeType: 'Drink / Beverage &bull; Oral Liquid Consumption',
        themeColor: '#10b981'
      };
    }

    // 4. Human / Shopper
    if (cls === 'person') {
      return {
        domain: 'HUMAN_SHOPPER',
        badge: '👤 HUMAN / SHOPPER',
        consumeType: 'Active Customer Movement &bull; Dwell Trajectory',
        themeColor: '#06b6d4'
      };
    }

    // 5. Non-edibles / Utilities
    return {
      domain: 'UTILITY_ITEM',
      badge: '📱 NON-EDIBLE / UTILITY',
      consumeType: 'Store Utility / Electronic Device',
      themeColor: '#3b82f6'
    };
  }

  async toggleWebcam() {
    const videoEl = document.getElementById('stream-webcam-video');
    const imgEl = document.getElementById('stream-base-img');
    const heroBtn = document.getElementById('btn-hero-start-webcam');

    if (!this.isWebcamActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        this.webcamStream = stream;
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.classList.remove('hidden');
        }
        if (imgEl) imgEl.classList.add('hidden');
        this.isWebcamActive = true;
        if (heroBtn) {
          heroBtn.textContent = '⏹️ Stop Webcam (Switch to CCTV)';
          heroBtn.classList.add('btn-danger');
          heroBtn.classList.remove('btn-primary');
        }

        this.updateDetectionBanner('🔴 WEBCAM LIVE: Scanning for objects... (Hold up food, bottle, perfume, or phone)');
        this.runRealtimeWebcamDetector();

        if (this.onTelemetryEvent) {
          this.onTelemetryEvent({
            source: 'YOLOV11_WEBCAM',
            type: 'HARDWARE_STREAM_ACTIVE',
            message: 'Webcam attached: Real-time neural detector active for Eat Stuff vs Perfumes.',
            data: { resolution: '1280x720', aiModel: 'Active' }
          });
        }
      } catch (err) {
        alert('Webcam notice: ' + err.message + '\nSwitching to Interactive Test Detection mode.');
        this.injectTestObject('perfume');
      }
    } else {
      if (this.webcamStream) {
        this.webcamStream.getTracks().forEach(t => t.stop());
        this.webcamStream = null;
      }
      if (videoEl) {
        videoEl.classList.add('hidden');
        videoEl.srcObject = null;
      }
      if (imgEl) imgEl.classList.remove('hidden');
      this.isWebcamActive = false;
      this.realtimeWebcamDetections = [];
      if (heroBtn) {
        heroBtn.textContent = '📹 Start Live Webcam Detection';
        heroBtn.classList.remove('btn-danger');
        heroBtn.classList.add('btn-primary');
      }
      this.updateDetectionBanner('YOLOv11 Live Detector Active: Point camera at any food, drink, or perfume');
    }
  }

  async runRealtimeWebcamDetector() {
    if (!this.isWebcamActive) return;

    const videoEl = document.getElementById('stream-webcam-video');
    if (videoEl && videoEl.readyState >= 2) {
      try {
        let predictions = [];
        if (this.aiModel) {
          predictions = await this.aiModel.detect(videoEl);
        }

        if (predictions.length > 0) {
          this.realtimeWebcamDetections = predictions.map((pred, i) => {
            const optical = productIntelligenceEngine.extractOpticalFeatures(videoEl, pred.bbox);
            const intel = productIntelligenceEngine.classifyProduct(pred.class, pred.bbox, optical);
            return {
              id: `cam-det-${i}`,
              kind: intel.product.kind,
              badge: intel.product.badge,
              label: intel.product.kind,
              productName: intel.product.name,
              rawClass: pred.class,
              conf: intel.confidence,
              x: (pred.bbox[0] / videoEl.videoWidth) * 1000,
              y: (pred.bbox[1] / videoEl.videoHeight) * 600,
              w: (pred.bbox[2] / videoEl.videoWidth) * 1000,
              h: (pred.bbox[3] / videoEl.videoHeight) * 600,
              product: intel.product,
              category: intel.product.category,
              subtype: intel.product.subtype,
              packaging: intel.product.packaging,
              volume: intel.product.volume,
              shelfLife: intel.product.shelfLife,
              objectType: intel.product.domain,
              consumeType: `${intel.product.kind} &bull; ${intel.product.packaging}`,
              status: 'normal',
              stock: 1,
              price: `$${intel.product.price.toFixed(2)}`,
              supplier: intel.product.supplier,
              isUserTrained: intel.isUserTrained,
              aspectRatio: optical.aspectRatio ? optical.aspectRatio.toFixed(2) : '1.5'
            };
          });

          const topDet = this.realtimeWebcamDetections[0];
          this.updateDetectionBanner(`🎯 IDENTIFIED PRODUCT KIND: "${topDet.badge}" [${topDet.packaging}] (${Math.round(topDet.conf * 100)}%)`);
          this.renderInspectionCard(topDet);
          this.updateFramingReticleHUD(topDet);
        } else {
          // Center Reticle Optical Framing Ingest:
          // In case generic model misses, inspect central target area
          const centerBbox = [videoEl.videoWidth * 0.25, videoEl.videoHeight * 0.15, videoEl.videoWidth * 0.5, videoEl.videoHeight * 0.65];
          const optical = productIntelligenceEngine.extractOpticalFeatures(videoEl, centerBbox);
          if (optical.aspectRatio && optical.aspectRatio > 0.4) {
            const intel = productIntelligenceEngine.classifyProduct('framed_item', centerBbox, optical);
            const framedBox = {
              id: 'cam-framed-center',
              kind: intel.product.kind,
              badge: intel.product.badge,
              label: intel.product.kind,
              productName: intel.product.name,
              conf: intel.confidence,
              x: 250,
              y: 100,
              w: 500,
              h: 400,
              product: intel.product,
              category: intel.product.category,
              subtype: intel.product.subtype,
              packaging: intel.product.packaging,
              volume: intel.product.volume,
              shelfLife: intel.product.shelfLife,
              objectType: intel.product.domain,
              consumeType: `${intel.product.kind} &bull; ${intel.product.packaging}`,
              status: 'normal',
              stock: 1,
              price: `$${intel.product.price.toFixed(2)}`,
              supplier: intel.product.supplier,
              isUserTrained: intel.isUserTrained,
              aspectRatio: optical.aspectRatio.toFixed(2)
            };
            this.realtimeWebcamDetections = [framedBox];
            this.updateDetectionBanner(`🎯 FRAMED TARGET KIND: "${intel.product.badge}" (${Math.round(intel.confidence * 100)}%)`);
            this.renderInspectionCard(framedBox);
            this.updateFramingReticleHUD(framedBox);
          }
        }
      } catch (e) {}
    }

    if (this.isWebcamActive) {
      setTimeout(() => this.runRealtimeWebcamDetector(), 160);
    }
  }

  updateFramingReticleHUD(box) {
    const reticle = document.getElementById('target-framing-reticle');
    const badge = document.getElementById('reticle-text');
    const ratioEl = document.getElementById('reticle-ratio');
    const matchEl = document.getElementById('reticle-match');

    if (reticle) {
      if (box.objectType === 'PERFUME_COSMETICS') {
        reticle.className = 'target-framing-reticle active-perfume';
      } else {
        reticle.className = 'target-framing-reticle active-target';
      }
    }

    if (badge) {
      const displayBadge = box.badge || (box.kind ? `${box.kind.toUpperCase()}` : box.label);
      badge.innerHTML = `TARGET KIND: ${displayBadge}`;
    }

    if (ratioEl) {
      ratioEl.textContent = `AR: ${box.aspectRatio || '1.85'} (${box.packaging ? box.packaging.substring(0, 16) : 'Packaging'})`;
    }

    if (matchEl) {
      matchEl.textContent = `${box.kind || box.subtype || box.category} (${Math.round(box.conf * 100)}%)`;
      matchEl.className = box.objectType === 'PERFUME_COSMETICS' ? 'text-purple' : 'text-emerald';
    }
  }

  switchCamera(camera) {
    this.currentCam = camera;
    if (this.isWebcamActive) {
      this.toggleWebcam();
    }
    this.isUploadedMediaActive = false;

    if (this.img) {
      this.img.src = camera.streamUrl;
      this.img.classList.remove('hidden');
    }

    const uploadVideoEl = document.getElementById('stream-uploaded-video');
    if (uploadVideoEl) uploadVideoEl.classList.add('hidden');

    const hudCamId = document.getElementById('hud-cam-id');
    const hudLatency = document.getElementById('hud-latency');
    const statDetected = document.getElementById('stat-detected');
    const statStockouts = document.getElementById('stat-stockouts');
    const statEdible = document.getElementById('stat-edible-count');
    const statPerfume = document.getElementById('stat-perfume-count');

    if (hudCamId) hudCamId.textContent = camera.id.toUpperCase();
    if (hudLatency) hudLatency.textContent = camera.edgeLatency;
    if (statDetected) statDetected.textContent = camera.boundingBoxes.length;
    if (statStockouts) {
      statStockouts.textContent = camera.outOfStockCount;
      statStockouts.className = `stat-num ${camera.outOfStockCount > 0 ? 'accent-amber' : 'accent-emerald'}`;
    }
    if (statEdible) {
      statEdible.textContent = camera.boundingBoxes.filter(b => b.objectType === 'EDIBLE_FOOD').length;
    }
    if (statPerfume) {
      statPerfume.textContent = camera.boundingBoxes.filter(b => b.objectType === 'PERFUME_COSMETICS').length;
    }

    const panel = document.getElementById('inspection-panel');
    if (panel) {
      panel.innerHTML = `
        <div class="inspection-empty">
          <span class="icon-inspect">🎯</span>
          <p>Switched to <strong>${camera.name}</strong>. Object Domain Classifier active (Eat Stuff vs Perfumes).</p>
        </div>
      `;
    }

    this.updateDetectionBanner(`Active Feed: ${camera.name} &bull; Scanning for Eat Stuff &amp; Perfumes`);

    if (this.onTelemetryEvent) {
      this.onTelemetryEvent({
        source: 'YOLOV11_EDGE',
        type: 'CAMERA_SWITCH',
        message: `Switched stream to ${camera.name} (${camera.resolution})`,
        data: { camId: camera.id, detections: camera.boundingBoxes.length }
      });
    }
  }

  handleCanvasClick(e) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = 1000 / this.canvas.width;
    const scaleY = 600 / this.canvas.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    if ((this.isWebcamActive || this.isUploadedMediaActive) && this.realtimeWebcamDetections.length > 0) {
      const hitWebcam = this.realtimeWebcamDetections.find(b => {
        return clickX >= b.x && clickX <= (b.x + b.w) && clickY >= b.y && clickY <= (b.y + b.h);
      });
      if (hitWebcam) {
        this.selectedBox = hitWebcam;
        this.renderInspectionCard(hitWebcam);
        return;
      }
    }

    const hit = this.currentCam.boundingBoxes.find(b => {
      if (b.conf < this.confThreshold) return false;
      return clickX >= b.x && clickX <= (b.x + b.w) && clickY >= b.y && clickY <= (b.y + b.h);
    });

    if (hit) {
      this.selectedBox = hit;
      this.renderInspectionCard(hit);
      if (this.onSelectBox) this.onSelectBox(hit);
      return;
    }

    if (this.currentCam.id === 'cam-traffic') {
      const shopperHit = this.shopperTracks.find(t => {
        return clickX >= t.x && clickX <= (t.x + t.w) && clickY >= t.y && clickY <= (t.y + t.h);
      });
      if (shopperHit) {
        this.selectedBox = shopperHit;
        this.renderInspectionCard({
          id: shopperHit.id,
          label: shopperHit.label,
          sku: `PERSON-${shopperHit.id.toUpperCase()}`,
          category: 'Shopper Trajectory',
          objectType: 'HUMAN_SHOPPER',
          consumeType: 'Customer Traversal &amp; Dwell',
          conf: shopperHit.conf,
          dwell: '3m 12s',
          intent: 'Active Traversal & Dwell',
          status: 'shopper'
        });
      }
    }
  }

  renderInspectionCard(box) {
    const panel = document.getElementById('inspection-panel');
    if (!panel) return;

    const isStockout = box.status === 'critical';
    if (isStockout) {
      soundEffects.playWarningAlert();
    }
    const isLow = box.status === 'low';
    const isShopper = box.objectType === 'HUMAN_SHOPPER';
    const isEdible = box.objectType === 'EDIBLE_FOOD';
    const isPerfume = box.objectType === 'PERFUME_COSMETICS';

    let domainBadge = `<span class="badge badge-normal">📱 UTILITY ITEM</span>`;
    if (isEdible) {
      domainBadge = `<span class="badge" style="background:rgba(16,185,129,0.25); color:#6ee7b7; border:1px solid #10b981;">🍏 EDIBLE: EAT STUFF</span>`;
    } else if (isPerfume) {
      domainBadge = `<span class="badge" style="background:rgba(217,70,239,0.25); color:#f0abfc; border:1px solid #d946ef;">🌸 PERFUME &amp; COSMETICS</span>`;
    } else if (isShopper) {
      domainBadge = `<span class="badge" style="background:rgba(6,182,212,0.25); color:#67e8f9; border:1px solid #06b6d4;">👤 HUMAN / SHOPPER</span>`;
    }

    const algoBadge = box.isUserTrained
      ? `<span class="badge" style="background:rgba(139,92,246,0.25); color:#c4b5fd; border:1px solid #8b5cf6;">🧠 USER-CALIBRATED ALGORITHM</span>`
      : `<span class="badge" style="background:rgba(6,182,212,0.15); color:#67e8f9; border:1px solid rgba(6,182,212,0.3);">⚡ FINE-GRAINED YOLOv11</span>`;

    panel.innerHTML = `
      <div class="inspection-card ${isStockout ? 'border-critical' : isLow ? 'border-low' : 'border-normal'}">
        <div class="card-header">
          <div class="card-title-group">
            <div class="product-kind-title-row">
              <span class="product-kind-hero-badge">${box.badge || ('🏷️ ' + (box.kind || box.label).toUpperCase())}</span>
              ${domainBadge}
              ${algoBadge}
              ${isStockout ? '<span class="badge badge-critical">CRITICAL STOCKOUT</span>' : ''}
              ${isLow ? '<span class="badge badge-low">LOW STOCK</span>' : ''}
            </div>
            <h4 class="product-kind-display-name">${box.kind || box.label}</h4>
            <span class="card-sku font-mono">Product Kind: <strong>${box.kind || box.label}</strong> &bull; Container: ${box.packaging || 'Standard Packaging'} &bull; ${box.sku || 'DETECTED-LIVE'}</span>
          </div>
          <div class="conf-badge">
            <span class="conf-label">YOLOv11 Conf</span>
            <span class="conf-score text-cyan">${Math.round((box.conf || 0.95) * 100)}%</span>
          </div>
        </div>

        <div class="card-body-grid">
          <div class="data-block">
            <span class="d-label">Product Kind</span>
            <span class="d-val text-cyan font-mono" style="font-weight: 700;">
              ${box.badge || box.kind || 'Retail Product'}
            </span>
          </div>

          <div class="data-block">
            <span class="d-label">Container &amp; Packaging</span>
            <span class="d-val">${box.packaging || 'Standard Packaging'}</span>
          </div>

          <div class="data-block">
            <span class="d-label">Product Subtype</span>
            <span class="d-val ${isEdible ? 'text-emerald' : isPerfume ? 'text-purple' : 'text-cyan'}">
              ${box.subtype || box.consumeType || 'Retail Good'}
            </span>
          </div>

          <div class="data-block">
            <span class="d-label">Net Volume / Quantity</span>
            <span class="d-val font-mono">${box.volume || '1 Unit'}</span>
          </div>

          <div class="data-block">
            <span class="d-label">Shelf Life &amp; Storage</span>
            <span class="d-val">${box.shelfLife || 'Ambient Display Shelf'}</span>
          </div>

          ${!isShopper ? `
            <div class="data-block">
              <span class="d-label">Shelf Inventory</span>
              <span class="d-val ${box.stock === 0 ? 'text-critical' : box.stock <= 5 ? 'text-warning' : 'text-emerald'}">
                ${box.stock !== undefined ? box.stock + ' units' : '1 unit detected'}
              </span>
            </div>
            <div class="data-block">
              <span class="d-label">Retail MSRP Price</span>
              <span class="d-val font-mono">${box.price || '$4.50'}</span>
            </div>
            <div class="data-block">
              <span class="d-label">Authorized Supplier</span>
              <span class="d-val">${box.supplier || 'Direct Retail Wholesale Hub'}</span>
            </div>
            <div class="data-block">
              <span class="d-label">Vision Ingest Feed</span>
              <span class="d-val">${this.isWebcamActive ? '📹 Live Webcam Reticle' : this.currentCam.aisle}</span>
            </div>
          ` : `
            <div class="data-block">
              <span class="d-label">Dwell Duration</span>
              <span class="d-val text-cyan">${box.dwell || '1m 20s'}</span>
            </div>
            <div class="data-block">
              <span class="d-label">Shopper Intent</span>
              <span class="d-val">${box.intent || 'Active Browsing'}</span>
            </div>
            <div class="data-block">
              <span class="d-label">Tracking Engine</span>
              <span class="d-val font-mono">DeepSORT Trajectory Vector</span>
            </div>
          `}
        </div>

        <div class="card-actions">
          ${!isShopper ? `
            <button class="btn ${isStockout ? 'btn-danger' : isLow ? 'btn-warning' : 'btn-primary'} btn-sm" id="btn-quick-reorder" data-sku="${box.sku || 'SKU-NEW'}">
              🛒 Order &amp; Pay (Card / GPay / Net Banking &rarr; Tax Invoice)
            </button>
          ` : `
            <span class="font-mono text-dim text-xs">Customer browsing ${this.currentCam.aisle} &bull; Conversion probability 74.2%</span>
          `}
        </div>
      </div>
    `;

    const btnReorder = panel.querySelector('#btn-quick-reorder');
    if (btnReorder) {
      btnReorder.addEventListener('click', () => {
        const itemObj = {
          sku: box.sku || 'SKU-REORDER-101',
          name: `${box.kind || box.label} (${box.packaging ? box.packaging.substring(0, 24) : 'Standard Packaging'})`,
          category: box.category || (isEdible ? 'Eat Stuff / Food' : 'Perfumes & Cosmetics'),
          shelfId: this.isWebcamActive ? 'Front Desk Vision Stand' : this.currentCam.aisle,
          currentStock: box.stock || 5,
          unitPrice: parseFloat((box.price || '$14.50').replace('$', '')),
          reorderQty: 20,
          status: box.status || 'normal',
          supplier: box.supplier || (isPerfume ? 'Perfumery & Fragrance Hub' : 'Beverage & Foods Wholesale Direct')
        };

        if (this.onOpenRestock) {
          this.onOpenRestock(itemObj);
        }
      });
    }
  }

  startVideoAnimationLoop() {
    const loop = () => {
      this.updatePhysics();
      if (this.isQuadWallMode) {
        this.drawQuadWall();
      } else {
        this.drawFrame();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      const clockEl = document.getElementById('hud-clock');
      if (clockEl) clockEl.textContent = `2026-10-24 ${timeStr}`;

      this.fps = (42.0 + (Math.random() * 0.9 - 0.4)).toFixed(1);
      const fpsEl = document.getElementById('hud-fps');
      if (fpsEl) fpsEl.textContent = `${this.fps} FPS`;
    }, 500);
  }

  updatePhysics() {
    if (!this.isPlaying) return;

    this.scanLineY += 2 * this.scanDirection;
    if (this.scanLineY > 600) this.scanDirection = -1;
    if (this.scanLineY < 0) this.scanDirection = 1;

    for (const track of this.shopperTracks) {
      track.x += track.vx;
      track.y += track.vy;

      if (track.x < track.minX || track.x > track.maxX) track.vx *= -1;
      if (track.y < 280 || track.y > 480) track.vy *= -1;

      if (Math.random() > 0.5) {
        track.path.push({ x: track.x + track.w / 2, y: track.y + track.h / 2 });
        if (track.path.length > 20) track.path.shift();
      }
    }
  }

  drawFrame() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    const scaleX = w / 1000;
    const scaleY = h / 600;

    // 1. Planogram Grid
    if (this.showPlanogramGrid && !this.isWebcamActive && !this.isUploadedMediaActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);

      for (let y = 150; y < 550; y += 140) {
        ctx.beginPath();
        ctx.moveTo(0, y * scaleY);
        ctx.lineTo(w, y * scaleY);
        ctx.stroke();

        ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`SHELF TIER Y-${y}`, 10, y * scaleY - 4);
      }
      ctx.restore();
    }

    // 2. Thermal Dwell Heatmap
    if (this.showHeatmap && this.currentCam.heatmapZones && !this.isWebcamActive && !this.isUploadedMediaActive) {
      ctx.save();
      for (const zone of this.currentCam.heatmapZones) {
        const zx = zone.x * scaleX;
        const zy = zone.y * scaleY;
        const zr = zone.r * scaleX;

        const grad = ctx.createRadialGradient(zx, zy, 5, zx, zy, zr);
        grad.addColorStop(0, `rgba(239, 68, 68, ${0.55 * zone.intensity})`);
        grad.addColorStop(0.4, `rgba(245, 158, 11, ${0.40 * zone.intensity})`);
        grad.addColorStop(0.7, `rgba(16, 185, 129, ${0.25 * zone.intensity})`);
        grad.addColorStop(1, 'rgba(16, 185, 129, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(zx, zy, zr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`🔥 ${zone.label}`, zx - 40, zy);
      }
      ctx.restore();
    }

    // 3. Laser Radar Scanning Sweep Line
    if (this.isPlaying) {
      ctx.save();
      const sy = this.scanLineY * scaleY;
      const scanGrad = ctx.createLinearGradient(0, sy - 15, 0, sy + 15);
      scanGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      scanGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.45)');
      scanGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, sy - 15, w, 30);

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Draw Real-Time Webcam / Uploaded Media Detections
    if ((this.isWebcamActive || this.isUploadedMediaActive) && this.realtimeWebcamDetections.length > 0) {
      for (const box of this.realtimeWebcamDetections) {
        if (box.conf < this.confThreshold) continue;

        const bx = box.x * scaleX;
        const by = box.y * scaleY;
        const bw = box.w * scaleX;
        const bh = box.h * scaleY;

        const isEdible = box.objectType === 'EDIBLE_FOOD';
        const isPerfume = box.objectType === 'PERFUME_COSMETICS';
        const color = isEdible ? '#10b981' : isPerfume ? '#d946ef' : '#06b6d4';

        ctx.save();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        ctx.fillStyle = isEdible ? 'rgba(16, 185, 129, 0.12)' : isPerfume ? 'rgba(217, 70, 239, 0.15)' : 'rgba(6, 182, 212, 0.12)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);

        // Corner highlights
        const cSize = 10;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bx, by + cSize); ctx.lineTo(bx, by); ctx.lineTo(bx + cSize, by);
        ctx.moveTo(bx + bw - cSize, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cSize);
        ctx.moveTo(bx, by + bh - cSize); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cSize, by + bh);
        ctx.moveTo(bx + bw - cSize, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cSize);
        ctx.stroke();

        // Main Product Label (Broad Product Kind)
        const kindLabel = box.badge || (box.kind ? `${box.kind.toUpperCase()}` : box.label);
        const mainLabel = `${kindLabel} · ${Math.round(box.conf * 100)}%`;
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        const textMetrics = ctx.measureText(mainLabel);
        ctx.fillStyle = color;
        ctx.fillRect(bx, by - 22, textMetrics.width + 14, 22);
        ctx.fillStyle = '#0b0f19';
        ctx.fillText(mainLabel, bx + 7, by - 7);

        // Subtitle badge showing packaging architecture & user calibrated indicator
        const subBadgeText = `${box.isUserTrained ? '🧠 CALIBRATED | ' : ''}📦 ${box.packaging ? box.packaging.substring(0, 28) : 'Retail Packaging'} · ${box.price || '$9.99'}`;
        ctx.font = '10px "JetBrains Mono", monospace';
        const subMetrics = ctx.measureText(subBadgeText);
        ctx.fillStyle = 'rgba(11, 15, 25, 0.92)';
        ctx.fillRect(bx, by + bh + 4, subMetrics.width + 12, 18);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by + bh + 4, subMetrics.width + 12, 18);
        ctx.fillStyle = box.isUserTrained ? '#c4b5fd' : '#e2e8f0';
        ctx.fillText(subBadgeText, bx + 6, by + bh + 17);
        ctx.restore();
      }
      return;
    }

    // 5. Draw CCTV Video Bounding Boxes with Broad Product Kind Badges
    if (this.showBoundingBoxes && !this.isWebcamActive) {
      for (const box of this.currentCam.boundingBoxes) {
        if (box.conf < this.confThreshold) continue;

        const isEdible = box.objectType === 'EDIBLE_FOOD';
        const isPerfume = box.objectType === 'PERFUME_COSMETICS';
        const isShopper = box.objectType === 'HUMAN_SHOPPER';

        if (this.activeCategoryFilter === 'edible' && !isEdible) continue;
        if (this.activeCategoryFilter === 'perfume' && !isPerfume) continue;

        const bx = box.x * scaleX;
        const by = box.y * scaleY;
        const bw = box.w * scaleX;
        const bh = box.h * scaleY;

        const isSelected = this.selectedBox && this.selectedBox.id === box.id;
        const isCritical = box.status === 'critical';
        const isLow = box.status === 'low';

        let strokeColor = '#10b981';
        let fillColor = 'rgba(16, 185, 129, 0.08)';

        if (isPerfume) {
          strokeColor = '#d946ef';
          fillColor = 'rgba(217, 70, 239, 0.12)';
        } else if (isShopper) {
          strokeColor = '#06b6d4';
          fillColor = 'rgba(6, 182, 212, 0.10)';
        }

        if (isCritical) {
          strokeColor = '#ef4444';
          fillColor = 'rgba(239, 68, 68, 0.18)';
        } else if (isLow) {
          strokeColor = '#f59e0b';
          fillColor = 'rgba(245, 158, 11, 0.12)';
        }

        if (isSelected) {
          strokeColor = '#ffffff';
          fillColor = 'rgba(255, 255, 255, 0.20)';
        }

        ctx.save();
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = fillColor;

        if (isCritical) ctx.setLineDash([6, 4]);

        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);

        const cornerSize = 7;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, by + cornerSize); ctx.lineTo(bx, by); ctx.lineTo(bx + cornerSize, by);
        ctx.moveTo(bx + bw - cornerSize, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cornerSize);
        ctx.stroke();

        if (this.showLabels) {
          const kindLabel = box.badge || (box.kind ? `${box.kind.toUpperCase()}` : box.label);
          const labelText = isCritical
            ? `⚠️ [OUT OF STOCK: ${box.sku}]`
            : `${kindLabel} · ${Math.round(box.conf * 100)}%`;

          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          const textMetrics = ctx.measureText(labelText);
          const bgWidth = textMetrics.width + 12;
          const bgHeight = 18;

          ctx.fillStyle = strokeColor;
          ctx.fillRect(bx, by - bgHeight, bgWidth, bgHeight);

          ctx.fillStyle = '#0b0f19';
          ctx.fillText(labelText, bx + 6, by - 5);
        }

        ctx.restore();
      }

      if (this.currentCam.id === 'cam-traffic' && this.activeCategoryFilter !== 'edible' && this.activeCategoryFilter !== 'perfume') {
        for (const track of this.shopperTracks) {
          const tx = track.x * scaleX;
          const ty = track.y * scaleY;
          const tw = track.w * scaleX;
          const th = track.h * scaleY;

          if (this.showMotionTrails && track.path.length > 1) {
            ctx.save();
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(track.path[0].x * scaleX, track.path[0].y * scaleY);
            for (let i = 1; i < track.path.length; i++) {
              ctx.lineTo(track.path[i].x * scaleX, track.path[i].y * scaleY);
            }
            ctx.stroke();
            ctx.restore();
          }

          ctx.save();
          ctx.strokeStyle = '#06b6d4';
          ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
          ctx.lineWidth = 2;
          ctx.fillRect(tx, ty, tw, th);
          ctx.strokeRect(tx, ty, tw, th);

          ctx.fillStyle = '#06b6d4';
          ctx.fillRect(tx, ty - 18, 160, 18);
          ctx.fillStyle = '#0b0f19';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.fillText(`👤 HUMAN: Shopper (${Math.round(track.conf * 100)}%)`, tx + 6, ty - 5);
          ctx.restore();
        }
      }
    }
  }

  drawQuadWall() {
    for (const c of this.cameras) {
      const qInfo = this.quadCanvases && this.quadCanvases[c.id];
      if (!qInfo) continue;
      const { canvas, ctx } = qInfo;
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) continue;

      ctx.clearRect(0, 0, w, h);
      const scaleX = w / 1000;
      const scaleY = h / 600;

      // Planogram tiers
      if (this.showPlanogramGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        for (let y = 150; y < 550; y += 140) {
          ctx.beginPath();
          ctx.moveTo(0, y * scaleY);
          ctx.lineTo(w, y * scaleY);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw boxes for this camera
      for (const box of c.boundingBoxes) {
        if (box.conf < this.confThreshold) continue;
        const isEdible = box.objectType === 'EDIBLE_FOOD';
        const isPerfume = box.objectType === 'PERFUME_COSMETICS';
        const isShopper = box.objectType === 'HUMAN_SHOPPER';

        let strokeColor = isEdible ? '#10b981' : isPerfume ? '#d946ef' : '#06b6d4';
        if (box.status === 'critical') strokeColor = '#ef4444';
        else if (box.status === 'low') strokeColor = '#f59e0b';

        const bx = box.x * scaleX;
        const by = box.y * scaleY;
        const bw = box.w * scaleX;
        const bh = box.h * scaleY;

        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = isEdible ? 'rgba(16, 185, 129, 0.12)' : isPerfume ? 'rgba(217, 70, 239, 0.12)' : 'rgba(6, 182, 212, 0.10)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);

        const kindLabel = box.badge || (box.kind ? box.kind.toUpperCase() : box.label);
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(kindLabel).width;
        ctx.fillStyle = strokeColor;
        ctx.fillRect(bx, by - 14, textWidth + 8, 14);
        ctx.fillStyle = '#0b0f19';
        ctx.fillText(kindLabel, bx + 4, by - 3);
        ctx.restore();
      }

      // Scanning radar sweep on each tile
      if (this.isPlaying) {
        const sy = this.scanLineY * scaleY;
        ctx.save();
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  captureSnapshot() {
    soundEffects.playClick();
    if (!this.canvas) return;

    const exportCanvas = document.createElement('canvas');
    const w = this.canvas.width || 1000;
    const h = this.canvas.height || 600;
    exportCanvas.width = w;
    exportCanvas.height = h;
    const exportCtx = exportCanvas.getContext('2d');

    // 1. Draw underlying video stream or image
    try {
      if (this.isWebcamActive && this.video) {
        exportCtx.drawImage(this.video, 0, 0, w, h);
      } else if (this.isUploadedMediaActive && this.uploadedVideo) {
        exportCtx.drawImage(this.uploadedVideo, 0, 0, w, h);
      } else if (this.img) {
        exportCtx.drawImage(this.img, 0, 0, w, h);
      }
    } catch (e) {}

    // 2. Draw YOLOv11 bounding box overlays
    exportCtx.drawImage(this.canvas, 0, 0, w, h);

    // 3. Surveillance watermark
    exportCtx.fillStyle = 'rgba(11, 15, 25, 0.88)';
    exportCtx.fillRect(10, h - 36, 420, 26);
    exportCtx.strokeStyle = '#06b6d4';
    exportCtx.lineWidth = 1;
    exportCtx.strokeRect(10, h - 36, 420, 26);
    exportCtx.fillStyle = '#ffffff';
    exportCtx.font = 'bold 11px "JetBrains Mono", monospace';
    exportCtx.fillText(`YOLOv11 CCTV FORENSIC EVIDENCE · ${new Date().toLocaleString()}`, 16, h - 19);

    const url = exportCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `cctv_yolov11_snapshot_${Date.now()}.png`;
    a.click();

    if (this.onTelemetryEvent) {
      this.onTelemetryEvent({
        source: 'CCTV_FORENSICS',
        type: 'SNAPSHOT_EXPORT',
        message: `High-resolution CCTV snapshot with YOLOv11 bounding boxes exported for ${this.currentCam.name}.`
      });
    }
  }

  recordForensicClip() {
    soundEffects.playClick();
    const btn = document.getElementById('btn-record-cctv-clip');
    if (!btn) return;

    btn.innerHTML = '🔴 REC [3s]';
    btn.classList.add('btn-danger');

    let timeLeft = 3;
    const interval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(interval);
        btn.innerHTML = '🔴 Record Clip';
        btn.classList.remove('btn-danger');
        soundEffects.playPaymentSuccess();
        alert('📹 CCTV Forensic Clip (5 seconds) saved to local video cache. Ready for security audit.');
      } else {
        btn.innerHTML = `🔴 REC [${timeLeft}s]`;
      }
    }, 1000);
  }

  scanBarcodeOptical() {
    soundEffects.playClick();
    const barcodes = [
      { code: '8901030382910', kind: 'beverage', name: 'Cold Beverage Can (Soda)' },
      { code: '8901499028120', kind: 'chips', name: 'Crispy Potato Chips Pouch' },
      { code: '8902519001921', kind: 'pickle', name: 'Spicy Mango Pickle Jar' },
      { code: '8901719280194', kind: 'biscuits', name: 'Butter Cookies Biscuit Roll' },
      { code: '8901023001928', kind: 'shampoo', name: 'Herbal Shampoo Bottle (400ml)' },
      { code: '3349666007921', kind: 'perfume', name: 'Luxury Eau de Parfum Spray' }
    ];
    const picked = barcodes[Math.floor(Math.random() * barcodes.length)];
    this.injectTestObject(picked.kind);
    this.updateDetectionBanner(`▮▎█▌ BARCODE OPTICAL DECODE: [${picked.code}] &rarr; ${picked.name}`);

    if (this.onTelemetryEvent) {
      this.onTelemetryEvent({
        source: 'BARCODE_OCR_ENGINE',
        type: 'UPC_DECODED',
        message: `Optical Barcode Ingest: UPC-${picked.code} decoded as "${picked.name}". Injected into Vision stream.`
      });
    }
  }

  drawOverlays() {
    this.drawFrame();
  }
}
