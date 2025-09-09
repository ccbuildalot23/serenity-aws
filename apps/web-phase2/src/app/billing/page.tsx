/**
 * Billing Page - Provider Billing Interface
 * Main entry point for billing functionality with charge management
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BillingDashboard from '@/components/billing/BillingDashboard';
import ChargeForm from '@/components/billing/ChargeForm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import SessionTimeout from '@/components/compliance/SessionTimeout';

type ViewMode = 'dashboard' | 'create-charge' | 'edit-charge';

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

export default function BillingPage(): JSX.Element {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showExportDialog, setShowExportDialog] = useState<boolean>(false);

  const handleCreateCharge = () => {
    setEditingChargeId(null);
    setViewMode('create-charge');
  };

  const handleEditCharge = (chargeId: string) => {
    setEditingChargeId(chargeId);
    setViewMode('edit-charge');
  };

  const handleDeleteCharge = async (chargeId: string) => {
    if (!confirm('Are you sure you want to delete this charge? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/billing/charges/${chargeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete charge');
      }

      toast.success('Charge deleted successfully');
      // In a real app, we'd refresh the charges list here
    } catch (error) {
      console.error('Error deleting charge:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete charge');
    }
  };

  const handleGenerateSuperbill = async (chargeId: string) => {
    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/billing/superbill/${chargeId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate superbill');
      }

      const result = await response.json();
      
      if (result.success && result.data.downloadUrl) {
        // Create a temporary link to download the PDF
        const link = document.createElement('a');
        link.href = result.data.downloadUrl;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success(`Superbill generated: ${result.data.filename}`);
        
        if (result.data.warnings && result.data.warnings.length > 0) {
          console.warn('Superbill warnings:', result.data.warnings);
        }
      } else {
        throw new Error('Invalid response from superbill generation');
      }
    } catch (error) {
      console.error('Error generating superbill:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate superbill');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCharges = () => {
    setShowExportDialog(true);
  };

  const handleSubmitCharge = async (data: ChargeFormData) => {
    setIsSubmitting(true);
    
    try {
      const isEditing = viewMode === 'edit-charge' && editingChargeId;
      const endpoint = isEditing 
        ? `/api/billing/charges/${editingChargeId}`
        : '/api/billing/charges';
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} charge`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Charge ${isEditing ? 'updated' : 'created'} successfully`);
        
        // Show scrub warnings if any
        if (result.data.scrubResult?.warnings?.length > 0) {
          toast.warning(
            `Compliance warnings: ${result.data.scrubResult.warnings.join(', ')}`
          );
        }
        
        setViewMode('dashboard');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error submitting charge:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit charge');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelForm = () => {
    setViewMode('dashboard');
    setEditingChargeId(null);
  };

  const handleExportSubmit = async (format: 'csv' | 'json', includePatientNames: boolean) => {
    try {
      setIsSubmitting(true);
      const response = await fetch('/api/billing/export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          includePatientNames,
          dateRange: {
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
            endDate: new Date().toISOString()
          },
          filters: {
            status: ['SUBMITTED', 'ACCEPTED', 'PAID'] // Only export submitted charges
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export charges');
      }

      const result = await response.json();
      
      if (result.success && result.data.downloadUrl) {
        // Create a temporary link to download the export
        const link = document.createElement('a');
        link.href = result.data.downloadUrl;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success(`Export generated: ${result.data.exportCount} charges exported`);
        setShowExportDialog(false);
      } else {
        throw new Error('Invalid response from export service');
      }
    } catch (error) {
      console.error('Error exporting charges:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export charges');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render based on current view mode
  if (viewMode === 'create-charge') {
    return (
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={handleCancelForm} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        
        <ChargeForm
          mode="create"
          onSubmit={handleSubmitCharge}
          onCancel={handleCancelForm}
          isLoading={isSubmitting}
        />
        
        {/* Session Timeout Component */}
        <SessionTimeout
          timeoutMinutes={15}
          warningMinutes={2}
          onTimeout={() => router.push('/login?reason=timeout')}
        />
      </div>
    );
  }

  if (viewMode === 'edit-charge' && editingChargeId) {
    return (
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={handleCancelForm} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        
        <ChargeForm
          mode="edit"
          initialData={{
            // In a real app, we'd fetch the charge data here
            patientId: 'patient_1',
            cptCode: '90834',
            modifiers: ['GT'],
            diagnosisCodes: ['F32.9'],
            diagnosisPointers: ['A'],
            units: 1,
            chargeAmount: 150.00,
          }}
          onSubmit={handleSubmitCharge}
          onCancel={handleCancelForm}
          isLoading={isSubmitting}
        />
        
        {/* Session Timeout Component */}
        <SessionTimeout
          timeoutMinutes={15}
          warningMinutes={2}
          onTimeout={() => router.push('/login?reason=timeout')}
        />
      </div>
    );
  }

  // Default dashboard view
  return (
    <div className="container mx-auto py-6">
      <BillingDashboard
        onCreateCharge={handleCreateCharge}
        onEditCharge={handleEditCharge}
        onDeleteCharge={handleDeleteCharge}
        onGenerateSuperbill={handleGenerateSuperbill}
        onExportCharges={handleExportCharges}
      />

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Export Charges</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Export your billing charges for the last 30 days.
            </p>
            
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => handleExportSubmit('csv', false)}
                disabled={isSubmitting}
                className="w-full justify-start"
              >
                Export as CSV (De-identified)
              </Button>
              
              <Button
                onClick={() => handleExportSubmit('csv', true)}
                disabled={isSubmitting}
                variant="outline"
                className="w-full justify-start"
              >
                Export as CSV (With Patient Names)
              </Button>
              
              <Button
                onClick={() => handleExportSubmit('json', false)}
                disabled={isSubmitting}
                variant="outline"
                className="w-full justify-start"
              >
                Export as JSON (De-identified)
              </Button>
            </div>
            
            <div className="mt-4">
              <Button
                onClick={() => setShowExportDialog(false)}
                variant="ghost"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Session Timeout Component */}
      <SessionTimeout
        timeoutMinutes={15}
        warningMinutes={2}
        onTimeout={() => router.push('/login?reason=timeout')}
      />
    </div>
  );
}