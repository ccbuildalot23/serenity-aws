# Phase 2 SurveyJS Integration Research

## Executive Summary
This document provides research findings and implementation guidance for integrating SurveyJS with Next.js, TypeScript, and Zustand for mental health assessments (GAD-7, AUDIT) and healthcare provider dashboards with ROI metrics.

## 1. SurveyJS Integration with Next.js/React/TypeScript

### Key Findings

#### Installation & Setup
SurveyJS comprises two packages for React:
- `survey-core`: Platform-agnostic code
- `survey-react-ui`: React rendering components

```bash
npm install survey-core survey-react-ui
```

#### TypeScript Integration Pattern
```typescript
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/defaultV2.min.css';

// Avoid "Model does not exist" errors in TypeScript
import * as SurveyCore from 'survey-core';
```

#### Next.js SSR Considerations
Since SurveyJS uses client-side functions (like StylesManager), use dynamic imports:

```typescript
import dynamic from 'next/dynamic';

const SurveyComponent = dynamic(
  () => import('../components/SurveyComponent'),
  { ssr: false }
);
```

### Implementation Example for Mental Health Assessments

```typescript
// components/surveys/SurveyWrapper.tsx
import React, { useCallback } from 'react';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import { useStore } from '@/store/useStore';
import { apiClient } from '@/lib/api-client';

interface SurveyWrapperProps {
  schema: object;
  onComplete: (results: any) => void;
  scoringAlgorithm: (answers: any) => number;
  assessmentType: 'GAD-7' | 'AUDIT' | 'PHQ-9';
}

export const SurveyWrapper: React.FC<SurveyWrapperProps> = ({
  schema,
  onComplete,
  scoringAlgorithm,
  assessmentType
}) => {
  const survey = new Model(schema);
  const { user } = useStore();

  const handleComplete = useCallback(async (sender: any) => {
    const results = sender.data;
    const score = scoringAlgorithm(results);
    
    // Client-side processing for privacy
    const assessmentData = {
      type: assessmentType,
      score,
      completedAt: new Date().toISOString(),
      userId: user?.id
    };

    // Send only score, not individual answers (HIPAA compliance)
    await apiClient.submitAssessment(assessmentData);
    onComplete({ score, results });
  }, [scoringAlgorithm, assessmentType, user, onComplete]);

  survey.onComplete.add(handleComplete);

  return <Survey model={survey} />;
};
```

## 2. GAD-7 Implementation with SurveyJS

### JSON Schema Configuration
```json
{
  "title": "GAD-7 Anxiety Assessment",
  "description": "Over the last 2 weeks, how often have you been bothered by the following problems?",
  "pages": [{
    "name": "page1",
    "elements": [{
      "type": "matrix",
      "name": "gad7_questions",
      "title": "Please select the appropriate response",
      "columns": [
        { "value": 0, "text": "Not at all" },
        { "value": 1, "text": "Several days" },
        { "value": 2, "text": "More than half the days" },
        { "value": 3, "text": "Nearly every day" }
      ],
      "rows": [
        { "value": "q1", "text": "Feeling nervous, anxious, or on edge" },
        { "value": "q2", "text": "Not being able to stop or control worrying" },
        { "value": "q3", "text": "Worrying too much about different things" },
        { "value": "q4", "text": "Trouble relaxing" },
        { "value": "q5", "text": "Being so restless that it is hard to sit still" },
        { "value": "q6", "text": "Becoming easily annoyed or irritable" },
        { "value": "q7", "text": "Feeling afraid, as if something awful might happen" }
      ],
      "isRequired": true
    }]
  }],
  "showProgressBar": "top",
  "progressBarType": "questions"
}
```

### Scoring Algorithm (0-21 scale)
```typescript
const calculateGAD7Score = (answers: any): number => {
  const questions = answers.gad7_questions;
  if (!questions) return 0;
  
  return Object.values(questions).reduce((sum: number, val: any) => 
    sum + (typeof val === 'number' ? val : 0), 0
  );
};

const interpretGAD7Score = (score: number): string => {
  if (score >= 15) return 'Severe anxiety';
  if (score >= 10) return 'Moderate anxiety';
  if (score >= 5) return 'Mild anxiety';
  return 'Minimal anxiety';
};
```

