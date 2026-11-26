import {
    Field,
    NativeSelect,
    ReedGradeBadge,
} from '@/components/reeds/reed-status';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    CHECKS,
    GRADE_META,
    reedApi,
    type Reed,
    type ReedAction,
    type ReedGrade,
    type ReedOptions,
} from '@/lib/reeds';
import { cn } from '@/lib/utils';
import { useState, type FormEvent } from 'react';

export const ACTION_TITLE: Record<ReedAction, string> = {
    reserve: 'Reserve',
    release: 'Release reservation',
    issue: 'Mount on loom',
    return: 'Return from loom',
    inspect: 'Inspect',
    transfer: 'Move',
    'repair-out': 'Send to repair',
    'repair-in': 'Back from repair',
    scrap: 'Scrap',
};

const ACTION_HELP: Partial<Record<ReedAction, string>> = {
    reserve: 'Holds the reed for a style change so no one else takes it.',
    return: 'The reed goes to Returned and must be inspected before it is back in stock.',
    inspect:
        'Grade A or B puts it back in stock; C or X sends it to quarantine.',
    'repair-in':
        'It comes back as Returned, so it is inspected before going into stock.',
    scrap: 'The reed leaves the inventory. Its history is kept.',
};

const today = () => new Date().toISOString().slice(0, 10);

