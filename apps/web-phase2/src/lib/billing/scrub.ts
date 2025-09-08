/**
 * Billing Scrubber Service
 * Data validation with error codes and resolution hints for CMS-1500 compliance
 */

export interface ScrubError {
  code: string;
  field: string;
  message: string;
  hint: string;
  severity: 'error' | 'warning';
}

export interface ScrubWarning {
  code: string;
  field: string;
  message: string;
  hint: string;
}

export interface ScrubResult {
  errors: ScrubError[];
  warnings: ScrubWarning[];
  isValid: boolean;
}

/**
 * Error codes following standard claim scrubbing conventions
 */
export const SCRUB_ERROR_CODES = {
  // Required field errors (E001-E099)
  E001: 'MISSING_POS_CODE',
  E002: 'MISSING_RENDERING_NPI',
  E003: 'MISSING_BILLING_NPI', 
  E004: 'MISSING_TIN',
  E005: 'MISSING_CHARGE_AMOUNT',
  E006: 'MISSING_CPT_CODE',
  E007: 'MISSING_UNITS',
  
  // Format/validation errors (E100-E199)
  E100: 'INVALID_NPI_FORMAT',
  E101: 'INVALID_TIN_FORMAT',
  E102: 'INVALID_POS_CODE',
  E103: 'INVALID_CPT_CODE',
  E104: 'INVALID_MODIFIER_COUNT',
  E105: 'INVALID_DIAGNOSIS_POINTER',
  E106: 'INVALID_CHARGE_AMOUNT',
  E107: 'INVALID_UNITS',
  E108: 'INVALID_ICD10_FORMAT',
  
  // Business rule errors (E200-E299)
  E200: 'DIAGNOSIS_POINTER_NO_REFERENCE',
  E201: 'MODIFIER_CONFLICT',
  E202: 'POS_CPT_MISMATCH',
  E203: 'UNITS_EXCEEDED_MAX',
  E204: 'AMOUNT_BELOW_MINIMUM',
  
  // Insurance/payer errors (E300-E399)
  E300: 'MISSING_PAYER_ID',
  E301: 'MISSING_MEMBER_ID',
  E302: 'INVALID_PAYER_FORMAT',
} as const;

/**
 * Warning codes for potential issues (W001-W999)
 */
export const SCRUB_WARNING_CODES = {
  W001: 'MISSING_PRIOR_AUTH',
  W002: 'MISSING_REFERRING_PROVIDER',
  W003: 'HIGH_UNIT_COUNT',
  W004: 'UNUSUAL_CHARGE_AMOUNT',
  W005: 'MODIFIER_RARELY_USED',
  W006: 'POS_UNCOMMON_FOR_CPT',
} as const;

interface ChargeData {
  cptCode?: string;
  modifiers?: string[];
  diagnosisCodes?: string[];
  diagnosisPointers?: string[];
  units?: number;
  chargeAmount?: number;
  posCode?: string;
  renderingProviderNPI?: string;
  billingProviderNPI?: string;
  billingTIN?: string;
  payerId?: string;
  insuredId?: string;
  priorAuthNumber?: string;
  referringProviderNPI?: string;
}

/**
 * Main scrubbing function
 */
export function scrubCharge(data: ChargeData): ScrubResult {
  const errors: ScrubError[] = [];
  const warnings: ScrubWarning[] = [];

  // Required field validations
  validateRequiredFields(data, errors);
  
  // Format validations
  validateFormats(data, errors);
  
  // Business rule validations
  validateBusinessRules(data, errors);
  
  // Generate warnings
  generateWarnings(data, warnings);

  return {
    errors,
    warnings,
    isValid: errors.length === 0
  };
}

