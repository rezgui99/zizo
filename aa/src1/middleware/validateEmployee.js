const Joi = require("joi");

const employeeSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  position: Joi.string().min(3).max(100).required(),
  hire_date: Joi.date().iso().required(),
  email: Joi.string().email().required(),
  phone: Joi.string()
    .pattern(/^\+?[0-9\s\-]{7,20}$/)
    .allow(null, ""),
  gender: Joi.string().valid("Homme", "Femme", "Autre").allow(null, ""),
  location: Joi.string().max(100).allow(null, ""),
  notes: Joi.string().allow(null, ""),
  skills: Joi.array().items(
    Joi.object({
      skill_id: Joi.number().integer().positive().required(),
      actual_skill_level_id: Joi.number().integer().positive().allow(null),
      acquired_date: Joi.date().iso().allow(null),
      certification: Joi.string().allow(null, ""),
      last_evaluated_date: Joi.date().iso().allow(null)
    })
  ).optional()
});

module.exports = function validateEmployee(req, res, next) {
  const { error } = employeeSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: "Erreur de validation",
      details: error.details.map((err) => err.message),
    });
  }
  next();
};
