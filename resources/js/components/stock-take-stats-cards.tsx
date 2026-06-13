import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardCheckIcon, ClipboardListIcon, GaugeIcon, HourglassIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface StockTakeStats {
    total_sessions: number;
    in_progress_sessions: number;
    completed_sessions: number;
    total_batches: number;
    total_checked_batches: number;
    overall_completion: number;
    average_similitude_ratio: number;
}

export function StockTakeStatsCards() {
    const [stats, setStats] = useState<StockTakeStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/stock-take-statistics', { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => setStats(data.data))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="py-6 text-center">Loading stats...</div>;
    }

    return (
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Total Sessions</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {stats?.total_sessions ?? 0}
                    </CardTitle>
                    <CardAction>
                        <ClipboardListIcon className="text-muted-foreground size-5" />
                    </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="text-muted-foreground">All recorded stock take sessions</div>
                </CardFooter>
            </Card>

            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>In Progress</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {stats?.in_progress_sessions ?? 0}
                    </CardTitle>
                    <CardAction>
                        <HourglassIcon className="text-muted-foreground size-5" />
                    </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="text-muted-foreground">Sessions still being counted</div>
                </CardFooter>
            </Card>

            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Completed</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {stats?.completed_sessions ?? 0}
                    </CardTitle>
                    <CardAction>
                        <ClipboardCheckIcon className="text-muted-foreground size-5" />
                    </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="text-muted-foreground">Sessions marked as completed</div>
                </CardFooter>
            </Card>

            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Average Similitude Ratio</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {stats?.average_similitude_ratio ?? 0}%
                    </CardTitle>
                    <CardAction>
                        <GaugeIcon className="text-muted-foreground size-5" />
                    </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="text-muted-foreground">Average batch completion across all sessions</div>
                </CardFooter>
            </Card>
        </div>
    );
}
