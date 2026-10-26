// productKnowledgeBase.js - Retail Product Kind Recognition & Vision Feature Intelligence Engine
// Classifies framed objects into broad, intuitive product kinds:
// 🥤 Beverage | 🥔 Chips | 🫙 Pickle | 🍪 Biscuits | 🧴 Shampoo | 🌸 Perfume | 💄 Cosmetics | 🥛 Milk | 🥣 Cereal | 🍎 Fruits | 📱 Electronics | 👤 Human

export class ProductIntelligenceEngine {
  constructor() {
    this.storageKey = 'cv_retail_product_kind_weights';
    this.userTrainedWeights = this.loadUserWeights();

    // Standard Retail Product Kinds Taxonomy
    this.baseTaxonomy = [
      {
        id: 'kind-beverage',
        kind: 'Beverage',
        name: 'Beverage (Cold Drink / Soda / Can)',
        badge: '🥤 BEVERAGE',
        domain: 'EDIBLE_FOOD',
        packaging: 'Aluminum Can / PET Bottle / Glass Bottle',
        description: 'Drink / Carbonated Beverage / Fruit Juice',
        volume: '330 ml / 500 ml',
        shelfLife: '12 Months (Ambient or Chilled)',
        price: 2.49,
        sku: 'SKU-BEV-101',
        supplier: 'Beverage Bottlers Direct',
        idealRatio: 2.1, // Tall cylinder
        ratioTolerance: 0.7,
        colorHints: ['red', 'blue', 'silver', 'black', 'green'],
        specularGloss: 'METALLIC_ALUMINUM',
        keywords: ['bottle', 'cup', 'can', 'drink', 'beverage', 'wine glass', 'soda'],
        confBase: 0.98
      },
      {
        id: 'kind-chips',
        kind: 'Chips',
        name: 'Chips (Crispy Potato / Tortilla Snack)',
        badge: '🥔 CHIPS',
        domain: 'EDIBLE_FOOD',
        packaging: 'Nitrogen-Flushed Metallized Foil Pillow Pouch',
        description: 'Crispy Salted Potato Chips / Wafers / Snacks',
        volume: '180g / 6.3 oz Party Pack',
        shelfLife: '6 Months (Dry Ambient)',
        price: 3.49,
        sku: 'SKU-CHP-201',
        supplier: 'Snack Foods Wholesale Network',
        idealRatio: 1.25, // Pillow bag
        ratioTolerance: 0.5,
        colorHints: ['yellow', 'red', 'gold', 'blue'],
        specularGloss: 'GLOSS_METALLIC_FOIL',
        keywords: ['box', 'book', 'bag', 'chips', 'snack', 'pillow'],
        confBase: 0.97
      },
      {
        id: 'kind-pickle',
        kind: 'Pickle',
        name: 'Pickle (Preserved Jar / Condiments)',
        badge: '🫙 PICKLE',
        domain: 'EDIBLE_FOOD',
        packaging: 'Heavy Glass Jar with Airtight Metal Vacuum Lug Cap',
        description: 'Pickled Cucumbers / Mango Pickle / Preserved Relish',
        volume: '450g / 16 oz Glass Jar',
        shelfLife: '24 Months (Ambient Dark Pantry)',
        price: 4.99,
        sku: 'SKU-PCK-301',
        supplier: 'Artisanal Preserves & Condiments Hub',
        idealRatio: 1.35, // Glass jar
        ratioTolerance: 0.45,
        colorHints: ['green', 'amber', 'yellow_red', 'dark_green'],
        specularGloss: 'HIGH_GLOSS_GLASS',
        keywords: ['bottle', 'cup', 'jar', 'bowl', 'pickle', 'vase'],
        confBase: 0.97
      },
      {
        id: 'kind-biscuits',
        kind: 'Biscuits',
        name: 'Biscuits (Cookies / Baked Snacks)',
        badge: '🍪 BISCUITS',
        domain: 'EDIBLE_FOOD',
        packaging: 'Easy-Peel Resealable Barrier Foil Wrap over Tray',
        description: 'Cream Sandwich Biscuits / Sweet Cookies / Crackers',
        volume: '300g / 10.5 oz',
        shelfLife: '9 Months (Dry Pantry)',
        price: 2.99,
        sku: 'SKU-BSC-401',
        supplier: 'National Bakery & Biscuit Guild',
        idealRatio: 0.85, // Wide rectangular roll
        ratioTolerance: 0.5,
        colorHints: ['blue', 'chocolate_brown', 'white', 'red'],
        specularGloss: 'METALLIC_WRAPPER',
        keywords: ['book', 'box', 'sandwich', 'biscuit', 'cookie'],
        confBase: 0.96
      },
      {
        id: 'kind-shampoo',
        kind: 'Shampoo',
        name: 'Shampoo (Haircare & Liquid Cleanser)',
        badge: '🧴 SHAMPOO',
        domain: 'PERFUME_COSMETICS',
        packaging: 'Ergonomic Plastic Bottle with Pump or Flip-Top Cap',
        description: 'Hair Cleansing Shampoo / Conditioner / Body Wash',
        volume: '400 ml / 13.5 fl oz',
        shelfLife: '36 Months (Bathroom Care)',
        price: 7.99,
        sku: 'SKU-SHP-501',
        supplier: 'Personal Hygiene & Haircare Direct',
        idealRatio: 2.3, // Tall plastic bottle
        ratioTolerance: 0.6,
        colorHints: ['white', 'blue', 'green', 'black'],
        specularGloss: 'SATIN_PLASTIC',
        keywords: ['bottle', 'cup', 'shampoo', 'lotion', 'soap'],
        confBase: 0.96
      },
      {
        id: 'kind-perfume',
        kind: 'Perfume',
        name: 'Perfume (Fragrance / Cologne Spray)',
        badge: '🌸 PERFUME',
        domain: 'PERFUME_COSMETICS',
        packaging: 'Faceted Glass Flacon with Metallic Atomizer Spray Nozzle',
        description: 'Eau de Parfum / Luxury Cologne / Fragrance Mist',
        volume: '100 ml / 3.4 fl oz',
        shelfLife: '36 Months (Keep Away from Sunlight)',
        price: 85.00,
        sku: 'SKU-PRF-601',
        supplier: 'Prestige Fragrances & Parfums Hub',
        idealRatio: 1.85,
        ratioTolerance: 0.7,
        colorHints: ['amber', 'dark_blue', 'gold', 'clear', 'black'],
        specularGloss: 'HIGH_GLOSS_GLASS',
        keywords: ['bottle', 'cup', 'vase', 'perfume', 'cologne', 'spray'],
        confBase: 0.98
      },
      {
        id: 'kind-cosmetics',
        kind: 'Cosmetics',
        name: 'Cosmetics (Facial Skincare / Serum / Cream)',
        badge: '💄 COSMETICS',
        domain: 'PERFUME_COSMETICS',
        packaging: 'UV-Protected Dropper Pipette Bottle or Acrylic Cream Tub',
        description: 'Anti-Aging Serum / Moisturizer / Face Foundation',
        volume: '50 ml / 1.7 fl oz',
        shelfLife: '24 Months (Topical Skincare)',
        price: 24.50,
        sku: 'SKU-COS-701',
        supplier: 'Clinical Cosmetics & Skincare Direct',
        idealRatio: 1.4,
        ratioTolerance: 0.6,
        colorHints: ['pink', 'translucent_red', 'white', 'amber'],
        specularGloss: 'POLISHED_ACRYLIC',
        keywords: ['bottle', 'cup', 'bowl', 'jar', 'serum', 'cosmetic'],
        confBase: 0.95
      },
      {
        id: 'kind-milk',
        kind: 'Milk',
        name: 'Milk (Dairy / Milk Jug / Carton)',
        badge: '🥛 MILK',
        domain: 'EDIBLE_FOOD',
        packaging: 'BPA-Free HDPE Plastic Jug with Molded Handle',
        description: 'Fresh Pasteurized Dairy Whole Milk',
        volume: '1 Gallon / 3.78 Litres',
        shelfLife: '14 Days (Refrigerate 4°C)',
        price: 4.29,
        sku: 'SKU-MLK-801',
        supplier: 'Fresh Dairy Farmers Cooperative',
        idealRatio: 1.35,
        ratioTolerance: 0.45,
        colorHints: ['white', 'translucent_milk', 'blue_cap', 'red_cap'],
        specularGloss: 'MATTE_PLASTIC',
        keywords: ['bottle', 'cup', 'jug', 'milk', 'dairy'],
        confBase: 0.99
      },
      {
        id: 'kind-cereal',
        kind: 'Cereal',
        name: 'Cereal (Breakfast Flakes / Oats Box)',
        badge: '🥣 CEREAL',
        domain: 'EDIBLE_FOOD',
        packaging: 'Recyclable Paperboard Box with Moisture Barrier Liner',
        description: 'Toasted Grain Breakfast Cereal / Rolled Oats',
        volume: '500g / 17.6 oz Box',
        shelfLife: '12 Months (Dry Pantry)',
        price: 4.50,
        sku: 'SKU-CER-901',
        supplier: 'Grain Mills Wholesale Direct',
        idealRatio: 1.6,
        ratioTolerance: 0.45,
        colorHints: ['yellow', 'gold', 'red', 'orange'],
        specularGloss: 'MATTE_PAPERBOARD',
        keywords: ['box', 'book', 'cereal', 'food'],
        confBase: 0.96
      },
      {
        id: 'kind-fruits',
        kind: 'Fruits',
        name: 'Fruits (Fresh Produce / Apple / Citrus)',
        badge: '🍎 FRUITS',
        domain: 'EDIBLE_FOOD',
        packaging: 'Bulk Farm Fresh Orchard Produce (Unpackaged)',
        description: 'Fresh Crisp Apples / Bananas / Oranges',
        volume: 'Single Piece / Sold by Weight',
        shelfLife: '10 Days (Fresh Produce Aisle)',
        price: 0.99,
        sku: 'SKU-FRT-101',
        supplier: 'Valley Orchard Growers Direct',
        idealRatio: 1.05,
        ratioTolerance: 0.3,
        colorHints: ['crimson_red', 'yellow_red', 'green'],
        specularGloss: 'NATURAL_WAX_GLOSS',
        keywords: ['apple', 'orange', 'banana', 'fruit', 'food'],
        confBase: 0.99
      },
      {
        id: 'kind-electronics',
        kind: 'Electronics',
        name: 'Electronics (Smartphone / Device / Gadget)',
        badge: '📱 ELECTRONICS',
        domain: 'UTILITY_ITEM',
        packaging: 'Rigid Paperboard Presentation Box with Security Seal',
        description: '5G Smartphone Handset / Scanner / Mobile Terminal',
        volume: 'Single Unit',
        shelfLife: 'Non-Perishable (Secure Display)',
        price: 599.00,
        sku: 'SKU-ELC-101',
        supplier: 'Consumer Electronics Global Hub',
        idealRatio: 2.05,
        ratioTolerance: 0.5,
        colorHints: ['black', 'titanium_grey', 'silver', 'dark'],
        specularGloss: 'MATTE_TITANIUM_GLASS',
        keywords: ['cell phone', 'remote', 'electronics', 'phone'],
        confBase: 0.98
      },
      {
        id: 'kind-human',
        kind: 'Human',
        name: 'Human (Customer / Shopper / Staff)',
        badge: '👤 HUMAN',
        domain: 'HUMAN_SHOPPER',
        packaging: 'Active Store Shopper Trajectory & Dwell',
        description: 'Person Browsing Aisle / In Front of Camera',
        volume: 'Customer In-Store',
        shelfLife: 'Active Real-Time Tracking',
        price: 0.00,
        sku: 'PERSON-TRACK',
        supplier: 'In-Store DeepSORT Tracking Engine',
        idealRatio: 2.2,
        ratioTolerance: 0.9,
        colorHints: ['neutral', 'clothing_varies'],
        specularGloss: 'MATTE',
        keywords: ['person', 'human', 'shopper', 'customer'],
        confBase: 0.99
      }
    ];
  }

