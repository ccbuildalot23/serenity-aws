'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle, 
  Phone, 
  MessageCircle, 
  Users, 
  Heart,
  Clock,
  Shield,
  ArrowLeft,
  Send,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';

interface Supporter {
  id: string;
  name: string;
  relationship: string;
  phone?: string;
  email?: string;
  preferred_contact: 'phone' | 'text' | 'email';
}

// PRD: Crisis Alert & Support Ping system
export default function SupportPage(): JSX.Element {
  const router = useRouter();
  const { user } = useStore();
  const [isSubmittingCrisis, setIsSubmittingCrisis] = useState(false);
  const [selectedSupporters, setSelectedSupporters] = useState<Set<string>>(new Set());
  const [showSupporterSelect, setShowSupporterSelect] = useState(false);
  const [crisisMessage, setCrisisMessage] = useState('');

  // Mock supporters - in production, this would come from API
  const supporters: Supporter[] = [
    {
      id: 'sup_1',
      name: 'Sarah Johnson',
      relationship: 'Sister',
      phone: '+1 (555) 123-4567',
      preferred_contact: 'phone'
    },
    {
      id: 'sup_2', 
      name: 'Dr. Michael Chen',
      relationship: 'Therapist',
      phone: '+1 (555) 987-6543',
      preferred_contact: 'phone'
    },
    {
      id: 'sup_3',
      name: 'Emma Rodriguez',
      relationship: 'Best Friend',
      phone: '+1 (555) 456-7890',
      preferred_contact: 'text'
    }
  ];

  const handleCrisisAlert = async (): Promise<void> => {
    if (selectedSupporters.size === 0) {
      setShowSupporterSelect(true);
      return;
    }

    setIsSubmittingCrisis(true);

    try {
      // PRD: API /api/crisis requires authentication
      const response = await apiClient.createCrisisAlert({
        severity: 'high',
        message: crisisMessage || 'I need support right now.',
        supporter_ids: Array.from(selectedSupporters),
        location: null, // Could add geolocation if needed
        created_at: new Date().toISOString()
      });

      if (response.data.success) {
        // PRD: Notifications include patient initials (no PHI) + call-to-action
        toast.success(
          `Crisis alert sent to ${selectedSupporters.size} supporter${selectedSupporters.size > 1 ? 's' : ''}`,
          { duration: 5000 }
        );

        // PRD: Response times are stored for metrics
        // Show expected response time
        toast.info(
          'Your supporters have been notified and should respond within 15 minutes.',
          { duration: 8000 }
        );

        // Clear form
        setSelectedSupporters(new Set());
        setCrisisMessage('');
        setShowSupporterSelect(false);

        // Navigate back to home
        setTimeout(() => {
          router.push('/patient');
        }, 2000);
      }
    } catch (error) {
      console.error('Crisis alert error:', error);
      toast.error('Failed to send crisis alert. Please try again or call emergency services.');
    } finally {
      setIsSubmittingCrisis(false);
    }
  };

  const toggleSupporter = (supporterId: string): void => {
    const newSelected = new Set(selectedSupporters);
    if (newSelected.has(supporterId)) {
      newSelected.delete(supporterId);
    } else {
      newSelected.add(supporterId);
    }
    setSelectedSupporters(newSelected);
  };

  const getContactIcon = (method: string): JSX.Element => {
    switch (method) {
      case 'phone':
        return <Phone size={16} className="text-blue-500" />;
      case 'text':
        return <MessageCircle size={16} className="text-green-500" />;
      case 'email':
        return <MessageCircle size={16} className="text-purple-500" />;
      default:
        return <Phone size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support & Crisis Help</h1>
          <p className="text-sm text-gray-600">Get help when you need it most</p>
        </div>
      </div>

      {/* Emergency Services - Always at top */}
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertTriangle className="text-red-600" size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              Emergency Services
            </h2>
            <p className="text-red-700 text-sm mb-4">
              If you're in immediate danger or having thoughts of self-harm, 
              contact emergency services right away.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="tel:911"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                <Phone size={18} />
                Call 911
              </a>
              <a
                href="tel:988"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
              >
                <Phone size={18} />
                Crisis Lifeline: 988
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Crisis Alert to Supporters */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Users className="text-orange-600" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Alert Your Support Network</h3>
            <p className="text-sm text-gray-600">Send a quick alert to people who care about you</p>
          </div>
        </div>

        {!showSupporterSelect ? (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2">What happens when you send an alert:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500" />
                  Your supporters get notified immediately
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500" />
                  They can respond via their preferred method
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500" />
                  No personal health information is shared
                </li>
                <li className="flex items-center gap-2">
                  <Clock size={14} className="text-blue-500" />
                  Most supporters respond within 15 minutes
                </li>
              </ul>
            </div>

            <button
              onClick={() => setShowSupporterSelect(true)}
              className="w-full py-3 px-4 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
            >
              <AlertCircle size={18} />
              I Need Support
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Choose who to notify:
              </label>
              <div className="space-y-2">
                {supporters.map((supporter) => (
                  <label
                    key={supporter.id}
                    className={cn(
                      'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all',
                      selectedSupporters.has(supporter.id)
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSupporters.has(supporter.id)}
                      onChange={() => toggleSupporter(supporter.id)}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{supporter.name}</div>
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <span>{supporter.relationship}</span>
                        <span>•</span>
                        {getContactIcon(supporter.preferred_contact)}
                        <span className="capitalize">{supporter.preferred_contact}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Optional message:
              </label>
              <textarea
                value={crisisMessage}
                onChange={(e) => setCrisisMessage(e.target.value)}
                placeholder="Let them know how they can help..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSupporterSelect(false)}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCrisisAlert}
                disabled={isSubmittingCrisis || selectedSupporters.size === 0}
                className={cn(
                  'flex-1 py-2 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2',
                  isSubmittingCrisis || selectedSupporters.size === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-orange-600 text-white hover:bg-orange-700'
                )}
              >
                {isSubmittingCrisis ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Alert ({selectedSupporters.size})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Professional Resources */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Shield className="text-blue-600" size={20} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Professional Resources</h3>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3">
            <a
              href="tel:988"
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <Phone className="text-green-600" size={18} />
              <div>
                <div className="font-medium text-gray-900">Crisis Lifeline</div>
                <div className="text-sm text-gray-600">988 • 24/7 support</div>
              </div>
            </a>

            <a
              href="sms:741741"
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <MessageCircle className="text-blue-600" size={18} />
              <div>
                <div className="font-medium text-gray-900">Crisis Text Line</div>
                <div className="text-sm text-gray-600">Text HOME to 741741</div>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Self-Care Tools */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Heart className="text-purple-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Quick Self-Care</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <button className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all text-left">
            <div className="font-medium text-gray-800">Breathing Exercise</div>
            <div className="text-sm text-gray-600">4-7-8 technique</div>
          </button>
          <button className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all text-left">
            <div className="font-medium text-gray-800">Grounding</div>
            <div className="text-sm text-gray-600">5-4-3-2-1 method</div>
          </button>
        </div>
      </div>
    </div>
  );
}