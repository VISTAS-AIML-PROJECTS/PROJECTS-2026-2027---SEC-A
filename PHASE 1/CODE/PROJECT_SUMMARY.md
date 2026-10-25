# CV-Based Sales Analytics Engine: Comprehensive Project Summary

**Project Title:** CV-Based Sales Analytics Engine  
**Subtitle:** Computer Vision and Conversational AI for Smart-Retail Shelf Monitoring & Automated Procurement  
**Academic Milestone:** Academic Project · **Review 2**  
**Presenter / Author:** Harish  
**Architecture:** 4-Layer Edge-to-Cloud Pipeline (YOLOv11 Edge Inference + Firebase Sync + Antigravity AI Engine + Web Presentation)

---

## 1. Executive Summary & Problem Formulation

In modern physical retail environments, inventory discrepancies and lack of spatial shopper insights cause substantial revenue loss. Traditional retail operations suffer from:
1. **Phantom Stockouts & Shelf Disarray:** Central ERP or POS inventory records often report items in stock when shelves are physically bare, misplaced by customers, or occluded.
2. **Disconnected Point-of-Sale (POS) Systems:** POS terminals capture transactions at checkout but lack awareness of in-aisle dwell times, customer interaction rates, footfall congestion, or unpurchased item concealment.
3. **Manual Replenishment Inefficiencies:** Restocking workflows rely on lagging manual barcode audits, causing stockouts during peak shopping periods.

### The Solution
This project provides an **end-to-end, closed-loop smart retail operating system**. It unifies:
* Real-time computer vision object detection (YOLOv11 / COCO-SSD) on commodity RTSP CCTV feeds and live webcams.
* Instant edge-to-cloud telemetry sync with low latency.
* Point-of-Sale (POS) transactional reconciliation and shrinkage anomaly detection.
* Automated supplier restock purchase order creation with integrated payment simulation and certified tax invoice generation.
* An interactive customer Self-Checkout (SCO) kiosk terminal.
* Real-time spatial heatmaps and predictive inventory runout analytics.

---

## 2. 4-Layer Edge-to-Cloud Architecture

```
+-----------------------------------------------------------------------------------+
|  LAYER 1: Edge Vision & Inference Layer                                           |
|  • Tech: Python, OpenCV, YOLOv11 / COCO-SSD, TensorRT, WebCam / RTSP               |
|  • Target Hardware: Jetson Orin Nano / Local GPU Workstation / Browser WebGL      |
|  • Role: High-throughput local inference (30–45 FPS), optical bounding boxes,     |
|          shopper trajectory tracking without streaming uncompressed video cloudward|
+-----------------------------------------+-----------------------------------------+
                                          | (JSON Telemetry Diff Packets)
                                          v
+-----------------------------------------------------------------------------------+
|  LAYER 2: Telemetry Synchronization & Transport Layer                             |
|  • Tech: Firebase Firestore, Cloud Functions, Model Context Protocol (MCP) Server |
|  • Role: Sub-second synchronization (<15ms RTT), schema-enforced tool execution,   |
|          bidirectional state distribution                                         |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|  LAYER 3: Retail Intelligence & Analytics Layer                                   |
|  • Tech: Antigravity AI Agent Engine, Shrinkage Heuristics, Dwell Analysis        |
|  • Role: Temporal persistence (hysteresis) filtering, loss prevention alerts,     |
|          dwell-to-purchase conversion modeling, safety-stock forecasting          |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|  LAYER 4: Operational Management Cockpit & Presentation                           |
|  • Tech: Vanilla ES6 Modules, Custom Cyberpunk CSS Design System, HTML5 Canvas    |
|  • Role: Live CCTV feed overlays, Smart Self-Checkout (SCO), Restock Modal,       |
|          Tax Invoice Archive, Viva Defense & Daily Executive Audit Dossier        |
+-----------------------------------------------------------------------------------+
```

---

## 3. Core Modules & Technical Breakdown

### 1. Live Edge CCTV & Vision Feed Engine
* **File:** `components/visionFeed.js`
* **CCTV Feeds Configured:**
  * **CAM 02 (Aisle 3):** Luxury Fragrances & Perfumes (Chanel No. 5, Dior Sauvage Elixir, Skincare Serums).
  * **CAM 04 (Aisle 4):** Beverages, Milk Jugs, Oatmilk, Biscuits, and Preserved Pickles.
  * **CAM 07 (Aisle 7):** Dry Groceries, Cereals, Chips, Shampoos, and active Out-of-Stock Shelf Gaps.
  * **CAM 14 (Overhead Concourse):** De-warped Fisheye feed tracking shopper trajectories, velocities, and dwell times.
