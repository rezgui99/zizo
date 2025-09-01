const express = require("express");
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireAdminOrHR } = require('../middleware/roleAuth');

const {
  processQuestion,
  findBestEmployeeForJob,
  suggestTrainingForEmployee
} = require("../controllers/chatbot");

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Routes du chatbot
router.post("/question", requireAdminOrHR, processQuestion);
router.get("/best-employee/:job_id", requireAdminOrHR, findBestEmployeeForJob);
router.post("/training-suggestions", requireAdminOrHR, suggestTrainingForEmployee);

module.exports = router;