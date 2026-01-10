import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Key, Shield, Search } from 'lucide-react';
import InputError from '@/components/input-error';

interface Permission {
    id: number;
    name: string;
    guard_name: string;
    roles: string[];
    roles_count: number;
    created_at: string;
    updated_at: string;
}

interface PermissionsManagementProps {
    permissions: Permission[];
    roles: string[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'User Maintenance Table',
        href: '/admin',
    },
    {
        title: 'Role Permissions Management',
        href: '/admin/permissions',
    },
];

export default function PermissionsManagement({ permissions, roles }: PermissionsManagementProps) {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const createForm = useForm({
        name: '',
    });

    const editForm = useForm({
        name: '',
    });

    const handleCreate = () => {
        createForm.post('/admin/permissions', {
            onSuccess: () => {
                setIsCreateDialogOpen(false);
                createForm.reset();
            },
        });
    };

    const handleEdit = (permission: Permission) => {
        setSelectedPermission(permission);
        editForm.setData({
            name: permission.name,
        });
        setIsEditDialogOpen(true);
    };

    const handleUpdate = () => {
        if (!selectedPermission) return;
        editForm.put(`/admin/permissions/${selectedPermission.id}`, {
            onSuccess: () => {
                setIsEditDialogOpen(false);
                setSelectedPermission(null);
                editForm.reset();
            },
        });
    };

    const handleDelete = (permissionId: number) => {
        router.delete(`/admin/permissions/${permissionId}`);
    };

    const filteredPermissions = permissions.filter((permission) =>
        permission.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group permissions by prefix (e.g., "users.create" -> "users")
    const groupedPermissions = filteredPermissions.reduce((acc, permission) => {
        const prefix = permission.name.split('.')[0] || 'other';
        if (!acc[prefix]) {
            acc[prefix] = [];
        }
        acc[prefix].push(permission);
        return acc;
    }, {} as Record<string, Permission[]>);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Permission Management" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Key className="h-8 w-8" />
                            Permission Management
                        </h1>
                        <p className="text-muted-foreground">
                            Create and manage permissions for your application.
                        </p>
                    </div>

                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Permission
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Permission</DialogTitle>
                                <DialogDescription>
                                    Create a new permission. Use dot notation for grouping (e.g., users.create, posts.edit).
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Permission Name</Label>
                                    <Input
                                        id="name"
                                        value={createForm.data.name}
                                        onChange={(e) => createForm.setData('name', e.target.value)}
                                        placeholder="e.g., users.create, posts.delete"
                                    />
                                    <InputError message={createForm.errors.name} />
                                    <p className="text-xs text-muted-foreground">
                                        Use lowercase and dot notation for better organization.
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleCreate} disabled={createForm.processing}>
                                    Create Permission
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search permissions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {filteredPermissions.length} permission(s) found
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>All Permissions</CardTitle>
                        <CardDescription>
                            A list of all permissions in the system with their associated roles.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Permission Name</TableHead>
                                        <TableHead>Associated Roles</TableHead>
                                        <TableHead>Created At</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPermissions.length > 0 ? (
                                        filteredPermissions.map((permission) => (
                                            <TableRow key={permission.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Key className="h-4 w-4 text-muted-foreground" />
                                                        <code className="bg-muted px-2 py-0.5 rounded text-sm">
                                                            {permission.name}
                                                        </code>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1 max-w-md">
                                                        {permission.roles.length > 0 ? (
                                                            permission.roles.map((role) => (
                                                                <Badge key={role} variant="outline" className="text-xs">
                                                                    <Shield className="mr-1 h-3 w-3" />
                                                                    {role}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">
                                                                Not assigned to any role
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {new Date(permission.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEdit(permission)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon">
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete Permission</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Are you sure you want to delete the permission "{permission.name}"?
                                                                        This will remove it from all roles. This action cannot be undone.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => handleDelete(permission.id)}
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                    >
                                                                        Delete
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                {searchQuery
                                                    ? 'No permissions match your search.'
                                                    : 'No permissions found. Create your first permission.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Create Suggestions */}
                {permissions.length === 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Common Permissions</CardTitle>
                            <CardDescription>
                                Click to quickly create common permissions.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    'users.view',
                                    'users.create',
                                    'users.edit',
                                    'users.delete',
                                    'roles.view',
                                    'roles.create',
                                    'roles.edit',
                                    'roles.delete',
                                    'settings.view',
                                    'settings.edit',
                                ].map((suggestion) => (
                                    <Button
                                        key={suggestion}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            createForm.setData('name', suggestion);
                                            setIsCreateDialogOpen(true);
                                        }}
                                    >
                                        <Plus className="mr-1 h-3 w-3" />
                                        {suggestion}
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Edit Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Permission</DialogTitle>
                            <DialogDescription>
                                Update the permission name.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-name">Permission Name</Label>
                                <Input
                                    id="edit-name"
                                    value={editForm.data.name}
                                    onChange={(e) => editForm.setData('name', e.target.value)}
                                    placeholder="e.g., users.create, posts.delete"
                                />
                                <InputError message={editForm.errors.name} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleUpdate} disabled={editForm.processing}>
                                Update Permission
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
