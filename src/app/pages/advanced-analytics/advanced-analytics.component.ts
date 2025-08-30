import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { AnalyticsService } from '../../services/analytics.service';
import { 
  AnalyticsOverview,
  DepartmentStatistics,
  ContractTypeStatistics,
  SkillDemand,
  AnalyticsFilters
} from '../../models/analytics.model';

Chart.register(...registerables);

@Component({
  selector: 'app-advanced-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './advanced-analytics.component.html',
  styleUrls: ['./advanced-analytics.component.css']
})
export class AdvancedAnalyticsComponent implements OnInit, AfterViewInit {
  @ViewChild('departmentChart') departmentChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('contractChart') contractChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('skillsChart') skillsChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendsChart') trendsChartRef!: ElementRef<HTMLCanvasElement>;

  // Data
  analyticsOverview: AnalyticsOverview | null = null;
  departmentStats: DepartmentStatistics[] = [];
  contractStats: ContractTypeStatistics[] = [];
  skillsDemand: SkillDemand[] = [];

  // Charts
  departmentChart: Chart | null = null;
  contractChart: Chart | null = null;
  skillsChart: Chart | null = null;
  trendsChart: Chart | null = null;

  // Filters
  filters: AnalyticsFilters = {};
  selectedPeriod: string = 'month';
  selectedMetric: string = 'applications';

  // States
  loading: boolean = true;
  errorMessage: string | null = null;
  activeTab: 'overview' | 'departments' | 'contracts' | 'skills' | 'trends' = 'overview';

  constructor(private analyticsService: AnalyticsService) { }

  ngOnInit(): void {
    this.loadAnalyticsData();
  }

  ngAfterViewInit(): void {
    // Charts will be created after data is loaded
  }

  loadAnalyticsData(): void {
    this.loading = true;
    this.errorMessage = null;

    Promise.all([
      this.analyticsService.getAnalyticsOverview(this.filters).toPromise(),
      this.analyticsService.getDepartmentStatistics(this.filters).toPromise(),
      this.analyticsService.getContractTypeStatistics(this.filters).toPromise(),
      this.analyticsService.getSkillsDemandAnalysis(this.filters).toPromise()
    ]).then(([overview, departments, contracts, skills]) => {
      this.analyticsOverview = overview || null;
      this.departmentStats = departments || [];
      this.contractStats = contracts || [];
      this.skillsDemand = skills || [];
      
      this.createCharts();
      this.loading = false;
    }).catch(err => {
      console.error('Error loading analytics:', err);
      this.errorMessage = 'Erreur lors du chargement des analytics. Données simulées affichées.';
      this.loadMockData();
      this.loading = false;
    });
  }

  loadMockData(): void {
    // Données simulées pour démonstration
    this.analyticsOverview = {
      total_employees: 150,
      total_job_descriptions: 25,
      total_applications: 450,
      overall_success_rate: 68.5,
      top_performing_departments: [],
      skills_in_high_demand: [],
      contract_type_breakdown: [],
      recent_trends: []
    };

    this.departmentStats = [
      { department: 'IT', total_applications: 120, successful_applications: 85, success_rate: 70.8, average_time_to_hire: 15, top_skills_requested: [] },
      { department: 'Marketing', total_applications: 80, successful_applications: 55, success_rate: 68.8, average_time_to_hire: 12, top_skills_requested: [] },
      { department: 'RH', total_applications: 45, successful_applications: 30, success_rate: 66.7, average_time_to_hire: 10, top_skills_requested: [] },
      { department: 'Finance', total_applications: 60, successful_applications: 42, success_rate: 70.0, average_time_to_hire: 18, top_skills_requested: [] }
    ];

    this.contractStats = [
      { contract_type: 'CDI', total_applications: 200, successful_applications: 140, success_rate: 70.0, average_salary_min: 35000, average_salary_max: 55000, most_requested_skills: ['JavaScript', 'Communication'] },
      { contract_type: 'CDD', total_applications: 100, successful_applications: 65, success_rate: 65.0, average_salary_min: 30000, average_salary_max: 45000, most_requested_skills: ['Python', 'Gestion de projet'] },
      { contract_type: 'Stage', total_applications: 80, successful_applications: 60, success_rate: 75.0, average_salary_min: 600, average_salary_max: 1200, most_requested_skills: ['Formation', 'Adaptabilité'] },
      { contract_type: 'Freelance', total_applications: 70, successful_applications: 45, success_rate: 64.3, average_salary_min: 400, average_salary_max: 800, most_requested_skills: ['Expertise technique', 'Autonomie'] }
    ];

    this.skillsDemand = [
      { skill_name: 'JavaScript', skill_id: 1, demand_count: 45, success_rate_with_skill: 85.2, average_level_required: 3.2 },
      { skill_name: 'Communication', skill_id: 2, demand_count: 38, success_rate_with_skill: 78.9, average_level_required: 3.8 },
      { skill_name: 'Gestion de projet', skill_id: 3, demand_count: 32, success_rate_with_skill: 82.1, average_level_required: 3.5 },
      { skill_name: 'Python', skill_id: 4, demand_count: 28, success_rate_with_skill: 79.3, average_level_required: 3.1 },
      { skill_name: 'Leadership', skill_id: 5, demand_count: 25, success_rate_with_skill: 88.0, average_level_required: 4.0 }
    ];

    this.createCharts();
  }

