const db = require("../../models/index");
const {
  Employee,
  JobDescription,
  JobRequiredSkill,
  EmployeeSkill,
  Skill,
  SkillLevel,
  SkillType,
  sequelize
} = db;

// Analyser une question et fournir une réponse intelligente
const processQuestion = async (req, res) => {
  try {
    const { question, context } = req.body;
    
    if (!question || question.trim() === '') {
      return res.status(400).json({ 
        error: 'Question requise',
        response: 'Veuillez poser une question.'
      });
    }

    const lowerQuestion = question.toLowerCase();
    
    // Détecter le type de question
    if (isJobMatchingQuery(lowerQuestion)) {
      const response = await handleJobMatchingQuery(question, context);
      res.json(response);
    } else if (isEmployeeInfoQuery(lowerQuestion)) {
      const response = await handleEmployeeInfoQuery(question);
      res.json(response);
    } else if (isTrainingQuery(lowerQuestion)) {
      const response = await handleTrainingQuery(question);
      res.json(response);
    } else if (isStatisticsQuery(lowerQuestion)) {
      const response = await handleStatisticsQuery(question);
      res.json(response);
    } else {
      res.json({
        response: "🤔 Je ne suis pas sûr de comprendre votre question. Voici ce que je peux faire :\n\n• Trouver le meilleur employé pour un poste\n• Analyser les compétences d'un employé\n• Suggérer des formations\n• Fournir des statistiques RH\n\nPouvez-vous reformuler votre question ?",
        type: 'help'
      });
    }
  } catch (error) {
    console.error('Error in processQuestion:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      response: 'Désolé, j\'ai rencontré une erreur. Veuillez réessayer.'
    });
  }
};

// Trouver le meilleur employé pour un poste spécifique
const findBestEmployeeForJob = async (req, res) => {
  try {
    const { job_id } = req.params;
    
    if (!job_id) {
      return res.status(400).json({ error: 'ID du poste requis' });
    }

    // Récupérer la fiche de poste
    const jobDescription = await JobDescription.findByPk(job_id, {
      include: [
        {
          model: JobRequiredSkill,
          as: "requiredSkills",
          include: [
            { model: Skill, attributes: ["id", "name"] },
            { model: SkillLevel, attributes: ["id", "level_name", "value"] }
          ]
        }
      ]
    });

    if (!jobDescription) {
      return res.status(404).json({ error: 'Poste non trouvé' });
    }

    // Récupérer tous les employés avec leurs compétences
    const employees = await Employee.findAll({
      include: [
        {
          model: EmployeeSkill,
          as: 'EmployeeSkills',
          include: [
            { model: Skill, as: 'Skill' },
            { model: SkillLevel, as: 'SkillLevel' }
          ]
        }
      ]
    });

    if (employees.length === 0) {
      return res.json({
        response: `❌ Aucun employé trouvé pour le poste "${jobDescription.emploi}".`,
        recommendation: null
      });
    }

    // Calculer les scores de matching
    const matchingResults = calculateEmployeeJobMatching(employees, jobDescription);
    
    if (matchingResults.length === 0) {
      return res.json({
        response: `❌ Aucun employé ne correspond au poste "${jobDescription.emploi}".`,
        recommendation: null
      });
    }

    // Prendre le meilleur candidat
    const bestMatch = matchingResults[0];
    const trainingSuggestions = generateTrainingSuggestions(bestMatch.skillGaps);

    const response = formatEmployeeRecommendationResponse(bestMatch, jobDescription, trainingSuggestions);

    res.json({
      response,
      recommendation: {
        employee: bestMatch.employee,
        score: bestMatch.score,
        skillGaps: bestMatch.skillGaps,
        trainingSuggestions
      },
      type: 'employee-recommendation'
    });

  } catch (error) {
    console.error('Error in findBestEmployeeForJob:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      response: 'Erreur lors de la recherche du meilleur employé.'
    });
  }
};

// Fonctions utilitaires pour détecter les types de questions
function isJobMatchingQuery(question) {
  const keywords = [
    'meilleur employé', 'employé adequat', 'candidat idéal', 'qui convient',
    'pour ce poste', 'pour le poste', 'matching', 'correspondance',
    'recommander', 'suggérer un employé', 'qui peut faire'
  ];
  return keywords.some(keyword => question.includes(keyword));
}

