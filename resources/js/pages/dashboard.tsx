import {
    Card,
    CardAction,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { TypingText } from '@/components/typing-text';
import AppLayout from '@/layouts/app-layout';
import { usePermissions } from '@/lib/permissions';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangleIcon,
    ClipboardListIcon,
    GaugeIcon,
    ScanBarcodeIcon,
    UsersIcon,
    ZapIcon,
} from 'lucide-react';

interface TensionStats {
    total: number;
    twisting: number;
    weaving: number;
    open_problems: number;
}
interface StockTakeStats {
    total: number;
    in_progress: number;
    completed: number;
    completion: number;
}
interface UserStats {
    total: number;
    unassigned: number;
}

interface Props {
    tension: TensionStats | null;
    stockTake: StockTakeStats | null;
    users: UserStats | null;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Home', href: '' }];

const QUICK_ACTIONS = [
    { label: 'Record Twisting Tension', href: '/twisting-tension-main', permission: 'tension-records.create', icon: ZapIcon },
    { label: 'Record Weaving Tension', href: '/weaving-tension-main', permission: 'tension-records.create', icon: GaugeIcon },
    { label: 'Start Stock Take', href: '/batch-stock-taking-main', permission: 'stock-take.create', icon: ClipboardListIcon },
    { label: 'Scan Finish Earlier', href: '/finish-earlier-scan', permission: 'finish-earlier.create', icon: ScanBarcodeIcon },
] as const;

export default function Dashboard({ tension, stockTake, users }: Props) {
    const { can } = usePermissions();
    const actions = QUICK_ACTIONS.filter((a) => can(a.permission));
    const hasStats = tension || stockTake || users;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Branding */}
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Minerva</h1>
                <div className="mt-1">
                        <span className="text-muted-foreground text-sm sm:text-base">A program that enables you to </span>
                        <TypingText
                            words={[
                                'record twisting tension.',
                                'record weaving tension.',
                                'analyze finish earlier bobbins.',
                                'conduct stock taking with ease.',
                                'analyze individual spindle problems.',
                                'easily maintain liner material inventory.',
                            ]}
                            typingSpeed={75}
                            deletingSpeed={40}
                            pauseBeforeDelete={900}
                            pauseBeforeType={300}
                            loop
                            ariaLabelPrefix="You can"
                            className="text-sm sm:text-base"
                            caretClassName="bg-primary"
                        />
                    </div>
                </div>

                {/* Open problems alert */}
                {tension && tension.open_problems > 0 && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-400/60 bg-amber-50 px-4 py-3 dark:bg-amber-950/25">
                        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-sm">
                            <strong>{tension.open_problems}</strong> unresolved tension{' '}
                            {tension.open_problems === 1 ? 'problem' : 'problems'} need attention.{' '}
                            <Link
                                href="/tension-records-display"
                                className="font-medium underline underline-offset-2"
                            >
                                View problems →
                            </Link>
                        </p>
                    </div>
                )}

                {/* KPI Cards */}
                {hasStats && (
                    <section>
                        <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-widest">
                            Overview
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {tension && (
                                <Link href="/tension-records-display" className="block">
                                    <Card className="@container/card hover:bg-muted/40 h-full transition-colors">
                                        <CardHeader>
                                            <CardDescription>Tension Records</CardDescription>
                                            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                                {tension.total}
                                            </CardTitle>
                                            <CardAction>
                                                <GaugeIcon className="text-muted-foreground size-4" />
                                            </CardAction>
                                        </CardHeader>
                                        <CardFooter className="text-muted-foreground flex flex-wrap gap-3 text-sm">
                                            <span>
                                                Twisting <strong className="text-foreground">{tension.twisting}</strong>
                                            </span>
                                            <span>
                                                Weaving <strong className="text-foreground">{tension.weaving}</strong>
                                            </span>
                                        </CardFooter>
                                    </Card>
                                </Link>
                            )}

                            {stockTake && (
                                <Link href="/stock-take-records-main" className="block">
                                    <Card className="@container/card hover:bg-muted/40 h-full transition-colors">
                                        <CardHeader>
                                            <CardDescription>Stock Taking</CardDescription>
                                            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                                {stockTake.total}
                                            </CardTitle>
                                            <CardAction>
                                                <ClipboardListIcon className="text-muted-foreground size-4" />
                                            </CardAction>
                                        </CardHeader>
                                        <CardFooter className="text-muted-foreground flex flex-wrap gap-3 text-sm">
                                            <span>
                                                In progress <strong className="text-foreground">{stockTake.in_progress}</strong>
                                            </span>
                                            <span>
                                                Done <strong className="text-foreground">{stockTake.completion}%</strong>
                                            </span>
                                        </CardFooter>
                                    </Card>
                                </Link>
                            )}

                            {users && (
                                <Link href="/user-maintenance" className="block">
                                    <Card className="@container/card hover:bg-muted/40 h-full transition-colors">
                                        <CardHeader>
                                            <CardDescription>Users</CardDescription>
                                            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                                {users.total}
                                            </CardTitle>
                                            <CardAction>
                                                <UsersIcon className="text-muted-foreground size-4" />
                                            </CardAction>
                                        </CardHeader>
                                        <CardFooter className="text-sm">
                                            {users.unassigned > 0 ? (
                                                <span className="text-amber-600 dark:text-amber-400">
                                                    {users.unassigned} without roles
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">All users assigned</span>
                                            )}
                                        </CardFooter>
                                    </Card>
                                </Link>
                            )}
                        </div>
                    </section>
                )}

                {/* Quick Actions */}
                {actions.length > 0 && (
                    <section>
                        <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-widest">
                            Quick Actions
                        </h2>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {actions.map(({ label, href, icon: Icon }) => (
                                <Link key={href + label} href={href} className="block">
                                    <Card className="hover:bg-muted/40 cursor-pointer transition-colors">
                                        <CardHeader className="pb-2">
                                            <Icon className="text-muted-foreground size-5" />
                                        </CardHeader>
                                        <CardFooter className="text-sm font-medium leading-snug">
                                            {label}
                                        </CardFooter>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </AppLayout>
    );
}
