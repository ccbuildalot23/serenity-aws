'use client';

import React, { useState } from 'react';
import { 
  Calculator,
  DollarSign,
  Users,
  TrendingUp,
  CheckCircle,
  XCircle,
  Info,
  Award,
  Target,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PRICING_TIERS = {
  professional: {
    name: 'Professional',
    monthly: 299,
    patients: 50,
    features: [
      'Up to 50 patients',
      'Basic assessments (PHQ-9, GAD-7)',
      'Daily check-ins',
      'Crisis support',
      'Basic analytics',
      'Email support'
    ],
    notIncluded: [
      'Advanced AI features',
      'Custom integrations',
      'Priority support',
      'FHIR exports'
    ],
    color: 'blue'
  },
  practice: {
    name: 'Practice',
    monthly: 799,
    patients: 200,
    features: [
      'Up to 200 patients',
      'All assessments (PHQ-9, GAD-7, AUDIT)',
      'Advanced analytics',
      'CPT billing integration',
      'Dual AI chat',
      'Priority support',
      'FHIR exports',
      'Custom branding'
    ],
    notIncluded: [
      'Custom integrations',
      'Dedicated success manager',
      'SLA guarantees'
    ],
    color: 'purple'
  },
  enterprise: {
    name: 'Enterprise',
    monthly: 2499,
    patients: 'Unlimited',
    features: [
      'Unlimited patients',
      'All features included',
      'Custom integrations',
      'Dedicated success manager',
      'SLA guarantees',
      'Custom AI training',
      'White-label options',
      'API access',
      'Advanced security features',
      'BAA included'
    ],
    notIncluded: [],
    color: 'green'
  }
};

export default function PricingSimulator() {
  const [selectedTier, setSelectedTier] = useState<keyof typeof PRICING_TIERS>('practice');
  const [patientCount, setPatientCount] = useState<number>(50);
  const [revenuePerPatient, setRevenuePerPatient] = useState<number>(265);
  const [collectionRate, setCollectionRate] = useState<number>(82);
  const [showComparison, setShowComparison] = useState<boolean>(false);

  // Calculate ROI
  const monthlyRevenue = patientCount * revenuePerPatient * (collectionRate / 100);
  const platformCost = PRICING_TIERS[selectedTier].monthly;
  const netProfit = monthlyRevenue - platformCost;
  const roi = ((netProfit / platformCost) * 100).toFixed(0);
  const breakEvenPatients = Math.ceil(platformCost / (revenuePerPatient * (collectionRate / 100)));
  const annualSavings = patientCount * 4500; // $4.5k per retained patient

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pricing & ROI Simulator</h1>
        <p className="text-gray-600">
          Calculate your return on investment and choose the right plan
        </p>
      </div>

      {/* Key Value Proposition */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              🎯 Break-even with just {breakEvenPatients} patients!
            </h2>
            <p className="text-purple-100">
              Each retained patient saves you $4,500-$9,000 annually in turnover costs
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold">{roi}%</div>
            <div className="text-sm text-purple-200">ROI</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Pricing Tiers */}
        <div className="lg:col-span-2">
          <h3 className="text-lg font-bold mb-4">Choose Your Plan</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {Object.entries(PRICING_TIERS).map(([key, tier]) => (
              <div
                key={key}
                onClick={() => setSelectedTier(key as keyof typeof PRICING_TIERS)}
                className={cn(
                  'relative bg-white rounded-xl p-6 cursor-pointer transition-all',
                  selectedTier === key
                    ? 'ring-2 ring-purple-600 shadow-xl'
                    : 'shadow-lg hover:shadow-xl'
                )}
              >
                {key === 'practice' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="text-center mb-4">
                  <h4 className="text-xl font-bold mb-1">{tier.name}</h4>
                  <div className="text-3xl font-bold text-gray-900">
                    ${tier.monthly}
                    <span className="text-sm text-gray-500 font-normal">/mo</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {tier.patients} {typeof tier.patients === 'number' ? 'patients' : ''}
                  </p>
                </div>

                <div className="space-y-2 mb-4">
                  {tier.features.slice(0, 5).map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle className="text-green-500 mt-0.5" size={16} />
                      <span className="text-xs text-gray-700">{feature}</span>
                    </div>
                  ))}
                  {tier.features.length > 5 && (
                    <p className="text-xs text-gray-500 ml-6">
                      +{tier.features.length - 5} more features
                    </p>
                  )}
                </div>

                {selectedTier === key && (
                  <div className="absolute inset-x-0 bottom-0 bg-purple-600 text-white text-center py-2 rounded-b-xl">
                    <span className="text-sm font-medium">Selected</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ROI Calculator */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Calculator className="text-purple-600" size={20} />
            ROI Calculator
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Patients
              </label>
              <input
                type="number"
                value={patientCount}
                onChange={(e) => setPatientCount(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Revenue per Patient ($/mo)
              </label>
              <input
                type="number"
                value={revenuePerPatient}
                onChange={(e) => setRevenuePerPatient(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Collection Rate (%)
              </label>
              <input
                type="number"
                value={collectionRate}
                onChange={(e) => setCollectionRate(Number(e.target.value))}
                min="0"
                max="100"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="pt-4 border-t">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Monthly Revenue</span>
                  <span className="font-bold">${monthlyRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Platform Cost</span>
                  <span className="font-bold text-red-600">-${platformCost}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Net Profit</span>
                  <span className={cn(
                    'text-xl font-bold',
                    netProfit > 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    ${netProfit.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Analysis */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-600" size={20} />
            Financial Projections
          </h3>

          <div className="space-y-3">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-green-900">Annual Revenue</span>
                <span className="text-xl font-bold text-green-600">
                  ${(monthlyRevenue * 12).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-green-700">
                Based on {patientCount} patients at ${revenuePerPatient}/mo
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-purple-900">Patient Retention Value</span>
                <span className="text-xl font-bold text-purple-600">
                  ${annualSavings.toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-purple-700">
                Preventing turnover saves $4,500 per patient annually
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-blue-900">Total Annual Value</span>
                <span className="text-xl font-bold text-blue-600">
                  ${((monthlyRevenue * 12) + annualSavings).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-blue-700">
                Revenue + retention savings
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Target className="text-purple-600" size={20} />
            Break-Even Analysis
          </h3>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Patients needed to break even</span>
              <span className="text-2xl font-bold text-purple-600">{breakEvenPatients}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full"
                style={{ width: `${Math.min((breakEvenPatients / patientCount) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              You have {patientCount} patients ({((patientCount / breakEvenPatients) * 100).toFixed(0)}% of break-even)
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Zap className="text-yellow-500 mt-0.5" size={16} />
              <div>
                <p className="text-sm font-medium">Quick Win</p>
                <p className="text-xs text-gray-600">
                  Add {Math.max(0, breakEvenPatients - patientCount)} more patients to break even
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Award className="text-green-500 mt-0.5" size={16} />
              <div>
                <p className="text-sm font-medium">Growth Potential</p>
                <p className="text-xs text-gray-600">
                  At 50 patients: ${(50 * revenuePerPatient * (collectionRate / 100) - platformCost).toLocaleString()}/mo profit
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Comparison */}
      <button
        onClick={() => setShowComparison(!showComparison)}
        className="mb-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        {showComparison ? 'Hide' : 'Show'} Detailed Feature Comparison
      </button>

      {showComparison && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold mb-4">Feature Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Feature</th>
                  <th className="text-center py-2">Professional</th>
                  <th className="text-center py-2">Practice</th>
                  <th className="text-center py-2">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  'Patient Assessments',
                  'Daily Check-ins',
                  'Crisis Support',
                  'CPT Billing',
                  'Dual AI Chat',
                  'Advanced Analytics',
                  'FHIR Exports',
                  'Custom Integrations',
                  'Dedicated Support',
                  'SLA Guarantees'
                ].map((feature) => (
                  <tr key={feature} className="border-b">
                    <td className="py-2">{feature}</td>
                    <td className="text-center py-2">
                      {['Patient Assessments', 'Daily Check-ins', 'Crisis Support'].includes(feature) ? (
                        <CheckCircle className="inline text-green-500" size={20} />
                      ) : (
                        <XCircle className="inline text-gray-300" size={20} />
                      )}
                    </td>
                    <td className="text-center py-2">
                      {['Custom Integrations', 'Dedicated Support', 'SLA Guarantees'].includes(feature) ? (
                        <XCircle className="inline text-gray-300" size={20} />
                      ) : (
                        <CheckCircle className="inline text-green-500" size={20} />
                      )}
                    </td>
                    <td className="text-center py-2">
                      <CheckCircle className="inline text-green-500" size={20} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Call to Action */}
      <div className="mt-8 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 text-center">
        <h3 className="text-xl font-bold mb-2">Ready to Transform Your Practice?</h3>
        <p className="text-gray-600 mb-4">
          Start with {breakEvenPatients} patients and see immediate ROI. Scale up as you grow.
        </p>
        <button className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors font-medium">
          Start Free Trial - No Credit Card Required
        </button>
      </div>
    </div>
  );
}