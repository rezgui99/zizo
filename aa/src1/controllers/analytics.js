const db = require("../../models/index");
const { 
  Employee, 
  JobDescription, 
  EmployeeSkill, 
  JobRequiredSkill,
  Skill, 
  SkillLevel,
  SkillType,
  JobOffer,
  sequelize 
} = db;

// Vue d'ensemble des analytics
const getAnalyticsOverview = async (req, res) => {
  try {
    const { date_from, date_to, department, contract_type } = req.query;
    
    // Construire les conditions de filtre
    const whereConditions = {};
    if (date_from) whereConditions.createdAt = { [sequelize.Sequelize.Op.gte]: new Date(date_from) };
    if (date_to) {
      whereConditions.createdAt = { 
        ...whereConditions.createdAt,
        [sequelize.Sequelize.Op.lte]: new Date(date_to) 
      };
    }

    // Statistiques de base
    const totalEmployees = await Employee.count();
    const totalJobDescriptions = await JobDescription.count();
    const totalJobOffers = await JobOffer.count({ where: whereConditions });
    
    // Calcul du taux de succès simulé (à adapter selon vos données réelles)
    const publishedOffers = await JobOffer.count({ 
      where: { ...whereConditions, status: 'published' } 
    });
    const overallSuccessRate = totalJobOffers > 0 ? (publishedOffers / totalJobOffers) * 100 : 0;

    // Top départements (basé sur les filières d'activité)
    const topDepartments = await JobDescription.findAll({
      attributes: [
        'filiere_activite',
        [sequelize.fn('COUNT', sequelize.col('id')), 'job_count']
      ],
      group: ['filiere_activite'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 5,
      raw: true
    });

    // Compétences les plus demandées
    const topSkills = await JobRequiredSkill.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('JobRequiredSkill.skill_id')), 'demand_count']
      ],
      include: [
        {
          model: Skill,
          attributes: ['id', 'name']
        }
      ],
      group: ['skill_id', 'Skill.id', 'Skill.name'],
      order: [[sequelize.fn('COUNT', sequelize.col('JobRequiredSkill.skill_id')), 'DESC']],
      limit: 10
    });

    const skillsInHighDemand = topSkills.map(skill => ({
      skill_id: skill.Skill.id,
      skill_name: skill.Skill.name,
      demand_count: parseInt(skill.dataValues.demand_count),
      success_rate_with_skill: 75 + Math.random() * 20, // Simulé
      average_level_required: 2.5 + Math.random() * 2
    }));

    // Types de contrat (simulé car pas encore dans la DB)
    const contractTypeBreakdown = [
      { contract_type: 'CDI', total_applications: 200, successful_applications: 140, success_rate: 70.0 },
      { contract_type: 'CDD', total_applications: 100, successful_applications: 65, success_rate: 65.0 },
      { contract_type: 'Stage', total_applications: 80, successful_applications: 60, success_rate: 75.0 },
      { contract_type: 'Freelance', total_applications: 70, successful_applications: 45, success_rate: 64.3 }
    ];

    const overview = {
      total_employees: totalEmployees,
      total_job_descriptions: totalJobDescriptions,
      total_applications: totalJobOffers,
      overall_success_rate: overallSuccessRate,
      top_performing_departments: topDepartments.map(dept => ({
        department: dept.filiere_activite,
        total_applications: parseInt(dept.job_count) * 5, // Simulé
        successful_applications: parseInt(dept.job_count) * 3, // Simulé
        success_rate: 60 + Math.random() * 30,
        average_time_to_hire: 10 + Math.random() * 15,
        top_skills_requested: []
      })),
      skills_in_high_demand: skillsInHighDemand,
      contract_type_breakdown: contractTypeBreakdown,
      recent_trends: []
    };

    res.json(overview);
  } catch (error) {
    console.error('Error in getAnalyticsOverview:', error);
    res.status(500).json({ error: error.message });
  }
};

