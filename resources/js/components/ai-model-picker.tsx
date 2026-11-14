import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { type ModelAccess, modelLabel } from '@/lib/ai-models';
import { cn } from '@/lib/utils';
import { LockIcon, ShieldAlertIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * Tells the user they may not use a model and that an admin can give them access. `model` null means the
 * account has no model enabled at all. Open while `model` is not undefined.
 */
export function ModelNotPermittedDialog({
    model,
    onClose,
}: {
    model: string | null | undefined;
    onClose: () => void;
}) {
    return (
        <AlertDialog
            open={model !== undefined}
            onOpenChange={(open) => !open && onClose()}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <ShieldAlertIcon className="size-5 text-destructive" />
                        {model
                            ? `You can't use ${modelLabel(model)}`
                            : 'No AI model is enabled for you'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {model
                            ? 'Your account is not allowed to use this model. '
                            : 'Your account is not allowed to use any AI model yet. '}
                        Contact your administrator and ask them to give you
                        permission in User Management.
                        {model &&
                            ' Until then, pick one of the models without a lock.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={onClose}>OK</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/**
 * The model picker every AI feature uses. It lists every model on offer; the ones the user isn't allowed
 * show a lock and open the "contact your admin" dialog instead of being selected.
 */
export function ModelPicker({
    access,
    value,
    onChange,
    disabled,
    className,
}: {
    access: ModelAccess | null;
    value: string | null;
    onChange: (model: string) => void;
    disabled?: boolean;
    className?: string;
}) {
    const [refused, setRefused] = useState<string | null | undefined>(
        undefined,
    );
    const models = access?.models ?? [];
    const allowed = new Set(access?.allowedModels ?? []);

    return (
        <>
            <Select
                value={value ?? undefined}
                onValueChange={(next) =>
                    allowed.has(next) ? onChange(next) : setRefused(next)
                }
                disabled={disabled || models.length === 0}
            >
                <SelectTrigger
                    aria-label="Model"
                    className={cn(
                        'h-7 w-auto gap-1 border-none px-2 text-xs shadow-none hover:bg-muted',
                        className,
                    )}
                >
                    <SelectValue
                        placeholder={
                            access === null
                                ? 'Loading models…'
                                : allowed.size === 0
                                  ? 'No model enabled'
                                  : 'Choose a model'
                        }
                    />
                </SelectTrigger>
                <SelectContent>
                    {models.map((id) => {
                        const locked = !allowed.has(id);
                        return (
                            <SelectItem
                                key={id}
                                value={id}
                                className={cn(
                                    'text-xs',
                                    locked && 'text-muted-foreground',
                                )}
                            >
                                <span className="flex items-center gap-1.5">
                                    {modelLabel(id)}
                                    {locked && (
                                        <LockIcon
                                            aria-label="Not allowed for your account"
                                            className="size-3"
                                        />
                                    )}
                                </span>
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
            <ModelNotPermittedDialog
                model={refused}
                onClose={() => setRefused(undefined)}
            />
        </>
    );
}
