import {
    Field,
    NativeSelect,
    ReedGradeBadge,
} from '@/components/reeds/reed-status';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { usePermissions } from '@/lib/permissions';
import {
    fmt,
    fmtDate,
    reedApi,
    specLabel,
    type MatchResult,
    type ReedOptions,
} from '@/lib/reeds';
import { useState, type FormEvent } from 'react';

/** "Which reed do I take for this style change?" — ranked reeds of the style's spec, with where they are. */
export function ReedMatchDialog({
    options,
    onClose,
    onOpenReed,
    onReserved,
}: {
    options: ReedOptions | null;
    onClose: () => void;
    onOpenReed: (id: number) => void;
    onReserved: () => void;
}) {
    const { can } = usePermissions();
    const [styleId, setStyleId] = useState('');
    const [loom, setLoom] = useState('');
    const [result, setResult] = useState<MatchResult | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const find = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!styleId) return setError('Pick the fabric style.');
        setBusy(true);
        setError(null);
        try {
            setResult(
                await reedApi.match(Number(styleId), loom.trim() || undefined),
            );
        } catch (err) {
            setResult(null);
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const reserve = async (id: number, serial: string) => {
        setError(null);
        try {
            await reedApi.act(id, 'reserve', {
                fabric_style_id: Number(styleId),
                loom_number: loom.trim() || null,
            });
            setNotice(
                `Reed ${serial} is reserved${loom.trim() ? ` for loom ${loom.trim()}` : ''}.`,
            );
            onReserved();
            void find();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Find a reed for a style</DialogTitle>
                    <DialogDescription>
                        In-stock reeds of the right spec, grade A first, then
                        the least worn.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={find}
                    className="grid grid-cols-[1fr_8rem_auto] items-end gap-2"
                >
                    <Field label="Fabric style" htmlFor="rm-style">
                        <NativeSelect
                            id="rm-style"
                            value={styleId}
                            onChange={setStyleId}
                        >
                            <option value="">Pick a style</option>
                            {(options?.styles ?? []).map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.code}
                                    {s.description ? ` · ${s.description}` : ''}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                    <Field label="Loom" htmlFor="rm-loom">
                        <Input
                            id="rm-loom"
                            value={loom}
                            placeholder="optional"
                            onChange={(e) => setLoom(e.target.value)}
                        />
                    </Field>
                    <Button type="submit" disabled={busy}>
                        {busy ? 'Finding…' : 'Find'}
                    </Button>
                </form>

                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {notice && (
                    <p
                        role="status"
                        className="text-sm text-emerald-700 dark:text-emerald-400"
                    >
                        {notice}
                    </p>
                )}

                {result && (
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                            Style {result.style.code} needs{' '}
                            <b className="text-foreground">
                                {specLabel(result.spec)}
                            </b>
                            .{' '}
                            {result.mounted_on_loom && (
                                <>
                                    Loom {loom} still has reed{' '}
                                    {result.mounted_on_loom.serial_no} mounted.
                                    Return it first.{' '}
                                </>
                            )}
                            {result.reserved.length > 0 && (
                                <>
                                    Already reserved:{' '}
                                    {result.reserved
                                        .map(
                                            (r) =>
                                                `${r.serial_no}${r.loom_number ? ` (${r.loom_number})` : ''}`,
                                        )
                                        .join(', ')}
                                    .
                                </>
                            )}
                        </p>
                        <div className="max-h-80 overflow-auto rounded-lg border">
                            <Table size="dense" aria-label="Matching reeds">
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Reed</TableHead>
                                        <TableHead>Grade</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead className="text-right">
                                            Meters woven
                                        </TableHead>
                                        <TableHead>Last inspected</TableHead>
                                        <TableHead>
                                            <span className="sr-only">
                                                Actions
                                            </span>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {result.candidates.length === 0 ? (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell
                                                colSpan={6}
                                                className="h-20 text-center text-muted-foreground"
                                            >
                                                No grade A or B reed of this
                                                spec is in stock.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        result.candidates.map((r, i) => (
                                            <TableRow key={r.id}>
                                                <TableCell>
                                                    <button
                                                        type="button"
                                                        className="font-mono underline-offset-2 hover:underline"
                                                        onClick={() =>
                                                            onOpenReed(r.id)
                                                        }
                                                    >
                                                        {r.serial_no}
                                                    </button>
                                                    {i === 0 && (
                                                        <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">
                                                            best
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <ReedGradeBadge
                                                        grade={r.grade}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {r.location?.code ?? '—'}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {fmt(r.meters_woven)}
                                                </TableCell>
                                                <TableCell className="tabular-nums">
                                                    {fmtDate(
                                                        r.last_inspected_at,
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-0 text-right">
                                                    {can('reeds.operate') && (
                                                        <Button
                                                            size="xs"
                                                            variant="outline"
                                                            onClick={() =>
                                                                void reserve(
                                                                    r.id,
                                                                    r.serial_no,
                                                                )
                                                            }
                                                        >
                                                            Reserve
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
