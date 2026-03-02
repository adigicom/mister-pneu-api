import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  articleSystemNumber: String,
  name: String,
  brand: String,
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  dimensions: String, // Ex: 205/55R16
});

const shippingAddressSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  postalCode: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    default: 'France',
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },

    // Articles commandés
    items: [orderItemSchema],

    // Informations client
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },

    // Prix
    subtotal: {
      type: Number,
      required: true,
    },
    shippingCost: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },

    // Paiement
    paymentMethod: {
      type: String,
      enum: ['stripe', 'card'],
      default: 'stripe',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    stripePaymentIntentId: String,
    stripeChargeId: String,

    // Statut de la commande
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },

    // Livraison
    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,
    trackingNumber: String,

    // Synchronisation Gateway
    gatewayOrderId: String,
    gatewaySync: {
      status: {
        type: String,
        enum: ['pending', 'synced', 'failed'],
        default: 'pending',
      },
      lastSync: Date,
      error: String,
    },

    // Notes
    customerNotes: String,
    internalNotes: String,
  },
  {
    timestamps: true,
  }
);

// Génération automatique du numéro de commande
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Trouver le dernier numéro de commande du jour
    const lastOrder = await this.constructor.findOne({
      orderNumber: new RegExp(`^MP-${year}${month}${day}-`)
    }).sort({ orderNumber: -1 });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.split('-').pop());
      sequence = lastSequence + 1;
    }

    this.orderNumber = `MP-${year}${month}${day}-${String(sequence).padStart(4, '0')}`;
  }
  next();
});

// Méthode pour calculer le délai de livraison estimé
orderSchema.methods.calculateEstimatedDelivery = function() {
  const maxDeliveryDays = Math.max(
    ...this.items.map(item => {
      // On récupère le délai le plus long parmi les produits
      return item.product?.deliveryDays || 3;
    })
  );

  this.estimatedDeliveryDate = new Date(Date.now() + maxDeliveryDays * 24 * 60 * 60 * 1000);
  return this.estimatedDeliveryDate;
};

const Order = mongoose.model('Order', orderSchema);

export default Order;