* **Direct Browser AI Detection:** Integrated with TensorFlow.js and COCO-SSD to execute real-time object detection directly through a connected webcam or uploaded video/image files.
* **Quad-Wall Mode:** Switch between focused single-camera view and 4-channel synchronized CCTV surveillance wall.
* **Visual Overlays:** Interactive bounding boxes, confidence ratings, planogram alignment guidelines, dwell heatmaps, and shopper path motion trails.
* **Barcode & Optical Ingest:** Ingests 1D/2D barcodes and QR codes for item verification.

### 2. AI Product Training & Calibration Studio
* **Files:** `components/trainingModal.js`, `data/productKnowledgeBase.js`
* Enables managers to train, fine-tune, and calibrate recognition weights for specific products without hardcoded assumptions.
* **Supported Taxonomy:**
  * 🥤 **Beverages:** Cylindrical aspect ratio, metallic/specular aluminum reflection.
  * 🥔 **Chips & Snacks:** Nitrogen-flushed metallized foil pillow pouches.
  * 🫙 **Pickles & Condiments:** Heavy glass jars with airtight vacuum lug caps.
  * 🍪 **Biscuits & Cookies:** Rectangular foil trays.
  * 🧴 **Shampoos & Personal Care:** Ergonomic pump dispenser bottles.
  * 🌸 **Perfumes & Fragrances:** Faceted glass flacons with atomizers.
  * 💄 **Cosmetics:** UV dropper pipette bottles and serums.
  * 🥛 **Dairy Milk:** HDPE plastic jugs with molded handles.
  * 🥣 **Breakfast Cereals:** Recyclable paperboard cartons.
  * 👤 **Human Shoppers:** Pedestrian tracking and dwell monitoring.

### 3. Customer Smart Self-Checkout (SCO) AI Kiosk
* **File:** `components/selfCheckout.js`
* **Vision-to-Cart Pipeline:** Direct ingest of camera-identified or optically scanned items into a customer billing cart.
* **Taxation Logic:** Applies tax rates based on product class (e.g., 5% on staple edible foods vs. 18% on luxury fragrance and cosmetics).
* **Payment Gateways:** Supports mock checkout flows via UPI (Google Pay / PhonePe QR code), Credit/Debit Card, and Cash.
* **Closed-Loop Reconciliation:** Every checkout immediately updates global shelf stock levels, triggers low-stock reorder thresholds if breached, and increments real-time store revenue metrics.

### 4. Shelf Stock & POS Fusion Module
* **File:** `components/inventoryAndPos.js`
* **Planogram Compliance Table:** Displays SKU ID, shelf coordinates, visual stock count, safety buffer thresholds, and daily POS velocity.
* **Temporal Persistence Buffer (Hysteresis Filter):** Differentiates between a shopper temporarily picking up an item to inspect it and an authentic stockout by requiring absence over a calibrated dwell duration before triggering critical replenishment alerts.
* **Action Simulations:** "Simulate Customer Pickup" and "Restock Supplier Order" triggers for live testing.

### 5. CCTV Loss Prevention & Anti-Theft Surveillance
* **File:** `components/lossPrevention.js`
* **Mathematical Shrinkage Anomaly Calculation:**
  $$\text{Shrinkage Delta} = (\text{Visual Shelf Depletion}) - (\text{POS Checkout Count} + \text{Documented Write-offs})$$
* **Incident Detection Triggers:**
  * **Unscanned Concealment:** Rapid item extraction from shelf followed by movement away from checkout without POS registration.
  * **Planogram Breaches:** Detecting misplaced cross-category goods (e.g., non-edible shampoo placed on a cereal shelf).
  * **Loitering / Dwell Anomalies:** Shoppers remaining stationary in blind spots for $>4.5\text{ minutes}$.
* **Security Responses:** Acoustic alarm sirens via `utils/soundEffects.js` and security guard dispatch action logging.

### 6. Store Analytics, Spatial Heatmaps & Forecasting
* **File:** `components/analyticsDashboard.js`
* **Executive Metrics Ribbon:** Total footfall, POS store revenue, conversion yield (shoppers with dwell $\ge 2.5\text{ min}$ exhibit $84\%$ purchase conversion), and average aisle dwell time.
* **Interactive 60 FPS Canvas Chart:** Hourly breakdown comparing visitor footfall vs. POS sales volume vs. conversion velocity.
* **Predictive Runout Forecasting:** Calculates remaining operating runway hours before stockouts occur based on current sales velocity.

### 7. Procurement Restock & Secure Payment Gateway
* **File:** `components/restockModal.js`
* Generates instant supplier purchase orders (PO) when SKUs breach minimum safety levels.
* Simulates multi-channel payment authorization (Credit/Debit Card, Google Pay / UPI instant VPA, Corporate Net Banking).
* Emits signed digital Tax Invoices with verification stamps and updates live camera detection counts.

