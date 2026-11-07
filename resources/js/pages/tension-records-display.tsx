import { PageHeader } from '@/components/page-header';
import { TensionProblemsDataTable } from '@/components/tension-problems-data-table';
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

export default function TensionRecordsDisplay() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tension Records" />
            <div className="@container/main flex flex-1 flex-col gap-(--density-gutter) py-(--density-gutter)">
                {/* Stat cards stay for now; Phase 4 replaces them with a one-row KPI strip. */}
                <TensionStatsCards />

                <Tabs
                    defaultValue="twisting"
                    className="flex min-w-0 flex-col gap-(--density-gutter) px-4"
                >
                    <PageHeader
                        title="Tension Records"
                        meta="Twisting and weaving machine tension data"
                        tabs={
                            <TabsList className="h-8">
                                <TabsTrigger
                                    value="twisting"
                                    className="text-xs"
                                >
                                    Twisting
                                </TabsTrigger>
                                <TabsTrigger
                                    value="weaving"
                                    className="text-xs"
                                >
                                    Weaving
                                </TabsTrigger>
                                <TabsTrigger
                                    value="problems"
                                    className="text-xs"
                                >
                                    Problems
                                </TabsTrigger>
                            </TabsList>
                        }
                    />
                    <TabsContent value="twisting" className="mt-0">
                        <TwistingDataTable />
                    </TabsContent>
                    <TabsContent value="weaving" className="mt-0">
                        <WeavingDataTable />
                    </TabsContent>
                    <TabsContent value="problems" className="mt-0">
                        <TensionProblemsDataTable />
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