function isEmployeeInfoQuery(question) {
  const keywords = [
    'employé', 'collaborateur', 'profil', 'compétences de',
    'qui est', 'informations sur', 'détails sur'
  ];
  return keywords.some(keyword => question.includes(keyword));
}

function isTrainingQuery(question) {
  const keywords = [
    'formation', 'développer', 'améliorer', 'apprendre',
    'monter en compétence', 'lacune', 'gap', 'manque', 'former'
  ];
  return keywords.some(keyword => question.includes(keyword));
}

function isStatisticsQuery(question) {
  const keywords = [
    'statistiques', 'combien', 'nombre', 'total',
    'département', 'équipe', 'organisation', 'stats'
  ];
  return keywords.some(keyword => question.includes(keyword));
}

// Gestionnaires de questions spécifiques
async function handleJobMatchingQuery(question, context) {
  try {
    // Récupérer toutes les fiches de poste
    const jobDescriptions = await JobDescription.findAll({
      include: [
        {
          model: JobRequiredSkill,
          as: "requiredSkills",
          include: [
            { model: Skill, attributes: ["id", "name"] },
            { model: SkillLevel, attributes: ["id", "level_name", "value"] }
          ]
        }
      ]
    });

    if (jobDescriptions.length === 0) {
      return {
        response: "❌ Aucune fiche de poste disponible. Veuillez d'abord créer des fiches de poste.",
        type: 'error'
      };
    }

    // Essayer d'extraire le nom du poste de la question
    const extractedJob = extractJobFromQuestion(question, jobDescriptions);
    
    if (extractedJob) {
      // Calculer le matching pour ce poste spécifique
      const employees = await Employee.findAll({
        include: [
          {
            model: EmployeeSkill,
            as: 'EmployeeSkills',
            include: [
              { model: Skill, as: 'Skill' },
              { model: SkillLevel, as: 'SkillLevel' }
            ]
          }
        ]
      });

      const matchingResults = calculateEmployeeJobMatching(employees, extractedJob);
      
      if (matchingResults.length === 0) {
        return {
          response: `❌ Aucun employé ne correspond au poste "${extractedJob.emploi}".`,
          type: 'no-match'
        };
      }

      const bestMatch = matchingResults[0];
      const trainingSuggestions = generateTrainingSuggestions(bestMatch.skillGaps);
      
      return {
        response: formatEmployeeRecommendationResponse(bestMatch, extractedJob, trainingSuggestions),
        recommendation: {
          employee: bestMatch.employee,
          score: bestMatch.score,
          skillGaps: bestMatch.skillGaps,
          trainingSuggestions
        },
        type: 'employee-recommendation'
      };
    } else {
      // Proposer la liste des postes disponibles
      const jobsList = jobDescriptions.map(job => 
        `• ${job.emploi} (${job.filiere_activite})`
      ).join('\n');
      
      return {
        response: `🎯 Pour vous aider à trouver le meilleur employé, voici les postes disponibles :\n\n${jobsList}\n\nPouvez-vous préciser pour quel poste vous cherchez un candidat ?`,
        type: 'job-list',
        data: { jobDescriptions }
      };
    }
  } catch (error) {
    console.error('Error in handleJobMatchingQuery:', error);
    return {
      response: "❌ Erreur lors de l'analyse. Veuillez réessayer.",
      type: 'error'
    };
  }
}

async function handleEmployeeInfoQuery(question) {
  try {
    const employees = await Employee.findAll({
      include: [
        {
          model: EmployeeSkill,
          as: 'EmployeeSkills',
          include: [
            { model: Skill, as: 'Skill' },
            { model: SkillLevel, as: 'SkillLevel' }
          ]
        }
      ]
    });

    const employeeName = extractEmployeeNameFromQuestion(question, employees);
    
    if (employeeName) {
      const employee = employees.find(emp => 
        emp.name.toLowerCase().includes(employeeName.toLowerCase())
      );
      
      if (employee) {
        const response = formatEmployeeProfile(employee);
        return { response, type: 'employee-profile', data: { employee } };
      } else {
        return { 
          response: `❌ Aucun employé trouvé avec le nom "${employeeName}".`,
          type: 'error'
        };
      }
    } else {
      const employeesList = employees.slice(0, 10).map(emp => 
        `• ${emp.name} (${emp.position})`
      ).join('\n');
      
      return {
        response: `👥 Voici quelques employés :\n\n${employeesList}\n\nSur qui souhaitez-vous des informations ?`,
        type: 'employee-list'
      };
    }
  } catch (error) {
    console.error('Error in handleEmployeeInfoQuery:', error);
    return {
      response: "❌ Erreur lors du chargement des informations employés.",
      type: 'error'
    };
  }
}