## 3. AUDIT Implementation with SurveyJS

### JSON Schema Configuration
```json
{
  "title": "AUDIT - Alcohol Use Disorders Identification Test",
  "pages": [{
    "name": "consumption",
    "elements": [
      {
        "type": "radiogroup",
        "name": "q1",
        "title": "How often do you have a drink containing alcohol?",
        "choices": [
          { "value": 0, "text": "Never" },
          { "value": 1, "text": "Monthly or less" },
          { "value": 2, "text": "2-4 times a month" },
          { "value": 3, "text": "2-3 times a week" },
          { "value": 4, "text": "4 or more times a week" }
        ],
        "isRequired": true
      }
    ]
  }],
  "showProgressBar": "bottom"
}
```

### Scoring Algorithm (0-40 scale)
```typescript
const calculateAUDITScore = (answers: any): number => {
  let score = 0;
  for (let i = 1; i <= 10; i++) {
    const answer = answers[`q${i}`];
    score += typeof answer === 'number' ? answer : 0;
  }
  return score;
};

const interpretAUDITScore = (score: number): {
  riskLevel: string;
  recommendation: string;
} => {
  if (score >= 20) {
    return {
      riskLevel: 'Possible dependence',
      recommendation: 'Further diagnostic evaluation recommended'
    };
  }
  if (score >= 16) {
    return {
      riskLevel: 'High risk',
      recommendation: 'Counseling and continued monitoring'
    };
  }
  if (score >= 8) {
    return {
      riskLevel: 'Increased risk',
      recommendation: 'Simple advice on reduction of hazardous drinking'
    };
  }
  return {
    riskLevel: 'Low risk',
    recommendation: 'Continue current habits and monitor'
  };
};
```

## 4. Healthcare Provider Dashboard Patterns

### React Component Architecture
```typescript
// components/provider/ProviderDashboard.tsx
import React from 'react';
import { Chart } from 'react-chartjs-2';
import { useQuery } from '@tanstack/react-query';

const ProviderDashboard: React.FC = () => {
  const { data: metrics } = useQuery({
    queryKey: ['provider-metrics'],
    queryFn: fetchProviderMetrics
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <ROIMetricsCard metrics={metrics?.roi} />
      <CPTBillingCard codes={metrics?.cptCodes} />
      <PatientTrendsChart data={metrics?.trends} />
      <RevenuePerPatientCard revenue={metrics?.revenuePerPatient} />
    </div>
  );
};
```

### ROI Metrics Visualization
```typescript
const ROIMetricsCard: React.FC<{ metrics: any }> = ({ metrics }) => {
  // Key metrics from research:
  // - Patient retention value: $4,500-$9,000 annually
  // - Break-even: 3 patients covers Professional tier ($299/mo)
  // - Average days to bill: Track efficiency
  // - Collectability percentage: Revenue realization

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">ROI Metrics</h3>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span>Patient Retention Value</span>
          <span className="font-bold text-green-600">
            ${metrics?.retentionValue || '4,500'}/year
          </span>
        </div>
        <div className="flex justify-between">
          <span>Break-even Point</span>
          <span className="font-bold">3 patients</span>
        </div>
        <div className="flex justify-between">
          <span>Monthly Revenue</span>
          <span className="font-bold">${metrics?.monthlyRevenue}</span>
        </div>
      </div>
    </div>
  );
};
```

### CPT Billing Integration
```typescript
const CPT_CODES = {
  '99490': { description: 'CCM First 20 min', rate: 65 },
  '99439': { description: 'CCM Additional 20 min', rate: 50 },
  '99484': { description: 'BHI Initial', rate: 85 },
  '99492': { description: 'Psych Collaborative Care Initial', rate: 75 },
  '99493': { description: 'Psych Collaborative Care Subsequent', rate: 60 },
  '99494': { description: 'Psych Collaborative Care Additional', rate: 40 }
};

const CPTBillingCard: React.FC<{ codes: any[] }> = ({ codes }) => {
  const totalRevenue = codes?.reduce((sum, code) => 
    sum + (CPT_CODES[code.code]?.rate * code.count || 0), 0
  );

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">CPT Billing Codes</h3>
      <div className="space-y-2">
        {Object.entries(CPT_CODES).map(([code, info]) => (
          <div key={code} className="flex justify-between text-sm">
            <span>{code}: {info.description}</span>
            <span>${info.rate}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between font-bold">
          <span>Total Monthly Revenue</span>
          <span className="text-green-600">${totalRevenue}</span>
        </div>
      </div>
    </div>
  );
};
```

