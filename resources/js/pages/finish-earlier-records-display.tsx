import { FinishEarlierDataTable } from '@/components/finish-earlier-data-table';
import { PageHeader } from '@/components/page-header';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Finish Earlier Records', href: '/finish-earlier-display' },
    { title: 'Display', href: '/finish-earlier-display' },
];

export default function FinishEarlierRecordDisplay() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Finish Earlier Records" />
            <div className="flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <PageHeader
                    title="Finish Earlier Records"
                    meta="Yarn packages that finished before the expected length"
                />
                <FinishEarlierDataTable />
            </div>
        </AppLayout>
    );
}
