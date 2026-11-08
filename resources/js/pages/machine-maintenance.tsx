import { Empty } from '@/components/data-grid-cells';
import { PageHeader } from '@/components/page-header';
import { Panel, PanelSkeleton } from '@/components/panel';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import AppLayout from '@/layouts/app-layout';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertCircle,
    Loader2,
    Pencil,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Machine Maintenance', href: '/machine-maintenance' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface MachineType {
    id: number;
    type_name: string;
    total_spindles: number;
    rpm_min: number | null;
    rpm_max: number | null;
    min_runtime_hours: string | null;
    max_runtime_hours: string | null;
    description: string | null;
    machine_definitions_count: number;
}

interface MachineDefinition {
    id: number;
    machine_number: string;
    machine_type_id: number;
    is_active: boolean;
    notes: string | null;
    machine_type: {
        id: number;
        type_name: string;
        total_spindles: number;
    } | null;
}

// ── Machine Type Form ─────────────────────────────────────────────────────────

function MachineTypeForm({
    initial,
    onSave,
    onClose,
}: {
    initial?: MachineType;
    onSave: () => void;
    onClose: () => void;
}) {
    const [form, setForm] = useState({
        type_name: initial?.type_name ?? '',
        total_spindles: initial?.total_spindles?.toString() ?? '',
        rpm_min: initial?.rpm_min?.toString() ?? '',
        rpm_max: initial?.rpm_max?.toString() ?? '',
        min_runtime_hours: initial?.min_runtime_hours ?? '',
        max_runtime_hours: initial?.max_runtime_hours ?? '',
        description: initial?.description ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

    const handleSubmit = async () => {
        setSaving(true);
        setError(null);
        try {
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            const payload = {
                type_name: form.type_name,
                total_spindles: parseInt(form.total_spindles) || 0,
                rpm_min: form.rpm_min !== '' ? parseInt(form.rpm_min) : null,
                rpm_max: form.rpm_max !== '' ? parseInt(form.rpm_max) : null,
                min_runtime_hours:
                    form.min_runtime_hours !== ''
                        ? parseFloat(form.min_runtime_hours)
                        : null,
                max_runtime_hours:
                    form.max_runtime_hours !== ''
                        ? parseFloat(form.max_runtime_hours)
                        : null,
                description: form.description || null,
            };
            const headers = { 'X-CSRF-TOKEN': csrf };
            if (initial) {
                await axios.patch(`/machine-types/${initial.id}`, payload, {
                    headers,
                });
            } else {
                await axios.post('/machine-types', payload, { headers });
            }
            onSave();
        } catch (err: unknown) {
            setError(
                axios.isAxiosError(err) && err.response?.data?.message
                    ? err.response.data.message
                    : axios.isAxiosError(err) && err.response?.data?.errors
                      ? Object.values(err.response.data.errors)
                            .flat()
                            .join('; ')
                      : 'Save failed.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open
            onOpenChange={(v) => {
                if (!v) onClose();
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {initial ? 'Edit Machine Type' : 'Add Machine Type'}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-1.5">
                        <Label htmlFor="mt-name">Type Name *</Label>
                        <Input
                            id="mt-name"
                            value={form.type_name}
                            onChange={(e) => set('type_name', e.target.value)}
                            placeholder="e.g. Standard"
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="mt-spindles">
                            Total Spindles (per machine) *
                        </Label>
                        <Input
                            id="mt-spindles"
                            type="number"
                            min="1"
                            value={form.total_spindles}
                            onChange={(e) =>
                                set('total_spindles', e.target.value)
                            }
                            placeholder="e.g. 200"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="mt-rpm-min">RPM Min</Label>
                            <Input
                                id="mt-rpm-min"
                                type="number"
                                min="0"
                                value={form.rpm_min}
                                onChange={(e) => set('rpm_min', e.target.value)}
                                placeholder="optional"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="mt-rpm-max">RPM Max</Label>
                            <Input
                                id="mt-rpm-max"
                                type="number"
                                min="0"
                                value={form.rpm_max}
                                onChange={(e) => set('rpm_max', e.target.value)}
                                placeholder="optional"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="mt-run-min">
                                Min Runtime (h/spindle)
                            </Label>
                            <Input
                                id="mt-run-min"
                                type="number"
                                step="0.001"
                                min="0"
                                value={form.min_runtime_hours}
                                onChange={(e) =>
                                    set('min_runtime_hours', e.target.value)
                                }
                                placeholder="optional"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="mt-run-max">
                                Max Runtime (h/spindle)
                            </Label>
                            <Input
                                id="mt-run-max"
                                type="number"
                                step="0.001"
                                min="0"
                                value={form.max_runtime_hours}
                                onChange={(e) =>
                                    set('max_runtime_hours', e.target.value)
                                }
                                placeholder="optional"
                            />
                        </div>
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="mt-desc">Description</Label>
                        <Input
                            id="mt-desc"
                            value={form.description}
                            onChange={(e) => set('description', e.target.value)}
                            placeholder="optional"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {initial ? 'Save Changes' : 'Add Type'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Machine Definition Form ───────────────────────────────────────────────────

function MachineDefinitionForm({
    initial,
    machineTypes,
    onSave,
    onClose,
}: {
    initial?: MachineDefinition;
    machineTypes: MachineType[];
    onSave: () => void;
    onClose: () => void;
}) {
    const [form, setForm] = useState({
        machine_number: initial?.machine_number ?? '',
        machine_type_id: initial?.machine_type_id?.toString() ?? '',
        is_active: initial?.is_active ?? true,
        notes: initial?.notes ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedType = machineTypes.find(
        (t) => t.id.toString() === form.machine_type_id,
    );

    const handleSubmit = async () => {
        setSaving(true);
        setError(null);
        try {
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            const payload = {
                machine_number: form.machine_number,
                machine_type_id: parseInt(form.machine_type_id),
                is_active: form.is_active,
                notes: form.notes || null,
            };
            const headers = { 'X-CSRF-TOKEN': csrf };
            if (initial) {
                await axios.patch(
                    `/machine-definitions/${initial.id}`,
                    payload,
                    { headers },
                );
            } else {
                await axios.post('/machine-definitions', payload, { headers });
            }
            onSave();
        } catch (err: unknown) {
            setError(
                axios.isAxiosError(err) && err.response?.data?.message
                    ? err.response.data.message
                    : axios.isAxiosError(err) && err.response?.data?.errors
                      ? Object.values(err.response.data.errors)
                            .flat()
                            .join('; ')
                      : 'Save failed.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open
            onOpenChange={(v) => {
                if (!v) onClose();
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {initial ? 'Edit Machine' : 'Add Machine'}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-1.5">
                        <Label htmlFor="md-number">Machine Number *</Label>
                        <Input
                            id="md-number"
                            value={form.machine_number}
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    machine_number: e.target.value,
                                }))
                            }
                            placeholder="e.g. 2401"
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="md-type">Machine Type *</Label>
                        <Select
                            value={form.machine_type_id}
                            onValueChange={(v) =>
                                setForm((p) => ({ ...p, machine_type_id: v }))
                            }
                        >
                            <SelectTrigger id="md-type">
                                <SelectValue placeholder="Select type…" />
                            </SelectTrigger>
                            <SelectContent>
                                {machineTypes.map((t) => (
                                    <SelectItem
                                        key={t.id}
                                        value={t.id.toString()}
                                    >
                                        {t.type_name} ({t.total_spindles}{' '}
                                        spindles)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedType && (
                            <p className="text-xs text-muted-foreground">
                                Total spindles: {selectedType.total_spindles}
                                {selectedType.rpm_min &&
                                    selectedType.rpm_max &&
                                    ` · RPM range: ${selectedType.rpm_min}–${selectedType.rpm_max}`}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="md-active"
                            checked={form.is_active}
                            onCheckedChange={(checked) =>
                                setForm((p) => ({
                                    ...p,
                                    is_active: checked === true,
                                }))
                            }
                        />
                        <Label htmlFor="md-active">Active</Label>
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="md-notes">Notes</Label>
                        <Input
                            id="md-notes"
                            value={form.notes}
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    notes: e.target.value,
                                }))
                            }
                            placeholder="optional"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {initial ? 'Save Changes' : 'Add Machine'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MachineMaintenance() {
    const { can } = usePermissions();
    const canManage = can('machine-maintenance.manage');

    const [types, setTypes] = useState<MachineType[]>([]);
    const [defs, setDefs] = useState<MachineDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    const [typeForm, setTypeForm] = useState<{
        open: boolean;
        initial?: MachineType;
    }>({ open: false });
    const [defForm, setDefForm] = useState<{
        open: boolean;
        initial?: MachineDefinition;
    }>({ open: false });
    const [deleteTarget, setDeleteTarget] = useState<{
        kind: 'type' | 'def';
        id: number;
        name: string;
    } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [t, d] = await Promise.all([
                axios.get<MachineType[]>('/machine-types'),
                axios.get<MachineDefinition[]>('/machine-definitions'),
            ]);
            setTypes(t.data);
            setDefs(d.data);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            const url =
                deleteTarget.kind === 'type'
                    ? `/machine-types/${deleteTarget.id}`
                    : `/machine-definitions/${deleteTarget.id}`;
            await axios.delete(url, { headers: { 'X-CSRF-TOKEN': csrf } });
            setDeleteTarget(null);
            load();
        } catch (err: unknown) {
            setDeleteError(
                axios.isAxiosError(err) && err.response?.data?.message
                    ? err.response.data.message
                    : 'Delete failed.',
            );
        } finally {
            setDeleting(false);
        }
    };

    const range = (lo: number | string | null, hi: number | string | null) =>
        lo == null && hi == null ? null : `${lo ?? '…'}–${hi ?? '…'}`;

    const query = search.trim().toLowerCase();
    const shownDefs = defs.filter(
        (d) =>
            (typeFilter === 'all' ||
                String(d.machine_type_id) === typeFilter) &&
            (!query ||
                d.machine_number.toLowerCase().includes(query) ||
                (d.notes ?? '').toLowerCase().includes(query)),
    );
    const activeCount = defs.filter((d) => d.is_active).length;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Machine Maintenance" />
            <div className="flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <PageHeader
                    title="Machine Maintenance"
                    meta={
                        loading
                            ? 'Machine types and machine numbers'
                            : `${types.length} ${types.length === 1 ? 'type' : 'types'} · ${defs.length} machines · ${activeCount} active`
                    }
                />

                <Panel
                    title="Machine types"
                    meta="Spindle counts and outlier thresholds"
                    action={
                        canManage && (
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={() => setTypeForm({ open: true })}
                            >
                                <Plus />
                                Add type
                            </Button>
                        )
                    }
                >
                    {loading ? (
                        <PanelSkeleton rows={3} />
                    ) : types.length === 0 ? (
                        <p className="p-3 text-xs text-muted-foreground">
                            No machine types yet. Add one before adding
                            machines.
                        </p>
                    ) : (
                        <Table size="dense" aria-label="Machine types">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">
                                        Spindles
                                    </TableHead>
                                    <TableHead className="text-right">
                                        RPM range
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Runtime (h/spindle)
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Machines
                                    </TableHead>
                                    <TableHead className="w-full">
                                        Description
                                    </TableHead>
                                    {canManage && (
                                        <TableHead className="w-16">
                                            <span className="sr-only">
                                                Actions
                                            </span>
                                        </TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {types.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="font-medium">
                                            {t.type_name}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {t.total_spindles}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {range(t.rpm_min, t.rpm_max) ?? (
                                                <Empty />
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {range(
                                                t.min_runtime_hours,
                                                t.max_runtime_hours,
                                            ) ?? <Empty />}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {t.machine_definitions_count}
                                        </TableCell>
                                        <TableCell
                                            className="max-w-0 truncate text-muted-foreground"
                                            title={t.description ?? undefined}
                                        >
                                            {t.description ?? <Empty />}
                                        </TableCell>
                                        {canManage && (
                                            <TableCell className="py-0 text-right whitespace-nowrap">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    aria-label={`Edit ${t.type_name}`}
                                                    onClick={() =>
                                                        setTypeForm({
                                                            open: true,
                                                            initial: t,
                                                        })
                                                    }
                                                >
                                                    <Pencil />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    aria-label={`Delete ${t.type_name}`}
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() =>
                                                        setDeleteTarget({
                                                            kind: 'type',
                                                            id: t.id,
                                                            name: t.type_name,
                                                        })
                                                    }
                                                >
                                                    <Trash2 />
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Panel>

                <Panel
                    title="Machines"
                    meta="Machine numbers and their type (L/R sides share the spindle count)"
                    action={
                        canManage && (
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={() => setDefForm({ open: true })}
                                disabled={types.length === 0}
                            >
                                <Plus />
                                Add machine
                            </Button>
                        )
                    }
                >
                    <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
                        <label className="flex h-(--density-control-h) w-56 items-center gap-1.5 rounded-md border bg-background px-2 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/50">
                            <Search
                                className="size-3.5 shrink-0"
                                aria-hidden="true"
                            />
                            <input
                                type="search"
                                aria-label="Find machine"
                                placeholder="Find machine or note"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none"
                            />
                        </label>
                        <Select
                            value={typeFilter}
                            onValueChange={setTypeFilter}
                        >
                            <SelectTrigger
                                aria-label="Machine type"
                                className="h-(--density-control-h)! w-auto gap-1.5 px-2 text-xs"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">
                                    All types
                                </SelectItem>
                                {types.map((t) => (
                                    <SelectItem
                                        key={t.id}
                                        value={String(t.id)}
                                        className="text-xs"
                                    >
                                        {t.type_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                            {shownDefs.length === defs.length
                                ? `${defs.length} machines`
                                : `${shownDefs.length} of ${defs.length}`}
                        </span>
                    </div>
                    {loading ? (
                        <PanelSkeleton rows={6} />
                    ) : defs.length === 0 ? (
                        <p className="p-3 text-xs text-muted-foreground">
                            No machines yet.
                        </p>
                    ) : shownDefs.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 p-6 text-sm">
                            <span>No machines match these filters.</span>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                    setSearch('');
                                    setTypeFilter('all');
                                }}
                            >
                                Clear filters
                            </Button>
                        </div>
                    ) : (
                        <Table size="dense" aria-label="Machines">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Machine</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">
                                        Spindles
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-full">
                                        Notes
                                    </TableHead>
                                    {canManage && (
                                        <TableHead className="w-16">
                                            <span className="sr-only">
                                                Actions
                                            </span>
                                        </TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {shownDefs.map((d) => (
                                    <TableRow key={d.id}>
                                        <TableCell className="font-mono text-xs font-medium">
                                            {d.machine_number}
                                        </TableCell>
                                        <TableCell>
                                            {d.machine_type?.type_name ?? (
                                                <Empty />
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {d.machine_type?.total_spindles ?? (
                                                <Empty />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center gap-1.5 text-xs">
                                                <span
                                                    aria-hidden="true"
                                                    className={cn(
                                                        'size-1.5 rounded-full',
                                                        d.is_active
                                                            ? 'bg-emerald-600'
                                                            : 'bg-muted-foreground/50',
                                                    )}
                                                />
                                                <span
                                                    className={cn(
                                                        !d.is_active &&
                                                            'text-muted-foreground',
                                                    )}
                                                >
                                                    {d.is_active
                                                        ? 'Active'
                                                        : 'Inactive'}
                                                </span>
                                            </span>
                                        </TableCell>
                                        <TableCell
                                            className="max-w-0 truncate text-muted-foreground"
                                            title={d.notes ?? undefined}
                                        >
                                            {d.notes ?? <Empty />}
                                        </TableCell>
                                        {canManage && (
                                            <TableCell className="py-0 text-right whitespace-nowrap">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    aria-label={`Edit machine ${d.machine_number}`}
                                                    onClick={() =>
                                                        setDefForm({
                                                            open: true,
                                                            initial: d,
                                                        })
                                                    }
                                                >
                                                    <Pencil />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    aria-label={`Delete machine ${d.machine_number}`}
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() =>
                                                        setDeleteTarget({
                                                            kind: 'def',
                                                            id: d.id,
                                                            name: d.machine_number,
                                                        })
                                                    }
                                                >
                                                    <Trash2 />
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Panel>
            </div>

            {/* ── Forms ───────────────────────────────────────────────────────── */}
            {typeForm.open && (
                <MachineTypeForm
                    initial={typeForm.initial}
                    onSave={() => {
                        setTypeForm({ open: false });
                        load();
                    }}
                    onClose={() => setTypeForm({ open: false })}
                />
            )}
            {defForm.open && (
                <MachineDefinitionForm
                    initial={defForm.initial}
                    machineTypes={types}
                    onSave={() => {
                        setDefForm({ open: false });
                        load();
                    }}
                    onClose={() => setDefForm({ open: false })}
                />
            )}

            {/* ── Delete confirm ───────────────────────────────────────────────── */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(v) => {
                    if (!v) {
                        setDeleteTarget(null);
                        setDeleteError(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete "{deleteTarget?.name}"?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget?.kind === 'type'
                                ? 'This will fail if any machines are assigned to this type.'
                                : 'This will remove the machine definition. Existing runtime records will retain a null reference.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deleteError && (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {deleteError}
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {deleting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
