import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type RowFields, parseNumber } from '@/lib/stock-sheets';

/** The row form as the user types it: every field is text until it is checked. */
export interface RowDraft {
    color: string;
    material_code: string;
    batch: string;
    prod_date: string;
    chs: string;
    actual_weight: string;
    position: string;
    remark: string;
}

export const emptyDraft: RowDraft = { color: '', material_code: '', batch: '', prod_date: '', chs: '', actual_weight: '', position: '', remark: '' };

export function draftFrom(row: RowFields): RowDraft {
    return {
        color: row.color ?? '',
        material_code: row.material_code,
        batch: row.batch,
        prod_date: row.prod_date ?? '',
        chs: row.chs === null ? '' : String(row.chs),
        actual_weight: row.actual_weight === null ? '' : String(row.actual_weight),
        position: row.position === null ? '' : String(row.position),
        remark: row.remark ?? '',
    };
}

/** Checks the draft; returns the fields to send, or the message to show. */
export function readDraft(d: RowDraft): { fields: RowFields } | { error: string } {
    if (d.material_code.trim() === '') return { error: 'Enter the material code.' };
    if (d.batch.trim() === '') return { error: 'Enter the batch.' };
    const chs = parseNumber(d.chs, { integer: true });
    const weight = parseNumber(d.actual_weight);
    const position = parseNumber(d.position, { integer: true, max: 999 });
    if (chs === undefined) return { error: 'Cheeses must be a whole number.' };
    if (weight === undefined) return { error: 'Weight must be a number, like 146.8.' };
    if (position === undefined) return { error: 'Position must be a number from 0 to 999.' };
    return {
        fields: {
            color: d.color.trim() || null,
            material_code: d.material_code.trim(),
            batch: d.batch.trim(),
            prod_date: d.prod_date || null,
            chs,
            actual_weight: weight,
            position,
            remark: d.remark.trim() || null,
        },
    };
}

interface Props {
    draft: RowDraft;
    onChange: (next: RowDraft) => void;
    recentColors?: string[];
    recentRemarks?: string[];
    idPrefix: string;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            {children}
        </div>
    );
}

function Chips({ values, onPick }: { values: string[]; onPick: (v: string) => void }) {
    if (values.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1.5">
            {values.map((v) => (
                <Button key={v} type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onPick(v)}>
                    {v}
                </Button>
            ))}
        </div>
    );
}

export function RowFieldsForm({ draft, onChange, recentColors = [], recentRemarks = [], idPrefix }: Props) {
    const set = (k: keyof RowDraft) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...draft, [k]: e.target.value });
    const id = (k: string) => `${idPrefix}-${k}`;
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
                <Field id={id('color')} label="Colour">
                    <Input id={id('color')} value={draft.color} onChange={set('color')} placeholder="e.g. White orange green" />
                </Field>
                <Chips values={recentColors} onPick={(v) => onChange({ ...draft, color: v })} />
            </div>
            <Field id={id('material')} label="Material code">
                <Input id={id('material')} value={draft.material_code} onChange={set('material_code')} placeholder="e.g. TY022002756" />
            </Field>
            <Field id={id('batch')} label="Batch">
                <Input id={id('batch')} value={draft.batch} onChange={set('batch')} placeholder="TA… or a note" />
            </Field>
            <Field id={id('date')} label="Production date">
                <Input id={id('date')} type="date" value={draft.prod_date} onChange={set('prod_date')} />
            </Field>
            <Field id={id('chs')} label="Cheeses">
                <Input id={id('chs')} inputMode="numeric" value={draft.chs} onChange={set('chs')} />
            </Field>
            <Field id={id('weight')} label="Weight (kg)">
                <Input id={id('weight')} inputMode="decimal" value={draft.actual_weight} onChange={set('actual_weight')} />
            </Field>
            <Field id={id('position')} label="Position">
                <Input id={id('position')} inputMode="numeric" value={draft.position} onChange={set('position')} />
            </Field>
            <div className="space-y-2 sm:col-span-2">
                <Field id={id('remark')} label="Remark">
                    <Input id={id('remark')} value={draft.remark} onChange={set('remark')} placeholder="e.g. ex WV" />
                </Field>
                <Chips values={recentRemarks} onPick={(v) => onChange({ ...draft, remark: v })} />
            </div>
        </div>
    );
}
