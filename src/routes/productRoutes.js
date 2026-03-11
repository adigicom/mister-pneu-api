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
  listUsedTires,
  createUsedTire,
  updateUsedTire,
  deleteUsedTire,
  listShopAdmin,
  createShopProduct,
  updateShopProduct,
  deleteShopProduct,
  uploadImage,
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
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

// ========== Routes Admin ==========

// Pneus occasion
router.get('/used', adminAuth, listUsedTires);
router.post('/used', adminAuth, createUsedTire);
router.put('/used/:id', adminAuth, updateUsedTire);
router.delete('/used/:id', adminAuth, deleteUsedTire);

// Boutique admin
router.get('/shop-admin', adminAuth, listShopAdmin);
router.post('/shop-admin', adminAuth, createShopProduct);
router.put('/shop-admin/:id', adminAuth, updateShopProduct);
router.delete('/shop-admin/:id', adminAuth, deleteShopProduct);

// Upload image
router.post('/upload', adminAuth, uploadImage);

// ========== Routes Publiques ==========

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
