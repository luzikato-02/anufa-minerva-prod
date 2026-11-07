import { type Density, useDensity } from '@/hooks/use-density';
import { cn } from '@/lib/utils';
import { Rows3, Rows4 } from 'lucide-react';

const OPTIONS: { value: Density; label: string; icon: typeof Rows3 }[] = [
    { value: 'compact', label: 'Compact', icon: Rows4 },
    { value: 'comfortable', label: 'Comfortable', icon: Rows3 },
];

/**
 * Segmented control for row density. `size="sm"` is the toolbar version;
 * the default size matches the appearance tabs in Settings.
 */
export function DensityToggle({
    size = 'default',
    className,
}: {
    size?: 'default' | 'sm';
    className?: string;
}) {
    const { density, updateDensity } = useDensity();
    const small = size === 'sm';

    return (
        <div
            role="group"
            aria-label="Row density"
            className={cn(
                'inline-flex gap-0.5 rounded-lg bg-muted p-0.5',
                className,
            )}
        >
            {OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = density === value;
                return (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => updateDensity(value)}
                        title={small ? `${label} rows` : undefined}
                        className={cn(
                            'flex items-center gap-1.5 rounded-md font-medium transition-colors',
                            small
                                ? 'h-6 px-2 text-xs'
                                : 'px-3.5 py-1.5 text-sm',
                            active
                                ? 'bg-background text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Icon className={small ? 'size-3.5' : 'size-4'} />
                        <span className={small ? 'sr-only sm:not-sr-only' : ''}>
                            {label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
