import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type CreelType, creelTypeApi } from '@/lib/creel-types';
import { usePermissions } from '@/lib/permissions';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Creel Type Settings', href: '/creel-type-settings' },
];

/** The torque standard (min/max) for each creel type, used by Torque Check. */
export default function CreelTypeSettings() {
    const { can } = usePermissions();
    const canManage = can('creel-types.manage');
    const [types, setTypes] = useState<CreelType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<CreelType | 'new' | null>(null);
    const [deleting, setDeleting] = useState<CreelType | null>(null);

    const reload = useCallback(() => {
        setLoading(true);
        creelTypeApi
            .list()
            .then(setTypes)
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(reload, [reload]);

    const remove = async () => {
        if (!deleting) return;
        try {
            await creelTypeApi.remove(deleting.id);
            setDeleting(null);
            reload();
        } catch (e) {
            setError((e as Error).message);
            setDeleting(null);
        }
    };

    // One shared scale so the ranges can be compared at a glance.
    const scaleMin = types.length
        ? Math.floor(Math.min(...types.map((t) => t.torque_min)) - 1)
        : 0;
    const scaleMax = types.length
        ? Math.ceil(Math.max(...types.map((t) => t.torque_max)) + 1)
        : 1;
    const at = (v: number) =>
        ((v - scaleMin) / (scaleMax - scaleMin || 1)) * 100;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Creel Type Settings" />
            <div className="flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <PageHeader
                    title="Creel Type Settings"
                    meta="Acceptable torque range per creel type, used by Torque Check"
                    actions={
                        canManage && (
                            <Button size="xs" onClick={() => setEditing('new')}>
                                <PlusIcon />
                                Creel type
                            </Button>
                        )
                    }
                />
                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div className="overflow-hidden rounded-lg border">
                    <Table size="dense" aria-label="Creel types">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Name</TableHead>
                                <TableHead className="text-right">
                                    Torque min
                                </TableHead>
                                <TableHead className="text-right">
                                    Torque max
                                </TableHead>
                                <TableHead className="w-full">
                                    Range{' '}
                                    {types.length > 0 && (
                                        <span className="font-normal">
                                            (scale {scaleMin}–{scaleMax})
                                        </span>
                                    )}
                                </TableHead>
                                <TableHead className="text-right">
                                    Sheets recorded
                                </TableHead>
                                {canManage && (
                                    <TableHead className="w-16">
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {types.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell
                                        colSpan={canManage ? 6 : 5}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        {loading
                                            ? 'Loading creel types…'
                                            : 'No creel types yet. Add one to start recording torque checks.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                types.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="font-medium">
                                            {t.name}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {t.torque_min}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {t.torque_max}
                                        </TableCell>
                                        <TableCell>
                                            <div
                                                role="img"
                                                aria-label={`${t.torque_min} to ${t.torque_max} on a scale of ${scaleMin} to ${scaleMax}`}
                                                className="relative h-1.5 min-w-32 rounded-full bg-muted"
                                            >
                                                <span
                                                    className="absolute inset-y-0 rounded-full bg-foreground/70"
                                                    style={{
                                                        left: `${at(t.torque_min)}%`,
                                                        width: `${Math.max(1, at(t.torque_max) - at(t.torque_min))}%`,
                                                    }}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {t.torque_check_sheets_count ?? 0}
                                        </TableCell>
                                        {canManage && (
                                            <TableCell className="py-0 text-right whitespace-nowrap">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    aria-label={`Edit ${t.name}`}
                                                    onClick={() =>
                                                        setEditing(t)
                                                    }
                                                >
                                                    <PencilIcon />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    aria-label={`Delete ${t.name}`}
                                                    onClick={() =>
                                                        setDeleting(t)
                                                    }
                                                >
                                                    <Trash2Icon />
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {editing && (
                <EditDialog
                    existing={editing === 'new' ? null : editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        reload();
                    }}
                />
            )}

            <AlertDialog
                open={deleting !== null}
                onOpenChange={(o) => !o && setDeleting(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {deleting?.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void remove()}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}

function EditDialog({
    existing,
    onClose,
    onSaved,
}: {
    existing: CreelType | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState(existing?.name ?? '');
    const [min, setMin] = useState(existing ? String(existing.torque_min) : '');
    const [max, setMax] = useState(existing ? String(existing.torque_max) : '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        const torqueMin = Number(min);
        const torqueMax = Number(max);
        if (!name.trim()) return setError('Enter a name.');
        if (!Number.isFinite(torqueMin) || !Number.isFinite(torqueMax))
            return setError('Enter numbers for the torque range.');
        if (torqueMax < torqueMin)
            return setError('Torque max must not be below torque min.');
        setBusy(true);
        setError(null);
        try {
            const fields = {
                name: name.trim(),
                torque_min: torqueMin,
                torque_max: torqueMax,
            };
            if (existing) {
                await creelTypeApi.update(existing.id, fields);
            } else {
                await creelTypeApi.create(fields);
            }
            onSaved();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {existing ? 'Edit creel type' : 'New creel type'}
                    </DialogTitle>
                </DialogHeader>
                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="ct-name">Name</Label>
                        <Input
                            id="ct-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="ct-min">Torque min</Label>
                            <Input
                                id="ct-min"
                                inputMode="decimal"
                                value={min}
                                onChange={(e) => setMin(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ct-max">Torque max</Label>
                            <Input
                                id="ct-max"
                                inputMode="decimal"
                                value={max}
                                onChange={(e) => setMax(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button onClick={() => void save()} disabled={busy}>
                        {busy ? 'Saving…' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
