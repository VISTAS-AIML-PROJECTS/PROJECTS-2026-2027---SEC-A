// retailData.js - Core Data Models for CV-Based Sales Analytics Engine
// Academic Project Review 2 | Presenter: Harish

export const retailCameras = [
  {
    id: 'cam-perfume',
    name: 'CAM 02 · Aisle 3 (Perfumes & Luxury Cosmetics)',
    aisle: 'Aisle 3 (Fragrance & Beauty)',
    category: 'Perfumes & Cosmetics',
    streamUrl: './assets/camera_perfume.jpg',
    resolution: '1920x1080 @ 45 FPS (YOLOv11 TensorRT)',
    protocol: 'RTSP / H.265 Luxury Tier',
    edgeLatency: '10.2 ms',
    planogramAdherence: 98.0,
    totalProductsDetected: 34,
    outOfStockCount: 0,
    boundingBoxes: [
      { id: 'bb-p1', kind: 'Perfume', badge: '🌸 PERFUME', label: 'Perfume (Fragrance Spray)', sku: 'SKU-PRF-401', conf: 0.98, x: 270, y: 390, w: 90, h: 140, category: 'Fragrances & Colognes', objectType: 'PERFUME_COSMETICS', packaging: 'Faceted Glass Flacon with Atomizer', volume: '100 ml / 3.4 fl oz', subtype: 'Eau de Parfum Spray', status: 'normal', stock: 12, price: '$145.00' },
      { id: 'bb-p2', kind: 'Perfume', badge: '🌸 PERFUME', label: 'Perfume (Cologne Spray)', sku: 'SKU-PRF-402', conf: 0.97, x: 420, y: 390, w: 85, h: 140, category: 'Fragrances & Colognes', objectType: 'PERFUME_COSMETICS', packaging: 'Glass Flacon with Spray Nozzle', volume: '60 ml / 2.0 fl oz', subtype: 'Luxury Cologne Spray', status: 'normal', stock: 8, price: '$165.00' },
      { id: 'bb-p3', kind: 'Perfume', badge: '🌸 PERFUME', label: 'Perfume (Eau de Toilette)', sku: 'SKU-PRF-403', conf: 0.95, x: 630, y: 730, w: 75, h: 130, category: 'Fragrances & Colognes', objectType: 'PERFUME_COSMETICS', packaging: 'Polished Glass Flacon', volume: '50 ml / 1.7 fl oz', subtype: 'Cologne Mist Spray', status: 'low', stock: 3, price: '$98.00' },
      { id: 'bb-p4', kind: 'Cosmetics', badge: '💄 COSMETICS', label: 'Cosmetics (Facial Serum)', sku: 'SKU-PRF-404', conf: 0.94, x: 90, y: 770, w: 80, h: 160, category: 'Skincare & Cosmetics', objectType: 'PERFUME_COSMETICS', packaging: 'UV Dropper Pipette Bottle', volume: '30 ml / 1.0 fl oz', subtype: 'Topical Skincare Serum', status: 'normal', stock: 16, price: '$34.50' },
      { id: 'bb-p5', kind: 'Human', badge: '👤 HUMAN', label: 'Human (Store Customer)', sku: 'PERSON-604', conf: 0.96, x: 575, y: 330, w: 100, h: 360, category: 'Store Shopper', objectType: 'HUMAN_SHOPPER', packaging: 'In-Store Active Movement', volume: 'Active Shopper', subtype: 'Customer Product Inspection', status: 'shopper', dwell: '2m 45s', intent: 'Sample Testing' }
    ],
    heatmapZones: [
      { x: 340, y: 440, r: 90, intensity: 0.96, label: 'Perfume Luxury Dwell Zone' },
      { x: 460, y: 440, r: 85, intensity: 0.92, label: 'Fragrance High Velocity' }
    ]
  },
  {
    id: 'cam-dairy',
    name: 'CAM 04 · Aisle 4 (Beverages & Dairy Feeds)',
    aisle: 'Aisle 4',
    category: 'Beverages & Dairy',
    streamUrl: './assets/camera_dairy.jpg',
    resolution: '1920x1080 @ 45 FPS (YOLOv11 TensorRT)',
    protocol: 'RTSP / H.264',
    edgeLatency: '14.2 ms',
    planogramAdherence: 94.2,
    totalProductsDetected: 42,
    outOfStockCount: 1,
    boundingBoxes: [
      { id: 'bb-d1', kind: 'Beverage', badge: '🥤 BEVERAGE', label: 'Beverage (Milk Jug)', sku: 'SKU-DRY-101', conf: 0.96, x: 5, y: 160, w: 90, h: 190, category: 'Beverages & Dairy', objectType: 'EDIBLE_FOOD', packaging: 'HDPE Plastic Jug with Molded Handle', volume: '1 Gallon / 3.78 Litres', subtype: 'Pasteurized Whole Milk', status: 'normal', stock: 18, price: '$5.49' },
      { id: 'bb-d2', kind: 'Beverage', badge: '🥤 BEVERAGE', label: 'Beverage (Milk Jug)', sku: 'SKU-DRY-102', conf: 0.94, x: 95, y: 160, w: 85, h: 190, category: 'Beverages & Dairy', objectType: 'EDIBLE_FOOD', packaging: 'HDPE Plastic Jug with Cap', volume: '1 Gallon / 3.78 Litres', subtype: '2% Reduced Fat Milk', status: 'normal', stock: 14, price: '$5.29' },
      { id: 'bb-d3', kind: 'Beverage', badge: '🥤 BEVERAGE', label: 'Beverage (Plant Milk)', sku: 'SKU-DRY-108', conf: 0.95, x: 330, y: 190, w: 95, h: 160, category: 'Beverages & Plant Dairy', objectType: 'EDIBLE_FOOD', packaging: 'Aseptic Barrier Carton', volume: '32 oz / 946 ml', subtype: 'Barista Oatmilk Drink', status: 'low', stock: 3, price: '$4.99' },
      { id: 'bb-d4', kind: 'Beverage', badge: '🥤 BEVERAGE', label: 'Beverage (Almond Drink)', sku: 'SKU-DRY-109', conf: 0.92, x: 425, y: 190, w: 55, h: 160, category: 'Beverages & Plant Dairy', objectType: 'EDIBLE_FOOD', packaging: 'Aseptic Beverage Bottle', volume: '48 oz / 1.4 Litres', subtype: 'Chilled Almond Drink', status: 'normal', stock: 12, price: '$4.79' },
      { id: 'bb-d5', kind: 'Pickle', badge: '🫙 PICKLE', label: 'Pickle (Preserved Jar)', sku: 'SKU-DRY-201', conf: 0.97, x: 285, y: 390, w: 80, h: 140, category: 'Preserves & Condiments', objectType: 'EDIBLE_FOOD', packaging: 'Airtight Glass Lug Jar', volume: '450g / 16 oz', subtype: 'Pickled Preserves & Relish', status: 'normal', stock: 24, price: '$4.89' },
      { id: 'bb-d6', kind: 'Biscuits', badge: '🍪 BISCUITS', label: 'Biscuits (Snack Pack)', sku: 'SKU-DRY-203', conf: 0.93, x: 400, y: 395, w: 55, h: 135, category: 'Confectionery & Bakery', objectType: 'EDIBLE_FOOD', packaging: 'Foil Wrap Tray', volume: '200g / 7 oz', subtype: 'Baked Snack Biscuits', status: 'normal', stock: 16, price: '$2.19' },
      { id: 'bb-d7', kind: 'Human', badge: '👤 HUMAN', label: 'Human (Customer Traversal)', sku: 'PERSON-842', conf: 0.91, x: 25, y: 430, w: 125, h: 480, category: 'Shopper', objectType: 'HUMAN_SHOPPER', packaging: 'Active In-Store Movement', volume: 'Active Shopper', subtype: 'Browsing Trajectory', status: 'shopper', dwell: '42s', intent: 'High Purchase Intent' },
      { id: 'bb-d8', kind: 'Human', badge: '👤 HUMAN', label: 'Human (Active Shopper)', sku: 'PERSON-849', conf: 0.93, x: 760, y: 400, w: 100, h: 460, category: 'Shopper', objectType: 'HUMAN_SHOPPER', packaging: 'Active In-Store Movement', volume: 'Active Shopper', subtype: 'Product Inspection', status: 'shopper', dwell: '1m 15s', intent: 'Item Inspected' }
    ],
    heatmapZones: [
      { x: 340, y: 220, r: 85, intensity: 0.85, label: 'Beverage Hotspot' },
      { x: 310, y: 450, r: 100, intensity: 0.95, label: 'Preserves High Velocity' }
    ]
  },
  {
    id: 'cam-cereal',
    name: 'CAM 07 · Aisle 7 (Dry Groceries & Snacks)',
    aisle: 'Aisle 7',
    category: 'Breakfast Cereals & Snacks',
    streamUrl: './assets/camera_cereal.jpg',
    resolution: '1920x1080 @ 45 FPS (YOLOv11 TensorRT)',
    protocol: 'RTSP / H.264',
    edgeLatency: '11.8 ms',
    planogramAdherence: 82.5,
    totalProductsDetected: 38,
    outOfStockCount: 2,
    boundingBoxes: [
      { id: 'bb-c1', kind: 'Cereal', badge: '🥣 CEREAL', label: 'Cereal (Grain Flakes Box)', sku: 'SKU-CER-301', conf: 0.96, x: 30, y: 65, w: 60, h: 170, category: 'Breakfast Cereals', objectType: 'EDIBLE_FOOD', packaging: 'Recyclable Paperboard Box', volume: '500g / 17.6 oz', subtype: 'Toasted Flakes Cereal', status: 'normal', stock: 15, price: '$4.29' },
      { id: 'bb-c2', kind: 'Chips', badge: '🥔 CHIPS', label: 'Chips (Crispy Potato Snack)', sku: 'SKU-CER-302', conf: 0.95, x: 145, y: 65, w: 60, h: 170, category: 'Snack Foods & Crisps', objectType: 'EDIBLE_FOOD', packaging: 'Nitrogen-Flushed Foil Pouch', volume: '180g / 6.3 oz', subtype: 'Potato & Corn Crisps', status: 'normal', stock: 11, price: '$3.49' },
      { id: 'bb-c3', kind: 'Biscuits', badge: '🍪 BISCUITS', label: 'Biscuits (Baked Cookies)', sku: 'SKU-CER-303', conf: 0.94, x: 205, y: 65, w: 60, h: 170, category: 'Confectionery & Bakery', objectType: 'EDIBLE_FOOD', packaging: 'Barrier Foil Wrap over Tray', volume: '300g / 10.5 oz', subtype: 'Sweet Baked Biscuits', status: 'normal', stock: 9, price: '$2.99' },
      { id: 'bb-c4', kind: 'Beverage', badge: '🥤 BEVERAGE', label: 'Beverage (Cold Drink Can)', sku: 'SKU-CER-304', conf: 0.97, x: 315, y: 75, w: 50, h: 140, category: 'Beverages & Soft Drinks', objectType: 'EDIBLE_FOOD', packaging: 'Aluminum Beverage Can', volume: '330 ml', subtype: 'Sparkling Beverage', status: 'normal', stock: 20, price: '$2.49' },
      { id: 'bb-c5', kind: 'Pickle', badge: '🫙 PICKLE', label: 'Pickle (Preserved Glass Jar)', sku: 'SKU-CER-305', conf: 0.92, x: 325, y: 250, w: 50, h: 140, category: 'Preserves & Condiments', objectType: 'EDIBLE_FOOD', packaging: 'Glass Jar with Lug Cap', volume: '450g / 16 oz', subtype: 'Pickled Preserves', status: 'low', stock: 4, price: '$4.99' },
      { id: 'bb-c6', kind: 'Stockout', badge: '⚠️ OUT OF STOCK', label: 'Out of Stock Shelf Gap', sku: 'SKU-CER-306', conf: 0.98, x: 500, y: 360, w: 140, h: 120, category: 'Shelf Stockout', objectType: 'EDIBLE_FOOD', packaging: 'Visual Shelf Gap Detected', volume: '0 Units', subtype: 'Stockout Shelf Gap', status: 'critical', stock: 0, price: '$4.39' },
      { id: 'bb-c7', kind: 'Shampoo', badge: '🧴 SHAMPOO', label: 'Shampoo (Liquid Cleanser)', sku: 'SKU-CER-309', conf: 0.89, x: 295, y: 425, w: 45, h: 110, category: 'Personal Care', objectType: 'PERFUME_COSMETICS', packaging: 'Plastic Bottle with Pump', volume: '400 ml', subtype: 'Hair Cleanser Shampoo', status: 'normal', stock: 14, price: '$7.99' },
      { id: 'bb-c8', kind: 'Human', badge: '👤 HUMAN', label: 'Human (Customer Traversal)', sku: 'PERSON-902', conf: 0.94, x: 840, y: 315, w: 50, h: 210, category: 'Shopper', objectType: 'HUMAN_SHOPPER', packaging: 'Active In-Store Movement', volume: 'Active Shopper', subtype: 'Cart Traversal', status: 'shopper', dwell: '25s', intent: 'Passing Through' }
    ],
    heatmapZones: [
      { x: 570, y: 420, r: 90, intensity: 0.92, label: 'Unfulfilled Demand Gap (Stockout)' },
      { x: 240, y: 150, r: 80, intensity: 0.70, label: 'Eye-Level Product Hotspot' }
    ]
  },
  {
    id: 'cam-traffic',
    name: 'CAM 14 · Overhead Ceiling (Aisle 7 & Concourse)',
    aisle: 'Aisle 7 Concourse',
    category: 'Foot Traffic & Pathing',
    streamUrl: './assets/camera_traffic.jpg',
    resolution: '2560x1440 @ 25 FPS',
    protocol: 'RTSP Fisheye De-warped',
    edgeLatency: '16.5 ms',
    planogramAdherence: 91.0,
    totalProductsDetected: 64,
    outOfStockCount: 1,
    boundingBoxes: [
      { id: 'bb-t1', kind: 'Human', badge: '👤 HUMAN', label: 'Human (Shopper with Cart)', sku: 'TRACK-101', conf: 0.96, x: 115, y: 430, w: 90, h: 180, category: 'Shopper', objectType: 'HUMAN_SHOPPER', packaging: 'Active Store Traversal', volume: 'Active Shopper', subtype: 'Shopper Traversal', status: 'shopper', dwell: '2m 14s', intent: 'Active Browsing' },
      { id: 'bb-t2', kind: 'Human', badge: '👤 HUMAN', label: 'Human (Browsing Shelf)', sku: 'TRACK-102', conf: 0.95, x: 315, y: 280, w: 95, h: 260, category: 'Shopper', objectType: 'HUMAN_SHOPPER', packaging: 'Active Store Traversal', volume: 'Active Shopper', subtype: 'Shelf Inspection', status: 'shopper', dwell: '3m 40s', intent: 'Comparing Items' },
      { id: 'bb-t3', kind: 'Human', badge: '👤 HUMAN', label: 'Human (Basket Pathway)', sku: 'TRACK-103', conf: 0.93, x: 505, y: 420, w: 90, h: 220, category: 'Shopper', objectType: 'HUMAN_SHOPPER', packaging: 'Active Store Traversal', volume: 'Active Shopper', subtype: 'Concourse Movement', status: 'shopper', dwell: '1m 05s', intent: 'Moving to Checkout' },
      { id: 'bb-t4', kind: 'Human', badge: '👤 HUMAN', label: 'Human (Shopper Group)', sku: 'TRACK-104', conf: 0.92, x: 695, y: 295, w: 125, h: 280, category: 'Shopper', objectType: 'HUMAN_SHOPPER', packaging: 'Active Store Traversal', volume: 'Active Shopper', subtype: 'Group Deliberation', status: 'shopper', dwell: '4m 15s', intent: 'High Dwell / Re-evaluating' }
    ],
    heatmapZones: [
      { x: 360, y: 390, r: 120, intensity: 0.88, label: 'High Dwell Mid-Aisle Node' },
      { x: 740, y: 380, r: 110, intensity: 0.94, label: 'Promotional End-Cap Anchor' },
      { x: 190, y: 520, r: 90, intensity: 0.65, label: 'Aisle Entry Convergence' }
    ]
  }
];

