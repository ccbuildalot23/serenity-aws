'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  User,
  Send,
  AlertTriangle,
  Shield,
  Heart,
  Brain,
  ToggleLeft,
  ToggleRight,
  Phone,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { auditLogger, AuditEventType } from '@/utils/auditLog';
import { apiClient } from '@/lib/api-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mode: 'peer' | 'clinical';
  flagged?: boolean;
  crisisDetected?: boolean;
}

// Crisis keywords for detection
const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'end it all', 'not worth living',
  'harm myself', 'self harm', 'cutting', 'overdose',
  'die', 'death', 'hopeless', 'no way out',
  'hurt myself', 'pills', 'gun', 'rope',
  'bridge', 'jump', 'give up', 'cant go on'
];

// Mock responses for MVP
const MOCK_RESPONSES = {
  peer: {
    greeting: "Hey there! I'm here to listen and support you. How are you feeling today?",
    general: [
      "I hear you, and what you're going through sounds really tough. You're not alone in this.",
      "That must be really challenging. It takes courage to share what you're experiencing.",
      "I understand how overwhelming things can feel sometimes. Let's take this one step at a time.",
      "Your feelings are valid. It's okay to have difficult days. What helps you cope when things get tough?",
      "Thank you for trusting me with this. Remember, recovery isn't linear - every small step counts."
    ],
    crisis: "I'm really concerned about what you're sharing. Your safety is the most important thing right now. Would you like me to connect you with someone who can help immediately?"
  },
  clinical: {
    greeting: "Hello. I'm here to provide clinical support and guidance. What brings you here today?",
    general: [
      "Based on what you've shared, it might be helpful to explore coping strategies. Have you tried deep breathing exercises or grounding techniques?",
      "Your symptoms suggest you might benefit from cognitive behavioral techniques. Would you like to work through a thought challenging exercise?",
      "It's important to maintain regular sleep and exercise routines. How has your sleep been lately?",
      "Consider keeping a mood journal to track patterns. This can help identify triggers and effective coping mechanisms.",
      "Remember to reach out to your healthcare provider if symptoms persist or worsen. Regular check-ins are important for your recovery."
    ],
    crisis: "Your message indicates you may be in crisis. For immediate support, please contact the 988 Suicide & Crisis Lifeline or go to your nearest emergency room. Your provider has been notified."
  }
};

