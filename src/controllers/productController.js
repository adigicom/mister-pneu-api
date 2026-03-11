import mongoose from 'mongoose';
import Product from '../models/Product.js';
import gatewayService from '../services/gatewayService.js';
import syncService from '../services/syncService.js';
import plateService from '../services/plateService.js';

/**
 * Rechercher des pneus par dimensions
 * Cherche d'abord en DB locale, puis complète depuis le Gateway
 */
export const searchByDimensions = async (req, res) => {
  try {
    const { width, height, diameter, season } = req.query;

    if (!width || !height || !diameter) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir les dimensions complètes (largeur, hauteur, diamètre)',
      });
    }

    // Chercher en DB locale d'abord
    const filter = {
      width: parseInt(width),
      height: parseInt(height),
      diameter: parseInt(diameter),
    };
    if (season) filter.season = season;

    let products = await Product.find(filter).sort({ sellingPrice: 1 });

    // Si pas de résultats en DB, interroger le Gateway et synchroniser
    if (products.length === 0) {
      try {
        const searchText = `${width}${String(height).padStart(2, '0')}${diameter}`;
        products = await syncService.searchAndSync(searchText);

        // Filtrer par saison si demandé
        if (season) {
          products = products.filter(p => p.season === season);
        }
      } catch (gatewayError) {
        console.error('Gateway non disponible, résultats DB uniquement:', gatewayError.message);
      }
    }

    console.log(`✅ ${products.length} produits pour ${width}/${height}R${diameter}`);

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Error in searchByDimensions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche des produits',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Rechercher des pneus par véhicule (via Gateway Protocol 103)
 */
export const searchByVehicle = async (req, res) => {
  try {
    const { brand, model, year } = req.query;

    if (!brand || !model) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir la marque et le modèle du véhicule',
      });
    }

    // Rechercher via le Gateway et synchroniser
    const searchText = `${brand} ${model}${year ? ` ${year}` : ''}`;
    const products = await syncService.searchAndSync(searchText);

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Error in searchByVehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche des produits',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Cache mémoire des plaques déjà recherchées (évite de rappeler l'API SIV)
 * TTL : 1 heure
 */
const plateCache = new Map();
const PLATE_CACHE_TTL = 60 * 60 * 1000;

/**
 * Rechercher des pneus par plaque d'immatriculation française
 * Optimisé : DB locale d'abord, Gateway en arrière-plan si besoin
 */
