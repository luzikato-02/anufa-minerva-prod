'use client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    type ColumnDef,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type SortingState,
    useReactTable,
    type VisibilityState,
} from '@tanstack/react-table';
import {
    ChevronDown,
    DownloadIcon,
    EditIcon,
    EyeIcon,
    PlusIcon,
    TrashIcon,
    SaveIcon,
    XIcon,
} from 'lucide-react';
import * as React from 'react';
import { useEffect, useState } from 'react';

interface ControlPlanItem {
    id?: number;
    control_plan_id?: number;
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

interface ControlPlan {
    id: number;
    document_number: string;
    title: string | null;
    description: string | null;
    created_by: number | null;
    items: ControlPlanItem[];
    created_at?: string;
    updated_at?: string;
}

interface LaravelPaginatedResponse<T> {
    current_page: number;
    data: T[];
    last_page: number;
    per_page: number;
    total: number;
}

export const columns: ColumnDef<ControlPlan>[] = [
    {
        id: 'select',
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && 'indeterminate')
                }
                onCheckedChange={(value) =>
                    table.toggleAllPageRowsSelected(!!value)
                }
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: 'document_number',
        header: 'Document Number',
        cell: ({ getValue }) => (
            <div className="font-medium">{getValue() as string}</div>
        ),
    },
    {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => (
            <div className="capitalize">{(getValue() as string) ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => (
            <div className="max-w-[200px] truncate">
                {(getValue() as string) ?? 'N/A'}
            </div>
        ),
    },
    {
        accessorKey: 'items',
        header: 'Items Count',
        cell: ({ getValue }) => {
            const items = getValue() as ControlPlanItem[];
            return <Badge variant="secondary">{items?.length ?? 0} items</Badge>;
        },
    },
    {
        accessorKey: 'created_at',
        header: 'Created Date',
        cell: ({ getValue }) => {
            const date = new Date(getValue() as string);
            return (
                <div>
                    {date.toLocaleString('en-ID', {
                        day: '2-digit',
                        month: 'numeric',
                        year: 'numeric',
                    })}
                </div>
            );
        },
    },
    {
        id: 'actions',
        header: 'Actions',
        enableHiding: false,
        cell: ({ row, table }) => {
            const record = row.original;
            const meta = table.options.meta as { refreshData: () => void } | undefined;
            return (
                <div className="flex items-center gap-1">
                    <ViewControlPlanDialog record={record} />
                    <EditControlPlanDialog record={record} onSave={() => meta?.refreshData()} />
                    <DeleteControlPlanDialog record={record} onDelete={() => meta?.refreshData()} />
                </div>
            );
        },
    },
];

function ViewControlPlanDialog({ record }: { record: ControlPlan }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <EyeIcon className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-[900px]">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>Control Plan Details</DialogTitle>
                    <DialogDescription>
                        Document Number: {record.document_number}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 px-6 pb-6">
                    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                                <div>
                                    <p className="text-xs font-medium uppercase text-gray-500">
                                        Title
                                    </p>
                                    <p className="mt-1 text-sm font-semibold">
                                        {record.title ?? 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase text-gray-500">
                                        Description
                                    </p>
                                    <p className="mt-1 text-sm">
                                        {record.description ?? 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex-1 space-y-3">
                                <div>
                                    <p className="text-xs font-medium uppercase text-gray-500">
                                        Total Items
                                    </p>
                                    <p className="mt-1 text-sm font-semibold">
                                        {record.items?.length ?? 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase text-gray-500">
                                        Created Date
                                    </p>
                                    <p className="mt-1 text-sm">
                                        {new Date(record.created_at || '').toLocaleString(
                                            'en-ID',
                                            {
                                                day: '2-digit',
                                                month: 'long',
                                                year: 'numeric',
                                            }
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="rounded-lg border">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="whitespace-nowrap">Process No.</TableHead>
                                        <TableHead className="whitespace-nowrap">Process Step</TableHead>
                                        <TableHead className="whitespace-nowrap">Process Items</TableHead>
                                        <TableHead className="whitespace-nowrap">Machine/Device/Jig/Tools</TableHead>
                                        <TableHead className="whitespace-nowrap">Product/Process Characteristics</TableHead>
                                        <TableHead className="whitespace-nowrap">Special Char.</TableHead>
                                        <TableHead className="whitespace-nowrap">Specification/Tolerance</TableHead>
                                        <TableHead className="whitespace-nowrap">Sample Size</TableHead>
                                        <TableHead className="whitespace-nowrap">Sample Freq.</TableHead>
                                        <TableHead className="whitespace-nowrap">Control Method</TableHead>
                                        <TableHead className="whitespace-nowrap">Reaction Plan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {record.items?.length > 0 ? (
                                        record.items.map((item, index) => (
                                            <TableRow key={item.id ?? index}>
                                                <TableCell>{item.process_no}</TableCell>
                                                <TableCell>{item.process_step}</TableCell>
                                                <TableCell>{item.process_items}</TableCell>
                                                <TableCell>{item.machine_device_jig_tools}</TableCell>
                                                <TableCell>{item.product_process_characteristics}</TableCell>
                                                <TableCell>{item.special_characteristics}</TableCell>
                                                <TableCell>{item.product_process_specification_tolerance}</TableCell>
                                                <TableCell>{item.sample_size}</TableCell>
                                                <TableCell>{item.sample_frequency}</TableCell>
                                                <TableCell>{item.control_method}</TableCell>
                                                <TableCell>{item.reaction_plan}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={11} className="text-center text-gray-500">
                                                No items found
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EditControlPlanDialog({ record, onSave }: { record: ControlPlan; onSave: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [documentNumber, setDocumentNumber] = useState(record.document_number);
    const [title, setTitle] = useState(record.title ?? '');
    const [description, setDescription] = useState(record.description ?? '');
    const [items, setItems] = useState<ControlPlanItem[]>(record.items ?? []);

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
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: keyof ControlPlanItem, value: string) => {
        const newItems = [...items];
        (newItems[index] as Record<string, unknown>)[field] = value;
        setItems(newItems);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/control-plans/${record.id}`, {
                method: 'PUT',
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
                setOpen(false);
                onSave();
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <EditIcon className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-[1000px]">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>Edit Control Plan</DialogTitle>
                    <DialogDescription>
                        Update control plan details and items
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 px-6 pb-6">
                    {/* Document Info */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className="text-sm font-medium">Document Number</label>
                            <Input
                                value={documentNumber}
                                onChange={(e) => setDocumentNumber(e.target.value)}
                                placeholder="Enter document number"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Title</label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Enter title"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Description</label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Enter description"
                            />
                        </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Control Plan Items</h3>
                            <Button size="sm" onClick={handleAddItem}>
                                <PlusIcon className="mr-1 h-4 w-4" />
                                Add Item
                            </Button>
                        </div>

                        <div className="rounded-lg border">
                            <div className="max-h-[400px] overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Process No.</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Process Step</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Process Items</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Machine/Device</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Characteristics</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Special Char.</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Spec/Tolerance</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Sample Size</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Sample Freq.</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Control Method</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Reaction Plan</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item, index) => (
                                            <TableRow key={index}>
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
                                                        className="min-w-[120px]"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={item.product_process_characteristics}
                                                        onChange={(e) => handleItemChange(index, 'product_process_characteristics', e.target.value)}
                                                        className="min-w-[120px]"
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
                                                        className="min-w-[120px]"
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
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                                        onClick={() => handleRemoveItem(index)}
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {items.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={12} className="text-center text-gray-500">
                                                    No items. Click "Add Item" to add a new row.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        <SaveIcon className="mr-2 h-4 w-4" />
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DeleteControlPlanDialog({ record, onDelete }: { record: ControlPlan; onDelete: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/control-plans/${record.id}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                },
                credentials: 'include',
            });

            if (response.ok) {
                setOpen(false);
                onDelete();
            } else {
                alert('Failed to delete control plan');
            }
        } catch (error) {
            console.error('Failed to delete control plan:', error);
            alert('Failed to delete control plan');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                    <TrashIcon className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Delete Control Plan</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete control plan "{record.document_number}"? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                        {loading ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CreateControlPlanDialog({ onSave }: { onSave: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [documentNumber, setDocumentNumber] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [items, setItems] = useState<ControlPlanItem[]>([]);

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
        setItems(items.filter((_, i) => i !== index));
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
                setOpen(false);
                setDocumentNumber('');
                setTitle('');
                setDescription('');
                setItems([]);
                onSave();
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    New Control Plan
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-[1000px]">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>Create New Control Plan</DialogTitle>
                    <DialogDescription>
                        Enter control plan details and add items
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 px-6 pb-6">
                    {/* Document Info */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className="text-sm font-medium">Document Number *</label>
                            <Input
                                value={documentNumber}
                                onChange={(e) => setDocumentNumber(e.target.value)}
                                placeholder="e.g., CP-2025-001"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Title</label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Enter title"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Description</label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Enter description"
                            />
                        </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Control Plan Items</h3>
                            <Button size="sm" onClick={handleAddItem}>
                                <PlusIcon className="mr-1 h-4 w-4" />
                                Add Item
                            </Button>
                        </div>

                        <div className="rounded-lg border">
                            <div className="max-h-[400px] overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Process No.</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Process Step</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Process Items</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Machine/Device</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Characteristics</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Special Char.</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Spec/Tolerance</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Sample Size</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Sample Freq.</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Control Method</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Reaction Plan</TableHead>
                                            <TableHead className="sticky top-0 bg-background whitespace-nowrap">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item, index) => (
                                            <TableRow key={index}>
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
                                                        className="min-w-[120px]"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={item.product_process_characteristics}
                                                        onChange={(e) => handleItemChange(index, 'product_process_characteristics', e.target.value)}
                                                        className="min-w-[120px]"
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
                                                        className="min-w-[120px]"
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
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                                        onClick={() => handleRemoveItem(index)}
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {items.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={12} className="text-center text-gray-500">
                                                    No items. Click "Add Item" to add a new row.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        <SaveIcon className="mr-2 h-4 w-4" />
                        {loading ? 'Creating...' : 'Create Control Plan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ControlPlanDataTable() {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [data, setData] = useState<ControlPlan[]>([]);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });

    const refreshData = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        manualPagination: true,
        manualFiltering: true,
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: setPagination,
        pageCount,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            pagination,
        },
        meta: {
            refreshData,
        },
    });

    const baseUrl = window.location.origin;

    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            setLoading(true);

            const params = new URLSearchParams({
                page: (pagination.pageIndex + 1).toString(),
                per_page: pagination.pageSize.toString(),
            });

            if (globalFilter) {
                params.append('search', globalFilter);
            }

            columnFilters.forEach((filter) => {
                if (filter.value) {
                    params.append(filter.id, String(filter.value));
                }
            });

            if (sorting.length > 0) {
                const sort = sorting[0];
                params.append('sort_by', sort.id);
                params.append('sort_dir', sort.desc ? 'desc' : 'asc');
            }

            try {
                const response = await fetch(
                    `${baseUrl}/control-plans?${params.toString()}`,
                    {
                        credentials: 'include',
                        signal: controller.signal,
                    }
                );

                const json: LaravelPaginatedResponse<ControlPlan> = await response.json();
                setData(json.data);
                setPageCount(json.last_page);
            } catch (error: unknown) {
                if (error instanceof Error && error.name !== 'AbortError') {
                    console.error('Fetch error:', error);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => controller.abort();
    }, [
        pagination.pageIndex,
        pagination.pageSize,
        sorting,
        globalFilter,
        columnFilters,
        refreshTrigger,
    ]);

    return (
        <div className="w-full">
            <div className="flex items-center justify-between py-4">
                <Input
                    placeholder="Search control plans..."
                    value={globalFilter ?? ''}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="max-w-sm"
                />
                <div className="ml-auto flex items-center gap-2">
                    <CreateControlPlanDialog onSave={refreshData} />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="ml-auto bg-transparent">
                                Columns <ChevronDown />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(!!value)
                                            }
                                        >
                                            {column.id}
                                        </DropdownMenuCheckboxItem>
                                    );
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef.header,
                                                      header.getContext()
                                                  )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && 'selected'}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No control plans found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{' '}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
