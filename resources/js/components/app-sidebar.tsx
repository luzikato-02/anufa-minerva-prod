import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { usePermissions } from '@/lib/permissions';
import { activityLog, dashboard, tensionRecordsDisplay, twistingTensionMain, underConstruction, weavingTensionMain, stockTakeRecordsMain, batchStockTakingMain, userMaintenance, finishEarlierDisplay } from '@/routes';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { BookOpen, Folder, LayoutGrid, HomeIcon, ConeIcon, DatabaseBackupIcon, NotebookIcon, BookAIcon, ShieldIcon, HistoryIcon, ScrollTextIcon } from 'lucide-react';
import { AdminNav } from './admin-nav';
import AppLogo from './app-logo';
import { InventoryNav } from './inventory-nav';
import { ProcessParams } from './process-parameters';

const mainNavItems: NavItem[] = [
    {
        title: 'Home',
        href: dashboard(),
        icon: HomeIcon,
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
        icon: LayoutGrid,
        permission: 'tension-records.create',
    },

    {
        title: 'Display: Tension Records',
        href: tensionRecordsDisplay(),
        icon: DatabaseBackupIcon,
        permission: 'tension-records.view',
    },

    {
        title: 'Display: Finish Earlier Records',
        href: finishEarlierDisplay(),
        icon: LayoutGrid,
        permission: 'finish-earlier.view',
    },

];
const inventoryNavItems: NavItem[] = [
   {
        title: 'Record: Batch Stock Taking',
        href: batchStockTakingMain(),
        icon: NotebookIcon,
        permission: 'stock-take.create',
    },

    {
        title: 'Display: Stock Take Records',
        href: stockTakeRecordsMain(),
        icon: BookAIcon,
        permission: 'stock-take.view',
    },

    {
        title: 'Record: Liner Material I/O',
        href: underConstruction(),
        icon: LayoutGrid,
    },

    {
        title: 'Display: Liner Material I/O',
        href: underConstruction(),
        icon: LayoutGrid,
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

const footerNavItems: NavItem[] = [
    {
        title: 'Log Viewer',
        href: '/log-viewer',
        icon: ScrollTextIcon,
    },
    {
        title: 'Repository',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: Folder,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits#react',
        icon: BookOpen,
    },
];

export function AppSidebar() {
    const { can } = usePermissions();

    const filterByPermission = (items: NavItem[]) =>
        items.filter((item) => !item.permission || can(item.permission));

    const visibleAdminItems = filterByPermission(administrationNavItems);

    return (
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
                <InventoryNav items={filterByPermission(inventoryNavItems)} />
                {visibleAdminItems.length > 0 && <AdminNav items={visibleAdminItems} />}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