export const searchByPlate = async (req, res) => {
  try {
    const { plate } = req.query;

    if (!plate) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un numéro de plaque d\'immatriculation',
      });
    }

    const cleanPlate = plate.replace(/[-\s]/g, '').toUpperCase();

    // 1. Vérifier le cache plaque
    let plateResult = plateCache.get(cleanPlate);
    if (!plateResult) {
      try {
        plateResult = await plateService.lookupPlate(cleanPlate);
        plateCache.set(cleanPlate, plateResult);
        setTimeout(() => plateCache.delete(cleanPlate), PLATE_CACHE_TTL);
      } catch (plateError) {
        console.error('Erreur API plaque:', plateError.message);
        return res.status(400).json({
          success: false,
          message: plateError.message || 'Impossible d\'identifier le véhicule. Vérifiez la plaque.',
        });
      }
    }

    const { vehicle, tireSizes } = plateResult;

    // 2. Si pas de dimensions trouvées
    if (!tireSizes || tireSizes.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: [],
        vehicle,
        tireSizes: [],
        message: `Véhicule identifié : ${vehicle.marque} ${vehicle.modele}. Dimensions non répertoriées, utilisez la recherche par dimensions.`,
      });
    }

    // 3. Chercher d'abord en DB locale (instantané)
    const firstSize = tireSizes[0];
    let products = await Product.find({
      width: firstSize.width,
      height: firstSize.height,
      diameter: firstSize.diameter,
    }).sort({ sellingPrice: 1 }).lean();

    // 4. Si la DB a des résultats → répondre immédiatement + sync en arrière-plan
    if (products.length > 0) {
      console.log(`⚡ Plaque ${cleanPlate} → ${vehicle.marque} ${vehicle.modele} → ${products.length} pneus (cache DB)`);

      // Sync Gateway en arrière-plan (non bloquant) pour mettre à jour stock/prix
      const searchText = `${firstSize.width}${String(firstSize.height).padStart(2, '0')}${firstSize.diameter}`;
      syncService.searchAndSync(searchText).catch(err =>
        console.error('Background sync failed:', err.message)
      );

      return res.json({
        success: true,
        count: products.length,
        data: products,
        vehicle,
        tireSizes,
        message: `${vehicle.marque} ${vehicle.modele} — ${tireSizes.length} dimension(s) recommandée(s)`,
      });
    }

    // 5. DB vide → appeler le Gateway (plus lent mais nécessaire la première fois)
    try {
      const searchText = `${firstSize.width}${String(firstSize.height).padStart(2, '0')}${firstSize.diameter}`;
      products = await syncService.searchAndSync(searchText);
    } catch (gatewayError) {
      console.error('Gateway search failed:', gatewayError.message);
      products = [];
    }

    console.log(`✅ Plaque ${cleanPlate} → ${vehicle.marque} ${vehicle.modele} → ${firstSize.width}/${firstSize.height}R${firstSize.diameter} → ${products.length} pneus`);

    res.json({
      success: true,
      count: products.length,
      data: products,
      vehicle,
      tireSizes,
      message: `${vehicle.marque} ${vehicle.modele} — ${tireSizes.length} dimension(s) recommandée(s)`,
    });
  } catch (error) {
    console.error('Error in searchByPlate:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche des produits',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Obtenir les détails d'un produit avec vérification du stock en temps réel
 */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    let product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé',
      });
    }

    // Vérifier le stock en temps réel via le Gateway (si le produit a un articleSystemNumber)
    if (product.articleSystemNumber) {
      try {
        const refreshed = await syncService.refreshProductStock(product.articleSystemNumber);
        if (refreshed) {
          product = refreshed;
        }
      } catch (stockError) {
        console.error('Stock check failed, using cached data:', stockError.message);
      }
    }

    res.json({
      success: true,
      data: {
        ...product.toObject(),
        deliveryInfo: product.getDeliveryInfo(),
      },
    });
  } catch (error) {
    console.error('Error in getProductById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du produit',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Liste des produits pour la boutique avec pagination, filtres et tri
 */
export const getShopProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      condition,
      brand,
      priceMin,
      priceMax,
      width,
      height,
      diameter,
      season,
      sort = 'newest',
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);

    // Construire le filtre
    const filter = { category: 'tires' };

    if (condition === 'used') {
      filter.condition = { $ne: 'new' };
    } else if (condition) {
      filter.condition = condition;
    }

    if (brand) {
      const brands = Array.isArray(brand) ? brand : brand.split(',');
      filter.brand = { $in: brands };
    }

    if (priceMin || priceMax) {
      filter.sellingPrice = {};
      if (priceMin) filter.sellingPrice.$gte = parseFloat(priceMin);
      if (priceMax) filter.sellingPrice.$lte = parseFloat(priceMax);
    }

    if (width) filter.width = parseInt(width, 10);
    if (height) filter.height = parseInt(height, 10);
    if (diameter) filter.diameter = parseInt(diameter, 10);
    if (season) filter.season = season;

    // Construire le tri
    let sortOption = {};
    switch (sort) {
      case 'price_asc':
        sortOption = { sellingPrice: 1 };
        break;
      case 'price_desc':
        sortOption = { sellingPrice: -1 };
        break;
      case 'brand_asc':
        sortOption = { brand: 1 };
        break;
      case 'newest':
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort(sortOption)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error in getShopProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des produits',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Vérifier le stock de plusieurs produits en temps réel
 */
export const checkMultipleStock = async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir une liste d\'IDs de produits',
      });
    }

    const products = await Product.find({ _id: { $in: productIds } });

    // Préparer les articles pour le check stock Gateway
    const gatewayItems = products
      .filter(p => p.articleSystemNumber)
      .map(p => ({ systemNumber: p.articleSystemNumber, quantity: 1 }));

    let stockResults = [];
    if (gatewayItems.length > 0) {
      try {
        stockResults = await gatewayService.checkStock(gatewayItems);
      } catch (error) {
        console.error('Gateway stock check failed:', error.message);
      }
    }

    // Mettre à jour les produits avec les infos de stock
    const stockMap = new Map(stockResults.map(r => [r.systemNumber, r]));
    const response = [];

    for (const product of products) {
      const stockInfo = stockMap.get(product.articleSystemNumber);

      if (stockInfo) {
        product.available = stockInfo.available;
        product.inStock = stockInfo.inStock;
        await product.save();
      }

      response.push({
        productId: product._id,
        articleSystemNumber: product.articleSystemNumber,
        available: product.available,
        inStock: product.inStock,
        deliveryDays: product.deliveryDays,
      });
    }

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error in checkMultipleStock:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du stock',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Obtenir les marques disponibles depuis le Gateway
 */
