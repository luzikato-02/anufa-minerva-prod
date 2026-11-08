import { PageHeader } from '@/components/page-header';
import { StockTakeDataTable } from '@/components/st-data-table';
import { StockTakeKpiStrip } from '@/components/stock-take-kpi-strip';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Stock Take Records', href: '/stock-take-records-main' },
    { title: 'Display', href: '/stock-take-records-main' },
];

export default function StockTakeRecordsDisplay() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Stock Take Records" />
            <div className="@container/main flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <StockTakeKpiStrip />
                <PageHeader
                    title="Stock Take Records"
                    meta="Inventory scan and batch verification sessions"
                />
                <StockTakeDataTable />
            </div>
        </AppLayout>
    );
}
