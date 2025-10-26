import { StockTakeDataTable } from '@/components/st-data-table';
import { TensionStatsCards } from '@/components/tension-record-cards';
import { TwistingDataTable } from '@/components/twisting-data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WeavingDataTable } from '@/components/weaving-data-table';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
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

export default function StockTakeRecordsDisplay() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            {/* <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
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
            </div> */}
            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        {/* <TensionStatsCards /> */}

                        <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                            <div className="relative min-h-[100vh] flex-1 overflow-hidden rounded-xl md:min-h-min dark:border-sidebar-border">
                               <StockTakeDataTable></StockTakeDataTable>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
