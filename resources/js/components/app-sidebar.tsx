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
import { dashboard, tensionRecordsDisplay, twistingTensionMain, underConstruction, weavingTensionMain, stockTakeRecordsMain, batchStockTakingMain, userMaintenance, finishEarlierDisplay } from '@/routes';

// Database sync route for Electron desktop app
const databaseSyncRoute = () => '/database-sync';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { BookOpen, Folder, LayoutGrid, HomeIcon, ConeIcon, DatabaseBackupIcon, NotebookIcon, UserCheck, BookAIcon, CloudIcon } from 'lucide-react';
import AppLogo from './app-logo';
import { InventoryNav } from './inventory-nav';
import { ProcessParams } from './process-parameters';
import { useIsElectron, useSyncStatus } from '@/hooks/use-electron';

const getMainNavItems = (isElectron: boolean): NavItem[] => {
    const items: NavItem[] = [
        {
            title: 'Home',
            href: dashboard(),
            icon: HomeIcon,
        },
        {
            title: 'User Maintenance Table',
            href: userMaintenance(),
            icon: UserCheck,
        },
    ];

    // Add Database Sync option for Electron desktop app
    if (isElectron) {
        items.push({
            title: 'Database Sync',
            href: databaseSyncRoute(),
            icon: CloudIcon,
        });
    }

    return items;
};

const processParamsNavItems: NavItem[] = [
   {
        title: 'Record: Twisting Tension',
        href: twistingTensionMain(),
        icon: ConeIcon,
    },

    {
        title: 'Record: Weaving Tension',
        href: weavingTensionMain(),
        icon: LayoutGrid,
    },

    {
        title: 'Display: Tension Records',
        href: tensionRecordsDisplay(),
        icon: DatabaseBackupIcon,
    },

    {
        title: 'Display: Finish Earlier Records',
        href: finishEarlierDisplay(),
        icon: LayoutGrid,
    },

];
const inventoryNavItems: NavItem[] = [
   {
        title: 'Record: Batch Stock Taking',
        href: batchStockTakingMain(),
        icon: NotebookIcon,
    },

    {
        title: 'Display: Stock Take Records',
        href: stockTakeRecordsMain(),
        icon: BookAIcon,
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
const footerNavItems: NavItem[] = [
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
    const isElectron = useIsElectron();
    const { status } = useSyncStatus();
    const mainNavItems = getMainNavItems(isElectron);

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
                <NavMain items={mainNavItems} syncStatus={isElectron ? status : undefined} />
                <ProcessParams items={processParamsNavItems} />
                <InventoryNav items={inventoryNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
