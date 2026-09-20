import StockSheetForm from '@/components/stock-sheet-form';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Stock Sheet', href: '/stock-sheet-main' },
    { title: 'Record', href: '/stock-sheet-main' },
];

export default function RecordStockSheet() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Stock Sheet" />
            <StockSheetForm />
        </AppLayout>
    );
}
