import { Head, Link, router } from '@inertiajs/react';
import {
    IconArrowLeft,
    IconCheck,
    IconGitMerge,
    IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';

import AppLayout from '@/layouts/app-layout';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
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

/* =========================
   Types
========================= */

interface Conflict {
    id: number;
    table_name: string;
    local_record_id: number;
    remote_record_id: number;
    local_data: Record<string, unknown>;
    remote_data: Record<string, unknown>;
    conflict_fields: string[];
    resolution_status: string;
    resolved_at: string | null;
    resolution_notes: string | null;
    merged_data: Record<string, unknown> | null;
    created_at: string;
    client_identifier: string | null;
    resolved_by?: { name: string } | null;
}

interface Diff {
    [field: string]: {
        local: unknown;
        remote: unknown;
    };
}

interface Props {
    conflict: Conflict;
    diff: Diff;
}

/* =========================
   Component
========================= */

export default function ConflictDetail({ conflict, diff }: Props) {
    const [showResolveDialog, setShowResolveDialog] = useState(false);
    const [resolveAction, setResolveAction] = useState('');
    const [notes, setNotes] = useState('');
    const [processing, setProcessing] = useState(false);

    const [mergedData, setMergedData] = useState<Record<string, unknown>>(() => {
        const merged: Record<string, unknown> = { ...conflict.remote_data };
        conflict.conflict_fields.forEach((field) => {
            merged[field] = conflict.local_data[field];
        });
        return merged;
    });

    const isPending = conflict.resolution_status === 'pending';

    /* =========================
       Helpers
    ========================= */

    const getTableDisplayName = (table: string) => {
        const map: Record<string, string> = {
            tension_records: 'Tension Records',
            twisting_measurements: 'Twisting Measurements',
            weaving_measurements: 'Weaving Measurements',
            tension_problems: 'Tension Problems',
            stock_taking_records: 'Stock Taking Records',
            finish_earlier_records: 'Finish Earlier Records',
        };
        return map[table] ?? table;
    };

    const formatValue = (value: unknown): string => {
        if (value === null || value === undefined) return '(null)';
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        return String(value);
    };

    const formatDate = (date: string | null) =>
        date ? new Date(date).toLocaleString() : '-';

    const getStatusBadge = (status: string) => {
        const variants: Record<
            string,
            'destructive' | 'default' | 'secondary' | 'outline'
        > = {
            pending: 'destructive',
            local_wins: 'default',
            remote_wins: 'default',
            merged: 'secondary',
            dismissed: 'outline',
        };

        const labels: Record<string, string> = {
            pending: 'Pending Resolution',
            local_wins: 'Resolved - Local Wins',
            remote_wins: 'Resolved - Remote Wins',
            merged: 'Resolved - Merged',
            dismissed: 'Dismissed',
        };

        return (
            <Badge variant={variants[status] ?? 'default'}>
                {labels[status] ?? status}
            </Badge>
        );
    };

    /* =========================
       Merge handling
    ========================= */

    const updateMergedField = (field: string, value: string) => {
        let parsed: unknown = value;

        try {
            if (value.startsWith('{') || value.startsWith('[')) {
                parsed = JSON.parse(value);
            }
        } catch {
            parsed = value;
        }

        setMergedData((prev) => ({
            ...prev,
            [field]: parsed,
        }));
    };

    /* =========================
       Resolve
    ========================= */

    const handleResolve = (action: string) => {
        setResolveAction(action);
        setShowResolveDialog(true);
    };

    const confirmResolve = () => {
        setProcessing(true);

        const payload: {
            resolution: string;
            notes: string;
            merged_data?: string;
        } = {
            resolution: resolveAction,
            notes,
        };

        if (resolveAction === 'merged') {
            payload.merged_data = JSON.stringify(mergedData);
        }

        router.post(
            `/admin/data-sync/conflicts/${conflict.id}/resolve`,
            payload,
            {
                onSuccess: () => setShowResolveDialog(false),
                onFinish: () => setProcessing(false),
            }
        );
    };

    /* =========================
       Render
    ========================= */

    return (
        <AppLayout>
            <Head title={`Conflict #${conflict.id}`} />

            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/admin/data-sync/conflicts">
                                <IconArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold">
                                Conflict #{conflict.id}
                            </h1>
                            <p className="text-muted-foreground">
                                {getTableDisplayName(conflict.table_name)} •
                                Created {formatDate(conflict.created_at)}
                            </p>
                        </div>
                    </div>
                    {getStatusBadge(conflict.resolution_status)}
                </div>

                {/* Comparison */}
                <Card>
                    <CardHeader>
                        <CardTitle>Data Comparison</CardTitle>
                        <CardDescription>
                            Local vs Remote values
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="diff">
                            <TabsList>
                                <TabsTrigger value="diff">Diff</TabsTrigger>
                                <TabsTrigger value="local">Local</TabsTrigger>
                                <TabsTrigger value="remote">Remote</TabsTrigger>
                                {isPending && (
                                    <TabsTrigger value="merge">
                                        Merge
                                    </TabsTrigger>
                                )}
                            </TabsList>

                            <TabsContent value="diff" className="mt-4">
                                {Object.entries(diff).map(([field, v]) => (
                                    <div
                                        key={field}
                                        className="border rounded-lg p-4 mb-4"
                                    >
                                        <Label className="font-bold">
                                            {field}
                                        </Label>
                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                            <pre className="bg-blue-50 p-2 rounded text-sm">
                                                {formatValue(v.local)}
                                            </pre>
                                            <pre className="bg-green-50 p-2 rounded text-sm">
                                                {formatValue(v.remote)}
                                            </pre>
                                        </div>
                                    </div>
                                ))}
                            </TabsContent>

                            {isPending && (
                                <TabsContent value="merge" className="mt-4">
                                    {conflict.conflict_fields.map((field) => (
                                        <div key={field} className="mb-4">
                                            <Label>{field}</Label>
                                            <Textarea
                                                className="font-mono"
                                                rows={3}
                                                value={formatValue(
                                                    mergedData[field]
                                                )}
                                                onChange={(e) =>
                                                    updateMergedField(
                                                        field,
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                    ))}
                                </TabsContent>
                            )}
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Actions */}
                {isPending && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resolve</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-4 gap-4">
                            <Button
                                variant="outline"
                                onClick={() => handleResolve('local_wins')}
                            >
                                <IconCheck className="mr-2" />
                                Local
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleResolve('remote_wins')}
                            >
                                <IconCheck className="mr-2" />
                                Remote
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleResolve('merged')}
                            >
                                <IconGitMerge className="mr-2" />
                                Merge
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleResolve('dismissed')}
                            >
                                <IconTrash className="mr-2" />
                                Dismiss
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Confirm Dialog */}
            <AlertDialog
                open={showResolveDialog}
                onOpenChange={setShowResolveDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Confirm Resolution
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to resolve this conflict?
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <Textarea
                        placeholder="Resolution notes (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={processing}
                            onClick={confirmResolve}
                        >
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
