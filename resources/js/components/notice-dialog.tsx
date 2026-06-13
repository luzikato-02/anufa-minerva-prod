import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircleIcon, CheckCircle2Icon } from 'lucide-react';

export type NoticeVariant = 'success' | 'error';

export interface NoticeState {
    open: boolean;
    variant: NoticeVariant;
    title: string;
    description: string;
}

export const initialNoticeState: NoticeState = {
    open: false,
    variant: 'success',
    title: '',
    description: '',
};

interface NoticeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    variant: NoticeVariant;
    title: string;
    description: string;
}

export function NoticeDialog({
    open,
    onOpenChange,
    variant,
    title,
    description,
}: NoticeDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        {variant === 'success' ? (
                            <CheckCircle2Icon className="h-5 w-5 text-green-600" />
                        ) : (
                            <AlertCircleIcon className="h-5 w-5 text-destructive" />
                        )}
                        {title}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => onOpenChange(false)}>
                        OK
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
