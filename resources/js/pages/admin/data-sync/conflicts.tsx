import { Head, Link, router, useForm } from '@inertiajs/react';
import { IconAlertTriangle, IconCheck, IconEye, IconFilter, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
    created_at: string;
    resolved_by?: { name: string } | null;
}

interface TableStat {
    table_name: string;
    total: number;
    pending: number;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: Array<{ url: string | null; label: string; active: boolean }>;
}

interface Props {
    conflicts: PaginatedData<Conflict>;
    filters: {
        status: string | null;
        table: string | null;
    };
    tableStats: TableStat[];
}

export default function ConflictsManagement({ conflicts, filters, tableStats }: Props) {
    const [selectedConflicts, setSelectedConflicts] = useState<number[]>([]);
    const [bulkAction, setBulkAction] = useState<string>('');
    const [showBulkDialog, setShowBulkDialog] = useState(false);

    const { post: submitBulkResolve, processing: bulkProcessing } = useForm({
        conflict_ids: [] as number[],
        resolution: '',
    });

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
        return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ')}</Badge>;
    };

    const handleFilterChange = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value === 'all' ? null : value };
        router.get('/admin/data-sync/conflicts', newFilters, { preserveState: true });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedConflicts(conflicts.data.filter(c => c.resolution_status === 'pending').map(c => c.id));
        } else {
            setSelectedConflicts([]);
        }
    };

    const handleSelectConflict = (id: number, checked: boolean) => {
        if (checked) {
            setSelectedConflicts([...selectedConflicts, id]);
        } else {
            setSelectedConflicts(selectedConflicts.filter(cid => cid !== id));
        }
    };

    const handleBulkResolve = () => {
        if (selectedConflicts.length === 0 || !bulkAction) return;
        setShowBulkDialog(true);
    };

    const confirmBulkResolve = () => {
        router.post('/admin/data-sync/conflicts/bulk-resolve', {
            conflict_ids: selectedConflicts,
            resolution: bulkAction,
        }, {
            onSuccess: () => {
                setSelectedConflicts([]);
                setBulkAction('');
                setShowBulkDialog(false);
            },
        });
    };

    const pendingConflicts = conflicts.data.filter(c => c.resolution_status === 'pending');
    const allPendingSelected = pendingConflicts.length > 0 && 
        pendingConflicts.every(c => selectedConflicts.includes(c.id));

    return (
        <AppLayout>
            <Head title="Data Conflicts" />
            
            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Data Conflicts</h1>
                        <p className="text-muted-foreground">
                            Review and resolve data synchronization conflicts
                        </p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/admin/data-sync">
                            Back to Dashboard
                        </Link>
                    </Button>
                </div>

                {/* Stats by Table */}
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                    {tableStats.map((stat) => (
                        <Card 
                            key={stat.table_name}
                            className={stat.pending > 0 ? 'border-yellow-500' : ''}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {getTableDisplayName(stat.table_name)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stat.total}</div>
                                {stat.pending > 0 && (
                                    <p className="text-xs text-yellow-600">
                                        {stat.pending} pending
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Filters and Actions */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Conflict List</CardTitle>
                                <CardDescription>
                                    Total: {conflicts.total} conflicts
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <IconFilter className="h-4 w-4 text-muted-foreground" />
                                    <Select 
                                        value={filters.status || 'all'} 
                                        onValueChange={(v) => handleFilterChange('status', v)}
                                    >
                                        <SelectTrigger className="w-[150px]">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="local_wins">Local Wins</SelectItem>
                                            <SelectItem value="remote_wins">Remote Wins</SelectItem>
                                            <SelectItem value="merged">Merged</SelectItem>
                                            <SelectItem value="dismissed">Dismissed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select 
                                        value={filters.table || 'all'} 
                                        onValueChange={(v) => handleFilterChange('table', v)}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Table" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Tables</SelectItem>
                                            <SelectItem value="tension_records">Tension Records</SelectItem>
                                            <SelectItem value="twisting_measurements">Twisting</SelectItem>
                                            <SelectItem value="weaving_measurements">Weaving</SelectItem>
                                            <SelectItem value="tension_problems">Problems</SelectItem>
                                            <SelectItem value="stock_taking_records">Stock Taking</SelectItem>
                                            <SelectItem value="finish_earlier_records">Finish Earlier</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Bulk Actions */}
                        {selectedConflicts.length > 0 && (
                            <div className="mb-4 flex items-center gap-4 rounded-lg bg-muted p-3">
                                <span className="text-sm font-medium">
                                    {selectedConflicts.length} selected
                                </span>
                                <Select value={bulkAction} onValueChange={setBulkAction}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Bulk action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="local_wins">Keep Local Data</SelectItem>
                                        <SelectItem value="remote_wins">Keep Remote Data</SelectItem>
                                        <SelectItem value="dismissed">Dismiss</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button 
                                    onClick={handleBulkResolve}
                                    disabled={!bulkAction || bulkProcessing}
                                    size="sm"
                                >
                                    Apply
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                        setSelectedConflicts([]);
                                        setBulkAction('');
                                    }}
                                >
                                    Clear
                                </Button>
                            </div>
                        )}

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox 
                                            checked={allPendingSelected}
                                            onCheckedChange={handleSelectAll}
                                            disabled={pendingConflicts.length === 0}
                                        />
                                    </TableHead>
                                    <TableHead>Table</TableHead>
                                    <TableHead>Record IDs</TableHead>
                                    <TableHead>Conflict Fields</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Resolved By</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {conflicts.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No conflicts found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    conflicts.data.map((conflict) => (
                                        <TableRow key={conflict.id}>
                                            <TableCell>
                                                <Checkbox 
                                                    checked={selectedConflicts.includes(conflict.id)}
                                                    onCheckedChange={(checked) => handleSelectConflict(conflict.id, !!checked)}
                                                    disabled={conflict.resolution_status !== 'pending'}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {getTableDisplayName(conflict.table_name)}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div>Local: {conflict.local_record_id}</div>
                                                <div className="text-muted-foreground">Remote: {conflict.remote_record_id}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {conflict.conflict_fields.slice(0, 3).map((field) => (
                                                        <Badge key={field} variant="secondary" className="text-xs">
                                                            {field}
                                                        </Badge>
                                                    ))}
                                                    {conflict.conflict_fields.length > 3 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            +{conflict.conflict_fields.length - 3}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(conflict.resolution_status)}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {formatDate(conflict.created_at)}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {conflict.resolved_by?.name || '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button asChild variant="ghost" size="sm">
                                                    <Link href={`/admin/data-sync/conflicts/${conflict.id}`}>
                                                        <IconEye className="h-4 w-4 mr-1" />
                                                        View
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* Pagination */}
                        {conflicts.last_page > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-4">
                                {conflicts.links.map((link, index) => (
                                    <Button
                                        key={index}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url)}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Bulk Resolve Confirmation Dialog */}
            <AlertDialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Bulk Resolution</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to resolve {selectedConflicts.length} conflicts with action: <strong>{bulkAction.replace('_', ' ')}</strong>.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmBulkResolve}>
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
