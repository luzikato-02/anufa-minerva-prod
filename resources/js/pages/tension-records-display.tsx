import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { TwistingDataTable } from '@/components/twisting-data-table';
import { WeavingDataTable } from '@/components/weaving-data-table';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Tension Records',
        href: dashboard().url,
    },
    {
        title: 'Display',
        href: dashboard().url,
    },
];

export default function TensionRecordsDisplay() {
    
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                        <PlaceholderPattern className="absolute inset-0 size-full stroke-neutral-900/20 dark:stroke-neutral-100/20" />
                    </div>
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                        <PlaceholderPattern className="absolute inset-0 size-full stroke-neutral-900/20 dark:stroke-neutral-100/20" />
                    </div>
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                        <PlaceholderPattern className="absolute inset-0 size-full stroke-neutral-900/20 dark:stroke-neutral-100/20" />
                    </div>
                </div>
                <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl md:min-h-min dark:border-sidebar-border">
                    <Tabs defaultValue="twisting">
                        <TabsList>
                            <TabsTrigger value="twisting">Twisting Tension</TabsTrigger>
                            <TabsTrigger value="weaving">Weaving Tension</TabsTrigger>
                        </TabsList>
                        <TabsContent value="twisting">
                            <TwistingDataTable></TwistingDataTable>
                        </TabsContent>
                        <TabsContent value="weaving">
                           <WeavingDataTable></WeavingDataTable>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </AppLayout>
    );
}
