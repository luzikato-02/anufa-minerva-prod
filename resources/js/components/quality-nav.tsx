import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';

export function QualityNav({ items = [] }: { items: NavItem[] }) {
    const page = usePage();
    if (items.length === 0) return null;
    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Quality Documents</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    const href =
                        typeof item.href === 'string'
                            ? item.href
                            : item.href.url;
                    return (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                // "/control-plans" must not also light up for "/control-plan-references".
                                isActive={
                                    page.url === href ||
                                    page.url.startsWith(`${href}/`) ||
                                    page.url.startsWith(`${href}?`)
                                }
                                tooltip={{ children: item.title }}
                            >
                                <Link href={item.href} prefetch>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
