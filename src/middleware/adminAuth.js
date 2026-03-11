/**
 * Middleware d'authentification admin
 * Vérifie le header X-Admin-Key contre ADMIN_API_KEY
 */
const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];

  if (!process.env.ADMIN_API_KEY) {
    console.error('ADMIN_API_KEY non configurée dans les variables d\'environnement');
    return res.status(500).json({
      success: false,
      message: 'Configuration serveur manquante',
    });
  }

  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Accès non autorisé',
    });
  }

  next();
};

export default adminAuth;
