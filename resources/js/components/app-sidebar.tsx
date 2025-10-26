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
import { dashboard, tensionRecordsDisplay, twistingTensionMain, underConstruction, weavingTensionMain, stockTakeRecordsMain, batchStockTakingMain } from '@/routes';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { BookOpen, Folder, LayoutGrid, HomeIcon, ConeIcon, DatabaseBackupIcon, NotebookIcon } from 'lucide-react';
import AppLogo from './app-logo';
import { IconStack2 } from '@tabler/icons-react';
import { InventoryNav } from './inventory-nav';
import { ProcessParams } from './process-parameters';
import RecordBatchStockTake from '@/pages/batch-stock-taking-main';
import BatchStockTaking from './batch-stock-taking';

const mainNavItems: NavItem[] = [
    {
        title: 'Home',
        href: dashboard(),
        icon: HomeIcon,
    },

    {
        title: 'Maintain: User Maintenance Table',
        href: underConstruction(),
        icon: LayoutGrid,
    },
];

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
        title: 'Record: Finish Earlier Spindles',
        href: underConstruction(),
        icon: LayoutGrid,
    },

    {
        title: 'Display: Finish Earlier Records',
        href: underConstruction(),
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
        icon: IconStack2,
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
                <NavMain items={mainNavItems} />
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