// Recommandations de compétences pour un employé
const getEmployeeSkillRecommendations = async (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    
    // Récupérer l'employé avec ses compétences
    const employee = await Employee.findByPk(employeeId, {
      include: [
        {
          model: EmployeeSkill,
          include: [
            { model: Skill, include: [{ model: SkillType, as: 'type' }] },
            { model: SkillLevel }
          ]
        }
      ]
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' });
    }

    // Récupérer toutes les compétences requises dans les fiches de poste
    const allRequiredSkills = await JobRequiredSkill.findAll({
      include: [
        { 
          model: JobDescription, 
          attributes: ['id', 'emploi', 'filiere_activite', 'famille'] 
        },
        { 
          model: Skill, 
          include: [{ model: SkillType, as: 'type' }] 
        },
        { model: SkillLevel }
      ]
    });

    // Analyser les compétences de l'employé
    const employeeSkillsMap = new Map();
    employee.EmployeeSkills?.forEach(empSkill => {
      employeeSkillsMap.set(empSkill.skill_id, empSkill.SkillLevel?.value || 0);
    });

    // Générer les recommandations
    const skillRecommendations = [];
    const skillDemandMap = new Map();

    // Analyser la demande pour chaque compétence
    allRequiredSkills.forEach(reqSkill => {
      const skillId = reqSkill.skill_id;
      const requiredLevel = reqSkill.SkillLevel?.value || 0;
      const currentLevel = employeeSkillsMap.get(skillId) || 0;
      
      if (!skillDemandMap.has(skillId)) {
        skillDemandMap.set(skillId, {
          skill: reqSkill.Skill,
          demand_count: 0,
          total_required_level: 0,
          positions: []
        });
      }
      
      const skillData = skillDemandMap.get(skillId);
      skillData.demand_count++;
      skillData.total_required_level += requiredLevel;
      skillData.positions.push(reqSkill.JobDescription);
    });

    // Créer les recommandations
    for (const [skillId, skillData] of skillDemandMap) {
      const currentLevel = employeeSkillsMap.get(skillId) || 0;
      const averageRequiredLevel = skillData.total_required_level / skillData.demand_count;
      
      if (currentLevel < averageRequiredLevel) {
        const gap = averageRequiredLevel - currentLevel;
        const priorityScore = Math.min(100, (gap * 25) + (skillData.demand_count * 5));
        
        skillRecommendations.push({
          skill_id: skillId,
          skill_name: skillData.skill.name,
          skill_type: skillData.skill.type?.type_name || 'Non défini',
          current_level: currentLevel,
          recommended_level: Math.ceil(averageRequiredLevel),
          priority_score: Math.round(priorityScore),
          justification: `Compétence demandée dans ${skillData.demand_count} poste(s). Écart de ${gap.toFixed(1)} niveau(x).`,
          estimated_learning_time: gap <= 1 ? '1-2 mois' : gap <= 2 ? '3-6 mois' : '6-12 mois',
          available_positions_count: skillData.demand_count,
          potential_salary_increase: Math.round(gap * 2000) // Estimation
        });
      }
    }

    // Trier par score de priorité
    skillRecommendations.sort((a, b) => b.priority_score - a.priority_score);

    // Opportunités de carrière
    const careerOpportunities = [];
    const jobDescriptions = await JobDescription.findAll({
      include: [
        {
          model: JobRequiredSkill,
          as: 'requiredSkills',
          include: [
            { model: Skill },
            { model: SkillLevel }
          ]
        }
      ]
    });

    jobDescriptions.forEach(job => {
      if (!job.requiredSkills || job.requiredSkills.length === 0) return;

      let totalScore = 0;
      let maxScore = 0;
      const missingSkills = [];

      job.requiredSkills.forEach(reqSkill => {
        const requiredLevel = reqSkill.SkillLevel?.value || 0;
        const currentLevel = employeeSkillsMap.get(reqSkill.skill_id) || 0;
        
        maxScore += requiredLevel;
        totalScore += Math.min(currentLevel, requiredLevel);
        
        if (currentLevel < requiredLevel) {
          missingSkills.push({
            skill_name: reqSkill.Skill?.name || 'Compétence inconnue',
            required_level: requiredLevel,
            current_level: currentLevel,
            gap: requiredLevel - currentLevel
          });
        }
      });

      const compatibilityScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

      if (compatibilityScore >= 40) { // Seuil minimum de compatibilité
        careerOpportunities.push({
          job_description_id: job.id,
          job_title: job.emploi,
          department: job.filiere_activite,
          compatibility_score: Math.round(compatibilityScore),
          missing_skills: missingSkills,
          estimated_timeline: missingSkills.length <= 2 ? '3-6 mois' : missingSkills.length <= 4 ? '6-12 mois' : '12+ mois',
          salary_range: {
            min: 30000 + (compatibilityScore * 300),
            max: 45000 + (compatibilityScore * 500)
          }
        });
      }
    });

    // Trier par score de compatibilité
    careerOpportunities.sort((a, b) => b.compatibility_score - a.compatibility_score);

    const response = {
      employee_id: employeeId,
      employee_name: employee.name,
      current_position: employee.position,
      recommendations: skillRecommendations.slice(0, 10), // Top 10
      career_opportunities: careerOpportunities.slice(0, 5), // Top 5
      overall_development_score: Math.round(
        (skillRecommendations.length > 0 ? 
          skillRecommendations.reduce((sum, rec) => sum + rec.priority_score, 0) / skillRecommendations.length : 
          80) // Score par défaut si pas de recommandations
      )
    };

    res.json(response);
  } catch (error) {
    console.error('Error in getEmployeeSkillRecommendations:', error);
    res.status(500).json({ error: error.message });
  }
};

