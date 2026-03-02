import Order from '../models/Order.js';
import Product from '../models/Product.js';
import stripeService from '../services/stripeService.js';
import gatewayService from '../services/gatewayService.js';

/**
 * Créer une nouvelle commande
 */
export const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, customerNotes } = req.body;

    // Validation
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le panier est vide',
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Adresse de livraison manquante',
      });
    }

    // Vérifier le stock et récupérer les produits
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Produit ${item.productId} non trouvé`,
        });
      }

      // Vérifier le stock en temps réel
      const stockInfo = await gatewayService.checkStock(product.articleSystemNumber);

      if (stockInfo.available < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Stock insuffisant pour ${product.description}. Disponible: ${stockInfo.available}`,
        });
      }

      // Construire l'item de commande
      const dimensions = product.width && product.height && product.diameter
        ? `${product.width}/${product.height}R${product.diameter}`
        : '';

      orderItems.push({
        product: product._id,
        articleSystemNumber: product.articleSystemNumber,
        name: product.description,
        brand: product.brand,
        quantity: item.quantity,
        price: product.sellingPrice,
        dimensions,
      });

      subtotal += product.sellingPrice * item.quantity;
    }

    // Calculer les frais de livraison (gratuit pour > 200€, sinon 15€)
    const shippingCost = subtotal >= 200 ? 0 : 15;

    // Calculer la TVA (20%)
    const tax = (subtotal + shippingCost) * 0.20;

    // Total
    const total = subtotal + shippingCost + tax;

    // Créer la commande
    const order = new Order({
      items: orderItems,
      shippingAddress,
      subtotal,
      shippingCost,
      tax,
      total,
      customerNotes,
    });

    // Calculer la date de livraison estimée
    order.calculateEstimatedDelivery();

    await order.save();

    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      data: order,
    });
  } catch (error) {
    console.error('Error in createOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la commande',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Créer un paiement pour une commande
 */
export const createPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cette commande a déjà été payée',
      });
    }

    // Créer un Payment Intent Stripe
    const paymentIntent = await stripeService.createPaymentIntent(order.total, {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      customerEmail: order.shippingAddress.email,
    });

    // Sauvegarder le Payment Intent ID
    order.stripePaymentIntentId = paymentIntent.paymentIntentId;
    await order.save();

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.clientSecret,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        amount: order.total,
      },
    });
  } catch (error) {
    console.error('Error in createPayment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du paiement',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Confirmer le paiement d'une commande
 */
export const confirmPayment = async (req, res) => {
  try {
    const { orderId, paymentIntentId } = req.body;

    const order = await Order.findById(orderId).populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    // Vérifier le paiement avec Stripe
    const paymentInfo = await stripeService.confirmPayment(paymentIntentId);

    if (paymentInfo.paid) {
      // Mettre à jour la commande
      order.paymentStatus = 'paid';
      order.orderStatus = 'confirmed';
      order.stripeChargeId = paymentInfo.chargeId;

      // Passer la commande sur le Gateway
      try {
        const gatewayOrder = await gatewayService.placeOrder({
          items: order.items.map(item => ({
            articleSystemNumber: item.articleSystemNumber,
            quantity: item.quantity,
          })),
          customer: {
            name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
            email: order.shippingAddress.email,
            phone: order.shippingAddress.phone,
            address: order.shippingAddress.address,
            city: order.shippingAddress.city,
            postalCode: order.shippingAddress.postalCode,
          },
        });

        if (gatewayOrder.success) {
          order.gatewayOrderId = gatewayOrder.orderId;
          order.gatewaySync.status = 'synced';
          order.gatewaySync.lastSync = new Date();
        } else {
          order.gatewaySync.status = 'failed';
          order.gatewaySync.error = gatewayOrder.message;
        }
      } catch (gatewayError) {
        console.error('Gateway sync error:', gatewayError.message);
        order.gatewaySync.status = 'failed';
        order.gatewaySync.error = gatewayError.message;
      }

      await order.save();

      res.json({
        success: true,
        message: 'Paiement confirmé avec succès',
        data: {
          orderNumber: order.orderNumber,
          orderStatus: order.orderStatus,
          estimatedDeliveryDate: order.estimatedDeliveryDate,
        },
      });
    } else {
      order.paymentStatus = 'failed';
      await order.save();

      res.status(400).json({
        success: false,
        message: 'Le paiement a échoué',
      });
    }
  } catch (error) {
    console.error('Error in confirmPayment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation du paiement',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Obtenir les détails d'une commande
 */
export const getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Error in getOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la commande',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Webhook Stripe pour gérer les événements de paiement
 */
export const stripeWebhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const payload = req.body;

    // Vérifier la signature du webhook
    const event = stripeService.verifyWebhookSignature(payload, signature);

    // Traiter l'événement
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.orderId;

        if (orderId) {
          const order = await Order.findById(orderId);
          if (order && order.paymentStatus !== 'paid') {
            order.paymentStatus = 'paid';
            order.orderStatus = 'confirmed';
            await order.save();
          }
        }
        break;

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object;
        const failedOrderId = failedIntent.metadata.orderId;

        if (failedOrderId) {
          const order = await Order.findById(failedOrderId);
          if (order) {
            order.paymentStatus = 'failed';
            await order.save();
          }
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(400).json({
      success: false,
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};
