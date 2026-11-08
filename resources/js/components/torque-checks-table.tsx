import { DataGrid } from '@/components/data-grid';
import {
    CodeCell,
    Empty,
    ProgressCell,
    TextCell,
} from '@/components/data-grid-cells';
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
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useServerTable } from '@/hooks/use-server-table';
import { usePermissions } from '@/lib/permissions';
import {
    TORQUE_COLUMNS,
    TORQUE_MAX_ROW,
    TORQUE_SIDES,
    type TorqueCheckDetail,
    type TorqueCheckSummary,
    type TorqueSide,
    torqueCheckApi,
} from '@/lib/torque-checks';
import {
    type ColumnDef,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { DownloadIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const TOTAL_CELLS =
    TORQUE_SIDES.length * TORQUE_MAX_ROW * TORQUE_COLUMNS.length;
const day = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
const shortDay = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
    });

function saveCsv(filename: string, csv: string) {
    const url = URL.createObjectURL(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const csvCell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const columns: ColumnDef<TorqueCheckSummary>[] = [
    {
        id: 'check_date',
        accessorKey: 'check_date',
        header: 'Date',
        meta: { label: 'Date', className: 'whitespace-nowrap' },
        cell: ({ row }) => (
            <time
                dateTime={row.original.check_date.slice(0, 10)}
                title={day(row.original.check_date)}
                className="tabular-nums"
            >
                {shortDay(row.original.check_date)}
            </time>
        ),
    },
    {
        id: 'machine',
        accessorKey: 'machine_number',
        header: 'Machine',
        meta: { label: 'Machine' },
        cell: ({ getValue }) => <CodeCell value={getValue()} strong />,
    },
    {
        id: 'operator',
        accessorKey: 'operator_name',
        header: 'Operator',
        meta: { label: 'Operator' },
        cell: ({ getValue }) => <TextCell value={getValue()} />,
    },
    {
        id: 'session',
        accessorKey: 'session_id',
        header: 'Session',
        meta: { label: 'Session' },
        cell: ({ getValue }) => <CodeCell value={getValue()} muted />,
    },
    {
        id: 'sides',
        header: 'Sides',
        enableSorting: false,
        meta: { label: 'Sides' },
        cell: ({ row }) =>
            row.original.sides_recorded.length ? (
                <span className="font-mono text-xs">
                    {row.original.sides_recorded.join(' · ')}
                </span>
            ) : (
                <Empty />
            ),
    },
    {
        id: 'creel_type',
        header: 'Creel type',
        enableSorting: false,
        meta: { label: 'Creel type' },
        cell: ({ row }) => <TextCell value={row.original.creel_type?.name} />,
    },
    {
        id: 'filled',
        accessorKey: 'readings_count',
        header: 'Filled',
        meta: { label: 'Filled' },
        cell: ({ row }) => (
            <span className="inline-flex items-center gap-2">
                <ProgressCell
                    percent={(row.original.readings_count / TOTAL_CELLS) * 100}
                />
                <span className="text-xs text-muted-foreground tabular-nums">
                    {row.original.readings_count}/{TOTAL_CELLS}
                </span>
            </span>
        ),
    },
    {
        id: 'out_of_range',
        accessorKey: 'out_of_range_count',
        header: 'Out of range',
        meta: { label: 'Out of range', align: 'right' },
        cell: ({ row }) => {
            const n = row.original.out_of_range_count;
            if (!n) return <Empty />;
            return (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 tabular-nums dark:text-orange-400">
                    <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-orange-500"
                    />
                    {n}
                </span>
            );
        },
    },
];

export function TorqueChecksTable() {
    const [openId, setOpenId] = useState<number | null>(null);
    const grid = useServerTable<TorqueCheckSummary>({
        endpoint: '/torque-checks',
        storageKey: 'torque-checks',
    });

    const table = useReactTable({
        data: grid.data,
        columns,
        getRowId: (row) => String(row.id),
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        enableSortingRemoval: true,
        pageCount: grid.pageCount,
        state: grid.state,
        ...grid.handlers,
    });

    return (
        <>
            <DataGrid
                table={table}
                label="Torque check sheets"
                loading={grid.loading}
                error={grid.error}
                total={grid.total}
                onRetry={grid.refetch}
                search={grid.search}
                onSearchChange={grid.setSearch}
                searchPlaceholder="Search session, operator or machine"
                emptyMessage="No torque checks yet."
                onRowClick={(id) => setOpenId(Number(id))}
                activeRowId={openId === null ? null : String(openId)}
            />
            {openId !== null && (
                <SheetDialog
                    id={openId}
                    onClose={() => setOpenId(null)}
                    onChanged={grid.refetch}
                />
            )}
        </>
    );
}

function SheetDialog({
    id,
    onClose,
    onChanged,
}: {
    id: number;
    onClose: () => void;
    onChanged: () => void;
}) {
    const { can } = usePermissions();
    const [sheet, setSheet] = useState<TorqueCheckDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [side, setSide] = useState<TorqueSide | null>(null);

    useEffect(() => {
        torqueCheckApi
            .show(id)
            .then((s) => {
                setSheet(s);
                setSide(
                    TORQUE_SIDES.find((side) =>
                        s.readings.some((r) => r.side === side),
                    ) ?? null,
                );
            })
            .catch((e) => setError((e as Error).message));
    }, [id]);

    const recordedSides = useMemo(
        () =>
            TORQUE_SIDES.filter((s) =>
                (sheet?.readings ?? []).some((r) => r.side === s),
            ),
        [sheet],
    );
    const byPosition = new Map(
        (sheet?.readings ?? [])
            .filter((r) => r.side === side)
            .map((r) => [`${r.row_no}${r.column_letter}`, r]),
    );
    const lastRow = Math.max(
        0,
        ...(sheet?.readings ?? [])
            .filter((r) => r.side === side)
            .map((r) => r.row_no),
    );

    const download = async () => {
        try {
            const { sections } = await torqueCheckApi.download(id);
            const lines: string[] = [];
            for (const section of sections) {
                if (lines.length > 0) lines.push('');
                lines.push(`SIDE ${section.side}`);
                if (section.grid.length > 0) {
                    const headers = Object.keys(section.grid[0]);
                    lines.push(headers.join(','));
                    lines.push(
                        ...section.grid.map((row) =>
                            headers.map((h) => csvCell(row[h])).join(','),
                        ),
                    );
                }
                if (section.problems.length > 0) {
                    lines.push('', 'LIST PROBLEM');
                    lines.push(
                        ...section.problems.map(
                            (p) => `${p.ROW} ${p.COLUMN} ${csvCell(p.NOTE)}`,
                        ),
                    );
                }
            }
            saveCsv(
                `torque_check_${sheet?.check_date.slice(0, 10) ?? id}.csv`,
                lines.join('\n'),
            );
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const removeSheet = async () => {
        try {
            await torqueCheckApi.deleteSheet(id);
            onChanged();
            onClose();
        } catch (e) {
            setError((e as Error).message);
            setConfirmDelete(false);
        }
    };

    return (
        <>
            <Dialog open onOpenChange={(o) => !o && onClose()}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>
                            {sheet ? day(sheet.check_date) : 'Torque check'}
                        </DialogTitle>
                        <DialogDescription>
                            {sheet
                                ? `${sheet.session_id ? `Session ${sheet.session_id} · ` : ''}Machine ${sheet.machine_number} · ${sheet.operator_name}${sheet.creel_type ? ` · ${sheet.creel_type.name}` : ''}`
                                : 'Loading…'}
                        </DialogDescription>
                    </DialogHeader>
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {recordedSides.length > 1 && side && (
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={side}
                            onValueChange={(v) => v && setSide(v as TorqueSide)}
                            className="w-full"
                        >
                            {recordedSides.map((s) => (
                                <ToggleGroupItem
                                    key={s}
                                    value={s}
                                    className="flex-1"
                                >
                                    {s}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    )}
                    {sheet && lastRow > 0 && (
                        <div className="overflow-x-auto">
                            <table className="border-separate border-spacing-1 text-sm">
                                <thead>
                                    <tr>
                                        <th className="w-10 text-left text-xs font-medium text-muted-foreground">
                                            NO
                                        </th>
                                        {TORQUE_COLUMNS.map((c) => (
                                            <th
                                                key={c}
                                                className="text-xs font-medium text-muted-foreground"
                                            >
                                                {c}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from(
                                        { length: lastRow },
                                        (_, i) => i + 1,
                                    ).map((row) => (
                                        <tr key={row}>
                                            <td className="text-xs text-muted-foreground">
                                                {row}
                                            </td>
                                            {TORQUE_COLUMNS.map((col) => {
                                                const r = byPosition.get(
                                                    `${row}${col}`,
                                                );
                                                return (
                                                    <td
                                                        key={col}
                                                        title={
                                                            r?.note ?? undefined
                                                        }
                                                        className={
                                                            r?.note
                                                                ? 'font-semibold text-destructive'
                                                                : ''
                                                        }
                                                    >
                                                        {r ? r.value : '–'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {sheet && recordedSides.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No readings recorded on this sheet yet.
                        </p>
                    )}
                    <DialogFooter className="gap-2 sm:justify-between">
                        {can('torque-checks.delete') ? (
                            <Button
                                variant="destructive"
                                onClick={() => setConfirmDelete(true)}
                            >
                                <Trash2Icon /> Delete sheet
                            </Button>
                        ) : (
                            <span />
                        )}
                        <Button
                            variant="outline"
                            onClick={() => void download()}
                            disabled={recordedSides.length === 0}
                        >
                            <DownloadIcon /> Download CSV
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this sheet?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes the sheet and everything on
                            it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void removeSheet()}>
                            Delete sheet
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
