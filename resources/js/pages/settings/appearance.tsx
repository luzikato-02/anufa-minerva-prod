import { Head } from '@inertiajs/react';

import AppearanceTabs from '@/components/appearance-tabs';
import { DensityToggle } from '@/components/density-toggle';
import HeadingSmall from '@/components/heading-small';
import { type BreadcrumbItem } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit as editAppearance } from '@/routes/appearance';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Appearance settings',
        href: editAppearance().url,
    },
];

export default function Appearance() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Appearance settings" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Appearance settings"
                        description="Update your account's appearance settings"
                    />
                    <AppearanceTabs />
                </div>

                <div className="space-y-6">
                    <HeadingSmall
                        title="Row density"
                        description="How tightly tables and record lists are packed. Data-entry screens keep their larger touch targets either way."
                    />
                    <DensityToggle />
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