export const inventoryCatalog = [
  {
    sku: 'SKU-CER-306',
    name: 'Honey Nut Cheerios (18.8 oz)',
    category: 'Breakfast Cereals',
    shelfId: 'Shelf C-3 (Aisle 7)',
    currentStock: 0,
    maxCapacity: 24,
    minThreshold: 6,
    unitPrice: 4.39,
    posVelocityDay: 14.2,
    leadTimeHours: 18,
    status: 'critical',
    reorderQty: 30,
    shrinkageRisk: 'Low',
    supplier: 'General Mills Direct',
    lastAudited: '12 mins ago (YOLOv11 Edge)',
    note: 'Visual confirmation: Shelf gap detected. POS shows 14 units sold today. Expected 0 in stock.'
  },
  {
    sku: 'SKU-DRY-108',
    name: 'Oatly Barista Edition Oatmilk (32 oz)',
    category: 'Dairy & Beverages',
    shelfId: 'Shelf B-2 (Aisle 4)',
    currentStock: 3,
    maxCapacity: 20,
    minThreshold: 5,
    unitPrice: 4.99,
    posVelocityDay: 9.8,
    leadTimeHours: 24,
    status: 'low',
    reorderQty: 25,
    shrinkageRisk: 'Normal',
    supplier: 'Oatly Distribution Hub',
    lastAudited: '3 mins ago (YOLOv11 Edge)',
    note: 'Depletion rate exceeded threshold. Restock recommended before 5 PM peak foot-traffic.'
  },
  {
    sku: 'SKU-CER-305',
    name: 'Cinnamon Toast Crunch Family Size',
    category: 'Breakfast Cereals',
    shelfId: 'Shelf C-2 (Aisle 7)',
    currentStock: 4,
    maxCapacity: 22,
    minThreshold: 6,
    unitPrice: 5.19,
    posVelocityDay: 8.5,
    leadTimeHours: 24,
    status: 'low',
    reorderQty: 24,
    shrinkageRisk: 'Normal',
    supplier: 'General Mills Direct',
    lastAudited: '8 mins ago (YOLOv11 Edge)',
    note: 'Approaching critical low stock. Projected stockout in 3.4 operating hours.'
  },
  {
    sku: 'SKU-DRY-101',
    name: 'Valley Organic Whole Milk (1 Gal)',
    category: 'Dairy & Beverages',
    shelfId: 'Shelf A-1 (Aisle 4)',
    currentStock: 18,
    maxCapacity: 24,
    minThreshold: 8,
    unitPrice: 5.49,
    posVelocityDay: 16.4,
    leadTimeHours: 12,
    status: 'normal',
    reorderQty: 24,
    shrinkageRisk: 'Minimal',
    supplier: 'Organic Valley Dairy Coop',
    lastAudited: '1 min ago (YOLOv11 Edge)',
    note: 'Healthy stock buffer. Steady continuous replenishment.'
  },
  {
    sku: 'SKU-DRY-201',
    name: 'Chobani Greek Yogurt Mixed Berry (5.3 oz)',
    category: 'Dairy & Beverages',
    shelfId: 'Shelf B-1 (Aisle 4)',
    currentStock: 24,
    maxCapacity: 32,
    minThreshold: 10,
    unitPrice: 1.89,
    posVelocityDay: 28.6,
    leadTimeHours: 16,
    status: 'normal',
    reorderQty: 48,
    shrinkageRisk: 'Minimal',
    supplier: 'Chobani Logistics',
    lastAudited: '4 mins ago (YOLOv11 Edge)',
    note: 'High turnover product. High dwell time and strong POS conversion (44.2%).'
  },
  {
    sku: 'SKU-CER-301',
    name: 'Frosted Flakes Cereal Large Size',
    category: 'Breakfast Cereals',
    shelfId: 'Shelf A-3 (Aisle 7)',
    currentStock: 15,
    maxCapacity: 20,
    minThreshold: 6,
    unitPrice: 4.29,
    posVelocityDay: 7.1,
    leadTimeHours: 24,
    status: 'normal',
    reorderQty: 20,
    shrinkageRisk: 'Minimal',
    supplier: 'Kellogg Direct Supply',
    lastAudited: '6 mins ago (YOLOv11 Edge)',
    note: 'Stock level optimal. Eye-level planogram compliance at 98%.'
  },
  {
    sku: 'SKU-DRY-102',
    name: 'Valley 2% Reduced Fat Milk (1 Gal)',
    category: 'Dairy & Beverages',
    shelfId: 'Shelf A-2 (Aisle 4)',
    currentStock: 14,
    maxCapacity: 24,
    minThreshold: 8,
    unitPrice: 5.29,
    posVelocityDay: 12.0,
    leadTimeHours: 12,
    status: 'normal',
    reorderQty: 20,
    shrinkageRisk: 'Minimal',
    supplier: 'Organic Valley Dairy Coop',
    lastAudited: '1 min ago (YOLOv11 Edge)',
    note: 'Standard velocity. Adequate inventory for next 14 hours.'
  },
  {
    sku: 'SKU-CER-304',
    name: 'Cheerios Whole Grain Oats (14 oz)',
    category: 'Breakfast Cereals',
    shelfId: 'Shelf B-1 (Aisle 7)',
    currentStock: 20,
    maxCapacity: 24,
    minThreshold: 6,
    unitPrice: 3.99,
    posVelocityDay: 11.4,
    leadTimeHours: 18,
    status: 'normal',
    reorderQty: 24,
    shrinkageRisk: 'Minimal',
    supplier: 'General Mills Direct',
    lastAudited: '7 mins ago (YOLOv11 Edge)',
    note: 'Optimal shelf presence. Zero stockout alert.'
  },
  {
    sku: 'SKU-PRF-401',
    name: 'Chanel No. 5 Eau de Parfum (100ml)',
    category: 'Perfumes & Cosmetics',
    objectType: 'PERFUME_COSMETICS',
    consumeType: 'External Fragrance (Non-Edible)',
    shelfId: 'Shelf L-1 (Aisle 3)',
    currentStock: 12,
    maxCapacity: 20,
    minThreshold: 4,
    unitPrice: 145.00,
    posVelocityDay: 3.4,
    leadTimeHours: 48,
    status: 'normal',
    reorderQty: 10,
    shrinkageRisk: 'High (Luxury Good)',
    supplier: 'Chanel Luxury Logistics',
    lastAudited: '1 min ago (YOLOv11 Edge)',
    note: 'High-value fragrance item. Secured shelf sensor active.'
  },
  {
    sku: 'SKU-PRF-402',
    name: 'Dior Sauvage Elixir Spray (60ml)',
    category: 'Perfumes & Cosmetics',
    objectType: 'PERFUME_COSMETICS',
    consumeType: 'External Fragrance (Non-Edible)',
    shelfId: 'Shelf L-2 (Aisle 3)',
    currentStock: 8,
    maxCapacity: 15,
    minThreshold: 3,
    unitPrice: 165.00,
    posVelocityDay: 4.1,
    leadTimeHours: 48,
    status: 'normal',
    reorderQty: 8,
    shrinkageRisk: 'High (Luxury Good)',
    supplier: 'LVMH Fragrance Distribution',
    lastAudited: '2 mins ago (YOLOv11 Edge)',
    note: 'Top seller in luxury fragrance. Dwell to purchase ratio 68%.'
  }
];

