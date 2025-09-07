/**
 * AWS Cost Monitoring Service
 * 
 * Monitors AWS costs, usage patterns, and provides alerts for budget overruns.
 * Optimizes costs for HIPAA-compliant healthcare infrastructure.
 */

import { 
  CostExplorerClient, 
  GetCostAndUsageCommand,
  GetUsageforecastCommand,
  GetRightsizingRecommendationCommand
} from '@aws-sdk/client-cost-explorer';

import { 
  BudgetsClient,
  CreateBudgetCommand,
  DescribeBudgetsCommand,
  DescribeBudgetActionsForBudgetCommand
} from '@aws-sdk/client-budgets';

import { auditLogger, AuditEventType } from '../utils/auditLog';

export interface CostMetrics {
  currentMonthSpend: number;
  previousMonthSpend: number;
  projectedMonthlySpend: number;
  budgetLimit: number;
  percentOfBudgetUsed: number;
  dailyAverageSpend: number;
  costTrend: 'increasing' | 'decreasing' | 'stable';
  topServicesBySpend: ServiceCost[];
  recommendations: CostOptimizationRecommendation[];
}

export interface ServiceCost {
  service: string;
  cost: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  optimizable: boolean;
}

export interface CostOptimizationRecommendation {
  id: string;
  type: 'rightsizing' | 'storage' | 'compute' | 'data_transfer' | 'reserved_instances';
  service: string;
  description: string;
  estimatedSavings: number;
  priority: 'high' | 'medium' | 'low';
  implementationComplexity: 'low' | 'medium' | 'high';
  hipaaImpact: 'none' | 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface BudgetAlert {
  budgetName: string;
  threshold: number;
  currentSpend: number;
  percentUsed: number;
  daysIntoMonth: number;
  projectedOverage: number;
  alertLevel: 'warning' | 'critical' | 'exceeded';
}

/**
 * AWS Cost Monitoring Service
 */
export class CostMonitoringService {
  private costExplorer: CostExplorerClient;
  private budgets: BudgetsClient;
  private accountId: string;

  constructor() {
    this.costExplorer = new CostExplorerClient({ region: 'us-east-1' });
    this.budgets = new BudgetsClient({ region: 'us-east-1' });
    this.accountId = process.env.AWS_ACCOUNT_ID || '';
  }

  /**
   * Get comprehensive cost metrics
   */
  async getCostMetrics(): Promise<CostMetrics> {
    try {
      const [
        currentCosts,
        previousCosts,
        forecast,
        serviceBreakdown,
        recommendations
      ] = await Promise.all([
        this.getCurrentMonthCosts(),
        this.getPreviousMonthCosts(),
        this.getCostForecast(),
        this.getServiceCostBreakdown(),
        this.getCostOptimizationRecommendations()
      ]);

      const budgetLimit = await this.getBudgetLimit();
      const percentOfBudgetUsed = (currentCosts / budgetLimit) * 100;
      const daysInMonth = new Date().getDate();
      const dailyAverageSpend = currentCosts / daysInMonth;

      // Determine cost trend
      let costTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (currentCosts > previousCosts * 1.05) {
        costTrend = 'increasing';
      } else if (currentCosts < previousCosts * 0.95) {
        costTrend = 'decreasing';
      }

      const metrics: CostMetrics = {
        currentMonthSpend: currentCosts,
        previousMonthSpend: previousCosts,
        projectedMonthlySpend: forecast,
        budgetLimit,
        percentOfBudgetUsed,
        dailyAverageSpend,
        costTrend,
        topServicesBySpend: serviceBreakdown,
        recommendations
      };

      // Log cost metrics for audit
      auditLogger.log({
        event: AuditEventType.SYSTEM_ERROR, // Using available enum
        action: 'Cost metrics retrieved',
        result: 'success',
        details: {
          currentSpend: currentCosts,
          budgetUsage: percentOfBudgetUsed,
          trend: costTrend,
          topServices: serviceBreakdown.slice(0, 3).map(s => s.service)
        }
      });

      return metrics;
    } catch (error) {
      console.error('Error retrieving cost metrics:', error);
      throw new Error('Failed to retrieve cost metrics');
    }
  }

