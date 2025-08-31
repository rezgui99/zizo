const db = require("../../models/index");
const { Employee, EmployeeSkill, Skill, SkillLevel, SkillType, sequelize } = db;

async function syncEmployeeSkills({ employee, skills, transaction }) {
  console.log('Syncing skills for employee:', employee.id, 'Skills count:', skills.length);
  
  // Supprimer toutes les compétences existantes
  await EmployeeSkill.destroy({
    where: { employee_id: employee.id },
    transaction,
  });

  // Ajouter les nouvelles compétences
  await addEmployeeSkills({ employee, skills, transaction });
}

async function addEmployeeSkills({ employee, skills, transaction }) {
  console.log('Adding skills to employee:', employee.id);
  
  // Ajouter les nouvelles compétences
  for (const skillData of skills) {
    console.log('Processing skill:', skillData);
    
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

    console.log('Creating EmployeeSkill:', {
      employee_id: employee.id,
      skill_id: skillInstance.id,
      actual_skill_level_id: skillLevelId
    });
    
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
  
  console.log('All skills added successfully');
}

const findAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      include: [{
        model: EmployeeSkill,
        as: 'EmployeeSkills',
        include: [
          {
            model: Skill,
            as: 'Skill',
            include: [
              {
                model: SkillType,
                as: "type",
              },
            ],
          },
          {
            model: SkillLevel,
            as: 'SkillLevel',
          },
        ],
      }],
    });
    
    console.log('Employees loaded:', employees.length);
    if (employees.length > 0) {
      console.log('First employee skills:', employees[0].EmployeeSkills?.length || 0);
      if (employees[0].EmployeeSkills?.length > 0) {
        console.log('First skill structure:', JSON.stringify(employees[0].EmployeeSkills[0], null, 2));
      }
    }
    res.json(employees);
  } catch (error) {
    console.error('Error in findAllEmployees:', error);
    res.status(500).json({ error: error.message });
  }
};

const findEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id, {
      include: [{
        model: EmployeeSkill,
        as: 'EmployeeSkills',
        include: [
          {
            model: Skill,
            as: 'Skill',
            include: [
              {
                model: SkillType,
                as: "type",
              },
            ],
          },
          {
            model: SkillLevel,
            as: 'SkillLevel',
          },
        ],
      }],
    });
    if (!employee)
      return res.status(404).json({ message: "L'employée n'existe pas" });
    
    console.log('Employee found with skills:', {
      id: employee.id,
      name: employee.name,
      skillsCount: employee.EmployeeSkills?.length || 0,
      skillsData: employee.EmployeeSkills
    });
    
    res.json(employee);
  } catch (error) {
    console.error('Error in findEmployeeById:', error);
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
    console.log('Updating employee:', req.params.id, 'with skills:', skills.length);
    
    console.log('Creating employee with data:', { name, position, email, skills: skills.length });
    
    const employee = await Employee.create(
      { name, position, hire_date, email, phone, gender, location, notes },
      { transaction: t }
    );

    console.log('Employee created with ID:', employee.id);
    
    // Pour un nouvel employé, on ajoute directement les compétences sans supprimer
    if (skills && skills.length > 0) {
      console.log('Adding skills to new employee:', skills);
      await addEmployeeSkills({ employee, skills, transaction: t });
    }

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
    console.error('Error creating employee:', err);
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
    console.log('Employee created successfully with skills:', createdEmployee.EmployeeSkills?.length || 0);
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
        as: 'EmployeeSkills',
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
    console.log('Employee updated successfully with skills:', updatedEmployee.EmployeeSkills?.length || 0);
    }

    await EmployeeSkill.destroy({
      where: { employee_id: employee.id },
      transaction: t,
    });

    await employee.destroy({ transaction: t });

    await t.commit();
    res.json({ message: "Employee supprimée avec succès" });
  } catch (error) {
    console.error('Error updating employee:', error);
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
