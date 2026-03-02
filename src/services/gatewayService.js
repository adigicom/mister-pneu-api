import axios from 'axios';

/**
 * Mapping des codes marque Inter-Sprint (2 lettres) → noms complets
 */
const BRAND_CODES = {
  // Codes vérifiés sur l'API production Inter-Sprint
  AD: 'American',
  AF: 'Antyre',
  AG: 'Autogrip',
  AJ: 'Aoteli',
  AP: 'Apollo',
  AQ: 'Aplus',
  AU: 'Aurora',
  AV: 'Avon',
  AY: 'Amine',
  BA: 'Barum',
  BL: 'Belshina',
  BR: 'Bridgestone',
  CE: 'Ceat',
  CL: 'Clear',
  CO: 'Continental',
  CP: 'Cooper',
  CS: 'Cheng Shin',
  DA: 'Davanti',
  DC: 'Double Coin',
  DE: 'Delinte',
  DI: 'Diversen',
  DN: 'Dynacargo',
  DR: 'Durun',
  DS: 'Deestone',
  DT: 'Delinte',
  DU: 'Dunlop',
  ES: 'Eurostone',
  ET: 'Eurotec',
  F4: 'Firemax',
  FA: 'Falken',
  FB: 'Fortuna',
  FE: 'Federal',
  FI: 'Firestone',
  FL: 'Flamingo',
  FN: 'Falken',
  FT: 'Fullway',
  FU: 'Fulda',
  FW: 'Fullrun',
  FY: 'Kpatos',
  G1: 'Giti',
  GD: 'Groundspeed',
  GE: 'General',
  GI: 'Giti',
  GL: 'Goldline',
  GM: 'Gremax',
  GN: 'Gamma',
  GO: 'Golden Tyre',
  GP: 'Gripmax',
  GR: 'BFGoodrich',
  GT: 'GT Radial',
  GY: 'Goodyear',
  HA: 'Hankook',
  HD: 'Haida',
  HE: 'Heidenau',
  HF: 'Hifly',
  HS: 'Achilles',
  I5: 'Interstate',
  ID: 'Idilis',
  IF: 'Infinity',
  JI: 'Jinyu',
  KC: 'Komachi',
  KE: 'Kenda',
  KL: 'Kleber',
  KM: 'Kormoran',
  KU: 'Kumho',
  KY: 'Kelly',
  LA: 'Landsail',
  LF: 'Laufenn',
  LL: 'Linglong',
  LS: 'Landsail',
  M3: 'Mercedes Aftermarket',
  M9: 'Mercedes Aftermarket',
  MB: 'Mabor',
  MD: 'Maxxis',
  ME: 'Milestone',
  MG: 'Meteor',
  MI: 'Michelin',
  ML: 'Mastersteel',
  MP: 'Motrio',
  MQ: 'Metzeler',
  MR: 'Marangoni',
  MS: 'Marshal',
  MT: 'Matador',
  MV: 'Minerva',
  MZ: 'Mazzini',
  NA: 'Nankang',
  NK: 'Nokian',
  NV: 'Novex',
  NX: 'Nankang',
  ON: 'Otani',
  PE: 'Pegasus',
  PI: 'Pirelli',
  PR: 'Prometeon',
  PT: 'Petlas',
  PW: 'Parkway',
  RA: 'Regal',
  RD: 'Roadstone',
  RH: 'Roadhog',
  RK: 'Rockstone',
  RN: 'Riken',
  RQ: 'Roadking',
  RU: 'Regul',
  RZ: 'Rotex',
  SA: 'Sailun',
  SC: 'Spector',
  SD: 'Landsail',
  SE: 'Semperit',
  SF: 'Starfire',
  SG: 'Sagitar',
  SI: 'Simex',
  SK: 'Suntek',
  SN: 'Stunner',
  SO: 'Sumitomo',
  SP: 'Sportiva',
  SQ: 'Sentury',
  SS: 'Silver Stone',
  ST: 'Sunitrac',
  SY: 'Sunny',
  TF: 'Traffic',
  TG: 'Tigar',
  TL: 'Atlas',
  TO: 'Torque',
  TY: 'Toyo',
  TZ: 'Trazano',
  UG: 'Unigrip',
  UN: 'Uniroyal',
  VC: 'Vee Rubber',
  VI: 'Viking',
  VR: 'Vredestein',
  WA: 'Wanli',
  WN: 'Wanda',
  WR: 'Warrior',
  YO: 'Yokohama',
};

/**
 * Mots-clés pour détecter les pneus 4 saisons dans la description
 */
