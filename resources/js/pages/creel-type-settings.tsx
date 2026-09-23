import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { usePermissions } from '@/lib/permissions';
import { type CreelType, creelTypeApi } from '@/lib/creel-types';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Process Parameters', href: '#' },
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Creel Type Settings" />
            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">Creel Type Settings</h1>
                        <p className="text-sm text-muted-foreground">The acceptable torque range for each creel type, used by Torque Check.</p>
                    </div>
                    {canManage && (
                        <Button onClick={() => setEditing('new')}>
                            <PlusIcon /> Creel type
                        </Button>
                    )}
                </div>
                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="text-right">Torque min</TableHead>
                                <TableHead className="text-right">Torque max</TableHead>
                                <TableHead className="text-right">Sheets recorded</TableHead>
                                {canManage && <TableHead className="w-24" />}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {types.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={canManage ? 5 : 4} className="h-24 text-center text-muted-foreground">
                                        {loading ? 'Loading…' : 'No creel types yet.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                types.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="font-medium">{t.name}</TableCell>
                                        <TableCell className="text-right">{t.torque_min}</TableCell>
                                        <TableCell className="text-right">{t.torque_max}</TableCell>
                                        <TableCell className="text-right">{t.torque_check_sheets_count ?? 0}</TableCell>
                                        {canManage && (
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}>
                                                    <PencilIcon />
                                                </Button>
                                                <Button variant="ghost" size="icon" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}>
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

            {editing && <EditDialog existing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}

            <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}

function EditDialog({ existing, onClose, onSaved }: { existing: CreelType | null; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(existing?.name ?? '');
    const [min, setMin] = useState(existing ? String(existing.torque_min) : '');
    const [max, setMax] = useState(existing ? String(existing.torque_max) : '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        const torqueMin = Number(min);
        const torqueMax = Number(max);
        if (!name.trim()) return setError('Enter a name.');
        if (!Number.isFinite(torqueMin) || !Number.isFinite(torqueMax)) return setError('Enter numbers for the torque range.');
        if (torqueMax < torqueMin) return setError('Torque max must not be below torque min.');
        setBusy(true);
        setError(null);
        try {
            const fields = { name: name.trim(), torque_min: torqueMin, torque_max: torqueMax };
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
                    <DialogTitle>{existing ? 'Edit creel type' : 'New creel type'}</DialogTitle>
                </DialogHeader>
                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="ct-name">Name</Label>
                        <Input id="ct-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="ct-min">Torque min</Label>
                            <Input id="ct-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ct-max">Torque max</Label>
                            <Input id="ct-max" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
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
