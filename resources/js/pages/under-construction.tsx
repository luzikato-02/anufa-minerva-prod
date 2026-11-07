import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ConstructionIcon } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Under construction',
        href: dashboard().url,
    },
];

export default function UnderConstruction() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Under construction" />
            <div className="flex flex-1 items-center justify-center p-(--density-gutter)">
                <div className="flex max-w-sm flex-col items-center gap-2 text-center">
                    <ConstructionIcon className="size-6 text-muted-foreground" />
                    <h1 className="text-base font-semibold">
                        This page isn&apos;t ready yet
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        It&apos;s still being built. Records you need today are
                        available from the other modules in the sidebar.
                    </p>
                    <Link
                        href={dashboard().url}
                        className="text-sm font-medium underline underline-offset-4"
                    >
                        Back to overview
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}
