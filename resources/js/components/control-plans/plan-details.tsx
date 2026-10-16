import { Field } from '@/components/control-plans/field';
import { ToneBadge } from '@/components/control-plans/status-badge';
import {
    blank,
    type DocHeader,
    PHASES,
    type PlanInfo,
} from '@/lib/control-plans';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';

const REQUIRED_INFO: (keyof PlanInfo)[] = [
    'title',
    'key_contact',
    'core_team',
    'part_number',
    'part_name',
    'org_plant',
    'org_code',
];
const REQUIRED_HEADER: (keyof DocHeader)[] = [
    'mill',
    'sp_ref',
    'sp_date',
    'issued',
];

const APPROVALS: {
    key: 'cust_eng' | 'cust_qual' | 'other1' | 'other2';
    label: string;
}[] = [
    { key: 'cust_eng', label: 'Customer engineering' },
    { key: 'cust_qual', label: 'Customer quality' },
    { key: 'other1', label: 'Other approval' },
    { key: 'other2', label: 'Other approval' },
];

export function missingDetails(
    docNo: string,
    header: DocHeader,
    info: PlanInfo,
): number {
    return (
        REQUIRED_INFO.filter((k) => blank(info[k])).length +
        REQUIRED_HEADER.filter((k) => blank(header[k])).length +
        (blank(docNo) ? 1 : 0)
    );
}

interface Props {
    docNo: string;
    header: DocHeader;
    info: PlanInfo;
    base: { doc_no: string; header: DocHeader; info: PlanInfo } | null;
    revLabel: string;
    lastRelease: string | null;
    nextReview: string | null;
    reviewPeriod: number;
    released: boolean;
    /** Absent when read-only. */
    onDocNo?: (v: string) => void;
    onHeader?: (k: keyof DocHeader, v: string) => void;
    onInfo?: (k: keyof PlanInfo, v: string) => void;
}

