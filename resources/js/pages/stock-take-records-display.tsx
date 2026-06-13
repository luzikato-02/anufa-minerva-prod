import { StockTakeDataTable } from '@/components/st-data-table';
import { StockTakeStatsCards } from '@/components/stock-take-stats-cards';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Stock Take Records',
        href: '/stock-take-records-main',
    },
    {
        title: 'Display',
        href: '/stock-take-records-main',
    },
];

export default function StockTakeRecordsDisplay() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Stock Take Records" />
            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <StockTakeStatsCards />

                        <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                            <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl md:min-h-min dark:border-sidebar-border">
                                <StockTakeDataTable></StockTakeDataTable>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
