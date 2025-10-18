
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import TwistingTensionPage from '../components/twisting-tension-record';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Tension Records',
        href: "",
    },
    {
        title: 'Twisting Tension Record',
        href: "",
    },
    
];

export default function TwistingTensionMain() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Twisting Tension" />
            <TwistingTensionPage></TwistingTensionPage>
        </AppLayout>
    );
}
