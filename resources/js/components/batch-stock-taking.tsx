'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    AlertCircle,
    ArrowLeft,
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
                console.log('Session data loaded:', data.data);
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
            // Expected endpoint: GET /api/batch-stock-taking/check-batch?session_id=${sessionId}&batch_number=${batchNumber}
            // Response: { exists: boolean, batch_data?: {...}, message: string }

            console.log(
                'Checking batch:',
                batchNumber,
                'for session:',
                sessionId,
            );
            const baseUrl = window.location.origin;
            const params = new URLSearchParams({
                session_id: sessionId.toString(),
                batch_number:batchNumber.toString(),
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

            if (data.exists) {
                setSuccess(true);
                setSuccessMessage(data.message || 'Batch exists');
                console.log('Batch data:', data.batch_data);
                // TODO: Navigate to batch recording page with batch data
            } else {
                setError(data.message || 'Batch not found in this session');
            }
        } catch (err) {
            setError('Failed to check batch. Please try again.');
            console.error('Error checking batch:', err);
        } finally {
            setLoading(false);
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
                                e.g., SESSION-2024-001, ST-12345, etc.
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
                    <p className="text-xs text-muted-foreground">
                        Session: {sessionId}
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
                            e.g., BATCH-2024-001, BTH-12345, etc.
                        </p>
                    </div>

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
        </div>
    );
}
