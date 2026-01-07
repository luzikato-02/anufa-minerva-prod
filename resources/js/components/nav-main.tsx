import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { type SyncStatus } from '@/types/electron';
import { Link, usePage } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';

interface NavMainProps {
    items: NavItem[];
    syncStatus?: SyncStatus | null;
}

export function NavMain({ items = [], syncStatus }: NavMainProps) {
    const page = usePage();
    
    const getSyncBadge = (item: NavItem) => {
        if (item.title !== 'Database Sync' || !syncStatus) return null;
        
        const pendingCount = syncStatus.pendingUploads + syncStatus.conflicts;
        if (pendingCount === 0) return null;
        
        return (
            <Badge 
                variant={syncStatus.conflicts > 0 ? 'destructive' : 'secondary'}
                className="ml-auto h-5 min-w-5 px-1 text-[10px]"
            >
                {pendingCount}
            </Badge>
        );
    };

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            isActive={page.url.startsWith(
                                typeof item.href === 'string'
                                    ? item.href
                                    : item.href.url,
                            )}
                            tooltip={{ children: item.title }}
                        >
                            <Link href={item.href} prefetch>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                                {getSyncBadge(item)}
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
