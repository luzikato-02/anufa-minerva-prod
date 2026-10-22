import { Button } from '@/components/ui/button';
import {
    loadLogoChoice,
    type LogoChoice,
    logoImage,
    logoOf,
    saveLogoChoice,
} from '@/lib/control-plans';
import { useRef, useState } from 'react';

const SOURCES: { value: LogoChoice['source']; label: string }[] = [
    { value: 'shared', label: 'Shared logo' },
    { value: 'local', label: "This browser's logo" },
    { value: 'none', label: 'No logo' },
];

/**
 * Which company logo this plan prints in the preview, PDF and Word file. The choice, and a logo uploaded here,
 * stay in this browser only: nothing is saved with the draft or on the server, so it works on any revision.
 */
export function PlanLogo({
    planId,
    sharedLogo,
}: {
    planId: number;
    /** The logo uploaded in Control Plan Settings, as a data: URI, or null. */
    sharedLogo: string | null;
}) {
    const [choice, setChoice] = useState(() => loadLogoChoice(planId));
    const [error, setError] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const shown = logoOf(choice, sharedLogo);

    const pick = (next: LogoChoice) => {
        setError(null);
        try {
            saveLogoChoice(planId, next);
            setChoice(next);
        } catch (e) {
            setError((e as Error).message);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <fieldset className="flex flex-wrap items-center gap-4">
                <legend className="mb-1 text-xs font-medium text-muted-foreground">
                    Company logo
                </legend>
                {SOURCES.map((s) => (
                    <label
                        key={s.value}
                        className="inline-flex items-center gap-1.5 text-sm"
                    >
                        <input
                            type="radio"
                            name="plan-logo"
                            className="size-4 accent-primary"
                            checked={choice.source === s.value}
                            onChange={() =>
                                pick({ ...choice, source: s.value })
                            }
                        />
                        {s.label}
                    </label>
                ))}
            </fieldset>
            <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-16 w-48 place-items-center rounded-md border bg-white p-2">
                    {shown ? (
                        <img
                            src={shown}
                            alt="Logo printed on this plan"
                            className="max-h-full max-w-full object-contain"
                        />
                    ) : (
                        <span className="text-sm text-neutral-500">
                            No logo
                        </span>
                    )}
                </div>
                {choice.source === 'local' && (
                    <>
                        <input
                            ref={input}
                            type="file"
                            accept="image/png,image/jpeg"
                            className="sr-only"
                            aria-label="Logo image"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file) return;
                                try {
                                    pick({
                                        source: 'local',
                                        image: await logoImage(file),
                                    });
                                } catch (err) {
                                    setError((err as Error).message);
                                }
                            }}
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => input.current?.click()}
                        >
                            {choice.image ? 'Replace logo' : 'Upload logo'}
                        </Button>
                    </>
                )}
                <p className="max-w-md text-xs text-muted-foreground">
                    {choice.source === 'shared'
                        ? sharedLogo
                            ? 'The logo uploaded in Control Plan Settings.'
                            : 'No logo is uploaded in Control Plan Settings yet.'
                        : choice.source === 'local'
                          ? "Kept only in this browser, for this plan. It isn't saved on the server, so other computers print the shared logo or none. PNG or JPG, up to 2 MB."
                          : 'Pages print without a logo.'}
                </p>
            </div>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
