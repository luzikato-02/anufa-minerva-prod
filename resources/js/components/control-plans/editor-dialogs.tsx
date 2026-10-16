import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { blank, type HistoryEntry } from '@/lib/control-plans';
import { PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

export interface NewStep {
    no: string;
    group: string;
    name: string;
    machine: string;
    product: string;
    where: 'after' | 'end';
}

export function AddStepDialog({
    initialNo,
    groups,
    currentLabel,
    onClose,
    onCreate,
}: {
    initialNo: string;
    groups: string[];
    currentLabel: string;
    onClose: () => void;
    onCreate: (s: NewStep) => void;
}) {
    const [s, setS] = useState<NewStep>({
        no: initialNo,
        group: '',
        name: '',
        machine: '',
        product: '',
        where: 'end',
    });
    const set = (patch: Partial<NewStep>) =>
        setS((prev) => ({ ...prev, ...patch }));

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Add process step</DialogTitle>
                    <DialogDescription>
                        A step starts with one characteristic line; add more
                        lines to it afterwards with Add characteristic.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="as-no">Process no.</Label>
                        <Input
                            id="as-no"
                            value={s.no}
                            onChange={(e) => set({ no: e.target.value })}
                        />
                    </div>
                    <div className="col-span-3 space-y-1.5">
                        <Label htmlFor="as-group">Group</Label>
                        <Input
                            id="as-group"
                            value={s.group}
                            placeholder="e.g. Doffing process"
                            onChange={(e) => set({ group: e.target.value })}
                        />
                        {groups.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                                <span className="text-xs text-muted-foreground">
                                    Use existing:
                                </span>
                                {groups.map((g) => (
                                    <Button
                                        key={g}
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => set({ group: g })}
                                    >
                                        {g}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="col-span-4 space-y-1.5">
                        <Label htmlFor="as-name">Process name</Label>
                        <Input
                            id="as-name"
                            value={s.name}
                            placeholder="e.g. Inspect yarn"
                            onChange={(e) => set({ name: e.target.value })}
                        />
                    </div>
                    <div className="col-span-4 space-y-1.5">
                        <Label htmlFor="as-machine">
                            Machine, device, jig, tools
                        </Label>
                        <Input
                            id="as-machine"
                            value={s.machine}
                            onChange={(e) => set({ machine: e.target.value })}
                        />
                    </div>
                    <div className="col-span-4 space-y-1.5">
                        <Label htmlFor="as-product">
                            First characteristic (product)
                        </Label>
                        <Input
                            id="as-product"
                            value={s.product}
                            placeholder="e.g. Pallet condition"
                            onChange={(e) => set({ product: e.target.value })}
                        />
                    </div>
                </div>
                <fieldset className="flex flex-wrap gap-4 text-sm">
                    <legend className="mb-1 text-xs font-medium text-muted-foreground">
                        Insert
                    </legend>
                    <label className="inline-flex items-center gap-1.5">
                        <input
                            type="radio"
                            name="as-where"
                            className="size-4 accent-primary"
                            checked={s.where === 'after'}
                            onChange={() => set({ where: 'after' })}
                        />
                        After {currentLabel}
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                        <input
                            type="radio"
                            name="as-where"
                            className="size-4 accent-primary"
                            checked={s.where === 'end'}
                            onChange={() => set({ where: 'end' })}
                        />
                        At the end
                    </label>
                </fieldset>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => onCreate(s)}
                        disabled={blank(s.name)}
                    >
                        Add step
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function SubmitDialog({
    rev,
    unsaved,
    initial,
    onClose,
    onSubmit,
}: {
    rev: string;
    unsaved: number;
    initial: HistoryEntry[];
    onClose: () => void;
    onSubmit: (history: HistoryEntry[]) => Promise<void>;
}) {
    const [rows, setRows] = useState<HistoryEntry[]>(
        initial.length ? initial : [{ pages: 'All', description: '' }],
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const valid =
        rows.length > 0 &&
        rows.every((r) => !blank(r.pages) && !blank(r.description));
    const update = (i: number, patch: Partial<HistoryEntry>) =>
        setRows((prev) =>
            prev.map((r, j) => (j === i ? { ...r, ...patch } : r)),
        );

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            await onSubmit(
                rows.map((r) => ({
                    pages: r.pages.trim(),
                    description: r.description.trim(),
                })),
            );
        } catch (e) {
            setError((e as Error).message);
            setBusy(false);
        }
    };

    return (
        <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Submit Rev {rev} for review</DialogTitle>
                    <DialogDescription>
                        Write what changed for the revision history page. On
                        release, the date, revision number {rev} and your name
                        are added and these rows print on page 1.
                    </DialogDescription>
                </DialogHeader>
                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div className="grid grid-cols-[96px_minmax(0,1fr)_32px] items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                        Page
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                        Description
                    </span>
                    <span />
                    {rows.map((r, i) => [
                        <Input
                            key={`p${i}`}
                            aria-label={`Pages affected, row ${i + 1}`}
                            value={r.pages}
                            placeholder="All, 1, 2-3"
                            onChange={(e) =>
                                update(i, { pages: e.target.value })
                            }
                        />,
                        <Textarea
                            key={`d${i}`}
                            aria-label={`Description, row ${i + 1}`}
                            value={r.description}
                            placeholder="One change per line; several lines print as bullets"
                            onChange={(e) =>
                                update(i, { description: e.target.value })
                            }
                        />,
                        <Button
                            key={`x${i}`}
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={`Remove row ${i + 1}`}
                            disabled={rows.length === 1}
                            onClick={() =>
                                setRows((prev) =>
                                    prev.filter((_, j) => j !== i),
                                )
                            }
                        >
                            <XIcon />
                        </Button>,
                    ])}
                </div>
                <div>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                            setRows((prev) => [
                                ...prev,
                                { pages: '', description: '' },
                            ])
                        }
                    >
                        <PlusIcon /> Add row
                    </Button>
                </div>
                {unsaved > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Unsaved changes (
                        {unsaved === 1 ? '1 change' : `${unsaved} changes`}) are
                        saved with the submission.
                    </p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void submit()}
                        disabled={!valid || busy}
                    >
                        {busy ? 'Submitting…' : 'Submit for review'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
