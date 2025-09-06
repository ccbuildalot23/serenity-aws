'use client';

import React, { useState } from 'react';
import { 
  CreditCard,
  FileText,
  Clock,
  DollarSign,
  TrendingUp,
  Calendar,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

// CPT Codes for Mental Health and Chronic Care Management
export const CPT_CODES = {
  // Chronic Care Management
  '99490': { 
    description: 'CCM First 20 min/month', 
    rate: 65,
    category: 'Chronic Care Management',
    requirements: 'Comprehensive care plan, 24/7 access, care coordination'
  },
  '99439': { 
    description: 'CCM Additional 20 min', 
    rate: 50,
    category: 'Chronic Care Management',
    requirements: 'Each additional 20 minutes in calendar month'
  },
  '99487': {
    description: 'Complex CCM 60 min',
    rate: 133,
    category: 'Chronic Care Management',
    requirements: 'Moderate to high complexity medical decision making'
  },
  
  // Behavioral Health Integration
  '99484': { 
    description: 'BHI Initial Assessment', 
    rate: 85,
    category: 'Behavioral Health',
    requirements: 'Initial psychiatric collaborative care management'
  },
  '99492': { 
    description: 'Psych Collab Care Initial', 
    rate: 75,
    category: 'Collaborative Care',
    requirements: 'First 30 minutes in first calendar month'
  },
  '99493': { 
    description: 'Psych Collab Care Subsequent', 
    rate: 60,
    category: 'Collaborative Care',
    requirements: 'First 30 minutes in subsequent months'
  },
  '99494': { 
    description: 'Psych Collab Care Additional', 
    rate: 40,
    category: 'Collaborative Care',
    requirements: 'Each additional 30 minutes'
  },
  
  // Remote Patient Monitoring
  '99453': {
    description: 'RPM Setup & Education',
    rate: 65,
    category: 'Remote Monitoring',
    requirements: 'Initial setup and patient education'
  },
  '99454': {
    description: 'RPM Device Supply',
    rate: 55,
    category: 'Remote Monitoring',
    requirements: '30 days of data, minimum 16 days'
  },
  '99457': {
    description: 'RPM Treatment 20 min',
    rate: 68,
    category: 'Remote Monitoring',
    requirements: 'First 20 minutes of treatment management'
  }
};

interface BillingData {
  code: string;
  count: number;
  revenue: number;
  pendingClaims?: number;
  deniedClaims?: number;
}

interface CPTBillingTrackerProps {
  billingData?: BillingData[];
  monthlyTarget?: number;
  showDetails?: boolean;
}

export default function CPTBillingTracker({ 
  billingData = [
    { code: '99490', count: 142, revenue: 9230, pendingClaims: 12, deniedClaims: 3 },
    { code: '99484', count: 38, revenue: 3230, pendingClaims: 5, deniedClaims: 1 },
    { code: '99492', count: 52, revenue: 3900, pendingClaims: 8, deniedClaims: 2 },
    { code: '99493', count: 87, revenue: 5220, pendingClaims: 10, deniedClaims: 4 },
    { code: '99453', count: 23, revenue: 1495, pendingClaims: 3, deniedClaims: 0 },
    { code: '99457', count: 31, revenue: 2108, pendingClaims: 4, deniedClaims: 1 }
  ],
  monthlyTarget = 30000,
  showDetails = true
}: CPTBillingTrackerProps) {
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showRequirements, setShowRequirements] = useState(false);
  
  // Calculate totals
  const totalRevenue = billingData.reduce((sum, item) => sum + item.revenue, 0);
  const totalClaims = billingData.reduce((sum, item) => sum + item.count, 0);
  const totalPending = billingData.reduce((sum, item) => sum + (item.pendingClaims || 0), 0);
  const totalDenied = billingData.reduce((sum, item) => sum + (item.deniedClaims || 0), 0);
  
  const progressPercentage = Math.min((totalRevenue / monthlyTarget) * 100, 100);
  const approvalRate = ((totalClaims - totalDenied) / totalClaims * 100).toFixed(1);
  
  // Group by category
  const categories = Array.from(new Set(
    Object.values(CPT_CODES).map(code => code.category)
  ));
  
  const filteredData = selectedCategory === 'all' 
    ? billingData 
    : billingData.filter(item => 
        CPT_CODES[item.code as keyof typeof CPT_CODES]?.category === selectedCategory
      );

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="text-purple-600" size={24} />
            CPT Billing Tracker
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Track billable services and revenue by CPT code
          </p>
        </div>
        {showDetails && (
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Download size={20} />
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-green-600">Revenue</span>
            <DollarSign className="text-green-500" size={16} />
          </div>
          <p className="text-xl font-bold text-green-700">
            ${formatCurrency(totalRevenue)}
          </p>
          <p className="text-xs text-green-600 mt-1">
            {progressPercentage.toFixed(0)}% of target
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-blue-600">Claims</span>
            <FileText className="text-blue-500" size={16} />
          </div>
          <p className="text-xl font-bold text-blue-700">{totalClaims}</p>
          <p className="text-xs text-blue-600 mt-1">
            {approvalRate}% approved
          </p>
        </div>

        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-yellow-600">Pending</span>
            <Clock className="text-yellow-500" size={16} />
          </div>
          <p className="text-xl font-bold text-yellow-700">{totalPending}</p>
          <p className="text-xs text-yellow-600 mt-1">
            ${formatCurrency(totalPending * 65)} value
          </p>
        </div>

        <div className="bg-red-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-red-600">Denied</span>
            <AlertCircle className="text-red-500" size={16} />
          </div>
          <p className="text-xl font-bold text-red-700">{totalDenied}</p>
          <p className="text-xs text-red-600 mt-1">
            {((totalDenied / totalClaims) * 100).toFixed(1)}% rate
          </p>
        </div>
      </div>

      {/* Progress to Monthly Target */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Monthly Revenue Target</span>
          <span className="text-sm text-gray-600">
            ${formatCurrency(totalRevenue)} / ${formatCurrency(monthlyTarget)}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Category Filter */}
      {showDetails && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              selectedCategory === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            All Codes
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                'px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                selectedCategory === category
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* CPT Codes List */}
      <div className="space-y-3">
        {filteredData.map((item) => {
          const cptInfo = CPT_CODES[item.code as keyof typeof CPT_CODES];
          const successRate = ((item.count - (item.deniedClaims || 0)) / item.count * 100).toFixed(0);
          
          return (
            <div 
              key={item.code} 
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm bg-white px-2 py-1 rounded">
                    {item.code}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{cptInfo?.description}</p>
                    <p className="text-xs text-gray-500">{cptInfo?.category}</p>
                  </div>
                </div>
                
                {showRequirements && cptInfo?.requirements && (
                  <p className="text-xs text-gray-600 mt-2 ml-14">
                    Requirements: {cptInfo.requirements}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-green-600">${formatCurrency(item.revenue)}</p>
                  <p className="text-xs text-gray-500">{item.count} claims</p>
                </div>
                
                {showDetails && (
                  <div className="flex items-center gap-2">
                    {item.pendingClaims! > 0 && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                        {item.pendingClaims} pending
                      </span>
                    )}
                    {item.deniedClaims! > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                        {item.deniedClaims} denied
                      </span>
                    )}
                    <span className={cn(
                      'px-2 py-1 text-xs rounded-full',
                      Number(successRate) >= 90 
                        ? 'bg-green-100 text-green-700'
                        : Number(successRate) >= 75
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    )}>
                      {successRate}% success
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Requirements Toggle */}
      {showDetails && (
        <button
          onClick={() => setShowRequirements(!showRequirements)}
          className="mt-4 text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
        >
          {showRequirements ? 'Hide' : 'Show'} billing requirements
          <ChevronRight className={cn(
            'transition-transform',
            showRequirements ? 'rotate-90' : ''
          )} size={16} />
        </button>
      )}

      {/* Footer Actions */}
      <div className="mt-6 pt-4 border-t flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-600">Total Billable This Month</p>
          <p className="text-2xl font-bold text-green-600">
            ${formatCurrency(totalRevenue)}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
            Submit Claims
          </button>
          <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
            Export Report
          </button>
        </div>
      </div>

      {/* Tip */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> Ensure all patient interactions are documented to maximize 
          billable services. CCM codes (99490, 99439) can add $115+ per patient monthly.
        </p>
      </div>
    </div>
  );
}