// Prédiction de succès pour une candidature
const predictApplicationSuccess = async (req, res) => {
  try {
    const { employee_id, job_description_id } = req.body;

    // Récupérer l'employé et la fiche de poste
    const [employee, jobDescription] = await Promise.all([
      Employee.findByPk(employee_id, {
        include: [
          {
            model: EmployeeSkill,
            include: [{ model: SkillLevel }]
          }
        ]
      }),
      JobDescription.findByPk(job_description_id, {
        include: [
          {
            model: JobRequiredSkill,
            as: 'requiredSkills',
            include: [
              { model: Skill },
              { model: SkillLevel }
            ]
          }
        ]
      })
    ]);

    if (!employee || !jobDescription) {
      return res.status(404).json({ message: 'Employé ou fiche de poste non trouvé' });
    }

    // Calculer le score de matching
    const employeeSkillsMap = new Map();
    employee.EmployeeSkills?.forEach(empSkill => {
      employeeSkillsMap.set(empSkill.skill_id, empSkill.SkillLevel?.value || 0);
    });

    let totalScore = 0;
    let maxScore = 0;
    const keyFactors = [];

    if (jobDescription.requiredSkills && jobDescription.requiredSkills.length > 0) {
      jobDescription.requiredSkills.forEach(reqSkill => {
        const requiredLevel = reqSkill.SkillLevel?.value || 0;
        const currentLevel = employeeSkillsMap.get(reqSkill.skill_id) || 0;
        
        maxScore += requiredLevel;
        const skillScore = Math.min(currentLevel, requiredLevel);
        totalScore += skillScore;
        
        const impact = ((skillScore / requiredLevel) - 0.5) * 100;
        keyFactors.push({
          factor_name: reqSkill.Skill?.name || 'Compétence inconnue',
          impact_score: Math.round(impact),
          description: `Niveau actuel: ${currentLevel}, Requis: ${requiredLevel}`,
          weight: 0.8 // Poids des compétences
        });
      });
    }

    // Facteurs additionnels
    const experienceFactor = Math.min(100, (new Date().getFullYear() - new Date(employee.hire_date).getFullYear()) * 10);
    keyFactors.push({
      factor_name: 'Expérience',
      impact_score: experienceFactor - 50,
      description: `${new Date().getFullYear() - new Date(employee.hire_date).getFullYear()} années d'expérience`,
      weight: 0.2
    });

    // Calcul de la probabilité de succès
    const skillsScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 50;
    const finalScore = (skillsScore * 0.8) + (experienceFactor * 0.2);
    const successProbability = Math.min(95, Math.max(5, finalScore));

    // Niveau de confiance
    let confidenceLevel = 'medium';
    if (successProbability >= 80) confidenceLevel = 'high';
    else if (successProbability <= 40) confidenceLevel = 'low';

    // Recommandations
    const recommendations = [];
    if (successProbability < 70) {
      recommendations.push('Développer les compétences manquantes avant de postuler');
    }
    if (successProbability >= 70 && successProbability < 85) {
      recommendations.push('Bon candidat, préparer les entretiens sur les points forts');
    }
    if (successProbability >= 85) {
      recommendations.push('Candidat idéal, postuler immédiatement');
    }

    const prediction = {
      employee_id,
      job_description_id,
      success_probability: Math.round(successProbability),
      confidence_level: confidenceLevel,
      key_factors: keyFactors,
      recommendations,
      estimated_interview_score: Math.round(successProbability * 0.9)
    };

    res.json(prediction);
  } catch (error) {
    console.error('Error in predictApplicationSuccess:', error);
    res.status(500).json({ error: error.message });
  }
};

