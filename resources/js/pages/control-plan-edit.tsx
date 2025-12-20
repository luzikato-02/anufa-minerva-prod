import AppLayout from '@/layouts/app-layout';
import { controlPlansDisplay, dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    ArrowLeftIcon,
    PlusIcon,
    SaveIcon,
    TrashIcon,
    Loader2Icon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface ControlPlanItem {
    id?: number;
    control_plan_id?: number;
    process_no: string;
    process_step: string;
    process_items: string;
    machine_device_jig_tools: string;
    product_process_characteristics: string; // Keep for backward compatibility
    product_characteristics: string;
    process_characteristics: string;
    special_characteristics: string;
    product_process_specification_tolerance: string;
    evaluation_measurement_technique: string;
    sample_size: string;
    sample_frequency: string;
    control_method: string;
    reaction_plan: string;
    sort_order: number;
    is_new_revision?: boolean;
}

interface ControlPlan {
    id: number;
    document_number: string;
    title: string | null;
    description: string | null;
    control_plan_number?: string | null;
    part_number_latest_change_level?: string | null;
    part_name_description?: string | null;
    key_contact_phone?: string | null;
    core_team?: string | null;
    organization_plant?: string | null;
    organization_code?: string | null;
    customer_engineering_approval_date?: string | null;
    customer_quality_approval_date?: string | null;
    other_approval_date?: string | null;
    manufacturing_step?: 'prototype' | 'pre-launch' | 'production' | null;
    production_area?: string | null;
    referensi_sp?: string | null;
    tanggal_diterbitkan_sp?: string | null;
    tanggal_diterbitkan?: string | null;
    no_revisi_tanggal_revisi_terakhir?: string | null;
    tanggal_review_berikutnya?: string | null;
    signatures_dibuat_oleh?: string[] | null;
    signatures_disetujui_oleh?: string[] | null;
    asterisk_legend?: string | null;
    items: ControlPlanItem[];
}

interface PageProps {
    controlPlan: ControlPlan;
}

export default function ControlPlanEdit() {
    const { controlPlan } = usePage<{ controlPlan: ControlPlan }>().props;
    
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(!controlPlan);
    const [documentNumber, setDocumentNumber] = useState(controlPlan?.document_number ?? '');
    const [title, setTitle] = useState(controlPlan?.title ?? '');
    const [description, setDescription] = useState(controlPlan?.description ?? '');
    
    // Control Plan Header Fields
    const [controlPlanNumber, setControlPlanNumber] = useState(controlPlan?.control_plan_number ?? '');
    const [partNumberLatestChangeLevel, setPartNumberLatestChangeLevel] = useState(controlPlan?.part_number_latest_change_level ?? 'All Style');
    const [partNameDescription, setPartNameDescription] = useState(controlPlan?.part_name_description ?? 'Greige Fabric');
    const [keyContactPhone, setKeyContactPhone] = useState(controlPlan?.key_contact_phone ?? '');
    const [coreTeam, setCoreTeam] = useState(controlPlan?.core_team ?? 'QA, Prod, Tech, MTC');
    const [organizationPlant, setOrganizationPlant] = useState(controlPlan?.organization_plant ?? '');
    const [organizationCode, setOrganizationCode] = useState(controlPlan?.organization_code ?? '');
    const [customerEngineeringApprovalDate, setCustomerEngineeringApprovalDate] = useState(controlPlan?.customer_engineering_approval_date ?? '');
    const [customerQualityApprovalDate, setCustomerQualityApprovalDate] = useState(controlPlan?.customer_quality_approval_date ?? '');
    const [otherApprovalDate, setOtherApprovalDate] = useState(controlPlan?.other_approval_date ?? '');
    const [manufacturingStep, setManufacturingStep] = useState<'prototype' | 'pre-launch' | 'production'>(controlPlan?.manufacturing_step ?? 'production');
    const [productionArea, setProductionArea] = useState(controlPlan?.production_area ?? '');
    
    // Document Information Fields
    const [referensiSp, setReferensiSp] = useState(controlPlan?.referensi_sp ?? '');
    const [tanggalDiterbitkanSp, setTanggalDiterbitkanSp] = useState(controlPlan?.tanggal_diterbitkan_sp ?? '');
    const [tanggalDiterbitkan, setTanggalDiterbitkan] = useState(controlPlan?.tanggal_diterbitkan ?? '');
    const [noRevisiTanggalRevisiTerakhir, setNoRevisiTanggalRevisiTerakhir] = useState(controlPlan?.no_revisi_tanggal_revisi_terakhir ?? '');
    const [tanggalReviewBerikutnya, setTanggalReviewBerikutnya] = useState(controlPlan?.tanggal_review_berikutnya ?? '');
    
    // Signatures and Asterisk Legend
    const [signaturesDibuatOleh, setSignaturesDibuatOleh] = useState<string[]>(controlPlan?.signatures_dibuat_oleh ?? []);
    const [signaturesDisetujuiOleh, setSignaturesDisetujuiOleh] = useState<string[]>(controlPlan?.signatures_disetujui_oleh ?? []);
    const [asteriskLegend, setAsteriskLegend] = useState(controlPlan?.asterisk_legend ?? '');
    
    // Ensure all items have evaluation_measurement_technique, product_characteristics, and process_characteristics fields
    const initialItems = (controlPlan?.items ?? []).map((item: ControlPlanItem) => ({
        ...item,
        evaluation_measurement_technique: item.evaluation_measurement_technique ?? '',
        product_characteristics: item.product_characteristics ?? '',
        process_characteristics: item.process_characteristics ?? '',
    }));
    const [items, setItems] = useState<ControlPlanItem[]>(initialItems);
    const [controlPlanId, setControlPlanId] = useState<number | null>(controlPlan?.id ?? null);
    const [showRevisionDialog, setShowRevisionDialog] = useState(false);
    const [showRevisionOverrideDialog, setShowRevisionOverrideDialog] = useState(false);
    const [showRevisionHistoryManageDialog, setShowRevisionHistoryManageDialog] = useState(false);
    const [revisionHistoryOverride, setRevisionHistoryOverride] = useState<any[]>([]);
    const [revisionData, setRevisionData] = useState({
        page: '',
        date_of_revision: new Date().toISOString().split('T')[0],
        revision_number: '',
        description: '',
        revised_by: '',
    });

    // Initialize revision number from control plan if available
    useEffect(() => {
        if (controlPlan?.id) {
            // Fetch control plan to get next revision number
            const fetchRevisionInfo = async () => {
                try {
                    const baseUrl = window.location.origin;
                    const response = await fetch(`${baseUrl}/control-plans/${controlPlan.id}`, {
                        credentials: 'include',
                    });
                    if (response.ok) {
                        const json = await response.json();
                        if (json.next_revision_number) {
                            setRevisionData(prev => ({
                                ...prev,
                                revision_number: json.next_revision_number,
                            }));
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch revision info:', error);
                }
            };
            fetchRevisionInfo();
        }
    }, [controlPlan?.id]);

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Dashboard',
            href: dashboard().url,
        },
        {
            title: 'Control Plans',
            href: controlPlansDisplay().url,
        },
        {
            title: `Edit: ${documentNumber || 'Loading...'}`,
            href: '#',
        },
    ];

    // Fetch control plan data if not passed via props
    useEffect(() => {
        if (!controlPlan) {
            const fetchData = async () => {
                setFetching(true);
                try {
                    // Get ID from URL
                    const pathParts = window.location.pathname.split('/');
                    const id = pathParts[pathParts.length - 2]; // /control-plans/{id}/edit
                    
                    const baseUrl = window.location.origin;
                    const response = await fetch(`${baseUrl}/control-plans/${id}`, {
                        credentials: 'include',
                    });
                    
                    if (response.ok) {
                        const json = await response.json();
                        if (!json.data) {
                            console.error('Response missing data:', json);
                            alert('Failed to load control plan: Invalid response format');
                            router.visit(controlPlansDisplay().url);
                            return;
                        }
                        const data = json.data;
                        setControlPlanId(data.id);
                        setDocumentNumber(data.document_number);
                        setTitle(data.title ?? '');
                        setDescription(data.description ?? '');
                        setControlPlanNumber(data.control_plan_number ?? '');
                        setPartNumberLatestChangeLevel(data.part_number_latest_change_level ?? 'All Style');
                        setPartNameDescription(data.part_name_description ?? 'Greige Fabric');
                        setKeyContactPhone(data.key_contact_phone ?? '');
                        setCoreTeam(data.core_team ?? 'QA, Prod, Tech, MTC');
                        setOrganizationPlant(data.organization_plant ?? '');
                        setOrganizationCode(data.organization_code ?? '');
                        setCustomerEngineeringApprovalDate(data.customer_engineering_approval_date ?? '');
                        setCustomerQualityApprovalDate(data.customer_quality_approval_date ?? '');
                        setOtherApprovalDate(data.other_approval_date ?? '');
                        setManufacturingStep(data.manufacturing_step ?? 'production');
                        setProductionArea(data.production_area ?? '');
                        setReferensiSp(data.referensi_sp ?? '');
                        setTanggalDiterbitkanSp(data.tanggal_diterbitkan_sp ?? '');
                        setTanggalDiterbitkan(data.tanggal_diterbitkan ?? '');
                        setNoRevisiTanggalRevisiTerakhir(data.no_revisi_tanggal_revisi_terakhir ?? '');
                        setTanggalReviewBerikutnya(data.tanggal_review_berikutnya ?? '');
                        // Ensure all items have evaluation_measurement_technique, product_characteristics, and process_characteristics fields
                        const itemsWithEval = (data.items ?? []).map((item: ControlPlanItem) => ({
                            ...item,
                            evaluation_measurement_technique: item.evaluation_measurement_technique ?? '',
                            product_characteristics: item.product_characteristics ?? '',
                            process_characteristics: item.process_characteristics ?? '',
                            is_new_revision: item.is_new_revision ?? false,
                        }));
                        setItems(itemsWithEval);
                        setSignaturesDibuatOleh(data.signatures_dibuat_oleh ?? []);
                        setSignaturesDisetujuiOleh(data.signatures_disetujui_oleh ?? []);
                        setAsteriskLegend(data.asterisk_legend ?? '');
                        // Load revision history for override
                        if (data.revision_history && Array.isArray(data.revision_history)) {
                            setRevisionHistoryOverride(data.revision_history.map((rev: any) => ({
                                page: rev.page ?? '',
                                date_of_revision: rev.date_of_revision ? rev.date_of_revision.split('T')[0] : new Date().toISOString().split('T')[0],
                                revision_number: rev.revision_number ?? '',
                                description: rev.description ?? '',
                                revised_by: rev.revised_by ?? '',
                            })));
                        }
                        // Set suggested revision number
                        if (json.next_revision_number) {
                            setRevisionData(prev => ({
                                ...prev,
                                revision_number: json.next_revision_number,
                            }));
                        }
                    } else {
                        const errorText = await response.text();
                        let errorMessage = 'Failed to load control plan';
                        try {
                            const errorJson = JSON.parse(errorText);
                            errorMessage = errorJson.message || errorMessage;
                        } catch (e) {
                            console.error('Error response:', errorText);
                        }
                        console.error('Failed to load control plan:', response.status, errorMessage);
                        alert(`${errorMessage} (Status: ${response.status})`);
                        router.visit(controlPlansDisplay().url);
                    }
                } catch (error) {
                    console.error('Failed to fetch control plan:', error);
                    alert(`Failed to load control plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    router.visit(controlPlansDisplay().url);
                } finally {
                    setFetching(false);
                }
            };
            fetchData();
        }
    }, [controlPlan]);

    const getCsrfToken = () => {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    };

    const handleAddItem = () => {
        setItems([
            ...items,
            {
                process_no: '',
                process_step: '',
                process_items: '',
                machine_device_jig_tools: '',
                product_process_characteristics: '',
                product_characteristics: '',
                process_characteristics: '',
                special_characteristics: '',
                product_process_specification_tolerance: '',
                evaluation_measurement_technique: '',
                sample_size: '',
                sample_frequency: '',
                control_method: '',
                reaction_plan: '',
                sort_order: items.length,
                is_new_revision: false,
            },
        ]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleItemChange = (index: number, field: keyof ControlPlanItem, value: string | boolean) => {
        const newItems = [...items];
        (newItems[index] as Record<string, unknown>)[field] = value;
        setItems(newItems);
    };

    const handleSave = () => {
        if (!documentNumber.trim()) {
            alert('Document number is required');
            return;
        }

        if (!controlPlanId) {
            alert('Control plan ID not found');
            return;
        }

        // Show revision dialog before saving
        setShowRevisionDialog(true);
    };

    const handleRevisionSubmit = async () => {
        if (!revisionData.revision_number.trim()) {
            alert('Revision number is required');
            return;
        }

        setLoading(true);
        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/control-plans/${controlPlanId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({
                    document_number: documentNumber,
                    title,
                    description,
                    control_plan_number: controlPlanNumber,
                    part_number_latest_change_level: partNumberLatestChangeLevel,
                    part_name_description: partNameDescription,
                    key_contact_phone: keyContactPhone,
                    core_team: coreTeam,
                    organization_plant: organizationPlant,
                    organization_code: organizationCode,
                    customer_engineering_approval_date: customerEngineeringApprovalDate,
                    customer_quality_approval_date: customerQualityApprovalDate,
                    other_approval_date: otherApprovalDate,
                    manufacturing_step: manufacturingStep,
                    production_area: productionArea,
                    referensi_sp: referensiSp,
                    tanggal_diterbitkan_sp: tanggalDiterbitkanSp,
                    tanggal_diterbitkan: tanggalDiterbitkan,
                    no_revisi_tanggal_revisi_terakhir: noRevisiTanggalRevisiTerakhir,
                    tanggal_review_berikutnya: tanggalReviewBerikutnya,
                    signatures_dibuat_oleh: signaturesDibuatOleh,
                    signatures_disetujui_oleh: signaturesDisetujuiOleh,
                    asterisk_legend: asteriskLegend,
                    items: items.map((item, index) => ({
                        ...item,
                        sort_order: index,
                    })),
                    revision_history: revisionHistoryOverride.length > 0 ? undefined : revisionData,
                    override_revision_history: revisionHistoryOverride.length > 0 ? revisionHistoryOverride : undefined,
                }),
            });

            if (response.ok) {
                setShowRevisionDialog(false);
                router.visit(controlPlansDisplay().url);
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to update control plan');
            }
        } catch (error) {
            console.error('Failed to update control plan:', error);
            alert('Failed to update control plan');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        router.visit(controlPlansDisplay().url);
    };

    if (fetching) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Edit Control Plan" />
                <div className="flex h-full flex-1 items-center justify-center">
                    <div className="flex items-center gap-2">
                        <Loader2Icon className="h-6 w-6 animate-spin" />
                        <span>Loading control plan...</span>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit Control Plan - ${documentNumber}`} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" onClick={handleCancel}>
                            <ArrowLeftIcon className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                        <h1 className="text-2xl font-bold">Edit Control Plan</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={loading}>
                            <SaveIcon className="mr-2 h-4 w-4" />
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>

                {/* Document Info */}
                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 text-lg font-semibold">Document Information</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Document Number <span className="text-red-500">*</span>
                            </label>
                            <Input
                                value={documentNumber}
                                onChange={(e) => setDocumentNumber(e.target.value)}
                                placeholder="e.g., CP-2025-001"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Title</label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Enter control plan title"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Enter description"
                            />
                        </div>
                    </div>
                </div>

                {/* Control Plan Header Information */}
                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 text-lg font-semibold">Control Plan Header Information</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Control Plan Number</label>
                            <Input
                                value={controlPlanNumber}
                                onChange={(e) => setControlPlanNumber(e.target.value)}
                                placeholder="e.g., W-WSD-W-30"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Part Number / Latest Change Level</label>
                            <Input
                                value={partNumberLatestChangeLevel}
                                onChange={(e) => setPartNumberLatestChangeLevel(e.target.value)}
                                placeholder="e.g., All Style"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Part Name / Description</label>
                            <Input
                                value={partNameDescription}
                                onChange={(e) => setPartNameDescription(e.target.value)}
                                placeholder="e.g., Greige Fabric"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Key Contact/Phone</label>
                            <Input
                                value={keyContactPhone}
                                onChange={(e) => setKeyContactPhone(e.target.value)}
                                placeholder="Name and phone number"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Core Team</label>
                            <Input
                                value={coreTeam}
                                onChange={(e) => setCoreTeam(e.target.value)}
                                placeholder="e.g., QA, Prod, Tech, MTC"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Organization/Plant</label>
                            <Input
                                value={organizationPlant}
                                onChange={(e) => setOrganizationPlant(e.target.value)}
                                placeholder="Organization name"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Organization Code</label>
                            <Input
                                value={organizationCode}
                                onChange={(e) => setOrganizationCode(e.target.value)}
                                placeholder="Organization code"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Customer Engineering Approval/Date</label>
                            <Input
                                value={customerEngineeringApprovalDate}
                                onChange={(e) => setCustomerEngineeringApprovalDate(e.target.value)}
                                placeholder="(If Req'd.)"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Customer Quality Approval/Date</label>
                            <Input
                                value={customerQualityApprovalDate}
                                onChange={(e) => setCustomerQualityApprovalDate(e.target.value)}
                                placeholder="(If Req'd.)"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Other Approval/Date</label>
                            <Input
                                value={otherApprovalDate}
                                onChange={(e) => setOtherApprovalDate(e.target.value)}
                                placeholder="(If Req'd.)"
                            />
                        </div>
                    </div>
                </div>

                {/* Manufacturing Step and Production Area */}
                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 text-lg font-semibold">Manufacturing Information</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Manufacturing Step</label>
                            <Select value={manufacturingStep} onValueChange={(value: 'prototype' | 'pre-launch' | 'production') => setManufacturingStep(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select manufacturing step" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="prototype">Prototype</SelectItem>
                                    <SelectItem value="pre-launch">Pre-launch</SelectItem>
                                    <SelectItem value="production">Production</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Production Area</label>
                            <Input
                                value={productionArea}
                                onChange={(e) => setProductionArea(e.target.value)}
                                placeholder="Enter production area"
                            />
                        </div>
                    </div>
                </div>

                {/* Document Dates and Revision Information */}
                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 text-lg font-semibold">Document Dates and Revision Information</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Referensi SP</label>
                            <Input
                                value={referensiSp}
                                onChange={(e) => setReferensiSp(e.target.value)}
                                placeholder="e.g., W-W-01"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tanggal Diterbitkan SP</label>
                            <Input
                                type="date"
                                value={tanggalDiterbitkanSp}
                                onChange={(e) => setTanggalDiterbitkanSp(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tanggal Diterbitkan</label>
                            <Input
                                type="date"
                                value={tanggalDiterbitkan}
                                onChange={(e) => setTanggalDiterbitkan(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">No. Revisi/Tanggal Revisi Terakhir</label>
                            <Input
                                value={noRevisiTanggalRevisiTerakhir}
                                onChange={(e) => setNoRevisiTanggalRevisiTerakhir(e.target.value)}
                                placeholder="e.g., 09 / 10 Oktober 2025"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tanggal Review Berikutnya</label>
                            <Input
                                type="date"
                                value={tanggalReviewBerikutnya}
                                onChange={(e) => setTanggalReviewBerikutnya(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="flex-1 rounded-lg border bg-card p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Control Plan Items ({items.length})</h2>
                        <Button size="sm" onClick={handleAddItem}>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            Add Row
                        </Button>
                    </div>

                    <div className="overflow-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky left-0 z-10 bg-background whitespace-nowrap">#</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[80px]">Process No.</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[120px]">Process Step</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[120px]">Process Items</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[150px]">Machine/Device/Jig/Tools</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[150px]">Product Characteristics</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[150px]">Process Characteristics</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[100px]">Special Char.</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[150px]">Specification/Tolerance</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[150px]">Evaluation/Measurement Technique</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[80px]">Sample Size</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[100px]">Sample Freq.</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[120px]">Control Method</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[120px]">Reaction Plan</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[100px]">New Revision</TableHead>
                                    <TableHead className="sticky right-0 z-10 bg-background whitespace-nowrap">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, index) => (
                                    <TableRow key={item.id ?? index}>
                                        <TableCell className="sticky left-0 z-10 bg-background font-medium">
                                            {index + 1}
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.process_no}
                                                onChange={(e) => handleItemChange(index, 'process_no', e.target.value)}
                                                className="min-w-[60px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.process_step}
                                                onChange={(e) => handleItemChange(index, 'process_step', e.target.value)}
                                                className="min-w-[100px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.process_items}
                                                onChange={(e) => handleItemChange(index, 'process_items', e.target.value)}
                                                className="min-w-[100px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.machine_device_jig_tools}
                                                onChange={(e) => handleItemChange(index, 'machine_device_jig_tools', e.target.value)}
                                                className="min-w-[130px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.product_characteristics || ''}
                                                onChange={(e) => handleItemChange(index, 'product_characteristics', e.target.value)}
                                                className="min-w-[130px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.process_characteristics || ''}
                                                onChange={(e) => handleItemChange(index, 'process_characteristics', e.target.value)}
                                                className="min-w-[130px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.special_characteristics}
                                                onChange={(e) => handleItemChange(index, 'special_characteristics', e.target.value)}
                                                className="min-w-[80px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.product_process_specification_tolerance}
                                                onChange={(e) => handleItemChange(index, 'product_process_specification_tolerance', e.target.value)}
                                                className="min-w-[130px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.evaluation_measurement_technique || ''}
                                                onChange={(e) => handleItemChange(index, 'evaluation_measurement_technique', e.target.value)}
                                                className="min-w-[130px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.sample_size}
                                                onChange={(e) => handleItemChange(index, 'sample_size', e.target.value)}
                                                className="min-w-[60px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.sample_frequency}
                                                onChange={(e) => handleItemChange(index, 'sample_frequency', e.target.value)}
                                                className="min-w-[80px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.control_method}
                                                onChange={(e) => handleItemChange(index, 'control_method', e.target.value)}
                                                className="min-w-[100px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.reaction_plan}
                                                onChange={(e) => handleItemChange(index, 'reaction_plan', e.target.value)}
                                                className="min-w-[100px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                checked={item.is_new_revision || false}
                                                onChange={(e) => handleItemChange(index, 'is_new_revision', e.target.checked)}
                                                className="h-4 w-4"
                                            />
                                        </TableCell>
                                        <TableCell className="sticky right-0 z-10 bg-background">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                                onClick={() => handleRemoveItem(index)}
                                                disabled={items.length === 1}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-4 flex justify-center">
                        <Button variant="outline" onClick={handleAddItem}>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            Add Another Row
                        </Button>
                    </div>
                </div>

                {/* Signatures Section */}
                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 text-lg font-semibold">Signatures</h2>
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold">Dibuat oleh:</h3>
                            {signaturesDibuatOleh.map((signature, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input
                                        value={signature}
                                        onChange={(e) => {
                                            const newSignatures = [...signaturesDibuatOleh];
                                            newSignatures[index] = e.target.value;
                                            setSignaturesDibuatOleh(newSignatures);
                                        }}
                                        placeholder="Person name"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSignaturesDibuatOleh(signaturesDibuatOleh.filter((_, i) => i !== index));
                                        }}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSignaturesDibuatOleh([...signaturesDibuatOleh, ''])}
                            >
                                <PlusIcon className="mr-2 h-4 w-4" />
                                Add Signature
                            </Button>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold">Disetujui oleh:</h3>
                            {signaturesDisetujuiOleh.map((signature, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input
                                        value={signature}
                                        onChange={(e) => {
                                            const newSignatures = [...signaturesDisetujuiOleh];
                                            newSignatures[index] = e.target.value;
                                            setSignaturesDisetujuiOleh(newSignatures);
                                        }}
                                        placeholder="Person name"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSignaturesDisetujuiOleh(signaturesDisetujuiOleh.filter((_, i) => i !== index));
                                        }}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSignaturesDisetujuiOleh([...signaturesDisetujuiOleh, ''])}
                            >
                                <PlusIcon className="mr-2 h-4 w-4" />
                                Add Signature
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Asterisk Legend */}
                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 text-lg font-semibold">Asterisk Legend</h2>
                    <Textarea
                        value={asteriskLegend}
                        onChange={(e) => setAsteriskLegend(e.target.value)}
                        placeholder="Enter asterisk meanings (e.g., * = Critical, ** = Important)"
                        rows={4}
                    />
                </div>
            </div>

            {/* Revision Override Alert Dialog */}
            <AlertDialog open={showRevisionOverrideDialog} onOpenChange={setShowRevisionOverrideDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Override Revision History?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Warning: Overriding the revision history will result in loss of document traceability. 
                            This action cannot be undone. Are you sure you want to proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            setShowRevisionOverrideDialog(false);
                            // Handle revision override logic here
                        }}>
                            Override Anyway
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Revision History Dialog */}
            <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Add Revision History</DialogTitle>
                        <DialogDescription>
                            Please provide revision details for this control plan update.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mb-4 flex justify-between items-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowRevisionOverrideDialog(true)}
                        >
                            Override Revision History
                        </Button>
                        {revisionHistoryOverride.length > 0 && (
                            <span className="text-sm text-muted-foreground">
                                {revisionHistoryOverride.length} revision(s) will be overridden
                            </span>
                        )}
                    </div>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">
                                Revision Number <span className="text-red-500">*</span>
                            </label>
                            <Input
                                value={revisionData.revision_number}
                                onChange={(e) => setRevisionData({ ...revisionData, revision_number: e.target.value })}
                                placeholder="e.g., 01, 02, 03"
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">
                                Date of Revision <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="date"
                                value={revisionData.date_of_revision}
                                onChange={(e) => setRevisionData({ ...revisionData, date_of_revision: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Page(s)</label>
                            <Input
                                value={revisionData.page}
                                onChange={(e) => setRevisionData({ ...revisionData, page: e.target.value })}
                                placeholder="e.g., All, 1-3, 4, 5"
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Description</label>
                            <Textarea
                                value={revisionData.description}
                                onChange={(e) => setRevisionData({ ...revisionData, description: e.target.value })}
                                placeholder="Describe the changes made in this revision"
                                rows={4}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Revised By</label>
                            <Input
                                value={revisionData.revised_by}
                                onChange={(e) => setRevisionData({ ...revisionData, revised_by: e.target.value })}
                                placeholder="Name of person who made the revision"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowRevisionDialog(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleRevisionSubmit} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
