import express from 'express';
import {
  searchByDimensions,
  searchByVehicle,
  searchByPlate,
  getProductById,
  getShopProducts,
  checkMultipleStock,
  getBrands,
  triggerSync,
  getSyncStatus,
} from '../controllers/productController.js';
import { validate } from '../middleware/validate.js';
import {
  searchByDimensionsRules,
  searchByVehicleRules,
  searchByPlateRules,
  productIdRules,
  checkStockRules,
  shopProductsRules,
} from '../middleware/validators.js';

const router = express.Router();

// Boutique - liste paginée avec filtres
router.get('/shop', shopProductsRules, validate, getShopProducts);

// Recherche de produits
router.get('/search/dimensions', searchByDimensionsRules, validate, searchByDimensions);
router.get('/search/vehicle', searchByVehicleRules, validate, searchByVehicle);
router.get('/search/plate', searchByPlateRules, validate, searchByPlate);

// Synchronisation catalogue Inter-Sprint
router.post('/sync', triggerSync);
router.get('/sync/status', getSyncStatus);

// Détails produit
router.get('/:id', productIdRules, validate, getProductById);

// Vérification du stock
router.post('/check-stock', checkStockRules, validate, checkMultipleStock);

// Marques
router.get('/brands/list', getBrands);

export default router;
