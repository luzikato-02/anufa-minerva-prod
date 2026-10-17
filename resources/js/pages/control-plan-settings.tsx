import { Field } from '@/components/control-plans/field';
import { ToneBadge } from '@/components/control-plans/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { controlPlanApi, type Settings } from '@/lib/control-plans';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Quality Documents', href: '#' },
    { title: 'Control Plan Settings', href: '/control-plan-settings' },
];

interface Form {
    mill: string;
    org_plant: string;
    org_code: string;
    date_format: 'id' | 'en';
    period: string;
}

const toForm = (s: Settings): Form => ({
    mill: s.mill ?? '',
    org_plant: s.org_plant ?? '',
    org_code: s.org_code ?? '',
    date_format: s.date_format,
    period: String(s.review_period_years),
});

export default function ControlPlanSettings({
    settings,
    logo,
    users,
}: {
    settings: Settings;
    /** The company logo as a data: URI, or null when none is uploaded. */
    logo: string | null;
    users: { id: number; name: string; roles: string[] }[];
}) {
    const { can } = usePermissions();
    const [base, setBase] = useState(() => toForm(settings));
    const [v, setV] = useState(base);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const dirty = (Object.keys(v) as (keyof Form)[]).some(
        (k) => v[k] !== base[k],
    );
    const years = Number(v.period);
    const validYears = Number.isInteger(years) && years >= 1 && years <= 10;
    const month = v.date_format === 'id' ? 'Oktober' : 'October';
    const set = (patch: Partial<Form>) => {
        setV((prev) => ({ ...prev, ...patch }));
        setSaved(false);
    };

    const save = async () => {
        if (!validYears)
            return setError(
                'The review period must be a whole number of years, from 1 to 10.',
            );
        setBusy(true);
        setError(null);
        try {
            await controlPlanApi.saveSettings({
                mill: v.mill,
                org_plant: v.org_plant,
                org_code: v.org_code,
                date_format: v.date_format,
                review_period_years: years,
            });
            setBase(v);
            setSaved(true);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Control Plan Settings" />
            <div className="flex min-h-full flex-col">
                <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
                    <h1 className="text-xl font-semibold">
                        Control plan settings
                    </h1>
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <LogoCard initial={logo} />

                    <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                            <CardTitle className="text-base">
                                Document defaults
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Filled into every new control plan; each plan
                                can still change them.
                            </p>
                        </CardHeader>
                        <CardContent className="grid gap-3 px-4 sm:grid-cols-2">
                            <Field
                                id="s-mill"
                                label="Mill / department"
                                value={v.mill}
                                onChange={(x) => set({ mill: x })}
                            />
                            <Field
                                id="s-plant"
                                label="Organization / plant"
                                value={v.org_plant}
                                onChange={(x) => set({ org_plant: x })}
                            />
                            <Field
                                id="s-code"
                                label="Organization code"
                                value={v.org_code}
                                onChange={(x) => set({ org_code: x })}
                            />
                        </CardContent>
                    </Card>

                    <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                            <CardTitle className="text-base">
                                Dates and reviews
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 px-4">
                            <fieldset className="flex flex-col gap-2">
                                <legend className="mb-2 text-xs font-medium text-muted-foreground">
                                    Date format on printed documents
                                </legend>
                                <div className="flex flex-wrap gap-2">
                                    {(
                                        [
                                            [
                                                'id',
                                                'Indonesian',
                                                '09 Oktober 2026',
                                            ],
                                            [
                                                'en',
                                                'English',
                                                '09 October 2026',
                                            ],
                                        ] as const
                                    ).map(([value, label, example]) => (
                                        <label
                                            key={value}
                                            className={cn(
                                                'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2',
                                                v.date_format === value &&
                                                    'border-primary bg-primary/5',
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="s-fmt"
                                                className="mt-0.5 size-4 accent-primary"
                                                checked={
                                                    v.date_format === value
                                                }
                                                onChange={() =>
                                                    set({ date_format: value })
                                                }
                                            />
                                            <span className="flex flex-col">
                                                <b className="text-sm">
                                                    {label}
                                                </b>
                                                <span className="text-xs text-muted-foreground">
                                                    {example}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <p className="text-xs text-muted-foreground">
                                Used for revision dates, review dates and
                                history rows. Imported history keeps its dates
                                as printed.
                            </p>
                            <Field
                                id="s-period"
                                className="max-w-sm"
                                label="Next review after release (years)"
                                value={v.period}
                                onChange={(x) => set({ period: x })}
                                error={
                                    validYears
                                        ? null
                                        : 'Enter a whole number of years, from 1 to 10.'
                                }
                                help={`A release on 15 ${month} 2026 is due for review on 15 ${month} ${2026 + (validYears ? years : 0)}.`}
                            />
                        </CardContent>
                    </Card>

                    <Card className="gap-3 py-4">
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4">
                            <CardTitle className="text-base">
                                Users and roles
                            </CardTitle>
                            {can('users.view') && (
                                <Button size="sm" variant="outline" asChild>
                                    <Link href="/user-maintenance">
                                        Manage users and roles
                                    </Link>
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 px-4">
                            {users.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Nobody can write, review or release control
                                    plans yet.
                                </p>
                            ) : (
                                <div className="divide-y rounded-md border">
                                    {users.map((u) => (
                                        <div
                                            key={u.id}
                                            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                                        >
                                            <span>{u.name}</span>
                                            <span className="flex flex-wrap gap-1">
                                                {u.roles.map((r) => (
                                                    <Badge
                                                        key={r}
                                                        variant="secondary"
                                                    >
                                                        {r}
                                                    </Badge>
                                                ))}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Roles come from the control-plans permissions:
                                author, review (QA reviewer) and approve
                                (approver). Whoever submits a revision can never
                                approve or release it. Everyone with
                                control-plans.view can see released plans.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                            <CardTitle className="text-base">
                                Print layout
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4">
                            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                                <dt className="text-muted-foreground">
                                    Layout
                                </dt>
                                <dd>
                                    W-WSD work station document, A4 landscape
                                </dd>
                                <dt className="text-muted-foreground">Pages</dt>
                                <dd>
                                    Revision history, then control plan
                                    information and characteristics
                                </dd>
                                <dt className="text-muted-foreground">
                                    Characteristic fields
                                </dt>
                                <dd>
                                    Free text; reference codes are matched
                                    against the{' '}
                                    <Link
                                        href="/control-plan-references"
                                        className="text-primary underline"
                                    >
                                        reference library
                                    </Link>
                                </dd>
                            </dl>
                        </CardContent>
                    </Card>
                </div>

                <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background px-4 py-3">
                    {dirty && (
                        <ToneBadge tone="draft">Unsaved changes</ToneBadge>
                    )}
                    {saved && !dirty && (
                        <span
                            role="status"
                            className="text-xs text-muted-foreground"
                        >
                            Settings saved.
                        </span>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => setV(base)}
                        disabled={!dirty || busy}
                    >
                        Discard
                    </Button>
                    <Button
                        onClick={() => void save()}
                        disabled={!dirty || busy}
                    >
                        {busy ? 'Saving…' : 'Save settings'}
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}

/** Uploads or removes the company logo printed above the mill name on every page. Saves straight away. */
function LogoCard({ initial }: { initial: string | null }) {
    const [logo, setLogo] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);

    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
            if (input.current) input.current.value = '';
        }
    };

    return (
        <Card className="gap-3 py-4">
            <CardHeader className="px-4">
                <CardTitle className="text-base">Company logo</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Printed above the mill / department on every page of every
                    control plan, in the preview, the PDF and the Word file. PNG
                    or JPG, up to 2 MB; a wide logo on a white or transparent
                    background prints best.
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="grid h-20 w-60 place-items-center rounded-md border bg-white p-2">
                        {logo ? (
                            <img
                                src={logo}
                                alt="Current company logo"
                                className="max-h-full max-w-full object-contain"
                            />
                        ) : (
                            <span className="text-sm text-neutral-500">
                                No logo
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <input
                            ref={input}
                            id="s-logo"
                            type="file"
                            accept="image/png,image/jpeg"
                            className="sr-only"
                            disabled={busy}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file)
                                    void run(async () =>
                                        setLogo(
                                            await controlPlanApi.uploadLogo(
                                                file,
                                            ),
                                        ),
                                    );
                            }}
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => input.current?.click()}
                        >
                            {busy
                                ? 'Saving…'
                                : logo
                                  ? 'Replace logo'
                                  : 'Upload logo'}
                        </Button>
                        {logo && (
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                    void run(async () => {
                                        await controlPlanApi.deleteLogo();
                                        setLogo(null);
                                    })
                                }
                            >
                                Remove
                            </Button>
                        )}
                    </div>
                </div>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