const ALL_SEASON_KEYWORDS = [
  '4s', '4 s', 'allseason', 'all season', 'all-season',
  'crossclimate', 'cross climate', 'vector', 'quatrac',
  'kinergy 4s', 'seasonproof', 'multiseason', 'multi season',
  '4saisons', '4 saisons', 'weather', 'all weather',
];

/**
 * Erreur spécifique Gateway
 */
class GatewayError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
  }
}

class GatewayService {
  constructor() {
    this._client = null;
  }

  /**
   * Initialisation lazy du client HTTP
   * Garantit que les variables d'environnement sont chargées (après dotenv.config())
   */
  get client() {
    if (!this._client) {
      this.baseURL = process.env.GATEWAY_API_URL || 'https://customers.inter-sprint.nl/scripts/cgirpc32.dll/ww0800';
      this.username = process.env.GATEWAY_USERNAME || '';
      this.password = process.env.GATEWAY_PASSWORD || '';

      this._client = axios.create({
        timeout: 120000, // 2 minutes pour les gros catalogues
        auth: {
          username: this.username,
          password: this.password,
        },
        responseType: 'text',
      });
    }
    return this._client;
  }

  /**
   * Effectuer une requête vers le Gateway
   * @param {string} protocolAndParams - ex: "103,kl=58949&artc=2054516"
   * @returns {string[]} Lignes de la réponse (sans *END*)
   */
  async request(protocolAndParams) {
    // Accéder à client pour s'assurer que baseURL/username sont initialisés
    const httpClient = this.client;
    const url = `${this.baseURL}?${protocolAndParams}`;

    try {
      const response = await httpClient.get(url);
      return this.parseRawResponse(response.data);
    } catch (error) {
      // Ne pas ré-encapsuler les erreurs Gateway
      if (error instanceof GatewayError) {
        throw error;
      }
      if (error.response) {
        throw new GatewayError('HTTP', `HTTP ${error.response.status}: ${error.response.statusText}`);
      }
      throw new GatewayError('NETWORK', `Erreur réseau: ${error.message}`);
    }
  }

  /**
   * Parser la réponse texte tabulée du Gateway
   * @param {string} raw - Texte brut de la réponse
   * @returns {string[]} Lignes valides
   */
  parseRawResponse(raw) {
    if (!raw || typeof raw !== 'string') {
      return [];
    }

    const lines = raw
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && l !== '*END*');

    // Vérifier si c'est une réponse d'erreur (code 2 chiffres + espace + message)
    if (lines.length === 1 && /^\d{2}\s/.test(lines[0])) {
      const code = lines[0].substring(0, 2);
      const message = lines[0].substring(3).trim();

      // Code 01 = "test ok" (pas une erreur)
      if (code === '01') {
        return lines;
      }

      throw new GatewayError(code, message);
    }

