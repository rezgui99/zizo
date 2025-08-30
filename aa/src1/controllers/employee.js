const db = require("../../models/index");
const { Employee, EmployeeSkill, Skill, SkillLevel, sequelize } = db;

async function syncEmployeeSkills({ employee, skills, transaction }) {
  // Supprimer toutes les compétences existantes
  await EmployeeSkill.destroy({
    where: { employee_id: employee.id },
    transaction,
  });

  // Ajouter les nouvelles compétences
  for (const skillData of skills) {
    // Vérifier que la compétence existe
    const skillInstance = await Skill.findByPk(skillData.skill_id, { transaction });
    if (!skillInstance) {
      throw new Error(`Compétence avec id ${skillData.skill_id} n'existe pas.`);
    }

    // Vérifier que le niveau existe si fourni
    let skillLevelId = skillData.actual_skill_level_id || null;
    if (skillLevelId) {
      const level = await SkillLevel.findByPk(skillLevelId, { transaction });
      if (!level) {
        throw new Error(`Niveau avec id ${skillLevelId} n'existe pas.`);
      }
    }

    // Créer l'association employé-compétence
    await EmployeeSkill.create(
      {
        employee_id: employee.id,
        skill_id: skillInstance.id,
        actual_skill_level_id: skillLevelId,
        acquired_date: skillData.acquired_date || null,
        certification: skillData.certification || null,
        last_evaluated_date: skillData.last_evaluated_date || null,
      },
      { transaction }
    );
  }
}

const findAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      include: {
        model: EmployeeSkill,
        include: [Skill, SkillLevel],
      },
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const findEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id, {
      include: {
        model: EmployeeSkill,
        include: [Skill, SkillLevel],
      },
    });
    if (!employee)
      return res.status(404).json({ message: "L'employée n'existe pas" });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createEmployee = async (req, res) => {
  const {
    name,
    position,
    hire_date,
    email,
    phone,
    gender,
    location,
    notes,
    skills = [],
  } = req.body;

  const t = await sequelize.transaction();

  try {
    const employee = await Employee.create(
      { name, position, hire_date, email, phone, gender, location, notes },
      { transaction: t }
    );

    await syncEmployeeSkills({ employee, skills, transaction: t });

    const createdEmployee = await Employee.findByPk(employee.id, {
      include: {
        model: EmployeeSkill,
        include: [Skill, SkillLevel],
      },
      transaction: t,
    });

    await t.commit();
    res.status(201).json(createdEmployee);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
};

const updateEmployee = async (req, res) => {
  const {
    name,
    position,
    hire_date,
    email,
    phone,
    gender,
    location,
    notes,
    skills = [],
  } = req.body;

  const t = await sequelize.transaction();

  try {
    const employee = await Employee.findByPk(req.params.id, { transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ message: "L'employée n'existe pas" });
    }

    await employee.update(
      { name, position, hire_date, email, phone, gender, location, notes },
      { transaction: t }
    );

    await syncEmployeeSkills({ employee, skills, transaction: t });

    const updatedEmployee = await Employee.findByPk(employee.id, {
      include: {
        model: EmployeeSkill,
        include: [Skill, SkillLevel],
      },
      transaction: t,
    });

    await t.commit();
    res.json(updatedEmployee);
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

const deleteEmployee = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const employee = await Employee.findByPk(req.params.id, { transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({ message: "L'employée n'existe pas" });
    }

    await EmployeeSkill.destroy({
      where: { employee_id: employee.id },
      transaction: t,
    });

    await employee.destroy({ transaction: t });

    await t.commit();
    res.json({ message: "Employee supprimée avec succès" });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  findAllEmployees,
  findEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
