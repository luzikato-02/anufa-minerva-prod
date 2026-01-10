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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Users, Shield, MoreHorizontal, Search, Mail, UserCheck, UserX } from 'lucide-react';
import InputError from '@/components/input-error';

interface User {
    id: number;
    name: string;
    email: string;
    username: string;
    roles: string[];
    permissions: string[];
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
}

interface UsersManagementProps {
    users: User[];
    roles: string[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Admin',
        href: '/admin',
    },
    {
        title: 'Users',
        href: '/admin/users',
    },
];

export default function UsersManagement({ users, roles }: UsersManagementProps) {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isRolesDialogOpen, setIsRolesDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const createForm = useForm({
        name: '',
        email: '',
        username: '',
        password: '',
        password_confirmation: '',
        roles: [] as string[],
    });

    const editForm = useForm({
        name: '',
        email: '',
        username: '',
        password: '',
        password_confirmation: '',
        roles: [] as string[],
    });

    const rolesForm = useForm({
        roles: [] as string[],
    });

    const handleCreate = () => {
        createForm.post('/admin/users', {
            onSuccess: () => {
                setIsCreateDialogOpen(false);
                createForm.reset();
            },
        });
    };

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        editForm.setData({
            name: user.name,
            email: user.email,
            username: user.username,
            password: '',
            password_confirmation: '',
            roles: user.roles,
        });
        setIsEditDialogOpen(true);
    };

    const handleUpdate = () => {
        if (!selectedUser) return;
        editForm.put(`/admin/users/${selectedUser.id}`, {
            onSuccess: () => {
                setIsEditDialogOpen(false);
                setSelectedUser(null);
                editForm.reset();
            },
        });
    };

    const handleDelete = (userId: number) => {
        router.delete(`/admin/users/${userId}`);
    };

    const handleEditRoles = (user: User) => {
        setSelectedUser(user);
        rolesForm.setData('roles', user.roles);
        setIsRolesDialogOpen(true);
    };

    const handleUpdateRoles = () => {
        if (!selectedUser) return;
        rolesForm.patch(`/admin/users/${selectedUser.id}/roles`, {
            onSuccess: () => {
                setIsRolesDialogOpen(false);
                setSelectedUser(null);
                rolesForm.reset();
            },
        });
    };

    const toggleCreateRole = (role: string) => {
        const current = createForm.data.roles;
        if (current.includes(role)) {
            createForm.setData('roles', current.filter(r => r !== role));
        } else {
            createForm.setData('roles', [...current, role]);
        }
    };

    const toggleEditRole = (role: string) => {
        const current = editForm.data.roles;
        if (current.includes(role)) {
            editForm.setData('roles', current.filter(r => r !== role));
        } else {
            editForm.setData('roles', [...current, role]);
        }
    };

    const toggleRolesFormRole = (role: string) => {
        const current = rolesForm.data.roles;
        if (current.includes(role)) {
            rolesForm.setData('roles', current.filter(r => r !== role));
        } else {
            rolesForm.setData('roles', [...current, role]);
        }
    };

    const filteredUsers = users.filter(
        (user) =>
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User Management" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Users className="h-8 w-8" />
                            User Management
                        </h1>
                        <p className="text-muted-foreground">
                            Create, edit, and manage user accounts and their roles.
                        </p>
                    </div>

                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Create User
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create New User</DialogTitle>
                                <DialogDescription>
                                    Create a new user account and assign roles.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Full Name</Label>
                                        <Input
                                            id="name"
                                            value={createForm.data.name}
                                            onChange={(e) => createForm.setData('name', e.target.value)}
                                            placeholder="John Doe"
                                        />
                                        <InputError message={createForm.errors.name} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="username">Username</Label>
                                        <Input
                                            id="username"
                                            value={createForm.data.username}
                                            onChange={(e) => createForm.setData('username', e.target.value)}
                                            placeholder="johndoe"
                                        />
                                        <InputError message={createForm.errors.username} />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={createForm.data.email}
                                        onChange={(e) => createForm.setData('email', e.target.value)}
                                        placeholder="john@example.com"
                                    />
                                    <InputError message={createForm.errors.email} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="password">Password</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            value={createForm.data.password}
                                            onChange={(e) => createForm.setData('password', e.target.value)}
                                            placeholder="••••••••"
                                        />
                                        <InputError message={createForm.errors.password} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="password_confirmation">Confirm Password</Label>
                                        <Input
                                            id="password_confirmation"
                                            type="password"
                                            value={createForm.data.password_confirmation}
                                            onChange={(e) => createForm.setData('password_confirmation', e.target.value)}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Assign Roles</Label>
                                    <div className="flex flex-wrap gap-2 border rounded-md p-4">
                                        {roles.length > 0 ? (
                                            roles.map((role) => (
                                                <div key={role} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`create-role-${role}`}
                                                        checked={createForm.data.roles.includes(role)}
                                                        onCheckedChange={() => toggleCreateRole(role)}
                                                    />
                                                    <Label
                                                        htmlFor={`create-role-${role}`}
                                                        className="text-sm font-normal cursor-pointer"
                                                    >
                                                        {role}
                                                    </Label>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No roles available. Create some roles first.
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
                                    Create User
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {filteredUsers.length} user(s) found
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>All Users</CardTitle>
                        <CardDescription>
                            A list of all registered users with their roles and status.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Username</TableHead>
                                        <TableHead>Roles</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created At</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{user.name}</span>
                                                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                                                            <Mail className="h-3 w-3" />
                                                            {user.email}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <code className="bg-muted px-2 py-0.5 rounded text-sm">
                                                        {user.username}
                                                    </code>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {user.roles.length > 0 ? (
                                                            user.roles.map((role) => (
                                                                <Badge key={role} variant="secondary" className="text-xs">
                                                                    <Shield className="mr-1 h-3 w-3" />
                                                                    {role}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">No roles</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {user.email_verified_at ? (
                                                        <Badge variant="default" className="bg-green-500 text-xs">
                                                            <UserCheck className="mr-1 h-3 w-3" />
                                                            Verified
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-xs">
                                                            <UserX className="mr-1 h-3 w-3" />
                                                            Unverified
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {new Date(user.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit User
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleEditRoles(user)}>
                                                                <Shield className="mr-2 h-4 w-4" />
                                                                Manage Roles
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem
                                                                        onSelect={(e) => e.preventDefault()}
                                                                        className="text-destructive focus:text-destructive"
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        Delete User
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Are you sure you want to delete the user "{user.name}"?
                                                                            This action cannot be undone.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            onClick={() => handleDelete(user.id)}
                                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                        >
                                                                            Delete
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                {searchQuery
                                                    ? 'No users match your search.'
                                                    : 'No users found.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Edit User Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit User</DialogTitle>
                            <DialogDescription>
                                Update user information. Leave password blank to keep current password.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-name">Full Name</Label>
                                    <Input
                                        id="edit-name"
                                        value={editForm.data.name}
                                        onChange={(e) => editForm.setData('name', e.target.value)}
                                        placeholder="John Doe"
                                    />
                                    <InputError message={editForm.errors.name} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-username">Username</Label>
                                    <Input
                                        id="edit-username"
                                        value={editForm.data.username}
                                        onChange={(e) => editForm.setData('username', e.target.value)}
                                        placeholder="johndoe"
                                    />
                                    <InputError message={editForm.errors.username} />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-email">Email Address</Label>
                                <Input
                                    id="edit-email"
                                    type="email"
                                    value={editForm.data.email}
                                    onChange={(e) => editForm.setData('email', e.target.value)}
                                    placeholder="john@example.com"
                                />
                                <InputError message={editForm.errors.email} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-password">New Password (optional)</Label>
                                    <Input
                                        id="edit-password"
                                        type="password"
                                        value={editForm.data.password}
                                        onChange={(e) => editForm.setData('password', e.target.value)}
                                        placeholder="Leave blank to keep current"
                                    />
                                    <InputError message={editForm.errors.password} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-password_confirmation">Confirm Password</Label>
                                    <Input
                                        id="edit-password_confirmation"
                                        type="password"
                                        value={editForm.data.password_confirmation}
                                        onChange={(e) => editForm.setData('password_confirmation', e.target.value)}
                                        placeholder="Confirm new password"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Assign Roles</Label>
                                <div className="flex flex-wrap gap-2 border rounded-md p-4">
                                    {roles.length > 0 ? (
                                        roles.map((role) => (
                                            <div key={role} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`edit-role-${role}`}
                                                    checked={editForm.data.roles.includes(role)}
                                                    onCheckedChange={() => toggleEditRole(role)}
                                                />
                                                <Label
                                                    htmlFor={`edit-role-${role}`}
                                                    className="text-sm font-normal cursor-pointer"
                                                >
                                                    {role}
                                                </Label>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            No roles available.
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
                                Update User
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Manage Roles Dialog */}
                <Dialog open={isRolesDialogOpen} onOpenChange={setIsRolesDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Manage User Roles</DialogTitle>
                            <DialogDescription>
                                {selectedUser && `Update roles for ${selectedUser.name}`}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Select Roles</Label>
                                <div className="grid grid-cols-2 gap-2 border rounded-md p-4">
                                    {roles.length > 0 ? (
                                        roles.map((role) => (
                                            <div key={role} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`roles-${role}`}
                                                    checked={rolesForm.data.roles.includes(role)}
                                                    onCheckedChange={() => toggleRolesFormRole(role)}
                                                />
                                                <Label
                                                    htmlFor={`roles-${role}`}
                                                    className="text-sm font-normal cursor-pointer"
                                                >
                                                    {role}
                                                </Label>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground col-span-full">
                                            No roles available.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsRolesDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleUpdateRoles} disabled={rolesForm.processing}>
                                Update Roles
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
