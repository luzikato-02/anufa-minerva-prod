import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Shield } from 'lucide-react';

export function AdminNav({ items = [] }: { items: NavItem[] }) {
    const page = usePage();
    
    // Check if user has admin role - this will be passed from the backend
    const auth = page.props.auth as { user?: { roles?: string[] } } | undefined;
    const userRoles = auth?.user?.roles || [];
    const isAdmin = userRoles.some(role => ['admin', 'super-admin'].includes(role));

    // Don't render if user is not an admin
    if (!isAdmin) {
        return null;
    }

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Administration
            </SidebarGroupLabel>
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
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
