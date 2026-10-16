import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FieldProps {
    id: string;
    label: React.ReactNode;
    value: string;
    onChange?: (value: string) => void;
    /** Changed since the last save: shown with a yellow background. */
    dirty?: boolean;
    help?: string;
    error?: string | null;
    mono?: boolean;
    placeholder?: string;
    className?: string;
}

/** A labelled text input; read-only when it has no onChange. */
export function Field({
    id,
    label,
    value,
    onChange,
    dirty,
    help,
    error,
    mono,
    placeholder,
    className,
}: FieldProps) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
            <Label htmlFor={id} className="text-xs text-muted-foreground">
                {label}
            </Label>
            <Input
                id={id}
                value={value}
                readOnly={!onChange}
                placeholder={placeholder}
                aria-invalid={error ? true : undefined}
                aria-describedby={error || help ? `${id}-msg` : undefined}
                className={cn(
                    'h-8',
                    mono && 'font-mono',
                    dirty && 'bg-amber-50 dark:bg-amber-500/10',
                    !onChange && 'bg-muted',
                )}
                onChange={
                    onChange ? (e) => onChange(e.target.value) : undefined
                }
            />
            {(error || help) && (
                <span
                    id={`${id}-msg`}
                    className={cn(
                        'text-xs',
                        error ? 'text-destructive' : 'text-muted-foreground',
                    )}
                >
                    {error ?? help}
                </span>
            )}
        </div>
    );
}
