import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Icon } from '@/components/icon';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { usePermissions } from '@/lib/permissions';
import { activityLog, batchStockTakingMain, creelVisualization, dashboard, documentIntelligence, energyMaterialAnalysisDisplay, energyRecordsDisplay, finishEarlierDisplay, finishEarlierScan, machineMaintenance, runtimeRecordsDisplay, shiftSummaryDisplay, speedOptimizationDisplay, stockTakeRecordsMain, tensionRecordsDisplay, twistingTensionMain, underConstruction, userMaintenance, weavingTensionMain } from '@/routes';
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { HomeIcon, ConeIcon, Layers, Table2, ClipboardList, ArrowLeftRight, ShieldIcon, HistoryIcon, ScrollTextIcon, FileSearch, ScanLine, Eye, Settings2, Gauge, Zap, BarChart3, BarChart2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { AdminNav } from './admin-nav';
import AppLogo from './app-logo';
import { InventoryNav } from './inventory-nav';
import { LoomNav } from './loom-nav';
import { ProcessParams } from './process-parameters';
import { TwistingEnergyNav } from './twisting-energy-nav';

const mainNavItems: NavItem[] = [
    {
        title: 'Home',
        href: dashboard(),
        icon: HomeIcon,
    },
    {
        title: 'Document Intelligence',
        href: documentIntelligence(),
        icon: FileSearch,
    },
];

const processParamsNavItems: NavItem[] = [
   {
        title: 'Record: Twisting Tension',
        href: twistingTensionMain(),
        icon: ConeIcon,
        permission: 'tension-records.create',
    },

    {
        title: 'Record: Weaving Tension',
        href: weavingTensionMain(),
        icon: Layers,
        permission: 'tension-records.create',
    },

    {
        title: 'Display: Tension Records',
        href: tensionRecordsDisplay(),
        icon: Table2,
        permission: 'tension-records.view',
    },
    {
        title: 'Machine Maintenance',
        href: machineMaintenance(),
        icon: Settings2,
        permission: 'machine-maintenance.view',
    },
];

const twistingEnergyNavItems: NavItem[] = [
    {
        title: 'Display: Runtime Records',
        href: runtimeRecordsDisplay(),
        icon: Gauge,
        permission: 'runtime.view',
    },
    {
        title: 'Display: Energy Records',
        href: energyRecordsDisplay(),
        icon: Zap,
        permission: 'energy.view',
    },
    {
        title: 'Display: Shift Summary',
        href: shiftSummaryDisplay(),
        icon: BarChart3,
        permission: 'energy.view',
    },
    {
        title: 'Analysis: Material Energy',
        href: energyMaterialAnalysisDisplay(),
        icon: BarChart2,
        permission: 'energy.view',
    },
    {
        title: 'Optimize: Speed (GA)',
        href: speedOptimizationDisplay(),
        icon: Sparkles,
        permission: 'energy.view',
    },
];
const inventoryNavItems: NavItem[] = [
   {
        title: 'Record: Batch Stock Taking',
        href: batchStockTakingMain(),
        icon: ClipboardList,
        permission: 'stock-take.create',
    },

    {
        title: 'Display: Stock Take Records',
        href: stockTakeRecordsMain(),
        icon: Table2,
        permission: 'stock-take.view',
    },

    {
        title: 'Record: Liner Material I/O',
        href: underConstruction(),
        icon: ArrowLeftRight,
    },

    {
        title: 'Display: Liner Material I/O',
        href: underConstruction(),
        icon: Table2,
    },
];

const loomNavItems: NavItem[] = [
    {
        title: 'Display: Finish Earlier Records',
        href: finishEarlierDisplay(),
        icon: Table2,
        permission: 'finish-earlier.view',
    },
    {
        title: 'Scan: Finish Earlier Form',
        href: finishEarlierScan(),
        icon: ScanLine,
        permission: 'finish-earlier.create',
    },
    {
        title: 'Display: Creel Visualization',
        href: creelVisualization(),
        icon: Eye,
        permission: 'creel.view',
    },
];

const administrationNavItems: NavItem[] = [
    {
        title: 'User & Role Management',
        href: userMaintenance(),
        icon: ShieldIcon,
        permission: 'users.view',
    },

    {
        title: 'Activity Log',
        href: activityLog(),
        icon: HistoryIcon,
        permission: 'activity-log.view',
    },
];


export function AppSidebar() {
    const { can } = usePermissions();
    const { app_env } = usePage<SharedData>().props;
    const [prodWarningOpen, setProdWarningOpen] = useState(false);

    const filterByPermission = (items: NavItem[]) =>
        items.filter((item) => !item.permission || can(item.permission));

    const visibleAdminItems = filterByPermission(administrationNavItems);

    return (
        <>
            <AlertDialog open={prodWarningOpen} onOpenChange={setProdWarningOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Not available in production</AlertDialogTitle>
                        <AlertDialogDescription>
                            The Log Viewer is disabled in the production environment.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setProdWarningOpen(false)}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Sidebar collapsible="icon" variant="inset">
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" asChild>
                                <Link href={dashboard()} prefetch>
                                    <AppLogo />
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>

                <SidebarContent>
                    <NavMain items={filterByPermission(mainNavItems)} />
                    <ProcessParams items={filterByPermission(processParamsNavItems)} />
                    <TwistingEnergyNav items={filterByPermission(twistingEnergyNavItems)} />
                    <InventoryNav items={filterByPermission(inventoryNavItems)} />
                    <LoomNav items={filterByPermission(loomNavItems)} />
                    {visibleAdminItems.length > 0 && <AdminNav items={visibleAdminItems} />}
                </SidebarContent>

                <SidebarFooter>
                    <SidebarGroup className="group-data-[collapsible=icon]:p-0 mt-auto">
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        className="text-neutral-600 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100"
                                        onClick={
                                            app_env === 'production'
                                                ? () => setProdWarningOpen(true)
                                                : undefined
                                        }
                                        asChild={app_env !== 'production'}
                                    >
                                        {app_env === 'production' ? (
                                            <>
                                                <Icon iconNode={ScrollTextIcon} className="h-5 w-5" />
                                                <span>Log Viewer</span>
                                            </>
                                        ) : (
                                            <a href="/log-viewer">
                                                <Icon iconNode={ScrollTextIcon} className="h-5 w-5" />
                                                <span>Log Viewer</span>
                                            </a>
                                        )}
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    <NavUser />
                </SidebarFooter>
            </Sidebar>
        </>
    );
}