async function handleTrainingQuery(question) {
  return {
    response: `🎓 **Suggestions de formation :**\n\nPour vous donner des recommandations précises, j'ai besoin de savoir :\n\n1. Pour quel employé ?\n2. Pour quel poste cible ?\n\nExemple : "Quelles formations pour Jean Dupont pour devenir Développeur Senior ?"`,
    type: 'training-help'
  };
}

async function handleStatisticsQuery(question) {
  try {
    const employees = await Employee.findAll();
    const jobDescriptions = await JobDescription.findAll();
    
    const totalEmployees = employees.length;
    const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];
    const positions = [...new Set(employees.map(emp => emp.position))];
    
    let response = `📊 **Aperçu de votre organisation :**\n\n`;
    response += `👥 Total employés : ${totalEmployees}\n`;
    response += `🏢 Départements : ${departments.length}\n`;
    response += `💼 Postes différents : ${positions.length}\n`;
    response += `📋 Fiches de poste : ${jobDescriptions.length}\n\n`;
    
    if (departments.length > 0) {
      response += `**Répartition par département :**\n`;
      departments.slice(0, 5).forEach(dept => {
        const count = employees.filter(emp => emp.department === dept).length;
        response += `• ${dept}: ${count} employé(s)\n`;
      });
    }

    return { response, type: 'statistics' };
  } catch (error) {
    console.error('Error in handleStatisticsQuery:', error);
    return {
      response: "❌ Erreur lors du chargement des statistiques.",
      type: 'error'
    };
  }
}

// Fonctions utilitaires
function extractJobFromQuestion(question, jobDescriptions) {
  const lowerQuestion = question.toLowerCase();
  
  for (const job of jobDescriptions) {
    if (lowerQuestion.includes(job.emploi.toLowerCase()) || 
        lowerQuestion.includes(job.filiere_activite.toLowerCase())) {
      return job;
    }
  }
  
  return null;
}

function extractEmployeeNameFromQuestion(question, employees) {
  const lowerQuestion = question.toLowerCase();
  
  for (const employee of employees) {
    const nameParts = employee.name.toLowerCase().split(' ');
    if (nameParts.some(part => lowerQuestion.includes(part) && part.length > 2)) {
      return employee.name;
    }
  }
  
  return null;
}

function calculateEmployeeJobMatching(employees, jobDescription) {
  const results = [];
  
  // Créer une map des compétences requises
  const requiredSkillsMap = new Map();
  if (jobDescription.requiredSkills) {
    jobDescription.requiredSkills.forEach(reqSkill => {
      requiredSkillsMap.set(reqSkill.skill_id, {
        required_level: reqSkill.SkillLevel?.value || 0,
        skill_name: reqSkill.Skill?.name || 'Compétence inconnue'
      });
    });
  }

  employees.forEach(employee => {
    let totalScore = 0;
    let maxScore = 0;
    const skillGaps = [];

    // Créer une map des compétences de l'employé
    const employeeSkillsMap = new Map();
    if (employee.EmployeeSkills) {
      employee.EmployeeSkills.forEach(empSkill => {
        employeeSkillsMap.set(empSkill.skill_id, {
          actual_level: empSkill.SkillLevel?.value || 0,
          skill_name: empSkill.Skill?.name || 'Compétence inconnue'
        });
      });
    }

    // Calculer le score pour chaque compétence requise
    for (const [skillId, requiredSkill] of requiredSkillsMap) {
      const requiredLevel = requiredSkill.required_level;
      maxScore += requiredLevel;

      if (employeeSkillsMap.has(skillId)) {
        const employeeSkill = employeeSkillsMap.get(skillId);
        const actualLevel = employeeSkill.actual_level;
        const skillScore = Math.min(actualLevel, requiredLevel);
        totalScore += skillScore;

        // Enregistrer l'écart si nécessaire
        if (actualLevel < requiredLevel) {
          skillGaps.push({
            skill_name: requiredSkill.skill_name,
            required_level: requiredLevel,
            actual_level: actualLevel,
            gap: actualLevel - requiredLevel
          });
        }
      } else {
        // Compétence manquante
        skillGaps.push({
          skill_name: requiredSkill.skill_name,
          required_level: requiredLevel,
          actual_level: 0,
          gap: -requiredLevel
        });
      }
    }

    const score = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    results.push({
      employee: {
        id: employee.id,
        name: employee.name,
        position: employee.position,
        email: employee.email
      },
      score: Math.round(score * 100) / 100,
      skillGaps: skillGaps.filter(gap => gap.gap < 0) // Seulement les lacunes
    });
  });

  // Trier par score décroissant
  return results.sort((a, b) => b.score - a.score);
}

