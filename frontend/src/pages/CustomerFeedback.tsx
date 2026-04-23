import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { MessageSquare, CheckCircle, XCircle, AlertCircle, Clock, Plus, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import Select from 'react-select';
import api from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import {
    Select as ShadcnSelect,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import InspectionFilters from '../components/InspectionFilters';

// ==================== Types ====================

type Inspection = {
    id: string;
    style: string;
    color: string;
    po_number: string;
    stage: string;
    decision: string;
    customer_decision: string;
    customer_feedback_comments: string;
    customer_feedback_date: string;
    specialized_remarks: string;
    customer_issues_count: number;
    created_at: string;
    created_by_username: string;
};

type StandardizedDefect = {
    id: string;
    category: string;
    defect_name: string;
    severity: string;
};

type CustomerIssue = {
    id?: string;
    standardized_defect: string;
    defect_name: string;
    defect_category: string;
    defect_severity: string;
    status: string;
};

type FeedbackForm = {
    customer_decision: string;
    customer_feedback_comments: string;
    specialized_remarks: string;
};

// ==================== Category colors ====================
const CATEGORY_COLORS: Record<string, string> = {
    'Fabric': 'bg-amber-100 text-amber-800 border-amber-200',
    'Workmanship': 'bg-blue-100 text-blue-800 border-blue-200',
    'Measurement': 'bg-purple-100 text-purple-800 border-purple-200',
    'Wash/Finish': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Accessories/Trims': 'bg-rose-100 text-rose-800 border-rose-200',
};

const SEVERITY_COLORS: Record<string, string> = {
    'Critical': 'bg-red-500 text-white',
    'Major': 'bg-orange-500 text-white',
    'Minor': 'bg-yellow-400 text-yellow-900',
};

const CATEGORIES = ['Fabric', 'Workmanship', 'Measurement', 'Wash/Finish', 'Accessories/Trims'];

// ==================== Main Component ====================

const CustomerFeedback = () => {
    const queryClient = useQueryClient();
    const { canAddCustomerFeedback } = useAuth();
    const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Standardized defect picker state
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [issuesList, setIssuesList] = useState<CustomerIssue[]>([]);

    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        decisions: [] as string[],
        stages: [] as string[],
        customer: '',
        factory: '',
        search: '',
        ordering: '-created_at',
    });


    const { register, handleSubmit, reset, setValue } = useForm<FeedbackForm>();

    // Fetch inspections
    const { data: inspectionsData, isLoading } = useQuery({
        queryKey: ['inspections-feedback', page, filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            if (filters.dateFrom) params.append('created_at_after', filters.dateFrom);
            if (filters.dateTo) params.append('created_at_before', filters.dateTo);
            if (filters.decisions.length > 0) filters.decisions.forEach(d => params.append('decision', d));
            if (filters.stages.length > 0) filters.stages.forEach(s => params.append('stage', s));
            if (filters.customer) params.append('customer', filters.customer);
            if (filters.factory) params.append('factory', filters.factory);
            if (filters.search) params.append('search', filters.search);
            if (filters.ordering) params.append('ordering', filters.ordering);

            const res = await api.get(`/inspections/?${params.toString()}`);
            return res.data;
        },
        placeholderData: (previousData) => previousData,
    });

    // Fetch standardized defect library
    const { data: defectsLibrary } = useQuery({
        queryKey: ['standardized-defects'],
        queryFn: async () => {
            const res = await api.get('/standardized-defects/');
            return res.data as StandardizedDefect[];
        },
    });

    // Fetch existing customer issues when opening a feedback dialog
    const { data: existingIssuesData } = useQuery({
        queryKey: ['inspection-detail', selectedInspection?.id],
        queryFn: async () => {
            if (!selectedInspection) return null;
            const res = await api.get(`/inspections/${selectedInspection.id}/`);
            return res.data;
        },
        enabled: !!selectedInspection,
    });

    const inspections = Array.isArray(inspectionsData) ? inspectionsData : inspectionsData?.results || [];

    // Filter defects by selected category for the dropdown
    const filteredDefects = useMemo(() => {
        if (!defectsLibrary || !selectedCategory) return [];
        return defectsLibrary.filter((d: StandardizedDefect) => d.category === selectedCategory);
    }, [defectsLibrary, selectedCategory]);

    // react-select options
    const defectOptions = useMemo(() => {
        return filteredDefects.map((d: StandardizedDefect) => ({
            value: d.id,
            label: `${d.defect_name} (${d.severity})`,
            defect: d,
        }));
    }, [filteredDefects]);

    const updateMutation = useMutation({
        mutationFn: async (data: FeedbackForm) => {
            if (!selectedInspection) return;
            const payload = {
                ...data,
                customer_issues: issuesList.map(issue => ({
                    standardized_defect: issue.standardized_defect,
                    status: issue.status,
                })),
            };
            const res = await api.patch(`/inspections/${selectedInspection.id}/update_customer_feedback/`, payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections-feedback'] });
            setIsOpen(false);
            setSelectedInspection(null);
            setIssuesList([]);
            setSelectedCategory('');
            reset();
            toast.success('Feedback updated successfully');
        },
        onError: () => {
            toast.error('Failed to update feedback');
        },
    });


    const handleFiltersChange = (newFilters: typeof filters) => {
        setFilters(newFilters);
        setPage(1);
    };

    const handleClearFilters = () => {
        setFilters({
            dateFrom: '',
            dateTo: '',
            decisions: [] as string[],
            stages: [] as string[],
            customer: '',
            factory: '',
            search: '',
            ordering: '-created_at',
        });
        setPage(1);
    };

    const handleEdit = (inspection: Inspection) => {
        setSelectedInspection(inspection);
        setValue('customer_decision', inspection.customer_decision || '');
        setValue('customer_feedback_comments', inspection.customer_feedback_comments || '');
        setValue('specialized_remarks', inspection.specialized_remarks || '');
        setIssuesList([]);
        setSelectedCategory('');
        setIsOpen(true);
    };

    // Populate issues list when existing data loads
    useMemo(() => {
        if (existingIssuesData?.customer_issues && isOpen) {
            const existing = existingIssuesData.customer_issues.map((issue: any) => ({
                id: issue.id,
                standardized_defect: issue.standardized_defect,
                defect_name: issue.defect_name,
                defect_category: issue.defect_category,
                defect_severity: issue.defect_severity,
                status: issue.status,
            }));
            setIssuesList(existing);
        }
    }, [existingIssuesData, isOpen]);

    const handleAddDefect = (option: any) => {
        if (!option) return;
        const defect: StandardizedDefect = option.defect;

        // Prevent duplicates
        if (issuesList.some(i => i.standardized_defect === defect.id)) {
            toast.info('This defect is already in the list');
            return;
        }

        setIssuesList(prev => [
            ...prev,
            {
                standardized_defect: defect.id,
                defect_name: defect.defect_name,
                defect_category: defect.category,
                defect_severity: defect.severity,
                status: 'Open',
            },
        ]);
    };

    const handleRemoveDefect = (defectId: string) => {
        setIssuesList(prev => prev.filter(i => i.standardized_defect !== defectId));
    };

    const handleToggleStatus = (defectId: string) => {
        setIssuesList(prev => prev.map(i =>
            i.standardized_defect === defectId
                ? { ...i, status: i.status === 'Open' ? 'Resolved' : 'Open' }
                : i
        ));
    };

    const onSubmit = (data: FeedbackForm) => {
        updateMutation.mutate(data);
    };

    const getDecisionBadge = (decision: string) => {
        switch (decision) {
            case 'Accepted':
                return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Accepted</Badge>;
            case 'Rejected':
                return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
            case 'Revision Requested':
                return <Badge className="bg-orange-500"><AlertCircle className="w-3 h-3 mr-1" /> Revision</Badge>;
            case 'Accepted with Comments':
                return <Badge className="bg-blue-500"><MessageSquare className="w-3 h-3 mr-1" /> Comments</Badge>;
            case 'Held Internally':
                return <Badge className="bg-gray-500"><Clock className="w-3 h-3 mr-1" /> Held</Badge>;
            default:
                return <Badge variant="outline">Pending</Badge>;
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Customer Feedback</h1>
            </div>


            <InspectionFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onClearAll={handleClearFilters}
            />

            <div className="border rounded-lg bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Style</TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead>Stage</TableHead>
                            <TableHead>QA Decision</TableHead>
                            <TableHead>Customer Decision</TableHead>
                            <TableHead>Issues</TableHead>
                            <TableHead>Evaluation Date</TableHead>
                            <TableHead>Feedback Date</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inspections.map((inspection: Inspection) => (
                            <TableRow key={inspection.id}>
                                <TableCell className="font-medium">{inspection.style}</TableCell>
                                <TableCell>{inspection.color}</TableCell>
                                <TableCell>{inspection.stage}</TableCell>
                                <TableCell>
                                    <Badge variant={inspection.decision === 'Accepted' ? 'default' : inspection.decision === 'Rejected' ? 'destructive' : 'secondary'}>
                                        {inspection.decision || 'Pending'}
                                    </Badge>
                                </TableCell>
                                <TableCell>{getDecisionBadge(inspection.customer_decision)}</TableCell>
                                <TableCell>
                                    {inspection.customer_issues_count > 0 ? (
                                        <Badge className="bg-violet-500">
                                            <Tag className="w-3 h-3 mr-1" />
                                            {inspection.customer_issues_count}
                                        </Badge>
                                    ) : (
                                        <span className="text-gray-400 text-sm">—</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">
                                    {inspection.created_at ? new Date(inspection.created_at).toLocaleDateString('en-GB') : '-'}
                                </TableCell>
                                <TableCell>
                                    {inspection.customer_feedback_date ? new Date(inspection.customer_feedback_date).toLocaleDateString('en-GB') : '-'}
                                </TableCell>
                                <TableCell>
                                    {canAddCustomerFeedback ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEdit(inspection)}
                                        >
                                            <MessageSquare className="w-4 h-4 mr-2" />
                                            Feedback
                                        </Button>
                                    ) : (
                                        <span className="text-gray-400 text-sm">View Only</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* ==================== FEEDBACK DIALOG ==================== */}
            <Dialog open={isOpen} onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) {
                    setSelectedInspection(null);
                    setIssuesList([]);
                    setSelectedCategory('');
                }
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Update Customer Feedback
                            {selectedInspection && (
                                <span className="text-sm font-normal text-gray-500 ml-2">
                                    — {selectedInspection.style} / {selectedInspection.color}
                                </span>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-4">
                        {/* Customer Decision */}
                        <div className="space-y-2">
                            <Label>Customer Decision</Label>
                            <ShadcnSelect
                                onValueChange={(value) => setValue('customer_decision', value)}
                                defaultValue={selectedInspection?.customer_decision || ''}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select decision" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Accepted">Accepted</SelectItem>
                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                    <SelectItem value="Revision Requested">Revision Requested</SelectItem>
                                    <SelectItem value="Accepted with Comments">Accepted with Comments</SelectItem>
                                    <SelectItem value="Held Internally">Held Internally</SelectItem>
                                </SelectContent>
                            </ShadcnSelect>
                        </div>

                        {/* ---- STANDARDIZED ISSUES SECTION ---- */}
                        <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
                            <Label className="text-base font-semibold flex items-center gap-2">
                                <Tag className="w-4 h-4" />
                                Standardized Issues
                            </Label>
                            <p className="text-xs text-gray-500">
                                Select a category, then search and add standardized defects. These enable Pareto Analysis and Root Cause tracking.
                            </p>

                            {/* Category + Defect Picker Row */}
                            <div className="flex gap-3">
                                {/* Category Dropdown */}
                                <div className="w-[200px]">
                                    <ShadcnSelect
                                        onValueChange={(val) => setSelectedCategory(val)}
                                        value={selectedCategory}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Category..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORIES.map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </ShadcnSelect>
                                </div>

                                {/* Fuzzy Search Defect Dropdown */}
                                <div className="flex-1">
                                    <Select
                                        options={defectOptions}
                                        isDisabled={!selectedCategory}
                                        isClearable
                                        isSearchable
                                        placeholder={selectedCategory ? `Search ${selectedCategory} defects...` : 'Select a category first'}
                                        onChange={(option) => handleAddDefect(option)}
                                        value={null}
                                        noOptionsMessage={() => 'No matching defects'}
                                        styles={{
                                            control: (base) => ({
                                                ...base,
                                                borderColor: '#e5e7eb',
                                                minHeight: '36px',
                                                '&:hover': { borderColor: '#9ca3af' },
                                            }),
                                            option: (base, state) => ({
                                                ...base,
                                                backgroundColor: state.isFocused ? '#f3f4f6' : 'white',
                                                color: '#111827',
                                                fontSize: '14px',
                                            }),
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Issues List */}
                            {issuesList.length > 0 && (
                                <div className="space-y-2 mt-3">
                                    {issuesList.map((issue) => (
                                        <div
                                            key={issue.standardized_defect}
                                            className="flex items-center justify-between bg-white rounded-md border px-3 py-2 shadow-sm"
                                        >
                                            <div className="flex items-center gap-2 flex-1">
                                                <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[issue.defect_category] || 'bg-gray-100'}`}>
                                                    {issue.defect_category}
                                                </span>
                                                <span className="text-sm font-medium">{issue.defect_name}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${SEVERITY_COLORS[issue.defect_severity] || 'bg-gray-200'}`}>
                                                    {issue.defect_severity}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleStatus(issue.standardized_defect)}
                                                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                                                        issue.status === 'Open'
                                                            ? 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100'
                                                            : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                                                    }`}
                                                >
                                                    {issue.status}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveDefect(issue.standardized_defect)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="text-xs text-gray-400 text-right">
                                        {issuesList.length} issue{issuesList.length !== 1 ? 's' : ''} added
                                    </div>
                                </div>
                            )}

                            {issuesList.length === 0 && (
                                <div className="text-center py-4 text-sm text-gray-400 border-2 border-dashed rounded-lg">
                                    <Plus className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                                    No standardized issues added yet
                                </div>
                            )}
                        </div>

                        {/* General Comments (legacy) */}
                        <div className="space-y-2">
                            <Label>General Comments</Label>
                            <Textarea
                                {...register('customer_feedback_comments')}
                                placeholder="Enter general feedback comments..."
                                className="min-h-[80px]"
                            />
                        </div>

                        {/* Specialized Style Comments */}
                        <div className="space-y-2">
                            <Label>Specialized Style Comments</Label>
                            <p className="text-xs text-gray-500">
                                Non-standardizable, style-specific context (e.g., "For this style only, pocket flap must be curved")
                            </p>
                            <Textarea
                                {...register('specialized_remarks')}
                                placeholder="Enter style-specific comments that don't fit standard categories..."
                                className="min-h-[80px]"
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                            Save Feedback
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CustomerFeedback;
