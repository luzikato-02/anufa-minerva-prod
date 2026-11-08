import { PageHeader } from '@/components/page-header';
import { TorqueChecksTable } from '@/components/torque-checks-table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Torque Check', href: '/torque-checks-main' },
    { title: 'Display', href: '/torque-checks-main' },
];

export default function TorqueChecksDisplay() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Torque Checks" />
            <div className="flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <PageHeader
                    title="Torque Checks"
                    meta="Creel adaptor torque check sheets"
                />
                <TorqueChecksTable />
            </div>
        </AppLayout>
    );
}
