import { query, body, param } from 'express-validator';

/**
 * Validation pour la recherche par dimensions
 */
export const searchByDimensionsRules = [
  query('width')
    .notEmpty().withMessage('La largeur est requise')
    .isInt({ min: 100, max: 400 }).withMessage('Largeur invalide (100-400)'),
  query('height')
    .notEmpty().withMessage('La hauteur est requise')
    .isInt({ min: 20, max: 100 }).withMessage('Hauteur invalide (20-100)'),
  query('diameter')
    .notEmpty().withMessage('Le diamètre est requis')
    .isInt({ min: 12, max: 24 }).withMessage('Diamètre invalide (12-24)'),
  query('season')
    .optional()
    .isIn(['summer', 'winter', 'all-season']).withMessage('Saison invalide'),
];

/**
 * Validation pour la recherche par véhicule
 */
export const searchByVehicleRules = [
  query('brand')
    .notEmpty().withMessage('La marque est requise')
    .isString().trim().escape(),
  query('model')
    .notEmpty().withMessage('Le modèle est requis')
    .isString().trim().escape(),
  query('year')
    .optional()
    .isInt({ min: 1990, max: new Date().getFullYear() + 1 }).withMessage('Année invalide'),
];

/**
 * Validation pour la recherche par plaque
 */
export const searchByPlateRules = [
  query('plate')
    .notEmpty().withMessage("La plaque d'immatriculation est requise")
    .isString().trim()
    .matches(/^[A-Z]{2}-?\d{3}-?[A-Z]{2}$/i).withMessage('Format de plaque invalide (ex: AB-123-CD)'),
];

/**
 * Validation pour l'ID produit
 */
export const productIdRules = [
  param('id')
    .isMongoId().withMessage('ID produit invalide'),
];

/**
 * Validation pour la vérification de stock multiple
 */
export const checkStockRules = [
  body('productIds')
    .isArray({ min: 1 }).withMessage('Liste de produits requise'),
  body('productIds.*')
    .isMongoId().withMessage('ID produit invalide'),
];

/**
 * Validation pour la boutique (liste paginée avec filtres)
 */
export const shopProductsRules = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page invalide'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limite invalide (1-100)'),
  query('condition')
    .optional()
    .isIn(['new', 'excellent', 'good', 'fair', 'used']).withMessage('Condition invalide'),
  query('brand')
    .optional()
    .isString().trim(),
  query('priceMin')
    .optional()
    .isFloat({ min: 0 }).withMessage('Prix minimum invalide'),
  query('priceMax')
    .optional()
    .isFloat({ min: 0 }).withMessage('Prix maximum invalide'),
  query('width')
    .optional()
    .isInt({ min: 100, max: 400 }).withMessage('Largeur invalide'),
  query('height')
    .optional()
    .isInt({ min: 20, max: 100 }).withMessage('Hauteur invalide'),
  query('diameter')
    .optional()
    .isInt({ min: 12, max: 24 }).withMessage('Diamètre invalide'),
  query('season')
    .optional()
    .isIn(['summer', 'winter', 'all-season']).withMessage('Saison invalide'),
  query('sort')
    .optional()
    .isIn(['price_asc', 'price_desc', 'brand_asc', 'newest']).withMessage('Tri invalide'),
];

/**
 * Validation pour la création de commande
 */
export const createOrderRules = [
  body('items')
    .isArray({ min: 1 }).withMessage('Le panier ne peut pas être vide'),
  body('items.*.productId')
    .isMongoId().withMessage('ID produit invalide'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 20 }).withMessage('Quantité invalide (1-20)'),
  body('shippingAddress').notEmpty().withMessage('Adresse de livraison requise'),
  body('shippingAddress.firstName')
    .notEmpty().withMessage('Prénom requis')
    .isString().trim().isLength({ max: 100 }),
  body('shippingAddress.lastName')
    .notEmpty().withMessage('Nom requis')
    .isString().trim().isLength({ max: 100 }),
  body('shippingAddress.email')
    .notEmpty().withMessage('Email requis')
    .isEmail().withMessage('Email invalide'),
  body('shippingAddress.phone')
    .notEmpty().withMessage('Téléphone requis')
    .isMobilePhone('fr-FR').withMessage('Numéro de téléphone invalide'),
  body('shippingAddress.address')
    .notEmpty().withMessage('Adresse requise')
    .isString().trim().isLength({ max: 300 }),
  body('shippingAddress.city')
    .notEmpty().withMessage('Ville requise')
    .isString().trim().isLength({ max: 100 }),
  body('shippingAddress.postalCode')
    .notEmpty().withMessage('Code postal requis')
    .matches(/^\d{5}$/).withMessage('Code postal invalide (5 chiffres)'),
];

/**
 * Validation pour la création de paiement
 */
export const createPaymentRules = [
  body('orderId')
    .isMongoId().withMessage('ID commande invalide'),
];

/**
 * Validation pour la confirmation de paiement
 */
export const confirmPaymentRules = [
  body('orderId')
    .isMongoId().withMessage('ID commande invalide'),
  body('paymentIntentId')
    .notEmpty().withMessage('ID Payment Intent requis')
    .isString().trim(),
];

/**
 * Validation pour l'ID commande
 */
export const orderIdRules = [
  param('orderId')
    .isMongoId().withMessage('ID commande invalide'),
];