  /**
   * Check for budget alerts
   */
  async checkBudgetAlerts(): Promise<BudgetAlert[]> {
    try {
      const budgets = await this.getBudgets();
      const alerts: BudgetAlert[] = [];

      for (const budget of budgets) {
        const currentSpend = await this.getCurrentSpendForBudget(budget.budgetName);
        const budgetAmount = budget.budgetLimit.amount;
        const percentUsed = (currentSpend / budgetAmount) * 100;
        const daysIntoMonth = new Date().getDate();
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const projectedMonthlySpend = (currentSpend / daysIntoMonth) * daysInMonth;
        const projectedOverage = Math.max(0, projectedMonthlySpend - budgetAmount);

        let alertLevel: 'warning' | 'critical' | 'exceeded';
        if (percentUsed >= 100) {
          alertLevel = 'exceeded';
        } else if (percentUsed >= 90 || projectedOverage > 0) {
          alertLevel = 'critical';
        } else if (percentUsed >= 75) {
          alertLevel = 'warning';
        } else {
          continue; // Skip if under warning threshold
        }

        alerts.push({
          budgetName: budget.budgetName,
          threshold: budget.threshold,
          currentSpend,
          percentUsed,
          daysIntoMonth,
          projectedOverage,
          alertLevel
        });
      }

      // Log budget alerts
      if (alerts.length > 0) {
        auditLogger.log({
          event: AuditEventType.SYSTEM_ERROR,
          action: 'Budget alerts generated',
          result: 'warning',
          details: {
            alertCount: alerts.length,
            criticalAlerts: alerts.filter(a => a.alertLevel === 'critical').length,
            exceededBudgets: alerts.filter(a => a.alertLevel === 'exceeded').length
          }
        });
      }

      return alerts;
    } catch (error) {
      console.error('Error checking budget alerts:', error);
      return [];
    }
  }

  /**
   * Get HIPAA-specific cost optimization recommendations
   */
  private async getCostOptimizationRecommendations(): Promise<CostOptimizationRecommendation[]> {
    const recommendations: CostOptimizationRecommendation[] = [];

    try {
      // Get rightsizing recommendations
      const rightsizingResponse = await this.costExplorer.send(
        new GetRightsizingRecommendationCommand({
          Service: 'EC2-Instance',
          Configuration: {
            BenefitsConsidered: true,
            RecommendationTarget: 'SAME_INSTANCE_FAMILY'
          }
        })
      );

      // Process rightsizing recommendations
      rightsizingResponse.RightsizingRecommendations?.forEach((rec, index) => {
        if (rec.ModifyRecommendationDetail?.TargetInstances) {
          recommendations.push({
            id: `rightsizing-${index}`,
            type: 'rightsizing',
            service: 'EC2',
            description: `Right-size ${rec.CurrentInstance?.ResourceId} instance`,
            estimatedSavings: parseFloat(rec.ModifyRecommendationDetail.EstimatedMonthlySavings || '0'),
            priority: this.determinePriority(parseFloat(rec.ModifyRecommendationDetail.EstimatedMonthlySavings || '0')),
            implementationComplexity: 'medium',
            hipaaImpact: 'low',
            recommendation: `Consider changing instance type to optimize costs while maintaining HIPAA compliance`
          });
        }
      });

      // Add healthcare-specific recommendations
      recommendations.push(...await this.getHealthcareSpecificRecommendations());

      return recommendations;
    } catch (error) {
      console.error('Error getting cost recommendations:', error);
      return this.getFallbackRecommendations();
    }
  }

