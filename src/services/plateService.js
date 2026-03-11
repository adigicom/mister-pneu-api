import axios from 'axios';

/**
 * Service de recherche de véhicule par plaque d'immatriculation française
 * Utilise l'API apiplaqueimmatriculation.com (SIV)
 *
 * Docs : https://apiplaqueimmatriculation.com/documentation-de-lapi-de-plaque-immatriculation/
 */

/**
 * Mapping marque + modèle → dimensions de pneus courantes
 * Format : "marque|modèle" → [{ width, height, diameter }]
 * Ce mapping couvre les véhicules les plus courants en France
 */
const VEHICLE_TIRE_MAP = {
  // --- Peugeot ---
  'peugeot|208':     [{ width: 195, height: 55, diameter: 16 }, { width: 205, height: 45, diameter: 17 }],
  'peugeot|2008':    [{ width: 205, height: 55, diameter: 16 }, { width: 215, height: 55, diameter: 17 }],
  'peugeot|308':     [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'peugeot|3008':    [{ width: 225, height: 55, diameter: 18 }, { width: 235, height: 55, diameter: 19 }],
  'peugeot|5008':    [{ width: 225, height: 55, diameter: 18 }, { width: 235, height: 55, diameter: 19 }],
  'peugeot|108':     [{ width: 165, height: 65, diameter: 14 }, { width: 175, height: 65, diameter: 14 }],
  'peugeot|206':     [{ width: 185, height: 65, diameter: 15 }, { width: 195, height: 55, diameter: 15 }],
  'peugeot|207':     [{ width: 185, height: 65, diameter: 15 }, { width: 195, height: 55, diameter: 16 }],
  'peugeot|307':     [{ width: 195, height: 65, diameter: 15 }, { width: 205, height: 55, diameter: 16 }],
  'peugeot|407':     [{ width: 215, height: 55, diameter: 17 }, { width: 225, height: 50, diameter: 17 }],
  'peugeot|508':     [{ width: 215, height: 55, diameter: 17 }, { width: 235, height: 45, diameter: 18 }],
  'peugeot|partner': [{ width: 195, height: 65, diameter: 15 }, { width: 205, height: 65, diameter: 15 }],
  // --- Renault ---
  'renault|clio':    [{ width: 185, height: 65, diameter: 15 }, { width: 195, height: 55, diameter: 16 }],
  'renault|megane':  [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'renault|captur':  [{ width: 205, height: 55, diameter: 17 }, { width: 215, height: 55, diameter: 17 }],
  'renault|scenic':  [{ width: 205, height: 55, diameter: 17 }, { width: 215, height: 55, diameter: 17 }],
  'renault|kadjar':  [{ width: 215, height: 60, diameter: 17 }, { width: 225, height: 55, diameter: 18 }],
  'renault|arkana':  [{ width: 215, height: 55, diameter: 18 }, { width: 225, height: 45, diameter: 19 }],
  'renault|austral': [{ width: 215, height: 55, diameter: 18 }, { width: 235, height: 45, diameter: 20 }],
  'renault|twingo':  [{ width: 165, height: 65, diameter: 15 }, { width: 185, height: 55, diameter: 15 }],
  'renault|kangoo':  [{ width: 195, height: 65, diameter: 15 }, { width: 205, height: 55, diameter: 16 }],
  'renault|trafic':  [{ width: 215, height: 65, diameter: 16 }, { width: 225, height: 65, diameter: 16 }],
  'renault|master':  [{ width: 225, height: 65, diameter: 16 }, { width: 235, height: 65, diameter: 16 }],
  // --- Citroën ---
  'citroen|c3':      [{ width: 195, height: 55, diameter: 16 }, { width: 205, height: 45, diameter: 17 }],
  'citroen|c4':      [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 18 }],
  'citroen|c5':      [{ width: 225, height: 55, diameter: 18 }, { width: 235, height: 45, diameter: 19 }],
  'citroen|c5 aircross': [{ width: 225, height: 55, diameter: 18 }, { width: 235, height: 55, diameter: 19 }],
  'citroen|berlingo':[{ width: 195, height: 65, diameter: 15 }, { width: 205, height: 60, diameter: 16 }],
  'citroen|c1':      [{ width: 155, height: 65, diameter: 14 }, { width: 165, height: 60, diameter: 15 }],
  'citroen|c2':      [{ width: 185, height: 55, diameter: 15 }, { width: 195, height: 45, diameter: 16 }],
  'citroen|ds3':     [{ width: 195, height: 55, diameter: 16 }, { width: 205, height: 45, diameter: 17 }],
  'citroen|ds4':     [{ width: 225, height: 45, diameter: 18 }, { width: 235, height: 40, diameter: 18 }],
  'citroen|ds5':     [{ width: 225, height: 45, diameter: 18 }, { width: 235, height: 45, diameter: 18 }],
  // --- Volkswagen ---
  'volkswagen|golf': [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'volkswagen|polo': [{ width: 185, height: 65, diameter: 15 }, { width: 195, height: 55, diameter: 16 }],
  'volkswagen|tiguan': [{ width: 215, height: 65, diameter: 17 }, { width: 235, height: 55, diameter: 18 }],
  'volkswagen|t-roc': [{ width: 215, height: 55, diameter: 17 }, { width: 225, height: 45, diameter: 18 }],
  'volkswagen|passat': [{ width: 215, height: 55, diameter: 17 }, { width: 235, height: 45, diameter: 18 }],
  'volkswagen|touran': [{ width: 205, height: 55, diameter: 16 }, { width: 215, height: 55, diameter: 17 }],
  'volkswagen|transporter': [{ width: 205, height: 65, diameter: 16 }, { width: 215, height: 65, diameter: 16 }],
  'volkswagen|up':   [{ width: 165, height: 70, diameter: 14 }, { width: 175, height: 65, diameter: 14 }],
  // --- BMW ---
  'bmw|serie 1':     [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'bmw|serie 3':     [{ width: 225, height: 45, diameter: 17 }, { width: 225, height: 45, diameter: 18 }],
  'bmw|serie 5':     [{ width: 225, height: 55, diameter: 17 }, { width: 245, height: 45, diameter: 18 }],
  'bmw|x1':          [{ width: 225, height: 55, diameter: 17 }, { width: 225, height: 50, diameter: 18 }],
  'bmw|x3':          [{ width: 225, height: 60, diameter: 18 }, { width: 245, height: 50, diameter: 19 }],
  'bmw|x5':          [{ width: 255, height: 55, diameter: 18 }, { width: 275, height: 45, diameter: 20 }],
  // --- Mercedes ---
  'mercedes|classe a': [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'mercedes|classe b': [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'mercedes|classe c': [{ width: 225, height: 45, diameter: 17 }, { width: 225, height: 45, diameter: 18 }],
  'mercedes|classe e': [{ width: 225, height: 55, diameter: 17 }, { width: 245, height: 45, diameter: 18 }],
  'mercedes|gla':    [{ width: 215, height: 60, diameter: 17 }, { width: 235, height: 55, diameter: 18 }],
  'mercedes|glc':    [{ width: 235, height: 60, diameter: 18 }, { width: 255, height: 45, diameter: 20 }],
  // --- Audi ---
  'audi|a1':         [{ width: 185, height: 60, diameter: 15 }, { width: 215, height: 45, diameter: 17 }],
  'audi|a3':         [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'audi|a4':         [{ width: 225, height: 50, diameter: 17 }, { width: 245, height: 40, diameter: 18 }],
  'audi|q3':         [{ width: 215, height: 60, diameter: 17 }, { width: 235, height: 55, diameter: 18 }],
  'audi|q5':         [{ width: 235, height: 55, diameter: 19 }, { width: 255, height: 45, diameter: 20 }],
  // --- Toyota ---
  'toyota|yaris':    [{ width: 175, height: 65, diameter: 15 }, { width: 185, height: 60, diameter: 15 }],
  'toyota|corolla':  [{ width: 195, height: 65, diameter: 15 }, { width: 225, height: 45, diameter: 17 }],
  'toyota|c-hr':     [{ width: 215, height: 60, diameter: 17 }, { width: 225, height: 50, diameter: 18 }],
  'toyota|rav4':     [{ width: 225, height: 65, diameter: 17 }, { width: 235, height: 55, diameter: 19 }],
  'toyota|aygo':     [{ width: 165, height: 65, diameter: 14 }, { width: 175, height: 65, diameter: 14 }],
  // --- Dacia ---
  'dacia|sandero':   [{ width: 185, height: 65, diameter: 15 }, { width: 195, height: 55, diameter: 16 }],
  'dacia|duster':    [{ width: 215, height: 65, diameter: 16 }, { width: 215, height: 60, diameter: 17 }],
  'dacia|jogger':    [{ width: 195, height: 65, diameter: 16 }, { width: 205, height: 55, diameter: 17 }],
  'dacia|spring':    [{ width: 165, height: 70, diameter: 14 }],
  'dacia|logan':     [{ width: 185, height: 65, diameter: 15 }, { width: 195, height: 55, diameter: 16 }],
  // --- Fiat ---
  'fiat|500':        [{ width: 175, height: 65, diameter: 14 }, { width: 185, height: 55, diameter: 15 }],
  'fiat|panda':      [{ width: 175, height: 65, diameter: 14 }, { width: 185, height: 55, diameter: 15 }],
  'fiat|tipo':       [{ width: 195, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'fiat|500x':       [{ width: 215, height: 55, diameter: 17 }, { width: 225, height: 45, diameter: 18 }],
  // --- Opel ---
  'opel|corsa':      [{ width: 185, height: 65, diameter: 15 }, { width: 195, height: 55, diameter: 16 }],
  'opel|astra':      [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'opel|grandland':  [{ width: 215, height: 60, diameter: 17 }, { width: 225, height: 55, diameter: 18 }],
  'opel|mokka':      [{ width: 215, height: 60, diameter: 17 }, { width: 225, height: 50, diameter: 18 }],
  // --- Ford ---
  'ford|fiesta':     [{ width: 195, height: 55, diameter: 16 }, { width: 205, height: 45, diameter: 17 }],
  'ford|focus':      [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'ford|puma':       [{ width: 205, height: 55, diameter: 17 }, { width: 225, height: 45, diameter: 18 }],
  'ford|kuga':       [{ width: 225, height: 55, diameter: 18 }, { width: 235, height: 50, diameter: 19 }],
  'ford|transit':    [{ width: 215, height: 65, diameter: 16 }, { width: 215, height: 75, diameter: 16 }],
  // --- Hyundai ---
  'hyundai|i10':     [{ width: 165, height: 60, diameter: 14 }, { width: 175, height: 60, diameter: 15 }],
  'hyundai|i20':     [{ width: 185, height: 65, diameter: 15 }, { width: 195, height: 55, diameter: 16 }],
  'hyundai|i30':     [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'hyundai|tucson':  [{ width: 215, height: 65, diameter: 17 }, { width: 235, height: 55, diameter: 19 }],
  'hyundai|kona':    [{ width: 215, height: 55, diameter: 17 }, { width: 235, height: 45, diameter: 18 }],
  // --- Kia ---
  'kia|picanto':     [{ width: 165, height: 60, diameter: 14 }, { width: 175, height: 60, diameter: 15 }],
  'kia|ceed':        [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'kia|sportage':    [{ width: 215, height: 65, diameter: 17 }, { width: 235, height: 55, diameter: 19 }],
  'kia|niro':        [{ width: 205, height: 60, diameter: 16 }, { width: 225, height: 45, diameter: 18 }],
  // --- Nissan ---
  'nissan|micra':    [{ width: 185, height: 65, diameter: 15 }, { width: 195, height: 55, diameter: 16 }],
  'nissan|qashqai':  [{ width: 215, height: 60, diameter: 17 }, { width: 225, height: 55, diameter: 18 }],
  'nissan|juke':     [{ width: 205, height: 60, diameter: 16 }, { width: 215, height: 55, diameter: 17 }],
  // --- Seat / Cupra ---
  'seat|ibiza':      [{ width: 185, height: 65, diameter: 15 }, { width: 195, height: 55, diameter: 16 }],
  'seat|leon':       [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'seat|arona':      [{ width: 205, height: 55, diameter: 16 }, { width: 215, height: 50, diameter: 17 }],
  'seat|ateca':      [{ width: 215, height: 55, diameter: 17 }, { width: 235, height: 50, diameter: 18 }],
  // --- Skoda ---
  'skoda|octavia':   [{ width: 205, height: 55, diameter: 16 }, { width: 225, height: 45, diameter: 17 }],
  'skoda|fabia':     [{ width: 185, height: 60, diameter: 15 }, { width: 195, height: 55, diameter: 16 }],
  'skoda|karoq':     [{ width: 215, height: 55, diameter: 17 }, { width: 225, height: 50, diameter: 18 }],
  'skoda|kodiaq':    [{ width: 225, height: 55, diameter: 18 }, { width: 235, height: 55, diameter: 19 }],
  // --- Volvo ---
  'volvo|xc40':      [{ width: 225, height: 50, diameter: 18 }, { width: 235, height: 50, diameter: 19 }],
  'volvo|xc60':      [{ width: 235, height: 55, diameter: 19 }, { width: 255, height: 45, diameter: 20 }],
};

/**
 * Normaliser le texte pour le matching (minuscules, sans accents, sans tirets)
 */
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ')
    .trim();
}

/**
 * Trouver les dimensions de pneus pour un véhicule donné
 */
function findTireSizes(marque, modele) {
  const normMarque = normalize(marque);
  const normModele = normalize(modele);

  // Essai exact
  const key = `${normMarque}|${normModele}`;
  if (VEHICLE_TIRE_MAP[key]) return VEHICLE_TIRE_MAP[key];

  // Essai partiel : chercher le modèle dans les clés de la marque
  for (const [mapKey, sizes] of Object.entries(VEHICLE_TIRE_MAP)) {
    const [mapMarque, mapModele] = mapKey.split('|');
    if (normMarque.includes(mapMarque) || mapMarque.includes(normMarque)) {
      if (normModele.includes(mapModele) || mapModele.includes(normModele)) {
        return sizes;
      }
    }
  }

  return null;
}

/**
 * Plaques de démonstration pour la présentation client.
 * En production, le client branche son token API (39€/mois illimité)
 * sur apiplaqueimmatriculation.com et les vraies données remplacent celles-ci.
 */
const DEMO_PLATES = {
  'FM643XW': { marque: 'Peugeot', modele: '308', version: '308 II 1.2 PureTech 130ch', dateMiseEnCirculation: '2021-06-15', energie: 'Essence', puissanceFiscale: '7', photoModele: '' },
  'GH452AB': { marque: 'Renault', modele: 'Clio', version: 'Clio V 1.0 TCe 100ch', dateMiseEnCirculation: '2022-03-20', energie: 'Essence', puissanceFiscale: '5', photoModele: '' },
  'EF789CD': { marque: 'Citroën', modele: 'C3', version: 'C3 III 1.2 PureTech 83ch', dateMiseEnCirculation: '2020-09-10', energie: 'Essence', puissanceFiscale: '5', photoModele: '' },
  'DL321EF': { marque: 'Volkswagen', modele: 'Golf', version: 'Golf VIII 1.5 TSI 150ch', dateMiseEnCirculation: '2023-01-05', energie: 'Essence', puissanceFiscale: '8', photoModele: '' },
  'AB123CD': { marque: 'BMW', modele: '3 Series', version: '320d xDrive 190ch', dateMiseEnCirculation: '2022-07-12', energie: 'Diesel', puissanceFiscale: '10', photoModele: '' },
  'CK987GH': { marque: 'Toyota', modele: 'Yaris', version: 'Yaris IV 1.5 Hybride 116ch', dateMiseEnCirculation: '2021-11-30', energie: 'Hybride', puissanceFiscale: '4', photoModele: '' },
  'FP456LM': { marque: 'Mercedes', modele: 'Classe A', version: 'A 200 163ch', dateMiseEnCirculation: '2023-04-18', energie: 'Essence', puissanceFiscale: '9', photoModele: '' },
  'BN234QR': { marque: 'Audi', modele: 'A3', version: 'A3 Sportback 35 TFSI 150ch', dateMiseEnCirculation: '2022-08-22', energie: 'Essence', puissanceFiscale: '8', photoModele: '' },
  'GT567ST': { marque: 'Dacia', modele: 'Sandero', version: 'Sandero III 1.0 TCe 90ch', dateMiseEnCirculation: '2021-05-14', energie: 'Essence', puissanceFiscale: '5', photoModele: '' },
  'HK890UV': { marque: 'Ford', modele: 'Focus', version: 'Focus IV 1.0 EcoBoost 125ch', dateMiseEnCirculation: '2020-12-03', energie: 'Essence', puissanceFiscale: '6', photoModele: '' },
};

class PlateService {
  constructor() {
    this.apiUrl = 'https://api.apiplaqueimmatriculation.com/plaque';
    this.token = process.env.PLATE_API_TOKEN || '';
  }

  /**
   * Rechercher un véhicule par plaque française
   * Mode démo si pas de token API configuré, sinon appel API réel
   */
  async lookupPlate(plate) {
    const cleanPlate = plate.replace(/[-\s]/g, '').toUpperCase();

    // Mode démo : utiliser les plaques pré-enregistrées si pas de token API
    if (!this.token || this.token === 'TokenDemo2026B') {
      return this._lookupDemoPlate(cleanPlate);
    }

    // Mode production : appel API réel avec token client
    try {
      const response = await axios.post(this.apiUrl, null, {
        params: {
          immatriculation: cleanPlate,
          token: this.token,
          pays: 'FR',
        },
        headers: { Accept: 'application/json' },
        timeout: 10000,
      });

      const data = response.data;

      if (!data || data.error) {
        throw new Error(data?.error || 'Véhicule non trouvé pour cette plaque');
      }

      const vehicleData = data.data || data;
      const marque = vehicleData.marque || vehicleData.brand || '';
      const modele = vehicleData.modele || vehicleData.model || '';
      const version = vehicleData.version || '';
      const dateMiseEnCirculation = vehicleData.date_mise_en_circulation || vehicleData.date || '';
      const energie = vehicleData.energieNGC || vehicleData.energie || vehicleData.fuel || '';
      const puissance = vehicleData.puissance_fiscale || vehicleData.cv || '';
      const photoModele = vehicleData.photo_modele || '';
      const sraCommercial = vehicleData.sra_commercial || '';

      const tireSizes = findTireSizes(marque, modele);

      return {
        plate: cleanPlate,
        vehicle: {
          marque,
          modele,
          version: sraCommercial || version,
          dateMiseEnCirculation,
          energie,
          puissanceFiscale: puissance,
          photoModele,
        },
        tireSizes: tireSizes || [],
        tireSizesFound: !!tireSizes,
      };
    } catch (error) {
      if (error.response?.status === 401) {
        // Token invalide → basculer en mode démo plutôt que bloquer l'utilisateur
        console.warn('PLATE_API_TOKEN invalide (401), bascule en mode démo.');
        return this._lookupDemoPlate(cleanPlate);
      }
      if (error.response?.status === 429) {
        throw new Error('Limite de requêtes API plaque atteinte. Réessayez plus tard.');
      }
      throw error;
    }
  }

  /**
   * Recherche en mode démo (plaques pré-enregistrées)
   */
  _lookupDemoPlate(cleanPlate) {
    const demo = DEMO_PLATES[cleanPlate];
    if (demo) {
      const tireSizes = findTireSizes(demo.marque, demo.modele);
      return {
        plate: cleanPlate,
        vehicle: {
          marque: demo.marque,
          modele: demo.modele,
          version: demo.version,
          dateMiseEnCirculation: demo.dateMiseEnCirculation,
          energie: demo.energie,
          puissanceFiscale: demo.puissanceFiscale,
          photoModele: demo.photoModele,
        },
        tireSizes: tireSizes || [],
        tireSizesFound: !!tireSizes,
      };
    }
    throw new Error('Plaque non reconnue. Utilisez la recherche par dimensions (ex : 205/55 R16).');
  }
}

const plateService = new PlateService();
export default plateService;
