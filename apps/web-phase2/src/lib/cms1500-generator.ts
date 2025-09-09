/**
 * CMS-1500 PDF Generation Library
 * Generates HIPAA-compliant CMS-1500 forms for healthcare billing
 */

import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, rgb } from 'pdf-lib';
import { readFileSync } from 'fs';
import { join } from 'path';

interface CMS1500Data {
  // Header Information (Boxes 1-13)
  insuredIdNumber: string; // Box 1A
  patientName: string;     // Box 2
  patientDOB: string;      // Box 3
  insuredName: string;     // Box 4
  patientAddress: {        // Box 5
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  patientPhoneNumber: string; // Box 5 phone
  relationshipToInsured: 'SELF' | 'SPOUSE' | 'CHILD' | 'OTHER'; // Box 6
  insuredAddress: {        // Box 7
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  insuredPhoneNumber: string; // Box 7 phone
  
  // Payer Information (Boxes 9-11)
  otherInsuredName?: string;        // Box 9
  otherInsuredGroupNumber?: string; // Box 9A
  employerOrSchoolName?: string;    // Box 11
  insurancePlanName?: string;       // Box 11A
  
  // Authorization (Box 12)
  signatureOnFile: boolean;         // Box 12 - "Signature on File"
  signatureDate: string;            // Box 12
  
  // Provider Information (Boxes 14-33)
  dateOfCurrentIllness: string;     // Box 14
  priorAuthorizationNumber?: string; // Box 23
  
  // Service Lines (Box 24)
  serviceLines: ServiceLine[];
  
  // Provider Information
  renderingProvider: {
    name: string;
    npi: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    phoneNumber: string;
  };
  
  billingProvider: {
    name: string;
    npi: string;
    tin: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    phoneNumber: string;
  };
  
  // Payment Information
  acceptAssignment: boolean;        // Box 27
  totalCharge: number;             // Box 28
  amountPaid: number;              // Box 29
  balanceDue: number;              // Box 30
}

interface ServiceLine {
  dateOfService: {
    from: string;
    to: string;
  };
  placeOfService: string;          // POS code
  emergencyIndicator?: boolean;    // EMG
  procedureCode: string;           // CPT/HCPCS
  modifiers: string[];            // Up to 4 modifiers
  diagnosisPointer: string[];     // A, B, C, D
  charges: number;
  daysOrUnits: number;
  epsdtFamilyPlan?: boolean;
  renderingProviderNPI: string;
}

interface PDFGenerationResult {
  success: boolean;
  pdfBuffer?: Buffer;
  filename: string;
  errors?: string[];
  warnings?: string[];
}

export class CMS1500Generator {
  private static readonly FORM_TEMPLATE_PATH = '/public/forms/cms1500-template.pdf';
  
  /**
   * Generate CMS-1500 PDF from charge data
   */
  static async generatePDF(data: CMS1500Data): Promise<PDFGenerationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Validate required fields
      const validation = this.validateData(data);
      if (!validation.valid) {
        return {
          success: false,
          filename: '',
          errors: validation.errors,
          warnings: validation.warnings
        };
      }
      
      errors.push(...(validation.errors || []));
      warnings.push(...(validation.warnings || []));
      
      // Create new PDF document (blank form since we don't have template)
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // 8.5" x 11"
      const { width, height } = page.getSize();
      
      // Set font
      const font = await pdfDoc.embedFont('Helvetica');
      const fontSize = 10;
      
      // Draw CMS-1500 form structure and data
      await this.drawForm(page, data, font, fontSize);
      
      // Generate PDF buffer
      const pdfBuffer = Buffer.from(await pdfDoc.save());
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `cms1500_${data.patientName.replace(/\s+/g, '_')}_${timestamp}.pdf`;
      
      return {
        success: true,
        pdfBuffer,
        filename,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };
      
    } catch (error) {
      console.error('CMS-1500 PDF generation error:', error);
      return {
        success: false,
        filename: '',
        errors: [`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
  
  /**
   * Draw the CMS-1500 form structure and fill with data
   */
  private static async drawForm(page: any, data: CMS1500Data, font: any, fontSize: number) {
    const { width, height } = page.getSize();
    
    // Title
    page.drawText('CMS-1500 HEALTH INSURANCE CLAIM FORM', {
      x: 50,
      y: height - 50,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });
    
    // Box 1A - Medicare/Medicaid/TRICARE/CHAMPVA/Group Health Plan/FECA/OTHER
    page.drawText('1. INSURANCE TYPE:', { x: 50, y: height - 100, size: fontSize, font });
    page.drawText('1A. INSURED\'S ID NUMBER:', { x: 300, y: height - 100, size: fontSize, font });
    page.drawText(data.insuredIdNumber, { x: 450, y: height - 100, size: fontSize, font });
    
    // Box 2 - Patient Name
    page.drawText('2. PATIENT\'S NAME (Last, First, Middle):', { x: 50, y: height - 130, size: fontSize, font });
    page.drawText(data.patientName, { x: 250, y: height - 130, size: fontSize, font });
    
    // Box 3 - Patient DOB
    page.drawText('3. PATIENT\'S BIRTH DATE:', { x: 400, y: height - 130, size: fontSize, font });
    page.drawText(data.patientDOB, { x: 520, y: height - 130, size: fontSize, font });
    
    // Box 4 - Insured Name
    page.drawText('4. INSURED\'S NAME:', { x: 50, y: height - 160, size: fontSize, font });
    page.drawText(data.insuredName, { x: 150, y: height - 160, size: fontSize, font });
    
    // Box 5 - Patient Address
    page.drawText('5. PATIENT\'S ADDRESS:', { x: 50, y: height - 190, size: fontSize, font });
    const patientAddress = `${data.patientAddress.street}, ${data.patientAddress.city}, ${data.patientAddress.state} ${data.patientAddress.zip}`;
    page.drawText(patientAddress, { x: 50, y: height - 210, size: fontSize - 2, font });
    page.drawText(`TELEPHONE: ${data.patientPhoneNumber}`, { x: 50, y: height - 230, size: fontSize - 2, font });
    
    // Box 6 - Relationship to Insured
    page.drawText('6. PATIENT RELATIONSHIP TO INSURED:', { x: 300, y: height - 190, size: fontSize, font });
    page.drawText(`SELF: ${data.relationshipToInsured === 'SELF' ? 'X' : ''}`, { x: 300, y: height - 210, size: fontSize, font });
    page.drawText(`SPOUSE: ${data.relationshipToInsured === 'SPOUSE' ? 'X' : ''}`, { x: 360, y: height - 210, size: fontSize, font });
    page.drawText(`CHILD: ${data.relationshipToInsured === 'CHILD' ? 'X' : ''}`, { x: 430, y: height - 210, size: fontSize, font });
    page.drawText(`OTHER: ${data.relationshipToInsured === 'OTHER' ? 'X' : ''}`, { x: 480, y: height - 210, size: fontSize, font });
    
    // Service Lines (Box 24)
    page.drawText('24. SERVICES:', { x: 50, y: height - 300, size: fontSize, font });
    
    let yPos = height - 330;
    data.serviceLines.forEach((line, index) => {
      if (index < 6) { // CMS-1500 supports up to 6 service lines
        page.drawText(`${line.dateOfService.from}`, { x: 60, y: yPos, size: fontSize - 1, font });
        page.drawText(`${line.placeOfService}`, { x: 130, y: yPos, size: fontSize - 1, font });
        page.drawText(`${line.procedureCode}`, { x: 170, y: yPos, size: fontSize - 1, font });
        page.drawText(`${line.modifiers.join(' ')}`, { x: 230, y: yPos, size: fontSize - 1, font });
        page.drawText(`${line.diagnosisPointer.join(' ')}`, { x: 290, y: yPos, size: fontSize - 1, font });
        page.drawText(`$${line.charges.toFixed(2)}`, { x: 330, y: yPos, size: fontSize - 1, font });
        page.drawText(`${line.daysOrUnits}`, { x: 400, y: yPos, size: fontSize - 1, font });
        page.drawText(`${line.renderingProviderNPI}`, { x: 440, y: yPos, size: fontSize - 1, font });
        yPos -= 20;
      }
    });
    
    // Box 25 - Federal Tax ID
    page.drawText('25. FEDERAL TAX I.D. NUMBER:', { x: 50, y: height - 500, size: fontSize, font });
    page.drawText(data.billingProvider.tin, { x: 200, y: height - 500, size: fontSize, font });
    
    // Box 26 - Patient Account Number
    page.drawText('26. PATIENT\'S ACCOUNT NO.:', { x: 300, y: height - 500, size: fontSize, font });
    
    // Box 27 - Accept Assignment
    page.drawText('27. ACCEPT ASSIGNMENT:', { x: 50, y: height - 530, size: fontSize, font });
    page.drawText(`YES: ${data.acceptAssignment ? 'X' : ''}`, { x: 200, y: height - 530, size: fontSize, font });
    page.drawText(`NO: ${!data.acceptAssignment ? 'X' : ''}`, { x: 250, y: height - 530, size: fontSize, font });
    
    // Box 28 - Total Charge
    page.drawText('28. TOTAL CHARGE:', { x: 300, y: height - 530, size: fontSize, font });
    page.drawText(`$${data.totalCharge.toFixed(2)}`, { x: 400, y: height - 530, size: fontSize, font });
    
    // Box 29 - Amount Paid
    page.drawText('29. AMOUNT PAID:', { x: 450, y: height - 530, size: fontSize, font });
    page.drawText(`$${data.amountPaid.toFixed(2)}`, { x: 520, y: height - 530, size: fontSize, font });
    
    // Box 30 - Balance Due
    page.drawText('30. BALANCE DUE:', { x: 50, y: height - 560, size: fontSize, font });
    page.drawText(`$${data.balanceDue.toFixed(2)}`, { x: 150, y: height - 560, size: fontSize, font });
    
    // Box 31 - Provider Signature
    page.drawText('31. SIGNATURE OF PHYSICIAN OR SUPPLIER:', { x: 50, y: height - 590, size: fontSize, font });
    if (data.signatureOnFile) {
      page.drawText('SIGNATURE ON FILE', { x: 250, y: height - 590, size: fontSize, font });
      page.drawText(`DATE: ${data.signatureDate}`, { x: 400, y: height - 590, size: fontSize, font });
    }
    
    // Box 32 - Service Facility
    page.drawText('32. SERVICE FACILITY LOCATION INFORMATION:', { x: 50, y: height - 620, size: fontSize, font });
    const facilityAddress = `${data.renderingProvider.address.street}, ${data.renderingProvider.address.city}, ${data.renderingProvider.address.state} ${data.renderingProvider.address.zip}`;
    page.drawText(facilityAddress, { x: 50, y: height - 640, size: fontSize - 2, font });
    
    // Box 33 - Billing Provider
    page.drawText('33. BILLING PROVIDER INFO & PH #:', { x: 300, y: height - 620, size: fontSize, font });
    page.drawText(data.billingProvider.name, { x: 300, y: height - 640, size: fontSize - 1, font });
    const billingAddress = `${data.billingProvider.address.street}, ${data.billingProvider.address.city}, ${data.billingProvider.address.state} ${data.billingProvider.address.zip}`;
    page.drawText(billingAddress, { x: 300, y: height - 660, size: fontSize - 2, font });
    page.drawText(`NPI: ${data.billingProvider.npi}`, { x: 300, y: height - 680, size: fontSize - 1, font });
    page.drawText(`PHONE: ${data.billingProvider.phoneNumber}`, { x: 300, y: height - 700, size: fontSize - 1, font });
  }
  
  /**
   * Validate CMS-1500 data for required fields and compliance
   */
  private static validateData(data: CMS1500Data): { valid: boolean; errors?: string[]; warnings?: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields validation
    if (!data.insuredIdNumber) errors.push('Insured ID Number is required (Box 1A)');
    if (!data.patientName) errors.push('Patient Name is required (Box 2)');
    if (!data.patientDOB) errors.push('Patient Date of Birth is required (Box 3)');
    if (!data.insuredName) errors.push('Insured Name is required (Box 4)');
    
    // Patient Address validation
    if (!data.patientAddress.street) errors.push('Patient street address is required (Box 5)');
    if (!data.patientAddress.city) errors.push('Patient city is required (Box 5)');
    if (!data.patientAddress.state) errors.push('Patient state is required (Box 5)');
    if (!data.patientAddress.zip) errors.push('Patient ZIP code is required (Box 5)');
    
    // Service Lines validation
    if (!data.serviceLines || data.serviceLines.length === 0) {
      errors.push('At least one service line is required (Box 24)');
    } else {
      data.serviceLines.forEach((line, index) => {
        if (!line.dateOfService.from) errors.push(`Service line ${index + 1}: Date of service is required`);
        if (!line.placeOfService) errors.push(`Service line ${index + 1}: Place of service is required`);
        if (!line.procedureCode) errors.push(`Service line ${index + 1}: Procedure code is required`);
        if (!line.renderingProviderNPI) errors.push(`Service line ${index + 1}: Rendering provider NPI is required`);
        if (line.charges <= 0) errors.push(`Service line ${index + 1}: Charge amount must be greater than 0`);
        
        // Validate CPT code format
        if (line.procedureCode && !/^\d{5}$/.test(line.procedureCode)) {
          warnings.push(`Service line ${index + 1}: CPT code should be 5 digits`);
        }
        
        // Validate modifier format
        line.modifiers.forEach(modifier => {
          if (!/^[A-Z0-9]{2}$/.test(modifier)) {
            warnings.push(`Service line ${index + 1}: Modifier '${modifier}' should be 2 characters`);
          }
        });
      });
    }
    
    // Provider validation
    if (!data.renderingProvider.npi) errors.push('Rendering Provider NPI is required');
    if (!data.billingProvider.npi) errors.push('Billing Provider NPI is required');
    if (!data.billingProvider.tin) errors.push('Billing Provider TIN is required (Box 25)');
    
    // NPI format validation
    if (data.renderingProvider.npi && !/^\d{10}$/.test(data.renderingProvider.npi)) {
      warnings.push('Rendering Provider NPI should be 10 digits');
    }
    if (data.billingProvider.npi && !/^\d{10}$/.test(data.billingProvider.npi)) {
      warnings.push('Billing Provider NPI should be 10 digits');
    }
    
    // TIN format validation
    if (data.billingProvider.tin && !/^\d{2}-\d{7}$/.test(data.billingProvider.tin)) {
      warnings.push('TIN should be in format XX-XXXXXXX');
    }
    
    // Date format validation
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (data.patientDOB && !dateRegex.test(data.patientDOB)) {
      warnings.push('Patient DOB should be in MM/DD/YYYY format');
    }
    if (data.signatureDate && !dateRegex.test(data.signatureDate)) {
      warnings.push('Signature date should be in MM/DD/YYYY format');
    }
    
    // Total charge validation
    const calculatedTotal = data.serviceLines.reduce((sum, line) => sum + line.charges, 0);
    if (Math.abs(data.totalCharge - calculatedTotal) > 0.01) {
      errors.push('Total charge does not match sum of service line charges');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
  
  /**
   * Convert Prisma Charge model to CMS-1500 data format
   */
  static fromPrismaCharge(charge: any, patient: any, provider: any): CMS1500Data {
    return {
      insuredIdNumber: patient.insuranceId || '',
      patientName: `${patient.user.lastName}, ${patient.user.firstName}`,
      patientDOB: patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('en-US') : '',
      insuredName: `${patient.user.lastName}, ${patient.user.firstName}`,
      patientAddress: {
        street: patient.user.address?.street || '',
        city: patient.user.address?.city || '',
        state: patient.user.address?.state || '',
        zip: patient.user.address?.zip || ''
      },
      patientPhoneNumber: patient.user.phoneNumber || '',
      relationshipToInsured: 'SELF',
      insuredAddress: {
        street: patient.user.address?.street || '',
        city: patient.user.address?.city || '',
        state: patient.user.address?.state || '',
        zip: patient.user.address?.zip || ''
      },
      insuredPhoneNumber: patient.user.phoneNumber || '',
      signatureOnFile: charge.signatureOnFile,
      signatureDate: new Date().toLocaleDateString('en-US'),
      dateOfCurrentIllness: new Date().toLocaleDateString('en-US'),
      priorAuthorizationNumber: charge.priorAuthNumber,
      serviceLines: [{
        dateOfService: {
          from: new Date(charge.createdAt).toLocaleDateString('en-US'),
          to: new Date(charge.createdAt).toLocaleDateString('en-US')
        },
        placeOfService: charge.posCode || '11', // Office
        procedureCode: charge.cptCode,
        modifiers: charge.modifiers,
        diagnosisPointer: charge.diagnosisPointers,
        charges: Number(charge.chargeAmount),
        daysOrUnits: charge.units,
        renderingProviderNPI: charge.renderingProviderNPI || provider.npiNumber
      }],
      renderingProvider: {
        name: `${provider.user.firstName} ${provider.user.lastName}`,
        npi: provider.npiNumber || '',
        address: {
          street: provider.user.address?.street || '',
          city: provider.user.address?.city || '',
          state: provider.user.address?.state || '',
          zip: provider.user.address?.zip || ''
        },
        phoneNumber: provider.user.phoneNumber || ''
      },
      billingProvider: {
        name: provider.organization || `${provider.user.firstName} ${provider.user.lastName}`,
        npi: charge.billingProviderNPI || provider.billingNPI || provider.npiNumber || '',
        tin: charge.billingTIN || provider.tin || '',
        address: {
          street: provider.user.address?.street || '',
          city: provider.user.address?.city || '',
          state: provider.user.address?.state || '',
          zip: provider.user.address?.zip || ''
        },
        phoneNumber: provider.user.phoneNumber || ''
      },
      acceptAssignment: charge.acceptAssignment,
      totalCharge: Number(charge.chargeAmount),
      amountPaid: 0,
      balanceDue: Number(charge.chargeAmount)
    };
  }
}