    return lines;
  }

  /**
   * Parser une ligne produit du Protocol 103
   * Positions des champs vérifiées empiriquement sur l'API production
   *
   *  [0]  articleSystemNumber    [14] eanCode
   *  [1]  articleCode            [15] weightCategory
   *  [2]  brandCode              [16] eMarked (1=no, 2=yes)
   *  [3]  groupNumber            [17] europeanOrigin
   *  [4]  description            [18] plyRating
   *  [5]  currency               [19] loadIndex/speedIndex
   *  [6]  netPrice               [20] width
   *  [7]  grossPrice             [21] height (aspect ratio)
   *  [8]  available (">20" ok)   [22] speedDesignation
   *  [9]  pictureName            [23] diameter
   *  [10] loadCapacity           [24] profileName
   *  [11] supplierID             [25-30] wheel fields
   *  [12] garagePrice            [31] calculatorPrice
   *  [13] altClientPrice         [42] rollingResistance (A-G)
   *                              [43] wetGrip (A-G)
   *                              [44] noiseDB
   *                              [45] noiseClass (A/B/C)
   *                              [46] winterSuitable/3PMSF (1=no, 2=yes)
   *                              [48] eprelId
   */
  parseProductLine(line) {
    const f = line.split('\t');

    if (f.length < 10) {
      return null;
    }

    const brandCode = (f[2] || '').trim();
    const brandName = BRAND_CODES[brandCode] || brandCode;
    const description = (f[4] || '').trim();
    const profileName = (f[24] || '').trim();
    const width = parseInt(f[20]) || null;
    const height = parseInt(f[21]) || null;
    const diameter = parseInt(f[23]) || null;

    // Parser le stock : peut être "> 20" ou un nombre
    const availableRaw = (f[8] || '0').trim();
    const available = availableRaw.startsWith('>')
      ? parseInt(availableRaw.replace('>', '').trim()) || 99
      : parseInt(availableRaw) || 0;

    // Détection de la saison
    const season = this.detectSeason(description, profileName, f);

    // Extraire le speed index depuis le champ speedDesignation
    const speedDesignation = (f[22] || '').trim();
    const speedIndex = speedDesignation.replace(/[^A-Z]/g, '');

    const picName = (f[9] || '').trim();

    return {
      articleSystemNumber: (f[0] || '').trim(),
      articleCode: (f[1] || '').trim(),
      brand: brandName,
      groupNumber: (f[3] || '').trim(),
      description,
      productName: profileName,
      currency: (f[5] || 'EUR').trim(),
      netPrice: parseFloat(f[6]) || 0,
      grossPrice: parseFloat(f[7]) || 0,
      available,
      pictureName: picName,
      imageUrl: picName ? `http://www.etyre.net/preview/t1/${picName}` : '',
      loadIndex: (f[10] || '').trim(),
      supplierID: (f[11] || '').trim(),
      garagePrice: parseFloat(f[12]) || null,
      eanCode: (f[14] || '').trim(),
      weightCategory: parseInt(f[15]) || 0,
      eMarked: (f[16] || '').trim() === '2',
      calculatorPrice: parseFloat(f[31]) || null,
      plyRating: (f[18] || '').trim(),
      speedIndex,
      width,
      height,
      diameter,
      season,
      rollingResistance: (f[42] || '').trim(),
      wetGrip: (f[43] || '').trim(),
      noiseEmissionDB: parseFloat(f[44]) || null,
      noiseEmissionClass: (f[45] || '').trim(),
      threepmsfCertified: (f[46] || '').trim() === '2',
      iceGrip: false,
      tuvCertified: false,
      eprelId: (f[48] || '').trim(),
      category: 'tires',
      condition: 'new',
      inStock: available > 0,
    };
  }

  /**
   * Détecter la saison d'un pneu à partir de la description et des flags
   * Position [46] = winterSuitable (1=non, 2=oui)
   */
  detectSeason(description, profileName, fields) {
    const text = `${description} ${profileName}`.toLowerCase();

    // Vérifier les mots-clés 4 saisons en premier
    for (const keyword of ALL_SEASON_KEYWORDS) {
      if (text.includes(keyword)) {
        return 'all-season';
      }
    }

    // Flag hiver position [46] (vérifié empiriquement)
    const winterSuitable = (fields[46] || '').trim() === '2';
    if (winterSuitable) {
      return 'winter';
    }

    // Si la description contient MS (mud+snow) sans keywords 4 saisons
    if (text.includes(' ms ') || text.includes(' m+s ') || text.includes(' m&s ')) {
      return 'winter';
    }

    return 'summer';
  }

  // ─────────────────────────────────────────────────────────
  //  PROTOCOL 103 - Recherche d'articles (RECOMMANDÉ)
  // ─────────────────────────────────────────────────────────

  /**
   * Rechercher des articles via Protocol 103
   * @param {string} searchText - Texte de recherche (ex: "2054516", "M=MI", "r=10")
   * @param {object} options - Options supplémentaires
   * @returns {object[]} Liste de produits parsés
   */
  async searchArticles(searchText, options = {}) {
    let params = `103,kl=${this.username}&artc=${encodeURIComponent(searchText)}`;

    if (options.shippingMethod) {
      params += `&verzw=${options.shippingMethod}`;
    }
    if (options.quantity) {
      params += `&aant=${options.quantity}`;
    }
    if (options.deliveryAddress) {
      params += `&afl=${options.deliveryAddress}`;
    }

    const lines = await this.request(params);

    const products = [];
    for (const line of lines) {
      const product = this.parseProductLine(line);
      if (product && product.articleSystemNumber) {
        products.push(product);
      }
    }

    return products;
  }

  /**
   * Rechercher par dimensions (largeur/hauteur/diamètre)
   */
  async searchByDimensions(width, height, diameter) {
    const searchText = `${width}${String(height).padStart(2, '0')}${diameter}`;
    return this.searchArticles(searchText);
  }

  /**
   * Rechercher par dimensions avec indice de vitesse
   */
  async searchByDimensionsWithSpeed(width, height, speedIndex, diameter) {
    const searchText = `${width}${String(height).padStart(2, '0')}${speedIndex}${diameter}`;
    return this.searchArticles(searchText);
  }

  /**
   * Rechercher par marque
   */
  async searchByBrand(brandCode) {
    return this.searchArticles(`M=${brandCode}`);
  }

  /**
   * Rechercher par marque + dimensions
   */
  async searchByBrandAndDimensions(brandCode, width, height, diameter) {
    const searchText = `${brandCode}=${width}${String(height).padStart(2, '0')}${diameter}`;
    return this.searchArticles(searchText);
  }

  /**
   * Récupérer tout le catalogue pneus (pour synchronisation)
   * ATTENTION : Max 3 requêtes complètes par jour
   */
  async getAllTires() {
    return this.searchArticles('r=10');
  }

  /**
   * Récupérer les pneus été
   */
  async getSummerTires() {
    return this.searchArticles('SUM');
  }

  /**
   * Récupérer les pneus hiver
   */
  async getWinterTires() {
    return this.searchArticles('WIN');
  }

  /**
   * Récupérer les pneus 4 saisons
   */
  async getAllSeasonTires() {
    return this.searchArticles('4S');
  }

  /**
   * Rechercher un article par numéro système
   */
  async getArticleBySystemNumber(systemNumber) {
    const results = await this.searchArticles(`s=${systemNumber}`);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Rechercher un article par code EAN
   */
  async getArticleByEAN(eanCode) {
    const results = await this.searchArticles(`e=${eanCode}`);
    return results.length > 0 ? results[0] : null;
  }

  // ─────────────────────────────────────────────────────────
  //  PROTOCOL 102 - Vérification de stock
  // ─────────────────────────────────────────────────────────

  /**
   * Vérifier la disponibilité d'un ou plusieurs articles
   * @param {Array<{systemNumber: string, quantity: number}>} items
   * @returns {Array<{systemNumber: string, available: number}>}
   */
  async checkStock(items) {
    if (!Array.isArray(items)) {
      items = [{ systemNumber: items, quantity: 1 }];
    }

    const paramParts = items.map(
      item => `art=${item.systemNumber}&aant=${item.quantity || 1}`
    );
    const params = `102,${paramParts.join(';')}`;

    try {
      const lines = await this.request(params);

      return lines.map(line => {
        const f = line.split('\t');
        return {
          systemNumber: (f[0] || '').trim(),
          available: parseInt(f[1]) || 0,
          inStock: (parseInt(f[1]) || 0) > 0,
        };
      });
    } catch (error) {
      // Code 92 = stock insuffisant
      if (error instanceof GatewayError && error.code === '92') {
        return items.map(item => ({
          systemNumber: item.systemNumber,
          available: 0,
          inStock: false,
        }));
      }
      throw error;
    }
  }

  /**
   * Vérifier le stock d'un seul article (compat ancien code)
   */
  async checkSingleStock(articleSystemNumber) {
    try {
      const results = await this.checkStock([
        { systemNumber: articleSystemNumber, quantity: 1 },
      ]);
      return results[0] || { systemNumber: articleSystemNumber, available: 0, inStock: false };
    } catch {
      return { systemNumber: articleSystemNumber, available: 0, inStock: false };
    }
  }

  // ─────────────────────────────────────────────────────────
  //  PROTOCOL 104 - Passer une commande
  // ─────────────────────────────────────────────────────────

  /**
   * Passer une commande sur le Gateway
   * @param {object} orderData
   * @returns {object} Résultat de la commande
   */
  async placeOrder(orderData) {
    let params = `104,kl=${this.username}`;
    params += `&art=${orderData.articleSystemNumber}`;
    params += `&aant=${orderData.quantity}`;

    if (orderData.reference) {
      params += `&refkop=${encodeURIComponent(orderData.reference)}`;
    }

    if (orderData.shippingMethod) {
      params += `&verzw=${orderData.shippingMethod}`;
    }

    // Adresse de livraison ponctuelle
    if (orderData.shipping) {
      params += '&afl=E';
      if (orderData.shipping.name) params += `&aflnm1=${encodeURIComponent(orderData.shipping.name)}`;
      if (orderData.shipping.name2) params += `&aflnm2=${encodeURIComponent(orderData.shipping.name2)}`;
      if (orderData.shipping.address) params += `&afladr1=${encodeURIComponent(orderData.shipping.address)}`;
      if (orderData.shipping.postalCode) params += `&aflpk=${encodeURIComponent(orderData.shipping.postalCode)}`;
      if (orderData.shipping.city) params += `&aflwp=${encodeURIComponent(orderData.shipping.city)}`;
      if (orderData.shipping.country) params += `&aflland=${encodeURIComponent(orderData.shipping.country)}`;
      if (orderData.shipping.phone) params += `&tel=${encodeURIComponent(orderData.shipping.phone)}`;
      if (orderData.shipping.email) params += `&email=${encodeURIComponent(orderData.shipping.email)}`;
    }

    // Mode test
    if (orderData.testMode) {
      params += '&test=1';
    }

    const lines = await this.request(params);

    if (lines.length === 0) {
      throw new GatewayError('99', 'Réponse vide du Gateway');
    }

    const f = lines[0].split('\t');
    const statusCode = (f[0] || '').trim();

    // 01 = test ok
    if (statusCode === '01') {
      return { success: true, testMode: true, message: 'Commande validée (mode test)' };
    }

    // 00 = commande passée avec succès
    if (statusCode === '00') {
      return {
        success: true,
        testMode: false,
        orderId: (f[1] || '').trim(),
        orderLine: (f[2] || '').trim(),
        articleSystemNumber: (f[3] || '').trim(),
        articleCode: (f[4] || '').trim(),
        description: (f[5] || '').trim(),
        brand: (f[6] || '').trim(),
        quantity: parseInt(f[9]) || 0,
        netPrice: parseFloat(f[10]) || 0,
        currency: (f[11] || 'EUR').trim(),
        grossPrice: parseFloat(f[12]) || 0,
      };
    }

    throw new GatewayError(statusCode, `Erreur commande: ${lines[0]}`);
  }

  /**
   * Valider une commande sans la passer (test=1)
   */
  async validateOrder(orderData) {
    return this.placeOrder({ ...orderData, testMode: true });
  }

  // ─────────────────────────────────────────────────────────
  //  PROTOCOL 114 - Dimensions pneus par plaque
  // ─────────────────────────────────────────────────────────

  /**
   * Obtenir les dimensions de pneus par plaque d'immatriculation
   * @param {string} plate - Plaque (ex: "AB123CD" ou "AB-123-CD")
   * @param {string} country - Code pays (default: "NL")
   */
  async getTireSizesByPlate(plate, country = 'NL') {
    const cleanPlate = plate.replace(/[-\s]/g, '').toUpperCase();
    const params = `114,land=${country}&kenteken=${cleanPlate}`;

    const lines = await this.request(params);
    return lines.map(line => {
      const f = line.split('\t');
      return {
        raw: line,
        fields: f,
      };
    });
  }

  // ─────────────────────────────────────────────────────────
  //  PROTOCOL 6 - Marques
  // ─────────────────────────────────────────────────────────

  /**
   * Récupérer la liste des marques depuis le Gateway
   */
  async getBrands() {
    const params = `6,kl=${this.username}`;
    const lines = await this.request(params);

    return lines.map(line => {
      const f = line.split('\t');
      return {
        code: (f[0] || '').trim(),
        name: BRAND_CODES[(f[0] || '').trim()] || (f[1] || f[0] || '').trim(),
      };
    });
  }

  // ─────────────────────────────────────────────────────────
  //  PROTOCOL 7 - Catégories (rubrieken)
  // ─────────────────────────────────────────────────────────

  /**
   * Récupérer les catégories de produits
   */
  async getCategories() {
    const params = `7,kl=${this.username}`;
    const lines = await this.request(params);

    return lines.map(line => {
      const f = line.split('\t');
      return {
        number: (f[0] || '').trim(),
        description: (f[1] || '').trim(),
      };
    });
  }

  // ─────────────────────────────────────────────────────────
  //  PROTOCOL 112 - Bons de livraison
  // ─────────────────────────────────────────────────────────

  /**
   * Récupérer les bons de livraison
   * @param {string} dateFrom - Format YYYYMMDD
   * @param {string} dateTo - Format YYYYMMDD
   */
  async getDeliveryNotes(dateFrom, dateTo) {
    const params = `112,kl=${this.username}&datum1=${dateFrom}&datum2=${dateTo}&type=P`;
    const lines = await this.request(params);
    return lines;
  }

  // ─────────────────────────────────────────────────────────
  //  PROTOCOL 115 - Tarifs d'expédition
  // ─────────────────────────────────────────────────────────

  /**
   * Récupérer les tarifs d'expédition
   */
  async getShippingRates() {
    const params = `115,kl=${this.username}`;
    const lines = await this.request(params);
    return lines;
  }

  // ─────────────────────────────────────────────────────────
  //  PROTOCOL 113 - Modifier une commande
  // ─────────────────────────────────────────────────────────

  /**
   * Modifier la quantité d'une ligne de commande
   */
  async modifyOrder(orderNumber, orderLine, newQuantity) {
    const params = `113,ord=${orderNumber}&ordreg=${orderLine}&aant=${newQuantity}`;
    return this.request(params);
  }
}

const gatewayService = new GatewayService();
export { GatewayError };
export default gatewayService;