function validateRequiredFields(data: ChargeData, errors: ScrubError[]): void {
  if (!data.posCode) {
    errors.push({
      code: SCRUB_ERROR_CODES.E001,
      field: 'posCode',
      message: 'Place of Service code is required',
      hint: 'Add POS code (e.g., 11 for Office, 53 for Community Mental Health Center)',
      severity: 'error'
    });
  }

  if (!data.renderingProviderNPI) {
    errors.push({
      code: SCRUB_ERROR_CODES.E002,
      field: 'renderingProviderNPI',
      message: 'Rendering Provider NPI is required',
      hint: 'Enter the 10-digit NPI of the provider who performed the service',
      severity: 'error'
    });
  }

  if (!data.billingProviderNPI) {
    errors.push({
      code: SCRUB_ERROR_CODES.E003,
      field: 'billingProviderNPI',
      message: 'Billing Provider NPI is required',
      hint: 'Enter the 10-digit NPI of the billing provider or organization',
      severity: 'error'
    });
  }

  if (!data.billingTIN) {
    errors.push({
      code: SCRUB_ERROR_CODES.E004,
      field: 'billingTIN',
      message: 'Tax Identification Number (TIN) is required',
      hint: 'Enter TIN in format XX-XXXXXXX (e.g., 12-3456789)',
      severity: 'error'
    });
  }

  if (!data.chargeAmount || data.chargeAmount <= 0) {
    errors.push({
      code: SCRUB_ERROR_CODES.E005,
      field: 'chargeAmount',
      message: 'Charge amount is required and must be positive',
      hint: 'Enter the fee for the service (e.g., 150.00)',
      severity: 'error'
    });
  }

  if (!data.cptCode) {
    errors.push({
      code: SCRUB_ERROR_CODES.E006,
      field: 'cptCode',
      message: 'CPT code is required',
      hint: 'Select a valid CPT code (90791, 90834, 90837, or 90853)',
      severity: 'error'
    });
  }

  if (!data.units || data.units < 1) {
    errors.push({
      code: SCRUB_ERROR_CODES.E007,
      field: 'units',
      message: 'Units must be at least 1',
      hint: 'Enter the number of units of service provided (typically 1)',
      severity: 'error'
    });
  }
}

function validateFormats(data: ChargeData, errors: ScrubError[]): void {
  // NPI format validation (10 digits)
  if (data.renderingProviderNPI && !/^\d{10}$/.test(data.renderingProviderNPI)) {
    errors.push({
      code: SCRUB_ERROR_CODES.E100,
      field: 'renderingProviderNPI',
      message: 'NPI must be exactly 10 digits',
      hint: 'Enter NPI without spaces or dashes (e.g., 1234567890)',
      severity: 'error'
    });
  }

  if (data.billingProviderNPI && !/^\d{10}$/.test(data.billingProviderNPI)) {
    errors.push({
      code: SCRUB_ERROR_CODES.E100,
      field: 'billingProviderNPI',
      message: 'NPI must be exactly 10 digits',
      hint: 'Enter NPI without spaces or dashes (e.g., 1234567890)',
      severity: 'error'
    });
  }

  // TIN format validation
  if (data.billingTIN && !/^\d{2}-\d{7}$/.test(data.billingTIN)) {
    errors.push({
      code: SCRUB_ERROR_CODES.E101,
      field: 'billingTIN',
      message: 'TIN must be in format XX-XXXXXXX',
      hint: 'Enter TIN with hyphen (e.g., 12-3456789)',
      severity: 'error'
    });
  }

  // POS code validation
  const validPosCodes = ['11', '12', '19', '22', '49', '53', '71', '99'];
  if (data.posCode && !validPosCodes.includes(data.posCode)) {
    errors.push({
      code: SCRUB_ERROR_CODES.E102,
      field: 'posCode',
      message: 'Invalid Place of Service code for behavioral health',
      hint: 'Use code 11 (Office), 53 (Community Mental Health), or other valid POS code',
      severity: 'error'
    });
  }

  // CPT code validation
  const validCptCodes = ['90791', '90834', '90837', '90853'];
  if (data.cptCode && !validCptCodes.includes(data.cptCode)) {
    errors.push({
      code: SCRUB_ERROR_CODES.E103,
      field: 'cptCode',
      message: 'CPT code not approved for Billing-Lite',
      hint: 'Select from approved codes: 90791, 90834, 90837, 90853',
      severity: 'error'
    });
  }

  // Modifier count validation
  if (data.modifiers && data.modifiers.length > 4) {
    errors.push({
      code: SCRUB_ERROR_CODES.E104,
      field: 'modifiers',
      message: 'Maximum 4 modifiers allowed',
      hint: 'Remove excess modifiers or combine related services',
      severity: 'error'
    });
  }

  // Units validation
  if (data.units && data.units > 99) {
    errors.push({
      code: SCRUB_ERROR_CODES.E203,
      field: 'units',
      message: 'Units cannot exceed 99',
      hint: 'Split into multiple line items if more than 99 units needed',
      severity: 'error'
    });
  }
}

