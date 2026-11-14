'use client';

import { DataGrid } from '@/components/data-grid';
import { CodeCell } from '@/components/data-grid-cells';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useServerTable } from '@/hooks/use-server-table';
import { modelLabel } from '@/lib/ai-models';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import {
    type ColumnDef,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import {
    BotIcon,
    MoreHorizontal,
    PencilIcon,
    PlusIcon,
    PowerIcon,
    ShieldIcon,
    Trash2Icon,
} from 'lucide-react';
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
    status: 'active' | 'inactive';
    roles: RoleRef[];
    /** The model this user's AI features start with; null: the app's default. */
    ai_default_model: string | null;
    /** The AI models this user may use; null: every model, including ones added later. */
    ai_allowed_models: string[] | null;
    created_at?: string;
}

/** Every AI model the provider offers, for setting a user's access. */
export interface AiCatalog {
    models: string[];
    systemDefault: string | null;
}

type UserTableMeta = {
    refetch: () => void;
    allRoles: RoleRef[];
    currentUserId: number;
    aiCatalog: AiCatalog | null;
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
    const [saveStatus, setSaveStatus] = useState<
        'saving' | 'success' | 'error'
    >('saving');
    const [saveSteps, setSaveSteps] = useState<SaveStep[]>([]);
    const [saveError, setSaveError] = useState<{
        message: string;
        details: string;
    } | null>(null);

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
        setSaveSteps([
            {
                key: 'save',
                label:
                    mode === 'create' ? 'Creating user' : 'Saving user changes',
                status: 'active',
            },
        ]);
        setSaveDialogOpen(true);

        const payload: Record<string, unknown> =
            mode === 'create'
                ? {
                      name,
                      username,
                      email,
                      password,
                      roles: Array.from(selectedRoles),
                  }
                : { name, username, email, ...(password ? { password } : {}) };

        try {
            const csrfToken = await getCsrfToken();
            const baseUrl = window.location.origin;
            const url =
                mode === 'create'
                    ? `${baseUrl}/api/users`
                    : `${baseUrl}/api/users/${user!.id}`;
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
            const message = e instanceof Error ? e.message : String(e);
            setSaveSteps((prev) =>
                prev.map((s) => ({ ...s, status: 'error' })),
            );
            setSaveStatus('error');
            setSaveError({
                message: message || 'Error saving user',
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
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {mode === 'create'
                                ? 'Create User'
                                : `Edit User: ${user?.name}`}
                        </DialogTitle>
                        <DialogDescription>
                            {mode === 'create'
                                ? 'Add a new user account.'
                                : "Update this user's account details."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="user-name">Name</Label>
                            <Input
                                id="user-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="user-username">Username</Label>
                            <Input
                                id="user-username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="user-email">Email</Label>
                            <Input
                                id="user-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="user-password">
                                {mode === 'create'
                                    ? 'Password'
                                    : 'New Password (optional)'}
                            </Label>
                            <Input
                                id="user-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={
                                    mode === 'edit'
                                        ? 'Leave blank to keep current password'
                                        : ''
                                }
                            />
                        </div>
                        {mode === 'create' && (
                            <div className="space-y-1">
                                <Label>Roles</Label>
                                <div className="flex flex-wrap gap-3 rounded-md border p-3">
                                    {allRoles.map((role) => (
                                        <div
                                            key={role.id}
                                            className="flex items-center gap-2"
                                        >
                                            <Checkbox
                                                id={`create-role-${role.id}`}
                                                checked={selectedRoles.has(
                                                    role.name,
                                                )}
                                                onCheckedChange={() =>
                                                    toggleRole(role.name)
                                                }
                                            />
                                            <Label
                                                htmlFor={`create-role-${role.id}`}
                                                className="text-sm font-normal"
                                            >
                                                {roleLabel(role.name)}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
                                !username ||
                                !email ||
                                (mode === 'create' && !password) ||
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
    const [selectedRoles, setSelectedRoles] = useState<Set<string>>(
        new Set(user.roles.map((r) => r.name)),
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
        setSaveSteps([
            { key: 'save', label: 'Updating roles', status: 'active' },
        ]);
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
            const message = e instanceof Error ? e.message : String(e);
            setSaveSteps((prev) =>
                prev.map((s) => ({ ...s, status: 'error' })),
            );
            setSaveStatus('error');
            setSaveError({
                message: message || 'Error updating roles',
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
                <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <ShieldIcon />
                        Manage Roles
                    </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Manage Roles: {user.name}</DialogTitle>
                        <DialogDescription>
                            Assign one or more roles to this user.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-3 rounded-md border p-3">
                        {allRoles.map((role) => (
                            <div
                                key={role.id}
                                className="flex items-center gap-2"
                            >
                                <Checkbox
                                    id={`manage-role-${user.id}-${role.id}`}
                                    checked={selectedRoles.has(role.name)}
                                    onCheckedChange={() =>
                                        toggleRole(role.name)
                                    }
                                />
                                <Label
                                    htmlFor={`manage-role-${user.id}-${role.id}`}
                                    className="text-sm font-normal"
                                >
                                    {roleLabel(role.name)}
                                </Label>
                            </div>
                        ))}
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
                            disabled={saveDialogOpen && saveStatus === 'saving'}
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

const APP_DEFAULT = '__app_default__';

/** An admin sets which AI models a user may use, in every AI feature, and the one they start with. */
function AiModelsDialog({
    user,
    catalog,
    onSaved,
    onCloseMenu,
}: {
    user: UserData;
    catalog: AiCatalog;
    onSaved: () => void;
    onCloseMenu?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [allowAll, setAllowAll] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [defaultModel, setDefaultModel] = useState<string>(APP_DEFAULT);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Models the user was given but the provider no longer offers stay listed, so they can be removed.
    const models = Array.from(
        new Set([...catalog.models, ...(user.ai_allowed_models ?? [])]),
    );
    const offered = new Set(catalog.models);
    const usable = allowAll
        ? catalog.models
        : models.filter((m) => selected.has(m));

    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (wasOpenRef.current && !open) {
            onCloseMenu?.();
        }
        wasOpenRef.current = open;
    }, [open, onCloseMenu]);

    useEffect(() => {
        if (open) {
            setAllowAll(user.ai_allowed_models === null);
            setSelected(new Set(user.ai_allowed_models ?? []));
            setDefaultModel(user.ai_default_model ?? APP_DEFAULT);
            setError(null);
        }
    }, [open, user]);

    // A default the user may no longer use falls back to the app's.
    useEffect(() => {
        if (defaultModel !== APP_DEFAULT && !usable.includes(defaultModel)) {
            setDefaultModel(APP_DEFAULT);
        }
    }, [usable, defaultModel]);

    const toggle = (model: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(model)) {
                next.delete(model);
            } else {
                next.add(model);
            }
            return next;
        });

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/users/${user.id}/ai-models`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': await getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({
                    allowed_models: allowAll
                        ? null
                        : models.filter((m) => selected.has(m)),
                    default_model:
                        defaultModel === APP_DEFAULT ? null : defaultModel,
                }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                setError(json.message ?? `HTTP ${res.status}`);
                return;
            }
            setOpen(false);
            onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
            <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <BotIcon />
                    AI Models
                </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle>AI Models: {user.name}</DialogTitle>
                    <DialogDescription>
                        The models this user may use in every AI feature (Ask
                        the Data, Document Intelligence, finish-earlier scan),
                        and the one they start with.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Allowed models</Label>
                        <div className="flex flex-col gap-3 rounded-md border p-3">
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id={`ai-all-${user.id}`}
                                    checked={allowAll}
                                    onCheckedChange={(v) => {
                                        setAllowAll(v === true);
                                        // Starting a list from "all" keeps every model ticked.
                                        if (v !== true && selected.size === 0) {
                                            setSelected(
                                                new Set(catalog.models),
                                            );
                                        }
                                    }}
                                />
                                <Label
                                    htmlFor={`ai-all-${user.id}`}
                                    className="flex flex-col items-start gap-0.5 text-sm font-normal"
                                >
                                    Every model
                                    <span className="text-xs text-muted-foreground">
                                        Including models added to OCTA later
                                    </span>
                                </Label>
                            </div>
                            {!allowAll && (
                                <div className="flex flex-col gap-2 border-t pt-3">
                                    {models.length === 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            OCTA lists no models right now.
                                        </p>
                                    )}
                                    {models.map((m) => (
                                        <div
                                            key={m}
                                            className="flex items-center gap-2"
                                        >
                                            <Checkbox
                                                id={`ai-model-${user.id}-${m}`}
                                                checked={selected.has(m)}
                                                onCheckedChange={() =>
                                                    toggle(m)
                                                }
                                            />
                                            <Label
                                                htmlFor={`ai-model-${user.id}-${m}`}
                                                className="text-sm font-normal"
                                            >
                                                {modelLabel(m)}
                                                {!offered.has(m) && (
                                                    <span className="ml-1.5 text-xs text-muted-foreground">
                                                        (no longer offered)
                                                    </span>
                                                )}
                                            </Label>
                                        </div>
                                    ))}
                                    {selected.size === 0 && (
                                        <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
                                            With no model ticked, this user
                                            can't use any AI feature.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor={`ai-default-${user.id}`}>
                            Default model
                        </Label>
                        <Select
                            value={defaultModel}
                            onValueChange={setDefaultModel}
                        >
                            <SelectTrigger id={`ai-default-${user.id}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={APP_DEFAULT}>
                                    App default
                                    {catalog.systemDefault &&
                                        ` (${modelLabel(catalog.systemDefault)})`}
                                </SelectItem>
                                {usable.map((m) => (
                                    <SelectItem key={m} value={m}>
                                        {modelLabel(m)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Where their AI features start. They can still switch
                            to any other allowed model.
                        </p>
                    </div>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={save} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ToggleStatusAlert({
    user,
    onChanged,
    onCloseMenu,
}: {
    user: UserData;
    onChanged: () => void;
    onCloseMenu?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';

    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (wasOpenRef.current && !open) {
            onCloseMenu?.();
        }
        wasOpenRef.current = open;
    }, [open, onCloseMenu]);

    const handleConfirm = async () => {
        setSaving(true);
        try {
            const csrfToken = await getCsrfToken();
            const baseUrl = window.location.origin;
            await fetch(`${baseUrl}/api/users/${user.id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify({ status: nextStatus }),
            });
            setOpen(false);
            onChanged();
        } finally {
            setSaving(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <PowerIcon />
                    {user.status === 'active' ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {user.status === 'active' ? 'Deactivate' : 'Activate'}{' '}
                        user "{user.name}"?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {user.status === 'active'
                            ? 'This will immediately log the user out and block them from logging in again until reactivated.'
                            : "This will restore the user's ability to log in."}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={saving}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Confirm'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function DeleteUserAlert({
    user,
    onDeleted,
    onCloseMenu,
}: {
    user: UserData;
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
            await fetch(`${baseUrl}/api/users/${user.id}`, {
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
                        Delete user "{user.name}"?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently remove this user account. This
                        action cannot be undone.
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

function UserActionsCell({
    user,
    meta,
}: {
    user: UserData;
    meta: UserTableMeta;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const isSelf = user.id === meta.currentUserId;

    return (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Actions for ${user.name}`}
                >
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
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
                {meta.aiCatalog && (
                    <AiModelsDialog
                        user={user}
                        catalog={meta.aiCatalog}
                        onSaved={meta.refetch}
                        onCloseMenu={() => setMenuOpen(false)}
                    />
                )}
                {!isSelf && (
                    <>
                        <DropdownMenuSeparator />
                        <ToggleStatusAlert
                            user={user}
                            onChanged={meta.refetch}
                            onCloseMenu={() => setMenuOpen(false)}
                        />
                        <DeleteUserAlert
                            user={user}
                            onDeleted={meta.refetch}
                            onCloseMenu={() => setMenuOpen(false)}
                        />
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function UserStatusCell({ status }: { status: UserData['status'] }) {
    const active = status === 'active';
    return (
        <span className="inline-flex items-center gap-1.5 text-xs">
            <span
                aria-hidden="true"
                className={cn(
                    'size-1.5 rounded-full',
                    active ? 'bg-emerald-600' : 'bg-muted-foreground/40',
                )}
            />
            <span className={active ? undefined : 'text-muted-foreground'}>
                {active ? 'Active' : 'Inactive'}
            </span>
        </span>
    );
}

/** Users come back sorted by name from the server; column sorting stays off. */
export const columns: ColumnDef<UserData>[] = [
    {
        id: 'name',
        accessorFn: (row) => row.name,
        header: 'Name',
        cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
        ),
        enableHiding: false,
        meta: { label: 'Name' },
    },
    {
        id: 'username',
        accessorFn: (row) => row.username,
        header: 'Username',
        cell: ({ getValue }) => <CodeCell value={getValue()} muted />,
        meta: { label: 'Username' },
    },
    {
        id: 'email',
        accessorFn: (row) => row.email,
        header: 'Email',
        cell: ({ getValue }) => (
            <span className="text-xs text-muted-foreground lowercase">
                {String(getValue() ?? '')}
            </span>
        ),
        meta: { label: 'Email' },
    },
    {
        id: 'roles',
        enableSorting: false,
        header: 'Roles',
        cell: ({ row }) =>
            row.original.roles.length ? (
                <span className="flex flex-wrap gap-1">
                    {row.original.roles.map((role) => (
                        <span
                            key={role.id}
                            className="inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[11px] font-medium capitalize"
                        >
                            {role.name}
                        </span>
                    ))}
                </span>
            ) : (
                <span className="text-xs font-medium text-orange-700 dark:text-orange-400">
                    No role
                </span>
            ),
        meta: { label: 'Roles' },
    },
    {
        id: 'ai_models',
        enableSorting: false,
        header: 'AI Models',
        cell: ({ row }) => {
            const allowed = row.original.ai_allowed_models;
            const fallback = row.original.ai_default_model;
            return (
                <span className="flex flex-col text-xs">
                    {allowed === null ? (
                        <span>All models</span>
                    ) : allowed.length === 0 ? (
                        <span className="font-medium text-orange-700 dark:text-orange-400">
                            None
                        </span>
                    ) : (
                        <span title={allowed.map(modelLabel).join(', ')}>
                            {allowed.length === 1
                                ? modelLabel(allowed[0])
                                : `${allowed.length} models`}
                        </span>
                    )}
                    {fallback && (
                        <span className="text-muted-foreground">
                            Default: {modelLabel(fallback)}
                        </span>
                    )}
                </span>
            );
        },
        meta: { label: 'AI Models' },
    },
    {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <UserStatusCell status={row.original.status} />,
        meta: { label: 'Status' },
    },
    {
        id: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        cell: ({ row, table }) => (
            <UserActionsCell
                user={row.original}
                meta={table.options.meta as UserTableMeta}
            />
        ),
        meta: { className: 'w-10 px-1' },
    },
];

export function UserDataTable() {
    const { auth } = usePage<SharedData>().props;
    const [allRoles, setAllRoles] = useState<RoleRef[]>([]);
    const [aiCatalog, setAiCatalog] = useState<AiCatalog | null>(null);

    const grid = useServerTable<UserData>({
        endpoint: '/api/users',
        storageKey: 'users',
    });

    const table = useReactTable({
        data: grid.data,
        columns,
        getRowId: (row) => String(row.id),
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
        enableSortingRemoval: true,
        enableRowSelection: false,
        pageCount: grid.pageCount,
        state: grid.state,
        ...grid.handlers,
        meta: {
            refetch: grid.refetch,
            allRoles,
            currentUserId: auth.user.id,
            aiCatalog,
        },
    });

    useEffect(() => {
        const baseUrl = window.location.origin;
        const controller = new AbortController();

        fetch(`${baseUrl}/api/roles`, {
            credentials: 'include',
            signal: controller.signal,
        })
            .then((r) => r.json())
            .then((roles: { id: number; name: string }[]) =>
                setAllRoles(roles.map((r) => ({ id: r.id, name: r.name }))),
            )
            .catch((e) => {
                if (e.name !== 'AbortError') console.error(e);
            });

        // Only admins who manage users can read it; for others the AI Models action stays hidden.
        fetch(`${baseUrl}/api/ai-models`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((catalog: AiCatalog | null) => setAiCatalog(catalog))
            .catch(() => {});

        return () => controller.abort();
    }, []);

    return (
        <DataGrid
            table={table}
            label="Users"
            loading={grid.loading}
            error={grid.error}
            total={grid.total}
            onRetry={grid.refetch}
            search={grid.search}
            onSearchChange={grid.setSearch}
            searchPlaceholder="Search name, username, email…"
            emptyMessage="No users yet."
            actions={
                <UserFormDialog
                    mode="create"
                    allRoles={allRoles}
                    onSaved={grid.refetch}
                    trigger={
                        <Button size="xs">
                            <PlusIcon />
                            New user
                        </Button>
                    }
                />
            }
        />
    );
}
