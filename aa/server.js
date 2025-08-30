require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

console.log("🚀 Démarrage du serveur...");
console.log("📁 Répertoire de travail:", process.cwd());
console.log("🔧 NODE_ENV:", process.env.NODE_ENV);
console.log("🗄️ DB_HOST:", process.env.DB_HOST);
console.log("🗄️ DB_NAME:", process.env.DB_NAME);

let db;
try {
  db = require("./models"); // ← récupère l’unique instance Sequelize
  console.log("✅ Modèles chargés avec succès");
} catch (e) {
  console.error("❌ Erreur lors du chargement des modèles :", e.message);
  console.error("Stack trace:", e.stack);
  process.exit(1);
}

try {
  const jobDescriptionRoutes = require("./src1/routes/jobdescription");
  const linkedinRoutes = require("./src1/routes/linkedin");
  const moyenRoutes = require("./src1/routes/moyen");
  const employeeRoutes = require("./src1/routes/employee"); 
  const skillRoutes = require("./src1/routes/skill"); 
  const skilltypeRoutes = require("./src1/routes/skilltype"); 
  const skilllevelRoutes = require("./src1/routes/skilllevel"); 
  const employeeskillRoutes = require("./src1/routes/employeeskill"); 
  const jobrequiredskillRoutes = require("./src1/routes/jobrequiredskill"); 
  const swaggerDocument = YAML.load("./swagger.yaml");
  const jobEmployeeSkillMatchRoutes = require("./src1/routes/jobemployeeskillmatch");
  const authRoutes = require("./src1/routes/auth");
  const userManagementRoutes = require("./src1/routes/userManagement");
  const jobOfferRoutes = require("./src1/routes/joboffer");
  const analyticsRoutes = require("./src1/routes/analytics");
  console.log("✅ Routes chargées avec succès");
} catch (e) {
  console.error("❌ Erreur lors du chargement des routes :", e.message);
  console.error("Stack trace:", e.stack);
  process.exit(1);
}
       



const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use(express.json());
app.use(cors({
  origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.get("/", (req, res) =>
  res.json({ status: "Matchnhire backend node 22.11.0", version: "v1" })
);

try {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use("/api/jobdescriptions", jobDescriptionRoutes);
  app.use("/api/linkedin", linkedinRoutes);
  app.use("/api/moyens", moyenRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/skills", skillRoutes);
  app.use("/api/skilltypes", skilltypeRoutes);
  app.use("/api/skilllevels", skilllevelRoutes);
  app.use("/api/employeeskills", employeeskillRoutes);
  app.use("/api/jobrequiredskills", jobrequiredskillRoutes);
  app.use("/api/jobemployeeskillmatch", jobEmployeeSkillMatchRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", userManagementRoutes);
  app.use("/api/job-offers", jobOfferRoutes);
  app.use("/api/analytics", analyticsRoutes);
  console.log("✅ Routes API configurées");
} catch (e) {
  console.error("❌ Erreur lors de la configuration des routes :", e.message);
  process.exit(1);
}


// 404 - Route non trouvée
app.use((req, res, next) => {
  console.log(`❌ Route non trouvée: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Route not found" });
});

// Middleware global d’erreur
app.use((err, req, res, next) => {
  console.error("❌ Erreur serveur :", err.stack);
  console.error("❌ Détails de l'erreur :", err.message);
  res.status(500).json({ error: "Internal Server Error" });
});

// ─── Connexion & synchronisation ──────────────────────────────────────────────
(async () => {
  try {
    console.log("🔗 Tentative de connexion à la base de données...");
    await db.sequelize.authenticate();
    console.log("✅ DB connection OK");

    console.log("🔄 Synchronisation des modèles...");
    await db.sequelize.sync(); // ou sync({ alter: true }) / { force: true }
    console.log("✅ Models synced");

    app.listen(PORT, () =>
      console.log(`🚀 Server running on http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("❌ Unable to connect to the DB:", err.message);
    console.error("❌ Stack trace:", err.stack);
    process.exit(1);
  }
})();