export const getBrands = async (req, res) => {
  try {
    // D'abord essayer le Gateway
    try {
      const brands = await gatewayService.getBrands();
      return res.json({ success: true, data: brands });
    } catch (gatewayError) {
      console.error('Gateway getBrands failed, fallback to DB:', gatewayError.message);
    }

    // Fallback : marques disponibles en DB
    const brands = await Product.distinct('brand', { category: 'tires' });
    res.json({
      success: true,
      data: brands.sort().map(b => ({ code: '', name: b })),
    });
  } catch (error) {
    console.error('Error in getBrands:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des marques',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Déclencher une synchronisation manuelle du catalogue
 */
export const triggerSync = async (req, res) => {
  try {
    const result = await syncService.syncFullCatalog();
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in triggerSync:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la synchronisation',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

// ========== ADMIN : Pneus Occasion ==========

/**
 * Lister les pneus occasion (isUsed: true)
 */
export const listUsedTires = async (req, res) => {
  try {
    const products = await Product.find({ isUsed: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error in listUsedTires:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * Créer un pneu occasion
 */
export const createUsedTire = async (req, res) => {
  try {
    const { brand, width, height, diameter, season, sellingPrice, condition, description, treadDepth, yearOfManufacture, quantity, imageUrl } = req.body;

    const product = new Product({
      brand,
      width: parseInt(width),
      height: parseInt(height),
      diameter: parseInt(diameter),
      season: season || 'none',
      sellingPrice: parseFloat(sellingPrice),
      netPrice: parseFloat(sellingPrice),
      condition: condition || 'good',
      description: description || `${brand} ${width}/${height}R${diameter} occasion`,
      treadDepth: treadDepth ? parseFloat(treadDepth) : undefined,
      yearOfManufacture: yearOfManufacture ? parseInt(yearOfManufacture) : undefined,
      available: parseInt(quantity) || 1,
      inStock: true,
      category: 'tires',
      isUsed: true,
      imageUrl: imageUrl || '',
      articleSystemNumber: `USED-${new mongoose.Types.ObjectId()}`,
      articleCode: `USED-${Date.now()}`,
    });

    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Error in createUsedTire:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
};

/**
 * Mettre à jour un pneu occasion
 */
export const updateUsedTire = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.quantity !== undefined) {
      updates.available = parseInt(updates.quantity);
      updates.inStock = updates.available > 0;
      delete updates.quantity;
    }
    if (updates.sellingPrice !== undefined) {
      updates.sellingPrice = parseFloat(updates.sellingPrice);
      updates.netPrice = updates.sellingPrice;
    }

    const product = await Product.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error in updateUsedTire:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
};

/**
 * Supprimer un pneu occasion
 */
export const deleteUsedTire = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    }
    res.json({ success: true, message: 'Produit supprimé' });
  } catch (error) {
    console.error('Error in deleteUsedTire:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ========== ADMIN : Boutique ==========

/**
 * Lister les produits boutique (category: 'shop')
 */
export const listShopAdmin = async (req, res) => {
  try {
    const products = await Product.find({ category: 'shop' }).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error in listShopAdmin:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * Créer un produit boutique
 */
export const createShopProduct = async (req, res) => {
  try {
    const { name, description, brand, sellingPrice, quantity, imageUrl } = req.body;

    const product = new Product({
      productName: name,
      brand: brand || 'Mister Pneu',
      description: description || name || '',
      sellingPrice: parseFloat(sellingPrice),
      netPrice: parseFloat(sellingPrice),
      available: parseInt(quantity) || 1,
      inStock: true,
      imageUrl: imageUrl || '',
      category: 'shop',
      articleSystemNumber: `SHOP-${new mongoose.Types.ObjectId()}`,
      articleCode: `SHOP-${Date.now()}`,
    });

    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Error in createShopProduct:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
};

/**
 * Mettre à jour un produit boutique
 */
export const updateShopProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.name !== undefined) {
      updates.productName = updates.name;
      delete updates.name;
    }
    if (updates.quantity !== undefined) {
      updates.available = parseInt(updates.quantity);
      updates.inStock = updates.available > 0;
      delete updates.quantity;
    }
    if (updates.sellingPrice !== undefined) {
      updates.sellingPrice = parseFloat(updates.sellingPrice);
      updates.netPrice = updates.sellingPrice;
    }

    const product = await Product.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error in updateShopProduct:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
};

/**
 * Supprimer un produit boutique
 */
export const deleteShopProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    }
    res.json({ success: true, message: 'Produit supprimé' });
  } catch (error) {
    console.error('Error in deleteShopProduct:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ========== ADMIN : Upload Image ==========

/**
 * Upload d'image en base64
 */
export const uploadImage = async (req, res) => {
  try {
    const { image, filename } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: 'Image manquante' });
    }

    // Retourner directement l'URL base64 (data URI)
    const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

    res.json({
      success: true,
      data: {
        imageUrl,
        filename: filename || `upload-${Date.now()}.jpg`,
      },
    });
  } catch (error) {
    console.error('Error in uploadImage:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'upload' });
  }
};

/**
 * Obtenir le statut de la synchronisation
 */
export const getSyncStatus = async (req, res) => {
  try {
    const status = syncService.getStatus();
    const productCount = await Product.countDocuments({ category: 'tires' });
    const inStockCount = await Product.countDocuments({ category: 'tires', inStock: true });

    res.json({
      success: true,
      data: {
        ...status,
        catalog: {
          totalProducts: productCount,
          inStock: inStockCount,
          outOfStock: productCount - inStockCount,
        },
      },
    });
  } catch (error) {
    console.error('Error in getSyncStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};
