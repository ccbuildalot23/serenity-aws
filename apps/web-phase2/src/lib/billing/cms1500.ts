/**
 * CMS-1500 PDF Generation Service
 * Maps charge data to CMS-1500 form fields using pdf-lib
 */

import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, rgb } from 'pdf-lib';
import { format } from 'date-fns';

export interface CMS1500Data {
  // Patient Information (Boxes 1-13)
  patient: {
    id: string;
    name: string;
    dateOfBirth: Date;
    gender: 'M' | 'F';
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      phone?: string;
    };
    insuranceId?: string; // Box 1A
  };
  
  // Insurance Information
  insurance?: {
    payerName: string;
    payerId: string;
    planName?: string;
    groupNumber?: string;
  };
  
  // Provider Information
  provider: {
    name: string;
    npi: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  
  // Billing Provider (if different)
  billingProvider?: {
    name: string;
    npi: string;
    tin: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  
  // Service Information (Box 24)
  services: CMS1500Service[];
  
  // Additional Information
  acceptAssignment: boolean;
  signatureOnFile: boolean;
  totalCharge: number;
  amountPaid?: number;
  balanceDue?: number;
}

export interface CMS1500Service {
  dateOfService: Date;
  posCode: string; // Place of Service
  cptCode: string;
  modifiers: string[];
  diagnosisPointers: string[]; // A, B, C, D
  units: number;
  charges: number;
  renderingProviderNPI?: string;
}

export interface DiagnosisCode {
  code: string; // ICD-10 code
  pointer: 'A' | 'B' | 'C' | 'D';
}

/**
 * CMS-1500 Box-to-Field Mapping
 * Complete mapping of all 33 boxes on the CMS-1500 form
 */
export const CMS1500_FIELD_MAP = {
  // Insurance Type (Box 1)
  BOX_1_MEDICARE: 'medicare_checkbox',
  BOX_1_MEDICAID: 'medicaid_checkbox', 
  BOX_1_TRICARE: 'tricare_checkbox',
  BOX_1_CHAMPVA: 'champva_checkbox',
  BOX_1_GROUP_HEALTH: 'group_health_checkbox',
  BOX_1_FECA: 'feca_checkbox',
  BOX_1_OTHER: 'other_insurance_checkbox',
  
  // Patient Information
  BOX_1A_INSURED_ID: 'insured_id_number',
  BOX_2_PATIENT_NAME: 'patient_name',
  BOX_3_PATIENT_DOB: 'patient_birth_date',
  BOX_3_PATIENT_GENDER_M: 'patient_gender_male',
  BOX_3_PATIENT_GENDER_F: 'patient_gender_female',
  BOX_4_INSURED_NAME: 'insured_name',
  BOX_5_PATIENT_ADDRESS: 'patient_address',
  BOX_5_PATIENT_CITY: 'patient_city',
  BOX_5_PATIENT_STATE: 'patient_state',
  BOX_5_PATIENT_ZIP: 'patient_zip_code',
  BOX_5_PATIENT_PHONE: 'patient_phone',
  BOX_6_PATIENT_RELATIONSHIP: 'patient_relationship_to_insured',
  BOX_7_INSURED_ADDRESS: 'insured_address',
  BOX_8_PATIENT_STATUS: 'patient_status',
  BOX_9_OTHER_INSURED_NAME: 'other_insured_name',
  BOX_10_CONDITION_RELATED: 'condition_related_to',
  BOX_11_INSURED_GROUP: 'insured_group_number',
  BOX_12_PATIENT_SIGNATURE: 'patient_signature_source',
  BOX_13_INSURED_SIGNATURE: 'insured_signature',
  
  // Provider/Service Information
  BOX_14_DATE_OF_ILLNESS: 'date_of_current_illness',
  BOX_15_DATE_SAME_SIMILAR: 'date_same_similar_illness',
  BOX_16_DATES_UNABLE_TO_WORK: 'dates_unable_to_work',
  BOX_17_REFERRING_PROVIDER: 'referring_provider_name',
  BOX_17A_REFERRING_PROVIDER_ID: 'referring_provider_id',
  BOX_17B_REFERRING_PROVIDER_NPI: 'referring_provider_npi',
  BOX_18_HOSPITALIZATION_DATES: 'hospitalization_dates',
  BOX_19_ADDITIONAL_CLAIM_INFO: 'additional_claim_information',
  BOX_20_OUTSIDE_LAB: 'outside_lab_charges',
  BOX_21_DIAGNOSIS_CODES: 'diagnosis_codes',
  BOX_22_RESUBMISSION_CODE: 'resubmission_code',
  BOX_23_PRIOR_AUTHORIZATION: 'prior_authorization_number',
  
  // Service Lines (Box 24A-J)
  BOX_24A_DATE_OF_SERVICE: 'service_date_',
  BOX_24B_PLACE_OF_SERVICE: 'place_of_service_',
  BOX_24C_EMG: 'emergency_',
  BOX_24D_PROCEDURES: 'procedure_code_',
  BOX_24E_DIAGNOSIS_POINTER: 'diagnosis_pointer_',
  BOX_24F_CHARGES: 'charges_',
  BOX_24G_DAYS_UNITS: 'days_or_units_',
  BOX_24H_EPSDT: 'epsdt_',
  BOX_24I_ID_QUALIFIER: 'id_qualifier_',
  BOX_24J_RENDERING_PROVIDER: 'rendering_provider_id_',
  
  // Billing Information
  BOX_25_FEDERAL_TAX_ID: 'federal_tax_id',
  BOX_26_PATIENT_ACCOUNT: 'patient_account_number',
  BOX_27_ACCEPT_ASSIGNMENT: 'accept_assignment',
  BOX_28_TOTAL_CHARGE: 'total_charge',
  BOX_29_AMOUNT_PAID: 'amount_paid',
  BOX_30_BALANCE_DUE: 'balance_due',
  BOX_31_SIGNATURE_OF_PHYSICIAN: 'physician_signature',
  BOX_32_SERVICE_FACILITY: 'service_facility_location',
  BOX_33_BILLING_PROVIDER: 'billing_provider_info',
} as const;

/**
 * Generate CMS-1500 PDF from charge data
 */
export async function generateCMS1500PDF(data: CMS1500Data): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Add a blank page (8.5" x 11")
  const page = pdfDoc.addPage([612, 792]);
  
  // Get form if available, otherwise create fields manually
  let form: PDFForm;
  try {
    form = pdfDoc.getForm();
  } catch {
    // Create a new form if none exists
    form = pdfDoc.getForm();
  }

  // Map data to CMS-1500 fields
  await fillCMS1500Form(form, page, data);
  
  // Return the PDF as bytes
  return await pdfDoc.save();
}

