import Stripe from 'stripe';

class StripeService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  /**
   * Créer un Payment Intent pour le paiement sécurisé avec 3D Secure
   * @param {number} amount - Montant en centimes (ex: 1999 pour 19.99€)
   * @param {object} metadata - Métadonnées de la commande
   */
  async createPaymentIntent(amount, metadata = {}) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convertir en centimes
        currency: 'eur',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          ...metadata,
          integration: 'mister_pneu',
        },
        // Forcer l'authentification 3D Secure pour les paiements > 30€
        payment_method_options: {
          card: {
            request_three_d_secure: amount > 30 ? 'any' : 'automatic',
          },
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error('Stripe Error - createPaymentIntent:', error.message);
      throw new Error('Impossible de créer le paiement');
    }
  }

  /**
   * Confirmer un paiement
   * @param {string} paymentIntentId
   */
  async confirmPayment(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        status: paymentIntent.status,
        paid: paymentIntent.status === 'succeeded',
        amount: paymentIntent.amount / 100,
        chargeId: paymentIntent.charges?.data[0]?.id || null,
      };
    } catch (error) {
      console.error('Stripe Error - confirmPayment:', error.message);
      throw new Error('Impossible de confirmer le paiement');
    }
  }

  /**
   * Rembourser un paiement
   * @param {string} chargeId
   * @param {number} amount - Montant optionnel pour remboursement partiel
   */
  async refundPayment(chargeId, amount = null) {
    try {
      const refundData = { charge: chargeId };
      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      const refund = await this.stripe.refunds.create(refundData);

      return {
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100,
      };
    } catch (error) {
      console.error('Stripe Error - refundPayment:', error.message);
      throw new Error('Impossible de rembourser le paiement');
    }
  }

  /**
   * Créer un customer Stripe pour les clients récurrents
   * @param {object} customerData
   */
  async createCustomer(customerData) {
    try {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: `${customerData.firstName} ${customerData.lastName}`,
        phone: customerData.phone,
        address: {
          line1: customerData.address,
          city: customerData.city,
          postal_code: customerData.postalCode,
          country: 'FR',
        },
        metadata: {
          source: 'mister_pneu',
        },
      });

      return {
        customerId: customer.id,
        email: customer.email,
      };
    } catch (error) {
      console.error('Stripe Error - createCustomer:', error.message);
      throw new Error('Impossible de créer le client');
    }
  }

  /**
   * Vérifier la signature du webhook Stripe
   * @param {string} payload - Corps de la requête
   * @param {string} signature - Signature du header
   */
  verifyWebhookSignature(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      return event;
    } catch (error) {
      console.error('Stripe Error - verifyWebhookSignature:', error.message);
      throw new Error('Signature webhook invalide');
    }
  }

  /**
   * Calculer les frais de transaction Stripe (pour information)
   * @param {number} amount - Montant en euros
   */
  calculateStripeFees(amount) {
    // Frais Stripe Europe: 1.4% + 0.25€
    const percentageFee = amount * 0.014;
    const fixedFee = 0.25;
    const totalFees = percentageFee + fixedFee;

    return {
      amount,
      stripeFees: Math.round(totalFees * 100) / 100,
      netAmount: Math.round((amount - totalFees) * 100) / 100,
    };
  }
}

export default new StripeService();
