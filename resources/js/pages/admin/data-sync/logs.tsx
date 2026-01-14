import { Head, Link, router } from '@inertiajs/react';
import { IconArrowLeft, IconCloudDownload, IconCloudUpload, IconFilter } from '@tabler/icons-react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SyncLog {
    id: number;
    sync_direction: 'upload' | 'download';
    table_name: string;
    local_record_id: number;
    remote_record_id: number | null;
    action: 'create' | 'update' | 'delete';
    status: 'pending' | 'success' | 'failed' | 'conflict';
    payload: Record<string, unknown> | null;
    error_message: string | null;
    client_identifier: string | null;
    created_at: string;
    completed_at: string | null;
    user?: { name: string } | null;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: Array<{ url: string | null; label: string; active: boolean }>;
}

interface Client {
    client_identifier: string;
    device_name: string | null;
}

interface Stats {
    total: number;
    success: number;
    failed: number;
    pending: number;
    conflicts: number;
}

interface Props {
    logs: PaginatedData<SyncLog>;
    filters: {
        status: string | null;
        direction: string | null;
        table: string | null;
        client: string | null;
    };
    stats: Stats;
    clients: Client[];
}

export default function SyncLogs({ logs, filters, stats, clients }: Props) {
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
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            pending: 'secondary',
            success: 'default',
            failed: 'destructive',
            conflict: 'outline',
        };
        return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
    };

    const getActionBadge = (action: string) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
            create: 'default',
            update: 'secondary',
            delete: 'destructive',
        };
        return <Badge variant={variants[action] || 'default'}>{action}</Badge>;
    };

    const handleFilterChange = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value === 'all' ? null : value };
        router.get('/admin/data-sync/logs', newFilters, { preserveState: true });
    };

    const getClientName = (identifier: string | null) => {
        if (!identifier) return '-';
        const client = clients.find(c => c.client_identifier === identifier);
        return client?.device_name || identifier.slice(0, 8);
    };

    return (
        <AppLayout>
            <Head title="Sync Logs" />
            
            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/admin/data-sync">
                                <IconArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Sync Transport Logs</h1>
                            <p className="text-muted-foreground">
                                View all data synchronization operations
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-5">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Total</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                        </CardContent>
                    </Card>
                    <Card className="border-green-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-green-600">Success</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
                        </CardContent>
                    </Card>
                    <Card className={stats.failed > 0 ? 'border-destructive' : ''}>
                        <CardHeader className="pb-2">
                            <CardTitle className={`text-sm font-medium ${stats.failed > 0 ? 'text-destructive' : ''}`}>Failed</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${stats.failed > 0 ? 'text-destructive' : ''}`}>{stats.failed}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.pending}</div>
                        </CardContent>
                    </Card>
                    <Card className={stats.conflicts > 0 ? 'border-yellow-500' : ''}>
                        <CardHeader className="pb-2">
                            <CardTitle className={`text-sm font-medium ${stats.conflicts > 0 ? 'text-yellow-600' : ''}`}>Conflicts</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${stats.conflicts > 0 ? 'text-yellow-600' : ''}`}>{stats.conflicts}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Logs Table */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Sync Operations</CardTitle>
                                <CardDescription>
                                    Total: {logs.total} records
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <IconFilter className="h-4 w-4 text-muted-foreground" />
                                <Select 
                                    value={filters.status || 'all'} 
                                    onValueChange={(v) => handleFilterChange('status', v)}
                                >
                                    <SelectTrigger className="w-[130px]">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="success">Success</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                        <SelectItem value="conflict">Conflict</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select 
                                    value={filters.direction || 'all'} 
                                    onValueChange={(v) => handleFilterChange('direction', v)}
                                >
                                    <SelectTrigger className="w-[130px]">
                                        <SelectValue placeholder="Direction" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="upload">Upload</SelectItem>
                                        <SelectItem value="download">Download</SelectItem>
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
                                {clients.length > 0 && (
                                    <Select 
                                        value={filters.client || 'all'} 
                                        onValueChange={(v) => handleFilterChange('client', v)}
                                    >
                                        <SelectTrigger className="w-[150px]">
                                            <SelectValue placeholder="Client" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Clients</SelectItem>
                                            {clients.map((client) => (
                                                <SelectItem key={client.client_identifier} value={client.client_identifier}>
                                                    {client.device_name || client.client_identifier.slice(0, 8)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Direction</TableHead>
                                    <TableHead>Table</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Record IDs</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No logs found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.data.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {log.sync_direction === 'upload' ? (
                                                        <IconCloudUpload className="h-4 w-4 text-blue-500" />
                                                    ) : (
                                                        <IconCloudDownload className="h-4 w-4 text-green-500" />
                                                    )}
                                                    <span className="capitalize">{log.sync_direction}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {getTableDisplayName(log.table_name)}
                                            </TableCell>
                                            <TableCell>{getActionBadge(log.action)}</TableCell>
                                            <TableCell className="text-sm">
                                                <div>Local: {log.local_record_id}</div>
                                                <div className="text-muted-foreground">
                                                    Remote: {log.remote_record_id || '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                                            <TableCell className="text-sm">
                                                {getClientName(log.client_identifier)}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {log.user?.name || '-'}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {formatDate(log.created_at)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* Pagination */}
                        {logs.last_page > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-4">
                                {logs.links.map((link, index) => (
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
        </AppLayout>
    );
}