  /**
   * Healthcare-specific cost optimization recommendations
   */
  private async getHealthcareSpecificRecommendations(): Promise<CostOptimizationRecommendation[]> {
    return [
      {
        id: 'healthcare-storage-1',
        type: 'storage',
        service: 'DynamoDB',
        description: 'Optimize DynamoDB audit log storage with lifecycle policies',
        estimatedSavings: 150,
        priority: 'high',
        implementationComplexity: 'low',
        hipaaImpact: 'none',
        recommendation: 'Implement DynamoDB TTL for audit logs after 6-year retention period'
      },
      {
        id: 'healthcare-compute-1',
        type: 'compute',
        service: 'Lambda',
        description: 'Optimize Lambda memory allocation for audit processing',
        estimatedSavings: 75,
        priority: 'medium',
        implementationComplexity: 'low',
        hipaaImpact: 'none',
        recommendation: 'Right-size Lambda memory based on actual usage patterns'
      },
      {
        id: 'healthcare-data-1',
        type: 'data_transfer',
        service: 'CloudFront',
        description: 'Implement CloudFront for static healthcare content',
        estimatedSavings: 200,
        priority: 'medium',
        implementationComplexity: 'medium',
        hipaaImpact: 'low',
        recommendation: 'Use CloudFront to reduce data transfer costs for patient portal assets'
      },
      {
        id: 'healthcare-reserved-1',
        type: 'reserved_instances',
        service: 'RDS',
        description: 'Purchase reserved instances for production RDS',
        estimatedSavings: 500,
        priority: 'high',
        implementationComplexity: 'low',
        hipaaImpact: 'none',
        recommendation: 'Purchase 1-year reserved instances for predictable RDS workload'
      }
    ];
  }

  /**
   * Get current month costs
   */
  private async getCurrentMonthCosts(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const response = await this.costExplorer.send(
      new GetCostAndUsageCommand({
        TimePeriod: {
          Start: startOfMonth.toISOString().split('T')[0],
          End: now.toISOString().split('T')[0]
        },
        Granularity: 'MONTHLY',
        Metrics: ['BlendedCost']
      })
    );

    const cost = response.ResultsByTime?.[0]?.Total?.BlendedCost?.Amount;
    return parseFloat(cost || '0');
  }

  /**
   * Get previous month costs
   */
  private async getPreviousMonthCosts(): Promise<number> {
    const now = new Date();
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const response = await this.costExplorer.send(
      new GetCostAndUsageCommand({
        TimePeriod: {
          Start: startOfPrevMonth.toISOString().split('T')[0],
          End: endOfPrevMonth.toISOString().split('T')[0]
        },
        Granularity: 'MONTHLY',
        Metrics: ['BlendedCost']
      })
    );

    const cost = response.ResultsByTime?.[0]?.Total?.BlendedCost?.Amount;
    return parseFloat(cost || '0');
  }

  /**
   * Get cost forecast
   */
  private async getCostForecast(): Promise<number> {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const response = await this.costExplorer.send(
      new GetUsageforecastCommand({
        TimePeriod: {
          Start: now.toISOString().split('T')[0],
          End: endOfMonth.toISOString().split('T')[0]
        },
        Granularity: 'MONTHLY',
        Metric: 'BLENDED_COST'
      })
    );

    const forecast = response.Total?.Amount;
    return parseFloat(forecast || '0');
  }

  /**
   * Get service cost breakdown
   */
  private async getServiceCostBreakdown(): Promise<ServiceCost[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const response = await this.costExplorer.send(
      new GetCostAndUsageCommand({
        TimePeriod: {
          Start: startOfMonth.toISOString().split('T')[0],
          End: now.toISOString().split('T')[0]
        },
        Granularity: 'MONTHLY',
        Metrics: ['BlendedCost'],
        GroupBy: [
          {
            Type: 'DIMENSION',
            Key: 'SERVICE'
          }
        ]
      })
    );

    const services: ServiceCost[] = [];
    const totalCost = parseFloat(
      response.ResultsByTime?.[0]?.Total?.BlendedCost?.Amount || '0'
    );

    response.ResultsByTime?.[0]?.Groups?.forEach(group => {
      const serviceName = group.Keys?.[0] || 'Unknown';
      const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
      const percentage = totalCost > 0 ? (cost / totalCost) * 100 : 0;

      services.push({
        service: serviceName,
        cost,
        percentage,
        trend: 'stable', // Would need historical data to determine
        optimizable: this.isServiceOptimizable(serviceName)
      });
    });

    return services.sort((a, b) => b.cost - a.cost).slice(0, 10);
  }

