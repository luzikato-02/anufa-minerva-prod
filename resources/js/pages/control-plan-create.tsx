import AppLayout from '@/layouts/app-layout';
import { controlPlansDisplay, dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
    product_process_characteristics: string;
    special_characteristics: string;
    product_process_specification_tolerance: string;
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
    const [items, setItems] = useState<ControlPlanItem[]>([
        {
            process_no: '',
            process_step: '',
            process_items: '',
            machine_device_jig_tools: '',
            product_process_characteristics: '',
            special_characteristics: '',
            product_process_specification_tolerance: '',
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
                special_characteristics: '',
                product_process_specification_tolerance: '',
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
                },
                credentials: 'include',
                body: JSON.stringify({
                    document_number: documentNumber,
                    title,
                    description,
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
                                    <TableHead className="whitespace-nowrap min-w-[150px]">Product/Process Characteristics</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[100px]">Special Char.</TableHead>
                                    <TableHead className="whitespace-nowrap min-w-[150px]">Specification/Tolerance</TableHead>
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
                                                value={item.product_process_characteristics}
                                                onChange={(e) => handleItemChange(index, 'product_process_characteristics', e.target.value)}
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
