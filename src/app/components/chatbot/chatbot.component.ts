import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatbotService, ChatMessage } from '../../services/chatbot.service';
import { JobDescriptionService } from '../../services/job-description.service';
import { JobDescription } from '../../models/job-description.model';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css']
})
export class ChatbotComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  messages: ChatMessage[] = [];
  currentMessage: string = '';
  isOpen: boolean = false;
  isTyping: boolean = false;
  jobDescriptions: JobDescription[] = [];
  
  private subscriptions: Subscription[] = [];

  constructor(
    private chatbotService: ChatbotService,
    private jobDescriptionService: JobDescriptionService
  ) {}

  ngOnInit(): void {
    // S'abonner aux messages du chatbot
    this.subscriptions.push(
      this.chatbotService.messages$.subscribe(messages => {
        this.messages = messages;
      })
    );

    // S'abonner à l'état de frappe
    this.subscriptions.push(
      this.chatbotService.isTyping$.subscribe(isTyping => {
        this.isTyping = isTyping;
      })
    );

    // Charger les fiches de poste pour les suggestions
    this.loadJobDescriptions();
    
    // Ajouter un message d'aide contextuel après 3 secondes si aucun message
    setTimeout(() => {
      if (this.messages.length <= 1) {
        this.showContextualHelp();
      }
    }, 3000);
  }

  private showContextualHelp(): void {
    const helpMessage = `💡 **Exemples de questions que vous pouvez me poser :**\n\n🎯 **Matching :**\n• "Quel est le meilleur employé pour le poste de Développeur ?"\n• "Qui peut occuper le poste de Manager Commercial ?"\n\n🎓 **Formation :**\n• "Quelles formations pour Jean Dupont ?"\n• "Comment améliorer les compétences de l'équipe ?"\n\n📊 **Statistiques :**\n• "Combien d'employés dans l'organisation ?"\n• "Quelles sont les compétences les plus demandées ?"`;
    
    this.chatbotService.addBotMessage(helpMessage, 'help');
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      setTimeout(() => {
        this.messageInput?.nativeElement?.focus();
      }, 100);
    }
  }

  sendMessage(): void {
    if (this.currentMessage.trim()) {
      const message = this.currentMessage.trim();
      this.currentMessage = '';
      
      this.chatbotService.sendMessage(message).subscribe({
        next: () => {
          // Message traité avec succès
        },
        error: (error) => {
          console.error('Erreur lors de l\'envoi du message:', error);
        }
      });
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  selectJobForMatching(job: JobDescription): void {
    const message = `Quel est le meilleur employé pour le poste de ${job.emploi} dans la filière ${job.filiere_activite} ?`;
    this.currentMessage = message;
    this.sendMessage();
  }

  viewEmployeeProfile(employeeId: number): void {
    // Naviguer vers le profil de l'employé
    window.open(`/profile/${employeeId}`, '_blank');
  }

  startMatching(employeeId: number): void {
    // Naviguer vers la page de matching avec l'employé pré-sélectionné
    window.open(`/matching?employeeId=${employeeId}`, '_blank');
  }

  private showContextualHelp(): void {
    const helpMessage = `💡 **Exemples de questions que vous pouvez me poser :**\n\n🎯 **Matching :**\n• "Quel est le meilleur employé pour le poste de Développeur ?"\n• "Qui peut occuper le poste de Manager Commercial ?"\n\n🎓 **Formation :**\n• "Quelles formations pour Jean Dupont ?"\n• "Comment améliorer les compétences de l'équipe ?"\n\n📊 **Statistiques :**\n• "Combien d'employés dans l'organisation ?"\n• "Quelles sont les compétences les plus demandées ?"`;
    
    this.chatbotService.addBotMessage(helpMessage, 'help');
  }

  clearChat(): void {
    this.chatbotService.clearChat();
  }

  private loadJobDescriptions(): void {
    this.jobDescriptionService.getJobDescriptions().subscribe({
      next: (jobs) => {
        this.jobDescriptions = jobs;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des postes:', error);
      }
    });
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Erreur lors du scroll:', err);
    }
  }

  getMessageClass(message: ChatMessage): string {
    if (message.isUser) {
      return 'bg-primary text-white ml-auto';
    } else {
      switch (message.type) {
        case 'error':
          return 'bg-red-100 text-red-800 border border-red-200';
        case 'employee-recommendation':
          return 'bg-green-100 text-green-800 border border-green-200';
        case 'training-suggestion':
          return 'bg-blue-100 text-blue-800 border border-blue-200';
        case 'help':
          return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
        case 'job-list':
          return 'bg-purple-100 text-purple-800 border border-purple-200';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    }
  }

  formatMessageText(text: string): string {
    // Convertir le markdown simple en HTML
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
}