/**
 * Fill CMS-1500 form fields with data
 */
async function fillCMS1500Form(form: PDFForm, page: any, data: CMS1500Data): Promise<void> {
  const { patient, provider, billingProvider, services, insurance } = data;
  
  // Helper function to safely set text field
  const setTextField = (fieldName: string, value: string) => {
    try {
      const field = form.getTextField(fieldName);
      field.setText(value);
    } catch (error) {
      // Field might not exist in template, create it manually
      addTextField(page, fieldName, value);
    }
  };
  
  // Helper function to safely set checkbox
  const setCheckBox = (fieldName: string, checked: boolean) => {
    try {
      const field = form.getCheckBox(fieldName);
      if (checked) field.check();
    } catch (error) {
      // Field might not exist, skip or create manually
      if (checked) addCheckBox(page, fieldName);
    }
  };

  // Box 1: Insurance Type (default to "Other" for now)
  setCheckBox(CMS1500_FIELD_MAP.BOX_1_OTHER, true);
  
  // Box 1A: Insured's ID Number
  if (patient.insuranceId) {
    setTextField(CMS1500_FIELD_MAP.BOX_1A_INSURED_ID, patient.insuranceId);
  }
  
  // Box 2: Patient's Name
  setTextField(CMS1500_FIELD_MAP.BOX_2_PATIENT_NAME, patient.name);
  
  // Box 3: Patient's Birth Date and Gender
  setTextField(CMS1500_FIELD_MAP.BOX_3_PATIENT_DOB, format(patient.dateOfBirth, 'MM/dd/yyyy'));
  setCheckBox(CMS1500_FIELD_MAP.BOX_3_PATIENT_GENDER_M, patient.gender === 'M');
  setCheckBox(CMS1500_FIELD_MAP.BOX_3_PATIENT_GENDER_F, patient.gender === 'F');
  
  // Box 4: Insured's Name (same as patient for self-pay)
  setTextField(CMS1500_FIELD_MAP.BOX_4_INSURED_NAME, patient.name);
  
  // Box 5: Patient's Address
  setTextField(CMS1500_FIELD_MAP.BOX_5_PATIENT_ADDRESS, patient.address.street);
  setTextField(CMS1500_FIELD_MAP.BOX_5_PATIENT_CITY, patient.address.city);
  setTextField(CMS1500_FIELD_MAP.BOX_5_PATIENT_STATE, patient.address.state);
  setTextField(CMS1500_FIELD_MAP.BOX_5_PATIENT_ZIP, patient.address.zipCode);
  if (patient.address.phone) {
    setTextField(CMS1500_FIELD_MAP.BOX_5_PATIENT_PHONE, patient.address.phone);
  }
  
  // Box 6: Patient Relationship to Insured (default: Self)
  setTextField(CMS1500_FIELD_MAP.BOX_6_PATIENT_RELATIONSHIP, 'Self');
  
  // Box 12: Patient's Signature Source
  if (data.signatureOnFile) {
    setTextField(CMS1500_FIELD_MAP.BOX_12_PATIENT_SIGNATURE, 'Signature on File');
  }
  
  // Box 21: Diagnosis Codes (up to 12)
  const diagnosisCodes = services.reduce((codes: string[], service) => {
    return [...codes, ...service.diagnosisPointers];
  }, []);
  const uniqueDiagnosisCodes = [...new Set(diagnosisCodes)].slice(0, 12);
  setTextField(CMS1500_FIELD_MAP.BOX_21_DIAGNOSIS_CODES, uniqueDiagnosisCodes.join(' '));
  
  // Box 24: Service Lines (up to 6 lines)
  services.slice(0, 6).forEach((service, index) => {
    const lineNum = index + 1;
    
    // Box 24A: Date of Service
    setTextField(`${CMS1500_FIELD_MAP.BOX_24A_DATE_OF_SERVICE}${lineNum}`, 
                format(service.dateOfService, 'MM/dd/yyyy'));
    
    // Box 24B: Place of Service
    setTextField(`${CMS1500_FIELD_MAP.BOX_24B_PLACE_OF_SERVICE}${lineNum}`, service.posCode);
    
    // Box 24D: Procedures, Services, or Supplies
    const procedureCode = [service.cptCode, ...service.modifiers].join(' ');
    setTextField(`${CMS1500_FIELD_MAP.BOX_24D_PROCEDURES}${lineNum}`, procedureCode);
    
    // Box 24E: Diagnosis Pointer
    setTextField(`${CMS1500_FIELD_MAP.BOX_24E_DIAGNOSIS_POINTER}${lineNum}`, 
                service.diagnosisPointers.join(' '));
    
    // Box 24F: Charges
    setTextField(`${CMS1500_FIELD_MAP.BOX_24F_CHARGES}${lineNum}`, service.charges.toFixed(2));
    
    // Box 24G: Days or Units
    setTextField(`${CMS1500_FIELD_MAP.BOX_24G_DAYS_UNITS}${lineNum}`, service.units.toString());
    
    // Box 24J: Rendering Provider ID
    if (service.renderingProviderNPI) {
      setTextField(`${CMS1500_FIELD_MAP.BOX_24J_RENDERING_PROVIDER}${lineNum}`, service.renderingProviderNPI);
    }
  });
  
  // Box 25: Federal Tax ID Number
  if (billingProvider?.tin) {
    setTextField(CMS1500_FIELD_MAP.BOX_25_FEDERAL_TAX_ID, billingProvider.tin);
  }
  
  // Box 26: Patient's Account Number
  setTextField(CMS1500_FIELD_MAP.BOX_26_PATIENT_ACCOUNT, patient.id);
  
  // Box 27: Accept Assignment
  setCheckBox(CMS1500_FIELD_MAP.BOX_27_ACCEPT_ASSIGNMENT, data.acceptAssignment);
  
  // Box 28: Total Charge
  setTextField(CMS1500_FIELD_MAP.BOX_28_TOTAL_CHARGE, data.totalCharge.toFixed(2));
  
  // Box 29: Amount Paid
  if (data.amountPaid) {
    setTextField(CMS1500_FIELD_MAP.BOX_29_AMOUNT_PAID, data.amountPaid.toFixed(2));
  }
  
  // Box 30: Balance Due
  const balanceDue = data.balanceDue || (data.totalCharge - (data.amountPaid || 0));
  setTextField(CMS1500_FIELD_MAP.BOX_30_BALANCE_DUE, balanceDue.toFixed(2));
  
  // Box 31: Signature of Physician
  if (data.signatureOnFile) {
    setTextField(CMS1500_FIELD_MAP.BOX_31_SIGNATURE_OF_PHYSICIAN, 
                `${provider.name} - Signature on File`);
  }
  
  // Box 33: Billing Provider Info
  const billingInfo = billingProvider || provider;
  const billingText = `${billingInfo.name}\n${billingInfo.address.street}\n${billingInfo.address.city}, ${billingInfo.address.state} ${billingInfo.address.zipCode}\nNPI: ${billingInfo.npi}`;
  setTextField(CMS1500_FIELD_MAP.BOX_33_BILLING_PROVIDER, billingText);
}

