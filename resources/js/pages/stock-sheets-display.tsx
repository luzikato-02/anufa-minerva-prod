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
            <div className="flex flex-col gap-4 p-4">
                <div>
                    <h1 className="text-xl font-semibold">Stock Sheets</h1>
                    <p className="text-sm text-muted-foreground">Recorded stock sheets, newest first</p>
                </div>
                <StockSheetsTable />
            </div>
        </AppLayout>
    );
}
