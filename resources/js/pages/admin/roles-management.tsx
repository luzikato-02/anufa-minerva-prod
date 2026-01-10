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
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Pencil, Trash2, Shield, Users, Key } from 'lucide-react';
import InputError from '@/components/input-error';

interface Role {
    id: number;
    name: string;
    guard_name: string;
    permissions: string[];
    permissions_count: number;
    users_count: number;
    created_at: string;
    updated_at: string;
}

interface RolesManagementProps {
    roles: Role[];
    permissions: string[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Admin',
        href: '/admin',
    },
    {
        title: 'Roles',
        href: '/admin/roles',
    },
];

export default function RolesManagement({ roles, permissions }: RolesManagementProps) {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);

    const createForm = useForm({
        name: '',
        permissions: [] as string[],
    });

    const editForm = useForm({
        name: '',
        permissions: [] as string[],
    });

    const handleCreate = () => {
        createForm.post('/admin/roles', {
            onSuccess: () => {
                setIsCreateDialogOpen(false);
                createForm.reset();
            },
        });
    };

    const handleEdit = (role: Role) => {
        setSelectedRole(role);
        editForm.setData({
            name: role.name,
            permissions: role.permissions,
        });
        setIsEditDialogOpen(true);
    };

    const handleUpdate = () => {
        if (!selectedRole) return;
        editForm.put(`/admin/roles/${selectedRole.id}`, {
            onSuccess: () => {
                setIsEditDialogOpen(false);
                setSelectedRole(null);
                editForm.reset();
            },
        });
    };

    const handleDelete = (roleId: number) => {
        router.delete(`/admin/roles/${roleId}`);
    };

    const toggleCreatePermission = (permission: string) => {
        const current = createForm.data.permissions;
        if (current.includes(permission)) {
            createForm.setData('permissions', current.filter(p => p !== permission));
        } else {
            createForm.setData('permissions', [...current, permission]);
        }
    };

    const toggleEditPermission = (permission: string) => {
        const current = editForm.data.permissions;
        if (current.includes(permission)) {
            editForm.setData('permissions', current.filter(p => p !== permission));
        } else {
            editForm.setData('permissions', [...current, permission]);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Role Management" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Shield className="h-8 w-8" />
                            Role Management
                        </h1>
                        <p className="text-muted-foreground">
                            Create and manage roles for your application.
                        </p>
                    </div>

                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Role
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create New Role</DialogTitle>
                                <DialogDescription>
                                    Create a new role and assign permissions to it.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Role Name</Label>
                                    <Input
                                        id="name"
                                        value={createForm.data.name}
                                        onChange={(e) => createForm.setData('name', e.target.value)}
                                        placeholder="e.g., editor, moderator"
                                    />
                                    <InputError message={createForm.errors.name} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Permissions</Label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto border rounded-md p-4">
                                        {permissions.length > 0 ? (
                                            permissions.map((permission) => (
                                                <div key={permission} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`create-${permission}`}
                                                        checked={createForm.data.permissions.includes(permission)}
                                                        onCheckedChange={() => toggleCreatePermission(permission)}
                                                    />
                                                    <Label
                                                        htmlFor={`create-${permission}`}
                                                        className="text-sm font-normal cursor-pointer"
                                                    >
                                                        {permission}
                                                    </Label>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground col-span-full">
                                                No permissions available. Create some permissions first.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleCreate} disabled={createForm.processing}>
                                    Create Role
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>All Roles</CardTitle>
                        <CardDescription>
                            A list of all roles in the system with their permissions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Role Name</TableHead>
                                        <TableHead>Permissions</TableHead>
                                        <TableHead className="text-center">Users</TableHead>
                                        <TableHead>Created At</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {roles.length > 0 ? (
                                        roles.map((role) => (
                                            <TableRow key={role.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                                        {role.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1 max-w-md">
                                                        {role.permissions.length > 0 ? (
                                                            role.permissions.slice(0, 3).map((permission) => (
                                                                <Badge key={permission} variant="secondary" className="text-xs">
                                                                    {permission}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">No permissions</span>
                                                        )}
                                                        {role.permissions.length > 3 && (
                                                            <Badge variant="outline" className="text-xs">
                                                                +{role.permissions.length - 3} more
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Users className="h-4 w-4 text-muted-foreground" />
                                                        {role.users_count}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {new Date(role.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEdit(role)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    disabled={['admin', 'super-admin'].includes(role.name)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Are you sure you want to delete the role "{role.name}"?
                                                                        This action cannot be undone.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => handleDelete(role.id)}
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
                                            <TableCell colSpan={5} className="h-24 text-center">
                                                No roles found. Create your first role.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Edit Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Role</DialogTitle>
                            <DialogDescription>
                                Update the role name and permissions.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-name">Role Name</Label>
                                <Input
                                    id="edit-name"
                                    value={editForm.data.name}
                                    onChange={(e) => editForm.setData('name', e.target.value)}
                                    placeholder="e.g., editor, moderator"
                                />
                                <InputError message={editForm.errors.name} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Permissions</Label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto border rounded-md p-4">
                                    {permissions.length > 0 ? (
                                        permissions.map((permission) => (
                                            <div key={permission} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`edit-${permission}`}
                                                    checked={editForm.data.permissions.includes(permission)}
                                                    onCheckedChange={() => toggleEditPermission(permission)}
                                                />
                                                <Label
                                                    htmlFor={`edit-${permission}`}
                                                    className="text-sm font-normal cursor-pointer"
                                                >
                                                    {permission}
                                                </Label>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground col-span-full">
                                            No permissions available.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleUpdate} disabled={editForm.processing}>
                                Update Role
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
