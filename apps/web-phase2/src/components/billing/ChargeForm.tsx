/**
 * Billing Charge Form Component
 * HIPAA-compliant charge capture with validation and scrubbing
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface ChargeFormData {
  patientId: string;
  cptCode: string;
  modifiers: string[];
  diagnosisCodes: string[];
  diagnosisPointers: string[];
  units: number;
  chargeAmount: number;
  posCode?: string;
  renderingProviderNPI?: string;
  billingProviderNPI?: string;
  billingTIN?: string;
  notes?: string;
}

interface ChargeFormProps {
  initialData?: Partial<ChargeFormData>;
  onSubmit: (data: ChargeFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  mode: 'create' | 'edit';
}

// CPT Codes with descriptions
const CPT_CODES = [
  { code: '90791', description: 'Psychiatric diagnostic evaluation', defaultAmount: 200.00 },
  { code: '90834', description: 'Psychotherapy, 45 minutes', defaultAmount: 150.00 },
  { code: '90837', description: 'Psychotherapy, 60 minutes', defaultAmount: 180.00 },
  { code: '90853', description: 'Group psychotherapy', defaultAmount: 100.00 },
];

// Common modifiers for behavioral health
const MODIFIERS = [
  { code: 'HK', description: 'Specialized mental health programs' },
  { code: 'HO', description: 'Mental health services provided in group' },
  { code: 'GT', description: 'Via telemedicine' },
  { code: '95', description: 'Telemedicine service' },
];

// Common diagnosis codes for behavioral health
const DIAGNOSIS_CODES = [
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified' },
  { code: 'F33.9', description: 'Major depressive disorder, recurrent, unspecified' },
  { code: 'F41.1', description: 'Generalized anxiety disorder' },
  { code: 'F41.9', description: 'Anxiety disorder, unspecified' },
  { code: 'F43.10', description: 'Post-traumatic stress disorder, unspecified' },
  { code: 'F10.20', description: 'Alcohol use disorder, moderate' },
  { code: 'F11.20', description: 'Opioid use disorder, moderate' },
];

// Place of Service codes
const POS_CODES = [
  { code: '11', description: 'Office' },
  { code: '02', description: 'Telehealth provided other than in patient\'s home' },
  { code: '10', description: 'Telehealth provided in patient\'s home' },
  { code: '53', description: 'Community mental health center' },
];

export default function ChargeForm({
  initialData = {},
  onSubmit,
  onCancel,
  isLoading = false,
  mode
}: ChargeFormProps): JSX.Element {
  const [formData, setFormData] = useState<ChargeFormData>({
    patientId: initialData.patientId || '',
    cptCode: initialData.cptCode || '',
    modifiers: initialData.modifiers || [],
    diagnosisCodes: initialData.diagnosisCodes || [],
    diagnosisPointers: initialData.diagnosisPointers || ['A'],
    units: initialData.units || 1,
    chargeAmount: initialData.chargeAmount || 0,
    posCode: initialData.posCode || '11',
    renderingProviderNPI: initialData.renderingProviderNPI || '',
    billingProviderNPI: initialData.billingProviderNPI || '',
    billingTIN: initialData.billingTIN || '',
    notes: initialData.notes || '',
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [scrubWarnings, setScrubWarnings] = useState<string[]>([]);

  const handleCPTCodeChange = (cptCode: string) => {
    const cptInfo = CPT_CODES.find(cpt => cpt.code === cptCode);
    setFormData(prev => ({
      ...prev,
      cptCode,
      chargeAmount: cptInfo?.defaultAmount || prev.chargeAmount
    }));
  };

  const handleModifierToggle = (modifier: string) => {
    setFormData(prev => ({
      ...prev,
      modifiers: prev.modifiers.includes(modifier)
        ? prev.modifiers.filter(m => m !== modifier)
        : [...prev.modifiers, modifier].slice(0, 4) // Max 4 modifiers
    }));
  };

  const handleDiagnosisCodeToggle = (code: string) => {
    setFormData(prev => ({
      ...prev,
      diagnosisCodes: prev.diagnosisCodes.includes(code)
        ? prev.diagnosisCodes.filter(c => c !== code)
        : [...prev.diagnosisCodes, code].slice(0, 4) // Max 4 diagnosis codes
    }));
  };

  const handleDiagnosisPointerToggle = (pointer: string) => {
    setFormData(prev => ({
      ...prev,
      diagnosisPointers: prev.diagnosisPointers.includes(pointer)
        ? prev.diagnosisPointers.filter(p => p !== pointer)
        : [...prev.diagnosisPointers, pointer]
    }));
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.patientId) errors.push('Patient ID is required');
    if (!formData.cptCode) errors.push('CPT code is required');
    if (formData.diagnosisCodes.length === 0) errors.push('At least one diagnosis code is required');
    if (formData.diagnosisPointers.length === 0) errors.push('At least one diagnosis pointer is required');
    if (formData.units < 1) errors.push('Units must be at least 1');
    if (formData.chargeAmount <= 0) errors.push('Charge amount must be greater than 0');

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting charge:', error);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Create New Charge' : 'Edit Charge'}
        </CardTitle>
        <CardDescription>
          Complete the form below to {mode === 'create' ? 'create' : 'update'} a billing charge. 
          All fields marked with * are required.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {validationErrors.map((error, index) => (
                    <div key={index}>• {error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Scrub Warnings */}
          {scrubWarnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium">Compliance Warnings:</div>
                  {scrubWarnings.map((warning, index) => (
                    <div key={index}>• {warning}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Patient Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Patient Information</h3>
              
              <div>
                <Label htmlFor="patientId">Patient ID *</Label>
                <Input
                  id="patientId"
                  value={formData.patientId}
                  onChange={(e) => setFormData(prev => ({ ...prev, patientId: e.target.value }))}
                  placeholder="Enter patient ID"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Service Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Service Information</h3>
              
              <div>
                <Label htmlFor="cptCode">CPT Code *</Label>
                <Select 
                  value={formData.cptCode} 
                  onValueChange={handleCPTCodeChange}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select CPT code" />
                  </SelectTrigger>
                  <SelectContent>
                    {CPT_CODES.map(cpt => (
                      <SelectItem key={cpt.code} value={cpt.code}>
                        {cpt.code} - {cpt.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="units">Units *</Label>
                  <Input
                    id="units"
                    type="number"
                    min="1"
                    max="99"
                    value={formData.units}
                    onChange={(e) => setFormData(prev => ({ ...prev, units: parseInt(e.target.value) || 1 }))}
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="chargeAmount">Charge Amount *</Label>
                  <Input
                    id="chargeAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.chargeAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, chargeAmount: parseFloat(e.target.value) || 0 }))}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="posCode">Place of Service</Label>
                <Select 
                  value={formData.posCode || '11'} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, posCode: value }))}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select place of service" />
                  </SelectTrigger>
                  <SelectContent>
                    {POS_CODES.map(pos => (
                      <SelectItem key={pos.code} value={pos.code}>
                        {pos.code} - {pos.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Modifiers */}
          <div>
            <Label>Service Modifiers</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {MODIFIERS.map(modifier => (
                <Badge
                  key={modifier.code}
                  variant={formData.modifiers.includes(modifier.code) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleModifierToggle(modifier.code)}
                >
                  {modifier.code} - {modifier.description}
                  {formData.modifiers.includes(modifier.code) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Diagnosis Codes */}
          <div>
            <Label>Diagnosis Codes * (Select up to 4)</Label>
            <div className="space-y-2 mt-2">
              {DIAGNOSIS_CODES.map(diagnosis => (
                <div key={diagnosis.code} className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id={`diagnosis-${diagnosis.code}`}
                    checked={formData.diagnosisCodes.includes(diagnosis.code)}
                    onChange={() => handleDiagnosisCodeToggle(diagnosis.code)}
                    className="mt-1"
                    disabled={isLoading || (!formData.diagnosisCodes.includes(diagnosis.code) && formData.diagnosisCodes.length >= 4)}
                  />
                  <Label htmlFor={`diagnosis-${diagnosis.code}`} className="text-sm">
                    <span className="font-medium">{diagnosis.code}</span> - {diagnosis.description}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnosis Pointers */}
          <div>
            <Label>Diagnosis Pointers *</Label>
            <div className="flex space-x-4 mt-2">
              {['A', 'B', 'C', 'D'].map(pointer => (
                <Badge
                  key={pointer}
                  variant={formData.diagnosisPointers.includes(pointer) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleDiagnosisPointerToggle(pointer)}
                >
                  {pointer}
                  {formData.diagnosisPointers.includes(pointer) && (
                    <CheckCircle className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Provider Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="renderingProviderNPI">Rendering Provider NPI</Label>
              <Input
                id="renderingProviderNPI"
                value={formData.renderingProviderNPI}
                onChange={(e) => setFormData(prev => ({ ...prev, renderingProviderNPI: e.target.value }))}
                placeholder="10-digit NPI"
                maxLength={10}
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="billingProviderNPI">Billing Provider NPI</Label>
              <Input
                id="billingProviderNPI"
                value={formData.billingProviderNPI}
                onChange={(e) => setFormData(prev => ({ ...prev, billingProviderNPI: e.target.value }))}
                placeholder="10-digit NPI"
                maxLength={10}
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="billingTIN">Billing TIN</Label>
              <Input
                id="billingTIN"
                value={formData.billingTIN}
                onChange={(e) => setFormData(prev => ({ ...prev, billingTIN: e.target.value }))}
                placeholder="XX-XXXXXXX"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Internal Use)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes for this charge..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create Charge' : 'Update Charge'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}