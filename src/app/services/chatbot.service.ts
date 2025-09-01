import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { EmployeeService } from './employee.service';
import { JobDescriptionService } from './job-description.service';
import { MatchingService } from './matching.service';
import { AnalyticsService } from './analytics.service';
import { Employee } from '../models/employee.model';
import { JobDescription } from '../models/job-description.model';
import { MatchingResult } from '../models/matching.model';
import { EmployeeSkillRecommendation } from '../models/analytics.model';

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  type?: 'text' | 'employee-recommendation' | 'training-suggestion' | 'error';
  data?: any;
}

export interface EmployeeRecommendation {
  employee: Employee;
  score: number;
  skillGaps: Array<{
    skill_name: string;
    required_level: number;
    current_level: number;
    gap: number;
  }>;
  trainingSuggestions: Array<{
    skill_name: string;
    current_level: number;
    target_level: number;
    estimated_duration: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private isTypingSubject = new BehaviorSubject<boolean>(false);
  public isTyping$ = this.isTypingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private employeeService: EmployeeService,
    private jobDescriptionService: JobDescriptionService,
    private matchingService: MatchingService,
    private analyticsService: AnalyticsService
  ) {
    this.initializeChat();
  }

  private initializeChat(): void {
    const welcomeMessage: ChatMessage = {
      id: this.generateId(),
      text: "👋 Bonjour ! Je suis votre assistant RH intelligent. Je peux vous aider à :\n\n• Trouver le meilleur employé pour un poste\n• Analyser les compétences manquantes\n• Suggérer des formations\n• Répondre à vos questions RH\n\nComment puis-je vous aider aujourd'hui ?",
      isUser: false,
      timestamp: new Date(),
      type: 'text'
    };
    this.messagesSubject.next([welcomeMessage]);
  }

