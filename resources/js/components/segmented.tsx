import { cn } from '@/lib/utils';

/** Small segmented filter matching the density toggle. */
export function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
}) {
    return (
        <div
            role="group"
            aria-label={label}
            className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5"
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'h-6 rounded-md px-2 text-xs font-medium transition-colors',
                        value === option.value
                            ? 'bg-background text-foreground shadow-xs'
                            : 'text-muted-on-muted hover:text-foreground',
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