/** One dialog for every move; it shows only the fields that move needs. */
export function ReedActionDialog({
    reed,
    action,
    options,
    onClose,
    onDone,
}: {
    reed: Reed;
    action: ReedAction;
    options: ReedOptions | null;
    onClose: () => void;
    onDone: (reed: Reed) => void;
}) {
    const [loom, setLoom] = useState(reed.loom_number ?? '');
    const [styleId, setStyleId] = useState(
        reed.fabric_style_id ? String(reed.fabric_style_id) : '',
    );
    const [orderNo, setOrderNo] = useState(reed.order_no ?? '');
    const [meters, setMeters] = useState('');
    const [locationId, setLocationId] = useState(
        action === 'transfer'
            ? ''
            : reed.location_id
              ? String(reed.location_id)
              : '',
    );
    const [grade, setGrade] = useState<ReedGrade>(
        reed.grade === 'X' ? 'C' : reed.grade,
    );
    const [checks, setChecks] = useState<Record<string, boolean>>({});
    const [defectDents, setDefectDents] = useState('');
    const [vendor, setVendor] = useState('');
    const [text, setText] = useState(''); // note, defects, work done or scrap reason
    const [date, setDate] = useState(today());
    const [cost, setCost] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const styles = (options?.styles ?? []).filter(
        (s) => !s.reed_spec_id || s.reed_spec_id === reed.reed_spec_id,
    );
    const locations = options?.locations ?? [];
    const needsLocation =
        action === 'inspect' && (grade === 'A' || grade === 'B') && !locationId;

    const fields = (): Record<string, unknown> | string => {
        const num = (v: string) => (v.trim() === '' ? null : Number(v));
        const id = (v: string) => (v ? Number(v) : null);
        switch (action) {
            case 'reserve':
                return {
                    loom_number: loom.trim() || null,
                    fabric_style_id: id(styleId),
                    note: text || null,
                };
            case 'release':
                return { note: text || null };
            case 'issue':
                if (!loom.trim()) return 'Enter the loom number.';
                return {
                    loom_number: loom.trim(),
                    fabric_style_id: id(styleId),
                    order_no: orderNo.trim() || null,
                    note: text || null,
                };
            case 'return':
                if (
                    meters.trim() === '' ||
                    !Number.isFinite(Number(meters)) ||
                    Number(meters) < 0
                )
                    return 'Enter the meters woven on this mounting (0 if none).';
                return {
                    meters_woven: Number(meters),
                    location_id: id(locationId),
                    note: text || null,
                };
            case 'inspect':
                if (needsLocation)
                    return 'Pick a rack location to put the reed back in stock.';
                return {
                    grade,
                    checklist: checks,
                    defect_dents: defectDents.trim() || null,
                    location_id: id(locationId),
                    note: text || null,
                };
            case 'transfer':
                if (!locationId) return 'Pick the new location.';
                return { location_id: Number(locationId) };
            case 'repair-out':
                if (!vendor.trim()) return 'Enter the repair vendor.';
                return {
                    vendor: vendor.trim(),
                    defects: text || null,
                    sent_on: date,
                };
            case 'repair-in':
                return {
                    returned_on: date,
                    cost: num(cost),
                    work_done: text || null,
                    location_id: id(locationId),
                };
            case 'scrap':
                if (!text.trim()) return 'Give a reason for scrapping.';
                return { reason: text.trim() };
        }
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const body = fields();
        if (typeof body === 'string') return setError(body);
        setBusy(true);
        setError(null);
        try {
            onDone(await reedApi.act(reed.id, action, body));
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const locationSelect = (label: string, optional = true) => (
        <Field label={label} htmlFor="ra-location">
            <NativeSelect
                id="ra-location"
                value={locationId}
                onChange={setLocationId}
            >
                <option value="">
                    {optional ? '— none —' : 'Pick a location'}
                </option>
                {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                        {l.code}
                        {l.zone ? ` · ${l.zone}` : ''}
                    </option>
                ))}
            </NativeSelect>
        </Field>
    );

    const textField = (label: string, placeholder?: string) => (
        <Field label={label} htmlFor="ra-text">
            <Input
                id="ra-text"
                value={text}
                placeholder={placeholder}
                onChange={(e) => setText(e.target.value)}
            />
        </Field>
    );

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>
                            {ACTION_TITLE[action]} ·{' '}
                            <span className="font-mono">{reed.serial_no}</span>
                        </DialogTitle>
                        <DialogDescription>
                            {ACTION_HELP[action] ??
                                `Spec ${reed.spec?.code ?? ''}`}
                        </DialogDescription>
                    </DialogHeader>
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {(action === 'reserve' || action === 'issue') && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <Field
                                    label={
                                        action === 'issue'
                                            ? 'Loom number'
                                            : 'Loom (optional)'
                                    }
                                    htmlFor="ra-loom"
                                >
                                    <Input
                                        id="ra-loom"
                                        value={loom}
                                        autoFocus
                                        onChange={(e) =>
                                            setLoom(e.target.value)
                                        }
                                        placeholder="e.g. L-27"
                                    />
                                </Field>
                                {action === 'issue' && (
                                    <Field
                                        label="Production order"
                                        htmlFor="ra-order"
                                    >
                                        <Input
                                            id="ra-order"
                                            value={orderNo}
                                            onChange={(e) =>
                                                setOrderNo(e.target.value)
                                            }
                                        />
                                    </Field>
                                )}
                            </div>
                            <Field
                                label="Fabric style"
                                htmlFor="ra-style"
                                hint={
                                    styles.length === 0
                                        ? 'No style is set up for this spec yet.'
                                        : undefined
                                }
                            >
                                <NativeSelect
                                    id="ra-style"
                                    value={styleId}
                                    onChange={setStyleId}
                                >
                                    <option value="">— none —</option>
                                    {styles.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.code}
                                            {s.description
                                                ? ` · ${s.description}`
                                                : ''}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                            {textField('Note')}
                        </>
                    )}

                    {action === 'release' && textField('Note')}

                    {action === 'return' && (
                        <>
                            <Field
                                label="Meters woven on this mounting"
                                htmlFor="ra-meters"
                                hint={
                                    reed.loom_number
                                        ? `From loom ${reed.loom_number}`
                                        : undefined
                                }
                            >
                                <Input
                                    id="ra-meters"
                                    inputMode="decimal"
                                    autoFocus
                                    value={meters}
                                    onChange={(e) => setMeters(e.target.value)}
                                />
                            </Field>
                            {locationSelect('Put in location (optional)')}
                            {textField(
                                'What did you see?',
                                'e.g. a few bent dents near the left selvedge',
                            )}
                        </>
                    )}

                    {action === 'inspect' && (
                        <>
                            <fieldset className="space-y-1.5">
                                <legend className="text-xs font-medium">
                                    Grade
                                </legend>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {(['A', 'B', 'C', 'X'] as ReedGrade[]).map(
                                        (g) => (
                                            <button
                                                key={g}
                                                type="button"
                                                aria-pressed={grade === g}
                                                onClick={() => setGrade(g)}
                                                className={cn(
                                                    'flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-xs transition-colors',
                                                    grade === g
                                                        ? 'border-foreground bg-muted'
                                                        : 'hover:bg-muted/50',
                                                )}
                                            >
                                                <ReedGradeBadge grade={g} />
                                                <span className="text-muted-foreground">
                                                    {GRADE_META[g]}
                                                </span>
                                            </button>
                                        ),
                                    )}
                                </div>
                            </fieldset>
                            <fieldset className="space-y-1.5">
                                <legend className="text-xs font-medium">
                                    Defects found
                                </legend>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                    {CHECKS.map((c) => (
                                        <label
                                            key={c.key}
                                            className="flex items-center gap-2 text-sm"
                                        >
                                            <Checkbox
                                                checked={!!checks[c.key]}
                                                onCheckedChange={(v) =>
                                                    setChecks((prev) => ({
                                                        ...prev,
                                                        [c.key]: v === true,
                                                    }))
                                                }
                                            />
                                            {c.label}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <Field
                                label="Defect positions (dents)"
                                htmlFor="ra-dents"
                            >
                                <Input
                                    id="ra-dents"
                                    value={defectDents}
                                    placeholder="e.g. 120–135, 880"
                                    onChange={(e) =>
                                        setDefectDents(e.target.value)
                                    }
                                />
                            </Field>
                            {(grade === 'A' || grade === 'B') &&
                                locationSelect(
                                    'Put back in location',
                                    !needsLocation,
                                )}
                            {textField('Note')}
                        </>
                    )}

                    {action === 'transfer' &&
                        locationSelect('New location', false)}

                    {action === 'repair-out' && (
                        <>
                            <Field label="Vendor" htmlFor="ra-vendor">
                                <Input
                                    id="ra-vendor"
                                    value={vendor}
                                    autoFocus
                                    onChange={(e) => setVendor(e.target.value)}
                                />
                            </Field>
                            <Field label="Sent on" htmlFor="ra-date">
                                <Input
                                    id="ra-date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </Field>
                            {textField('Defects to fix')}
                        </>
                    )}

                    {action === 'repair-in' && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Returned on" htmlFor="ra-date">
                                    <Input
                                        id="ra-date"
                                        type="date"
                                        value={date}
                                        onChange={(e) =>
                                            setDate(e.target.value)
                                        }
                                    />
                                </Field>
                                <Field label="Cost (Rp)" htmlFor="ra-cost">
                                    <Input
                                        id="ra-cost"
                                        inputMode="decimal"
                                        value={cost}
                                        onChange={(e) =>
                                            setCost(e.target.value)
                                        }
                                    />
                                </Field>
                            </div>
                            {textField('Work done')}
                            {locationSelect('Put in location (optional)')}
                        </>
                    )}

                    {action === 'scrap' &&
                        textField('Reason', 'e.g. worn wires beyond repair')}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={busy}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant={
                                action === 'scrap' ? 'destructive' : 'default'
                            }
                            disabled={busy}
                        >
                            {busy ? 'Saving…' : ACTION_TITLE[action]}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
