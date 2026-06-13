import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

export type SaveStepStatus = 'pending' | 'active' | 'done' | 'error';

export interface SaveStep {
    key: string;
    label: string;
    status: SaveStepStatus;
}

interface SaveStatusDialogProps {
    open: boolean;
    status: 'saving' | 'success' | 'error';
    steps: SaveStep[];
    errorMessage?: string;
    errorDetails?: string;
    onRetry?: () => void;
    onClose: () => void;
}

function StepIcon({ status }: { status: SaveStepStatus }) {
    switch (status) {
        case 'done':
            return (
                <CheckCircle2 className="h-5 w-5 text-green-600 duration-300 animate-in zoom-in fade-in" />
            );
        case 'active':
            return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
        case 'error':
            return <XCircle className="h-5 w-5 text-red-600" />;
        default:
            return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
}

export function SaveStatusDialog({
    open,
    status,
    steps,
    errorMessage,
    errorDetails,
    onRetry,
    onClose,
}: SaveStatusDialogProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!errorDetails) return;
        try {
            await navigator.clipboard.writeText(errorDetails);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy error details:', err);
        }
    };

    const title =
        status === 'saving'
            ? 'Saving Measurement Data'
            : status === 'success'
              ? 'Data Saved Successfully'
              : 'Save Failed';

    const description =
        status === 'saving'
            ? 'Please wait while your measurement data is saved to the database.'
            : status === 'success'
              ? 'Your measurement data has been saved and verified.'
              : 'Something went wrong while saving your measurement data.';

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next && status !== 'saving') onClose();
            }}
        >
            <DialogContent
                className="sm:max-w-md"
                showCloseButton={status !== 'saving'}
                onInteractOutside={(e) => {
                    if (status === 'saving') e.preventDefault();
                }}
                onEscapeKeyDown={(e) => {
                    if (status === 'saving') e.preventDefault();
                }}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    {steps.map((step) => (
                        <div
                            key={step.key}
                            className="flex items-center gap-3"
                        >
                            <StepIcon status={step.status} />
                            <span
                                className={
                                    step.status === 'error'
                                        ? 'text-sm text-red-600'
                                        : step.status === 'pending'
                                          ? 'text-sm text-muted-foreground'
                                          : 'text-sm text-foreground'
                                }
                            >
                                {step.label}
                            </span>
                        </div>
                    ))}
                </div>

                {status === 'error' && (
                    <div className="space-y-2">
                        {errorMessage && (
                            <p className="text-sm text-red-600">
                                {errorMessage}
                            </p>
                        )}
                        {errorDetails && (
                            <>
                                <Textarea
                                    readOnly
                                    value={errorDetails}
                                    className="h-28 font-mono text-xs"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Copy these details and share them with
                                    your administrator.
                                </p>
                            </>
                        )}
                    </div>
                )}

                {status !== 'saving' && (
                    <DialogFooter>
                        {status === 'error' && errorDetails && (
                            <Button variant="outline" onClick={handleCopy}>
                                {copied ? 'Copied!' : 'Copy Error Details'}
                            </Button>
                        )}
                        {status === 'error' && onRetry && (
                            <Button variant="outline" onClick={onRetry}>
                                Retry
                            </Button>
                        )}
                        {status === 'error' && (
                            <Button onClick={onClose}>Close</Button>
                        )}
                        {status === 'success' && (
                            <Button onClick={onClose}>Done</Button>
                        )}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
