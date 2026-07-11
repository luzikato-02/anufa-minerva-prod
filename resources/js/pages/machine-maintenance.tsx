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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { usePermissions } from '@/lib/permissions';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { AlertCircle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Process Parameters', href: '#' },
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
        type_name:          initial?.type_name ?? '',
        total_spindles:     initial?.total_spindles?.toString() ?? '',
        rpm_min:            initial?.rpm_min?.toString() ?? '',
        rpm_max:            initial?.rpm_max?.toString() ?? '',
        min_runtime_hours:  initial?.min_runtime_hours ?? '',
        max_runtime_hours:  initial?.max_runtime_hours ?? '',
        description:        initial?.description ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState<string | null>(null);

    const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

    const handleSubmit = async () => {
        setSaving(true);
        setError(null);
        try {
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            const payload = {
                type_name:         form.type_name,
                total_spindles:    parseInt(form.total_spindles) || 0,
                rpm_min:           form.rpm_min !== '' ? parseInt(form.rpm_min) : null,
                rpm_max:           form.rpm_max !== '' ? parseInt(form.rpm_max) : null,
                min_runtime_hours: form.min_runtime_hours !== '' ? parseFloat(form.min_runtime_hours) : null,
                max_runtime_hours: form.max_runtime_hours !== '' ? parseFloat(form.max_runtime_hours) : null,
                description:       form.description || null,
            };
            const headers = { 'X-CSRF-TOKEN': csrf };
            if (initial) {
                await axios.patch(`/machine-types/${initial.id}`, payload, { headers });
            } else {
                await axios.post('/machine-types', payload, { headers });
            }
            onSave();
        } catch (err: unknown) {
            setError(
                axios.isAxiosError(err) && err.response?.data?.message
                    ? err.response.data.message
                    : (axios.isAxiosError(err) && err.response?.data?.errors
                        ? Object.values(err.response.data.errors).flat().join('; ')
                        : 'Save failed.'),
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{initial ? 'Edit Machine Type' : 'Add Machine Type'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-1.5">
                        <Label>Type Name *</Label>
                        <Input value={form.type_name} onChange={(e) => set('type_name', e.target.value)} placeholder="e.g. Standard" />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Total Spindles (per machine) *</Label>
                        <Input type="number" min="1" value={form.total_spindles} onChange={(e) => set('total_spindles', e.target.value)} placeholder="e.g. 200" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label>RPM Min</Label>
                            <Input type="number" min="0" value={form.rpm_min} onChange={(e) => set('rpm_min', e.target.value)} placeholder="optional" />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>RPM Max</Label>
                            <Input type="number" min="0" value={form.rpm_max} onChange={(e) => set('rpm_max', e.target.value)} placeholder="optional" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label>Min Runtime (h/spindle)</Label>
                            <Input type="number" step="0.001" min="0" value={form.min_runtime_hours} onChange={(e) => set('min_runtime_hours', e.target.value)} placeholder="optional" />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Max Runtime (h/spindle)</Label>
                            <Input type="number" step="0.001" min="0" value={form.max_runtime_hours} onChange={(e) => set('max_runtime_hours', e.target.value)} placeholder="optional" />
                        </div>
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Description</Label>
                        <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="optional" />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        machine_number:  initial?.machine_number ?? '',
        machine_type_id: initial?.machine_type_id?.toString() ?? '',
        is_active:       initial?.is_active ?? true,
        notes:           initial?.notes ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState<string | null>(null);

    const selectedType = machineTypes.find((t) => t.id.toString() === form.machine_type_id);

    const handleSubmit = async () => {
        setSaving(true);
        setError(null);
        try {
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            const payload = {
                machine_number:  form.machine_number,
                machine_type_id: parseInt(form.machine_type_id),
                is_active:       form.is_active,
                notes:           form.notes || null,
            };
            const headers = { 'X-CSRF-TOKEN': csrf };
            if (initial) {
                await axios.patch(`/machine-definitions/${initial.id}`, payload, { headers });
            } else {
                await axios.post('/machine-definitions', payload, { headers });
            }
            onSave();
        } catch (err: unknown) {
            setError(
                axios.isAxiosError(err) && err.response?.data?.message
                    ? err.response.data.message
                    : (axios.isAxiosError(err) && err.response?.data?.errors
                        ? Object.values(err.response.data.errors).flat().join('; ')
                        : 'Save failed.'),
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{initial ? 'Edit Machine' : 'Add Machine'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-1.5">
                        <Label>Machine Number *</Label>
                        <Input value={form.machine_number} onChange={(e) => setForm((p) => ({ ...p, machine_number: e.target.value }))} placeholder="e.g. 2401" />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Machine Type *</Label>
                        <Select value={form.machine_type_id} onValueChange={(v) => setForm((p) => ({ ...p, machine_type_id: v }))}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type…" />
                            </SelectTrigger>
                            <SelectContent>
                                {machineTypes.map((t) => (
                                    <SelectItem key={t.id} value={t.id.toString()}>
                                        {t.type_name} ({t.total_spindles} spindles)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedType && (
                            <p className="text-xs text-muted-foreground">
                                Total spindles: {selectedType.total_spindles}
                                {selectedType.rpm_min && selectedType.rpm_max && ` · RPM range: ${selectedType.rpm_min}–${selectedType.rpm_max}`}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <Checkbox
                            checked={form.is_active}
                            onCheckedChange={(checked) => setForm((p) => ({ ...p, is_active: checked === true }))}
                        />
                        <Label>Active</Label>
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Notes</Label>
                        <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="optional" />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

    const [types, setTypes]   = useState<MachineType[]>([]);
    const [defs, setDefs]     = useState<MachineDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    const [typeForm, setTypeForm]   = useState<{ open: boolean; initial?: MachineType }>({ open: false });
    const [defForm, setDefForm]     = useState<{ open: boolean; initial?: MachineDefinition }>({ open: false });
    const [deleteTarget, setDeleteTarget] = useState<{ kind: 'type' | 'def'; id: number; name: string } | null>(null);
    const [deleting, setDeleting]   = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

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

    useEffect(() => { load(); }, [load]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            const url  = deleteTarget.kind === 'type'
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Machine Maintenance" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">

                {/* ── Machine Types ─────────────────────────────────────────── */}
                <div className="rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <div>
                            <h2 className="font-semibold">Machine Types</h2>
                            <p className="text-xs text-muted-foreground">Define type names, spindle counts, and outlier thresholds</p>
                        </div>
                        {canManage && (
                            <Button size="sm" onClick={() => setTypeForm({ open: true })}>
                                <Plus className="mr-1 h-4 w-4" />
                                Add Type
                            </Button>
                        )}
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : types.length === 0 ? (
                        <p className="p-6 text-center text-sm text-muted-foreground">No machine types defined yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type Name</TableHead>
                                        <TableHead className="text-right">Spindles</TableHead>
                                        <TableHead className="text-right">RPM Min</TableHead>
                                        <TableHead className="text-right">RPM Max</TableHead>
                                        <TableHead className="text-right">Min Runtime (h)</TableHead>
                                        <TableHead className="text-right">Max Runtime (h)</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Machines</TableHead>
                                        {canManage && <TableHead className="w-20" />}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {types.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell className="font-medium">{t.type_name}</TableCell>
                                            <TableCell className="text-right font-mono">{t.total_spindles}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">{t.rpm_min ?? '—'}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">{t.rpm_max ?? '—'}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">{t.min_runtime_hours ?? '—'}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">{t.max_runtime_hours ?? '—'}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{t.description ?? '—'}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="secondary">{t.machine_definitions_count}</Badge>
                                            </TableCell>
                                            {canManage && (
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTypeForm({ open: true, initial: t })}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ kind: 'type', id: t.id, name: t.type_name })}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                {/* ── Machine Definitions ───────────────────────────────────── */}
                <div className="rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <div>
                            <h2 className="font-semibold">Machine Definitions</h2>
                            <p className="text-xs text-muted-foreground">Assign machine numbers to types (L/R sides share the same spindle count)</p>
                        </div>
                        {canManage && (
                            <Button size="sm" onClick={() => setDefForm({ open: true })} disabled={types.length === 0}>
                                <Plus className="mr-1 h-4 w-4" />
                                Add Machine
                            </Button>
                        )}
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : defs.length === 0 ? (
                        <p className="p-6 text-center text-sm text-muted-foreground">No machines defined yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Machine Number</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Spindles</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Notes</TableHead>
                                        {canManage && <TableHead className="w-20" />}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {defs.map((d) => (
                                        <TableRow key={d.id}>
                                            <TableCell className="font-mono font-medium">{d.machine_number}</TableCell>
                                            <TableCell>{d.machine_type?.type_name ?? '—'}</TableCell>
                                            <TableCell className="text-right font-mono">{d.machine_type?.total_spindles ?? '—'}</TableCell>
                                            <TableCell>
                                                <Badge variant={d.is_active ? 'default' : 'secondary'}>
                                                    {d.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{d.notes ?? '—'}</TableCell>
                                            {canManage && (
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDefForm({ open: true, initial: d })}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ kind: 'def', id: d.id, name: d.machine_number })}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Forms ───────────────────────────────────────────────────────── */}
            {typeForm.open && (
                <MachineTypeForm
                    initial={typeForm.initial}
                    onSave={() => { setTypeForm({ open: false }); load(); }}
                    onClose={() => setTypeForm({ open: false })}
                />
            )}
            {defForm.open && (
                <MachineDefinitionForm
                    initial={defForm.initial}
                    machineTypes={types}
                    onSave={() => { setDefForm({ open: false }); load(); }}
                    onClose={() => setDefForm({ open: false })}
                />
            )}

            {/* ── Delete confirm ───────────────────────────────────────────────── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) { setDeleteTarget(null); setDeleteError(null); } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
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
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
                            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
