
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import BatchStockTakingForm from '@/components/batch-stock-taking';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Stock Take Records',
        href: "",
    },
    {
        title: 'Batch Checking',
        href: "",
    },
    
];

export default function RecordBatchStockTake() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Stock Taking" />
            <BatchStockTakingForm></BatchStockTakingForm>
        </AppLayout>
    );
}
