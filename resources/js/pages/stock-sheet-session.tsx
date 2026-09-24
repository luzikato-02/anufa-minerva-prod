import StockSheetSessionSelect from '@/components/stock-sheet-session-select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Stock Sheet', href: '/stock-sheet-main' },
    { title: 'Session', href: '/stock-sheet-session' },
];

export default function StockSheetSession() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Stock Sheet" />
            <StockSheetSessionSelect />
        </AppLayout>
    );
}