  sendMessage(text: string): Observable<ChatMessage> {
    const userMessage: ChatMessage = {
      id: this.generateId(),
      text: text,
      isUser: true,
      timestamp: new Date(),
      type: 'text'
    };

    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, userMessage]);
    
    this.isTypingSubject.next(true);

    return this.processUserMessage(text).pipe(
      map(response => {
        this.isTypingSubject.next(false);
        const botMessage: ChatMessage = {
          id: this.generateId(),
          text: response.text,
          isUser: false,
          timestamp: new Date(),
          type: response.type || 'text',
          data: response.data
        };
        
        const updatedMessages = this.messagesSubject.value;
        this.messagesSubject.next([...updatedMessages, botMessage]);
        
        return botMessage;
      }),
      catchError(error => {
        this.isTypingSubject.next(false);
        const errorMessage: ChatMessage = {
          id: this.generateId(),
          text: "Désolé, j'ai rencontré une erreur. Pouvez-vous reformuler votre question ?",
          isUser: false,
          timestamp: new Date(),
          type: 'error'
        };
        
        const updatedMessages = this.messagesSubject.value;
        this.messagesSubject.next([...updatedMessages, errorMessage]);
        
        throw error;
      })
    );
  }

  private processUserMessage(text: string): Observable<{text: string, type?: string, data?: any}> {
    // Utiliser l'API backend pour traiter la question
    return this.callBackendChatbot(text).pipe(
      map(response => ({
        text: response.response,
        type: response.type || 'text',
        data: response.recommendation || response.data
      })),
      catchError(error => {
        console.error('Erreur chatbot backend:', error);
        return this.handleGeneralResponse(text);
      })
    );
  }

  private isJobMatchingQuery(text: string): boolean {
    const keywords = [
      'meilleur employé', 'employé adequat', 'candidat idéal', 'qui convient',
      'pour ce poste', 'pour le poste', 'matching', 'correspondance',
      'recommander', 'suggérer un employé'
    ];
    return keywords.some(keyword => text.includes(keyword));
  }

  private isEmployeeQuery(text: string): boolean {
    const keywords = [
      'employé', 'collaborateur', 'profil', 'compétences de',
      'qui est', 'informations sur'
    ];
    return keywords.some(keyword => text.includes(keyword));
  }

  private isTrainingQuery(text: string): boolean {
    const keywords = [
      'formation', 'développer', 'améliorer', 'apprendre',
      'monter en compétence', 'lacune', 'gap', 'manque'
    ];
    return keywords.some(keyword => text.includes(keyword));
  }

  private isGeneralHRQuery(text: string): boolean {
    const keywords = [
      'statistiques', 'combien', 'nombre', 'total',
      'département', 'équipe', 'organisation'
    ];
    return keywords.some(keyword => text.includes(keyword));
  }

  private handleJobMatchingQuery(text: string): Observable<{text: string, type: string, data: any}> {
    return new Observable(observer => {
      // Charger les fiches de poste pour permettre à l'utilisateur de choisir
      this.jobDescriptionService.getJobDescriptions().subscribe({
        next: (jobDescriptions) => {
          if (jobDescriptions.length === 0) {
            observer.next({
              text: "❌ Aucune fiche de poste n'est disponible. Veuillez d'abord créer des fiches de poste.",
              type: 'error'
            });
            observer.complete();
            return;
          }

          // Essayer d'extraire un nom de poste du message
          const extractedJob = this.extractJobFromText(text, jobDescriptions);
          
          if (extractedJob) {
            this.findBestEmployeeForJob(extractedJob).subscribe({
              next: (recommendation) => {
                observer.next({
                  text: this.formatEmployeeRecommendation(recommendation, extractedJob),
                  type: 'employee-recommendation',
                  data: recommendation
                });
                observer.complete();
              },
              error: () => {
                observer.next({
                  text: "❌ Erreur lors de l'analyse. Veuillez réessayer.",
                  type: 'error'
                });
                observer.complete();
              }
            });
          } else {
            // Proposer la liste des postes disponibles
            const jobsList = jobDescriptions.map(job => 
              `• ${job.emploi} (${job.filiere_activite})`
            ).join('\n');
            
            observer.next({
              text: `🎯 Pour vous aider à trouver le meilleur employé, voici les postes disponibles :\n\n${jobsList}\n\nPouvez-vous préciser pour quel poste vous cherchez un candidat ?`,
              type: 'text',
              data: { jobDescriptions }
            });
            observer.complete();
          }
        },
        error: () => {
          observer.next({
            text: "❌ Erreur lors du chargement des postes.",
            type: 'error'
          });
          observer.complete();
        }
      });
    });
  }

  private extractJobFromText(text: string, jobDescriptions: JobDescription[]): JobDescription | null {
    const lowerText = text.toLowerCase();
    
    // Chercher une correspondance exacte ou partielle
    for (const job of jobDescriptions) {
      if (lowerText.includes(job.emploi.toLowerCase()) || 
          lowerText.includes(job.filiere_activite.toLowerCase())) {
        return job;
      }
    }
    
    return null;
  }

  private findBestEmployeeForJob(jobDescription: JobDescription): Observable<EmployeeRecommendation> {
    return new Observable(observer => {
      if (!jobDescription.id) {
        observer.error('ID de poste manquant');
        return;
      }

      this.matchingService.getJobEmployeeSkillMatch(jobDescription.id).subscribe({
        next: (matchingResults) => {
          if (matchingResults.length === 0) {
            observer.next({
              employee: {} as Employee,
              score: 0,
              skillGaps: [],
              trainingSuggestions: []
            });
            observer.complete();
            return;
          }

          // Prendre le meilleur candidat
          const bestMatch = matchingResults.sort((a, b) => b.score - a.score)[0];
          
          // Charger les détails de l'employé
          this.employeeService.getEmployeeById(bestMatch.employee_id).subscribe({
            next: (employee) => {
              // Analyser les lacunes et générer des suggestions de formation
              const skillGaps = bestMatch.skill_gap_details?.filter(skill => skill.gap < 0) || [];
              const trainingSuggestions = this.generateTrainingSuggestions(skillGaps);

              const recommendation: EmployeeRecommendation = {
                employee,
                score: bestMatch.score,
                skillGaps: skillGaps.map(gap => ({
                  skill_name: gap.skill_name,
                  required_level: gap.required_skill_level,
                  current_level: gap.actual_skill_level,
                  gap: gap.gap
                })),
                trainingSuggestions
              };

              observer.next(recommendation);
              observer.complete();
            },
            error: () => {
              observer.error('Erreur lors du chargement des détails de l\'employé');
            }
          });
        },
        error: () => {
          observer.error('Erreur lors du matching');
        }
      });
    });
  }

  private generateTrainingSuggestions(skillGaps: any[]): Array<{
    skill_name: string;
    current_level: number;
    target_level: number;
    estimated_duration: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    return skillGaps.map(gap => {
      const gapSize = Math.abs(gap.gap);
      let priority: 'high' | 'medium' | 'low' = 'medium';
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
        current_level: gap.actual_skill_level,
        target_level: gap.required_skill_level,
        estimated_duration: duration,
        priority
      };
    });
  }

  private formatEmployeeRecommendation(recommendation: EmployeeRecommendation, job: JobDescription): string {
    if (recommendation.score === 0) {
      return `❌ Aucun employé ne correspond actuellement au poste "${job.emploi}".\n\nJe recommande de :\n• Revoir les exigences du poste\n• Former des employés existants\n• Recruter en externe`;
    }

    let response = `🎯 **Meilleur candidat pour "${job.emploi}" :**\n\n`;
    response += `👤 **${recommendation.employee.name}**\n`;
    response += `📧 ${recommendation.employee.email}\n`;
    response += `💼 ${recommendation.employee.position}\n`;
    response += `📊 **Score de compatibilité : ${recommendation.score.toFixed(1)}%**\n\n`;

    if (recommendation.score >= 80) {
      response += `✅ **Excellent candidat !** Prêt pour le poste.\n\n`;
    } else if (recommendation.score >= 60) {
      response += `⚠️ **Bon candidat** avec quelques lacunes à combler.\n\n`;
    } else {
      response += `🔄 **Candidat potentiel** nécessitant une formation significative.\n\n`;
    }

    if (recommendation.skillGaps.length > 0) {
      response += `📚 **Compétences à développer :**\n`;
      recommendation.skillGaps.forEach(gap => {
        response += `• ${gap.skill_name}: niveau ${gap.current_level}/${gap.required_level} (écart: ${Math.abs(gap.gap)})\n`;
      });
      response += '\n';
    }

    if (recommendation.trainingSuggestions.length > 0) {
      response += `🎓 **Plan de formation recommandé :**\n`;
      recommendation.trainingSuggestions.forEach(training => {
        const priorityEmoji = training.priority === 'high' ? '🔴' : training.priority === 'medium' ? '🟡' : '🟢';
        response += `${priorityEmoji} ${training.skill_name}: ${training.current_level} → ${training.target_level} (${training.estimated_duration})\n`;
      });
    }

    return response;
  }

  private handleEmployeeQuery(text: string): Observable<{text: string, type: string, data?: any}> {
    return new Observable(observer => {
      this.employeeService.getEmployees().subscribe({
        next: (employees) => {
          const employeeName = this.extractEmployeeNameFromText(text, employees);
          
          if (employeeName) {
            const employee = employees.find(emp => 
              emp.name.toLowerCase().includes(employeeName.toLowerCase())
            );
            
            if (employee) {
              const response = this.formatEmployeeProfile(employee);
              observer.next({ text: response, type: 'text', data: { employee } });
            } else {
              observer.next({ 
                text: `❌ Aucun employé trouvé avec le nom "${employeeName}".`,
                type: 'error'
              });
            }
          } else {
            const employeesList = employees.slice(0, 10).map(emp => 
              `• ${emp.name} (${emp.position})`
            ).join('\n');
            
            observer.next({
              text: `👥 Voici quelques employés :\n\n${employeesList}\n\nSur qui souhaitez-vous des informations ?`,
              type: 'text'
            });
          }
          observer.complete();
        },
        error: () => {
          observer.next({
            text: "❌ Erreur lors du chargement des employés.",
            type: 'error'
          });
          observer.complete();
        }
      });
    });
  }

  private handleTrainingQuery(text: string): Observable<{text: string, type: string, data?: any}> {
    return new Observable(observer => {
      observer.next({
        text: `🎓 **Suggestions de formation :**\n\nPour vous donner des recommandations précises, j'ai besoin de savoir :\n\n1. Pour quel employé ?\n2. Pour quel poste cible ?\n\nExemple : "Quelles formations pour Jean Dupont pour devenir Développeur Senior ?"`,
        type: 'training-suggestion'
      });
      observer.complete();
    });
  }

  private handleGeneralHRQuery(text: string): Observable<{text: string, type: string}> {
    return new Observable(observer => {
      this.employeeService.getEmployees().subscribe({
        next: (employees) => {
          const totalEmployees = employees.length;
          const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];
          const positions = [...new Set(employees.map(emp => emp.position))];
          
          let response = `📊 **Aperçu de votre organisation :**\n\n`;
          response += `👥 Total employés : ${totalEmployees}\n`;
          response += `🏢 Départements : ${departments.length}\n`;
          response += `💼 Postes différents : ${positions.length}\n\n`;
          
          if (departments.length > 0) {
            response += `**Départements :**\n`;
            departments.slice(0, 5).forEach(dept => {
              const count = employees.filter(emp => emp.department === dept).length;
              response += `• ${dept}: ${count} employé(s)\n`;
            });
          }

          observer.next({ text: response, type: 'text' });
          observer.complete();
        },
        error: () => {
          observer.next({
            text: "❌ Erreur lors du chargement des statistiques.",
            type: 'error'
          });
          observer.complete();
        }
      });
    });
  }

  private extractEmployeeNameFromText(text: string, employees: Employee[]): string | null {
    const lowerText = text.toLowerCase();
    
    for (const employee of employees) {
      const nameParts = employee.name.toLowerCase().split(' ');
      if (nameParts.some(part => lowerText.includes(part) && part.length > 2)) {
        return employee.name;
      }
    }
    
    return null;
  }

  private formatEmployeeProfile(employee: Employee): string {
    let response = `👤 **Profil de ${employee.name}**\n\n`;
    response += `💼 Poste : ${employee.position}\n`;
    response += `📧 Email : ${employee.email}\n`;
    response += `📅 Embauché le : ${new Date(employee.hire_date).toLocaleDateString('fr-FR')}\n`;
    
    if (employee.location) response += `📍 Localisation : ${employee.location}\n`;
    if (employee.department) response += `🏢 Département : ${employee.department}\n`;
    
    // Gérer les différentes structures de compétences
    const skills = employee.skills || (employee as any).EmployeeSkills || [];
    const skillsCount = skills.length;
    response += `\n🎯 **Compétences : ${skillsCount}**\n`;
    
    if (skillsCount > 0) {
      const topSkills = skills.slice(0, 5);
      topSkills.forEach(skill => {
        const skillName = skill.skill?.name || skill.Skill?.name || 'Compétence inconnue';
        const levelName = skill.SkillLevel?.level_name || skill.skill_level?.level_name || 'Niveau inconnu';
        response += `• ${skillName} (${levelName})\n`;
      });
      
      if (skillsCount > 5) {
        response += `... et ${skillsCount - 5} autres compétences\n`;
      }
    }

    return response;
  }

  private handleTrainingQuery(text: string): Observable<{text: string, type: string, data?: any}> {
    return new Observable(observer => {
      observer.next({
        text: `🎓 **Suggestions de formation :**\n\nPour vous donner des recommandations précises, j'ai besoin de savoir :\n\n1. Pour quel employé ?\n2. Pour quel poste cible ?\n\nExemple : "Quelles formations pour Jean Dupont pour devenir Développeur Senior ?"`,
        type: 'training-suggestion'
      });
      observer.complete();
    });
  }

  private handleGeneralHRQuery(text: string): Observable<{text: string, type: string}> {
    return new Observable(observer => {
      this.employeeService.getEmployees().subscribe({
        next: (employees) => {
          const totalEmployees = employees.length;
          const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];
          const positions = [...new Set(employees.map(emp => emp.position))];
          
          let response = `📊 **Aperçu de votre organisation :**\n\n`;
          response += `👥 Total employés : ${totalEmployees}\n`;
          response += `🏢 Départements : ${departments.length}\n`;
          response += `💼 Postes différents : ${positions.length}\n\n`;
          
          if (departments.length > 0) {
            response += `**Départements :**\n`;
            departments.slice(0, 5).forEach(dept => {
              const count = employees.filter(emp => emp.department === dept).length;
              response += `• ${dept}: ${count} employé(s)\n`;
            });
          }

          observer.next({ text: response, type: 'text' });
          observer.complete();
        },
        error: () => {
          observer.next({
            text: "❌ Erreur lors du chargement des statistiques.",
            type: 'error'
          });
          observer.complete();
        }
      });
    });
  }

  private handleGeneralResponse(text: string): Observable<{text: string, type: string}> {
    const responses = [
      "🤔 Je ne suis pas sûr de comprendre. Pouvez-vous reformuler ?",
      "💡 Essayez de me demander :\n• 'Quel est le meilleur employé pour le poste de Développeur ?'\n• 'Quelles formations pour améliorer les compétences ?'\n• 'Combien d'employés dans l'équipe ?'",
      "🔍 Je peux vous aider avec :\n• Matching employé-poste\n• Recommandations de formation\n• Statistiques RH\n• Informations sur les employés"
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    return new Observable(observer => {
      observer.next({ text: randomResponse, type: 'text' });
      observer.complete();
    });
  }

  clearChat(): void {
    this.initializeChat();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Méthodes publiques pour l'intégration avec les composants
  getJobRecommendation(jobId: number): Observable<EmployeeRecommendation> {
    return new Observable(observer => {
      this.jobDescriptionService.getJobDescriptionById(jobId).subscribe({
        next: (job) => {
          this.findBestEmployeeForJob(job).subscribe({
            next: (recommendation) => observer.next(recommendation),
    return this.http.post<any>(`${environment.backendUrl}/chatbot/question`, {
      question: text,
      context: {
        user_role: 'hr', // ou récupérer depuis AuthService
        timestamp: new Date().toISOString()
      }
    });
  }

  private handleGeneralResponse(text: string): Observable<{text: string, type: string}> {
            error: (err) => observer.error(err)
          });
        },
        error: (err) => observer.error(err)
      });
    });
  }

  getTrainingRecommendations(employeeId: number, targetJobId?: number): Observable<any> {
    if (targetJobId) {
      return this.http.post<any>(`${environment.backendUrl}/chatbot/training-suggestions`, {
        employee_id: employeeId,
        target_job_id: targetJobId
      });
    } else {
      return this.handleDefaultResponse(text);
    }
  }

  // Méthode pour obtenir des suggestions contextuelles
  getContextualSuggestions(): Observable<string[]> {
    return new Observable(observer => {
      this.jobDescriptionService.getJobDescriptions().subscribe({
        next: (jobs) => {
          const suggestions = [
            'Combien d\'employés dans l\'organisation ?',
            'Quelles sont les compétences les plus demandées ?',
            'Qui peut être promu ?'
          ];
          
          // Ajouter des suggestions basées sur les postes disponibles
          if (jobs.length > 0) {
            const randomJob = jobs[Math.floor(Math.random() * jobs.length)];
            suggestions.push(`Quel est le meilleur employé pour le poste de ${randomJob.emploi} ?`);
          }
          
          observer.next(suggestions);
          observer.complete();
        },
        error: () => {
          observer.next([
            'Combien d\'employés dans l\'organisation ?',
            'Quelles formations recommandez-vous ?',
            'Montrez-moi les statistiques RH'
          ]);
          observer.complete();
        }
      });
    });
  }

  // Méthode publique pour ajouter un message du bot
  addBotMessage(text: string, type: string = 'text'): void {
    const botMessage: ChatMessage = {
      id: this.generateId(),
      text: text,
      isUser: false,
      timestamp: new Date(),
      type: type as any
    };
    
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, botMessage]);
  }

  private handleDefaultResponse(text: string): Observable<{text: string, type: string}> {
    const responses = [
      "🤔 Je ne suis pas sûr de comprendre. Pouvez-vous reformuler ?",
      "💡 Essayez de me demander :\n• 'Quel est le meilleur employé pour le poste de Développeur ?'\n• 'Quelles formations pour améliorer les compétences ?'\n• 'Combien d'employés dans l'équipe ?'",
      "🔍 Je peux vous aider avec :\n• Matching employé-poste\n• Recommandations de formation\n• Statistiques RH\n• Informations sur les employés"
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    return new Observable(observer => {
      observer.next({ text: randomResponse, type: 'text' });
      observer.complete();
    });
  }
}