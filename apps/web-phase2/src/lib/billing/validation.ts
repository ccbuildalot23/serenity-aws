import { z } from 'zod';

/**
 * Billing-Lite Validation Schemas
 * Zod schemas for charge validation and CMS-1500 compliance
 */

// CPT Code validation - only allow approved codes
export const APPROVED_CPT_CODES = ['90791', '90834', '90837', '90853'] as const;

export const cptCodeSchema = z.enum(APPROVED_CPT_CODES, {
  errorMap: () => ({ message: 'CPT code must be one of: 90791, 90834, 90837, 90853' })
});

// Modifier validation - common behavioral health modifiers
export const COMMON_MODIFIERS = [
  'HK', // Specialized mental health programs
  'HO', // Mental health services provided in group
  'GT', // Via telemedicine
  '95', // Telemedicine service
  'XE', // Separate encounter
  'XS', // Separate structure
  'XP', // Separate practitioner
  'XU', // Unusual non-overlapping service
] as const;

export const modifierSchema = z.array(z.enum(COMMON_MODIFIERS)).max(4, {
  message: 'Maximum 4 modifiers allowed'
});

// Diagnosis pointer validation (A, B, C, D)
export const diagnosisPointerSchema = z.array(
  z.enum(['A', 'B', 'C', 'D'], {
    errorMap: () => ({ message: 'Diagnosis pointers must be A, B, C, or D' })
  })
).max(4, {
  message: 'Maximum 4 diagnosis pointers allowed'
});

// NPI validation (10 digits)
export const npiSchema = z.string().regex(/^\d{10}$/, {
  message: 'NPI must be exactly 10 digits'
}).optional();

// TIN validation (9 digits, EIN format)
export const tinSchema = z.string().regex(/^\d{2}-\d{7}$/, {
  message: 'TIN must be in format XX-XXXXXXX'
}).optional();

// Place of Service validation - common codes for behavioral health
export const COMMON_POS_CODES = [
  '11', // Office
  '12', // Home
  '19', // Off Campus-Outpatient Hospital
  '22', // On Campus-Outpatient Hospital
  '49', // Independent Clinic
  '53', // Community Mental Health Center
  '71', // Public Health Clinic
  '99', // Other Place of Service
] as const;

export const posCodeSchema = z.enum(COMMON_POS_CODES, {
  errorMap: () => ({ 
    message: 'Invalid Place of Service code for behavioral health services' 
  })
}).optional();

// ICD-10 code validation for behavioral health
export const icd10Schema = z.string().regex(/^[F-Z]\d{2}(\.\d{1,3})?$/, {
  message: 'ICD-10 code must be valid format (e.g., F32.9)'
});

// Core charge validation schema
export const chargeCreateSchema = z.object({
  // Required fields
  providerId: z.string().cuid('Invalid provider ID'),
  patientId: z.string().cuid('Invalid patient ID'),
  cptCode: cptCodeSchema,
  units: z.number().int().min(1, 'Units must be at least 1').max(99, 'Units cannot exceed 99'),
  chargeAmount: z.number().positive('Charge amount must be positive'),
  
  // Optional arrays
  modifiers: modifierSchema.optional().default([]),
  diagnosisCodes: z.array(icd10Schema).max(12, 'Maximum 12 diagnosis codes').optional().default([]),
  diagnosisPointers: diagnosisPointerSchema.optional().default([]),
  
  // CMS-1500 fields
  posCode: posCodeSchema.optional(),
  renderingProviderNPI: npiSchema,
  billingProviderNPI: npiSchema,
  billingTIN: tinSchema,
  payerId: z.string().optional(),
  insuredId: z.string().optional(),
  acceptAssignment: z.boolean().default(true),
  signatureOnFile: z.boolean().default(true),
  
  // Additional fields
  serviceFacilityId: z.string().optional(),
  referringProviderNPI: npiSchema,
  priorAuthNumber: z.string().max(30).optional(),
  claimNotes: z.string().max(80).optional(), // Box 19 limit
});

export const chargeUpdateSchema = chargeCreateSchema.partial().extend({
  id: z.string().cuid('Invalid charge ID')
});

// Export request validation
export const exportRequestSchema = z.object({
  format: z.enum(['csv', 'json'], {
    errorMap: () => ({ message: 'Format must be csv or json' })
  }),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'READY_FOR_EXPORT', 'EXPORTED']).optional(),
  patientId: z.string().cuid().optional(),
});

// Superbill generation validation
export const superbillRequestSchema = z.object({
  chargeId: z.string().cuid('Invalid charge ID')
});

/**
 * Type definitions derived from schemas
 */
export type ChargeCreateInput = z.infer<typeof chargeCreateSchema>;
export type ChargeUpdateInput = z.infer<typeof chargeUpdateSchema>;
export type ExportRequestInput = z.infer<typeof exportRequestSchema>;
export type SuperbillRequestInput = z.infer<typeof superbillRequestSchema>;

/**
 * Validation helper functions
 */
export function validateChargeCreate(data: unknown): ChargeCreateInput {
  return chargeCreateSchema.parse(data);
}

export function validateChargeUpdate(data: unknown): ChargeUpdateInput {
  return chargeUpdateSchema.parse(data);
}

export function validateExportRequest(data: unknown): ExportRequestInput {
  return exportRequestSchema.parse(data);
}

export function validateSuperbillRequest(data: unknown): SuperbillRequestInput {
  return superbillRequestSchema.parse(data);
}

/**
 * Safe validation functions that return results instead of throwing
 */
export function safeValidateChargeCreate(data: unknown) {
  return chargeCreateSchema.safeParse(data);
}

export function safeValidateChargeUpdate(data: unknown) {
  return chargeUpdateSchema.safeParse(data);
}

export function safeValidateExportRequest(data: unknown) {
  return exportRequestSchema.safeParse(data);
}

export function safeValidateSuperbillRequest(data: unknown) {
  return superbillRequestSchema.safeParse(data);
}