  setActiveTab(tab: 'overview' | 'departments' | 'contracts' | 'skills' | 'trends'): void {
    this.activeTab = tab;
  }

  applyFilters(): void {
    this.loadAnalyticsData();
  }

  clearFilters(): void {
    this.filters = {};
    this.loadAnalyticsData();
  }

  exportReport(format: 'pdf' | 'excel' | 'csv'): void {
    this.analyticsService.exportAnalyticsReport(format, this.filters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics-report-${new Date().toISOString().split('T')[0]}.${format}`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error exporting report:', err);
      }
    });
  }

  createCharts(): void {
    setTimeout(() => {
      this.createDepartmentChart();
      this.createContractChart();
      this.createSkillsChart();
      this.createTrendsChart();
    }, 100);
  }

  createDepartmentChart(): void {
    if (this.departmentChart) {
      this.departmentChart.destroy();
    }

    const ctx = this.departmentChartRef?.nativeElement?.getContext('2d');
    if (ctx && this.departmentStats.length > 0) {
      this.departmentChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: this.departmentStats.map(d => d.department),
          datasets: [
            {
              label: 'Candidatures totales',
              data: this.departmentStats.map(d => d.total_applications),
              backgroundColor: '#3B82F6',
              borderColor: '#2563EB',
              borderWidth: 1
            },
            {
              label: 'Candidatures réussies',
              data: this.departmentStats.map(d => d.successful_applications),
              backgroundColor: '#10B981',
              borderColor: '#059669',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
  }

  createContractChart(): void {
    if (this.contractChart) {
      this.contractChart.destroy();
    }

    const ctx = this.contractChartRef?.nativeElement?.getContext('2d');
    if (ctx && this.contractStats.length > 0) {
      this.contractChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: this.contractStats.map(c => c.contract_type),
          datasets: [{
            data: this.contractStats.map(c => c.total_applications),
            backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
            hoverBackgroundColor: ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    }
  }

  createSkillsChart(): void {
    if (this.skillsChart) {
      this.skillsChart.destroy();
    }

    const ctx = this.skillsChartRef?.nativeElement?.getContext('2d');
    if (ctx && this.skillsDemand.length > 0) {
      this.skillsChart = new Chart(ctx, {
        type: 'horizontalBar',
        data: {
          labels: this.skillsDemand.slice(0, 10).map(s => s.skill_name),
          datasets: [{
            label: 'Demande',
            data: this.skillsDemand.slice(0, 10).map(s => s.demand_count),
            backgroundColor: '#8B5CF6',
            borderColor: '#7C3AED',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          scales: {
            x: {
              beginAtZero: true
            }
          }
        }
      });
    }
  }

  createTrendsChart(): void {
    if (this.trendsChart) {
      this.trendsChart.destroy();
    }

    const ctx = this.trendsChartRef?.nativeElement?.getContext('2d');
    if (ctx) {
      // Données simulées pour les tendances
      const trendData = [
        { month: 'Jan', applications: 35, success: 24 },
        { month: 'Fév', applications: 42, success: 29 },
        { month: 'Mar', applications: 38, success: 26 },
        { month: 'Avr', applications: 45, success: 32 },
        { month: 'Mai', applications: 52, success: 38 },
        { month: 'Jun', applications: 48, success: 35 }
      ];

      this.trendsChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: trendData.map(d => d.month),
          datasets: [
            {
              label: 'Candidatures',
              data: trendData.map(d => d.applications),
              borderColor: '#3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4
            },
            {
              label: 'Succès',
              data: trendData.map(d => d.success),
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.departmentChart) this.departmentChart.destroy();
    if (this.contractChart) this.contractChart.destroy();
    if (this.skillsChart) this.skillsChart.destroy();
    if (this.trendsChart) this.trendsChart.destroy();
  }
}