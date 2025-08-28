import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { JobDescriptionService } from '../../services/job-description.service';
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
    private jobDescriptionService: JobDescriptionService
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
      },
      error: (err) => {
        console.error('Error loading job descriptions:', err);
        this.errorMessage = 'Erreur lors du chargement des fiches de poste.';
      }
    });
  }

  loadJobDescriptionAndPrefill(jobDescriptionId: number): void {
    this.jobDescriptionService.getJobDescriptionById(jobDescriptionId).subscribe({
      next: (jobDescription) => {
        this.selectedJobDescription = jobDescription;
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
        const requirement = `${skill.skill?.name} - Niveau ${skill.skill_level?.level_name || 'requis'}`;
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
        created_by: 1 // TODO: Récupérer l'ID de l'utilisateur connecté
      };

      // TODO: Implémenter l'appel API pour créer l'offre d'emploi
      console.log('Job Offer Data:', jobOfferData);
      
      // Simulation d'un appel API
      setTimeout(() => {
        this.successMessage = 'Offre d\'emploi créée avec succès !';
        this.saving = false;
        
        // Rediriger vers la liste des offres après 2 secondes
        setTimeout(() => {
          this.router.navigate(['/job-offers']);
        }, 2000);
      }, 1000);
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
    this.onSubmit();
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
}