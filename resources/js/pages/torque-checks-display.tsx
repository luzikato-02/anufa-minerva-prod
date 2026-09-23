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
            <div className="flex flex-col gap-4 p-4">
                <div>
                    <h1 className="text-xl font-semibold">Torque Checks</h1>
                    <p className="text-sm text-muted-foreground">Creel adaptor torque check sheets, newest first</p>
                </div>
                <TorqueChecksTable />
            </div>
        </AppLayout>
    );
}
