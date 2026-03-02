import express from 'express';
import {
  createOrder,
  createPayment,
  confirmPayment,
  getOrder,
  stripeWebhook,
} from '../controllers/orderController.js';
import { validate } from '../middleware/validate.js';
import {
  createOrderRules,
  createPaymentRules,
  confirmPaymentRules,
  orderIdRules,
} from '../middleware/validators.js';

const router = express.Router();

// Commandes
router.post('/create', createOrderRules, validate, createOrder);
router.get('/:orderId', orderIdRules, validate, getOrder);

// Paiements
router.post('/payment/create', createPaymentRules, validate, createPayment);
router.post('/payment/confirm', confirmPaymentRules, validate, confirmPayment);

// Webhook Stripe (sans middleware JSON car Stripe a besoin du body brut)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

export default router;
