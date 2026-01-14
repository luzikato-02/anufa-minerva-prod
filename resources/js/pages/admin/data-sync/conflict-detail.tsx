import { Head, Link, router, useForm } from '@inertiajs/react';
import { IconArrowLeft, IconCheck, IconX, IconGitMerge, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export default function ConflictDetail({ conflict, diff }: Props) {
    const [showResolveDialog, setShowResolveDialog] = useState(false);
    const [resolveAction, setResolveAction] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [mergedData, setMergedData] = useState<Record<string, unknown>>(() => {
        // Initialize merged data with remote data as base, then override with local for conflict fields
        const merged: Record<string, unknown> = { ...conflict.remote_data };
        conflict.conflict_fields.forEach(field => {
            merged[field] = conflict.local_data[field]; // Default to local values
        });
        return merged;
    });

    const { post, processing } = useForm();

    const getTableDisplayName = (tableName: string) => {
        const names: Record<string, string> = {
            tension_records: 'Tension Records',
            twisting_measurements: 'Twisting Measurements',
            weaving_measurements: 'Weaving Measurements',
            tension_problems: 'Tension Problems',
            stock_taking_records: 'Stock Taking Records',
            finish_earlier_records: 'Finish Earlier Records',
        };
        return names[tableName] || tableName;
    };

    const formatValue = (value: unknown): string => {
        if (value === null || value === undefined) return '(null)';
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        return String(value);
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString();
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
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
        return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
    };

    const handleResolve = (action: string) => {
        setResolveAction(action);
        setShowResolveDialog(true);
    };

    const confirmResolve = () => {
        const data: Record<string, unknown> = {
            resolution: resolveAction,
            notes: notes,
        };

        if (resolveAction === 'merged') {
            data.merged_data = mergedData;
        }

        router.post(`/admin/data-sync/conflicts/${conflict.id}/resolve`, data, {
            onSuccess: () => {
                setShowResolveDialog(false);
            },
        });
    };

    const updateMergedField = (field: string, value: string) => {
        // Try to parse as JSON if it looks like an object/array
        let parsedValue: unknown = value;
        try {
            if (value.startsWith('{') || value.startsWith('[')) {
                parsedValue = JSON.parse(value);
            }
        } catch {
            // Keep as string if parsing fails
        }
        setMergedData({ ...mergedData, [field]: parsedValue });
    };

    const isPending = conflict.resolution_status === 'pending';

    return (
        <AppLayout>
            <Head title={`Conflict #${conflict.id}`} />
            
            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/admin/data-sync/conflicts">
                                <IconArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Conflict #{conflict.id}</h1>
                            <p className="text-muted-foreground">
                                {getTableDisplayName(conflict.table_name)} • Created {formatDate(conflict.created_at)}
                            </p>
                        </div>
                    </div>
                    {getStatusBadge(conflict.resolution_status)}
                </div>

                {/* Conflict Info */}
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Conflict Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-muted-foreground">Table</Label>
                                    <p className="font-medium">{getTableDisplayName(conflict.table_name)}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Client Identifier</Label>
                                    <p className="font-mono text-sm">{conflict.client_identifier || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Local Record ID</Label>
                                    <p className="font-medium">{conflict.local_record_id}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Remote Record ID</Label>
                                    <p className="font-medium">{conflict.remote_record_id}</p>
                                </div>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Conflicting Fields</Label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {conflict.conflict_fields.map((field) => (
                                        <Badge key={field} variant="secondary">{field}</Badge>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {!isPending && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Resolution Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label className="text-muted-foreground">Resolved By</Label>
                                    <p className="font-medium">{conflict.resolved_by?.name || 'Unknown'}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Resolved At</Label>
                                    <p className="font-medium">{formatDate(conflict.resolved_at)}</p>
                                </div>
                                {conflict.resolution_notes && (
                                    <div>
                                        <Label className="text-muted-foreground">Notes</Label>
                                        <p className="text-sm">{conflict.resolution_notes}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Data Comparison */}
                <Card>
                    <CardHeader>
                        <CardTitle>Data Comparison</CardTitle>
                        <CardDescription>
                            Compare local (client) and remote (server) data side by side
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="diff">
                            <TabsList>
                                <TabsTrigger value="diff">Differences Only</TabsTrigger>
                                <TabsTrigger value="local">Full Local Data</TabsTrigger>
                                <TabsTrigger value="remote">Full Remote Data</TabsTrigger>
                                {isPending && <TabsTrigger value="merge">Merge Editor</TabsTrigger>}
                            </TabsList>

                            <TabsContent value="diff" className="mt-4">
                                <div className="space-y-4">
                                    {Object.entries(diff).map(([field, values]) => (
                                        <div key={field} className="border rounded-lg p-4">
                                            <Label className="font-bold text-lg mb-2 block">{field}</Label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-blue-50 dark:bg-blue-950 rounded-md p-3">
                                                    <Label className="text-sm text-blue-600 dark:text-blue-400">Local (Client)</Label>
                                                    <pre className="text-sm mt-1 whitespace-pre-wrap break-all">
                                                        {formatValue(values.local)}
                                                    </pre>
                                                </div>
                                                <div className="bg-green-50 dark:bg-green-950 rounded-md p-3">
                                                    <Label className="text-sm text-green-600 dark:text-green-400">Remote (Server)</Label>
                                                    <pre className="text-sm mt-1 whitespace-pre-wrap break-all">
                                                        {formatValue(values.remote)}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="local" className="mt-4">
                                <div className="bg-muted rounded-lg p-4">
                                    <pre className="text-sm whitespace-pre-wrap overflow-x-auto">
                                        {JSON.stringify(conflict.local_data, null, 2)}
                                    </pre>
                                </div>
                            </TabsContent>

                            <TabsContent value="remote" className="mt-4">
                                <div className="bg-muted rounded-lg p-4">
                                    <pre className="text-sm whitespace-pre-wrap overflow-x-auto">
                                        {JSON.stringify(conflict.remote_data, null, 2)}
                                    </pre>
                                </div>
                            </TabsContent>

                            {isPending && (
                                <TabsContent value="merge" className="mt-4">
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Edit the values below to create a merged record. Only conflicting fields are shown.
                                        </p>
                                        {conflict.conflict_fields.map((field) => (
                                            <div key={field} className="space-y-2">
                                                <Label>{field}</Label>
                                                <div className="grid grid-cols-3 gap-4 items-start">
                                                    <div className="space-y-1">
                                                        <span className="text-xs text-muted-foreground">Local</span>
                                                        <div className="bg-muted p-2 rounded text-sm">
                                                            {formatValue(conflict.local_data[field])}
                                                        </div>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => updateMergedField(field, formatValue(conflict.local_data[field]))}
                                                        >
                                                            Use Local →
                                                        </Button>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-xs text-muted-foreground">Merged Value</span>
                                                        <Textarea
                                                            value={formatValue(mergedData[field])}
                                                            onChange={(e) => updateMergedField(field, e.target.value)}
                                                            className="font-mono text-sm"
                                                            rows={3}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-xs text-muted-foreground">Remote</span>
                                                        <div className="bg-muted p-2 rounded text-sm">
                                                            {formatValue(conflict.remote_data[field])}
                                                        </div>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => updateMergedField(field, formatValue(conflict.remote_data[field]))}
                                                        >
                                                            ← Use Remote
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            )}
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Resolution Actions */}
                {isPending && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resolve Conflict</CardTitle>
                            <CardDescription>
                                Choose how to resolve this data conflict
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Button 
                                    onClick={() => handleResolve('local_wins')}
                                    variant="outline"
                                    className="h-auto flex-col py-4"
                                >
                                    <IconCheck className="h-6 w-6 mb-2 text-blue-500" />
                                    <span className="font-medium">Keep Local</span>
                                    <span className="text-xs text-muted-foreground">Use client data</span>
                                </Button>
                                <Button 
                                    onClick={() => handleResolve('remote_wins')}
                                    variant="outline"
                                    className="h-auto flex-col py-4"
                                >
                                    <IconCheck className="h-6 w-6 mb-2 text-green-500" />
                                    <span className="font-medium">Keep Remote</span>
                                    <span className="text-xs text-muted-foreground">Use server data</span>
                                </Button>
                                <Button 
                                    onClick={() => handleResolve('merged')}
                                    variant="outline"
                                    className="h-auto flex-col py-4"
                                >
                                    <IconGitMerge className="h-6 w-6 mb-2 text-purple-500" />
                                    <span className="font-medium">Merge Data</span>
                                    <span className="text-xs text-muted-foreground">Use edited values</span>
                                </Button>
                                <Button 
                                    onClick={() => handleResolve('dismissed')}
                                    variant="outline"
                                    className="h-auto flex-col py-4"
                                >
                                    <IconTrash className="h-6 w-6 mb-2 text-gray-500" />
                                    <span className="font-medium">Dismiss</span>
                                    <span className="text-xs text-muted-foreground">Ignore conflict</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Resolution Confirmation Dialog */}
            <AlertDialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
                <AlertDialogContent className="max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Resolution</AlertDialogTitle>
                        <AlertDialogDescription>
                            {resolveAction === 'local_wins' && 'The local (client) data will be applied to the server.'}
                            {resolveAction === 'remote_wins' && 'The remote (server) data will be kept. No changes will be made.'}
                            {resolveAction === 'merged' && 'The merged data you edited will be applied to the server.'}
                            {resolveAction === 'dismissed' && 'This conflict will be marked as dismissed without any data changes.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="notes">Resolution Notes (optional)</Label>
                            <Textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Add any notes about this resolution..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmResolve} disabled={processing}>
                            Confirm Resolution
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
