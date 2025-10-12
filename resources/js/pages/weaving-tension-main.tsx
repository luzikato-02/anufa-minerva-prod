import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { DataTableDemo } from '@/components/data-table';
import TwistingTensionPage from '../components/twisting-tension-record';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: "",
    },
];

export default function Dashboard() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <TwistingTensionPage></TwistingTensionPage>
        </AppLayout>
    );
}
