import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { JobDescriptionService } from '../../services/job-description.service';
import { JobOfferService } from '../../services/job-offer.service';
import { SkillService } from '../../services/skill.service';
import { AuthService } from '../../services/auth.service';
import { JobDescription } from '../../models/job-description.model';

export interface JobOffer {
  id?: number;
  title: string;
  company: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  contract_type: string;
  work_mode: string;
  application_deadline: string;
  description: string;
  requirements: string[];
  benefits: string[];
  job_description_id: number;
  status: 'draft' | 'published' | 'closed';
  created_by: number;
  published_at?: string;
  views_count?: number;
  applications_count?: number;
}

@Component({
  selector: 'app-job-offer',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './job-offer.component.html',
  styleUrls: ['./job-offer.component.css']
})
export class JobOfferComponent implements OnInit {
  jobOfferForm: FormGroup;
  selectedJobDescription: JobDescription | null = null;
  jobDescriptions: JobDescription[] = [];
  skills: any[] = [];
  skillLevels: any[] = [];
  loading: boolean = false;
  saving: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  previewMode: boolean = false;

  contractTypes = [
    { value: 'CDI', label: 'CDI - Contrat à Durée Indéterminée' },
    { value: 'CDD', label: 'CDD - Contrat à Durée Déterminée' },
    { value: 'Stage', label: 'Stage' },
    { value: 'Freelance', label: 'Freelance/Consultant' },
    { value: 'Apprentissage', label: 'Contrat d\'Apprentissage' }
  ];

