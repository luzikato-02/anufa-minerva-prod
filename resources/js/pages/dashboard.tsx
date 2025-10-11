import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { TypingText } from '@/components/typing-text';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Home',
        href: "",
    },
];

export default function Home() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="grid auto-rows-min md:grid-cols-3 gap-1">
                    <div className="relative col-span-2 overflow-hidden rounded-xl p-6">
                       
                        <h1 className='scroll-m-20 text-8xl font-extrabold tracking-tight text-balance'>Minerva</h1>
                        <h2 className='text-4xl'>Production Optimization Program</h2>
                        <span className="text-muted-foreground text-2xl">{"A program that enables you to "}</span>
                        <TypingText words={[
                            "record twisting tension.",
                            "record weaving tension.",
                            "analyze finish ealier bobbins.",
                            "conduct stock taking with ease.",
                            "analyze individual spindle problems.",
                            "easily maintain liner material inventory."
                        ]}
                        typingSpeed={75}
                        deletingSpeed={40}
                        pauseBeforeDelete={900}
                        pauseBeforeType={300}
                        loop
                        ariaLabelPrefix='You can'
                        className='text-2xl mt-8'
                        caretClassName='bg-primary'></TypingText>
                        
                    </div>
                    {/* <div className="relative aspect-video overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">

                    </div> */}
                </div>
            </div>
        </AppLayout>
    );
}
