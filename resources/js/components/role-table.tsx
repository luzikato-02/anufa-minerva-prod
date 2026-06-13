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
import { MoreHorizontal, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SaveStatusDialog, type SaveStep } from './save-status-dialog';

export interface PermissionData {
    id: number;
    name: string;
}

export interface RoleData {
    id: number;
    name: string;
    permissions: PermissionData[];
}

const PERMISSION_GROUPS: { label: string; prefix: string }[] = [
    { label: 'Tension Records', prefix: 'tension-records' },
    { label: 'Stock Take', prefix: 'stock-take' },
    { label: 'Finish Earlier', prefix: 'finish-earlier' },
    { label: 'Users', prefix: 'users' },
    { label: 'Roles', prefix: 'roles' },
    { label: 'Activity Log', prefix: 'activity-log' },
];

function permissionLabel(name: string): string {
    const action = name.split('.')[1] ?? name;
    return action.charAt(0).toUpperCase() + action.slice(1);
}

async function getCsrfToken(): Promise<string> {
    const baseUrl = window.location.origin;
    await fetch(`${baseUrl}/csrf-token`, { credentials: 'include' });
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function RoleFormDialog({
    mode,
    role,
    allPermissions,
    onSaved,
    onCloseMenu,
    trigger,
}: {
    mode: 'create' | 'edit';
    role?: RoleData;
    allPermissions: PermissionData[];
    onSaved: () => void;
    onCloseMenu?: () => void;
    trigger: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(role?.name ?? '');
    const [selected, setSelected] = useState<Set<string>>(
        new Set((role?.permissions ?? []).map((p) => p.name)),
    );
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saving' | 'success' | 'error'>('saving');
    const [saveSteps, setSaveSteps] = useState<SaveStep[]>([]);
    const [saveError, setSaveError] = useState<{ message: string; details: string } | null>(null);

    // Close the parent row-actions dropdown once this dialog finishes closing,
    // so it doesn't reappear behind the now-closed dialog.
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (wasOpenRef.current && !open) {
            onCloseMenu?.();
        }
        wasOpenRef.current = open;
    }, [open, onCloseMenu]);

    useEffect(() => {
        if (open) {
            setName(role?.name ?? '');
            setSelected(new Set((role?.permissions ?? []).map((p) => p.name)));
        }
    }, [open, role]);

    const togglePermission = (perm: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(perm)) {
                next.delete(perm);
            } else {
                next.add(perm);
            }
            return next;
        });
    };

    const handleSubmit = async () => {
        setSaveError(null);
        setSaveStatus('saving');
        setSaveSteps([{ key: 'save', label: mode === 'create' ? 'Creating role' : 'Saving role changes', status: 'active' }]);
        setSaveDialogOpen(true);

        try {
            const csrfToken = await getCsrfToken();
            const baseUrl = window.location.origin;
            const url = mode === 'create' ? `${baseUrl}/api/roles` : `${baseUrl}/api/roles/${role!.id}`;
            const res = await fetch(url, {
                method: mode === 'create' ? 'POST' : 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify({ name, permissions: Array.from(selected) }),
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
            setSaveError({ message: e.message ?? 'Error saving role', details: String(e) });
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
                <DialogContent className="sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>{mode === 'create' ? 'Create Role' : `Edit Role: ${role?.name}`}</DialogTitle>
                        <DialogDescription>
                            {mode === 'create'
                                ? 'Define a new role and assign its permissions.'
                                : 'Update the role name and its assigned permissions.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[60vh] space-y-4 overflow-y-auto">
                        <div className="space-y-1">
                            <Label htmlFor="role-name">Role Name</Label>
                            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>

                        <div className="space-y-3">
                            <p className="text-sm font-semibold">Permissions</p>
                            {PERMISSION_GROUPS.map((group) => {
                                const perms = allPermissions.filter((p) => p.name.startsWith(`${group.prefix}.`));
                                if (perms.length === 0) return null;
                                return (
                                    <div key={group.prefix} className="rounded-md border p-3">
                                        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">{group.label}</p>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                            {perms.map((perm) => (
                                                <div key={perm.name} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`perm-${mode}-${role?.id ?? 'new'}-${perm.name}`}
                                                        checked={selected.has(perm.name)}
                                                        onCheckedChange={() => togglePermission(perm.name)}
                                                    />
                                                    <Label
                                                        htmlFor={`perm-${mode}-${role?.id ?? 'new'}-${perm.name}`}
                                                        className="text-sm font-normal"
                                                    >
                                                        {permissionLabel(perm.name)}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={!name || (saveDialogOpen && saveStatus === 'saving')}>
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

function DeleteRoleAlert({ role, onDeleted, onCloseMenu }: { role: RoleData; onDeleted: () => void; onCloseMenu?: () => void }) {
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
            await fetch(`${baseUrl}/api/roles/${role.id}`, {
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
                    <AlertDialogTitle>Delete role "{role.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Any users currently assigned to this role will lose its permissions. This action cannot be undone.
                    </AlertDialogDescription>
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

function RoleActionsCell({
    role,
    allPermissions,
    onChanged,
}: {
    role: RoleData;
    allPermissions: PermissionData[];
    onChanged: () => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                <RoleFormDialog
                    mode="edit"
                    role={role}
                    allPermissions={allPermissions}
                    onSaved={onChanged}
                    onCloseMenu={() => setMenuOpen(false)}
                    trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <PencilIcon />
                            Edit
                        </DropdownMenuItem>
                    }
                />
                <DropdownMenuSeparator />
                <DeleteRoleAlert role={role} onDeleted={onChanged} onCloseMenu={() => setMenuOpen(false)} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function RoleDataTable() {
    const [roles, setRoles] = useState<RoleData[]>([]);
    const [permissions, setPermissions] = useState<PermissionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const baseUrl = window.location.origin;
        const controller = new AbortController();
        setLoading(true);

        Promise.all([
            fetch(`${baseUrl}/api/roles`, { credentials: 'include', signal: controller.signal }).then((r) => r.json()),
            fetch(`${baseUrl}/api/permissions`, { credentials: 'include', signal: controller.signal }).then((r) => r.json()),
        ])
            .then(([rolesData, permissionsData]) => {
                setRoles(rolesData);
                setPermissions(permissionsData);
            })
            .catch((e) => {
                if (e.name !== 'AbortError') console.error(e);
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, [refreshKey]);

    const refetch = () => setRefreshKey((k) => k + 1);

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-end">
                <RoleFormDialog
                    mode="create"
                    allPermissions={permissions}
                    onSaved={refetch}
                    trigger={
                        <Button>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            New Role
                        </Button>
                    }
                />
            </div>
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[160px]">Role</TableHead>
                            <TableHead>Permissions</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {roles.length ? (
                            roles.map((role) => (
                                <TableRow key={role.id}>
                                    <TableCell className="font-medium capitalize">{role.name}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {role.permissions.length ? (
                                                role.permissions.map((perm) => (
                                                    <Badge key={perm.id} variant="secondary">
                                                        {perm.name}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-sm text-muted-foreground">No permissions</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <RoleActionsCell role={role} allPermissions={permissions} onChanged={refetch} />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    {loading ? 'Loading...' : 'No roles found.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