  workModes = [
    { value: 'Présentiel', label: 'Présentiel' },
    { value: 'Télétravail', label: 'Télétravail complet' },
    { value: 'Hybride', label: 'Hybride (Présentiel + Télétravail)' },
    { value: 'Flexible', label: 'Flexible selon les besoins' }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private jobDescriptionService: JobDescriptionService,
    private jobOfferService: JobOfferService,
    private skillService: SkillService,
    private authService: AuthService
  ) {
    this.jobOfferForm = this.formBuilder.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      company: ['Abshore', Validators.required],
      location: ['', Validators.required],
      salary_min: [''],
      salary_max: [''],
      contract_type: ['CDI', Validators.required],
      work_mode: ['Hybride', Validators.required],
      application_deadline: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(50)]],
      requirements: this.formBuilder.array([]),
      benefits: this.formBuilder.array([]),
      job_description_id: ['', Validators.required],
      status: ['draft']
    });
  }

  ngOnInit(): void {
    this.loadJobDescriptions();
    this.loadSkillsData();
    this.setDefaultDeadline();
    
    // Si un ID de fiche de poste est passé en paramètre
    const jobDescriptionId = this.route.snapshot.queryParams['jobDescriptionId'];
    if (jobDescriptionId) {
      this.loadJobDescriptionAndPrefill(parseInt(jobDescriptionId));
    }
  }

  get requirementsArray(): FormArray {
    return this.jobOfferForm.get('requirements') as FormArray;
  }

  get benefitsArray(): FormArray {
    return this.jobOfferForm.get('benefits') as FormArray;
  }

  loadJobDescriptions(): void {
    this.jobDescriptionService.getJobDescriptions().subscribe({
      next: (jobDescriptions) => {
        this.jobDescriptions = jobDescriptions;
        console.log('Job descriptions loaded:', jobDescriptions);
      },
      error: (err) => {
        console.error('Error loading job descriptions:', err);
        this.errorMessage = 'Erreur lors du chargement des fiches de poste.';
      }
    });
  }

  loadSkillsData(): void {
    Promise.all([
      this.skillService.getSkills().toPromise(),
      this.skillService.getSkillLevels().toPromise()
    ]).then(([skills, skillLevels]) => {
      this.skills = skills || [];
      this.skillLevels = skillLevels || [];
      console.log('Skills data loaded:', { skills: this.skills.length, levels: this.skillLevels.length });
    }).catch(err => {
      console.error('Error loading skills data:', err);
    });
  }
  loadJobDescriptionAndPrefill(jobDescriptionId: number): void {
    this.jobDescriptionService.getJobDescriptionById(jobDescriptionId).subscribe({
      next: (jobDescription) => {
        this.selectedJobDescription = jobDescription;
        console.log('Job description loaded for prefill:', jobDescription);
        this.prefillFormFromJobDescription(jobDescription);
      },
      error: (err) => {
        console.error('Error loading job description:', err);
        this.errorMessage = 'Erreur lors du chargement de la fiche de poste.';
      }
    });
  }

  onJobDescriptionChange(): void {
    const jobDescriptionId = this.jobOfferForm.get('job_description_id')?.value;
    if (jobDescriptionId) {
      this.loadJobDescriptionAndPrefill(parseInt(jobDescriptionId));
    }
  }

  prefillFormFromJobDescription(jobDescription: JobDescription): void {
    // Pré-remplir le titre
    const title = `${jobDescription.emploi} - ${jobDescription.filiere_activite}`;
    
    // Générer la description automatiquement
    let description = `Nous recherchons un(e) ${jobDescription.emploi} pour rejoindre notre équipe ${jobDescription.filiere_activite}.\n\n`;
    
    if (jobDescription.finalite) {
      description += `**Finalité du poste :**\n${jobDescription.finalite}\n\n`;
    }

    if (jobDescription.missions && jobDescription.missions.length > 0) {
      description += `**Missions principales :**\n`;
      jobDescription.missions.forEach(mission => {
        description += `• ${mission.mission}\n`;
      });
      description += '\n';
    }

    // Ajouter les compétences requises à la description
    if (jobDescription.requiredSkills && jobDescription.requiredSkills.length > 0) {
      description += `**Compétences techniques requises :**\n`;
      jobDescription.requiredSkills.forEach(skill => {
        // Gestion robuste des structures de données
        let skillName = 'Compétence non définie';
        let levelName = 'Niveau non défini';
        
        // Essayer différentes structures pour le nom de la compétence
        if (skill.Skill?.name) {
          skillName = skill.Skill.name;
        } else if (skill.skill?.name) {
          skillName = skill.skill.name;
        } else if (skill.skill_id) {
          // Fallback: chercher dans la liste des compétences
          const foundSkill = this.skills.find(s => s.id === skill.skill_id);
          if (foundSkill) skillName = foundSkill.name;
        }
        
        // Essayer différentes structures pour le niveau
        if (skill.SkillLevel?.level_name) {
          levelName = skill.SkillLevel.level_name;
        } else if (skill.skill_level?.level_name) {
          levelName = skill.skill_level.level_name;
        } else if (skill.required_skill_level_id) {
          // Fallback: chercher dans la liste des niveaux
          const foundLevel = this.skillLevels.find(l => l.id === skill.required_skill_level_id);
          if (foundLevel) levelName = foundLevel.level_name;
        }
        
        description += `• ${skillName} - Niveau ${levelName}\n`;
      });
      description += '\n';
    }

    // Ajouter les moyens disponibles
    if (jobDescription.moyens && jobDescription.moyens.length > 0) {
      description += `**Moyens et outils à disposition :**\n`;
      jobDescription.moyens.forEach(moyen => {
        description += `• ${moyen.moyen}\n`;
      });
      description += '\n';
    }
    
    // Pré-remplir le formulaire
    this.jobOfferForm.patchValue({
      title: title,
      description: description,
      job_description_id: jobDescription.id
    });

    // Ajouter les exigences basées sur les compétences requises
    this.clearFormArray(this.requirementsArray);
    if (jobDescription.requiredSkills && jobDescription.requiredSkills.length > 0) {
      jobDescription.requiredSkills.forEach(skill => {
        // Gestion robuste des structures de données
        let skillName = 'Compétence non définie';
        let levelName = 'Niveau requis';
        
        // Essayer différentes structures pour le nom de la compétence
        if (skill.Skill?.name) {
          skillName = skill.Skill.name;
        } else if (skill.skill?.name) {
          skillName = skill.skill.name;
        } else if (skill.skill_id) {
          const foundSkill = this.skills.find(s => s.id === skill.skill_id);
          if (foundSkill) skillName = foundSkill.name;
        }
        
        // Essayer différentes structures pour le niveau
        if (skill.SkillLevel?.level_name) {
          levelName = skill.SkillLevel.level_name;
        } else if (skill.skill_level?.level_name) {
          levelName = skill.skill_level.level_name;
        } else if (skill.required_skill_level_id) {
          const foundLevel = this.skillLevels.find(l => l.id === skill.required_skill_level_id);
          if (foundLevel) levelName = foundLevel.level_name;
        }
        
        const requirement = `${skillName} - Niveau ${levelName}`;
        this.addRequirement(requirement);
      });
    }

    // Ajouter le niveau d'expérience si disponible
    if (jobDescription.niveau_exp) {
      this.addRequirement(`Expérience : ${jobDescription.niveau_exp}`);
    }

    // Ajouter des avantages par défaut
    this.clearFormArray(this.benefitsArray);
    this.addBenefit('Télétravail partiel possible');
    this.addBenefit('Formation continue');
    this.addBenefit('Mutuelle d\'entreprise');
    this.addBenefit('Tickets restaurant');
  }

  setDefaultDeadline(): void {
    // Définir la date limite à 30 jours à partir d'aujourd'hui
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    this.jobOfferForm.patchValue({
      application_deadline: deadline.toISOString().split('T')[0]
    });
  }

  addRequirement(text: string = ''): void {
    const requirementControl = this.formBuilder.control(text, Validators.required);
    this.requirementsArray.push(requirementControl);
  }

  removeRequirement(index: number): void {
    this.requirementsArray.removeAt(index);
  }

  addBenefit(text: string = ''): void {
    const benefitControl = this.formBuilder.control(text, Validators.required);
    this.benefitsArray.push(benefitControl);
  }

  removeBenefit(index: number): void {
    this.benefitsArray.removeAt(index);
  }

  clearFormArray(formArray: FormArray): void {
    while (formArray.length !== 0) {
      formArray.removeAt(0);
    }
  }

  togglePreview(): void {
    this.previewMode = !this.previewMode;
  }

  onSubmit(): void {
    if (this.jobOfferForm.valid) {
      this.saving = true;
      this.errorMessage = null;

      const jobOfferData: JobOffer = {
        ...this.jobOfferForm.value,
        requirements: this.requirementsArray.value,
        benefits: this.benefitsArray.value,
        created_by: this.getCurrentUserId(),
        job_description_id: parseInt(this.jobOfferForm.value.job_description_id, 10)
      };

      console.log('Job Offer Data:', jobOfferData);
      
      // Créer l'offre d'emploi
      this.jobOfferService.createJobOffer(jobOfferData).subscribe({
        next: (createdOffer) => {
          console.log('Job offer created successfully:', createdOffer);
          this.successMessage = 'Offre d\'emploi créée avec succès !';
          this.saving = false;
          
          // Rediriger vers la liste des offres après 2 secondes
          setTimeout(() => {
            this.router.navigate(['/job-offers']);
          }, 2000);
        },
        error: (err) => {
          console.error('Error creating job offer:', err);
          this.errorMessage = `Erreur lors de la création: ${err.error?.message || err.message}`;
          this.saving = false;
        }
      });
    } else {
      this.markFormGroupTouched();
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
    }
  }

  saveDraft(): void {
    this.jobOfferForm.patchValue({ status: 'draft' });
    this.onSubmit();
  }

  publishOffer(): void {
    this.jobOfferForm.patchValue({ status: 'published' });
    
    if (this.jobOfferForm.valid) {
      this.saving = true;
      this.errorMessage = null;

      const jobOfferData: JobOffer = {
        ...this.jobOfferForm.value,
        requirements: this.requirementsArray.value,
        benefits: this.benefitsArray.value,
        created_by: this.getCurrentUserId(),
        job_description_id: parseInt(this.jobOfferForm.value.job_description_id, 10),
        status: 'published'
      };

      this.jobOfferService.publishJobOfferToPublic(jobOfferData).subscribe({
        next: (publishedOffer) => {
          console.log('Job offer published successfully:', publishedOffer);
          this.successMessage = 'Offre d\'emploi publiée avec succès !';
          this.saving = false;
          
          setTimeout(() => {
            this.router.navigate(['/job-offers']);
          }, 2000);
        },
        error: (err) => {
          console.error('Error publishing job offer:', err);
          this.errorMessage = `Erreur lors de la publication: ${err.error?.message || err.message}`;
          this.saving = false;
        }
      });
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.jobOfferForm.controls).forEach(key => {
      const control = this.jobOfferForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string | null {
    const field = this.jobOfferForm.get(fieldName);
    
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `Ce champ est requis`;
      }
      if (field.errors['minlength']) {
        return `Minimum ${field.errors['minlength'].requiredLength} caractères`;
      }
      if (field.errors['email']) {
        return 'Format d\'email invalide';
      }
    }
    
    return null;
  }

  // Suggestions intelligentes basées sur la fiche de poste
  getSalaryRange(): { min: number; max: number } {
    if (!this.selectedJobDescription) return { min: 30000, max: 50000 };
    
    // Logique de suggestion basée sur le niveau d'exigence
    const baseRanges: { [key: string]: { min: number; max: number } } = {
      'Junior': { min: 28000, max: 38000 },
      'Confirmé': { min: 38000, max: 55000 },
      'Senior': { min: 55000, max: 75000 },
      'Expert': { min: 75000, max: 100000 }
    };

    const level = this.selectedJobDescription.niveau_exp || 'Confirmé';
    return baseRanges[level] || { min: 35000, max: 50000 };
  }

  applySuggestedSalary(): void {
    const range = this.getSalaryRange();
    this.jobOfferForm.patchValue({
      salary_min: range.min,
      salary_max: range.max
    });
  }

  getLocationSuggestions(): string[] {
    return [
      'Paris, France',
      'Lyon, France', 
      'Marseille, France',
      'Toulouse, France',
      'Nantes, France',
      'Télétravail complet',
      'France (Télétravail possible)'
    ];
  }

  applyLocationSuggestion(location: string): void {
    this.jobOfferForm.patchValue({ location });
  }

  // Méthodes utilitaires pour gérer les compétences
  getSkillNameSafe(skill: any): string {
    if (!skill) return 'Compétence non définie';
    
    // Essayer différentes structures
    if (skill.Skill?.name) return skill.Skill.name;
    if (skill.skill?.name) return skill.skill.name;
    if (skill.name) return skill.name;
    
    // Fallback avec l'ID
    if (skill.skill_id) {
      const foundSkill = this.skills.find(s => s.id === skill.skill_id);
      if (foundSkill) return foundSkill.name;
    }
    
    return 'Compétence non définie';
  }

  getSkillLevelNameSafe(skill: any): string {
    if (!skill) return 'Niveau non défini';
    
    // Essayer différentes structures
    if (skill.SkillLevel?.level_name) return skill.SkillLevel.level_name;
    if (skill.skill_level?.level_name) return skill.skill_level.level_name;
    if (skill.level_name) return skill.level_name;
    
    // Fallback avec l'ID
    if (skill.required_skill_level_id) {
      const foundLevel = this.skillLevels.find(l => l.id === skill.required_skill_level_id);
      if (foundLevel) return foundLevel.level_name;
    }
    
    return 'Niveau non défini';
  }

  getCurrentUserId(): number {
    return this.authService.currentUser?.id || 1;
  }
}