function validateBusinessRules(data: ChargeData, errors: ScrubError[]): void {
  // Diagnosis pointer validation
  if (data.diagnosisPointers && data.diagnosisPointers.length > 0) {
    const validPointers = ['A', 'B', 'C', 'D'];
    const maxDiagnosisIndex = Math.min((data.diagnosisCodes?.length || 0) - 1, 3);
    const maxValidPointer = String.fromCharCode(65 + maxDiagnosisIndex); // A=0, B=1, etc.

    for (const pointer of data.diagnosisPointers) {
      if (!validPointers.includes(pointer)) {
        errors.push({
          code: SCRUB_ERROR_CODES.E105,
          field: 'diagnosisPointers',
          message: 'Invalid diagnosis pointer',
          hint: 'Use only A, B, C, or D to reference diagnosis codes',
          severity: 'error'
        });
      } else if (pointer > maxValidPointer) {
        errors.push({
          code: SCRUB_ERROR_CODES.E200,
          field: 'diagnosisPointers',
          message: `Diagnosis pointer ${pointer} references non-existent diagnosis code`,
          hint: `Add diagnosis code ${pointer} or remove the pointer`,
          severity: 'error'
        });
      }
    }
  }

  // Minimum charge amount validation
  if (data.chargeAmount && data.chargeAmount < 1.00) {
    errors.push({
      code: SCRUB_ERROR_CODES.E204,
      field: 'chargeAmount',
      message: 'Charge amount below reasonable minimum',
      hint: 'Verify charge amount is correct (minimum $1.00)',
      severity: 'error'
    });
  }
}

function generateWarnings(data: ChargeData, warnings: ScrubWarning[]): void {
  // Missing prior auth warning
  if (!data.priorAuthNumber && data.chargeAmount && data.chargeAmount > 500) {
    warnings.push({
      code: SCRUB_WARNING_CODES.W001,
      field: 'priorAuthNumber',
      message: 'Consider prior authorization for high-value services',
      hint: 'Some payers require prior auth for services over $500'
    });
  }

  // High unit count warning
  if (data.units && data.units > 20) {
    warnings.push({
      code: SCRUB_WARNING_CODES.W003,
      field: 'units',
      message: 'Unusually high unit count',
      hint: 'Verify units are correct and consider splitting if appropriate'
    });
  }

  // Unusual charge amount warning
  if (data.chargeAmount && data.cptCode) {
    const typicalRanges: Record<string, [number, number]> = {
      '90791': [200, 400],  // Initial eval
      '90834': [100, 200],  // 45-min therapy
      '90837': [120, 250],  // 60-min therapy
      '90853': [80, 150],   // Group therapy
    };

    const range = typicalRanges[data.cptCode];
    if (range && (data.chargeAmount < range[0] || data.chargeAmount > range[1])) {
      warnings.push({
        code: SCRUB_WARNING_CODES.W004,
        field: 'chargeAmount',
        message: `Charge amount outside typical range for ${data.cptCode}`,
        hint: `Typical range: $${range[0]}-$${range[1]}. Verify amount is correct.`
      });
    }
  }
}

/**
 * Get user-friendly error message with hint
 */
export function formatScrubError(error: ScrubError): string {
  return `${error.message}\n\nHow to fix: ${error.hint}`;
}

/**
 * Get summary of scrub results
 */
export function getScrubSummary(result: ScrubResult): string {
  const errorCount = result.errors.length;
  const warningCount = result.warnings.length;
  
  if (errorCount === 0 && warningCount === 0) {
    return 'Charge passed all validation checks.';
  }
  
  let summary = '';
  if (errorCount > 0) {
    summary += `${errorCount} error${errorCount > 1 ? 's' : ''} must be fixed before submission.`;
  }
  if (warningCount > 0) {
    if (summary) summary += ' ';
    summary += `${warningCount} warning${warningCount > 1 ? 's' : ''} should be reviewed.`;
  }
  
  return summary;
}