import { PageHeader } from '@/components/page-header';
import { TensionKpiStrip } from '@/components/tension-kpi-strip';
import { TensionProblemsDataTable } from '@/components/tension-problems-data-table';
import { TwistingDataTable } from '@/components/twisting-data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WeavingDataTable } from '@/components/weaving-data-table';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

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
    // ?tab=weaving|problems opens that tab, e.g. from a dashboard link.
    const [tab, setTab] = useState(() => {
        const requested =
            typeof window === 'undefined'
                ? null
                : new URLSearchParams(window.location.search).get('tab');
        return requested === 'weaving' || requested === 'problems'
            ? requested
            : 'twisting';
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tension Records" />
            <div className="@container/main flex flex-1 flex-col gap-(--density-gutter) py-(--density-gutter)">
                <TensionKpiStrip
                    className="mx-4"
                    onOpenProblems={() => setTab('problems')}
                />

                <Tabs
                    value={tab}
                    onValueChange={setTab}
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
