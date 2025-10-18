import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { DataTableDemo } from '@/components/data-table';
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
            <Head title="Dashboard" />
            <WeavingTensionPage></WeavingTensionPage>
        </AppLayout>
    );
}