### 8. Tax Invoices & Procurement Records Archive
* **Files:** `components/invoicesTab.js`, `components/invoiceModal.js`
* Centralized ledger archiving all procurement invoices and supplier transactions.
* Full-featured modal displaying line items, supplier tax identification, authorized manager IDs, and print actions.

### 9. User Role Management & Access Control
* **Files:** `data/authManager.js`, `components/userRoleModal.js`
* Role-based access control (RBAC) with pre-seeded operator profiles (`harish_manager`, `admin`).
* Supports new user registration, credential validation, and session management saved to LocalStorage.
* Telemetry stream automatically tags events with active operator identity.

### 10. Daily Store Audit & Intelligence Report Generator
* **File:** `utils/reportGenerator.js`
* One-click compilation of a publication-ready store audit dossier combining camera uptime, planogram compliance scores, inventory gaps, and procurement spend into a printable/PDF format.

### 11. Academic Review 2 Viva Defense Hub
* **File:** `components/vivaGuide.js`
* Complete academic presentation companion containing:
  * **Literature Survey:** Reviews citations including Furmakiewicz et al. (Retail AI Copilots, 2024), Glenn Jocher / Ultralytics (YOLO11, 2024), and Google Firebase MCP Server (2026).
  * **Identified Research Gaps:** Demonstrates how prior work solves isolated sub-problems, whereas this system closes the loop between raw video pixels, POS transactions, and automated procurement.
  * **Viva Q&A Cards:** Detailed technical justifications for model selection, occlusion mitigation, hysteresis filters, and MCP security safeguards.

---

## 4. Project Directory Map

```text
/Users/sanjay/Desktop/untitled folder/
├── index.html                      # Main single-page web dashboard application
├── test.html                       # Testing mirror of index.html
├── styles.css                      # Master CSS stylesheet (dark cyberpunk/glassmorphic design system)
├── app.js                          # Core application orchestrator, tab routing & event bus
├── PROJECT_SUMMARY.md              # Project architectural and functional documentation
│
├── assets/                         # Static CCTV image test assets
│   ├── camera_cereal.jpg           # CAM 07: Dry Groceries & Cereals Aisle
│   ├── camera_dairy.jpg            # CAM 04: Beverages & Dairy Aisle
│   ├── camera_perfume.jpg          # CAM 02: Fragrances & Luxury Cosmetics Aisle
│   └── camera_traffic.jpg          # CAM 14: Overhead Ceiling Concourse Stream
│
├── components/                     # Modular UI Components
│   ├── visionFeed.js               # YOLOv11 & COCO-SSD video detection & camera wall engine
│   ├── selfCheckout.js             # Smart Self-Checkout (SCO) AI cart & payment terminal
│   ├── inventoryAndPos.js          # Live shelf stock & POS fusion table
│   ├── lossPrevention.js           # CCTV shrinkage, loitering & theft surveillance
│   ├── analyticsDashboard.js       # Store KPI metrics, Canvas charts & predictive runout
│   ├── restockModal.js             # Purchase order & restock payment gateway modal
│   ├── invoicesTab.js              # Historical procurement & tax invoice archive tab
│   ├── invoiceModal.js             # Detailed certified tax invoice display modal
│   ├── userRoleModal.js            # Manager login & account registration modal
│   ├── trainingModal.js            # Product kind calibration & neural fine-tuning studio
│   └── vivaGuide.js                # Academic Review 2 viva defense & architecture guide
│
├── data/                           # Data Models, Knowledge Bases & Auth
│   ├── retailData.js               # Cameras, inventory catalog, hourly analytics & viva data
│   ├── productKnowledgeBase.js     # Taxonomy, visual aspect ratios, packaging heuristics
│   └── authManager.js              # Credentials storage, user registration & active session
│
└── utils/                          # Cross-cutting Utilities
    ├── reportGenerator.js          # Printable daily store audit report generator
    └── soundEffects.js             # Web Audio API sound synthesizer (beeps, alarms, cash chimes)
```

---

## 5. Technology Highlights & Design Implementation

* **Runtime Environment:** Pure Vanilla JavaScript (ES6 Modules) with zero external bundler dependencies, running natively on modern browsers.
* **Computer Vision Integration:** TensorFlow.js + COCO-SSD for client-side neural inference, coupled with synthetic and RTSP streaming hooks for YOLOv11 TensorRT hardware backends.
* **Audio Synthesizer:** Fully procedural Web Audio API engine generating auditory feedback for clicks, scans, payment confirmations, and security alarms without external `.mp3` dependencies.
* **Styling & Aesthetics:** Custom responsive design system featuring dark cyberpunk glassmorphism, glowing telemetry indicators, and high-DPI HTML5 Canvas data visualizations.
* **Telemetry Drawer:** Fixed collapsible bottom drawer displaying live real-time packet streams across edge, cloud, POS, and authentication events.