function generateTrainingSuggestions(skillGaps) {
  return skillGaps.map(gap => {
    const gapSize = Math.abs(gap.gap);
    let priority = 'medium';
    let duration = '3-6 mois';

    if (gapSize >= 3) {
      priority = 'high';
      duration = '6-12 mois';
    } else if (gapSize >= 2) {
      priority = 'medium';
      duration = '3-6 mois';
    } else {
      priority = 'low';
      duration = '1-3 mois';
    }

    return {
      skill_name: gap.skill_name,
      current_level: gap.actual_level,
      target_level: gap.required_level,
      estimated_duration: duration,
      priority,
      description: `Formation pour passer du niveau ${gap.actual_level} au niveau ${gap.required_level}`
    };
  });
}

function formatEmployeeRecommendationResponse(bestMatch, jobDescription, trainingSuggestions) {
  let response = `🎯 **Meilleur candidat pour "${jobDescription.emploi}" :**\n\n`;
  response += `👤 **${bestMatch.employee.name}**\n`;
  response += `📧 ${bestMatch.employee.email}\n`;
  response += `💼 ${bestMatch.employee.position}\n`;
  response += `📊 **Score de compatibilité : ${bestMatch.score}%**\n\n`;

  if (bestMatch.score >= 80) {
    response += `✅ **Excellent candidat !** Prêt pour le poste.\n\n`;
  } else if (bestMatch.score >= 60) {
    response += `⚠️ **Bon candidat** avec quelques lacunes à combler.\n\n`;
  } else {
    response += `🔄 **Candidat potentiel** nécessitant une formation significative.\n\n`;
  }

  if (bestMatch.skillGaps.length > 0) {
    response += `📚 **Compétences à développer :**\n`;
    bestMatch.skillGaps.forEach(gap => {
      response += `• ${gap.skill_name}: niveau ${gap.actual_level}/${gap.required_level} (écart: ${Math.abs(gap.gap)})\n`;
    });
    response += '\n';
  }

  if (trainingSuggestions.length > 0) {
    response += `🎓 **Plan de formation recommandé :**\n`;
    trainingSuggestions.forEach(training => {
      const priorityEmoji = training.priority === 'high' ? '🔴' : training.priority === 'medium' ? '🟡' : '🟢';
      response += `${priorityEmoji} ${training.skill_name}: ${training.current_level} → ${training.target_level} (${training.estimated_duration})\n`;
    });
  }

  return response;
}

function formatEmployeeProfile(employee) {
  let response = `👤 **Profil de ${employee.name}**\n\n`;
  response += `💼 Poste : ${employee.position}\n`;
  response += `📧 Email : ${employee.email}\n`;
  response += `📅 Embauché le : ${new Date(employee.hire_date).toLocaleDateString('fr-FR')}\n`;
  
  if (employee.location) response += `📍 Localisation : ${employee.location}\n`;
  if (employee.department) response += `🏢 Département : ${employee.department}\n`;
  
  const skillsCount = employee.EmployeeSkills?.length || 0;
  response += `\n🎯 **Compétences : ${skillsCount}**\n`;
  
  if (skillsCount > 0) {
    const topSkills = employee.EmployeeSkills.slice(0, 5);
    topSkills.forEach(skill => {
      const skillName = skill.Skill?.name || 'Compétence inconnue';
      const levelName = skill.SkillLevel?.level_name || 'Niveau inconnu';
      response += `• ${skillName} (${levelName})\n`;
    });
    
    if (skillsCount > 5) {
      response += `... et ${skillsCount - 5} autres compétences\n`;
    }
  }

  return response;
}

module.exports = {
  processQuestion,
  findBestEmployeeForJob
};