import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { EmployeeService } from '../../services/employee.service';
import { SkillService } from '../../services/skill.service';
import { EmployeeSkillService } from '../../services/employee-skill.service';
import { Employee, Skill, SkillType, SkillLevel } from '../../models/employee.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  employee: Employee | null = null;
  profileForm: FormGroup;
  skills: Skill[] = [];
  skillTypes: SkillType[] = [];
  skillLevels: SkillLevel[] = [];
  loading: boolean = true;
  saving: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  isEditing: boolean = false;
  
  // Gestion des compétences individuelles
  showSkillForm: boolean = false;
  skillForm: FormGroup;
  editingSkill: any = null;
  skillErrorMessage: string | null = null;
  skillSuccessMessage: string | null = null;
  savingSkill: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private employeeService: EmployeeService,
    private skillService: SkillService,
    private employeeSkillService: EmployeeSkillService,
    private formBuilder: FormBuilder
  ) {
    this.profileForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      position: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      hire_date: ['', Validators.required],
      phone: [''],
      gender: [''],
      location: [''],
      notes: [''],
      skills: this.formBuilder.array([])
    });

    this.skillForm = this.formBuilder.group({
      skill_id: ['', Validators.required],
      actual_skill_level_id: ['', Validators.required],
      acquired_date: [''],
      certification: [''],
      last_evaluated_date: ['']
    });
  }

  ngOnInit(): void {
    const employeeId = this.route.snapshot.paramMap.get('id');
    if (employeeId) {
      this.loadEmployee(parseInt(employeeId));
      this.loadSkillsData();
    }
  }

  get skillsFormArray(): FormArray {
    return this.profileForm.get('skills') as FormArray;
  }

  loadEmployee(id: number): void {
    this.loading = true;
    this.errorMessage = null;
    
    this.employeeService.getEmployeeById(id).subscribe({
      next: (employee) => {
        console.log('Employee loaded:', employee);
        this.employee = employee;
        this.populateForm();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading employee:', err);
        this.errorMessage = 'Erreur lors du chargement du profil employé.';
        this.loading = false;
      }
    });
  }

  loadSkillsData(): void {
    Promise.all([
      this.skillService.getSkills().toPromise(),
      this.skillService.getSkillTypes().toPromise(),
      this.skillService.getSkillLevels().toPromise()
    ]).then(([skills, skillTypes, skillLevels]) => {
      this.skills = skills || [];
      this.skillTypes = skillTypes || [];
      this.skillLevels = skillLevels || [];
      console.log('Skills data loaded:', { skills: this.skills.length, types: this.skillTypes.length, levels: this.skillLevels.length });
    }).catch(err => {
      console.error('Error loading skills data:', err);
    });
  }

  populateForm(): void {
    if (!this.employee) return;

    this.profileForm.patchValue({
      name: this.employee.name,
      position: this.employee.position,
      email: this.employee.email,
      hire_date: this.employee.hire_date,
      phone: this.employee.phone || '',
      gender: this.employee.gender || '',
      location: this.employee.location || '',
      notes: this.employee.notes || ''
    });

    // Populate skills
    const skillsArray = this.profileForm.get('skills') as FormArray;
    skillsArray.clear();
    
    if (this.hasSkillsSafe()) {
      this.getSkillsSafe().forEach(empSkill => {
        const skillGroup = this.formBuilder.group({
          skill_id: [empSkill.skill_id, Validators.required],
          actual_skill_level_id: [empSkill.actual_skill_level_id, Validators.required],
          acquired_date: [empSkill.acquired_date || ''],
          certification: [empSkill.certification || ''],
          last_evaluated_date: [empSkill.last_evaluated_date || '']
        });
        skillsArray.push(skillGroup);
      });
    }
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

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      this.populateForm(); // Reset form if canceling edit
    }
  }

  onSubmit(): void {
    if (this.profileForm.valid && this.employee) {
      this.saving = true;
      this.errorMessage = null;
      this.successMessage = null;

      const formData = this.profileForm.value;
      
      this.employeeService.updateEmployee(this.employee.id!, formData).subscribe({
        next: (updatedEmployee) => {
          this.employee = updatedEmployee;
          this.isEditing = false;
          this.successMessage = 'Profil mis à jour avec succès.';
          this.saving = false;
          this.populateForm();
        },
        error: (err) => {
          console.error('Error updating employee:', err);
          this.errorMessage = 'Erreur lors de la mise à jour du profil.';
          this.saving = false;
        }
      });
    }
  }

  getSkillName(skillId: number): string {
    const skill = this.skills.find(s => s.id === skillId);
    return skill ? skill.name : 'Compétence inconnue';
  }

  getSkillLevelName(levelId: number): string {
    const level = this.skillLevels.find(l => l.id === levelId);
    return level ? level.level_name : 'Niveau inconnu';
  }

  goBack(): void {
    this.router.navigate(['/employees']);
  }

  // ==================== GESTION COMPÉTENCES INDIVIDUELLES ====================

  showAddSkillForm(): void {
    this.showSkillForm = true;
    this.editingSkill = null;
    this.skillForm.reset();
    this.clearSkillMessages();
  }

  editSkill(skill: any): void {
    this.editingSkill = skill;
    this.showSkillForm = true;
    this.skillForm.patchValue({
      skill_id: skill.skill_id,
      actual_skill_level_id: skill.actual_skill_level_id,
      acquired_date: skill.acquired_date || '',
      certification: skill.certification || '',
      last_evaluated_date: skill.last_evaluated_date || ''
    });
    this.clearSkillMessages();
  }

  onSkillSubmit(): void {
    if (this.skillForm.valid && this.employee) {
      this.savingSkill = true;
      const skillData = {
        employee_id: this.employee.id!,
        skill_id: parseInt(this.skillForm.value.skill_id, 10),
        actual_skill_level_id: parseInt(this.skillForm.value.actual_skill_level_id, 10),
        acquired_date: this.skillForm.value.acquired_date || null,
        certification: this.skillForm.value.certification || null,
        last_evaluated_date: this.skillForm.value.last_evaluated_date || null
      };

      if (this.editingSkill) {
        // Mise à jour
        this.employeeSkillService.update(
          this.editingSkill.employee_id,
          this.editingSkill.skill_id,
          skillData
        ).subscribe({
          next: () => {
            this.skillSuccessMessage = 'Compétence mise à jour avec succès';
            this.loadEmployee(this.employee!.id!);
            this.cancelSkillEdit();
            this.savingSkill = false;
          },
          error: (err) => {
            console.error('Error updating skill:', err);
            this.skillErrorMessage = `Erreur mise à jour: ${err.error?.message || err.message}`;
            this.savingSkill = false;
          }
        });
      } else {
        // Création
        this.employeeSkillService.create(skillData).subscribe({
          next: () => {
            this.skillSuccessMessage = 'Compétence ajoutée avec succès';
            this.loadEmployee(this.employee!.id!);
            this.cancelSkillEdit();
            this.savingSkill = false;
          },
          error: (err) => {
            console.error('Error creating skill:', err);
            this.skillErrorMessage = `Erreur création: ${err.error?.message || err.message}`;
            this.savingSkill = false;
          }
        });
      }
    }
  }

  deleteSkill(skill: any): void {
    const skillName = this.getSkillName(skill.skill_id);
    if (window.confirm(`Supprimer la compétence "${skillName}" ?`)) {
      this.employeeSkillService.delete(this.employee!.id!, skill.skill_id).subscribe({
        next: () => {
          this.skillSuccessMessage = 'Compétence supprimée avec succès';
          this.loadEmployee(this.employee!.id!);
        },
        error: (err) => {
          console.error('Error deleting skill:', err);
          this.skillErrorMessage = 'Erreur lors de la suppression de la compétence.';
        }
      });
    }
  }

  cancelSkillEdit(): void {
    this.showSkillForm = false;
    this.editingSkill = null;
    this.skillForm.reset();
    this.clearSkillMessages();
  }

  clearSkillMessages(): void {
    this.skillErrorMessage = null;
    this.skillSuccessMessage = null;
  }

  // ==================== MÉTHODES STATISTIQUES SÉCURISÉES ====================

  getSkillsCount(): number {
    if (!this.employee?.skills || !Array.isArray(this.employee.skills)) {
      return 0;
    }
    return this.employee.skills.length;
  }

  getCertifiedSkillsCount(): number {
    if (!this.hasSkillsSafe()) return 0;
    return this.getSkillsSafe().filter(skill => skill.certification && skill.certification.trim() !== '').length;
  }

  getAverageSkillLevel(): number {
    const skills = this.getSkillsSafe();
    if (skills.length === 0) return 0;
    
    const totalValue = skills.reduce((sum, skill) => {
      const level = this.skillLevels.find(l => l.id === skill.actual_skill_level_id);
      return sum + (level?.value || 0);
    }, 0);
    
    return totalValue / skills.length;
  }

  getSkillsByTypeCount(): number {
    if (!this.hasSkillsSafe()) return 0;
    
    const types = new Set<string>();
    this.getSkillsSafe().forEach(skill => {
      const typeName = this.getSkillTypeNameSafe(skill);
      if (typeName !== 'Type inconnu') {
        types.add(typeName);
      }
    });
    
    return types.size;
  }

  getSkillsByTypeEntries(): Array<{type: string, skills: any[]}> {
    if (!this.hasSkillsSafe()) return [];
    
    const skillsByType: { [key: string]: any[] } = {};
    
    this.getSkillsSafe().forEach(skill => {
      const typeName = this.getSkillTypeNameSafe(skill);
      
      if (!skillsByType[typeName]) {
        skillsByType[typeName] = [];
      }
      skillsByType[typeName].push(skill);
    });
    
    return Object.entries(skillsByType).map(([type, skills]) => ({ type, skills }));
  }

  // ==================== MÉTHODES UTILITAIRES SÉCURISÉES ====================

  getSkillTypeNameSafe(skill: any): string {
    if (!skill) return 'Type inconnu';
    
    // Différentes structures possibles
    if (skill.skill?.type?.type_name) return skill.skill.type.type_name;
    if (skill.Skill?.type?.type_name) return skill.Skill.type.type_name;
    
    // Fallback avec l'ID
    const skillId = skill.skill_id || skill.id;
    const skillObj = this.skills.find(s => s.id === skillId);
    const typeObj = this.skillTypes.find(t => t.id === skillObj?.skill_type_id);
    return typeObj?.type_name || 'Type inconnu';
  }

  getSkillNameSafe(skill: any): string {
    if (!skill) return 'Compétence inconnue';
    
    // Différentes structures possibles
    if (skill.skill?.name) return skill.skill.name;
    if (skill.Skill?.name) return skill.Skill.name;
    if (skill.name) return skill.name;
    
    // Fallback avec l'ID
    const skillId = skill.skill_id || skill.id;
    return this.getSkillName(skillId);
  }

  getSkillLevelNameSafe(skill: any): string {
    if (!skill) return 'Niveau inconnu';
    
    // Différentes structures possibles
    if (skill.SkillLevel?.level_name) return skill.SkillLevel.level_name;
    if (skill.skill_level?.level_name) return skill.skill_level.level_name;
    if (skill.level_name) return skill.level_name;
    
    // Fallback avec l'ID
    const levelId = skill.actual_skill_level_id || skill.level_id;
    return this.getSkillLevelName(levelId);
  }

  getSkillLevelValueSafe(skill: any): number {
    if (!skill) return 0;
    
    // Différentes structures possibles
    if (skill.SkillLevel?.value) return skill.SkillLevel.value;
    if (skill.skill_level?.value) return skill.skill_level.value;
    if (skill.value) return skill.value;
    
    // Fallback avec l'ID
    const levelId = skill.actual_skill_level_id || skill.level_id;
    return this.getSkillLevelValue(levelId);
  }

  getSkillLevelValue(levelId: number): number {
    const level = this.skillLevels.find(l => l.id === levelId);
    return level ? level.value : 0;
  }

  getSkillLevelClass(levelValue: number): string {
    if (levelValue <= 1) return 'bg-red-100 text-red-800';
    if (levelValue <= 2) return 'bg-yellow-100 text-yellow-800';
    if (levelValue <= 3) return 'bg-blue-100 text-blue-800';
    if (levelValue <= 4) return 'bg-green-100 text-green-800';
    return 'bg-purple-100 text-purple-800';
  }

  getFirstCharSafe(name: string | undefined): string {
    if (!name || name.length === 0) return '?';
    return name.charAt(0).toUpperCase();
  }

  // Méthode sécurisée pour formater les dates avec undefined
  formatDateSafe(dateString: string | null | undefined): string {
    if (!dateString) return 'Non définie';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR');
    } catch {
      return 'Date invalide';
    }
  }

  // Méthode sécurisée pour vérifier les compétences
  hasSkillsSafe(): boolean {
    return !!(this.employee?.skills && Array.isArray(this.employee.skills) && this.employee.skills.length > 0);
  }

  // Méthode sécurisée pour obtenir les compétences
  getSkillsSafe(): any[] {
    if (!this.employee?.skills || !Array.isArray(this.employee.skills)) {
      return [];
    }
    return this.employee.skills;
  }

}