export const hourlyTelemetryData = [
  { time: '08:00', footTraffic: 24, dwellMin: 1.4, posSalesQty: 18, revenue: '$142.50', conversionRate: 75.0, stockDetections: 142 },
  { time: '09:00', footTraffic: 48, dwellMin: 2.1, posSalesQty: 32, revenue: '$268.90', conversionRate: 66.6, stockDetections: 139 },
  { time: '10:00', footTraffic: 76, dwellMin: 2.8, posSalesQty: 54, revenue: '$482.10', conversionRate: 71.0, stockDetections: 133 },
  { time: '11:00', footTraffic: 112, dwellMin: 3.4, posSalesQty: 79, revenue: '$714.40', conversionRate: 70.5, stockDetections: 124 },
  { time: '12:00', footTraffic: 145, dwellMin: 3.9, posSalesQty: 104, revenue: '$986.30', conversionRate: 71.7, stockDetections: 112 },
  { time: '13:00', footTraffic: 138, dwellMin: 3.6, posSalesQty: 96, revenue: '$890.00', conversionRate: 69.5, stockDetections: 104 },
  { time: '14:00', footTraffic: 98, dwellMin: 2.9, posSalesQty: 68, revenue: '$612.80', conversionRate: 69.3, stockDetections: 98 },
  { time: '15:00', footTraffic: 110, dwellMin: 3.2, posSalesQty: 74, revenue: '$694.50', conversionRate: 67.2, stockDetections: 92 },
  { time: '16:00', footTraffic: 154, dwellMin: 4.1, posSalesQty: 116, revenue: '$1,084.20', conversionRate: 75.3, stockDetections: 84 },
  { time: '17:00 (Peak)', footTraffic: 182, dwellMin: 4.6, posSalesQty: 138, revenue: '$1,342.00', conversionRate: 75.8, stockDetections: 73 },
  { time: '18:00 (Current)', footTraffic: 165, dwellMin: 4.2, posSalesQty: 122, revenue: '$1,195.40', conversionRate: 73.9, stockDetections: 68 }
];

