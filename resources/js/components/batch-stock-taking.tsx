'use client';

import { BarcodeScanner } from '@/components/barcode-scanning';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    AlertCircle,
    ArrowLeft,
    Barcode,
    CheckCircle2,
    Loader2,
    Search,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

export default function BatchStockTakingForm() {
    // Session management
    const [sessionId, setSessionId] = useState('');
    const [sessionSelected, setSessionSelected] = useState(false);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [sessionError, setSessionError] = useState<string | null>(null);

    // Batch lookup
    const [batchNumber, setBatchNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const [showRecordingModal, setShowRecordingModal] = useState(false);
    const [currentBatchData, setCurrentBatchData] = useState<any>(null);
    const [actualWeight, setActualWeight] = useState('');
    const [totalBobbins, setTotalBobbins] = useState('');
    const [linePosition, setLinePosition] = useState('');
    const [rowPosition, setRowPosition] = useState('');
    const [recordingError, setRecordingError] = useState<string | null>(null);
    const [recordingLoading, setRecordingLoading] = useState(false);
    const [explanation, setExplanation] = useState("");
    const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

    // Handle session ID fetch
    const handleSessionFetch = async () => {
        setSessionError(null);

        // Validate input
        if (!sessionId.trim()) {
            setSessionError('Please enter a session ID');
            return;
        }

        setSessionLoading(true);

        try {
            // API call to validate and fetch session data
            // Expected endpoint: GET /api/batch-stock-taking/session?session_id=${sessionId}
            // Response: { success: boolean, data: { metadata, indv_batch_data }, message?: string }

            console.log('Validating session ID:', sessionId);

            // Simulated API call
            const response = await fetch(
                `/stock-take-records/session/${encodeURIComponent(sessionId)}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                },
            );

            if (!response.ok) {
                throw new Error('Failed to fetch session');
            }

            const data = await response.json();

            if (data.success) {
                console.log(data.message);
                setSessionSelected(true);
            } else {
                setSessionError(data.message || 'Session not found');
            }
        } catch (err) {
            setSessionError('Failed to validate session. Please try again.');
            console.error('Error fetching session:', err);
        } finally {
            setSessionLoading(false);
        }
    };

    // Handle batch fetch
    const handleBatchFetch = async () => {
        setError(null);
        setSuccess(false);

        // Validate input
        if (!batchNumber.trim()) {
            setError('Please enter a batch number');
            return;
        }

        setLoading(true);

        try {
            // API call to check batch existence
            console.log(
                'Checking batch:',
                batchNumber,
                'for session:',
                sessionId,
            );

            const params = new URLSearchParams({
                record_key: sessionId.toString(),
                batch: batchNumber.toString(),
            });

            const response = await fetch(
                `/stock-take-records/check-batch?${params.toString()}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                },
            );

            if (!response.ok) {
                throw new Error('Failed to check batch');
            }

            const data = await response.json();
            console.log('Batch check response:', data);

            if (!data.exists) {
                setError(data.message || 'Batch not found in this session');
                return;
            }

            // Handle if the batch was already recorded
            if (data.already_recorded) {
                setSuccess(true);
                setSuccessMessage(data.message || 'Batch already recorded.');
                setShowRecordingModal(false);
                setCurrentBatchData(null);
                setBatchNumber('');
                return;
            }

            // Otherwise, open the recording modal for a valid batch
            setSuccess(true);
            setSuccessMessage(
                data.message || 'Batch found and ready to record.',
            );

            const batch = data.batch_data;

            // Normalize keys (handles both formats)
            const normalizedBatch = {
                batch_number: batch.batch_number ?? batch['Batch Number'] ?? '',
                material_code:
                    batch.material_code ?? batch['Material Code'] ?? '',
                material_description:
                    batch.material_description ??
                    batch['Material Desciption'] ??
                    '',
            };

            console.log('Normalized batch data:', normalizedBatch);

            setCurrentBatchData(normalizedBatch);
            setShowRecordingModal(true);
            setActualWeight(batch.weight ?? '');
            setTotalBobbins(batch.bobbin_qty ?? '');
            setLinePosition('');
            setRowPosition('');
            setExplanation("");
            setRecordingError(null);
        } catch (err) {
            setError('Failed to check batch. Please try again.');
            console.error('Error checking batch:', err);
        } finally {
            setLoading(false);
        }
    };

    // Handle batch recording submission
    const handleRecordingSubmit = async () => {
        setRecordingError(null);

        // Validate inputs
        if (!actualWeight.trim()) {
            setRecordingError('Please enter actual weight');
            return;
        }

        if (!totalBobbins.trim()) {
            setRecordingError('Please enter total bobbins');
            return;
        }

        // if (!linePosition.trim()) {
        //     setRecordingError('Please enter line number');
        //     return;
        // }

        // if (!rowPosition.trim()) {
        //     setRecordingError('Please enter row number');
        //     return;
        // }

        // if (!explanation.trim()) {
        // setRecordingError("Please enter an explanation")
        // return
        // }

        // Validate numeric values
        const weight = Number.parseFloat(actualWeight);
        const bobbins = Number.parseInt(totalBobbins, 10);
        const line = Number.parseInt(linePosition, 10);

        if (isNaN(weight) || weight <= 0) {
            setRecordingError('Actual weight must be a valid positive number');
            return;
        }

        if (isNaN(bobbins) || bobbins <= 0) {
            setRecordingError('Total bobbins must be a valid positive number');
            return;
        }

        // if (isNaN(line) || line <= 0) {
        //     setRecordingError('Line number must be a valid positive number');
        //     return;
        // }


        setRecordingLoading(true);

        try {
            // Get current user (placeholder - adjust based on your auth system)
            const currentUser =
                localStorage.getItem('current-user') || 'Unknown User';

            const recordData = {
                session_id: sessionId,
                batch_number: currentBatchData.batch_number,
                material_code: currentBatchData.material_code,
                material_description: currentBatchData.material_description,
                actual_weight: weight,
                total_bobbins: bobbins,
                line_position: line,
                row_position: rowPosition,
                explanation: explanation.trim(),
                found_by: currentUser,
                found_at: new Date().toISOString(),
            };

            console.log('Submitting batch record:', recordData);

            const tokenRes = await fetch('/csrf-token', {
                credentials: 'include',
            });
            const { csrfToken } = await tokenRes.json();
            console.log('Extracted CSRF Token from cookie:', csrfToken);
            // API call to save batch record
            const response = await fetch('/stock-take-records/record-batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify(recordData),
            });

            if (!response.ok) {
                throw new Error('Failed to record batch');
            }

            const data = await response.json();

            if (data.success) {
                console.log('Batch recorded successfully:', data.data);
                setShowRecordingModal(false);
                setSuccess(true);
                setSuccessMessage('Batch recorded successfully!');
                setBatchNumber('');
                setActualWeight('');
                setTotalBobbins('');
                setLinePosition('');
                setRowPosition('');
                setExplanation("") // Reset explanation
            } else {
                setRecordingError(data.message || 'Failed to record batch');
            }
        } catch (err) {
            setRecordingError('Failed to record batch. Please try again.');
            console.error('Error recording batch:', err);
        } finally {
            setRecordingLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (!sessionSelected) {
                handleSessionFetch();
            } else {
                handleBatchFetch();
            }
        }
    };

    const handleBackToSession = () => {
        setSessionSelected(false);
        setBatchNumber('');
        setError(null);
        setSuccess(false);
        setLinePosition('');
        setRowPosition('');
        setExplanation("") // Reset explanation
    };

    const handleBarcodeScan = (scannedBarcode: string) => {
        setBatchNumber(scannedBarcode);
        setShowBarcodeScanner(false);
        // Automatically fetch the batch after a short delay to ensure state is updated
        setTimeout(() => {
            handleBatchFetch();
        }, 100);
    };

    // Session Selection UI
    if (!sessionSelected) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-2">
                <Card className="mx-auto w-full max-w-sm shadow-lg">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-center text-lg font-semibold">
                            Session Selection
                        </CardTitle>
                        <p className="mt-1 text-center text-xs text-muted-foreground">
                            Enter your session ID to begin stock taking
                        </p>
                        <Separator className="mt-3" />
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {/* Session ID Input */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="session-id"
                                className="text-sm font-medium text-foreground"
                            >
                                Session ID
                            </Label>
                            <Input
                                id="session-id"
                                type="text"
                                placeholder="Enter session ID..."
                                value={sessionId}
                                onChange={(e) => setSessionId(e.target.value)}
                                onKeyPress={handleKeyPress}
                                disabled={sessionLoading}
                                className="h-10 text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                e.g., 123456, 567890, etc.
                            </p>
                        </div>

                        {/* Error Message */}
                        {sessionError && (
                            <div className="flex gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                <span>{sessionError}</span>
                            </div>
                        )}

                        {/* Fetch Button */}
                        <Button
                            onClick={handleSessionFetch}
                            disabled={sessionLoading || !sessionId.trim()}
                            className="h-10 w-full text-sm font-medium"
                        >
                            {sessionLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading Session...
                                </>
                            ) : (
                                <>
                                    <Search className="mr-2 h-4 w-4" />
                                    Load Session
                                </>
                            )}
                        </Button>

                        {/* Info Section */}
                        <div className="pt-2">
                            <Separator />
                            <div className="mt-3 rounded-lg bg-muted/50 p-3">
                                <p className="text-xs text-muted-foreground">
                                    <strong>Instructions:</strong> Enter your
                                    session ID to load the batch data for this
                                    stock taking session. You will then be able
                                    to look up and record individual batches.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Batch Lookup UI
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-2">
            <Card className="mx-auto w-full max-w-sm shadow-lg">
                <CardHeader className="pb-3">
                    <div className="mb-2 flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold">
                            Batch Stock Taking
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleBackToSession}
                            className="h-8 w-8 p-0"
                            title="Back to session selection"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-md text-muted-foreground">
                        Session ID: {sessionId}
                    </p>
                    <Separator className="mt-3" />
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Batch Number Input */}
                    <div className="space-y-2">
                        <Label
                            htmlFor="batch-number"
                            className="text-sm font-medium text-foreground"
                        >
                            Batch Number
                        </Label>
                        <Input
                            id="batch-number"
                            type="text"
                            placeholder="Enter batch number..."
                            value={batchNumber}
                            onChange={(e) => setBatchNumber(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={loading}
                            className="h-10 text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            e.g., TAXXXXXX, 000XXXXX, LTXXXXXXX etc.
                        </p>
                    </div>

                    <Button
                        variant="outline"
                        onClick={() => setShowBarcodeScanner(true)}
                        disabled={loading}
                        className="h-10 w-full text-sm font-medium"
                    >
                        <Barcode className="mr-2 h-4 w-4" />
                        Scan Barcode
                    </Button>

                    {/* Error Message */}
                    {error && (
                        <div className="flex gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="flex gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* Fetch Button */}
                    <Button
                        onClick={handleBatchFetch}
                        disabled={loading || !batchNumber.trim()}
                        className="h-10 w-full text-sm font-medium"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            <>
                                <Search className="mr-2 h-4 w-4" />
                                Fetch Batch
                            </>
                        )}
                    </Button>

                    {/* Info Section */}
                    <div className="pt-2">
                        <Separator />
                        <div className="mt-3 rounded-lg bg-muted/50 p-3">
                            <p className="text-xs text-muted-foreground">
                                <strong>Instructions:</strong> Enter the batch
                                number you want to check and record. The system
                                will verify it exists in the current session
                                before proceeding.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <BarcodeScanner
                open={showBarcodeScanner}
                onClose={() => setShowBarcodeScanner(false)}
                onScan={handleBarcodeScan}
            />

            <Dialog
                open={showRecordingModal}
                onOpenChange={setShowRecordingModal}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Record Batch Details</DialogTitle>
                        <DialogDescription>
                            Enter the actual weight and total bobbins.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Batch Info Display */}
                        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                            <div className="text-sm">
                                <span className="font-medium text-foreground">
                                    Material Code:
                                </span>
                                <span className="ml-2 text-muted-foreground">
                                    {currentBatchData?.material_code}
                                </span>
                            </div>
                            <div className="text-sm">
                                <span className="font-medium text-foreground">
                                    Description:
                                </span>
                                <span className="ml-2 text-muted-foreground">
                                    {currentBatchData?.material_description}
                                </span>
                            </div>
                            <div className="text-sm">
                                <span className="font-medium text-foreground">
                                    Batch Number:
                                </span>
                                <span className="ml-2 text-muted-foreground">
                                    {currentBatchData?.batch_number}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Actual Weight Input */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="actual-weight"
                                    className="text-sm font-medium"
                                >
                                    Actual Weight
                                </Label>
                                <Input
                                    id="actual-weight"
                                    type="number"
                                    placeholder="Enter actual weight..."
                                    value={actualWeight}
                                    onChange={(e) =>
                                        setActualWeight(e.target.value)
                                    }
                                    disabled={recordingLoading}
                                    className="h-10 text-sm"
                                    step="0.01"
                                />
                                <p className="text-xs text-muted-foreground">
                                    e.g., 25.5, 100.25
                                </p>
                            </div>
                            {/* Total Bobbins Input */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="total-bobbins"
                                    className="text-sm font-medium"
                                >
                                    Total Bobbins
                                </Label>
                                <Input
                                    id="total-bobbins"
                                    type="number"
                                    placeholder="Enter total bobbins..."
                                    value={totalBobbins}
                                    onChange={(e) =>
                                        setTotalBobbins(e.target.value)
                                    }
                                    disabled={recordingLoading}
                                    className="h-10 text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    e.g., 10, 25, 50
                                </p>
                            </div>
                        </div>
                        {/* Line and Row Inputs */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="line-number"
                                    className="text-sm font-medium"
                                >
                                    Line Number
                                </Label>
                                <Input
                                    id="line-number"
                                    type="number"
                                    placeholder="Enter line..."
                                    value={linePosition}
                                    onChange={(e) =>
                                        setLinePosition(e.target.value)
                                    }
                                    disabled={recordingLoading}
                                    className="h-10 text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    e.g., 1, 2, 3
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="row-number"
                                    className="text-sm font-medium"
                                >
                                    Row Number
                                </Label>
                                <Input
                                    id="row-number"
                                    type="text"
                                    placeholder="Enter row..."
                                    value={rowPosition}
                                    onChange={(e) =>
                                        setRowPosition(e.target.value)
                                    }
                                    disabled={recordingLoading}
                                    className="h-10 text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    e.g., A, B, C 
                                </p>
                            </div>
                        </div>

                        {/* Explanation Input Field */}
            <div className="space-y-2">
              <Label htmlFor="explanation" className="text-sm font-medium">
                Explanation
              </Label>
              <textarea
                id="explanation"
                placeholder="Enter any notes or explanation for this batch..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                disabled={recordingLoading}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background border-input placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-20 resize-none"
              />
              <p className="text-xs text-muted-foreground">e.g., Batch found in storage area B, condition noted</p>
            </div>

                        {/* Recording Error */}
                        {recordingError && (
                            <div className="flex gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                <span>{recordingError}</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowRecordingModal(false)}
                            disabled={recordingLoading}
                            className="h-10"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRecordingSubmit}
                            disabled={
                                recordingLoading ||
                                !actualWeight.trim() ||
                                !totalBobbins.trim() 
                            }
                            className="h-10"
                        >
                            {recordingLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Recording...
                                </>
                            ) : (
                                'Submit'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