// Statistiques par département
const getDepartmentStatistics = async (req, res) => {
  try {
    const departments = await JobDescription.findAll({
      attributes: [
        'filiere_activite',
        [sequelize.fn('COUNT', sequelize.col('id')), 'job_count']
      ],
      group: ['filiere_activite'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      raw: true
    });

    const departmentStats = departments.map(dept => ({
      department: dept.filiere_activite,
      total_applications: parseInt(dept.job_count) * (5 + Math.floor(Math.random() * 10)),
      successful_applications: parseInt(dept.job_count) * (3 + Math.floor(Math.random() * 5)),
      success_rate: 60 + Math.random() * 30,
      average_time_to_hire: 10 + Math.random() * 15,
      top_skills_requested: []
    }));

    res.json(departmentStats);
  } catch (error) {
    console.error('Error in getDepartmentStatistics:', error);
    res.status(500).json({ error: error.message });
  }
};

// Statistiques par type de contrat
const getContractTypeStatistics = async (req, res) => {
  try {
    // Données simulées (à adapter selon votre modèle de données)
    const contractStats = [
      {
        contract_type: 'CDI',
        total_applications: 200,
        successful_applications: 140,
        success_rate: 70.0,
        average_salary_min: 35000,
        average_salary_max: 55000,
        most_requested_skills: ['JavaScript', 'Communication', 'Gestion de projet']
      },
      {
        contract_type: 'CDD',
        total_applications: 100,
        successful_applications: 65,
        success_rate: 65.0,
        average_salary_min: 30000,
        average_salary_max: 45000,
        most_requested_skills: ['Python', 'Adaptabilité', 'Travail en équipe']
      },
      {
        contract_type: 'Stage',
        total_applications: 80,
        successful_applications: 60,
        success_rate: 75.0,
        average_salary_min: 600,
        average_salary_max: 1200,
        most_requested_skills: ['Formation', 'Motivation', 'Apprentissage']
      },
      {
        contract_type: 'Freelance',
        total_applications: 70,
        successful_applications: 45,
        success_rate: 64.3,
        average_salary_min: 400,
        average_salary_max: 800,
        most_requested_skills: ['Expertise technique', 'Autonomie', 'Gestion du temps']
      }
    ];

    res.json(contractStats);
  } catch (error) {
    console.error('Error in getContractTypeStatistics:', error);
    res.status(500).json({ error: error.message });
  }
};

// Analyse de la demande de compétences
const getSkillsDemandAnalysis = async (req, res) => {
  try {
    const skillsDemand = await JobRequiredSkill.findAll({
      attributes: [
        'skill_id',
        [sequelize.fn('COUNT', sequelize.col('JobRequiredSkill.skill_id')), 'demand_count'],
        [sequelize.fn('AVG', sequelize.col('SkillLevel.value')), 'avg_level_required']
      ],
      include: [
        {
          model: Skill,
          attributes: ['id', 'name']
        },
        {
          model: SkillLevel,
          attributes: ['value']
        }
      ],
      group: ['skill_id', 'Skill.id', 'Skill.name'],
      order: [[sequelize.fn('COUNT', sequelize.col('JobRequiredSkill.skill_id')), 'DESC']],
      limit: 20
    });

    const skillsAnalysis = skillsDemand.map(skill => ({
      skill_id: skill.skill_id,
      skill_name: skill.Skill?.name || 'Compétence inconnue',
      demand_count: parseInt(skill.dataValues.demand_count),
      success_rate_with_skill: 70 + Math.random() * 25, // Simulé
      average_level_required: parseFloat(skill.dataValues.avg_level_required) || 0
    }));

    res.json(skillsAnalysis);
  } catch (error) {
    console.error('Error in getSkillsDemandAnalysis:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAnalyticsOverview,
  getEmployeeSkillRecommendations,
  predictApplicationSuccess,
  getDepartmentStatistics,
  getContractTypeStatistics,
  getSkillsDemandAnalysis
};