export const academicReviewContext = {
  projectTitle: 'CV-Based Sales Analytics Engine',
  subtitle: 'Computer vision and conversational AI for smart-retail shelf monitoring',
  author: 'Harish',
  reviewStage: 'Academic Project · Review 2',
  architectureLayers: [
    {
      level: '1. Edge Layer',
      tech: 'Python, OpenCV, PyTorch, YOLOv11',
      hardware: 'Jetson Orin Nano / On-Premise GPU Workstation',
      function: 'Captures in-store RTSP feeds locally, runs high-speed frame inference (30+ FPS) to extract product bounding boxes, stock coordinates, and foot-traffic trajectories without sending uncompressed video outside the store.'
    },
    {
      level: '2. Sync Layer',
      tech: 'Firebase Firestore, Cloud Functions, MCP Server',
      hardware: 'Managed Google Cloud Infrastructure',
      function: 'Transfers structured telemetry packets (SKUs, bounding-box events, shelf state diffs, timestamps) via Model Context Protocol (MCP) tool bindings to Firestore with sub-second synchronization.'
    },
    {
      level: '3. Intelligence Layer',
      tech: 'Google Antigravity Copilot Agent + LLM Reasoning',
      hardware: 'Cloud Agent Execution Environment',
      function: 'Synthesizes real-time visual shelf inventory with POS sales logs, applies predictive safety-stock algorithms, detects shrinkage anomalies, and generates natural-language answers to executive retail queries.'
    },
    {
      level: '4. Presentation Layer',
      tech: 'Interactive React/Modern Web Dashboard & Visual Overlays',
      hardware: 'Manager-Facing Desktop / Tablet Back-Office Terminal',
      function: 'Displays live camera feeds with interactive bounding-box overlays, planogram compliance meters, real-time stockout alerts, predictive sales fusion charts, and the conversational AI chat interface.'
    }
  ],
  literatureSurvey: [
    {
      reference: 'Retail AI Copilots (2024)',
      authors: 'Furmakiewicz, Liu, Taylor, Venger',
      summary: 'Architectures for retail copilots using LLMs, orchestration, plugins, and knowledge retrieval.',
      relationToProject: 'Blueprint for the Conversational AI Copilot module and tool orchestration.'
    },
    {
      reference: 'YOLO11 Real-Time Object Detection (2024)',
      authors: 'Ultralytics Team (Glenn Jocher et al.)',
      summary: 'State-of-the-art vision architecture featuring C3k2 and C2PSA attention blocks, achieving superior mAP with ultra-low edge latency.',
      relationToProject: 'Primary CV detection model for packaging, SKU classification, and shelf bounding-box extraction.'
    },
    {
      reference: 'Firebase AI & MCP Server (2026)',
      authors: 'Google Firebase',
      summary: 'Agent Skills and Model Context Protocol server enabling AI assistants to securely interact with Firestore & Cloud Functions.',
      relationToProject: 'Powers backend data sync, tool-safe database queries, and live state updates.'
    },
    {
      reference: 'Google Antigravity Integration (2026)',
      authors: 'Google Firebase Blog',
      summary: 'Advanced agent development patterns connecting Antigravity reasoning with real-time operational datastores.',
      relationToProject: 'Provides multi-step reasoning, plan synthesis, and operational retail copilot interface.'
    },
    {
      reference: 'A Survey of Large Language Models (2023)',
      authors: 'Zhao et al.',
      summary: 'Comprehensive review of LLM architectures, instruction tuning, multi-step chain-of-thought reasoning, and domain adaptation.',
      relationToProject: 'Theoretical foundation for the retail copilot\'s conversational intelligence and analytical reasoning.'
    }
  ],
  researchGapsAddressed: [
    {
      gap: 'Detection stops at the bounding box',
      priorWork: 'YOLOv11 research optimizes pure mAP and inference FPS, but fails to bridge detections into enterprise ERP/POS systems.',
      solutionInProject: 'Our engine parses bounding boxes into discrete SKU inventory deltas, binding visual presence directly into live business telemetry.'
    },
    {
      gap: 'Copilots assume clean data already exists',
      priorWork: 'Existing retail copilots assume a pre-populated, pristine database without accounting for real-world physical shelf disarray.',
      solutionInProject: 'Our closed-loop pipeline generates and reconciles live ground-truth data from raw CCTV video feeds before feeding the LLM.'
    },
    {
      gap: 'Agent-cloud docs are domain-generic',
      priorWork: 'Firebase and Antigravity guides demonstrate generic conversational bots without domain models for retail inventory physics.',
      solutionInProject: 'We implement specialized retail heuristics (planogram compliance, dwell-time-to-purchase conversion, shrinkage delta).'
    },
    {
      gap: 'No end-to-end reference system',
      priorWork: 'No single prior published work connects commodity CCTV cameras, edge CV, cloud sync, and an AI conversational copilot in a unified runnable pipeline.',
      solutionInProject: 'Delivers a full-stack, deployable 4-layer edge-to-cloud reference implementation.'
    }
  ],
  vivaQnA: [
    {
      q: 'Why did you select YOLOv11 instead of larger models like YOLOv8 or Faster R-CNN for the edge?',
      a: 'YOLOv11 offers the optimal balance of inference throughput (30+ FPS on edge embedded GPUs like Jetson Orin Nano) with minimal memory footprint (under 30MB FP16). Faster R-CNN is too compute-intensive for edge streams, while YOLOv11 achieves over 92% mAP on dense retail shelf packaging with TensorRT optimization.'
    },
    {
      q: 'How does the system distinguish between a temporary customer inspection and an actual out-of-stock event?',
      a: 'We implement a temporal persistence buffer (hysteresis filter). An item must be visually absent for consecutive frames across a parameterized dwell threshold (e.g. 60 seconds) or cross-verified against a concurrent POS barcode scan before transitioning from "In Flux" to "Critical Stockout".'
    },
    {
      q: 'How does the Model Context Protocol (MCP) server ensure database safety?',
      a: 'The MCP server exposes constrained, schema-validated tool definitions (`query_shelf_stock`, `trigger_reorder_po`, `get_traffic_analytics`). The LLM cannot execute raw arbitrary database queries; it can only invoke parameterized read/write tools that enforce role-based access control and inventory business rules.'
    },
    {
      q: 'What is the shrinkage anomaly formula used when fusing video with POS sales?',
      a: 'Shrinkage is computed as: Shrinkage_Delta = (Visual_Shelf_Depletion_Count) - (POS_Recorded_Checkouts + Permitted_Damaged_Writeoffs). If the delta exceeds statistical tolerance over a sliding 2-hour window, the copilot flags an anomaly alert for staff review.'
    },
    {
      q: 'How do you handle visual occlusion caused by customers standing in front of shelves?',
      a: 'Our edge tracker couples person-detection bounding boxes with shelf zones. When a shopper bounding box overlaps a shelf zone, that specific zone is marked as "Occluded/Pending". The system preserves previous state until the shopper moves away, then re-samples ground truth within 500ms.'
    }
  ]
};
