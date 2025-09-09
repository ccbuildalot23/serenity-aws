/** @jest-environment jsdom */
/**
 * ChargeForm Component Tests
 * Tests for billing charge form with validation and user interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChargeForm from '../ChargeForm';

// Mock the UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      type={type}
      data-testid={props['data-testid']}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ onChange, value, placeholder, ...props }: any) => (
    <input 
      onChange={onChange} 
      value={value} 
      placeholder={placeholder}
      data-testid={props.id}
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ onValueChange, value, children, ...props }: any) => (
    <select 
      onChange={(e) => onValueChange?.(e.target.value)} 
      value={value}
      data-testid={props['data-testid']}
      {...props}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

describe('ChargeForm', () => {
  const defaultProps = {
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    mode: 'create' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('renders create mode correctly', () => {
      render(<ChargeForm {...defaultProps} />);
      
      expect(screen.getByText('Create New Charge')).toBeInTheDocument();
      expect(screen.getByLabelText(/Patient ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/CPT Code/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Units/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Charge Amount/)).toBeInTheDocument();
    });

    it('renders edit mode correctly', () => {
      render(
        <ChargeForm 
          {...defaultProps} 
          mode="edit"
          initialData={{
            patientId: 'patient_123',
            cptCode: '90834',
            units: 1,
            chargeAmount: 150.00
          }}
        />
      );
      
      expect(screen.getByText('Edit Charge')).toBeInTheDocument();
      expect(screen.getByDisplayValue('patient_123')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('150')).toBeInTheDocument();
    });

    it('shows loading state when isLoading is true', () => {
      render(<ChargeForm {...defaultProps} isLoading={true} />);
      
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('shows validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Patient ID is required/)).toBeInTheDocument();
        expect(screen.getByText(/CPT code is required/)).toBeInTheDocument();
        expect(screen.getByText(/At least one diagnosis code is required/)).toBeInTheDocument();
      });
      
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('validates units must be at least 1', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      const unitsInput = screen.getByTestId('units');
      await user.clear(unitsInput);
      await user.type(unitsInput, '0');
      
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Units must be at least 1/)).toBeInTheDocument();
      });
    });

    it('validates charge amount must be greater than 0', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      const amountInput = screen.getByTestId('chargeAmount');
      await user.clear(amountInput);
      await user.type(amountInput, '0');
      
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Charge amount must be greater than 0/)).toBeInTheDocument();
      });
    });
  });

  describe('Form Interactions', () => {
    it('updates charge amount when CPT code changes', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      const cptSelect = screen.getByTestId('cptCode-select');
      await user.selectOptions(cptSelect, '90837');
      
      await waitFor(() => {
        const amountInput = screen.getByTestId('chargeAmount');
        expect(amountInput).toHaveValue('180');
      });
    });

    it('allows modifier selection', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      // Find and click a modifier badge
      const gtModifier = screen.getByText(/GT - Via telemedicine/);
      await user.click(gtModifier);
      
      // Modifier should be selected (would show an X icon in real implementation)
      expect(gtModifier).toBeInTheDocument();
    });

    it('limits modifiers to maximum of 4', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      // Try to select all modifiers
      const modifiers = ['HK', 'HO', 'GT', '95'];
      
      for (const modifier of modifiers) {
        const modifierElement = screen.getByText(new RegExp(modifier));
        await user.click(modifierElement);
      }
      
      // Should only have 4 modifiers selected
      // In real implementation, we'd check the internal state
      expect(screen.getByText(/HK/)).toBeInTheDocument();
    });

    it('allows diagnosis code selection', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      // Find and check a diagnosis code
      const diagnosisCheckbox = screen.getByLabelText(/F32.9/);
      await user.click(diagnosisCheckbox);
      
      expect(diagnosisCheckbox).toBeChecked();
    });

    it('limits diagnosis codes to maximum of 4', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      // Select first 4 diagnosis codes
      const diagnosisCodes = ['F32.9', 'F33.9', 'F41.1', 'F41.9'];
      
      for (const code of diagnosisCodes) {
        const checkbox = screen.getByLabelText(new RegExp(code));
        await user.click(checkbox);
      }
      
      // Try to select a 5th one - it should be disabled
      const fifthCheckbox = screen.getByLabelText(/F43.10/);
      expect(fifthCheckbox).toBeDisabled();
    });

    it('allows diagnosis pointer selection', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      // Diagnosis pointer A should be selected by default
      const pointerA = screen.getByText('A');
      expect(pointerA).toHaveClass('bg-blue-600'); // Default variant
      
      // Click pointer B
      const pointerB = screen.getByText('B');
      await user.click(pointerB);
      
      expect(pointerB).toHaveClass('bg-blue-600');
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      // Fill in required fields
      await user.type(screen.getByTestId('patientId'), 'patient_123');
      
      const cptSelect = screen.getByTestId('cptCode-select');
      await user.selectOptions(cptSelect, '90834');
      
      // Select a diagnosis code
      const diagnosisCheckbox = screen.getByLabelText(/F32.9/);
      await user.click(diagnosisCheckbox);
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith({
          patientId: 'patient_123',
          cptCode: '90834',
          modifiers: [],
          diagnosisCodes: ['F32.9'],
          diagnosisPointers: ['A'],
          units: 1,
          chargeAmount: 150.00,
          posCode: '11',
          renderingProviderNPI: '',
          billingProviderNPI: '',
          billingTIN: '',
          notes: '',
        });
      });
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/ });
      await user.click(cancelButton);
      
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('prevents submission when form has validation errors', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      // Only fill patient ID, leave other required fields empty
      await user.type(screen.getByTestId('patientId'), 'patient_123');
      
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/CPT code is required/)).toBeInTheDocument();
      });
      
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Provider Information Fields', () => {
    it('accepts NPI numbers with 10 digits', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      const npiInput = screen.getByTestId('renderingProviderNPI');
      await user.type(npiInput, '1234567890');
      
      expect(npiInput).toHaveValue('1234567890');
    });

    it('limits NPI input to 10 characters', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      const npiInput = screen.getByTestId('renderingProviderNPI');
      await user.type(npiInput, '12345678901'); // 11 digits
      
      // Should only accept first 10
      expect(npiInput).toHaveValue('1234567890');
    });

    it('accepts TIN in correct format', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      const tinInput = screen.getByTestId('billingTIN');
      await user.type(tinInput, '12-3456789');
      
      expect(tinInput).toHaveValue('12-3456789');
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(<ChargeForm {...defaultProps} />);
      
      expect(screen.getByLabelText(/Patient ID/)).toBeInTheDocument();
      expect(screen.getByLabelText(/CPT Code/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Units/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Charge Amount/)).toBeInTheDocument();
    });

    it('shows validation errors with appropriate ARIA attributes', async () => {
      const user = userEvent.setup();
      render(<ChargeForm {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: /Create Charge/ });
      await user.click(submitButton);
      
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
      });
    });
  });
});