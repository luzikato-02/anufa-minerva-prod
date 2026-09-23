import { Input } from '@/components/ui/input';
import { type CreelType, inRange } from '@/lib/creel-types';
import { memo, useEffect, useState } from 'react';

export interface CellReading {
    id?: number;
    clientUuid: string;
    value: string;
    note: string;
    savingValue: boolean;
    error?: string;
}

interface Props {
    position: string;
    reading: CellReading | undefined;
    creelType: CreelType | null;
    onValueBlur: (position: string, value: string) => void;
    onNoteBlur: (position: string, note: string) => void;
}

/** One grid cell: the reading, and — only once it is outside the creel type's range — an inline note. */
export const TorqueCell = memo(function TorqueCell({ position, reading, creelType, onValueBlur, onNoteBlur }: Props) {
    const [value, setValue] = useState(reading?.value ?? '');
    const [note, setNote] = useState(reading?.note ?? '');

    useEffect(() => setValue(reading?.value ?? ''), [reading?.value]);
    useEffect(() => setNote(reading?.note ?? ''), [reading?.note]);

    const numeric = value.trim() === '' ? null : Number(value);
    const outOfRange = creelType !== null && numeric !== null && Number.isFinite(numeric) && !inRange(creelType, numeric);

    return (
        <div className="flex min-w-[64px] flex-col gap-1">
            <Input
                aria-label={`Row ${position.slice(0, -1)}, column ${position.slice(-1)}`}
                className={`h-8 w-16 text-center ${outOfRange ? 'border-destructive text-destructive' : ''}`}
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => {
                    if (value !== (reading?.value ?? '')) onValueBlur(position, value);
                }}
            />
            {reading?.error && <span className="text-[10px] text-destructive">{reading.error}</span>}
            {outOfRange && (
                <Input
                    aria-label={`Note for row ${position.slice(0, -1)}, column ${position.slice(-1)}`}
                    placeholder="Note…"
                    className="h-7 w-24 text-[11px]"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={() => {
                        if (note !== (reading?.note ?? '')) onNoteBlur(position, note);
                    }}
                />
            )}
        </div>
    );
});