  loadUserWeights() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Could not read user trained weights', e);
      }
    }
    return [];
  }

  saveUserWeights() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.userTrainedWeights));
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Could not persist trained weights', e);
      }
    }
  }

  trainProductKind(sampleData) {
    const newProfile = {
      id: `custom-kind-${Date.now()}`,
      kind: sampleData.kind || 'Custom Product',
      name: `${sampleData.kind} (${sampleData.description || 'Calibrated Product'})`,
      badge: sampleData.badge || `🏷️ ${sampleData.kind.toUpperCase()}`,
      domain: sampleData.domain || 'EDIBLE_FOOD',
      packaging: sampleData.packaging || 'Standard Packaging',
      description: sampleData.description || 'User Calibrated Product Kind',
      volume: sampleData.volume || '1 Unit',
      shelfLife: sampleData.shelfLife || 'Ambient Display',
      price: parseFloat(sampleData.price) || 5.99,
      sku: sampleData.sku || `SKU-CAL-${Math.floor(1000 + Math.random() * 9000)}`,
      supplier: 'Store Manager Custom Registry',
      idealRatio: parseFloat(sampleData.aspectRatio) || 1.5,
      ratioTolerance: 0.8,
      colorHints: sampleData.colorHints || ['neutral'],
      specularGloss: 'POLISHED',
      keywords: [(sampleData.kind || '').toLowerCase(), 'bottle', 'box', 'can', 'jar', 'custom'],
      confBase: 0.99,
      calibratedAt: new Date().toISOString()
    };

    this.userTrainedWeights = [newProfile, ...this.userTrainedWeights.filter(p => p.kind !== newProfile.kind)];
    this.saveUserWeights();
    return newProfile;
  }

  trainProduct(sampleData) {
    return this.trainProductKind(sampleData);
  }

  getAllTaxonomy() {
    return [...this.userTrainedWeights, ...this.baseTaxonomy];
  }

  extractOpticalFeatures(videoOrCanvas, bbox) {
    const w = Math.max(10, bbox[2]);
    const h = Math.max(10, bbox[3]);
    const aspectRatio = h / w;

    let dominantColor = 'neutral';
    let glossIndex = 0.5;

    try {
      const scratch = document.createElement('canvas');
      scratch.width = 32;
      scratch.height = 32;
      const sCtx = scratch.getContext('2d');
      if (sCtx && videoOrCanvas) {
        sCtx.drawImage(videoOrCanvas, bbox[0], bbox[1], w, h, 0, 0, 32, 32);
        const imgData = sCtx.getImageData(0, 0, 32, 32).data;
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        let brightPixels = 0;

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          rSum += r;
          gSum += g;
          bSum += b;
          count++;

          const lum = (0.299 * r + 0.587 * g + 0.114 * b);
          if (lum > 210) brightPixels++;
        }

        const avgR = rSum / count;
        const avgG = gSum / count;
        const avgB = bSum / count;
        glossIndex = brightPixels / count;

        if (avgR > 140 && avgG < 90 && avgB < 90) dominantColor = 'red';
        else if (avgG > 120 && avgR < 100 && avgB < 100) dominantColor = 'green';
        else if (avgR > 130 && avgG > 110 && avgB < 70) dominantColor = 'amber';
        else if (avgB > 130 && avgR < 100) dominantColor = 'blue';
        else if (avgR > 180 && avgG > 180 && avgB > 180) dominantColor = 'white';
        else if (avgR < 50 && avgG < 50 && avgB < 50) dominantColor = 'black';
      }
    } catch (e) {}

    return {
      aspectRatio,
      dominantColor,
      glossIndex
    };
  }

  /**
   * Matches framed object features into a broad, clear Product Kind
   */
  classifyProductKind(cocoClass, bbox, opticalFeatures = {}) {
    const cls = (cocoClass || '').toLowerCase();
    const ar = opticalFeatures.aspectRatio || (bbox ? bbox[3] / Math.max(1, bbox[2]) : 1.5);
    const color = opticalFeatures.dominantColor || 'neutral';
    const allTaxonomy = this.getAllTaxonomy();

    // 1. Check for Person / Human first
    if (cls === 'person' || cls.includes('person') || cls.includes('human')) {
      const humanItem = allTaxonomy.find(p => p.kind === 'Human') || this.baseTaxonomy[11];
      return {
        product: humanItem,
        confidence: 0.99,
        aspectRatio: ar.toFixed(2),
        dominantColor: color,
        isUserTrained: false
      };
    }

    let bestMatch = null;
    let highestScore = -1;

    for (const prod of allTaxonomy) {
      if (prod.kind === 'Human') continue; // Handled above

      let score = 0;

      // Semantic keyword correlation
      if (prod.keywords.some(k => cls.includes(k) || k.includes(cls))) {
        score += 35;
      }

      // Aspect Ratio proximity
      const ratioDiff = Math.abs(prod.idealRatio - ar);
      if (ratioDiff < prod.ratioTolerance) {
        score += Math.max(0, 30 * (1 - ratioDiff / prod.ratioTolerance));
      }

      // User-calibrated priority
      if (prod.id.startsWith('custom-kind-')) {
        score += 25;
      }

      // Color hint correlation
      if (prod.colorHints.some(c => c.includes(color) || color.includes(c))) {
        score += 15;
      }

      // High gloss correlation (glass bottles / pickle jars / perfume)
      if (opticalFeatures.glossIndex > 0.25 && (prod.specularGloss === 'HIGH_GLOSS_GLASS' || prod.specularGloss === 'METALLIC_ALUMINUM')) {
        score += 10;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = prod;
      }
    }

    // Default intelligent fallbacks based on geometry if score is ambiguous
    if (!bestMatch || highestScore < 15) {
      if (ar > 2.0) {
        bestMatch = allTaxonomy.find(p => p.kind === 'Shampoo') || allTaxonomy.find(p => p.kind === 'Beverage');
      } else if (ar > 1.6) {
        bestMatch = allTaxonomy.find(p => p.kind === 'Perfume') || allTaxonomy.find(p => p.kind === 'Cereal');
      } else if (ar > 1.2 && ar < 1.5) {
        bestMatch = color === 'green' || color === 'amber'
          ? (allTaxonomy.find(p => p.kind === 'Pickle') || allTaxonomy.find(p => p.kind === 'Chips'))
          : (allTaxonomy.find(p => p.kind === 'Milk') || allTaxonomy.find(p => p.kind === 'Chips'));
      } else if (ar < 1.0) {
        bestMatch = allTaxonomy.find(p => p.kind === 'Biscuits') || allTaxonomy.find(p => p.kind === 'Fruits');
      } else {
        bestMatch = allTaxonomy.find(p => p.kind === 'Beverage');
      }
    }

    const calculatedConf = Math.min(0.99, Math.max(0.82, (highestScore / 100) * 0.4 + (bestMatch ? bestMatch.confBase : 0.95) * 0.6));

    return {
      product: bestMatch || this.baseTaxonomy[0],
      confidence: calculatedConf,
      aspectRatio: ar.toFixed(2),
      dominantColor: color,
      isUserTrained: bestMatch ? bestMatch.id.startsWith('custom-kind-') : false
    };
  }

  classifyProduct(cocoClass, bbox, opticalFeatures = {}) {
    return this.classifyProductKind(cocoClass, bbox, opticalFeatures);
  }
}

export const productIntelligenceEngine = new ProductIntelligenceEngine();
