import TorqueCheckGrid from '@/components/torque-check-grid';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Torque Check', href: '/torque-check-main' },
    { title: 'Record', href: '/torque-check-main' },
];

export default function RecordTorqueCheck() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Torque Check" />
            <TorqueCheckGrid />
        </AppLayout>
    );
}
