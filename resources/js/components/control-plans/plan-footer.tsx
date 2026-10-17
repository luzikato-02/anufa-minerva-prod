import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    type Content,
    MAX_SIGNERS,
    newId,
    SIGNATURE_GROUPS,
    type SignatureGroup,
    type Signer,
} from '@/lib/control-plans';
import { cn } from '@/lib/utils';
import { PlusIcon, XIcon } from 'lucide-react';

type Footer = Pick<Content, 'notes' | 'signatures'>;

/** How many of the notes and signers differ from the saved draft; each changed or added signer counts once. */
export function footerChanges(doc: Footer, base: Footer): number {
    let n = doc.notes === base.notes ? 0 : 1;
    SIGNATURE_GROUPS.forEach(({ key }) => {
        const was = new Map(base.signatures[key].map((s) => [s.id, s]));
        doc.signatures[key].forEach((s) => {
            const b = was.get(s.id);
            n += !b || b.name !== s.name || b.position !== s.position ? 1 : 0;
        });
        const ids = new Set(doc.signatures[key].map((s) => s.id));
        n += base.signatures[key].filter((s) => !ids.has(s.id)).length;
    });
    return n;
}

interface Props {
    footer: Footer;
    /** The saved draft, to highlight changes; null when read-only. */
    base: Footer | null;
    /** Absent when read-only. */
    onChange?: (footer: Footer) => void;
    /** Shown beside the heading, e.g. on the review page when this block changed since the last release. */
    badge?: React.ReactNode;
}

/** The notes and the "Dibuat oleh" / "Disetujui oleh" signature block printed under the characteristics table. */
export function PlanFooter({ footer, base, onChange, badge }: Props) {
    const setSigners = (group: SignatureGroup, signers: Signer[]) =>
        onChange?.({
            ...footer,
            signatures: { ...footer.signatures, [group]: signers },
        });

    return (
        <section
            aria-labelledby="plan-footer-title"
            className="flex flex-col gap-4 rounded-lg border bg-card px-4 py-3"
        >
            <div className="flex flex-wrap items-center gap-2">
                <h2 id="plan-footer-title" className="font-semibold">
                    Notes and signatures{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                        · printed under the table, on the last page
                    </span>
                </h2>
                {badge}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label
                    htmlFor="plan-notes"
                    className="text-xs text-muted-foreground"
                >
                    Notes
                </Label>
                <Textarea
                    id="plan-notes"
                    value={footer.notes}
                    readOnly={!onChange}
                    rows={3}
                    maxLength={5000}
                    placeholder={
                        onChange
                            ? '* Sesuai spesifikasi produk masing-masing konstruksi'
                            : 'No notes.'
                    }
                    aria-describedby="plan-notes-help"
                    className={cn(
                        'font-mono text-[13px]',
                        base &&
                            base.notes !== footer.notes &&
                            'bg-amber-50 dark:bg-amber-500/10',
                        !onChange && 'bg-muted',
                    )}
                    onChange={
                        onChange
                            ? (e) =>
                                  onChange({ ...footer, notes: e.target.value })
                            : undefined
                    }
                />
                <span
                    id="plan-notes-help"
                    className="text-xs text-muted-foreground"
                >
                    One note per line, printed as written. Start each with the
                    asterisks used in the table, e.g. “* …” for a value marked
                    1,300 – 2,000 mm*.
                </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {SIGNATURE_GROUPS.map(({ key, label }) => (
                    <SignerList
                        key={key}
                        label={label}
                        signers={footer.signatures[key]}
                        base={base?.signatures[key] ?? null}
                        onChange={
                            onChange
                                ? (signers) => setSigners(key, signers)
                                : undefined
                        }
                    />
                ))}
            </div>
            {onChange && (
                <span className="text-xs text-muted-foreground">
                    Each person gets a box to sign on the printed copy. A group
                    with nobody in it is left off the page.
                </span>
            )}
        </section>
    );
}

function SignerList({
    label,
    signers,
    base,
    onChange,
}: {
    label: string;
    signers: Signer[];
    base: Signer[] | null;
    onChange?: (signers: Signer[]) => void;
}) {
    const was = new Map((base ?? []).map((s) => [s.id, s]));
    const edit = (id: string, field: 'name' | 'position', value: string) =>
        onChange?.(
            signers.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
        );

    return (
        <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
                {label}
                <span className="text-xs font-normal text-muted-foreground">
                    {signers.length === 1
                        ? '1 person'
                        : `${signers.length} people`}
                </span>
            </legend>
            {signers.length > 0 && (
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2">
                    <span className="text-xs font-medium text-muted-foreground">
                        Name
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                        Position (jabatan)
                    </span>
                    <span />
                    {signers.map((s, n) => {
                        const b = was.get(s.id);
                        return [
                            <SignerInput
                                key={`${s.id}-n`}
                                ariaLabel={`${label}, person ${n + 1}: name`}
                                value={s.name}
                                dirty={!!base && (!b || b.name !== s.name)}
                                onChange={
                                    onChange && ((v) => edit(s.id, 'name', v))
                                }
                            />,
                            <SignerInput
                                key={`${s.id}-p`}
                                ariaLabel={`${label}, person ${n + 1}: position`}
                                value={s.position}
                                dirty={
                                    !!base && (!b || b.position !== s.position)
                                }
                                onChange={
                                    onChange &&
                                    ((v) => edit(s.id, 'position', v))
                                }
                            />,
                            onChange ? (
                                <Button
                                    key={`${s.id}-x`}
                                    size="icon"
                                    variant="ghost"
                                    className="size-8"
                                    aria-label={`Remove ${s.name || `person ${n + 1}`} from ${label}`}
                                    onClick={() =>
                                        onChange(
                                            signers.filter(
                                                (x) => x.id !== s.id,
                                            ),
                                        )
                                    }
                                >
                                    <XIcon />
                                </Button>
                            ) : (
                                <span key={`${s.id}-x`} />
                            ),
                        ];
                    })}
                </div>
            )}
            {signers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    Nobody yet; not printed.
                </p>
            )}
            {onChange && (
                <Button
                    size="sm"
                    variant="ghost"
                    className="self-start"
                    disabled={signers.length >= MAX_SIGNERS}
                    title={
                        signers.length >= MAX_SIGNERS
                            ? `At most ${MAX_SIGNERS} people per group`
                            : undefined
                    }
                    onClick={() =>
                        onChange([
                            ...signers,
                            { id: newId(), name: '', position: '' },
                        ])
                    }
                >
                    <PlusIcon /> Add person
                </Button>
            )}
        </fieldset>
    );
}

function SignerInput({
    ariaLabel,
    value,
    dirty,
    onChange,
}: {
    ariaLabel: string;
    value: string;
    dirty: boolean;
    onChange?: (v: string) => void;
}) {
    return (
        <input
            aria-label={ariaLabel}
            value={value}
            maxLength={255}
            readOnly={!onChange}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            className={cn(
                'h-8 w-full min-w-0 rounded-md border px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                dirty
                    ? 'bg-amber-50 dark:bg-amber-500/10'
                    : onChange
                      ? 'bg-transparent'
                      : 'bg-muted',
            )}
        />
    );
}