/**
 * Add text field manually if not in form template
 */
function addTextField(page: any, fieldName: string, text: string): void {
  // This would add text directly to the page
  // Implementation depends on having field coordinates
  // For now, we'll log missing fields for debugging
  console.warn(`CMS-1500 field not found in template: ${fieldName} = ${text}`);
}

/**
 * Add checkbox manually if not in form template
 */
function addCheckBox(page: any, fieldName: string): void {
  // This would add a checkbox mark directly to the page
  console.warn(`CMS-1500 checkbox not found in template: ${fieldName}`);
}

/**
 * Validate CMS-1500 data before PDF generation
 */
export function validateCMS1500Data(data: CMS1500Data): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required patient information
  if (!data.patient.name) errors.push('Patient name is required');
  if (!data.patient.dateOfBirth) errors.push('Patient date of birth is required');
  if (!data.patient.gender) errors.push('Patient gender is required');
  
  // Required provider information
  if (!data.provider.name) errors.push('Provider name is required');
  if (!data.provider.npi) errors.push('Provider NPI is required');
  
  // Required service information
  if (!data.services || data.services.length === 0) {
    errors.push('At least one service line is required');
  } else {
    data.services.forEach((service, index) => {
      if (!service.cptCode) errors.push(`Service ${index + 1}: CPT code is required`);
      if (!service.posCode) errors.push(`Service ${index + 1}: Place of Service is required`);
      if (service.charges <= 0) errors.push(`Service ${index + 1}: Charge amount must be positive`);
      if (service.units < 1) errors.push(`Service ${index + 1}: Units must be at least 1`);
    });
  }
  
  // Total charge validation
  const calculatedTotal = data.services.reduce((sum, service) => sum + service.charges, 0);
  if (Math.abs(calculatedTotal - data.totalCharge) > 0.01) {
    warnings.push('Total charge does not match sum of service charges');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get CMS-1500 field descriptions for documentation
 */
export function getCMS1500FieldDescriptions(): Record<string, string> {
  return {
    'Box 1': 'Type of insurance coverage',
    'Box 1A': "Insured's ID number",
    'Box 2': "Patient's name",
    'Box 3': "Patient's birth date and gender", 
    'Box 4': "Insured's name",
    'Box 5': "Patient's address",
    'Box 6': "Patient relationship to insured",
    'Box 7': "Insured's address",
    'Box 8': "Reserved for NUCC use",
    'Box 9': "Other insured's name",
    'Box 10': "Is patient's condition related to employment/auto accident/other accident",
    'Box 11': "Insured's policy group or FECA number",
    'Box 12': "Patient's or authorized person's signature",
    'Box 13': "Insured's or authorized person's signature",
    'Box 14': "Date of current illness, injury, or pregnancy",
    'Box 15': "Other date",
    'Box 16': "Dates patient unable to work in current occupation",
    'Box 17': "Name of referring provider or other source",
    'Box 17A': "Referring provider identifier",
    'Box 17B': "NPI of referring provider",
    'Box 18': "Hospitalization dates related to current services",
    'Box 19': "Additional claim information",
    'Box 20': "Outside lab charges",
    'Box 21': "Diagnosis or nature of illness or injury",
    'Box 22': "Resubmission code and original reference number",
    'Box 23': "Prior authorization number",
    'Box 24A': "Date(s) of service",
    'Box 24B': "Place of service",
    'Box 24C': "EMG (Emergency indicator)",
    'Box 24D': "Procedures, services, or supplies",
    'Box 24E': "Diagnosis pointer",
    'Box 24F': "Charges",
    'Box 24G': "Days or units",
    'Box 24H': "EPSDT/Family plan",
    'Box 24I': "ID qualifier",
    'Box 24J': "Rendering provider ID number",
    'Box 25': "Federal tax ID number",
    'Box 26': "Patient's account number",
    'Box 27': "Accept assignment",
    'Box 28': "Total charge",
    'Box 29': "Amount paid",
    'Box 30': "Rsvd for NUCC use",
    'Box 31': "Signature of physician or supplier",
    'Box 32': "Service facility location information",
    'Box 33': "Billing provider info and phone number"
  };
}