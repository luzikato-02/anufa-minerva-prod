import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import WeavingTensionPage from '@/components/weaving-tension-record';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Tension Records',
        href: "",
    },
    {
        title: 'Weaving Tension Record',
        href: "",
    },
];

export default function WeavingTensionMain() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Weaving Tension Record" />
            <WeavingTensionPage></WeavingTensionPage>
        </AppLayout>
    );
}
