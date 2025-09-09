/** @jest-environment node */
/**
 * Billing Scrub Service Tests
 * Tests for CMS-1500 compliance checking and data scrubbing
 */

import {
  scrubCharge,
  SCRUB_ERROR_CODES,
  SCRUB_WARNING_CODES,
  validateCPTModifierCombination,
  validateDiagnosisAlignment,
  checkRequiredFields,
  validateBusinessRules,
} from '../scrub';

describe('Billing Scrub Service', () => {
  const validChargeData = {
    id: 'charge_123',
    providerId: 'provider_123',
    patientId: 'patient_123',
    cptCode: '90834',
    modifiers: ['GT'],
    diagnosisCodes: ['F32.9'],
    diagnosisPointers: ['A'],
    units: 1,
    chargeAmount: 150.00,
    posCode: '11',
    renderingProviderNPI: '1234567890',
    billingProviderNPI: '1234567890',
    billingTIN: '12-3456789',
  };

  describe('scrubCharge', () => {
    it('passes valid charge data without errors', () => {
      const result = scrubCharge(validChargeData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('returns comprehensive result structure', () => {
      const result = scrubCharge(validChargeData);
      
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('errorCodes');
      expect(result).toHaveProperty('warningCodes');
    });

    it('identifies missing required fields', () => {
      const incompleteData = {
        ...validChargeData,
        posCode: undefined,
        renderingProviderNPI: undefined,
      };
      
      const result = scrubCharge(incompleteData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing place of service code (required for CMS-1500)');
      expect(result.errors).toContain('Missing rendering provider NPI (required for CMS-1500)');
      expect(result.errorCodes).toContain(SCRUB_ERROR_CODES.E001);
      expect(result.errorCodes).toContain(SCRUB_ERROR_CODES.E002);
    });

    it('validates CPT and modifier combinations', () => {
      const invalidCombination = {
        ...validChargeData,
        cptCode: '90791', // Diagnostic evaluation
        modifiers: ['HO'], // Group therapy modifier
      };
      
      const result = scrubCharge(invalidCombination);
      
      expect(result.warnings).toContain(
        'CPT 90791 typically not used with group therapy modifier HO'
      );
      expect(result.warningCodes).toContain(SCRUB_WARNING_CODES.W003);
    });

    it('checks diagnosis pointer alignment', () => {
      const misalignedData = {
        ...validChargeData,
        diagnosisCodes: ['F32.9', 'F41.1'],
        diagnosisPointers: ['A', 'C'], // Missing B pointer
      };
      
      const result = scrubCharge(misalignedData);
      
      expect(result.warnings).toContain(
        'Diagnosis pointer C used without corresponding diagnosis code'
      );
      expect(result.warningCodes).toContain(SCRUB_WARNING_CODES.W002);
    });

    it('validates business rules for billing', () => {
      const invalidBusinessRule = {
        ...validChargeData,
        units: 5, // Too many units for individual therapy
        cptCode: '90834',
      };
      
      const result = scrubCharge(invalidBusinessRule);
      
      expect(result.warnings).toContain(
        'Unusual number of units (5) for CPT 90834 - verify medical necessity'
      );
      expect(result.warningCodes).toContain(SCRUB_WARNING_CODES.W004);
    });
  });

  describe('checkRequiredFields', () => {
    it('identifies all missing required fields', () => {
      const incompleteData = {
        id: 'charge_123',
        providerId: 'provider_123',
        patientId: 'patient_123',
        cptCode: '90834',
        chargeAmount: 150.00,
        // Missing: posCode, renderingProviderNPI, billingProviderNPI, billingTIN
      };
      
      const result = checkRequiredFields(incompleteData);
      
      expect(result.errors).toContain('Missing place of service code (required for CMS-1500)');
      expect(result.errors).toContain('Missing rendering provider NPI (required for CMS-1500)');
      expect(result.errors).toContain('Missing billing provider NPI (required for CMS-1500)');
      expect(result.errors).toContain('Missing billing TIN (required for CMS-1500)');
    });

    it('passes when all required fields are present', () => {
      const result = checkRequiredFields(validChargeData);
      
      expect(result.errors).toEqual([]);
    });

    it('returns appropriate error codes', () => {
      const incompleteData = {
        ...validChargeData,
        posCode: undefined,
      };
      
      const result = checkRequiredFields(incompleteData);
      
      expect(result.errorCodes).toContain(SCRUB_ERROR_CODES.E001);
    });
  });

  describe('validateCPTModifierCombination', () => {
    it('allows valid CPT and modifier combinations', () => {
      const validCombinations = [
        { cptCode: '90834', modifiers: ['GT'] }, // Individual therapy with telehealth
        { cptCode: '90853', modifiers: ['HO'] }, // Group therapy with group modifier
        { cptCode: '90837', modifiers: ['95'] }, // Extended therapy with telehealth
        { cptCode: '90791', modifiers: [] }, // Diagnostic evaluation without modifiers
      ];
      
      validCombinations.forEach(({ cptCode, modifiers }) => {
        const result = validateCPTModifierCombination(cptCode, modifiers);
        expect(result.warnings).toEqual([]);
      });
    });

    it('warns about questionable combinations', () => {
      const questionableCombinations = [
        { cptCode: '90791', modifiers: ['HO'] }, // Diagnostic eval with group modifier
        { cptCode: '90834', modifiers: ['HK', 'HO'] }, // Individual with both specialized and group
      ];
      
      questionableCombinations.forEach(({ cptCode, modifiers }) => {
        const result = validateCPTModifierCombination(cptCode, modifiers);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warningCodes).toContain(SCRUB_WARNING_CODES.W003);
      });
    });

    it('handles multiple modifiers correctly', () => {
      const result = validateCPTModifierCombination('90834', ['GT', '95']);
      
      // Should warn about duplicate telehealth modifiers
      expect(result.warnings).toContain(
        'Multiple telehealth modifiers (GT, 95) - use only one'
      );
      expect(result.warningCodes).toContain(SCRUB_WARNING_CODES.W003);
    });
  });

  describe('validateDiagnosisAlignment', () => {
    it('passes when diagnosis codes and pointers align', () => {
      const alignedData = {
        diagnosisCodes: ['F32.9', 'F41.1'],
        diagnosisPointers: ['A', 'B'],
      };
      
      const result = validateDiagnosisAlignment(
        alignedData.diagnosisCodes,
        alignedData.diagnosisPointers
      );
      
      expect(result.warnings).toEqual([]);
    });

    it('warns when pointers exceed available diagnoses', () => {
      const misalignedData = {
        diagnosisCodes: ['F32.9'], // Only one diagnosis
        diagnosisPointers: ['A', 'B'], // Two pointers
      };
      
      const result = validateDiagnosisAlignment(
        misalignedData.diagnosisCodes,
        misalignedData.diagnosisPointers
      );
      
      expect(result.warnings).toContain(
        'Diagnosis pointer B used without corresponding diagnosis code'
      );
      expect(result.warningCodes).toContain(SCRUB_WARNING_CODES.W002);
    });

    it('warns when diagnosis codes are unused', () => {
      const unusedDiagnosisData = {
        diagnosisCodes: ['F32.9', 'F41.1', 'F43.10'], // Three diagnoses
        diagnosisPointers: ['A'], // Only one pointer
      };
      
      const result = validateDiagnosisAlignment(
        unusedDiagnosisData.diagnosisCodes,
        unusedDiagnosisData.diagnosisPointers
      );
      
      expect(result.warnings).toContain(
        'Diagnosis codes provided but not referenced by pointers'
      );
      expect(result.warningCodes).toContain(SCRUB_WARNING_CODES.W002);
    });
  });

  describe('validateBusinessRules', () => {
    it('validates unit limits for different CPT codes', () => {
      const testCases = [
        { cptCode: '90834', units: 5, shouldWarn: true }, // Individual therapy - high units
        { cptCode: '90837', units: 3, shouldWarn: true }, // Extended therapy - high units
        { cptCode: '90853', units: 2, shouldWarn: false }, // Group therapy - reasonable units
        { cptCode: '90791', units: 2, shouldWarn: true }, // Diagnostic eval - should be 1
      ];
      
      testCases.forEach(({ cptCode, units, shouldWarn }) => {
        const result = validateBusinessRules({
          ...validChargeData,
          cptCode,
          units,
        });
        
        if (shouldWarn) {
          expect(result.warnings.length).toBeGreaterThan(0);
          expect(result.warningCodes).toContain(SCRUB_WARNING_CODES.W004);
        } else {
          expect(result.warnings).toEqual([]);
        }
      });
    });

    it('validates charge amounts for reasonableness', () => {
      const testCases = [
        { cptCode: '90834', amount: 50, shouldWarn: true }, // Too low
        { cptCode: '90834', amount: 500, shouldWarn: true }, // Too high
        { cptCode: '90834', amount: 150, shouldWarn: false }, // Reasonable
        { cptCode: '90791', amount: 300, shouldWarn: false }, // Reasonable for eval
      ];
      
      testCases.forEach(({ cptCode, amount, shouldWarn }) => {
        const result = validateBusinessRules({
          ...validChargeData,
          cptCode,
          chargeAmount: amount,
        });
        
        if (shouldWarn) {
          expect(result.warnings.some(w => w.includes('charge amount'))).toBe(true);
          expect(result.warningCodes).toContain(SCRUB_WARNING_CODES.W005);
        }
      });
    });

    it('validates place of service codes', () => {
      const validPOSCodes = ['11', '02', '10', '53'];
      const invalidPOSCode = '99';
      
      validPOSCodes.forEach(posCode => {
        const result = validateBusinessRules({
          ...validChargeData,
          posCode,
        });
        
        expect(result.warnings).toEqual([]);
      });
      
      const result = validateBusinessRules({
        ...validChargeData,
        posCode: invalidPOSCode,
      });
      
      expect(result.warnings).toContain(
        'Unusual place of service code (99) - verify code is appropriate'
      );
      expect(result.warningCodes).toContain(SCRUB_WARNING_CODES.W001);
    });

    it('checks for date-related business rules', () => {
      // Test with future date (should warn)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const result = validateBusinessRules({
        ...validChargeData,
        serviceDate: futureDate.toISOString(),
      });
      
      expect(result.warnings).toContain(
        'Service date is in the future - verify date is correct'
      );
      expect(result.warningCodes).toContain(SCRUB_WARNING_CODES.W006);
    });
  });

  describe('Error and Warning Codes', () => {
    it('maps all error types to codes correctly', () => {
      const errorMappings = [
        { field: 'posCode', code: SCRUB_ERROR_CODES.E001 },
        { field: 'renderingProviderNPI', code: SCRUB_ERROR_CODES.E002 },
        { field: 'billingProviderNPI', code: SCRUB_ERROR_CODES.E003 },
        { field: 'billingTIN', code: SCRUB_ERROR_CODES.E004 },
      ];
      
      errorMappings.forEach(({ field, code }) => {
        const incompleteData = { ...validChargeData };
        delete incompleteData[field as keyof typeof incompleteData];
        
        const result = scrubCharge(incompleteData);
        expect(result.errorCodes).toContain(code);
      });
    });

    it('maps all warning types to codes correctly', () => {
      const warningTests = [
        {
          data: { ...validChargeData, posCode: '99' },
          expectedCode: SCRUB_WARNING_CODES.W001,
        },
        {
          data: { 
            ...validChargeData, 
            diagnosisCodes: ['F32.9'], 
            diagnosisPointers: ['A', 'B'] 
          },
          expectedCode: SCRUB_WARNING_CODES.W002,
        },
        {
          data: { ...validChargeData, cptCode: '90791', modifiers: ['HO'] },
          expectedCode: SCRUB_WARNING_CODES.W003,
        },
      ];
      
      warningTests.forEach(({ data, expectedCode }) => {
        const result = scrubCharge(data);
        expect(result.warningCodes).toContain(expectedCode);
      });
    });
  });

  describe('Recommendations', () => {
    it('provides helpful recommendations for improvements', () => {
      const incompleteData = {
        ...validChargeData,
        posCode: undefined,
      };
      
      const result = scrubCharge(incompleteData);
      
      expect(result.recommendations).toContain(
        'Add place of service code to improve claim processing'
      );
    });

    it('suggests diagnosis code improvements', () => {
      const vagueDiagnosis = {
        ...validChargeData,
        diagnosisCodes: ['F32.9'], // Unspecified depression
      };
      
      const result = scrubCharge(vagueDiagnosis);
      
      expect(result.recommendations).toContain(
        'Consider using more specific diagnosis codes when possible'
      );
    });
  });

  describe('Integration with CMS-1500 Requirements', () => {
    it('enforces all CMS-1500 required fields', () => {
      const cms1500RequiredFields = [
        'posCode',
        'renderingProviderNPI',
        'billingProviderNPI', 
        'billingTIN',
      ];
      
      cms1500RequiredFields.forEach(field => {
        const incompleteData = { ...validChargeData };
        delete incompleteData[field as keyof typeof incompleteData];
        
        const result = scrubCharge(incompleteData);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('CMS-1500'))).toBe(true);
      });
    });

    it('validates diagnosis code format for CMS-1500', () => {
      const invalidDiagnosisFormat = {
        ...validChargeData,
        diagnosisCodes: ['F32'], // Too short
      };
      
      const result = scrubCharge(invalidDiagnosisFormat);
      
      expect(result.warnings).toContain(
        'Diagnosis code F32 may need more specific coding for optimal reimbursement'
      );
    });
  });

  describe('Performance and Edge Cases', () => {
    it('handles empty modifier arrays', () => {
      const noModifiers = {
        ...validChargeData,
        modifiers: [],
      };
      
      const result = scrubCharge(noModifiers);
      expect(result.isValid).toBe(true);
    });

    it('handles maximum modifier count', () => {
      const maxModifiers = {
        ...validChargeData,
        modifiers: ['HK', 'GT', 'XE', 'XS'], // 4 modifiers (max allowed)
      };
      
      const result = scrubCharge(maxModifiers);
      expect(result.warnings).toEqual([]);
    });

    it('handles large charge amounts', () => {
      const highAmount = {
        ...validChargeData,
        chargeAmount: 10000.00,
      };
      
      const result = scrubCharge(highAmount);
      expect(result.warnings.some(w => w.includes('charge amount'))).toBe(true);
    });

    it('processes complex charge scenarios', () => {
      const complexCharge = {
        ...validChargeData,
        cptCode: '90837',
        modifiers: ['GT', 'HK'],
        diagnosisCodes: ['F32.9', 'F41.1', 'F43.10'],
        diagnosisPointers: ['A', 'B', 'C'],
        units: 2,
        chargeAmount: 350.00,
      };
      
      const result = scrubCharge(complexCharge);
      
      // Should process without throwing errors
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});