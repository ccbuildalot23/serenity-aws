/**
 * Billing Validation Service Tests
 * Tests for Zod schemas and validation functions
 */

import {
  validateChargeCreate,
  validateChargeUpdate,
  validateExportRequest,
  cptCodeSchema,
  modifierSchema,
  diagnosisPointerSchema,
  npiSchema,
  tinSchema,
  APPROVED_CPT_CODES,
} from '../validation';

describe('Billing Validation', () => {
  describe('CPT Code Validation', () => {
    it('accepts valid CPT codes', () => {
      APPROVED_CPT_CODES.forEach(code => {
        expect(() => cptCodeSchema.parse(code)).not.toThrow();
      });
    });

    it('rejects invalid CPT codes', () => {
      const invalidCodes = ['12345', '99999', '', '90834X', 'invalid'];
      
      invalidCodes.forEach(code => {
        expect(() => cptCodeSchema.parse(code)).toThrow();
      });
    });

    it('provides helpful error message for invalid CPT codes', () => {
      try {
        cptCodeSchema.parse('99999');
      } catch (error: any) {
        expect(error.issues[0].message).toBe('CPT code must be one of: 90791, 90834, 90837, 90853');
      }
    });
  });

  describe('Modifier Validation', () => {
    it('accepts valid modifiers', () => {
      const validModifiers = ['HK', 'HO', 'GT', '95'];
      expect(() => modifierSchema.parse(validModifiers)).not.toThrow();
    });

    it('accepts empty modifier array', () => {
      expect(() => modifierSchema.parse([])).not.toThrow();
    });

    it('rejects invalid modifiers', () => {
      const invalidModifiers = ['XX', 'INVALID', '123'];
      
      invalidModifiers.forEach(modifier => {
        expect(() => modifierSchema.parse([modifier])).toThrow();
      });
    });

    it('limits modifiers to maximum of 4', () => {
      const tooManyModifiers = ['HK', 'HO', 'GT', '95', 'XE'];
      
      expect(() => modifierSchema.parse(tooManyModifiers)).toThrow();
    });

    it('allows up to 4 valid modifiers', () => {
      const fourModifiers = ['HK', 'HO', 'GT', '95'];
      
      expect(() => modifierSchema.parse(fourModifiers)).not.toThrow();
    });
  });

  describe('Diagnosis Pointer Validation', () => {
    it('accepts valid diagnosis pointers', () => {
      const validPointers = ['A', 'B', 'C', 'D'];
      
      validPointers.forEach(pointer => {
        expect(() => diagnosisPointerSchema.parse([pointer])).not.toThrow();
      });
    });

    it('accepts multiple valid pointers', () => {
      expect(() => diagnosisPointerSchema.parse(['A', 'B'])).not.toThrow();
      expect(() => diagnosisPointerSchema.parse(['A', 'B', 'C', 'D'])).not.toThrow();
    });

    it('rejects invalid diagnosis pointers', () => {
      const invalidPointers = ['E', 'X', '1', 'AA'];
      
      invalidPointers.forEach(pointer => {
        expect(() => diagnosisPointerSchema.parse([pointer])).toThrow();
      });
    });

    it('limits diagnosis pointers to maximum of 4', () => {
      const tooManyPointers = ['A', 'B', 'C', 'D', 'A']; // 5 pointers
      
      expect(() => diagnosisPointerSchema.parse(tooManyPointers)).toThrow();
    });
  });

  describe('NPI Validation', () => {
    it('accepts valid 10-digit NPI', () => {
      const validNPIs = ['1234567890', '9876543210'];
      
      validNPIs.forEach(npi => {
        expect(() => npiSchema.parse(npi)).not.toThrow();
      });
    });

    it('accepts undefined NPI', () => {
      expect(() => npiSchema.parse(undefined)).not.toThrow();
    });

    it('rejects invalid NPI formats', () => {
      const invalidNPIs = ['123456789', '12345678901', 'abcdefghij', '123-456-789'];
      
      invalidNPIs.forEach(npi => {
        expect(() => npiSchema.parse(npi)).toThrow();
      });
    });

    it('provides helpful error message for invalid NPI', () => {
      try {
        npiSchema.parse('123456789');
      } catch (error: any) {
        expect(error.issues[0].message).toBe('NPI must be exactly 10 digits');
      }
    });
  });

  describe('TIN Validation', () => {
    it('accepts valid TIN format', () => {
      const validTINs = ['12-3456789', '99-8765432'];
      
      validTINs.forEach(tin => {
        expect(() => tinSchema.parse(tin)).not.toThrow();
      });
    });

    it('accepts undefined TIN', () => {
      expect(() => tinSchema.parse(undefined)).not.toThrow();
    });

    it('rejects invalid TIN formats', () => {
      const invalidTINs = ['123456789', '12-345678', '12-34567890', 'XX-XXXXXXX'];
      
      invalidTINs.forEach(tin => {
        expect(() => tinSchema.parse(tin)).toThrow();
      });
    });

    it('provides helpful error message for invalid TIN', () => {
      try {
        tinSchema.parse('123456789');
      } catch (error: any) {
        expect(error.issues[0].message).toBe('TIN must be in format XX-XXXXXXX');
      }
    });
  });

  describe('Charge Create Validation', () => {
    const validChargeData = {
      providerId: 'provider_123',
      patientId: 'patient_123',
      cptCode: '90834',
      modifiers: ['GT'],
      diagnosisCodes: ['F32.9'],
      diagnosisPointers: ['A'],
      units: 1,
      chargeAmount: 150.00,
      posCode: '11',
    };

    it('validates complete charge data', () => {
      expect(() => validateChargeCreate(validChargeData)).not.toThrow();
    });

    it('requires provider ID', () => {
      const invalidData = { ...validChargeData };
      delete invalidData.providerId;
      
      expect(() => validateChargeCreate(invalidData)).toThrow();
    });

    it('requires patient ID', () => {
      const invalidData = { ...validChargeData };
      delete invalidData.patientId;
      
      expect(() => validateChargeCreate(invalidData)).toThrow();
    });

    it('requires valid CPT code', () => {
      const invalidData = { ...validChargeData, cptCode: '99999' };
      
      expect(() => validateChargeCreate(invalidData)).toThrow();
    });

    it('requires positive charge amount', () => {
      const invalidData = { ...validChargeData, chargeAmount: 0 };
      
      expect(() => validateChargeCreate(invalidData)).toThrow();
    });

    it('requires units to be at least 1', () => {
      const invalidData = { ...validChargeData, units: 0 };
      
      expect(() => validateChargeCreate(invalidData)).toThrow();
    });

    it('limits units to maximum of 99', () => {
      const invalidData = { ...validChargeData, units: 100 };
      
      expect(() => validateChargeCreate(invalidData)).toThrow();
    });

    it('validates optional fields when provided', () => {
      const dataWithOptionals = {
        ...validChargeData,
        renderingProviderNPI: '1234567890',
        billingProviderNPI: '9876543210',
        billingTIN: '12-3456789',
      };
      
      expect(() => validateChargeCreate(dataWithOptionals)).not.toThrow();
    });

    it('rejects invalid optional field formats', () => {
      const invalidData = {
        ...validChargeData,
        renderingProviderNPI: '123456789', // Too short
      };
      
      expect(() => validateChargeCreate(invalidData)).toThrow();
    });

    it('validates CUID format for IDs', () => {
      const invalidData = { ...validChargeData, providerId: 'invalid_id' };
      
      expect(() => validateChargeCreate(invalidData)).toThrow();
    });

    it('handles diagnosis codes validation', () => {
      // Test with valid diagnosis codes
      const validData = { ...validChargeData, diagnosisCodes: ['F32.9', 'F41.1'] };
      expect(() => validateChargeCreate(validData)).not.toThrow();
      
      // Test with too many diagnosis codes
      const tooManyDiagnoses = {
        ...validChargeData,
        diagnosisCodes: ['F32.9', 'F41.1', 'F43.10', 'F10.20', 'F11.20'] // 5 codes
      };
      expect(() => validateChargeCreate(tooManyDiagnoses)).toThrow();
    });
  });

  describe('Charge Update Validation', () => {
    const validUpdateData = {
      id: 'charge_123',
      providerId: 'provider_123',
      cptCode: '90837',
      units: 2,
      chargeAmount: 300.00,
    };

    it('validates partial update data', () => {
      expect(() => validateChargeUpdate(validUpdateData)).not.toThrow();
    });

    it('requires charge ID', () => {
      const invalidData = { ...validUpdateData };
      delete invalidData.id;
      
      expect(() => validateChargeUpdate(invalidData)).toThrow();
    });

    it('requires provider ID', () => {
      const invalidData = { ...validUpdateData };
      delete invalidData.providerId;
      
      expect(() => validateChargeUpdate(invalidData)).toThrow();
    });

    it('validates updated fields when provided', () => {
      const partialUpdate = {
        id: 'charge_123',
        providerId: 'provider_123',
        chargeAmount: 200.00,
      };
      
      expect(() => validateChargeUpdate(partialUpdate)).not.toThrow();
    });

    it('prevents updating to invalid values', () => {
      const invalidUpdate = {
        ...validUpdateData,
        chargeAmount: -50.00, // Negative amount
      };
      
      expect(() => validateChargeUpdate(invalidUpdate)).toThrow();
    });
  });

  describe('Export Request Validation', () => {
    const validExportRequest = {
      format: 'csv',
      providerId: 'provider_123',
      dateRange: {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      filters: {
        status: ['SUBMITTED', 'PAID'],
        cptCodes: ['90834', '90837'],
      },
      includePatientNames: false,
    };

    it('validates complete export request', () => {
      expect(() => validateExportRequest(validExportRequest)).not.toThrow();
    });

    it('requires valid format', () => {
      const invalidRequest = { ...validExportRequest, format: 'pdf' };
      
      expect(() => validateExportRequest(invalidRequest)).toThrow();
    });

    it('accepts csv and json formats', () => {
      expect(() => validateExportRequest({ ...validExportRequest, format: 'csv' })).not.toThrow();
      expect(() => validateExportRequest({ ...validExportRequest, format: 'json' })).not.toThrow();
    });

    it('requires provider ID', () => {
      const invalidRequest = { ...validExportRequest };
      delete invalidRequest.providerId;
      
      expect(() => validateExportRequest(invalidRequest)).toThrow();
    });

    it('validates date range when provided', () => {
      // Valid date range
      const validDates = {
        ...validExportRequest,
        dateRange: {
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z',
        },
      };
      expect(() => validateExportRequest(validDates)).not.toThrow();
    });

    it('validates filter status values', () => {
      const validStatuses = {
        ...validExportRequest,
        filters: {
          ...validExportRequest.filters,
          status: ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'PAID'],
        },
      };
      expect(() => validateExportRequest(validStatuses)).not.toThrow();
      
      const invalidStatus = {
        ...validExportRequest,
        filters: {
          ...validExportRequest.filters,
          status: ['INVALID_STATUS'],
        },
      };
      expect(() => validateExportRequest(invalidStatus)).toThrow();
    });

    it('validates filter CPT codes', () => {
      const validCPT = {
        ...validExportRequest,
        filters: {
          ...validExportRequest.filters,
          cptCodes: ['90791', '90834', '90837', '90853'],
        },
      };
      expect(() => validateExportRequest(validCPT)).not.toThrow();
      
      const invalidCPT = {
        ...validExportRequest,
        filters: {
          ...validExportRequest.filters,
          cptCodes: ['99999'],
        },
      };
      expect(() => validateExportRequest(invalidCPT)).toThrow();
    });

    it('handles optional fields correctly', () => {
      const minimalRequest = {
        format: 'csv',
        providerId: 'provider_123',
      };
      
      expect(() => validateExportRequest(minimalRequest)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('provides detailed validation errors', () => {
      try {
        validateChargeCreate({
          providerId: 'invalid',
          patientId: '',
          cptCode: '99999',
          chargeAmount: -100,
          units: 0,
        });
      } catch (error: any) {
        expect(error.issues).toBeDefined();
        expect(Array.isArray(error.issues)).toBe(true);
        expect(error.issues.length).toBeGreaterThan(0);
      }
    });

    it('handles nested validation errors', () => {
      try {
        validateExportRequest({
          format: 'invalid',
          providerId: 'provider_123',
          filters: {
            status: ['INVALID_STATUS'],
            cptCodes: ['99999'],
          },
        });
      } catch (error: any) {
        expect(error.issues).toBeDefined();
        expect(error.issues.some((err: any) => err.message.includes('format'))).toBe(true);
        expect(error.issues.some((err: any) => err.message.includes('status'))).toBe(true);
      }
    });

    it('preserves original error context', () => {
      try {
        validateChargeCreate({ invalid: 'data' });
      } catch (error: any) {
        expect(error.name).toBe('ZodError');
        expect(error.issues).toBeDefined();
      }
    });
  });
});