/**
 * Billing Integration Tests
 * End-to-end tests for billing workflow from UI to API
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillingPage from '../page';

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock toast notifications
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Billing Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('mock_access_token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  describe('Full Charge Creation Workflow', () => {
    it('creates a charge from start to finish', async () => {
      const user = userEvent.setup();
      
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            charge: {
              id: 'charge_123',
              patientId: 'patient_123',
              cptCode: '90834',
              chargeAmount: 150.00,
              status: 'DRAFT',
            },
            scrubResult: {
              warnings: [],
              isCompliant: true,
            },
          },
        }),
      });

      render(<BillingPage />);

      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });

      // Click "New Charge" button
      const newChargeButton = screen.getByRole('button', { name: /New Charge/ });
      await user.click(newChargeButton);

      // Should navigate to charge form
      await waitFor(() => {
        expect(screen.getByText('Create New Charge')).toBeInTheDocument();
      });

      // Fill in the form
      await user.type(screen.getByLabelText(/Patient ID/), 'patient_123');
      
      // Select CPT code
      const cptSelect = screen.getByLabelText(/CPT Code/);
      await user.selectOptions(cptSelect, '90834');

      // Select diagnosis code
      const diagnosisCheckbox = screen.getByLabelText(/F32.9/);
      await user.click(diagnosisCheckbox);

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      await user.click(submitButton);

      // Verify API was called with correct data
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/billing/charges',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock_access_token',
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('"patientId":"patient_123"'),
          })
        );
      });

      // Should navigate back to dashboard after successful creation
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });
    });

    it('handles charge creation errors gracefully', async () => {
      const { toast } = require('sonner');
      const user = userEvent.setup();

      // Mock API error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: ['CPT code is required'],
        }),
      });

      render(<BillingPage />);

      // Navigate to charge form and submit invalid data
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });

      const newChargeButton = screen.getByRole('button', { name: /New Charge/ });
      await user.click(newChargeButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Charge')).toBeInTheDocument();
      });

      // Submit form without required fields
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      await user.click(submitButton);

      // Should show error toast
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Validation failed');
      });

      // Should stay on form page
      expect(screen.getByText('Create New Charge')).toBeInTheDocument();
    });
  });

  describe('Superbill Generation Workflow', () => {
    it('generates and downloads superbill PDF', async () => {
      const user = userEvent.setup();

      // Mock superbill API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            downloadUrl: 'https://example.com/superbill.pdf',
            filename: 'CMS1500_John_D_20240101.pdf',
            fileSize: 123456,
            warnings: [],
          },
        }),
      });

      // Mock document.createElement for download
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      jest.spyOn(document.body, 'appendChild').mockImplementation();
      jest.spyOn(document.body, 'removeChild').mockImplementation();

      render(<BillingPage />);

      // Wait for dashboard and find superbill button
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });

      // Click superbill generation button (assuming it exists in the table)
      const superbillButtons = screen.getAllByTestId(/superbill-/);
      if (superbillButtons.length > 0) {
        await user.click(superbillButtons[0]);

        // Verify API call
        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/billing/superbill/'),
            expect.objectContaining({
              method: 'POST',
              headers: expect.objectContaining({
                'Authorization': 'Bearer mock_access_token',
              }),
            })
          );
        });

        // Verify download was triggered
        await waitFor(() => {
          expect(mockLink.href).toBe('https://example.com/superbill.pdf');
          expect(mockLink.download).toBe('CMS1500_John_D_20240101.pdf');
          expect(mockLink.click).toHaveBeenCalled();
        });
      }
    });

    it('handles superbill generation errors', async () => {
      const { toast } = require('sonner');
      const user = userEvent.setup();

      // Mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'CMS-1500 data validation failed',
          code: 'CMS1500_VALIDATION_ERROR',
          details: {
            errors: ['Missing rendering provider NPI'],
            warnings: [],
          },
        }),
      });

      render(<BillingPage />);

      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });

      const superbillButtons = screen.getAllByTestId(/superbill-/);
      if (superbillButtons.length > 0) {
        await user.click(superbillButtons[0]);

        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith('CMS-1500 data validation failed');
        });
      }
    });
  });

  describe('Export Workflow', () => {
    it('exports charges as CSV with dialog', async () => {
      const user = userEvent.setup();

      // Mock export API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            downloadUrl: 'https://example.com/export.csv',
            filename: 'serenity_charges_20240101.csv',
            exportCount: 25,
            fileSize: 54321,
          },
        }),
      });

      // Mock download link
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      jest.spyOn(document.body, 'appendChild').mockImplementation();
      jest.spyOn(document.body, 'removeChild').mockImplementation();

      render(<BillingPage />);

      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });

      // Click Export button
      const exportButton = screen.getByRole('button', { name: /Export/ });
      await user.click(exportButton);

      // Should open export dialog
      await waitFor(() => {
        expect(screen.getByText('Export Charges')).toBeInTheDocument();
      });

      // Select CSV export option
      const csvButton = screen.getByRole('button', { name: /Export as CSV \(De-identified\)/ });
      await user.click(csvButton);

      // Verify API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/billing/export',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock_access_token',
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('"format":"csv"'),
          })
        );
      });

      // Verify download was triggered
      await waitFor(() => {
        expect(mockLink.click).toHaveBeenCalled();
      });

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText('Export Charges')).not.toBeInTheDocument();
      });
    });
  });

  describe('Authentication Integration', () => {
    it('handles authentication errors across all endpoints', async () => {
      const { toast } = require('sonner');
      const user = userEvent.setup();

      // Mock 401 response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Missing or invalid authorization header',
          code: 'UNAUTHORIZED',
        }),
      });

      render(<BillingPage />);

      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });

      // Try to create a charge - should fail with auth error
      const newChargeButton = screen.getByRole('button', { name: /New Charge/ });
      await user.click(newChargeButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Charge')).toBeInTheDocument();
      });

      // Fill minimal form and submit
      await user.type(screen.getByLabelText(/Patient ID/), 'patient_123');
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      await user.click(submitButton);

      // Should show authentication error
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Missing or invalid authorization header');
      });
    });
  });

  describe('Error Boundary Integration', () => {
    it('handles unexpected errors gracefully', async () => {
      // Mock fetch to throw network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { toast } = require('sonner');
      const user = userEvent.setup();

      render(<BillingPage />);

      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });

      // Try an action that will fail
      const exportButton = screen.getByRole('button', { name: /Export/ });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Charges')).toBeInTheDocument();
      });

      const csvButton = screen.getByRole('button', { name: /Export as CSV \(De-identified\)/ });
      await user.click(csvButton);

      // Should handle network error gracefully
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to export charges');
      });
    });
  });

  describe('Real-time Updates', () => {
    it('updates UI after successful operations', async () => {
      const { toast } = require('sonner');
      const user = userEvent.setup();

      // Mock successful charge creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            charge: {
              id: 'charge_new',
              status: 'DRAFT',
            },
            scrubResult: {
              warnings: ['Place of service code is recommended'],
              isCompliant: true,
            },
          },
        }),
      });

      render(<BillingPage />);

      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });

      // Create a charge
      const newChargeButton = screen.getByRole('button', { name: /New Charge/ });
      await user.click(newChargeButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Charge')).toBeInTheDocument();
      });

      // Fill and submit form
      await user.type(screen.getByLabelText(/Patient ID/), 'patient_new');
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      await user.click(submitButton);

      // Should show success message
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Charge created successfully');
      });

      // Should show warning for scrub result
      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith(
          'Compliance warnings: Place of service code is recommended'
        );
      });

      // Should navigate back to dashboard
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation Integration', () => {
    it('prevents submission with client-side validation', async () => {
      const user = userEvent.setup();

      render(<BillingPage />);

      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });

      const newChargeButton = screen.getByRole('button', { name: /New Charge/ });
      await user.click(newChargeButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Charge')).toBeInTheDocument();
      });

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      await user.click(submitButton);

      // Should show client-side validation errors
      await waitFor(() => {
        expect(screen.getByText(/Patient ID is required/)).toBeInTheDocument();
        expect(screen.getByText(/CPT code is required/)).toBeInTheDocument();
      });

      // API should not be called
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});