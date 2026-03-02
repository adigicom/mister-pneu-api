import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    // Informations Gateway ISB-IT
    articleSystemNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    articleCode: {
      type: String,
      required: true,
    },

    // Informations de base
    brand: {
      type: String,
      required: true,
      index: true,
    },
    groupNumber: String,
    description: {
      type: String,
      required: true,
    },
    productName: String, // Pour les pneus

    // Prix
    currency: {
      type: String,
      default: 'EUR',
    },
    netPrice: {
      type: Number,
      required: true,
    },
    grossPrice: Number,
    garagePrice: Number,
    calculatorPrice: Number,
    // Prix de vente avec marge de 30%
    sellingPrice: {
      type: Number,
      required: true,
    },

    // Stock
    available: {
      type: Number,
      default: 0,
    },
    inStock: {
      type: Boolean,
      default: false,
    },

    // Images
    pictureName: String,
    imageUrl: String,

    // Caractéristiques techniques (pneus)
    width: Number,
    height: Number, // HBV
    diameter: Number,
    speedIndex: String,
    loadIndex: String,
    plyRating: String,

    // Caractéristiques (roues)
    wheelDiameter: Number,
    wheelWidth: Number,
    offset: Number,
    centreHole: Number,
    pcd: String,
    pcd2: String,

    // Labels énergétiques EU
    rollingResistance: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', ''],
      default: '',
    },
    wetGrip: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', ''],
      default: '',
    },
    noiseEmissionDB: Number,
    noiseEmissionClass: {
      type: String,
      default: '',
    },

    // Certifications
    threepmsfCertified: {
      type: Boolean,
      default: false,
    },
    iceGrip: {
      type: Boolean,
      default: false,
    },
    eMarked: {
      type: Boolean,
      default: false,
    },
    tuvCertified: {
      type: Boolean,
      default: false,
    },

    // Autres
    eanCode: String,
    supplierID: String,
    eprelId: String,
    weightCategory: {
      type: Number,
      enum: [0, 1, 2], // 0=not rated, 1=light, 2=heavy
      default: 0,
    },

    // Pneus occasion
    condition: {
      type: String,
      enum: ['new', 'excellent', 'good', 'fair'],
      default: 'new',
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    photos: [String],
    usageKm: Number,
    treadDepth: Number,
    yearOfManufacture: Number,

    // Métadonnées
    category: {
      type: String,
      enum: ['tires', 'wheels', 'accessories'],
      default: 'tires',
    },
    season: {
      type: String,
      enum: ['summer', 'winter', 'all-season', 'none'],
      default: 'none',
    },

    // Recherche
    searchKeywords: [String],

    // Délai de livraison (en jours)
    deliveryDays: {
      type: Number,
      default: 2,
    },
  },
  {
    timestamps: true,
  }
);

// Index pour la recherche
productSchema.index({
  brand: 1,
  width: 1,
  height: 1,
  diameter: 1
});

productSchema.index({
  description: 'text',
  brand: 'text',
  productName: 'text'
});

// Calcul automatique du prix de vente avec marge
productSchema.pre('save', function(next) {
  if (this.isModified('netPrice')) {
    const margin = parseFloat(process.env.PROFIT_MARGIN) || 0.30;
    this.sellingPrice = Math.round(this.netPrice * (1 + margin) * 100) / 100;
  }

  // Calcul du délai de livraison
  const inStockDays = parseInt(process.env.DEFAULT_DELIVERY_DAYS_IN_STOCK) || 2;
  const outOfStockDays = parseInt(process.env.DEFAULT_DELIVERY_DAYS_OUT_OF_STOCK) || 5;
  this.deliveryDays = this.available > 0 ? inStockDays : outOfStockDays;
  this.inStock = this.available > 0;

  next();
});

// Méthode pour obtenir les informations de livraison
productSchema.methods.getDeliveryInfo = function() {
  return {
    available: this.available,
    inStock: this.inStock,
    deliveryDays: this.deliveryDays,
    estimatedDeliveryDate: new Date(Date.now() + this.deliveryDays * 24 * 60 * 60 * 1000),
  };
};

const Product = mongoose.model('Product', productSchema);

export default Product;
