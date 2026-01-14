import { Head, Link, router } from '@inertiajs/react';
import { IconArrowLeft, IconDeviceDesktop, IconDeviceMobile, IconPower, IconPowerOff } from '@tabler/icons-react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Device {
    id: number;
    client_identifier: string;
    device_name: string | null;
    device_type: string | null;
    os_info: string | null;
    app_version: string | null;
    last_sync_at: string | null;
    is_active: boolean;
    created_at: string;
    transport_logs_count: number;
    conflicts_count: number;
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

interface Props {
    devices: PaginatedData<Device>;
    filters: {
        active_only: boolean;
    };
}

export default function DevicesManagement({ devices, filters }: Props) {
    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    };

    const getDeviceIcon = (deviceType: string | null) => {
        if (deviceType === 'mobile') {
            return <IconDeviceMobile className="h-5 w-5 text-muted-foreground" />;
        }
        return <IconDeviceDesktop className="h-5 w-5 text-muted-foreground" />;
    };

    const handleToggleDevice = (device: Device) => {
        const action = device.is_active ? 'deactivate' : 'reactivate';
        router.post(`/admin/data-sync/devices/${device.id}/${action}`);
    };

    const handleFilterChange = (checked: boolean) => {
        router.get('/admin/data-sync/devices', { active_only: checked }, { preserveState: true });
    };

    return (
        <AppLayout>
            <Head title="Sync Devices" />
            
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
                            <h1 className="text-3xl font-bold tracking-tight">Sync Client Devices</h1>
                            <p className="text-muted-foreground">
                                Manage registered desktop clients that sync with the server
                            </p>
                        </div>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Registered Devices</CardTitle>
                                <CardDescription>
                                    Total: {devices.total} devices
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="active-filter" className="text-sm text-muted-foreground">
                                    Show active only
                                </label>
                                <input
                                    type="checkbox"
                                    id="active-filter"
                                    checked={filters.active_only}
                                    onChange={(e) => handleFilterChange(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Device</TableHead>
                                    <TableHead>Client ID</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>OS / Version</TableHead>
                                    <TableHead>Last Sync</TableHead>
                                    <TableHead>Syncs</TableHead>
                                    <TableHead>Conflicts</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {devices.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                            No devices found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    devices.data.map((device) => (
                                        <TableRow key={device.id} className={!device.is_active ? 'opacity-60' : ''}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    {getDeviceIcon(device.device_type)}
                                                    <div>
                                                        <div className="font-medium">
                                                            {device.device_name || 'Unnamed Device'}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {device.device_type || 'desktop'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {device.client_identifier.slice(0, 12)}...
                                            </TableCell>
                                            <TableCell>
                                                {device.user?.name || '-'}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div>{device.os_info || '-'}</div>
                                                {device.app_version && (
                                                    <div className="text-xs text-muted-foreground">
                                                        v{device.app_version}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {formatDate(device.last_sync_at)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{device.transport_logs_count}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {device.conflicts_count > 0 ? (
                                                    <Badge variant="destructive">{device.conflicts_count}</Badge>
                                                ) : (
                                                    <Badge variant="outline">0</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {device.is_active ? (
                                                    <Badge variant="default" className="bg-green-500">
                                                        <IconPower className="h-3 w-3 mr-1" />
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary">
                                                        <IconPowerOff className="h-3 w-3 mr-1" />
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button 
                                                            variant={device.is_active ? 'destructive' : 'default'}
                                                            size="sm"
                                                        >
                                                            {device.is_active ? 'Deactivate' : 'Reactivate'}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>
                                                                {device.is_active ? 'Deactivate Device' : 'Reactivate Device'}
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                {device.is_active 
                                                                    ? 'This device will no longer be able to sync data with the server. You can reactivate it later.'
                                                                    : 'This device will be able to sync data with the server again.'}
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleToggleDevice(device)}>
                                                                {device.is_active ? 'Deactivate' : 'Reactivate'}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* Pagination */}
                        {devices.last_page > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-4">
                                {devices.links.map((link, index) => (
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
