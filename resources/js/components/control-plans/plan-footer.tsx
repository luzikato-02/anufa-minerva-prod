import { SignatureDialog } from '@/components/control-plans/signature-pad';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    type Content,
    MAX_SIGNERS,
    newId,
    type Person,
    type Signature,
    SIGNATURE_GROUPS,
    type SignatureGroup,
    type Signer,
} from '@/lib/control-plans';
import { cn } from '@/lib/utils';
import { CheckIcon, PenLineIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

type Footer = Pick<Content, 'notes' | 'signatures'>;

/** How many of the notes and signers differ from the saved draft; each changed or added signer counts once. */
export function footerChanges(doc: Footer, base: Footer): number {
    let n = doc.notes === base.notes ? 0 : 1;
    SIGNATURE_GROUPS.forEach(({ key }) => {
        const was = new Map(base.signatures[key].map((s) => [s.id, s]));
        doc.signatures[key].forEach((s) => {
            const b = was.get(s.id);
            n +=
                !b ||
                b.user_id !== s.user_id ||
                b.name !== s.name ||
                b.position !== s.position
                    ? 1
                    : 0;
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
    /** Signatures by signer box id. */
    signed: Record<string, Signature>;
    /** Accounts a box can be given to; only needed when editing. */
    people?: Person[];
    /** Present on the review page while the revision can still be signed. */
    signing?: Signing;
}

interface Signing {
    me: number;
    /** May sign any box given to an account, for its owner (control-plans.override). */
    override: boolean;
    onSign: (signerId: string, image: string) => Promise<void>;
    onUnsign: (signerId: string) => Promise<void>;
}

/** The notes and the "Dibuat oleh" / "Disetujui oleh" signature block printed under the characteristics table. */
export function PlanFooter({
    footer,
    base,
    onChange,
    badge,
    signed,
    people = [],
    signing,
}: Props) {
    const signedCount = Object.keys(signed).length;
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

            {onChange && signedCount > 0 && (
                <p
                    role="status"
                    className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
                >
                    {signedCount === 1
                        ? '1 person has'
                        : `${signedCount} people have`}{' '}
                    signed this revision. Saving any change to the plan removes
                    every signature, and they will need to sign again.
                </p>
            )}
            {SIGNATURE_GROUPS.map(({ key, label }) =>
                onChange ? (
                    <SignerList
                        key={key}
                        label={label}
                        signers={footer.signatures[key]}
                        base={base?.signatures[key] ?? null}
                        signed={signed}
                        people={people}
                        onChange={(signers) => setSigners(key, signers)}
                    />
                ) : (
                    <SignatureBoxes
                        key={key}
                        label={label}
                        signers={footer.signatures[key]}
                        signed={signed}
                        signing={signing}
                    />
                ),
            )}
            {onChange && (
                <span className="text-xs text-muted-foreground">
                    Give a box to someone&rsquo;s account and they sign it in
                    the app, from the review page; their signature then prints
                    in the box. A box with no account is left blank to sign by
                    hand on paper. A group with nobody in it is left off the
                    page.
                </span>
            )}
        </section>
    );
}

function SignerList({
    label,
    signers,
    base,
    signed,
    people,
    onChange,
}: {
    label: string;
    signers: Signer[];
    base: Signer[] | null;
    signed: Record<string, Signature>;
    people: Person[];
    onChange: (signers: Signer[]) => void;
}) {
    const was = new Map((base ?? []).map((s) => [s.id, s]));
    const edit = (id: string, patch: Partial<Signer>) =>
        onChange(signers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const nameOf = (id: number | null) =>
        people.find((p) => p.id === id)?.name ?? '';

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
                <div className="grid grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_7rem_auto] sm:items-center">
                    <span className="hidden text-xs font-medium text-muted-foreground sm:block">
                        Signs in the app as
                    </span>
                    <span className="hidden text-xs font-medium text-muted-foreground sm:block">
                        Name
                    </span>
                    <span className="hidden text-xs font-medium text-muted-foreground sm:block">
                        Position (jabatan)
                    </span>
                    <span className="hidden text-xs font-medium text-muted-foreground sm:block">
                        Signature
                    </span>
                    <span className="hidden sm:block" />
                    {signers.map((s, n) => {
                        const b = was.get(s.id);
                        const who = `${label}, person ${n + 1}`;
                        const sig = signed[s.id];
                        return [
                            <Select
                                key={`${s.id}-u`}
                                value={s.user_id ? String(s.user_id) : 'none'}
                                onValueChange={(v) => {
                                    const id = v === 'none' ? null : Number(v);
                                    // Follow the account's name unless the name was typed differently.
                                    const keepName =
                                        s.name.trim() !== '' &&
                                        s.name !== nameOf(s.user_id);
                                    edit(s.id, {
                                        user_id: id,
                                        name: keepName ? s.name : nameOf(id),
                                    });
                                }}
                            >
                                <SelectTrigger
                                    aria-label={`${who}: account that signs`}
                                    className={cn(
                                        'h-8 w-full min-w-0',
                                        !!base &&
                                            (!b || b.user_id !== s.user_id) &&
                                            'bg-amber-50 dark:bg-amber-500/10',
                                    )}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        Nobody (sign on paper)
                                    </SelectItem>
                                    {people.map((p) => (
                                        <SelectItem
                                            key={p.id}
                                            value={String(p.id)}
                                        >
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>,
                            <SignerInput
                                key={`${s.id}-n`}
                                ariaLabel={`${who}: name`}
                                value={s.name}
                                dirty={!!base && (!b || b.name !== s.name)}
                                onChange={(v) => edit(s.id, { name: v })}
                            />,
                            <SignerInput
                                key={`${s.id}-p`}
                                ariaLabel={`${who}: position`}
                                value={s.position}
                                dirty={
                                    !!base && (!b || b.position !== s.position)
                                }
                                onChange={(v) => edit(s.id, { position: v })}
                            />,
                            <span
                                key={`${s.id}-s`}
                                className="flex items-center gap-1 text-xs text-muted-foreground"
                            >
                                {sig ? (
                                    <>
                                        <CheckIcon className="size-3.5 text-emerald-600" />
                                        <span className="text-foreground">
                                            Signed {sig.at}
                                            {sig.proxy && ` by ${sig.proxy}`}
                                        </span>
                                    </>
                                ) : s.user_id ? (
                                    'Not signed yet'
                                ) : (
                                    'On paper'
                                )}
                            </span>,
                            <Button
                                key={`${s.id}-x`}
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label={`Remove ${s.name || `person ${n + 1}`} from ${label}`}
                                onClick={() =>
                                    onChange(
                                        signers.filter((x) => x.id !== s.id),
                                    )
                                }
                            >
                                <XIcon />
                            </Button>,
                        ];
                    })}
                </div>
            )}
            {signers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    Nobody yet; not printed.
                </p>
            )}
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
                        { id: newId(), user_id: null, name: '', position: '' },
                    ])
                }
            >
                <PlusIcon /> Add person
            </Button>
        </fieldset>
    );
}

/** The signature boxes as they print, with Sign buttons for the person viewing when a box is theirs. */
function SignatureBoxes({
    label,
    signers,
    signed,
    signing,
}: {
    label: string;
    signers: Signer[];
    signed: Record<string, Signature>;
    signing?: Signing;
}) {
    const [pad, setPad] = useState<Signer | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const unsign = async (id: string) => {
        setBusy(id);
        setError(null);
        try {
            await signing!.onUnsign(id);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(null);
        }
    };

    return (
        <section className="flex min-w-0 flex-col gap-2" aria-label={label}>
            <h3 className="text-sm font-semibold">
                {label}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                    {signers.filter((s) => signed[s.id]).length} of{' '}
                    {signers.length} signed
                </span>
            </h3>
            {signers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Nobody; not printed.
                </p>
            ) : (
                <ul className="flex flex-wrap gap-3">
                    {signers.map((s) => {
                        const sig = signed[s.id];
                        const mine = !!signing && s.user_id === signing.me;
                        const proxy =
                            !mine && !!signing?.override && !!s.user_id;
                        return (
                            <li
                                key={s.id}
                                className="flex w-48 flex-col overflow-hidden rounded-md border text-center"
                            >
                                <div className="grid h-20 place-items-center border-b bg-white px-2">
                                    {sig ? (
                                        <img
                                            src={sig.image}
                                            alt={`Signature of ${sig.by}`}
                                            className="max-h-16 max-w-full"
                                        />
                                    ) : (
                                        <span className="text-xs text-neutral-500">
                                            {s.user_id
                                                ? 'Not signed yet'
                                                : 'Signed on paper'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-1 flex-col gap-0.5 px-2 py-1.5">
                                    <span className="truncate text-sm font-semibold">
                                        {s.name || '—'}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {s.position || '\u00a0'}
                                    </span>
                                    {sig && (
                                        <span className="text-xs text-muted-foreground">
                                            Signed {sig.at}
                                            {sig.proxy && ` by ${sig.proxy}`}
                                        </span>
                                    )}
                                    {(mine || proxy) && (
                                        <Button
                                            size="sm"
                                            variant={sig ? 'ghost' : 'default'}
                                            className="mt-1"
                                            disabled={busy === s.id}
                                            onClick={() =>
                                                sig
                                                    ? void unsign(s.id)
                                                    : setPad(s)
                                            }
                                        >
                                            {sig ? (
                                                mine ? (
                                                    'Remove my signature'
                                                ) : (
                                                    'Remove signature'
                                                )
                                            ) : (
                                                <>
                                                    <PenLineIcon />{' '}
                                                    {mine
                                                        ? 'Sign'
                                                        : `Sign for ${s.name || 'them'}`}
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            {signing && (
                <SignatureDialog
                    open={!!pad}
                    role={label}
                    name={pad?.name ?? ''}
                    onClose={() => setPad(null)}
                    onSave={async (image) => {
                        await signing.onSign(pad!.id, image);
                        setPad(null);
                    }}
                />
            )}
        </section>
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
