import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import syncService from './services/syncService.js';

// Charger les variables d'environnement
dotenv.config();

// Créer l'application Express
const app = express();

// Configuration CORS - Accepter plusieurs origines (local + Netlify + Render preview)
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://demo-adigicom.netlify.app',
  'https://mister-pneus.com',
  'https://www.mister-pneus.com',
  'https://misterpneu.fr',
  'https://www.misterpneu.fr',
];

// Ajouter les origines supplémentaires depuis la variable d'environnement
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach(origin => {
    const trimmed = origin.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
}

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (Postman, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Autoriser tous les sous-domaines netlify.app et onrender.com en dev
    if (origin.endsWith('.netlify.app') || origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origine non autorisée: ${origin}`));
  },
  credentials: true,
}));

// Middlewares de sécurité
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
}));

// Rate limiting pour éviter les abus
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite de 100 requêtes par IP
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard',
});
app.use('/api/', limiter);

// Compression des réponses
app.use(compression());

// Logger les requêtes (dev mode)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Parser le JSON (sauf pour le webhook Stripe)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/orders/webhook/stripe') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));

// Routes de l'API
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Route racine
app.get('/', (req, res) => {
  res.json({
    message: 'API Mister Pneu',
    version: '1.0.0',
    endpoints: {
      products: '/api/products',
      orders: '/api/orders',
      health: '/health',
    },
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erreur serveur interne';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connexion à la base de données
    await connectDatabase();

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════╗
║                                               ║
║   🚗  MISTER PNEU API SERVER  🚗             ║
║                                               ║
║   Server running on port ${PORT}               ║
║   Environment: ${process.env.NODE_ENV}                 ║
║   Frontend: ${process.env.FRONTEND_URL}  ║
║                                               ║
╚═══════════════════════════════════════════════╝
      `);

      // Démarrer la synchronisation automatique du catalogue Inter-Sprint
      const syncIntervalHours = parseInt(process.env.SYNC_INTERVAL_HOURS) || 8;
      syncService.startPeriodicSync(syncIntervalHours);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
