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
import {
    CheckIcon,
    MoreHorizontal,
    PencilIcon,
    PlusIcon,
    Trash2Icon,
} from 'lucide-react';
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
    { label: 'Creel Visualization', prefix: 'creel' },
    { label: 'Machine Maintenance', prefix: 'machine-maintenance' },
    { label: 'Torque Checks', prefix: 'torque-checks' },
    { label: 'Creel Types', prefix: 'creel-types' },
    { label: 'Control Plans', prefix: 'control-plans' },
    { label: 'Runtime', prefix: 'runtime' },
    { label: 'Energy', prefix: 'energy' },
    { label: 'Users', prefix: 'users' },
    { label: 'Roles', prefix: 'roles' },
    { label: 'Activity Log', prefix: 'activity-log' },
];

/** Permissions no group above claims, so a newly added one still shows up in the dialog. */
const OTHER_GROUP = { label: 'Other', prefix: '' };

function permissionsIn(
    group: { prefix: string },
    all: PermissionData[],
): PermissionData[] {
    if (group.prefix)
        return all.filter((p) => p.name.startsWith(`${group.prefix}.`));
    return all.filter(
        (p) =>
            !PERMISSION_GROUPS.some((g) => p.name.startsWith(`${g.prefix}.`)),
    );
}

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
    const [saveStatus, setSaveStatus] = useState<
        'saving' | 'success' | 'error'
    >('saving');
    const [saveSteps, setSaveSteps] = useState<SaveStep[]>([]);
    const [saveError, setSaveError] = useState<{
        message: string;
        details: string;
    } | null>(null);

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
        setSaveSteps([
            {
                key: 'save',
                label:
                    mode === 'create' ? 'Creating role' : 'Saving role changes',
                status: 'active',
            },
        ]);
        setSaveDialogOpen(true);

        try {
            const csrfToken = await getCsrfToken();
            const baseUrl = window.location.origin;
            const url =
                mode === 'create'
                    ? `${baseUrl}/api/roles`
                    : `${baseUrl}/api/roles/${role!.id}`;
            const res = await fetch(url, {
                method: mode === 'create' ? 'POST' : 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify({
                    name,
                    permissions: Array.from(selected),
                }),
            });

            const resultText = await res.text();
            let result: { message?: string } & Record<string, unknown>;
            try {
                result = JSON.parse(resultText);
            } catch {
                result = { message: resultText };
            }

            if (!res.ok) {
                setSaveSteps((prev) =>
                    prev.map((s) => ({ ...s, status: 'error' })),
                );
                setSaveStatus('error');
                setSaveError({
                    message: result.message || `HTTP ${res.status}`,
                    details: JSON.stringify(result, null, 2),
                });
                return;
            }

            setSaveSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
            setSaveStatus('success');
        } catch (e: unknown) {
            setSaveSteps((prev) =>
                prev.map((s) => ({ ...s, status: 'error' })),
            );
            setSaveStatus('error');
            setSaveError({
                message: e instanceof Error ? e.message : 'Error saving role',
                details: String(e),
            });
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
                    if (!next && saveDialogOpen && saveStatus === 'saving')
                        return;
                    setOpen(next);
                }}
            >
                <DialogTrigger asChild>{trigger}</DialogTrigger>
                <DialogContent className="sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>
                            {mode === 'create'
                                ? 'Create Role'
                                : `Edit Role: ${role?.name}`}
                        </DialogTitle>
                        <DialogDescription>
                            {mode === 'create'
                                ? 'Define a new role and assign its permissions.'
                                : 'Update the role name and its assigned permissions.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[60vh] space-y-4 overflow-y-auto">
                        <div className="space-y-1">
                            <Label htmlFor="role-name">Role Name</Label>
                            <Input
                                id="role-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-3">
                            <p className="text-sm font-semibold">Permissions</p>
                            {[...PERMISSION_GROUPS, OTHER_GROUP].map(
                                (group) => {
                                    const perms = permissionsIn(
                                        group,
                                        allPermissions,
                                    );
                                    if (perms.length === 0) return null;
                                    return (
                                        <div
                                            key={group.label}
                                            className="rounded-md border p-3"
                                        >
                                            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                                                {group.label}
                                            </p>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                {perms.map((perm) => (
                                                    <div
                                                        key={perm.name}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <Checkbox
                                                            id={`perm-${mode}-${role?.id ?? 'new'}-${perm.name}`}
                                                            checked={selected.has(
                                                                perm.name,
                                                            )}
                                                            onCheckedChange={() =>
                                                                togglePermission(
                                                                    perm.name,
                                                                )
                                                            }
                                                        />
                                                        <Label
                                                            htmlFor={`perm-${mode}-${role?.id ?? 'new'}-${perm.name}`}
                                                            className="text-sm font-normal"
                                                        >
                                                            {group.prefix
                                                                ? permissionLabel(
                                                                      perm.name,
                                                                  )
                                                                : perm.name}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                },
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={
                                !name ||
                                (saveDialogOpen && saveStatus === 'saving')
                            }
                        >
                            {saveDialogOpen && saveStatus === 'saving'
                                ? 'Saving...'
                                : 'Save'}
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

function DeleteRoleAlert({
    role,
    onDeleted,
    onCloseMenu,
}: {
    role: RoleData;
    onDeleted: () => void;
    onCloseMenu?: () => void;
}) {
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
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': csrfToken,
                },
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
                <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive"
                >
                    <Trash2Icon className="text-destructive" />
                    Delete
                </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Delete role "{role.name}"?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Any users currently assigned to this role will lose its
                        permissions. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deleting}
                    >
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
                <Button variant="ghost" size="icon-xs">
                    <span className="sr-only">
                        Actions for role {role.name}
                    </span>
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
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
                <DeleteRoleAlert
                    role={role}
                    onDeleted={onChanged}
                    onCloseMenu={() => setMenuOpen(false)}
                />
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
            fetch(`${baseUrl}/api/roles`, {
                credentials: 'include',
                signal: controller.signal,
            }).then((r) => r.json()),
            fetch(`${baseUrl}/api/permissions`, {
                credentials: 'include',
                signal: controller.signal,
            }).then((r) => r.json()),
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

    // Permissions are named "<module>.<action>"; group the matrix rows by module.
    const groups = new Map<string, PermissionData[]>();
    for (const perm of [...permissions].sort((a, b) =>
        a.name.localeCompare(b.name),
    )) {
        const [module] = perm.name.split('.');
        groups.set(module, [...(groups.get(module) ?? []), perm]);
    }
    const granted = new Map(
        roles.map((r) => [r.id, new Set(r.permissions.map((p) => p.id))]),
    );
    const humanize = (s: string) => s.replace(/[-_]/g, ' ');

    return (
        <div className="flex w-full flex-col gap-(--density-gutter)">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                    {loading && !roles.length
                        ? 'Loading roles…'
                        : `${roles.length} ${roles.length === 1 ? 'role' : 'roles'} · ${permissions.length} permissions`}
                </span>
                <div className="ml-auto">
                    <RoleFormDialog
                        mode="create"
                        allPermissions={permissions}
                        onSaved={refetch}
                        trigger={
                            <Button size="xs">
                                <PlusIcon />
                                New role
                            </Button>
                        }
                    />
                </div>
            </div>
            <div className="overflow-auto rounded-lg border">
                <Table
                    size="dense"
                    aria-label="Permissions granted to each role"
                    className="w-auto min-w-full"
                >
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="sticky left-0 z-20 w-56 bg-muted">
                                Permission
                            </TableHead>
                            {roles.map((role) => (
                                <TableHead
                                    key={role.id}
                                    className="min-w-28 text-center"
                                >
                                    <span className="inline-flex items-center gap-1">
                                        <span className="capitalize">
                                            {role.name}
                                        </span>
                                        <span className="font-normal tabular-nums">
                                            {role.permissions.length}
                                        </span>
                                        <RoleActionsCell
                                            role={role}
                                            allPermissions={permissions}
                                            onChanged={refetch}
                                        />
                                    </span>
                                </TableHead>
                            ))}
                            <TableHead className="w-full" aria-hidden="true" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!roles.length || !permissions.length ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell
                                    colSpan={roles.length + 2}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {loading
                                        ? 'Loading roles…'
                                        : 'No roles yet. Create one to start granting permissions.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            [...groups.entries()].flatMap(([module, perms]) => [
                                <TableRow
                                    key={`g-${module}`}
                                    className="bg-muted/30 hover:bg-muted/30"
                                >
                                    <TableCell
                                        colSpan={roles.length + 2}
                                        className="sticky left-0 text-xs font-semibold capitalize"
                                    >
                                        {humanize(module)}
                                    </TableCell>
                                </TableRow>,
                                ...perms.map((perm) => (
                                    <TableRow key={perm.id}>
                                        <TableCell
                                            className="sticky left-0 z-10 bg-background pl-6 font-mono text-xs"
                                            title={perm.name}
                                        >
                                            {perm.name
                                                .split('.')
                                                .slice(1)
                                                .join('.') || perm.name}
                                        </TableCell>
                                        {roles.map((role) => {
                                            const has = granted
                                                .get(role.id)
                                                ?.has(perm.id);
                                            return (
                                                <TableCell
                                                    key={role.id}
                                                    className="text-center"
                                                >
                                                    {has ? (
                                                        <CheckIcon
                                                            className="mx-auto size-3.5"
                                                            aria-label={`${role.name} has ${perm.name}`}
                                                        />
                                                    ) : (
                                                        <span
                                                            className="text-muted-foreground/50"
                                                            aria-label={`${role.name} does not have ${perm.name}`}
                                                        >
                                                            ·
                                                        </span>
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                        <TableCell aria-hidden="true" />
                                    </TableRow>
                                )),
                            ])
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
