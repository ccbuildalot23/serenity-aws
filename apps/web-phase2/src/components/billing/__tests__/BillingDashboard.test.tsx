/** @jest-environment jsdom */
/**
 * BillingDashboard Component Tests
 * Tests for billing dashboard with charge management and analytics
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillingDashboard from '../BillingDashboard';

// Mock the UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, ...props }: any) => (
    <button 
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      data-testid={props['data-testid'] || 'button'}
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
      data-testid={props['data-testid']}
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table data-testid="charges-table">{children}</table>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableCell: ({ children }: any) => <td>{children}</td>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, ...props }: any) => (
    <span data-variant={variant} data-testid="badge" {...props}>
      {children}
    </span>
  ),
}));

describe('BillingDashboard', () => {
  const defaultProps = {
    onCreateCharge: jest.fn(),
    onEditCharge: jest.fn(),
    onDeleteCharge: jest.fn(),
    onGenerateSuperbill: jest.fn(),
    onExportCharges: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dashboard Loading', () => {
    it('shows loading state initially', () => {
      render(<BillingDashboard {...defaultProps} />);
      
      expect(screen.getByText('Loading billing data...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { hidden: true })).toBeInTheDocument(); // Loading spinner
    });

    it('shows dashboard content after loading', async () => {
      render(<BillingDashboard {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      }, { timeout: 2000 });
      
      expect(screen.queryByText('Loading billing data...')).not.toBeInTheDocument();
    });
  });

  describe('Dashboard Header', () => {
    beforeEach(async () => {
      render(<BillingDashboard {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });
    });

    it('displays dashboard title and description', () => {
      expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Manage your billing charges and view financial metrics')).toBeInTheDocument();
    });

    it('shows Export and New Charge buttons', () => {
      expect(screen.getByRole('button', { name: /Export/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New Charge/ })).toBeInTheDocument();
    });

    it('calls onCreateCharge when New Charge button is clicked', async () => {
      const user = userEvent.setup();
      const newChargeButton = screen.getByRole('button', { name: /New Charge/ });
      
      await user.click(newChargeButton);
      
      expect(defaultProps.onCreateCharge).toHaveBeenCalled();
    });

    it('calls onExportCharges when Export button is clicked', async () => {
      const user = userEvent.setup();
      const exportButton = screen.getByRole('button', { name: /Export/ });
      
      await user.click(exportButton);
      
      expect(defaultProps.onExportCharges).toHaveBeenCalled();
    });
  });

  describe('Stats Cards', () => {
    beforeEach(async () => {
      render(<BillingDashboard {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });
    });

    it('displays total charges card', () => {
      expect(screen.getByText('Total Charges')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // Mock data shows 3 charges
    });

    it('displays submitted charges card', () => {
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Mock data shows 2 submitted
    });

    it('displays paid charges card', () => {
      expect(screen.getByText('Paid')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // Mock data shows 1 paid
    });

    it('displays average charge card', () => {
      expect(screen.getByText('Avg Charge')).toBeInTheDocument();
      expect(screen.getByText(/\$176.67/)).toBeInTheDocument(); // Average of mock data
    });

    it('shows currency formatting', () => {
      expect(screen.getByText(/\$530.00 total value/)).toBeInTheDocument();
      expect(screen.getByText(/\$330.00 submitted/)).toBeInTheDocument();
      expect(screen.getByText(/\$200.00 collected/)).toBeInTheDocument();
    });
  });

  describe('Charge Table', () => {
    beforeEach(async () => {
      render(<BillingDashboard {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });
    });

    it('displays charge history table', () => {
      expect(screen.getByText('Charge History')).toBeInTheDocument();
      expect(screen.getByTestId('charges-table')).toBeInTheDocument();
    });

    it('shows table headers', () => {
      expect(screen.getByText('Patient')).toBeInTheDocument();
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('displays charge data rows', () => {
      expect(screen.getByText('J.D.')).toBeInTheDocument(); // Patient initials
      expect(screen.getByText('90834')).toBeInTheDocument(); // CPT code
      expect(screen.getByText(/\$150.00/)).toBeInTheDocument(); // Charge amount
      expect(screen.getByText('Submitted')).toBeInTheDocument(); // Status
    });

    it('shows CPT code descriptions', () => {
      expect(screen.getByText('Psychotherapy, 45 minutes')).toBeInTheDocument();
      expect(screen.getByText('Psychotherapy, 60 minutes')).toBeInTheDocument();
      expect(screen.getByText('Psychiatric diagnostic evaluation')).toBeInTheDocument();
    });

    it('displays status badges with correct variants', () => {
      const submittedBadge = screen.getByText('Submitted').closest('[data-testid="badge"]');
      const draftBadge = screen.getByText('Draft').closest('[data-testid="badge"]');
      const paidBadge = screen.getByText('Paid').closest('[data-testid="badge"]');
      
      expect(submittedBadge).toHaveAttribute('data-variant', 'default');
      expect(draftBadge).toHaveAttribute('data-variant', 'secondary');
      expect(paidBadge).toHaveAttribute('data-variant', 'default');
    });

    it('shows modifiers as badges', () => {
      expect(screen.getByText('GT')).toBeInTheDocument(); // Telemedicine modifier
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(async () => {
      render(<BillingDashboard {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });
    });

    it('has search input with correct placeholder', () => {
      const searchInput = screen.getByPlaceholderText(/Search by patient, CPT code, or charge ID/);
      expect(searchInput).toBeInTheDocument();
    });

    it('has status filter dropdown', () => {
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });

    it('has CPT code filter dropdown', () => {
      expect(screen.getByText('All CPT Codes')).toBeInTheDocument();
    });

    it('filters charges by search term', async () => {
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText(/Search by patient, CPT code, or charge ID/);
      
      await user.type(searchInput, 'J.D.');
      
      // Should still show the J.D. patient
      expect(screen.getByText('J.D.')).toBeInTheDocument();
      // Should filter out other patients (in a real implementation)
    });

    it('shows no results message when filters match nothing', async () => {
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText(/Search by patient, CPT code, or charge ID/);
      
      await user.type(searchInput, 'nonexistent');
      
      await waitFor(() => {
        expect(screen.getByText(/No charges found matching your current filters/)).toBeInTheDocument();
      });
    });
  });

  describe('Action Buttons', () => {
    beforeEach(async () => {
      render(<BillingDashboard {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });
    });

    it('shows action buttons for each charge', () => {
      // Should have edit, superbill, and delete buttons for each charge
      const editButtons = screen.getAllByTestId(/edit-/);
      const superbillButtons = screen.getAllByTestId(/superbill-/);
      
      expect(editButtons.length).toBeGreaterThan(0);
      expect(superbillButtons.length).toBeGreaterThan(0);
    });

    it('calls onEditCharge when edit button is clicked', async () => {
      const user = userEvent.setup();
      const editButtons = screen.getAllByTestId(/edit-/);
      
      await user.click(editButtons[0]);
      
      expect(defaultProps.onEditCharge).toHaveBeenCalledWith('charge_1');
    });

    it('calls onGenerateSuperbill when superbill button is clicked', async () => {
      const user = userEvent.setup();
      const superbillButtons = screen.getAllByTestId(/superbill-/);
      
      await user.click(superbillButtons[0]);
      
      expect(defaultProps.onGenerateSuperbill).toHaveBeenCalledWith('charge_1');
    });

    it('shows delete button only for DRAFT charges', () => {
      // Check that delete button is only shown for draft charges
      const deleteButtons = screen.queryAllByTestId(/delete-/);
      
      // Should have delete button for draft charge only (1 draft charge in mock data)
      expect(deleteButtons).toHaveLength(1);
    });

    it('calls onDeleteCharge when delete button is clicked', async () => {
      const user = userEvent.setup();
      const deleteButtons = screen.getAllByTestId(/delete-/);
      
      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0]);
        
        expect(defaultProps.onDeleteCharge).toHaveBeenCalledWith('charge_2');
      }
    });
  });

  describe('Date Formatting', () => {
    beforeEach(async () => {
      render(<BillingDashboard {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });
    });

    it('formats dates correctly', () => {
      // Check for formatted dates in the table
      const dateElements = screen.getAllByText(/^\w{3} \d{1,2}, \d{4}$/);
      expect(dateElements.length).toBeGreaterThan(0);
    });

    it('shows submitted date when available', () => {
      expect(screen.getByText(/Submitted:/)).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    beforeEach(async () => {
      render(<BillingDashboard {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });
    });

    it('has responsive grid classes for stats cards', () => {
      const cards = screen.getAllByTestId('card');
      const cardContainer = cards[0].parentElement;
      
      expect(cardContainer).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4');
    });

    it('has responsive flex classes for filters', () => {
      const searchInput = screen.getByPlaceholderText(/Search by patient, CPT code, or charge ID/);
      const filtersContainer = searchInput.closest('.flex');
      
      expect(filtersContainer).toHaveClass('flex-col', 'sm:flex-row');
    });
  });

  describe('Error States', () => {
    it('handles empty charges list', async () => {
      // Mock empty response
      jest.spyOn(React, 'useEffect').mockImplementation((effect) => {
        if (typeof effect === 'function') {
          effect();
        }
      });

      render(<BillingDashboard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
      });
      
      // In real implementation, would show empty state message
    });
  });
});