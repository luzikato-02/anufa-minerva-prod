import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Shield, Key, Settings } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dasboard',
    },
    {
        title: 'User Maintenance Table',
        href: '/admin',
    },
];

export default function AdminDashboard() {
    const adminCards = [
        {
            title: 'User Management',
            description: 'Create, edit, and delete user accounts. Assign roles to users.',
            icon: Users,
            href: '/admin/users',
            color: 'bg-blue-500',
        },
        {
            title: 'Role Management',
            description: 'Create and manage roles. Assign permissions to roles.',
            icon: Shield,
            href: '/admin/roles',
            color: 'bg-green-500',
        },
        {
            title: 'Permission Management',
            description: 'Create and manage system permissions.',
            icon: Key,
            href: '/admin/permissions',
            color: 'bg-orange-500',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Admin Dashboard" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                    <p className="text-muted-foreground">
                        Manage users, roles, and permissions for your application.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {adminCards.map((card) => (
                        <Link
                            key={card.title}
                            href={card.href}
                            className="group transition-transform hover:scale-[1.02]"
                        >
                            <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg">
                                <CardHeader className="flex flex-row items-center gap-4">
                                    <div className={`rounded-lg p-3 ${card.color}`}>
                                        <card.icon className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className="group-hover:text-primary transition-colors">
                                            {card.title}
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="text-sm">
                                        {card.description}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Quick Tips
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                            <li>Roles are collections of permissions that can be assigned to users.</li>
                            <li>Permissions define specific actions users can perform in the system.</li>
                            <li>Users can have multiple roles, inheriting all associated permissions.</li>
                            <li>The "admin" and "super-admin" roles cannot be deleted for security.</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
