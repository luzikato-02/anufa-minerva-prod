import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { freshTorqueSheet, loadActiveTorqueSheet, saveActiveTorqueSheet, torqueCheckApi, torquePosition, type TorqueActiveSheet } from '@/lib/torque-checks';
import { torqueCheckMain } from '@/routes';
import { type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { FilePlusIcon, LogInIcon } from 'lucide-react';
import { useState } from 'react';

/** The front door for Torque Check: start a fresh sheet, or resume one already in progress on another device
 *  by its session ID. Reached on a first/direct visit to the record page (nothing loaded yet) or explicitly via
 *  "Change session" there — once a sheet is active, normal navigation goes straight to the grid. */
export default function TorqueCheckSessionSelect() {
    const { auth } = usePage<SharedData>().props;
    const [current] = useState<TorqueActiveSheet | null>(() => loadActiveTorqueSheet());
    const [confirmNew, setConfirmNew] = useState(false);
    const [sessionInput, setSessionInput] = useState('');
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const filledCount = current ? Object.keys(current.readings).length : 0;

    const startNew = () => {
        saveActiveTorqueSheet(freshTorqueSheet(auth.user.name));
        router.visit(torqueCheckMain());
    };

    const loadSession = async () => {
        const id = sessionInput.trim();
        if (!id) return setSessionError('Enter a session ID.');
        setLoading(true);
        setSessionError(null);
        try {
            const s = await torqueCheckApi.getSession(id);
            saveActiveTorqueSheet({
                uuid: crypto.randomUUID(),
                sessionId: s.session_id,
                checkDate: s.check_date.slice(0, 10),
                operatorName: s.operator_name,
                machineNumber: s.machine_number,
                creelTypeId: s.creel_type_id,
                readings: Object.fromEntries(s.readings.map((r) => [torquePosition(r.side, r.row_no, r.column_letter), { clientUuid: String(r.id), value: r.value, note: r.note ?? '' }])),
            });
            router.visit(torqueCheckMain());
        } catch (e) {
            setSessionError((e as Error).message === 'Session not found' ? `Session "${id}" was not found.` : (e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
            <Card>
                <CardHeader>
                    <CardTitle>Start a new sheet</CardTitle>
                    <CardDescription>Begin a fresh torque check for {auth.user.name}.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => (filledCount > 0 ? setConfirmNew(true) : startNew())}>
                        <FilePlusIcon /> Start new sheet
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Resume a session</CardTitle>
                    <CardDescription>Have a session ID from another device? Enter it to keep recording into that sheet.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {sessionError && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{sessionError}</AlertDescription>
                        </Alert>
                    )}
                    <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1.5">
                            <Label htmlFor="tc-session">Session ID</Label>
                            <Input id="tc-session" placeholder="e.g. 483920" value={sessionInput} onChange={(e) => setSessionInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void loadSession()} />
                        </div>
                        <Button onClick={() => void loadSession()} disabled={loading}>
                            <LogInIcon /> {loading ? 'Loading…' : 'Load'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={confirmNew} onOpenChange={setConfirmNew}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Start a new sheet?</AlertDialogTitle>
                        <AlertDialogDescription>The {filledCount} readings on the current sheet are already saved. You will begin an empty sheet.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={startNew}>Start new sheet</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