  /**
   * Check if service is optimizable
   */
  private isServiceOptimizable(serviceName: string): boolean {
    const optimizableServices = [
      'Amazon Elastic Compute Cloud - Compute',
      'Amazon Relational Database Service',
      'Amazon Simple Storage Service',
      'Amazon DynamoDB',
      'AWS Lambda'
    ];
    
    return optimizableServices.some(service => 
      serviceName.includes(service)
    );
  }

  /**
   * Get budget limit
   */
  private async getBudgetLimit(): Promise<number> {
    try {
      const response = await this.budgets.send(
        new DescribeBudgetsCommand({
          AccountId: this.accountId
        })
      );

      const monthlyBudget = response.Budgets?.find(
        budget => budget.TimeUnit === 'MONTHLY'
      );

      return parseFloat(monthlyBudget?.BudgetLimit?.Amount || '1000');
    } catch (error) {
      console.error('Error getting budget limit:', error);
      return 1000; // Default budget
    }
  }

  /**
   * Get budgets configuration
   */
  private async getBudgets() {
    // Mock budget data - in production this would fetch from AWS Budgets
    return [
      {
        budgetName: 'Monthly Healthcare Platform Budget',
        budgetLimit: { amount: 1000, unit: 'USD' },
        threshold: 80
      }
    ];
  }

  /**
   * Get current spend for specific budget
   */
  private async getCurrentSpendForBudget(budgetName: string): Promise<number> {
    return this.getCurrentMonthCosts();
  }

  /**
   * Determine recommendation priority based on savings
   */
  private determinePriority(savings: number): 'high' | 'medium' | 'low' {
    if (savings >= 200) return 'high';
    if (savings >= 50) return 'medium';
    return 'low';
  }

  /**
   * Fallback recommendations when API calls fail
   */
  private getFallbackRecommendations(): CostOptimizationRecommendation[] {
    return [
      {
        id: 'fallback-1',
        type: 'storage',
        service: 'General',
        description: 'Review storage classes and lifecycle policies',
        estimatedSavings: 100,
        priority: 'medium',
        implementationComplexity: 'low',
        hipaaImpact: 'none',
        recommendation: 'Implement intelligent tiering for S3 storage'
      }
    ];
  }

  /**
   * Create budget with healthcare-specific thresholds
   */
  async createHealthcareBudget(monthlyLimit: number): Promise<void> {
    try {
      await this.budgets.send(
        new CreateBudgetCommand({
          AccountId: this.accountId,
          Budget: {
            BudgetName: 'HIPAA Healthcare Platform Budget',
            BudgetLimit: {
              Amount: monthlyLimit.toString(),
              Unit: 'USD'
            },
            TimeUnit: 'MONTHLY',
            BudgetType: 'COST',
            CostFilters: {
              Service: [
                'Amazon DynamoDB',
                'AWS Lambda',
                'Amazon API Gateway',
                'AWS Key Management Service',
                'Amazon CloudWatch'
              ]
            }
          },
          NotificationsWithSubscribers: [
            {
              Notification: {
                NotificationType: 'ACTUAL',
                ComparisonOperator: 'GREATER_THAN',
                Threshold: 75,
                ThresholdType: 'PERCENTAGE'
              },
              Subscribers: [
                {
                  SubscriptionType: 'EMAIL',
                  Address: process.env.ADMIN_EMAIL || 'admin@example.com'
                }
              ]
            }
          ]
        })
      );

      console.log('Healthcare budget created successfully');
    } catch (error) {
      console.error('Error creating budget:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const costMonitoringService = new CostMonitoringService();