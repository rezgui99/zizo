
const db = require("../../models/index");
const {  User, Role, UserRole  } = db;

// Middleware pour vérifier les rôles
const requireRole = (...requiredRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Authentification requise'
        });
      }

      // Récupérer les rôles de l'utilisateur
      const userWithRoles = await User.findByPk(req.user.id, {
        include: [{
          model: Role,
          as: 'roles',
          where: { is_active: true },
          required: false,
          through: { attributes: [] }
        }]
      });

      if (!userWithRoles) {
        return res.status(401).json({
          error: 'User not found',
          message: 'Utilisateur non trouvé'
        });
      }

      const userRoles = userWithRoles.roles.map(role => role.name);
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Accès refusé. Rôles requis: ${requiredRoles.join(', ')}`
        });
      }

      // Ajouter les rôles à la requête pour utilisation ultérieure
      req.userRoles = userRoles;
      next();
    } catch (error) {
      console.error('Role verification error:', error);
      res.status(500).json({
        error: 'Role verification failed',
        message: 'Erreur lors de la vérification des rôles'
      });
    }
  };
};

// Middleware pour vérifier si l'utilisateur est admin
const requireAdmin = requireRole('admin');

// Middleware pour vérifier si l'utilisateur est admin ou HR
const requireAdminOrHR = requireRole('admin', 'hr');

// Middleware pour audit des actions
const auditAction = (action, tableName) => {
  return async (req, res, next) => {
    // Stocker les informations d'audit dans la requête
    req.auditInfo = {
      action,
      tableName,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent')
    };
    next();
  };
};

module.exports = {
  requireRole,
  requireAdmin,
  requireAdminOrHR,
  auditAction
};