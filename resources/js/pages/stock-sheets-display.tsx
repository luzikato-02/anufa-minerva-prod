import { PageHeader } from '@/components/page-header';
import { StockSheetsTable } from '@/components/stock-sheets-table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Stock Sheet', href: '/stock-sheets-main' },
    { title: 'Display', href: '/stock-sheets-main' },
];

export default function StockSheetsDisplay() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Stock Sheets" />
            <div className="flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <PageHeader
                    title="Stock Sheets"
                    meta="Recorded paper stock sheets"
                />
                <StockSheetsTable />
            </div>
        </AppLayout>
    );
}
