'use client';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { MoreHorizontal, PencilIcon, PlusIcon, ShieldIcon, Trash2Icon } from 'lucide-react';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { SaveStatusDialog, type SaveStep } from './save-status-dialog';

export interface RoleRef {
    id: number;
    name: string;
}

export interface UserData {
    id: number;
    name: string;
    username: string;
    email: string;
    roles: RoleRef[];
    created_at?: string;
}

interface LaravelPaginatedResponse<T> {
    current_page: number;
    data: T[];
    last_page: number;
    per_page: number;
    total: number;
}

type UserTableMeta = {
    refetch: () => void;
    allRoles: RoleRef[];
    currentUserId: number;
};

async function getCsrfToken(): Promise<string> {
    const baseUrl = window.location.origin;
    await fetch(`${baseUrl}/csrf-token`, { credentials: 'include' });
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function roleLabel(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function UserFormDialog({
    mode,
    user,
    allRoles,
    onSaved,
    onCloseMenu,
    trigger,
}: {
    mode: 'create' | 'edit';
    user?: UserData;
    allRoles: RoleRef[];
    onSaved: () => void;
    onCloseMenu?: () => void;
    trigger: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(user?.name ?? '');
    const [username, setUsername] = useState(user?.username ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [password, setPassword] = useState('');
    const [selectedRoles, setSelectedRoles] = useState<Set<string>>(
        new Set((user?.roles ?? []).map((r) => r.name)),
    );
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saving' | 'success' | 'error'>('saving');
    const [saveSteps, setSaveSteps] = useState<SaveStep[]>([]);
    const [saveError, setSaveError] = useState<{ message: string; details: string } | null>(null);

    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (wasOpenRef.current && !open) {
            onCloseMenu?.();
        }
        wasOpenRef.current = open;
    }, [open, onCloseMenu]);

    useEffect(() => {
        if (open) {
            setName(user?.name ?? '');
            setUsername(user?.username ?? '');
            setEmail(user?.email ?? '');
            setPassword('');
            setSelectedRoles(new Set((user?.roles ?? []).map((r) => r.name)));
        }
    }, [open, user]);

    const toggleRole = (role: string) => {
        setSelectedRoles((prev) => {
            const next = new Set(prev);
            if (next.has(role)) {
                next.delete(role);
            } else {
                next.add(role);
            }
            return next;
        });
    };

    const handleSubmit = async () => {
        setSaveError(null);
        setSaveStatus('saving');
        setSaveSteps([{ key: 'save', label: mode === 'create' ? 'Creating user' : 'Saving user changes', status: 'active' }]);
        setSaveDialogOpen(true);

        const payload: Record<string, unknown> =
            mode === 'create'
                ? { name, username, email, password, roles: Array.from(selectedRoles) }
                : { name, username, email, ...(password ? { password } : {}) };

        try {
            const csrfToken = await getCsrfToken();
            const baseUrl = window.location.origin;
            const url = mode === 'create' ? `${baseUrl}/api/users` : `${baseUrl}/api/users/${user!.id}`;
            const res = await fetch(url, {
                method: mode === 'create' ? 'POST' : 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const resultText = await res.text();
            let result: any;
            try {
                result = JSON.parse(resultText);
            } catch {
                result = { message: resultText };
            }

            if (!res.ok) {
                setSaveSteps((prev) => prev.map((s) => ({ ...s, status: 'error' })));
                setSaveStatus('error');
                setSaveError({
                    message: result.message || `HTTP ${res.status}`,
                    details: JSON.stringify(result, null, 2),
                });
                return;
            }

            setSaveSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
            setSaveStatus('success');
        } catch (e: any) {
            setSaveSteps((prev) => prev.map((s) => ({ ...s, status: 'error' })));
            setSaveStatus('error');
            setSaveError({ message: e.message ?? 'Error saving user', details: String(e) });
        }
    };

    const handleSaveDialogClose = () => {
        setSaveDialogOpen(false);
        if (saveStatus === 'success') {
            setOpen(false);
            onSaved();
        }
    };

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!next && saveDialogOpen && saveStatus === 'saving') return;
                    setOpen(next);
                }}
            >
                <DialogTrigger asChild>{trigger}</DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{mode === 'create' ? 'Create User' : `Edit User: ${user?.name}`}</DialogTitle>
                        <DialogDescription>
                            {mode === 'create' ? 'Add a new user account.' : 'Update this user\'s account details.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="user-name">Name</Label>
                            <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="user-username">Username</Label>
                            <Input id="user-username" value={username} onChange={(e) => setUsername(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="user-email">Email</Label>
                            <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="user-password">{mode === 'create' ? 'Password' : 'New Password (optional)'}</Label>
                            <Input
                                id="user-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={mode === 'edit' ? 'Leave blank to keep current password' : ''}
                            />
                        </div>
                        {mode === 'create' && (
                            <div className="space-y-1">
                                <Label>Roles</Label>
                                <div className="flex flex-wrap gap-3 rounded-md border p-3">
                                    {allRoles.map((role) => (
                                        <div key={role.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`create-role-${role.id}`}
                                                checked={selectedRoles.has(role.name)}
                                                onCheckedChange={() => toggleRole(role.name)}
                                            />
                                            <Label htmlFor={`create-role-${role.id}`} className="text-sm font-normal">
                                                {roleLabel(role.name)}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={
                                !name ||
                                !username ||
                                !email ||
                                (mode === 'create' && !password) ||
                                (saveDialogOpen && saveStatus === 'saving')
                            }
                        >
                            {saveDialogOpen && saveStatus === 'saving' ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <SaveStatusDialog
                open={saveDialogOpen}
                status={saveStatus}
                steps={saveSteps}
                errorMessage={saveError?.message}
                errorDetails={saveError?.details}
                onRetry={saveStatus === 'error' ? handleSubmit : undefined}
                onClose={handleSaveDialogClose}
            />
        </>
    );
}

function ManageRolesDialog({
    user,
    allRoles,
    onSaved,
    onCloseMenu,
}: {
    user: UserData;
    allRoles: RoleRef[];
    onSaved: () => void;
    onCloseMenu?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set(user.roles.map((r) => r.name)));
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saving' | 'success' | 'error'>('saving');
    const [saveSteps, setSaveSteps] = useState<SaveStep[]>([]);
    const [saveError, setSaveError] = useState<{ message: string; details: string } | null>(null);

    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (wasOpenRef.current && !open) {
            onCloseMenu?.();
        }
        wasOpenRef.current = open;
    }, [open, onCloseMenu]);

    useEffect(() => {
        if (open) {
            setSelectedRoles(new Set(user.roles.map((r) => r.name)));
        }
    }, [open, user]);

    const toggleRole = (role: string) => {
        setSelectedRoles((prev) => {
            const next = new Set(prev);
            if (next.has(role)) {
                next.delete(role);
            } else {
                next.add(role);
            }
            return next;
        });
    };

    const handleSubmit = async () => {
        setSaveError(null);
        setSaveStatus('saving');
        setSaveSteps([{ key: 'save', label: 'Updating roles', status: 'active' }]);
        setSaveDialogOpen(true);

        try {
            const csrfToken = await getCsrfToken();
            const baseUrl = window.location.origin;
            const res = await fetch(`${baseUrl}/api/users/${user.id}/roles`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify({ roles: Array.from(selectedRoles) }),
            });

            const resultText = await res.text();
            let result: any;
            try {
                result = JSON.parse(resultText);
            } catch {
                result = { message: resultText };
            }

            if (!res.ok) {
                setSaveSteps((prev) => prev.map((s) => ({ ...s, status: 'error' })));
                setSaveStatus('error');
                setSaveError({
                    message: result.message || `HTTP ${res.status}`,
                    details: JSON.stringify(result, null, 2),
                });
                return;
            }

            setSaveSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
            setSaveStatus('success');
        } catch (e: any) {
            setSaveSteps((prev) => prev.map((s) => ({ ...s, status: 'error' })));
            setSaveStatus('error');
            setSaveError({ message: e.message ?? 'Error updating roles', details: String(e) });
        }
    };

    const handleSaveDialogClose = () => {
        setSaveDialogOpen(false);
        if (saveStatus === 'success') {
            setOpen(false);
            onSaved();
        }
    };

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!next && saveDialogOpen && saveStatus === 'saving') return;
                    setOpen(next);
                }}
            >
                <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <ShieldIcon />
                        Manage Roles
                    </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Manage Roles: {user.name}</DialogTitle>
                        <DialogDescription>Assign one or more roles to this user.</DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-3 rounded-md border p-3">
                        {allRoles.map((role) => (
                            <div key={role.id} className="flex items-center gap-2">
                                <Checkbox
                                    id={`manage-role-${user.id}-${role.id}`}
                                    checked={selectedRoles.has(role.name)}
                                    onCheckedChange={() => toggleRole(role.name)}
                                />
                                <Label htmlFor={`manage-role-${user.id}-${role.id}`} className="text-sm font-normal">
                                    {roleLabel(role.name)}
                                </Label>
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={saveDialogOpen && saveStatus === 'saving'}>
                            {saveDialogOpen && saveStatus === 'saving' ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <SaveStatusDialog
                open={saveDialogOpen}
                status={saveStatus}
                steps={saveSteps}
                errorMessage={saveError?.message}
                errorDetails={saveError?.details}
                onRetry={saveStatus === 'error' ? handleSubmit : undefined}
                onClose={handleSaveDialogClose}
            />
        </>
    );
}

function DeleteUserAlert({ user, onDeleted, onCloseMenu }: { user: UserData; onDeleted: () => void; onCloseMenu?: () => void }) {
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (wasOpenRef.current && !open) {
            onCloseMenu?.();
        }
        wasOpenRef.current = open;
    }, [open, onCloseMenu]);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const csrfToken = await getCsrfToken();
            const baseUrl = window.location.origin;
            await fetch(`${baseUrl}/api/users/${user.id}`, {
                method: 'DELETE',
                headers: { Accept: 'application/json', 'X-XSRF-TOKEN': csrfToken },
                credentials: 'include',
            });
            setOpen(false);
            onDeleted();
        } finally {
            setDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                    <Trash2Icon className="text-destructive" />
                    Delete
                </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete user "{user.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently remove this user account. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                        {deleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function UserActionsCell({ user, meta }: { user: UserData; meta: UserTableMeta }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const isSelf = user.id === meta.currentUserId;

    return (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                <UserFormDialog
                    mode="edit"
                    user={user}
                    allRoles={meta.allRoles}
                    onSaved={meta.refetch}
                    onCloseMenu={() => setMenuOpen(false)}
                    trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <PencilIcon />
                            Edit
                        </DropdownMenuItem>
                    }
                />
                <ManageRolesDialog
                    user={user}
                    allRoles={meta.allRoles}
                    onSaved={meta.refetch}
                    onCloseMenu={() => setMenuOpen(false)}
                />
                {!isSelf && (
                    <>
                        <DropdownMenuSeparator />
                        <DeleteUserAlert user={user} onDeleted={meta.refetch} onCloseMenu={() => setMenuOpen(false)} />
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export const columns: ColumnDef<UserData>[] = [
    {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
        accessorKey: 'username',
        header: 'Username',
        cell: ({ row }) => <div>{row.original.username}</div>,
    },
    {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => <div className="lowercase">{row.original.email}</div>,
    },
    {
        id: 'roles',
        header: 'Roles',
        cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
                {row.original.roles.length ? (
                    row.original.roles.map((role) => (
                        <Badge key={role.id} variant="secondary" className="capitalize">
                            {role.name}
                        </Badge>
                    ))
                ) : (
                    <span className="text-sm text-muted-foreground">No role</span>
                )}
            </div>
        ),
    },
    {
        id: 'actions',
        header: 'Actions',
        enableHiding: false,
        cell: ({ row, table }) => <UserActionsCell user={row.original} meta={table.options.meta as UserTableMeta} />,
    },
];

export function UserDataTable() {
    const { auth } = usePage<SharedData>().props;
    const [data, setData] = useState<UserData[]>([]);
    const [allRoles, setAllRoles] = useState<RoleRef[]>([]);
    const [totalRows, setTotalRows] = useState(0);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    const [refreshKey, setRefreshKey] = useState(0);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount,
        state: {
            pagination,
        },
        onPaginationChange: setPagination,
        meta: {
            refetch: () => setRefreshKey((k) => k + 1),
            allRoles,
            currentUserId: auth.user.id,
        },
    });

    useEffect(() => {
        const baseUrl = window.location.origin;
        const controller = new AbortController();

        fetch(`${baseUrl}/api/roles`, { credentials: 'include', signal: controller.signal })
            .then((r) => r.json())
            .then((roles: { id: number; name: string }[]) => setAllRoles(roles.map((r) => ({ id: r.id, name: r.name }))))
            .catch((e) => {
                if (e.name !== 'AbortError') console.error(e);
            });

        return () => controller.abort();
    }, []);

    useEffect(() => {
        const baseUrl = window.location.origin;
        const controller = new AbortController();

        const fetchData = async () => {
            setLoading(true);

            const params = new URLSearchParams({
                page: (pagination.pageIndex + 1).toString(),
                per_page: pagination.pageSize.toString(),
            });

            if (search) {
                params.append('search', search);
            }

            try {
                const response = await fetch(`${baseUrl}/api/users?${params.toString()}`, {
                    credentials: 'include',
                    signal: controller.signal,
                });

                const json: LaravelPaginatedResponse<UserData> = await response.json();

                setData(json.data);
                setTotalRows(json.total);
                setPageCount(json.last_page);
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error('Fetch error:', error);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => controller.abort();
    }, [pagination.pageIndex, pagination.pageSize, search, refreshKey]);

    return (
        <div className="w-full">
            <div className="flex items-center py-4">
                <Input
                    placeholder="Search by name, username, or email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />
                <UserFormDialog
                    mode="create"
                    allRoles={allRoles}
                    onSaved={() => setRefreshKey((k) => k + 1)}
                    trigger={
                        <Button className="ml-auto">
                            <PlusIcon className="mr-2 h-4 w-4" />
                            New User
                        </Button>
                    }
                />
            </div>
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    {loading ? 'Loading...' : 'No users found.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">{totalRows} total user(s).</div>
                <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                        Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
