import AppLayout from '@/layouts/app-layout';
import { controlPlansDisplay, dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
} from 'lucide-react';
import { useState } from 'react';

interface ControlPlanItem {
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
}

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
        title: 'Create New',
        href: '#',
    },
];

export default function ControlPlanCreate() {
    const [loading, setLoading] = useState(false);
    const [documentNumber, setDocumentNumber] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    
    // Control Plan Header Fields
    const [controlPlanNumber, setControlPlanNumber] = useState('');
    const [partNumberLatestChangeLevel, setPartNumberLatestChangeLevel] = useState('All Style');
    const [partNameDescription, setPartNameDescription] = useState('Greige Fabric');
    const [keyContactPhone, setKeyContactPhone] = useState('');
    const [coreTeam, setCoreTeam] = useState('QA, Prod, Tech, MTC');
    const [organizationPlant, setOrganizationPlant] = useState('');
    const [organizationCode, setOrganizationCode] = useState('');
    const [customerEngineeringApprovalDate, setCustomerEngineeringApprovalDate] = useState('');
    const [customerQualityApprovalDate, setCustomerQualityApprovalDate] = useState('');
    const [otherApprovalDate, setOtherApprovalDate] = useState('');
    const [manufacturingStep, setManufacturingStep] = useState<'prototype' | 'pre-launch' | 'production'>('production');
    const [productionArea, setProductionArea] = useState('');
    
    // Document Information Fields
    const [referensiSp, setReferensiSp] = useState('');
    const [tanggalDiterbitkanSp, setTanggalDiterbitkanSp] = useState('');
    const [tanggalDiterbitkan, setTanggalDiterbitkan] = useState('');
    const [noRevisiTanggalRevisiTerakhir, setNoRevisiTanggalRevisiTerakhir] = useState('');
    const [tanggalReviewBerikutnya, setTanggalReviewBerikutnya] = useState('');
    
    const [items, setItems] = useState<ControlPlanItem[]>([
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
            sort_order: 0,
        },
    ]);

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
                    },
        ]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleItemChange = (index: number, field: keyof ControlPlanItem, value: string) => {
        const newItems = [...items];
        (newItems[index] as Record<string, unknown>)[field] = value;
        setItems(newItems);
    };

    const getCsrfToken = () => {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    };

    const handleSave = async () => {
        if (!documentNumber.trim()) {
            alert('Document number is required');
            return;
        }

        setLoading(true);
        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/control-plans`, {
                method: 'POST',
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
                    items: items.map((item, index) => ({
                        ...item,
                        sort_order: index,
                    })),
                }),
            });

            if (response.ok) {
                router.visit(controlPlansDisplay().url);
            } else {
                const error = await response.json();
                alert(error.message || 'Failed to create control plan');
            }
        } catch (error) {
            console.error('Failed to create control plan:', error);
            alert('Failed to create control plan');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        router.visit(controlPlansDisplay().url);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Control Plan" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" onClick={handleCancel}>
                            <ArrowLeftIcon className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                        <h1 className="text-2xl font-bold">Create New Control Plan</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={loading}>
                            <SaveIcon className="mr-2 h-4 w-4" />
                            {loading ? 'Saving...' : 'Save Control Plan'}
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
                        <h2 className="text-lg font-semibold">Control Plan Items</h2>
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
                                    <TableHead className="sticky right-0 z-10 bg-background whitespace-nowrap">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, index) => (
                                    <TableRow key={index}>
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
                                                value={item.evaluation_measurement_technique}
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
            </div>
        </AppLayout>
    );
}
