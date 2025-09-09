/**
 * Superbill Service
 * Business logic for generating CMS-1500 superbills from charge data
 */

import { CMS1500Generator } from './cms1500-generator';

interface SuperbillGenerationOptions {
  chargeId: string;
  includePatientName?: boolean;
  format?: 'pdf' | 'json';
}

interface SuperbillResult {
  success: boolean;
  data?: {
    filename: string;
    downloadUrl?: string;
    buffer?: Buffer;
    metadata: {
      chargeId: string;
      patientInitials: string;
      providerId: string;
      totalAmount: number;
      generatedAt: string;
    };
  };
  errors?: string[];
  warnings?: string[];
}

export class SuperbillService {
  
  /**
   * Generate superbill PDF from charge ID
   */
  static async generateSuperbill(options: SuperbillGenerationOptions): Promise<SuperbillResult> {
    try {
      const { chargeId, includePatientName = false } = options;
      
      // In production, this would fetch from database:
      // const charge = await prisma.charge.findUnique({
      //   where: { id: chargeId },
      //   include: {
      //     patient: { include: { user: true } },
      //     provider: { include: { user: true } }
      //   }
      // });
      
      // Mock data for MVP demonstration
      const mockCharge = this.getMockChargeData(chargeId);
      
      if (!mockCharge) {
        return {
          success: false,
          errors: ['Charge not found']
        };
      }
      
      // Convert to CMS-1500 format
      const cms1500Data = CMS1500Generator.fromPrismaCharge(
        mockCharge.charge,
        mockCharge.patient,
        mockCharge.provider
      );
      
      // Apply privacy settings
      if (!includePatientName) {
        const nameParts = cms1500Data.patientName.split(', ');
        const initials = nameParts.map(part => part.charAt(0)).join('.');
        cms1500Data.patientName = initials;
        cms1500Data.insuredName = initials;
      }
      
      // Generate PDF
      const pdfResult = await CMS1500Generator.generatePDF(cms1500Data);
      
      if (!pdfResult.success) {
        return {
          success: false,
          errors: pdfResult.errors,
          warnings: pdfResult.warnings
        };
      }
      
      // In production, you would upload to S3 and return presigned URL:
      // const s3Key = `superbills/${chargeId}/${pdfResult.filename}`;
      // const uploadResult = await uploadToS3(pdfResult.pdfBuffer!, s3Key);
      // const downloadUrl = await getPresignedDownloadUrl(s3Key);
      
      const patientInitials = cms1500Data.patientName.includes('.') 
        ? cms1500Data.patientName 
        : cms1500Data.patientName.split(', ').map(part => part.charAt(0)).join('.');
      
      return {
        success: true,
        data: {
          filename: pdfResult.filename,
          buffer: pdfResult.pdfBuffer, // In production, this would be downloadUrl
          metadata: {
            chargeId,
            patientInitials,
            providerId: mockCharge.charge.providerId,
            totalAmount: Number(mockCharge.charge.chargeAmount),
            generatedAt: new Date().toISOString()
          }
        },
        warnings: pdfResult.warnings
      };
      
    } catch (error) {
      console.error('Superbill generation error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }
  
  /**
   * Validate charge data before superbill generation
   */
  static async validateCharge(chargeId: string): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    
    // In production, this would validate against database:
    // const charge = await prisma.charge.findUnique({ where: { id: chargeId } });
    
    const mockCharge = this.getMockChargeData(chargeId);
    
    if (!mockCharge) {
      errors.push('Charge not found');
      return { valid: false, errors };
    }
    
    // Validation rules for CMS-1500 compliance
    const { charge, patient, provider } = mockCharge;
    
    if (!charge.cptCode) errors.push('CPT code is required');
    if (!charge.diagnosisCodes || charge.diagnosisCodes.length === 0) {
      errors.push('At least one diagnosis code is required');
    }
    if (!charge.chargeAmount || Number(charge.chargeAmount) <= 0) {
      errors.push('Charge amount must be greater than 0');
    }
    if (!provider.npiNumber) errors.push('Provider NPI is required');
    if (!provider.tin) errors.push('Provider TIN is required');
    if (!patient.insuranceId) errors.push('Patient insurance ID is required');
    
    // Status validation
    if (charge.status === 'DRAFT') {
      errors.push('Cannot generate superbill for draft charges');
    }
    
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }
  
  /**
   * Get charge scrub results for compliance checking
   */
  static async scrubCharge(chargeId: string): Promise<{
    passed: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    const mockCharge = this.getMockChargeData(chargeId);
    if (!mockCharge) {
      errors.push('Charge not found');
      return { passed: false, warnings, errors };
    }
    
    const { charge } = mockCharge;
    
    // CPT Code validation
    if (!/^\d{5}$/.test(charge.cptCode)) {
      warnings.push('CPT code should be 5 digits');
    }
    
    // Common therapy CPT codes
    const therapyCodes = ['90791', '90834', '90837', '90846', '90847', '90853'];
    if (!therapyCodes.includes(charge.cptCode)) {
      warnings.push(`CPT code ${charge.cptCode} is not a standard therapy code`);
    }
    
    // Modifier validation
    charge.modifiers.forEach(modifier => {
      if (!/^[A-Z0-9]{2}$/.test(modifier)) {
        warnings.push(`Modifier ${modifier} format should be 2 alphanumeric characters`);
      }
      
      // GT modifier for telehealth
      if (modifier === 'GT' && !['90791', '90834', '90837'].includes(charge.cptCode)) {
        warnings.push('GT modifier typically used with individual therapy codes');
      }
    });
    
    // Diagnosis code validation (ICD-10)
    charge.diagnosisCodes.forEach(code => {
      if (!/^[A-Z]\d{2}(\.\d{1,4})?$/.test(code)) {
        warnings.push(`Diagnosis code ${code} may not be valid ICD-10 format`);
      }
    });
    
    // Units validation
    if (charge.units > 1 && ['90791', '90834', '90837'].includes(charge.cptCode)) {
      warnings.push('Individual therapy sessions typically have 1 unit');
    }
    
    return {
      passed: errors.length === 0,
      warnings,
      errors
    };
  }
  
  /**
   * Mock charge data for MVP demonstration
   */
  private static getMockChargeData(chargeId: string) {
    const mockData = {
      charge: {
        id: chargeId,
        providerId: 'provider_123',
        patientId: 'patient_456',
        cptCode: '90834',
        modifiers: ['GT'],
        diagnosisCodes: ['F32.9', 'F41.1'],
        diagnosisPointers: ['A', 'B'],
        units: 1,
        posCode: '02', // Telehealth
        renderingProviderNPI: '1234567890',
        billingProviderNPI: '1234567890',
        billingTIN: '12-3456789',
        payerId: 'AETNA',
        insuredId: 'ABC123456789',
        acceptAssignment: true,
        signatureOnFile: true,
        chargeAmount: 150.00,
        serviceFacilityId: null,
        referringProviderNPI: null,
        priorAuthNumber: null,
        claimNotes: null,
        exportBatchId: null,
        status: 'READY_FOR_EXPORT',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      patient: {
        id: 'patient_456',
        userId: 'user_789',
        dateOfBirth: new Date('1985-06-15'),
        sobrietyDate: new Date('2023-01-01'),
        diagnoses: ['Major Depressive Disorder', 'Anxiety Disorder'],
        medications: ['Sertraline 50mg'],
        insuranceId: 'ABC123456789',
        payerId: 'AETNA',
        user: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah.j@example.com',
          phoneNumber: '555-0123',
          address: {
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zip: '90210'
          }
        }
      },
      provider: {
        id: 'provider_123',
        userId: 'user_provider',
        licenseNumber: 'PSY12345',
        specialty: 'Clinical Psychology',
        organization: 'Serenity Mental Health Clinic',
        npiNumber: '1234567890',
        billingNPI: '1234567890',
        taxonomyCode: '103T00000X',
        tin: '12-3456789',
        user: {
          firstName: 'Dr. Emily',
          lastName: 'Chen',
          email: 'dr.chen@serenity.com',
          phoneNumber: '555-0456',
          address: {
            street: '456 Therapy Blvd',
            city: 'Healthcare City',
            state: 'CA',
            zip: '90211'
          }
        }
      }
    };
    
    return mockData;
  }
}