import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EmployeeService } from '../../services/employee.service';
import { SkillService } from '../../services/skill.service';
import { JobDescriptionService } from '../../services/job-description.service';
import { MatchingService } from '../../services/matching.service';
import { Employee, Skill, SkillLevel } from '../../models/employee.model';
import { JobDescription } from '../../models/job-description.model';
import { MatchingResult } from '../../models/matching.model';
import { EmployeeSkillService } from '../../services/employee-skill.service';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './employees.component.html',
  styleUrls: ['./employees.component.css']
})
export class EmployeesComponent implements OnInit {
  employees: Employee[] = [];
  employeeForm: FormGroup;
  jobDescriptions: JobDescription[] = [];
  skills: Skill[] = [];
  skillLevels: SkillLevel[] = [];
  showAddForm: boolean = false;
  editingEmployee: Employee | null = null;
  loading: boolean = false;
  loadingJobs: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  // Nouvelles propriétés pour l'affectation automatique
  showAutoAssignModal: boolean = false;
  autoAssigningEmployee: Employee | null = null;
  bestJobMatches: MatchingResult[] = [];
  loadingBestMatches: boolean = false;
  autoAssignMessage: string | null = null;

  constructor(
    private employeeService: EmployeeService,
    private skillService: SkillService,
    private jobDescriptionService: JobDescriptionService,
    private matchingService: MatchingService,
    private employeeSkillService: EmployeeSkillService,
    private formBuilder: FormBuilder
  ) {
    this.employeeForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      position: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      hire_date: ['', Validators.required],
      phone: [''],
      gender: [''],
      location: [''],
      notes: [''],
      skills: this.formBuilder.array([]) // FormArray pour les compétences
    });
  }

  ngOnInit(): void {
    this.loadEmployees();
    this.loadSkillsData();
    this.loadJobDescriptions();
  }

  loadEmployees(): void {
    this.loading = true;
    this.errorMessage = null;
    this.employeeService.getEmployees().subscribe({
      next: (employees) => {
        this.employees = employees;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading employees:', err);
        this.errorMessage = 'Erreur lors du chargement des employés. Veuillez réessayer plus tard.';
        this.loading = false;
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
    }).catch(err => {
      console.error('Error loading skills data:', err);
    });
  }

  loadJobDescriptions(): void {
    this.loadingJobs = true;
    this.jobDescriptionService.getJobDescriptions().subscribe({
      next: (jobDescriptions) => {
        this.jobDescriptions = jobDescriptions;
        this.loadingJobs = false;
      },
      error: (err) => {
        console.error('Error loading job descriptions:', err);
        this.loadingJobs = false;
      }
    });
  }

  get skillsFormArray(): FormArray {
    return this.employeeForm.get('skills') as FormArray;
  }

  addSkill(): void {
    const skillGroup = this.formBuilder.group({
      skill_id: ['', Validators.required],
      actual_skill_level_id: ['', Validators.required],
      acquired_date: [''],
      certification: [''],
      last_evaluated_date: ['']
    });
    this.skillsFormArray.push(skillGroup);
  }

  removeSkill(index: number): void {
    this.skillsFormArray.removeAt(index);
  }

  onSubmit(): void {
    if (this.employeeForm.valid) {
      const formValue = this.employeeForm.value;
      
      const employeeData = {
        name: formValue.name,
        position: formValue.position,
        email: formValue.email,
        hire_date: formValue.hire_date,
        phone: formValue.phone || '',
        gender: formValue.gender || '',
        location: formValue.location || '',
        notes: formValue.notes || '',
        skills: formValue.skills || []
      } as Employee;
      
      console.log('Données employé à envoyer:', employeeData);
      
      if (this.editingEmployee) {
        this.employeeService.updateEmployee(this.editingEmployee.id!, employeeData).subscribe({
          next: (updatedEmployee) => {
            const index = this.employees.findIndex(emp => emp.id === updatedEmployee.id);
            if (index !== -1) {
              this.employees[index] = updatedEmployee;
            }
            this.successMessage = 'Employé mis à jour avec succès';
            this.cancelEdit();
            this.errorMessage = null;
            console.log('✅ Employé mis à jour avec succès');
          },
          error: (err) => {
            console.error('Error updating employee:', err);
            this.errorMessage = `❌ Erreur mise à jour: ${err.error?.message || err.message}`;
          }
        });
      } else {
        this.employeeService.createEmployee(employeeData).subscribe({
          next: (newEmployee) => {
            this.employees.push(newEmployee);
            this.successMessage = 'Employé créé avec succès';
            this.cancelEdit();
            this.errorMessage = null;
            console.log('✅ Employé créé avec succès');
          },
          error: (err) => {
            console.error('Error creating employee:', err);
            this.errorMessage = `❌ Erreur création: ${err.error?.message || err.message}`;
          }
        });
      }
    } else {
      console.log('❌ Formulaire invalide:', this.employeeForm.errors);
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
    }
  }

  editEmployee(employee: Employee): void {
    this.editingEmployee = employee;
    this.showAddForm = true;
    
    // Remplir les champs de base
    this.employeeForm.patchValue({
      name: employee.name,
      position: employee.position,
      email: employee.email,
      hire_date: employee.hire_date,
      phone: employee.phone || '',
      gender: employee.gender || '',
      location: employee.location || '',
      notes: employee.notes || '',
    });

    // Vider le FormArray des compétences
    while (this.skillsFormArray.length !== 0) {
      this.skillsFormArray.removeAt(0);
    }

    // Remplir les compétences existantes
    if (employee.skills && employee.skills.length > 0) {
      employee.skills.forEach(empSkill => {
        const skillGroup = this.formBuilder.group({
          skill_id: [empSkill.skill_id, Validators.required],
          actual_skill_level_id: [empSkill.actual_skill_level_id, Validators.required],
          acquired_date: [empSkill.acquired_date || ''],
          certification: [empSkill.certification || ''],
          last_evaluated_date: [empSkill.last_evaluated_date || '']
        });
        this.skillsFormArray.push(skillGroup);
      });
    }
  }

  deleteEmployee(employee: Employee): void {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${employee.name} ?`)) {
      this.employeeService.deleteEmployee(employee.id!).subscribe({
        next: () => {
          this.employees = this.employees.filter(emp => emp.id !== employee.id);
          this.successMessage = 'Employé supprimé avec succès';
          this.errorMessage = null;
        },
        error: (err) => {
          console.error('Error deleting employee:', err);
          this.errorMessage = 'Erreur lors de la suppression de l\'employé.';
        }
      });
    }
  }

  cancelEdit(): void {
    this.editingEmployee = null;
    this.showAddForm = false;
    this.employeeForm.reset();
    
    // Vider le FormArray des compétences
    while (this.skillsFormArray.length !== 0) {
      this.skillsFormArray.removeAt(0);
    }
    
    this.errorMessage = null;
    this.successMessage = null;
  }

  private parseIntegerField(value: any): number | null {
    if (!value || value === '' || value === 'null' || value === 'undefined') {
      return null;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  getSkillName(skillId: number): string {
    const skill = this.skills.find(s => s.id === skillId);
    return skill ? skill.name : 'Compétence inconnue';
  }

  getSkillLevelName(levelId: number): string {
    const level = this.skillLevels.find(l => l.id === levelId);
    return level ? level.level_name : 'Niveau inconnu';
  }

  // Nouvelle méthode pour trouver le meilleur poste pour un employé
  findBestJobForEmployee(employee: Employee): void {
    this.autoAssigningEmployee = employee;
    this.showAutoAssignModal = true;
    this.loadingBestMatches = true;
    this.autoAssignMessage = null;
    this.bestJobMatches = [];

    // Utiliser la méthode alternative car le backend n'a probablement pas l'endpoint spécifique
    this.matchingService.findBestJobForEmployeeAlternative(employee.id!, this.jobDescriptions)
      .subscribe({
        next: (matches) => {
          this.bestJobMatches = matches.slice(0, 5); // Top 5 des meilleurs matches
          this.loadingBestMatches = false;
          
          if (this.bestJobMatches.length === 0) {
            this.autoAssignMessage = 'Aucun poste compatible trouvé pour cet employé.';
          }
        },
        error: (err) => {
          console.error('Error finding best job matches:', err);
          this.autoAssignMessage = 'Erreur lors de la recherche des postes compatibles.';
          this.loadingBestMatches = false;
        }
      });
  }

  // Affecter l'employé au poste sélectionné
  assignToBestJob(jobId: number, score: number): void {
    if (!this.autoAssigningEmployee) return;

    const confirmMessage = `Voulez-vous affecter ${this.autoAssigningEmployee.name} à ce poste ?\n\nScore de compatibilité : ${score.toFixed(1)}%`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    this.employeeService.assignEmployeeToJobDescription(this.autoAssigningEmployee.id!, jobId)
      .subscribe({
        next: () => {
          // Mettre à jour l'employé localement
          const index = this.employees.findIndex(emp => emp.id === this.autoAssigningEmployee!.id);
          if (index !== -1) {
            // Mettre à jour l'employé avec la nouvelle affectation
            this.loadEmployees();
          }
          
          this.autoAssignMessage = `✅ ${this.autoAssigningEmployee!.name} a été affecté(e) avec succès !`;
          this.bestJobMatches = [];
          
          // Fermer le modal après 2 secondes
          setTimeout(() => {
            this.closeAutoAssignModal();
          }, 2000);
        },
        error: (err) => {
          console.error('Error assigning employee:', err);
          this.autoAssignMessage = `❌ Erreur lors de l'affectation : ${err.error?.message || err.message}`;
        }
      });
  }

  // Fermer le modal d'affectation automatique
  closeAutoAssignModal(): void {
    this.showAutoAssignModal = false;
    this.autoAssigningEmployee = null;
    this.bestJobMatches = [];
    this.autoAssignMessage = null;
    this.loadingBestMatches = false;
  }

  // Obtenir le nom du poste à partir de l'ID
  getJobNameFromId(jobId: number): string {
    const job = this.jobDescriptions.find(j => j.id === jobId);
    return job ? job.emploi : 'Poste inconnu';
  }

  // Obtenir la filière du poste à partir de l'ID
  getJobFiliereFromId(jobId: number): string {
    const job = this.jobDescriptions.find(j => j.id === jobId);
    return job ? job.filiere_activite : 'Filière inconnue';
  }

  // Supprimer une compétence d'un employé
  removeEmployeeSkill(employee: Employee, skillIndex: number): void {
    if (!employee.skills || skillIndex < 0 || skillIndex >= employee.skills.length) return;

    const skill = employee.skills[skillIndex];
    if (window.confirm(`Supprimer la compétence "${this.getSkillName(skill.skill_id)}" ?`)) {
      this.employeeSkillService.delete(employee.id!, skill.skill_id).subscribe({
        next: () => {
          // Mettre à jour localement
          employee.skills!.splice(skillIndex, 1);
          this.successMessage = 'Compétence supprimée avec succès';
        },
        error: (err) => {
          console.error('Error deleting skill:', err);
          this.errorMessage = 'Erreur lors de la suppression de la compétence.';
        }
      });
    }
  }

  // Ajouter une compétence à un employé existant
  addSkillToEmployee(employee: Employee): void {
    // Créer un formulaire temporaire pour ajouter une compétence
    const skillData = {
      employee_id: employee.id!,
      skill_id: 0, // À définir via un modal
      actual_skill_level_id: 0,
      acquired_date: new Date().toISOString().split('T')[0],
      certification: '',
      last_evaluated_date: new Date().toISOString().split('T')[0]
    };

    // TODO: Ouvrir un modal pour sélectionner la compétence et le niveau
    console.log('Ajouter compétence à:', employee.name);
  }

  // Obtenir le niveau de compétence avec style
  getSkillLevelClass(levelValue: number): string {
    if (levelValue <= 1) return 'bg-red-100 text-red-800';
    if (levelValue <= 2) return 'bg-yellow-100 text-yellow-800';
    if (levelValue <= 3) return 'bg-blue-100 text-blue-800';
    if (levelValue <= 4) return 'bg-green-100 text-green-800';
    return 'bg-purple-100 text-purple-800';
  }

  // Obtenir la valeur du niveau de compétence
  getSkillLevelValue(levelId: number): number {
    const level = this.skillLevels.find(l => l.id === levelId);
    return level ? level.value : 0;
  }
}