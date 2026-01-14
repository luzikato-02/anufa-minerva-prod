import { Head, Link } from '@inertiajs/react';
import { IconCloudUpload, IconAlertTriangle, IconDeviceDesktop, IconHistory, IconRefresh } from '@tabler/icons-react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Stats {
    total_devices: number;
    active_devices: number;
    pending_conflicts: number;
    total_syncs_today: number;
    failed_syncs_today: number;
}

interface Conflict {
    id: number;
    table_name: string;
    local_record_id: number;
    remote_record_id: number;
    resolution_status: string;
    created_at: string;
    conflict_fields: string[];
}

interface Device {
    id: number;
    client_identifier: string;
    device_name: string | null;
    device_type: string | null;
    last_sync_at: string | null;
    is_active: boolean;
    user?: { name: string } | null;
}

interface Props {
    stats: Stats;
    recentConflicts: Conflict[];
    recentDevices: Device[];
}

export default function DataSyncIndex({ stats, recentConflicts, recentDevices }: Props) {
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
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    };

    return (
        <AppLayout>
            <Head title="Data Sync Management" />
            
            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Data Sync Management</h1>
                        <p className="text-muted-foreground">
                            Monitor and manage data synchronization between desktop clients and server
                        </p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
                            <IconDeviceDesktop className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.active_devices}</div>
                            <p className="text-xs text-muted-foreground">
                                of {stats.total_devices} total devices
                            </p>
                        </CardContent>
                    </Card>

                    <Card className={stats.pending_conflicts > 0 ? 'border-destructive' : ''}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Conflicts</CardTitle>
                            <IconAlertTriangle className={`h-4 w-4 ${stats.pending_conflicts > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${stats.pending_conflicts > 0 ? 'text-destructive' : ''}`}>
                                {stats.pending_conflicts}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                requires manual resolution
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Syncs Today</CardTitle>
                            <IconCloudUpload className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total_syncs_today}</div>
                            <p className="text-xs text-muted-foreground">
                                upload/download operations
                            </p>
                        </CardContent>
                    </Card>

                    <Card className={stats.failed_syncs_today > 0 ? 'border-yellow-500' : ''}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Failed Today</CardTitle>
                            <IconRefresh className={`h-4 w-4 ${stats.failed_syncs_today > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${stats.failed_syncs_today > 0 ? 'text-yellow-500' : ''}`}>
                                {stats.failed_syncs_today}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                sync operations failed
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                            <IconHistory className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button asChild variant="outline" size="sm" className="w-full">
                                <Link href="/admin/data-sync/conflicts">View Conflicts</Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="w-full">
                                <Link href="/admin/data-sync/logs">View Logs</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Recent Conflicts */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Conflicts</CardTitle>
                            <CardDescription>
                                Data conflicts that need resolution
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {recentConflicts.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No conflicts to display</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Table</TableHead>
                                            <TableHead>Fields</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentConflicts.map((conflict) => (
                                            <TableRow key={conflict.id}>
                                                <TableCell className="font-medium">
                                                    {getTableDisplayName(conflict.table_name)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {conflict.conflict_fields.slice(0, 2).map((field) => (
                                                            <Badge key={field} variant="secondary" className="text-xs">
                                                                {field}
                                                            </Badge>
                                                        ))}
                                                        {conflict.conflict_fields.length > 2 && (
                                                            <Badge variant="outline" className="text-xs">
                                                                +{conflict.conflict_fields.length - 2}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        variant={conflict.resolution_status === 'pending' ? 'destructive' : 'default'}
                                                    >
                                                        {conflict.resolution_status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {recentConflicts.length > 0 && (
                                <div className="mt-4">
                                    <Button asChild variant="outline" size="sm">
                                        <Link href="/admin/data-sync/conflicts">View All Conflicts</Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recent Devices */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Device Activity</CardTitle>
                            <CardDescription>
                                Recently synced client devices
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {recentDevices.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No devices to display</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Device</TableHead>
                                            <TableHead>User</TableHead>
                                            <TableHead>Last Sync</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentDevices.map((device) => (
                                            <TableRow key={device.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <IconDeviceDesktop className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-medium">
                                                            {device.device_name || device.client_identifier.slice(0, 8)}
                                                        </span>
                                                        {!device.is_active && (
                                                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {device.user?.name || 'Unknown'}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {formatDate(device.last_sync_at)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {recentDevices.length > 0 && (
                                <div className="mt-4">
                                    <Button asChild variant="outline" size="sm">
                                        <Link href="/admin/data-sync/devices">Manage Devices</Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
