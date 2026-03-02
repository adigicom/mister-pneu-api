import gatewayService from './gatewayService.js';
import { GatewayError } from './gatewayService.js';
import Product from '../models/Product.js';

/**
 * Service de synchronisation du catalogue Inter-Sprint → MongoDB
 *
 * Stratégie recommandée par Inter-Sprint :
 * - Max 3 requêtes catalogue complet par jour
 * - Sync toutes les 8 heures (3x/jour)
 * - Vérification stock en temps réel pour les articles individuels
 */
class SyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSync = null;
    this.lastSyncResult = null;
    this.syncInterval = null;
  }

  /**
   * Synchroniser le catalogue complet depuis Inter-Sprint
   * Effectue des requêtes par diamètre pour éviter les timeouts
   */
  async syncFullCatalog() {
    if (this.isSyncing) {
      console.log('⏳ Synchronisation déjà en cours, ignoré');
      return this.lastSyncResult;
    }

    this.isSyncing = true;
    const startTime = Date.now();
    let synced = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;
    let total = 0;

    // Diamètres courants à synchroniser
    const DIAMETERS = [14, 15, 16, 17, 18, 19, 20, 21, 22];

    try {
      console.log('🔄 Démarrage de la synchronisation du catalogue Inter-Sprint...');

      // Récupérer les pneus par diamètre pour éviter les timeouts
      const allProducts = [];
      for (const diameter of DIAMETERS) {
        try {
          console.log(`   📦 Récupération des pneus R${diameter}...`);
          const products = await gatewayService.searchArticles(`i=${diameter}`);
          allProducts.push(...products);
          console.log(`      → ${products.length} articles trouvés`);
        } catch (err) {
          console.error(`   ❌ Erreur R${diameter}: ${err.message}`);
          errors++;
        }
        // Pause entre les requêtes pour respecter les limites
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Dédupliquer par articleSystemNumber
      const uniqueMap = new Map();
      for (const p of allProducts) {
        if (p.articleSystemNumber) {
          uniqueMap.set(p.articleSystemNumber, p);
        }
      }
      const gatewayProducts = Array.from(uniqueMap.values());
      total = gatewayProducts.length;

      console.log(`📦 ${total} articles uniques reçus du Gateway Inter-Sprint`);

      // Calcul de la marge de profit
      const profitMargin = parseFloat(process.env.PROFIT_MARGIN) || 0.30;
      const inStockDays = parseInt(process.env.DEFAULT_DELIVERY_DAYS_IN_STOCK) || 2;
      const outOfStockDays = parseInt(process.env.DEFAULT_DELIVERY_DAYS_OUT_OF_STOCK) || 5;

      // Traiter par lots de 100 pour éviter de surcharger MongoDB
      const batchSize = 100;
      for (let i = 0; i < gatewayProducts.length; i += batchSize) {
        const batch = gatewayProducts.slice(i, i + batchSize);
        const operations = [];

        for (const gp of batch) {
          if (!gp.articleSystemNumber || !gp.description) {
            errors++;
            continue;
          }

          // Calculer le prix de vente (le pre-save hook ne fonctionne pas avec bulkWrite)
          const sellingPrice = Math.round(gp.netPrice * (1 + profitMargin) * 100) / 100;
          const deliveryDays = gp.available > 0 ? inStockDays : outOfStockDays;

          operations.push({
            updateOne: {
              filter: { articleSystemNumber: gp.articleSystemNumber },
              update: {
                $set: {
                  articleCode: gp.articleCode,
                  brand: gp.brand,
                  groupNumber: gp.groupNumber,
                  description: gp.description,
                  productName: gp.productName,
                  currency: gp.currency,
                  netPrice: gp.netPrice,
                  grossPrice: gp.grossPrice,
                  sellingPrice,
                  garagePrice: gp.garagePrice,
                  calculatorPrice: gp.calculatorPrice,
                  available: gp.available,
                  inStock: gp.inStock,
                  deliveryDays,
                  pictureName: gp.pictureName,
                  imageUrl: gp.imageUrl,
                  width: gp.width,
                  height: gp.height,
                  diameter: gp.diameter,
                  speedIndex: gp.speedIndex,
                  loadIndex: gp.loadIndex,
                  plyRating: gp.plyRating,
                  season: gp.season,
                  rollingResistance: gp.rollingResistance,
                  wetGrip: gp.wetGrip,
                  noiseEmissionDB: gp.noiseEmissionDB,
                  noiseEmissionClass: gp.noiseEmissionClass,
                  threepmsfCertified: gp.threepmsfCertified,
                  iceGrip: gp.iceGrip,
                  eMarked: gp.eMarked,
                  tuvCertified: gp.tuvCertified,
                  eanCode: gp.eanCode,
                  supplierID: gp.supplierID,
                  eprelId: gp.eprelId,
                  weightCategory: gp.weightCategory,
                  category: 'tires',
                  condition: 'new',
                },
                $setOnInsert: {
                  isUsed: false,
                },
              },
              upsert: true,
            },
          });
        }

        if (operations.length > 0) {
          try {
            const result = await Product.bulkWrite(operations, { ordered: false });
            created += result.upsertedCount || 0;
            updated += result.modifiedCount || 0;
            synced += (result.upsertedCount || 0) + (result.modifiedCount || 0);
          } catch (bulkError) {
            console.error(`❌ Erreur batch ${i}-${i + batchSize}:`, bulkError.message);
            errors += batch.length;
          }
        }

        // Log de progression
        if ((i + batchSize) % 500 === 0 || i + batchSize >= gatewayProducts.length) {
          console.log(`   → ${Math.min(i + batchSize, gatewayProducts.length)}/${total} traités...`);
        }
      }

      // Marquer les produits absents du Gateway comme hors stock
      const gatewaySystemNumbers = gatewayProducts
        .map(p => p.articleSystemNumber)
        .filter(Boolean);

      if (gatewaySystemNumbers.length > 0) {
        const outOfStockResult = await Product.updateMany(
          {
            articleSystemNumber: { $nin: gatewaySystemNumbers },
            category: 'tires',
            condition: 'new', // Ne touche pas aux pneus d'occasion (gérés localement)
            inStock: true,
          },
          {
            $set: { available: 0, inStock: false },
          }
        );

        if (outOfStockResult.modifiedCount > 0) {
          console.log(`   → ${outOfStockResult.modifiedCount} produits marqués hors stock`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.lastSync = new Date();
      this.lastSyncResult = {
        success: true,
        total,
        created,
        updated,
        synced,
        errors,
        duration: `${duration}s`,
        timestamp: this.lastSync.toISOString(),
      };

      console.log(`✅ Synchronisation terminée en ${duration}s : ${created} créés, ${updated} mis à jour, ${errors} erreurs`);

      return this.lastSyncResult;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.lastSyncResult = {
        success: false,
        error: error.message,
        isGatewayError: error instanceof GatewayError,
        gatewayCode: error.code || null,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      };

      if (error instanceof GatewayError) {
        console.error(`❌ Erreur Gateway (code ${error.code}): ${error.message}`);

        // Code 95 = limite quotidienne atteinte
        if (error.code === '95') {
          console.error('⚠️  Limite de requêtes quotidienne atteinte. Prochaine sync demain.');
        }
        // Code 96 = limite par période atteinte
        if (error.code === '96') {
          console.error('⚠️  Limite de requêtes par période atteinte. Réessai dans 5 minutes.');
        }
      } else {
        console.error('❌ Erreur de synchronisation:', error.message);
      }

      return this.lastSyncResult;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Mettre à jour le stock d'un article en temps réel
   * Utilisé lors de la consultation d'un produit ou avant commande
   */
  async refreshProductStock(articleSystemNumber) {
    try {
      const stockInfo = await gatewayService.checkSingleStock(articleSystemNumber);

      if (stockInfo) {
        const product = await Product.findOneAndUpdate(
          { articleSystemNumber },
          {
            $set: {
              available: stockInfo.available,
              inStock: stockInfo.inStock,
            },
          },
          { new: true }
        );

        return product;
      }
    } catch (error) {
      console.error(`Erreur refresh stock ${articleSystemNumber}:`, error.message);
    }

    return null;
  }

  /**
   * Rechercher sur le Gateway et synchroniser les résultats
   * Utilisé pour les recherches qui doivent interroger le Gateway en temps réel
   */
  async searchAndSync(searchText) {
    try {
      const gatewayProducts = await gatewayService.searchArticles(searchText);

      if (gatewayProducts.length === 0) {
        return [];
      }

      const profitMargin = parseFloat(process.env.PROFIT_MARGIN) || 0.30;
      const inStockDays = parseInt(process.env.DEFAULT_DELIVERY_DAYS_IN_STOCK) || 2;
      const outOfStockDays = parseInt(process.env.DEFAULT_DELIVERY_DAYS_OUT_OF_STOCK) || 5;

      // Upsert en bulk avec calcul du sellingPrice
      const operations = gatewayProducts
        .filter(gp => gp.articleSystemNumber && gp.description)
        .map(gp => {
          const sellingPrice = Math.round(gp.netPrice * (1 + profitMargin) * 100) / 100;
          const deliveryDays = gp.available > 0 ? inStockDays : outOfStockDays;
          return {
            updateOne: {
              filter: { articleSystemNumber: gp.articleSystemNumber },
              update: {
                $set: {
                  ...gp,
                  sellingPrice,
                  deliveryDays,
                  category: 'tires',
                  condition: 'new',
                },
                $setOnInsert: { isUsed: false },
              },
              upsert: true,
            },
          };
        });

      if (operations.length > 0) {
        await Product.bulkWrite(operations, { ordered: false });
      }

      // Retourner les produits depuis MongoDB (avec sellingPrice calculé)
      const systemNumbers = gatewayProducts.map(p => p.articleSystemNumber);
      return Product.find({ articleSystemNumber: { $in: systemNumbers } });
    } catch (error) {
      console.error('Erreur searchAndSync:', error.message);
      throw error;
    }
  }

  /**
   * Démarrer la synchronisation périodique
   * @param {number} intervalHours - Intervalle entre les syncs (default: 8h = 3x/jour)
   */
  startPeriodicSync(intervalHours = 8) {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(`⏰ Synchronisation automatique configurée toutes les ${intervalHours}h`);

    // Première synchronisation après 30 secondes (laisser le serveur démarrer)
    setTimeout(async () => {
      console.log('🚀 Première synchronisation du catalogue...');
      await this.syncFullCatalog();
    }, 30000);

    // Synchronisations suivantes
    this.syncInterval = setInterval(async () => {
      console.log('🔄 Synchronisation périodique...');
      await this.syncFullCatalog();
    }, intervalMs);
  }

  /**
   * Arrêter la synchronisation périodique
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Synchronisation périodique arrêtée');
    }
  }

  /**
   * Obtenir le statut de la synchronisation
   */
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSync: this.lastSync ? this.lastSync.toISOString() : null,
      lastResult: this.lastSyncResult,
      periodicSyncActive: !!this.syncInterval,
    };
  }
}

const syncService = new SyncService();
export default syncService;
