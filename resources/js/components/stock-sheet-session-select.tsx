import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { freshStockSheet, loadActiveStockSheet, saveActiveStockSheet, stockSheetApi, type StockSheetActiveSheet } from '@/lib/stock-sheets';
import { stockSheetMain } from '@/routes';
import { type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { FilePlusIcon, LogInIcon } from 'lucide-react';
import { useState } from 'react';

/** The front door for the Stock Sheet: start a fresh sheet, or resume one already in progress on another
 *  device by its session ID. Reached on a first/direct visit to the record page (nothing loaded yet) or
 *  explicitly via "Change session" there — once a sheet is active, normal navigation goes straight to the grid. */
export default function StockSheetSessionSelect() {
    const { auth } = usePage<SharedData>().props;
    const [current] = useState<StockSheetActiveSheet | null>(() => loadActiveStockSheet());
    const [confirmNew, setConfirmNew] = useState(false);
    const [sessionInput, setSessionInput] = useState('');
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const rowCount = current?.rows.length ?? 0;

    const startNew = () => {
        saveActiveStockSheet(freshStockSheet(auth.user.name));
        router.visit(stockSheetMain());
    };

    const loadSession = async () => {
        const id = sessionInput.trim();
        if (!id) return setSessionError('Enter a session ID.');
        setLoading(true);
        setSessionError(null);
        try {
            const s = await stockSheetApi.getSession(id);
            saveActiveStockSheet({ uuid: crypto.randomUUID(), sessionId: s.session_id, date: s.sheet_date.slice(0, 10), leader: s.leader, rows: s.rows });
            router.visit(stockSheetMain());
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
                    <CardDescription>Begin a fresh stock sheet for {auth.user.name}.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => (rowCount > 0 ? setConfirmNew(true) : startNew())}>
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
                            <Label htmlFor="ss-session">Session ID</Label>
                            <Input id="ss-session" placeholder="e.g. 483920" value={sessionInput} onChange={(e) => setSessionInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void loadSession()} />
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
                        <AlertDialogDescription>The {rowCount} rows on the current sheet are already saved. You will begin an empty sheet.</AlertDialogDescription>
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
