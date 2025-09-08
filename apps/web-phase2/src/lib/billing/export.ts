/**
 * Billing Export Service
 * CSV/JSON export utilities for charge data
 */

import { format } from 'date-fns';

export interface ChargeExportData {
  id: string;
  chargeDate: Date;
  patientId: string; // De-identified
  patientInitials?: string; // Non-PHI identifier
  providerId: string;
  providerName?: string;
  cptCode: string;
  cptDescription: string;
  modifiers: string[];
  diagnosisPointers: string[];
  diagnosisCodes: string[];
  units: number;
  chargeAmount: number;
  posCode?: string;
  status: string;
  exportBatchId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportOptions {
  format: 'csv' | 'json';
  includeHeaders?: boolean;
  dateFormat?: string;
  includeMetadata?: boolean;
}

export interface ExportResult {
  data: string;
  filename: string;
  contentType: string;
  recordCount: number;
  exportedAt: Date;
}

export interface ExportMetadata {
  exportedBy: string;
  exportedAt: string;
  totalRecords: number;
  format: string;
  filters?: Record<string, any>;
}

/**
 * CPT code descriptions for export
 */
const CPT_DESCRIPTIONS: Record<string, string> = {
  '90791': 'Psychiatric diagnostic evaluation',
  '90834': 'Psychotherapy, 45 minutes',
  '90837': 'Psychotherapy, 60 minutes', 
  '90853': 'Group psychotherapy (other than of a multiple-family group)',
};

/**
 * Export charges to CSV format
 */
export function exportToCSV(
  charges: ChargeExportData[], 
  options: ExportOptions = { format: 'csv' }
): ExportResult {
  const { includeHeaders = true, dateFormat = 'MM/dd/yyyy' } = options;
  
  const headers = [
    'Charge ID',
    'Date of Service',
    'Patient ID',
    'Patient Initials',
    'Provider ID', 
    'Provider Name',
    'CPT Code',
    'CPT Description',
    'Modifiers',
    'Diagnosis Pointers',
    'Diagnosis Codes',
    'Units',
    'Charge Amount',
    'Place of Service',
    'Status',
    'Created Date',
    'Updated Date'
  ];

  const rows = charges.map(charge => [
    charge.id,
    format(charge.chargeDate, dateFormat),
    charge.patientId,
    charge.patientInitials || '',
    charge.providerId,
    charge.providerName || '',
    charge.cptCode,
    CPT_DESCRIPTIONS[charge.cptCode] || '',
    charge.modifiers.join(';'),
    charge.diagnosisPointers.join(';'),
    charge.diagnosisCodes.join(';'),
    charge.units.toString(),
    charge.chargeAmount.toFixed(2),
    charge.posCode || '',
    charge.status,
    format(charge.createdAt, dateFormat),
    format(charge.updatedAt, dateFormat)
  ]);

  const csvContent = [];
  
  if (includeHeaders) {
    csvContent.push(headers.join(','));
  }
  
  rows.forEach(row => {
    // Escape quotes and wrap fields with commas/quotes
    const escapedRow = row.map(field => {
      const stringField = String(field || '');
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    });
    csvContent.push(escapedRow.join(','));
  });

  const exportedAt = new Date();
  const filename = `serenity_charges_${format(exportedAt, 'yyyyMMdd_HHmmss')}.csv`;
  
  return {
    data: csvContent.join('\n'),
    filename,
    contentType: 'text/csv',
    recordCount: charges.length,
    exportedAt
  };
}

/**
 * Export charges to JSON format
 */
export function exportToJSON(
  charges: ChargeExportData[],
  options: ExportOptions = { format: 'json' }
): ExportResult {
  const { includeMetadata = true, dateFormat = 'yyyy-MM-dd HH:mm:ss' } = options;
  
  // Transform data for JSON export
  const transformedCharges = charges.map(charge => ({
    id: charge.id,
    dateOfService: format(charge.chargeDate, dateFormat),
    patient: {
      id: charge.patientId,
      initials: charge.patientInitials || null
    },
    provider: {
      id: charge.providerId,
      name: charge.providerName || null
    },
    service: {
      cptCode: charge.cptCode,
      description: CPT_DESCRIPTIONS[charge.cptCode] || null,
      modifiers: charge.modifiers,
      units: charge.units,
      amount: charge.chargeAmount,
      posCode: charge.posCode || null
    },
    diagnosis: {
      codes: charge.diagnosisCodes,
      pointers: charge.diagnosisPointers
    },
    status: charge.status,
    exportBatchId: charge.exportBatchId || null,
    timestamps: {
      created: format(charge.createdAt, dateFormat),
      updated: format(charge.updatedAt, dateFormat)
    }
  }));

  const exportedAt = new Date();
  
  const jsonData: any = {
    charges: transformedCharges
  };

  if (includeMetadata) {
    jsonData.metadata = {
      exportedAt: format(exportedAt, 'yyyy-MM-dd HH:mm:ss'),
      totalRecords: charges.length,
      format: 'json',
      version: '1.0'
    };
  }

  const filename = `serenity_charges_${format(exportedAt, 'yyyyMMdd_HHmmss')}.json`;
  
  return {
    data: JSON.stringify(jsonData, null, 2),
    filename,
    contentType: 'application/json',
    recordCount: charges.length,
    exportedAt
  };
}

/**
 * Main export function that routes to appropriate format handler
 */
export function exportCharges(
  charges: ChargeExportData[],
  options: ExportOptions
): ExportResult {
  switch (options.format) {
    case 'csv':
      return exportToCSV(charges, options);
    case 'json':
      return exportToJSON(charges, options);
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

/**
 * Generate export batch ID
 */
export function generateExportBatchId(): string {
  const timestamp = format(new Date(), 'yyyyMMddHHmmss');
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `BATCH_${timestamp}_${random}`;
}

/**
 * Validate export data before processing
 */
export function validateExportData(charges: ChargeExportData[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!charges || charges.length === 0) {
    errors.push('No charge data provided for export');
    return { isValid: false, errors };
  }

  // Check for required fields
  charges.forEach((charge, index) => {
    if (!charge.id) {
      errors.push(`Row ${index + 1}: Missing charge ID`);
    }
    if (!charge.cptCode) {
      errors.push(`Row ${index + 1}: Missing CPT code`);
    }
    if (!charge.chargeAmount || charge.chargeAmount <= 0) {
      errors.push(`Row ${index + 1}: Invalid charge amount`);
    }
    if (!charge.units || charge.units < 1) {
      errors.push(`Row ${index + 1}: Invalid units`);
    }
  });

  // Check for data consistency
  const uniqueIds = new Set(charges.map(c => c.id));
  if (uniqueIds.size !== charges.length) {
    errors.push('Duplicate charge IDs found in export data');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get export summary statistics
 */
export function getExportSummary(charges: ChargeExportData[]): {
  totalCharges: number;
  totalAmount: number;
  cptCodeBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  dateRange: { earliest: Date; latest: Date } | null;
} {
  if (charges.length === 0) {
    return {
      totalCharges: 0,
      totalAmount: 0,
      cptCodeBreakdown: {},
      statusBreakdown: {},
      dateRange: null
    };
  }

  const totalAmount = charges.reduce((sum, charge) => sum + charge.chargeAmount, 0);
  
  const cptCodeBreakdown: Record<string, number> = {};
  const statusBreakdown: Record<string, number> = {};
  
  let earliest = charges[0].chargeDate;
  let latest = charges[0].chargeDate;

  charges.forEach(charge => {
    // CPT code breakdown
    cptCodeBreakdown[charge.cptCode] = (cptCodeBreakdown[charge.cptCode] || 0) + 1;
    
    // Status breakdown
    statusBreakdown[charge.status] = (statusBreakdown[charge.status] || 0) + 1;
    
    // Date range
    if (charge.chargeDate < earliest) earliest = charge.chargeDate;
    if (charge.chargeDate > latest) latest = charge.chargeDate;
  });

  return {
    totalCharges: charges.length,
    totalAmount,
    cptCodeBreakdown,
    statusBreakdown,
    dateRange: { earliest, latest }
  };
}