export default function DualAIChat() {
  const { user } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [mode, setMode] = useState<'peer' | 'clinical'>('peer');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showCrisisAlert, setShowCrisisAlert] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initial greeting
    const greeting: Message = {
      id: '1',
      role: 'assistant',
      content: MOCK_RESPONSES[mode].greeting,
      timestamp: new Date(),
      mode
    };
    setMessages([greeting]);
  }, [mode]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const detectCrisis = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return CRISIS_KEYWORDS.some(keyword => lowerText.includes(keyword));
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      mode
    };

    // Check for crisis keywords
    const hasCrisis = detectCrisis(input);
    if (hasCrisis) {
      userMessage.crisisDetected = true;
      setShowCrisisAlert(true);
      
      // Log crisis event
      auditLogger.log({
        event: AuditEventType.CRISIS_ALERT,
        action: 'Crisis keywords detected in chat',
        userId: user?.id,
        details: {
          mode,
          keywordsDetected: true
        }
      });

      // Trigger crisis protocol
      try {
        await apiClient.triggerCrisis({
          message: 'Crisis keywords detected in AI chat',
          severity: 'high',
          mode
        });
      } catch (error) {
        console.error('Failed to trigger crisis protocol:', error);
      }
    }

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const response = hasCrisis 
        ? MOCK_RESPONSES[mode].crisis
        : MOCK_RESPONSES[mode].general[Math.floor(Math.random() * MOCK_RESPONSES[mode].general.length)];

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        mode,
        flagged: hasCrisis
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleModeToggle = () => {
    const newMode = mode === 'peer' ? 'clinical' : 'peer';
    setMode(newMode);
    
    // Log mode change
    auditLogger.log({
      event: AuditEventType.PHI_VIEW,
      action: `AI chat mode changed to ${newMode}`,
      userId: user?.id,
      details: { previousMode: mode, newMode }
    });

    // Clear messages and show new greeting
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: MOCK_RESPONSES[newMode].greeting,
      timestamp: new Date(),
      mode: newMode
    }]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            mode === 'peer' ? 'bg-purple-100' : 'bg-blue-100'
          )}>
            {mode === 'peer' ? (
              <Heart className="text-purple-600" size={24} />
            ) : (
              <Brain className="text-blue-600" size={24} />
            )}
          </div>
          <div>
            <h3 className="font-bold">
              {mode === 'peer' ? 'Peer Support Chat' : 'Clinical Guidance Chat'}
            </h3>
            <p className="text-xs text-gray-500">
              {mode === 'peer' ? 'Empathetic peer support' : 'Evidence-based clinical guidance'}
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <button
          onClick={handleModeToggle}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          {mode === 'peer' ? (
            <>
              <ToggleLeft className="text-gray-600" size={20} />
              <span className="text-sm">Switch to Clinical</span>
            </>
          ) : (
            <>
              <ToggleRight className="text-gray-600" size={20} />
              <span className="text-sm">Switch to Peer</span>
            </>
          )}
        </button>
      </div>

      {/* Safety Disclaimer */}
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-yellow-800">
          <Shield size={14} />
          <span>
            This AI assistant provides support but is not a replacement for professional care. 
            In emergencies, call 988 or 911.
          </span>
        </div>
      </div>

      {/* Crisis Alert */}
      {showCrisisAlert && (
        <div className="bg-red-50 border-b border-red-200 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-red-600 mt-0.5" size={16} />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Crisis Support Available</p>
              <p className="text-xs text-red-700 mt-1">
                If you're in crisis, please reach out for immediate help:
              </p>
              <div className="flex gap-3 mt-2">
                <button className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">
                  <Phone size={12} />
                  Call 988
                </button>
                <button className="px-3 py-1 bg-white text-red-600 border border-red-300 rounded text-xs font-medium hover:bg-red-50">
                  Alert Provider
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowCrisisAlert(false)}
              className="text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                message.mode === 'peer' ? 'bg-purple-100' : 'bg-blue-100'
              )}>
                <Bot className={cn(
                  'w-5 h-5',
                  message.mode === 'peer' ? 'text-purple-600' : 'text-blue-600'
                )} />
              </div>
            )}
            
            <div className={cn(
              'max-w-[70%] rounded-lg px-4 py-2',
              message.role === 'user'
                ? 'bg-purple-600 text-white'
                : message.flagged
                ? 'bg-red-50 border border-red-200'
                : 'bg-gray-100'
            )}>
              {message.crisisDetected && (
                <div className="flex items-center gap-1 mb-2 text-xs text-red-600">
                  <AlertCircle size={12} />
                  <span>Crisis keywords detected</span>
                </div>
              )}
              <p className={cn(
                'text-sm',
                message.role === 'assistant' && message.flagged && 'text-red-900'
              )}>
                {message.content}
              </p>
              <p className={cn(
                'text-xs mt-1',
                message.role === 'user' ? 'text-purple-200' : 'text-gray-500'
              )}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            
            {message.role === 'user' && (
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className="flex gap-3">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              mode === 'peer' ? 'bg-purple-100' : 'bg-blue-100'
            )}>
              <Bot className={cn(
                'w-5 h-5',
                mode === 'peer' ? 'text-purple-600' : 'text-blue-600'
              )} />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={mode === 'peer' ? "Share what's on your mind..." : "Ask for clinical guidance..."}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isTyping}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className={cn(
              'px-4 py-2 rounded-lg flex items-center gap-2 transition-colors',
              input.trim() && !isTyping
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            <Send size={18} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        
        <p className="text-xs text-gray-500 mt-2">
          {mode === 'peer' 
            ? "Remember: I'm here to listen and support, not provide medical advice."
            : "Note: Clinical guidance should be discussed with your healthcare provider."}
        </p>
      </div>
    </div>
  );
}