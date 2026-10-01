import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { discardPendingWrites, loadPendingWrites, replayPendingWrites } from '@/lib/pending-writes';
import { isSessionExpired } from '@/lib/session-expired';
import { useEffect, useState } from 'react';

const GUEST_PATHS = /^\/(login|register|forgot-password|reset-password|two-factor-challenge|email|confirm-password)/;

/** After logging back in, offers to send the entries that couldn't be saved when the session expired. */
export function RestoreUnsavedDialog() {
    const [count, setCount] = useState(0);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!GUEST_PATHS.test(window.location.pathname)) setCount(loadPendingWrites().length);
    }, []);

    async function restore() {
        setBusy(true);
        const result = await replayPendingWrites();
        setBusy(false);
        if (result.remaining > 0) {
            setCount(result.remaining);
            setMessage(`${result.restored} saved. ${result.remaining} could not be sent yet. Check your connection and try again.`);
            return;
        }
        window.location.reload(); // show the restored data
    }

    function discard() {
        discardPendingWrites();
        setCount(0);
    }

    return (
        <AlertDialog open={count > 0 && !isSessionExpired()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{count === 1 ? '1 entry was not saved' : `${count} entries were not saved`}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {message ?? 'They could not be saved when your session expired. Restore them now, or discard them if you no longer need them.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy} onClick={discard}>
                        Discard
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={busy}
                        onClick={(e) => {
                            e.preventDefault(); // keep the dialog open while sending
                            void restore();
                        }}
                    >
                        {busy ? 'Restoring…' : 'Restore'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
