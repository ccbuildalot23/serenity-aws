import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SessionTimeout from '@/components/compliance/SessionTimeout';
import { auditLogger } from '@/utils/auditLog';

// Mock store
const mockLogout = jest.fn();
const mockUser = { id: 'user-123', email: 'test@example.com', role: 'provider' as const };

jest.mock('@/store/useStore', () => ({
  useStore: () => ({
    user: mockUser,
    logout: mockLogout
  })
}));

// Mock audit logger
jest.mock('@/utils/auditLog', () => ({
  auditLogger: {
    log: jest.fn(),
    logAuth: jest.fn()
  }
}));

// Mock sonner toasts
jest.mock('sonner', () => ({
  toast: {
    warning: jest.fn(),
    error: jest.fn()
  }
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock window.location
const mockLocation = {
  href: '',
  assign: jest.fn(),
  reload: jest.fn()
};

// Use delete and redefine approach
delete (window as any).location;
(window as any).location = mockLocation;

describe('SessionTimeout Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    mockLocation.href = '';
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing with authenticated user', () => {
      render(<SessionTimeout />);
      expect(document.body).toBeInTheDocument();
    });

    it('renders timeout indicator when no warning shown', () => {
      render(<SessionTimeout />);
      expect(screen.getByText('Session timeout: 15 min')).toBeInTheDocument();
    });

    it('does not render when user is not authenticated', () => {
      jest.doMock('@/store/useStore', () => ({
        useStore: () => ({
          user: null,
          logout: mockLogout
        })
      }));
      
      const { container } = render(<SessionTimeout />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Configuration Props', () => {
    it('accepts custom timeout configuration', () => {
      render(
        <SessionTimeout 
          timeoutMinutes={20}
          warningMinutes={5}
        />
      );
      
      expect(screen.getByText('Session timeout: 20 min')).toBeInTheDocument();
    });

    it('calls onTimeout callback when provided', () => {
      const onTimeout = jest.fn();
      render(<SessionTimeout timeoutMinutes={1} onTimeout={onTimeout} />);
      
      // Advance to timeout
      act(() => {
        jest.advanceTimersByTime(60 * 1000);
      });
      
      expect(onTimeout).toHaveBeenCalled();
    });

    it('calls onWarning callback when warning appears', () => {
      const onWarning = jest.fn();
      render(
        <SessionTimeout 
          timeoutMinutes={3}
          warningMinutes={1}
          onWarning={onWarning}
        />
      );
      
      // Advance to warning time (2 minutes)
      act(() => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });
      
      expect(onWarning).toHaveBeenCalled();
    });

    it('calls onActivity callback when user is active', () => {
      const onActivity = jest.fn();
      render(<SessionTimeout onActivity={onActivity} />);
      
      // Simulate activity
      fireEvent.mouseDown(document);
      
      expect(onActivity).toHaveBeenCalled();
    });
  });

  describe('Timer Functionality', () => {
    it('shows warning modal at correct time', () => {
      render(<SessionTimeout timeoutMinutes={3} warningMinutes={1} />);
      
      // Should not show warning initially
      expect(screen.queryByText('Session Timeout Warning')).not.toBeInTheDocument();
      
      // Advance to warning time (2 minutes)
      act(() => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });
      
      // Warning modal should appear
      expect(screen.getByText('Session Timeout Warning')).toBeInTheDocument();
      expect(screen.getByText('Your session will expire soon')).toBeInTheDocument();
    });

    it('displays countdown in warning modal', () => {
      render(<SessionTimeout timeoutMinutes={3} warningMinutes={1} />);
      
      // Advance to warning
      act(() => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });
      
      // Should show 1 minute countdown (60 seconds)
      expect(screen.getByText('1:00')).toBeInTheDocument();
      
      // Advance 30 seconds
      act(() => {
        jest.advanceTimersByTime(30 * 1000);
      });
      
      // Should show 30 seconds remaining
      expect(screen.getByText('0:30')).toBeInTheDocument();
    });

    it('triggers timeout after full duration', () => {
      render(<SessionTimeout timeoutMinutes={2} />);
      
      // Advance full timeout duration
      act(() => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });
      
      // Should have called logout and redirect
      expect(mockLogout).toHaveBeenCalled();
      expect(mockLocation.href).toBe('/login?reason=timeout');
    });
  });

  describe('User Activity Handling', () => {
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(eventType => {
      it(`resets timers on ${eventType} activity`, () => {
        render(<SessionTimeout timeoutMinutes={3} warningMinutes={1} />);
        
        // Advance most of the way to warning
        act(() => {
          jest.advanceTimersByTime(1.9 * 60 * 1000);
        });
        
        // Perform activity
        fireEvent[eventType as keyof typeof fireEvent](document);
        
        // Advance past original warning time
        act(() => {
          jest.advanceTimersByTime(0.2 * 60 * 1000);
        });
        
        // Warning should not appear because timer was reset
        expect(screen.queryByText('Session Timeout Warning')).not.toBeInTheDocument();
      });
    });

    it('debounces activity events (only resets after 1 second gap)', () => {
      render(<SessionTimeout />);
      
      // Multiple rapid activities
      fireEvent.mouseDown(document);
      fireEvent.mouseDown(document);
      fireEvent.mouseDown(document);
      
      // Should only reset timers once due to debouncing
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    });

    it('dismisses warning modal when user becomes active', () => {
      render(<SessionTimeout timeoutMinutes={3} warningMinutes={1} />);
      
      // Show warning
      act(() => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });
      
      expect(screen.getByText('Session Timeout Warning')).toBeInTheDocument();
      
      // User activity should reset and hide warning
      fireEvent.mouseDown(document);
      
      expect(screen.queryByText('Session Timeout Warning')).not.toBeInTheDocument();
    });
  });

  describe('Session Extension', () => {
    it('allows user to continue session from warning modal', () => {
      render(<SessionTimeout timeoutMinutes={3} warningMinutes={1} />);
      
      // Show warning
      act(() => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });
      
      const continueButton = screen.getByText('Continue Session');
      fireEvent.click(continueButton);
      
      // Warning should disappear
      expect(screen.queryByText('Session Timeout Warning')).not.toBeInTheDocument();
      
      // Timers should be reset - advance to original timeout and verify no logout
      act(() => {
        jest.advanceTimersByTime(3 * 60 * 1000);
      });
      
      expect(mockLogout).not.toHaveBeenCalled();
    });

    it('logs session extension event', () => {
      render(<SessionTimeout timeoutMinutes={3} warningMinutes={1} />);
      
      // Show warning and continue
      act(() => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });
      
      fireEvent.click(screen.getByText('Continue Session'));
      
      // Should log extension to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'auditLogs',
        expect.stringContaining('SESSION_EXTENDED')
      );
    });
  });

  describe('Logout Functionality', () => {
    it('allows immediate logout from warning modal', () => {
      render(<SessionTimeout timeoutMinutes={3} warningMinutes={1} />);
      
      // Show warning
      act(() => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });
      
      fireEvent.click(screen.getByText('Logout Now'));
      
      expect(mockLogout).toHaveBeenCalled();
      expect(mockLocation.href).toBe('/login?reason=timeout');
    });
  });

  describe('Audit Logging', () => {
    it('logs timeout event with proper details', () => {
      render(<SessionTimeout timeoutMinutes={1} />);
      
      // Trigger timeout
      act(() => {
        jest.advanceTimersByTime(60 * 1000);
      });
      
      // Should log timeout to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'auditLogs',
        expect.stringContaining('SESSION_TIMEOUT')
      );
      
      const logCall = mockLocalStorage.setItem.mock.calls.find(
        call => call[0] === 'auditLogs' && call[1].includes('SESSION_TIMEOUT')
      );
      
      expect(logCall).toBeTruthy();
      const logData = JSON.parse(logCall![1]);
      const timeoutLog = logData.find((log: any) => log.event === 'SESSION_TIMEOUT');
      
      expect(timeoutLog).toMatchObject({
        event: 'SESSION_TIMEOUT',
        userId: 'user-123',
        reason: 'Inactivity timeout after 15 minutes'
      });
    });

    it('logs session extension event', () => {
      render(<SessionTimeout timeoutMinutes={2} warningMinutes={1} />);
      
      // Show warning and extend
      act(() => {
        jest.advanceTimersByTime(60 * 1000);
      });
      
      fireEvent.click(screen.getByText('Continue Session'));
      
      const logCall = mockLocalStorage.setItem.mock.calls.find(
        call => call[0] === 'auditLogs' && call[1].includes('SESSION_EXTENDED')
      );
      
      expect(logCall).toBeTruthy();
      const logData = JSON.parse(logCall![1]);
      const extensionLog = logData.find((log: any) => log.event === 'SESSION_EXTENDED');
      
      expect(extensionLog).toMatchObject({
        event: 'SESSION_EXTENDED',
        userId: 'user-123',
        action: 'User continued session before timeout'
      });
    });
  });

  describe('Timer Cleanup', () => {
    it('clears all timers on unmount', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      const { unmount } = render(<SessionTimeout />);
      unmount();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearTimeoutSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    it('clears event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      
      const { unmount } = render(<SessionTimeout />);
      unmount();
      
      // Should remove all activity event listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('HIPAA Compliance', () => {
    it('enforces 15-minute default timeout for PHI access', () => {
      render(<SessionTimeout />);
      
      // Default should be 15 minutes
      expect(screen.getByText('Session timeout: 15 min')).toBeInTheDocument();
    });

    it('shows HIPAA compliance message in warning modal', () => {
      render(<SessionTimeout timeoutMinutes={2} warningMinutes={1} />);
      
      act(() => {
        jest.advanceTimersByTime(60 * 1000);
      });
      
      expect(screen.getByText('HIPAA Security Requirement')).toBeInTheDocument();
      expect(screen.getByText(/Automatic logout protects patient data/)).toBeInTheDocument();
    });

    it('includes security explanation in warning', () => {
      render(<SessionTimeout />);
      
      act(() => {
        jest.advanceTimersByTime(13 * 60 * 1000);
      });
      
      expect(screen.getByText(/For security reasons, your session will automatically end/)).toBeInTheDocument();
      expect(screen.getByText(/This helps protect sensitive patient information/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles localStorage errors gracefully', () => {
      // Mock localStorage to throw error
      const originalSetItem = mockLocalStorage.setItem;
      mockLocalStorage.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Should not crash when localStorage fails
      expect(() => {
        render(<SessionTimeout />);
        fireEvent.mouseDown(document);
      }).not.toThrow();
      
      mockLocalStorage.setItem = originalSetItem;
    });

    it('handles multiple simultaneous instances', () => {
      const { unmount: unmount1 } = render(<SessionTimeout />);
      const { unmount: unmount2 } = render(<SessionTimeout />);
      
      // Both should render without conflicts
      expect(screen.getAllByText('Session timeout: 15 min')).toHaveLength(2);
      
      unmount1();
      unmount2();
    });
  });

  describe('Accessibility', () => {
    it('warning modal has proper ARIA attributes', () => {
      render(<SessionTimeout timeoutMinutes={2} warningMinutes={1} />);
      
      act(() => {
        jest.advanceTimersByTime(60 * 1000);
      });
      
      const modal = screen.getByRole('dialog', { hidden: true });
      expect(modal).toBeInTheDocument();
    });

    it('provides screen reader accessible countdown', () => {
      render(<SessionTimeout timeoutMinutes={2} warningMinutes={1} />);
      
      act(() => {
        jest.advanceTimersByTime(60 * 1000);
      });
      
      expect(screen.getByText('Time remaining before automatic logout')).toBeInTheDocument();
    });
  });
});