/** The document header (printed on every page) and control plan information block (printed once), collapsible. */
export function PlanDetails({
    docNo,
    header,
    info,
    base,
    revLabel,
    lastRelease,
    nextReview,
    reviewPeriod,
    released,
    onDocNo,
    onHeader,
    onInfo,
}: Props) {
    const [open, setOpen] = useState(!released);
    const missing = missingDetails(docNo, header, info);
    const phaseName = PHASES.find((p) => p.value === info.phase)?.label ?? '';
    const h = (k: keyof DocHeader) => ({
        value: header[k],
        dirty: !!base && base.header[k] !== header[k],
        onChange: onHeader && ((v: string) => onHeader(k, v)),
    });
    const i = (k: keyof PlanInfo) => ({
        value: info[k],
        dirty: !!base && base.info[k] !== info[k],
        onChange: onInfo && ((v: string) => onInfo(k, v)),
    });

    return (
        <section
            aria-label="Document and plan details"
            className="flex flex-col gap-4 rounded-lg border bg-card px-4 py-3"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                    type="button"
                    className="inline-flex items-center gap-2 font-semibold focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                    aria-expanded={open}
                    aria-controls="plan-body"
                    onClick={() => setOpen((o) => !o)}
                >
                    {open ? (
                        <ChevronDownIcon className="size-4" />
                    ) : (
                        <ChevronRightIcon className="size-4" />
                    )}
                    Document and plan details
                </button>
                <div className="flex flex-wrap items-center gap-2">
                    {!open && (
                        <span className="text-xs text-muted-foreground">
                            {[
                                phaseName,
                                info.title || 'No title yet',
                                info.key_contact &&
                                    `Key contact: ${info.key_contact}`,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    )}
                    {missing > 0 && !released && (
                        <ToneBadge tone="overdue">
                            {missing === 1
                                ? '1 field to fill before review'
                                : `${missing} fields to fill before review`}
                        </ToneBadge>
                    )}
                </div>
            </div>
            {open && (
                <div id="plan-body" className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold">
                        Document header{' '}
                        <span className="font-normal text-muted-foreground">
                            · printed on every page
                        </span>
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <Field
                            id="d-mill"
                            label="Mill / department"
                            {...h('mill')}
                        />
                        <Field
                            id="d-docno"
                            label="Document number"
                            mono
                            value={docNo}
                            dirty={!!base && base.doc_no !== docNo}
                            onChange={onDocNo}
                            help="Also printed as the control plan number."
                        />
                        <Field
                            id="d-spref"
                            label="Referensi SP"
                            mono
                            {...h('sp_ref')}
                        />
                        <Field
                            id="d-spdate"
                            label="Tanggal Diterbitkan SP"
                            placeholder="e.g. 20 Juni 2014"
                            {...h('sp_date')}
                        />
                        <Field
                            id="d-issued"
                            label="Tanggal diterbitkan"
                            placeholder="e.g. 27 Oktober 2016"
                            help="Also printed as Date (Orig.)."
                            {...h('issued')}
                        />
                    </div>
                    <dl className="grid gap-3 rounded-md bg-muted p-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                        <Derived
                            label="No. Revisi / Tanggal Revisi terakhir"
                            value={lastRelease ?? 'Not released yet'}
                        />
                        <Derived
                            label="Tanggal Review berikutnya"
                            value={nextReview ?? '—'}
                        />
                        {!released && (
                            <Derived
                                label={`On release of Rev ${revLabel}`}
                                value={`Both update from the release date; the next review is ${reviewPeriod} years later`}
                                pending
                            />
                        )}
                        <Derived
                            label="Halaman"
                            value="Revision history is page 1, the control plan page 2"
                            pending
                        />
                    </dl>

                    <h3 className="border-t pt-3 text-sm font-semibold">
                        Control plan information{' '}
                        <span className="font-normal text-muted-foreground">
                            · printed once, on the plan page
                        </span>
                    </h3>
                    <div className="flex flex-wrap items-end gap-6">
                        <fieldset className="flex flex-wrap items-center gap-4">
                            <legend className="mb-1 text-xs font-medium text-muted-foreground">
                                Phase
                            </legend>
                            {PHASES.map((p) => (
                                <label
                                    key={p.value}
                                    className="inline-flex items-center gap-1.5 text-sm"
                                >
                                    <input
                                        type="radio"
                                        name="plan-phase"
                                        className="size-4 accent-primary"
                                        checked={info.phase === p.value}
                                        disabled={!onInfo}
                                        onChange={() =>
                                            onInfo?.('phase', p.value)
                                        }
                                    />
                                    {p.label}
                                </label>
                            ))}
                        </fieldset>
                        <Field
                            id="p-title"
                            className="flex-1 basis-80"
                            label="Control plan title"
                            placeholder="e.g. Production Preparation Area (PPA) Control Plan"
                            {...i('title')}
                        />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Field
                            id="p-contact"
                            label="Key contact / phone"
                            {...i('key_contact')}
                        />
                        <Field
                            id="p-team"
                            label="Core team"
                            placeholder="e.g. QA, Prod., Tech., MTC"
                            {...i('core_team')}
                        />
                        <Field
                            id="p-partno"
                            label="Part number / latest change level"
                            {...i('part_number')}
                        />
                        <Field
                            id="p-partname"
                            label="Part name / description"
                            {...i('part_name')}
                        />
                        <Field
                            id="p-plant"
                            label="Organization / plant"
                            {...i('org_plant')}
                        />
                        <Field
                            id="p-orgcode"
                            label="Organization code"
                            {...i('org_code')}
                        />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                                From the document and revision
                            </span>
                            <dl className="grid gap-3 rounded-md bg-muted p-3 text-[13px] sm:grid-cols-2">
                                <Derived
                                    label="Control plan number"
                                    value={docNo}
                                    mono
                                />
                                <Derived
                                    label="Date (Orig.)"
                                    value={header.issued || '—'}
                                />
                                <Derived
                                    label="Date (Rev.)"
                                    value={
                                        released
                                            ? (lastRelease ?? '')
                                            : `Set when Rev ${revLabel} is released`
                                    }
                                    pending={!released}
                                />
                                <Derived
                                    label="Organization / plan approval"
                                    value={
                                        released
                                            ? (lastRelease ?? '')
                                            : 'Set by the approver on release'
                                    }
                                    pending={!released}
                                />
                            </dl>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-[minmax(130px,1.2fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Approval (if required)
                                </span>
                                <span className="text-xs font-medium text-muted-foreground">
                                    Name
                                </span>
                                <span className="text-xs font-medium text-muted-foreground">
                                    Date
                                </span>
                                {APPROVALS.map((a, n) => {
                                    const name = i(
                                        `${a.key}_name` as keyof PlanInfo,
                                    );
                                    const date = i(
                                        `${a.key}_date` as keyof PlanInfo,
                                    );
                                    return [
                                        <label
                                            key={`${a.key}-l`}
                                            htmlFor={`p-${a.key}-name`}
                                            className="text-sm"
                                        >
                                            {a.label}
                                        </label>,
                                        <ApprovalInput
                                            key={`${a.key}-n`}
                                            id={`p-${a.key}-name`}
                                            {...name}
                                        />,
                                        <ApprovalInput
                                            key={`${a.key}-d`}
                                            ariaLabel={`${a.label} date${n === 3 ? ' (second)' : ''}`}
                                            {...date}
                                        />,
                                    ];
                                })}
                            </div>
                            <span className="text-xs text-muted-foreground">
                                Leave an approval blank when it is not required;
                                it prints blank.
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

function ApprovalInput({
    id,
    ariaLabel,
    value,
    dirty,
    onChange,
}: {
    id?: string;
    ariaLabel?: string;
    value: string;
    dirty: boolean;
    onChange?: (v: string) => void;
}) {
    return (
        <input
            id={id}
            aria-label={ariaLabel}
            value={value}
            readOnly={!onChange}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            className={`h-8 w-full min-w-0 rounded-md border px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 ${dirty ? 'bg-amber-50 dark:bg-amber-500/10' : onChange ? 'bg-transparent' : 'bg-muted'}`}
        />
    );
}

function Derived({
    label,
    value,
    pending,
    mono,
}: {
    label: string;
    value: string;
    pending?: boolean;
    mono?: boolean;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs font-medium text-muted-foreground">
                {label}
            </dt>
            <dd
                className={
                    pending
                        ? 'text-muted-foreground italic'
                        : mono
                          ? 'font-mono'
                          : ''
                }
            >
                {value}
            </dd>
        </div>
    );
}
