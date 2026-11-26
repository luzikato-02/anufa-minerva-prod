import { PageHeader } from '@/components/page-header';
import { Field, NativeSelect } from '@/components/reeds/reed-status';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import {
    fmt,
    reedApi,
    type FabricStyle,
    type ReedLocation,
    type ReedSpec,
} from '@/lib/reeds';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useState,
    type FormEvent,
    type ReactNode,
} from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reed Inventory', href: '/reeds' },
    { title: 'Settings', href: '/reed-settings' },
];

type Kind = 'specs' | 'styles' | 'locations';
type Row = ReedSpec | FabricStyle | ReedLocation;

const NOUN: Record<Kind, string> = {
    specs: 'reed spec',
    styles: 'fabric style',
    locations: 'location',
};

/** Master data for reeds: the spec catalogue, which spec each fabric style runs with, and rack locations. */
export default function ReedSettings() {
    const { can } = usePermissions();
    const canManage = can('reeds.manage');
    const [tab, setTab] = useState<Kind>('specs');
    const [specs, setSpecs] = useState<ReedSpec[]>([]);
    const [styles, setStyles] = useState<FabricStyle[]>([]);
    const [locations, setLocations] = useState<ReedLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<{
        kind: Kind;
        row: Row | null;
    } | null>(null);
    const [deleting, setDeleting] = useState<{ kind: Kind; row: Row } | null>(
        null,
    );

    const reload = useCallback(() => {
        setLoading(true);
        Promise.all([reedApi.specs(), reedApi.styles(), reedApi.locations()])
            .then(([sp, st, lo]) => {
                setSpecs(sp);
                setStyles(st);
                setLocations(lo);
            })
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    }, []);
    useEffect(reload, [reload]);

    const remove = async () => {
        if (!deleting) return;
        try {
            await reedApi.remove(deleting.kind, deleting.row.id);
            reload();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setDeleting(null);
        }
    };

    const rowActions = (kind: Kind, row: Row) =>
        canManage && (
            <TableCell className="py-0 text-right whitespace-nowrap">
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Edit ${row.code}`}
                    onClick={() => setEditing({ kind, row })}
                >
                    <PencilIcon />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${row.code}`}
                    onClick={() => setDeleting({ kind, row })}
                >
                    <Trash2Icon />
                </Button>
            </TableCell>
        );

    const empty = (cols: number, text: string) => (
        <TableRow className="hover:bg-transparent">
            <TableCell
                colSpan={cols + (canManage ? 1 : 0)}
                className="h-24 text-center text-muted-foreground"
            >
                {loading ? 'Loading…' : text}
            </TableCell>
        </TableRow>
    );

    const actionHead = canManage && (
        <TableHead className="w-16">
            <span className="sr-only">Actions</span>
        </TableHead>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Reed Settings" />
            <div className="flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <Tabs
                    value={tab}
                    onValueChange={(v) => setTab(v as Kind)}
                    className="gap-(--density-gutter)"
                >
                    <PageHeader
                        title="Reed Settings"
                        meta="Specs, fabric styles and storage locations"
                        tabs={
                            <TabsList>
                                <TabsTrigger value="specs">
                                    Specs ({specs.length})
                                </TabsTrigger>
                                <TabsTrigger value="styles">
                                    Fabric styles ({styles.length})
                                </TabsTrigger>
                                <TabsTrigger value="locations">
                                    Locations ({locations.length})
                                </TabsTrigger>
                            </TabsList>
                        }
                        actions={
                            canManage && (
                                <Button
                                    size="xs"
                                    onClick={() =>
                                        setEditing({ kind: tab, row: null })
                                    }
                                >
                                    <PlusIcon />
                                    {NOUN[tab][0].toUpperCase() +
                                        NOUN[tab].slice(1)}
                                </Button>
                            )
                        }
                    />
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <TabsContent
                        value="specs"
                        className="overflow-x-auto rounded-lg border"
                    >
                        <Table size="dense" aria-label="Reed specs">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Code</TableHead>
                                    <TableHead className="text-right">
                                        Dents / 10 cm
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Width mm
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Height mm
                                    </TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Wire</TableHead>
                                    <TableHead className="text-right">
                                        Min stock
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Reeds
                                    </TableHead>
                                    {actionHead}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {specs.length === 0
                                    ? empty(
                                          8,
                                          'No reed specs yet. Add one for each dent density and width you stock.',
                                      )
                                    : specs.map((s) => (
                                          <TableRow key={s.id}>
                                              <TableCell className="font-medium">
                                                  {s.code}
                                              </TableCell>
                                              <TableCell className="text-right tabular-nums">
                                                  {fmt(s.dents_per_10cm, 2)}
                                              </TableCell>
                                              <TableCell className="text-right tabular-nums">
                                                  {fmt(s.width_mm)}
                                                  {s.working_width_mm && (
                                                      <span className="text-muted-foreground">
                                                          {' '}
                                                          (
                                                          {fmt(
                                                              s.working_width_mm,
                                                          )}
                                                          )
                                                      </span>
                                                  )}
                                              </TableCell>
                                              <TableCell className="text-right tabular-nums">
                                                  {fmt(s.height_mm)}
                                              </TableCell>
                                              <TableCell className="capitalize">
                                                  {s.reed_type}
                                              </TableCell>
                                              <TableCell className="text-muted-foreground">
                                                  {[
                                                      s.wire_profile,
                                                      s.wire_thickness_mm &&
                                                          `${s.wire_thickness_mm} mm`,
                                                      s.wire_material,
                                                  ]
                                                      .filter(Boolean)
                                                      .join(' · ') || '—'}
                                              </TableCell>
                                              <TableCell className="text-right tabular-nums">
                                                  {fmt(s.min_stock)}
                                              </TableCell>
                                              <TableCell className="text-right tabular-nums">
                                                  {fmt(s.active_reeds_count)}
                                              </TableCell>
                                              {rowActions('specs', s)}
                                          </TableRow>
                                      ))}
                            </TableBody>
                        </Table>
                    </TabsContent>

                    <TabsContent
                        value="styles"
                        className="overflow-x-auto rounded-lg border"
                    >
                        <Table size="dense" aria-label="Fabric styles">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Code</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Reed spec</TableHead>
                                    <TableHead className="text-right">
                                        Ends / 10 cm
                                    </TableHead>
                                    <TableHead>Active</TableHead>
                                    {actionHead}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {styles.length === 0
                                    ? empty(
                                          5,
                                          'No fabric styles yet. Add the styles you weave and the reed spec each one needs.',
                                      )
                                    : styles.map((s) => (
                                          <TableRow key={s.id}>
                                              <TableCell className="font-medium">
                                                  {s.code}
                                              </TableCell>
                                              <TableCell>
                                                  {s.description ?? '—'}
                                              </TableCell>
                                              <TableCell>
                                                  {s.reed_spec?.code ?? (
                                                      <span className="text-orange-700 dark:text-orange-400">
                                                          Not set
                                                      </span>
                                                  )}
                                              </TableCell>
                                              <TableCell className="text-right tabular-nums">
                                                  {fmt(s.ends_per_10cm, 2)}
                                              </TableCell>
                                              <TableCell>
                                                  {s.is_active ? 'Yes' : 'No'}
                                              </TableCell>
                                              {rowActions('styles', s)}
                                          </TableRow>
                                      ))}
                            </TableBody>
                        </Table>
                    </TabsContent>

                    <TabsContent
                        value="locations"
                        className="overflow-x-auto rounded-lg border"
                    >
                        <Table size="dense" aria-label="Locations">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Code</TableHead>
                                    <TableHead>Zone</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead className="text-right">
                                        Reeds stored
                                    </TableHead>
                                    {actionHead}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {locations.length === 0
                                    ? empty(
                                          4,
                                          'No locations yet. Add each rack slot, e.g. R01-S01.',
                                      )
                                    : locations.map((l) => (
                                          <TableRow key={l.id}>
                                              <TableCell className="font-medium">
                                                  {l.code}
                                              </TableCell>
                                              <TableCell>
                                                  {l.zone ?? '—'}
                                              </TableCell>
                                              <TableCell className="text-muted-foreground">
                                                  {l.notes ?? '—'}
                                              </TableCell>
                                              <TableCell className="text-right tabular-nums">
                                                  {fmt(l.reeds_count)}
                                              </TableCell>
                                              {rowActions('locations', l)}
                                          </TableRow>
                                      ))}
                            </TableBody>
                        </Table>
                    </TabsContent>
                </Tabs>
            </div>

            {editing && (
                <EditDialog
                    kind={editing.kind}
                    row={editing.row}
                    specs={specs}
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
                            Delete {deleting && NOUN[deleting.kind]}{' '}
                            {deleting?.row.code}?
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

type Values = Record<string, string | boolean>;

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function initialValues(kind: Kind, row: Row | null): Values {
    const r = (row ?? {}) as Record<string, unknown>;
    if (kind === 'specs')
        return {
            code: str(r.code),
            dents_per_10cm: str(r.dents_per_10cm),
            width_mm: str(r.width_mm),
            working_width_mm: str(r.working_width_mm),
            height_mm: str(r.height_mm),
            reed_type: str(r.reed_type) || 'flat',
            wire_profile: str(r.wire_profile),
            wire_thickness_mm: str(r.wire_thickness_mm),
            wire_material: str(r.wire_material),
            min_stock: str(r.min_stock ?? 0),
            notes: str(r.notes),
        };
    if (kind === 'styles')
        return {
            code: str(r.code),
            description: str(r.description),
            reed_spec_id: str(r.reed_spec_id),
            ends_per_10cm: str(r.ends_per_10cm),
            is_active: row ? Boolean(r.is_active) : true,
        };
    return { code: str(r.code), zone: str(r.zone), notes: str(r.notes) };
}

const NUMERIC = [
    'dents_per_10cm',
    'width_mm',
    'working_width_mm',
    'height_mm',
    'wire_thickness_mm',
    'min_stock',
    'reed_spec_id',
    'ends_per_10cm',
];

function EditDialog({
    kind,
    row,
    specs,
    onClose,
    onSaved,
}: {
    kind: Kind;
    row: Row | null;
    specs: ReedSpec[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [values, setValues] = useState<Values>(() =>
        initialValues(kind, row),
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const set = (k: string) => (v: string | boolean) =>
        setValues((prev) => ({ ...prev, [k]: v }));

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!String(values.code).trim()) return setError('Enter a code.');
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(values)) {
            if (typeof v === 'boolean') body[k] = v;
            else if (NUMERIC.includes(k))
                body[k] = v.trim() === '' ? null : Number(v);
            else body[k] = v.trim() === '' ? null : v.trim();
        }
        setBusy(true);
        setError(null);
        try {
            await reedApi.save(kind, row?.id ?? null, body);
            onSaved();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const input = (
        k: string,
        label: string,
        opts: {
            numeric?: boolean;
            placeholder?: string;
            hint?: ReactNode;
        } = {},
    ) => (
        <Field label={label} htmlFor={`rs-${k}`} hint={opts.hint}>
            <Input
                id={`rs-${k}`}
                inputMode={opts.numeric ? 'decimal' : undefined}
                placeholder={opts.placeholder}
                value={String(values[k])}
                onChange={(e) => set(k)(e.target.value)}
            />
        </Field>
    );

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={save} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>
                            {row ? 'Edit' : 'New'} {NOUN[kind]}
                        </DialogTitle>
                    </DialogHeader>
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {kind === 'specs' && (
                        <div className="grid grid-cols-2 gap-3">
                            {input('code', 'Code', {
                                placeholder: 'e.g. RD-90-1600',
                            })}
                            {input('dents_per_10cm', 'Dents per 10 cm', {
                                numeric: true,
                            })}
                            {input('width_mm', 'Overall width (mm)', {
                                numeric: true,
                            })}
                            {input('working_width_mm', 'Working width (mm)', {
                                numeric: true,
                            })}
                            {input('height_mm', 'Height (mm)', {
                                numeric: true,
                            })}
                            <Field label="Type" htmlFor="rs-type">
                                <NativeSelect
                                    id="rs-type"
                                    value={String(values.reed_type)}
                                    onChange={set('reed_type')}
                                >
                                    <option value="flat">Flat</option>
                                    <option value="profile">
                                        Profile (air-jet)
                                    </option>
                                </NativeSelect>
                            </Field>
                            {input('wire_profile', 'Wire profile')}
                            {input('wire_thickness_mm', 'Wire thickness (mm)', {
                                numeric: true,
                            })}
                            {input('wire_material', 'Wire material', {
                                placeholder: 'e.g. stainless',
                            })}
                            {input('min_stock', 'Min spare stock', {
                                numeric: true,
                                hint: 'Grade A/B reeds to keep in stock.',
                            })}
                            <div className="col-span-2">
                                {input('notes', 'Notes')}
                            </div>
                        </div>
                    )}

                    {kind === 'styles' && (
                        <div className="grid grid-cols-2 gap-3">
                            {input('code', 'Style code')}
                            {input('ends_per_10cm', 'Ends per 10 cm', {
                                numeric: true,
                            })}
                            <div className="col-span-2">
                                {input('description', 'Description', {
                                    placeholder: 'e.g. Nylon 1400 dtex/2',
                                })}
                            </div>
                            <Field
                                label="Reed spec"
                                htmlFor="rs-spec"
                                className="col-span-2"
                            >
                                <NativeSelect
                                    id="rs-spec"
                                    value={String(values.reed_spec_id)}
                                    onChange={set('reed_spec_id')}
                                >
                                    <option value="">— not set —</option>
                                    {specs.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.code} ·{' '}
                                            {fmt(s.dents_per_10cm, 2)} dents/10
                                            cm · {fmt(s.width_mm)} mm
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                            <label className="col-span-2 flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={Boolean(values.is_active)}
                                    onCheckedChange={(v) =>
                                        set('is_active')(v === true)
                                    }
                                />
                                Active (shown in pickers)
                            </label>
                        </div>
                    )}

                    {kind === 'locations' && (
                        <div className="grid grid-cols-2 gap-3">
                            {input('code', 'Code', {
                                placeholder: 'e.g. R01-S01',
                            })}
                            {input('zone', 'Zone', {
                                placeholder: 'e.g. Reed room, rack 1',
                            })}
                            <div className="col-span-2">
                                {input('notes', 'Notes')}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={busy}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={busy}>
                            {busy ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
