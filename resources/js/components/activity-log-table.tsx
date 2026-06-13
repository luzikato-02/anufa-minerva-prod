'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { EyeIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ActivityCauser {
    id: number;
    name: string;
    username: string;
}

interface ActivityRecord {
    id: number;
    description: string;
    subject_type: string | null;
    subject_id: number | null;
    event: string | null;
    causer: ActivityCauser | null;
    properties: Record<string, unknown> | null;
    created_at: string;
}

interface LaravelPaginatedResponse<T> {
    current_page: number;
    data: T[];
    last_page: number;
    per_page: number;
    total: number;
}

const EVENT_OPTIONS = [
    { value: 'all', label: 'All Events' },
    { value: 'created', label: 'Created' },
    { value: 'updated', label: 'Updated' },
    { value: 'deleted', label: 'Deleted' },
    { value: 'restored', label: 'Restored' },
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' },
    { value: 'role_assignment', label: 'Role Assignment' },
];

const SUBJECT_TYPE_OPTIONS = [
    { value: 'all', label: 'All Subjects' },
    { value: 'App\\Models\\TensionRecord', label: 'Tension Record' },
    { value: 'App\\Models\\StockTakingRecord', label: 'Stock Taking Record' },
    { value: 'App\\Models\\FinishEarlierRecord', label: 'Finish Earlier Record' },
    { value: 'App\\Models\\User', label: 'User' },
    { value: 'Spatie\\Permission\\Models\\Role', label: 'Role' },
];

function shortSubjectType(subjectType: string | null): string {
    if (!subjectType) return '—';
    const parts = subjectType.split('\\');
    return parts[parts.length - 1];
}

function eventBadgeVariant(event: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (event) {
        case 'created':
            return 'default';
        case 'deleted':
            return 'destructive';
        case 'updated':
        case 'role_assignment':
            return 'secondary';
        default:
            return 'outline';
    }
}

function formatDate(date: string): string {
    return new Date(date).toLocaleString('en-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function PropertiesDialog({ activity }: { activity: ActivityRecord }) {
    const [open, setOpen] = useState(false);
    const hasProperties = activity.properties && Object.keys(activity.properties).length > 0;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={!hasProperties}>
                    <EyeIcon className="mr-1 h-4 w-4" />
                    View
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Activity Details</DialogTitle>
                    <DialogDescription>{activity.description}</DialogDescription>
                </DialogHeader>
                <Textarea readOnly value={JSON.stringify(activity.properties ?? {}, null, 2)} className="h-72 font-mono text-xs" />
            </DialogContent>
        </Dialog>
    );
}

export function ActivityLogTable() {
    const [data, setData] = useState<ActivityRecord[]>([]);
    const [totalRows, setTotalRows] = useState(0);
    const [pageCount, setPageCount] = useState(0);
    const [pageIndex, setPageIndex] = useState(0);
    const [loading, setLoading] = useState(false);

    const [eventFilter, setEventFilter] = useState('all');
    const [subjectTypeFilter, setSubjectTypeFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        const baseUrl = window.location.origin;
        const controller = new AbortController();

        const fetchData = async () => {
            setLoading(true);

            const params = new URLSearchParams({
                page: (pageIndex + 1).toString(),
                per_page: '15',
            });

            if (eventFilter !== 'all') params.append('event', eventFilter);
            if (subjectTypeFilter !== 'all') params.append('subject_type', subjectTypeFilter);
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo) params.append('date_to', dateTo);

            try {
                const response = await fetch(`${baseUrl}/api/activity-log?${params.toString()}`, {
                    credentials: 'include',
                    signal: controller.signal,
                });

                const json: LaravelPaginatedResponse<ActivityRecord> = await response.json();

                setData(json.data);
                setTotalRows(json.total);
                setPageCount(json.last_page);
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error('Fetch error:', error);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => controller.abort();
    }, [pageIndex, eventFilter, subjectTypeFilter, dateFrom, dateTo]);

    return (
        <div className="w-full">
            <div className="flex flex-wrap items-end gap-3 py-4">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Event</p>
                    <Select
                        value={eventFilter}
                        onValueChange={(value) => {
                            setEventFilter(value);
                            setPageIndex(0);
                        }}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Events" />
                        </SelectTrigger>
                        <SelectContent>
                            {EVENT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Subject</p>
                    <Select
                        value={subjectTypeFilter}
                        onValueChange={(value) => {
                            setSubjectTypeFilter(value);
                            setPageIndex(0);
                        }}
                    >
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="All Subjects" />
                        </SelectTrigger>
                        <SelectContent>
                            {SUBJECT_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">From</p>
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                            setDateFrom(e.target.value);
                            setPageIndex(0);
                        }}
                        className="w-[160px]"
                    />
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">To</p>
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                            setDateTo(e.target.value);
                            setPageIndex(0);
                        }}
                        className="w-[160px]"
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-[80px]">Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length ? (
                            data.map((activity) => (
                                <TableRow key={activity.id}>
                                    <TableCell className="whitespace-nowrap text-sm">{formatDate(activity.created_at)}</TableCell>
                                    <TableCell>{activity.causer?.name ?? 'System'}</TableCell>
                                    <TableCell>
                                        {activity.event ? (
                                            <Badge variant={eventBadgeVariant(activity.event)} className="capitalize">
                                                {activity.event.replace('_', ' ')}
                                            </Badge>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {shortSubjectType(activity.subject_type)}
                                        {activity.subject_id ? ` #${activity.subject_id}` : ''}
                                    </TableCell>
                                    <TableCell className="max-w-[300px] truncate">{activity.description}</TableCell>
                                    <TableCell>
                                        <PropertiesDialog activity={activity} />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    {loading ? 'Loading...' : 'No activity recorded.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">{totalRows} total record(s).</div>
                <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={pageIndex === 0}>
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPageIndex((p) => p + 1)}
                        disabled={pageIndex + 1 >= pageCount}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
