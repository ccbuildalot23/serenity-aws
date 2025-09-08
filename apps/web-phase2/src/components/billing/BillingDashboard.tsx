/**
 * Billing Dashboard Component
 * Provider billing overview with charge management and analytics
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Download, 
  FileText, 
  Filter, 
  Search, 
  Edit, 
  Trash2,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface Charge {
  id: string;
  patientId: string;
  patientInitials?: string;
  cptCode: string;
  cptDescription: string;
  modifiers: string[];
  diagnosisCodes: string[];
  units: number;
  chargeAmount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'PAID';
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

interface BillingStats {
  totalCharges: number;
  totalAmount: number;
  submittedCharges: number;
  submittedAmount: number;
  paidCharges: number;
  paidAmount: number;
  avgChargeAmount: number;
  mostCommonCPT: string;
}

interface BillingDashboardProps {
  onCreateCharge: () => void;
  onEditCharge: (chargeId: string) => void;
  onDeleteCharge: (chargeId: string) => void;
  onGenerateSuperbill: (chargeId: string) => void;
  onExportCharges: () => void;
}

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', variant: 'secondary', icon: Edit },
  SUBMITTED: { label: 'Submitted', variant: 'default', icon: Clock },
  ACCEPTED: { label: 'Accepted', variant: 'default', icon: CheckCircle },
  REJECTED: { label: 'Rejected', variant: 'destructive', icon: AlertTriangle },
  PAID: { label: 'Paid', variant: 'default', icon: DollarSign },
} as const;

const CPT_DESCRIPTIONS = {
  '90791': 'Psychiatric diagnostic evaluation',
  '90834': 'Psychotherapy, 45 minutes',
  '90837': 'Psychotherapy, 60 minutes',
  '90853': 'Group psychotherapy',
};

export default function BillingDashboard({
  onCreateCharge,
  onEditCharge,
  onDeleteCharge,
  onGenerateSuperbill,
  onExportCharges
}: BillingDashboardProps): JSX.Element {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cptFilter, setCptFilter] = useState<string>('all');

  // Mock data - in production, this would fetch from API
  useEffect(() => {
    const loadData = async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockCharges: Charge[] = [
        {
          id: 'charge_1',
          patientId: 'patient_1',
          patientInitials: 'J.D.',
          cptCode: '90834',
          cptDescription: 'Psychotherapy, 45 minutes',
          modifiers: ['GT'],
          diagnosisCodes: ['F32.9'],
          units: 1,
          chargeAmount: 150.00,
          status: 'SUBMITTED',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          submittedAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'charge_2',
          patientId: 'patient_2',
          patientInitials: 'M.S.',
          cptCode: '90837',
          cptDescription: 'Psychotherapy, 60 minutes',
          modifiers: [],
          diagnosisCodes: ['F41.1'],
          units: 1,
          chargeAmount: 180.00,
          status: 'DRAFT',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          updatedAt: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: 'charge_3',
          patientId: 'patient_3',
          patientInitials: 'A.L.',
          cptCode: '90791',
          cptDescription: 'Psychiatric diagnostic evaluation',
          modifiers: [],
          diagnosisCodes: ['F43.10'],
          units: 1,
          chargeAmount: 200.00,
          status: 'PAID',
          createdAt: new Date(Date.now() - 259200000).toISOString(),
          updatedAt: new Date(Date.now() - 259200000).toISOString(),
          submittedAt: new Date(Date.now() - 259200000).toISOString(),
        },
      ];

      const mockStats: BillingStats = {
        totalCharges: mockCharges.length,
        totalAmount: mockCharges.reduce((sum, charge) => sum + charge.chargeAmount, 0),
        submittedCharges: mockCharges.filter(c => ['SUBMITTED', 'ACCEPTED', 'PAID'].includes(c.status)).length,
        submittedAmount: mockCharges.filter(c => ['SUBMITTED', 'ACCEPTED', 'PAID'].includes(c.status))
          .reduce((sum, charge) => sum + charge.chargeAmount, 0),
        paidCharges: mockCharges.filter(c => c.status === 'PAID').length,
        paidAmount: mockCharges.filter(c => c.status === 'PAID')
          .reduce((sum, charge) => sum + charge.chargeAmount, 0),
        avgChargeAmount: mockCharges.reduce((sum, charge) => sum + charge.chargeAmount, 0) / mockCharges.length,
        mostCommonCPT: '90834'
      };

      setCharges(mockCharges);
      setStats(mockStats);
      setLoading(false);
    };

    loadData();
  }, []);

  // Filter charges based on search and filters
  const filteredCharges = charges.filter(charge => {
    const matchesSearch = searchTerm === '' || 
      charge.patientInitials?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      charge.cptCode.includes(searchTerm) ||
      charge.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || charge.status === statusFilter;
    const matchesCPT = cptFilter === 'all' || charge.cptCode === cptFilter;
    
    return matchesSearch && matchesStatus && matchesCPT;
  });

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Billing Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your billing charges and view financial metrics
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={onExportCharges} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={onCreateCharge}>
            <Plus className="mr-2 h-4 w-4" />
            New Charge
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Charges</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCharges}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.totalAmount)} total value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submitted</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.submittedCharges}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.submittedAmount)} submitted
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.paidCharges}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.paidAmount)} collected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Charge</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.avgChargeAmount)}
              </div>
              <p className="text-xs text-muted-foreground">
                Most common: {stats.mostCommonCPT}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Charge History</CardTitle>
          <CardDescription>
            View and manage your billing charges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient, CPT code, or charge ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>

            <Select value={cptFilter} onValueChange={setCptFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="CPT Code" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All CPT Codes</SelectItem>
                <SelectItem value="90791">90791 - Eval</SelectItem>
                <SelectItem value="90834">90834 - 45min</SelectItem>
                <SelectItem value="90837">90837 - 60min</SelectItem>
                <SelectItem value="90853">90853 - Group</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredCharges.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No charges found matching your current filters.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCharges.map((charge) => {
                    const statusConfig = STATUS_CONFIG[charge.status];
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <TableRow key={charge.id}>
                        <TableCell>
                          <div className="font-medium">
                            {charge.patientInitials || 'Anonymous'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {charge.patientId}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {charge.cptCode}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {CPT_DESCRIPTIONS[charge.cptCode as keyof typeof CPT_DESCRIPTIONS]}
                          </div>
                          {charge.modifiers.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {charge.modifiers.map(modifier => (
                                <Badge key={modifier} variant="outline" className="text-xs">
                                  {modifier}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {formatCurrency(charge.chargeAmount)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {charge.units} unit{charge.units !== 1 ? 's' : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant as any} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(charge.createdAt)}
                          </div>
                          {charge.submittedAt && (
                            <div className="text-xs text-muted-foreground">
                              Submitted: {formatDate(charge.submittedAt)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEditCharge(charge.id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onGenerateSuperbill(charge.id)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            {charge.status === 'DRAFT' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onDeleteCharge(charge.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}