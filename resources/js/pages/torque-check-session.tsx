import TorqueCheckSessionSelect from '@/components/torque-check-session-select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Torque Check', href: '/torque-check-main' },
    { title: 'Session', href: '/torque-check-session' },
];

export default function TorqueCheckSession() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Torque Check" />
            <TorqueCheckSessionSelect />
        </AppLayout>
    );
}
