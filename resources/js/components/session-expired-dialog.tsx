import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { isSessionExpired, subscribeSessionExpired } from '@/lib/session-expired';
import { LogInIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';

/** Blocks the page once the login has expired, so the user knows why saves are failing. */
export function SessionExpiredDialog() {
    const expired = useSyncExternalStore(subscribeSessionExpired, isSessionExpired, () => false);

    return (
        <AlertDialog open={expired}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <LogInIcon className="h-5 w-5 text-destructive" />
                        Your session has expired
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        You were signed out, so your last change was not saved. Log in again to continue, then re-enter anything you had not saved.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => window.location.assign('/login')}>Log in again</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
