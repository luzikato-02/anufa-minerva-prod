import { REF_CODE_IN_TEXT } from '@/lib/control-plans';
import { cn } from '@/lib/utils';
import { Fragment } from 'react';

/** A document code as a chip; dashed red when it is not in the reference library. */
export function RefChip({ code, known }: { code: string; known: boolean }) {
    return (
        <span
            title={known ? undefined : 'Not in the reference library'}
            className={cn(
                'inline-flex items-center rounded border px-1 font-mono text-[11px] leading-[18px] whitespace-nowrap',
                known
                    ? 'border-border bg-muted text-foreground'
                    : 'border-dashed border-red-500 text-red-700 dark:text-red-400',
            )}
        >
            {code}
        </span>
    );
}

/** Text with each document code in it shown as a chip. Without a `known` set, every code shows as known. */
export function RefText({
    text,
    known,
}: {
    text: string;
    known?: Set<string>;
}) {
    const parts: React.ReactNode[] = [];
    let last = 0;
    for (const m of text.matchAll(REF_CODE_IN_TEXT)) {
        const at = m.index ?? 0;
        if (at > last) parts.push(text.slice(last, at));
        parts.push(
            <RefChip key={at} code={m[0]} known={!known || known.has(m[0])} />,
        );
        last = at + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return (
        <>
            {parts.map((p, i) => (
                <Fragment key={i}>{p}</Fragment>
            ))}
        </>
    );
}