## 5. Integration with Zustand State Management

```typescript
// store/assessmentStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AssessmentState {
  assessments: Array<{
    type: string;
    score: number;
    completedAt: string;
  }>;
  addAssessment: (assessment: any) => void;
  getLatestScore: (type: string) => number | null;
  getTrend: (type: string) => 'improving' | 'stable' | 'declining';
}

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set, get) => ({
      assessments: [],
      
      addAssessment: (assessment) => 
        set((state) => ({
          assessments: [...state.assessments, assessment]
        })),
      
      getLatestScore: (type) => {
        const assessments = get().assessments
          .filter(a => a.type === type)
          .sort((a, b) => new Date(b.completedAt).getTime() - 
                         new Date(a.completedAt).getTime());
        return assessments[0]?.score || null;
      },
      
      getTrend: (type) => {
        const scores = get().assessments
          .filter(a => a.type === type)
          .map(a => a.score);
        
        if (scores.length < 2) return 'stable';
        
        const recent = scores.slice(0, 3);
        const older = scores.slice(3, 6);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        
        if (recentAvg < olderAvg - 2) return 'improving';
        if (recentAvg > olderAvg + 2) return 'declining';
        return 'stable';
      }
    }),
    {
      name: 'assessment-storage'
    }
  )
);
```

## 6. Key Implementation Considerations

### HIPAA Compliance
1. **Client-side scoring**: Calculate scores locally, only send results
2. **No PHI in logs**: Ensure individual responses aren't logged
3. **Encryption**: Use AES-256 for stored data, TLS 1.2+ for transit
4. **Audit logging**: Track who accessed assessment data and when

### Performance Optimization
1. **Dynamic imports**: Use Next.js dynamic imports for SurveyJS
2. **Code splitting**: Separate assessment bundles
3. **Lazy loading**: Load assessments on demand
4. **Caching**: Cache assessment schemas locally

### Error Handling
```typescript
const submitAssessment = async (data: any) => {
  try {
    await apiClient.submitAssessment(data);
  } catch (error) {
    // Fallback to local storage
    const localAssessments = localStorage.getItem('pending_assessments');
    const pending = localAssessments ? JSON.parse(localAssessments) : [];
    pending.push(data);
    localStorage.setItem('pending_assessments', JSON.stringify(pending));
    
    // Retry later
    setTimeout(() => retryPendingAssessments(), 30000);
  }
};
```

## 7. Testing Strategy

### Unit Tests
```typescript
// __tests__/assessments/gad7.test.ts
describe('GAD-7 Scoring', () => {
  it('should calculate score correctly', () => {
    const answers = {
      gad7_questions: { q1: 2, q2: 3, q3: 1, q4: 2, q5: 1, q6: 2, q7: 3 }
    };
    expect(calculateGAD7Score(answers)).toBe(14); // Moderate anxiety
  });
  
  it('should handle missing answers', () => {
    const answers = { gad7_questions: { q1: 2, q3: 1 } };
    expect(calculateGAD7Score(answers)).toBe(3);
  });
});
```

## References

1. **SurveyJS Documentation**: https://surveyjs.io/form-library/documentation/get-started-react
2. **Healthcare Dashboard Patterns**: https://www.gooddata.com/blog/healthcare-dashboards-examples-use-cases-and-benefits/
3. **React Healthcare Implementation**: https://github.com/pavanironanki/Healthcare-Dashboard
4. **CPT Billing Codes**: https://telehealth.hhs.gov/providers/best-practice-guides/telehealth-and-remote-patient-monitoring/billing-remote-patient
5. **HIPAA Compliance**: https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html

## Next Steps

1. Install SurveyJS packages and configure for Next.js
2. Create GAD-7 and AUDIT JSON schemas
3. Implement scoring algorithms with crisis detection
4. Build provider dashboard components
5. Add comprehensive Jest tests
6. Document clinical validation process

---
*Research compiled: December 2024*
*Author: Serenity Development Team*