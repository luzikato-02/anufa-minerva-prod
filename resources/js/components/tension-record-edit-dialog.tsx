'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Loader2, PencilIcon, Plus, Save, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface TensionProblem {
    id?: number;
    position_identifier?: string;
    spindleNumber?: number;
    spindle_number?: number;
    position?: string;
    description: string;
    timestamp?: string;
    reported_at?: string;
    problem_type?: string;
    severity?: string;
    resolution_status?: string;
}

interface TensionRecord {
    id: string;
    record_type: 'twisting' | 'weaving';
    operator?: string;
    machine_number?: string;
    item_number?: string;
    item_description?: string;
    spec_tension?: number;
    tension_tolerance?: number;
    total_measurements?: number;
    completed_measurements?: number;
    progress_percentage?: number;
    form_data: Record<string, string | number | undefined>;
    measurement_data: Record<string, { max?: number | null; min?: number | null }>;
    metadata: {
        total_measurements: number;
        completed_measurements: number;
        progress_percentage: number;
        operator: string;
        machine_number: string;
        item_number: string;
        yarn_code?: string;
        item_description?: string;
    };
    problems?: TensionProblem[];
    created_at?: string;
}

interface TwistingMeasurement {
    id?: number;
    spindle_number: number;
    max_value: number | null;
    min_value: number | null;
    avg_value: number | null;
    is_complete: boolean;
    is_out_of_spec: boolean;
}

interface WeavingMeasurement {
    id?: number;
    creel_side: string;
    row_number: string;
    column_number: number;
    max_value: number | null;
    min_value: number | null;
    avg_value: number | null;
    is_complete: boolean;
    is_out_of_spec: boolean;
}

interface Props {
    record: TensionRecord;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave?: () => void;
}

interface EditingProblem {
    id: number;
    position: string;
    description: string;
    severity: string;
}

export function TensionRecordEditDialog({ record, open, onOpenChange, onSave }: Props) {
    const [measurements, setMeasurements] = useState<TwistingMeasurement[] | WeavingMeasurement[]>([]);
    const [problems, setProblems] = useState<TensionProblem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editedMeasurements, setEditedMeasurements] = useState<Map<string, { max: string; min: string }>>(new Map());
    const [newProblem, setNewProblem] = useState({ position: '', description: '' });
    const [editingProblem, setEditingProblem] = useState<EditingProblem | null>(null);
    const [savingProblemId, setSavingProblemId] = useState<number | null>(null);

    const specTension = Number(
        record.spec_tension ?? record.form_data?.specTens ?? 0
    );
    const tolerance = Number(
        record.tension_tolerance ?? record.form_data?.tensPlus ?? 0
    );
    const minSpec = specTension - tolerance;
    const maxSpec = specTension + tolerance;

    const fetchMeasurements = useCallback(async () => {
        if (!record.id) return;

        setLoading(true);
        try {
            const baseUrl = window.location.origin;
            const response = await fetch(
                `${baseUrl}/tension-records/${record.id}/measurements`,
                { credentials: 'include' }
            );
            const json = await response.json();
            setMeasurements(json.data || []);
        } catch (error) {
            console.error('Failed to fetch measurements:', error);
        } finally {
            setLoading(false);
        }
    }, [record.id]);

    const fetchProblems = useCallback(async () => {
        if (!record.id) return;

        try {
            const baseUrl = window.location.origin;
            const response = await fetch(
                `${baseUrl}/tension-records/${record.id}/problems`,
                { credentials: 'include' }
            );
            const json = await response.json();
            setProblems(json.data || record.problems || []);
        } catch (error) {
            console.error('Failed to fetch problems:', error);
            setProblems(record.problems || []);
        }
    }, [record.id, record.problems]);

    useEffect(() => {
        if (open && record.id) {
            fetchMeasurements();
            fetchProblems();
            setEditedMeasurements(new Map());
            setEditingProblem(null);
        }
    }, [open, record.id, fetchMeasurements, fetchProblems]);

    const getMeasurementKey = (measurement: TwistingMeasurement | WeavingMeasurement): string => {
        if (record.record_type === 'twisting') {
            return `spindle-${(measurement as TwistingMeasurement).spindle_number}`;
        } else {
            const m = measurement as WeavingMeasurement;
            return `${m.creel_side}-${m.row_number}-${m.column_number}`;
        }
    };

    const getMeasurementLabel = (measurement: TwistingMeasurement | WeavingMeasurement): string => {
        if (record.record_type === 'twisting') {
            return `#${(measurement as TwistingMeasurement).spindle_number}`;
        } else {
            const m = measurement as WeavingMeasurement;
            return `${m.creel_side}-${m.row_number}-${m.column_number}`;
        }
    };

    const handleMeasurementChange = (key: string, field: 'max' | 'min', value: string) => {
        const newEdited = new Map(editedMeasurements);
        const current = newEdited.get(key) || { max: '', min: '' };
        newEdited.set(key, { ...current, [field]: value });
        setEditedMeasurements(newEdited);
    };

    const saveMeasurement = async (measurement: TwistingMeasurement | WeavingMeasurement) => {
        const key = getMeasurementKey(measurement);
        const edited = editedMeasurements.get(key);
        if (!edited) return;

        const baseUrl = window.location.origin;
        let url: string;
        
        if (record.record_type === 'twisting') {
            const m = measurement as TwistingMeasurement;
            url = `${baseUrl}/tension-records/${record.id}/twisting-measurements/${m.spindle_number}`;
        } else {
            const m = measurement as WeavingMeasurement;
            url = `${baseUrl}/tension-records/${record.id}/weaving-measurements/${m.creel_side}/${m.row_number}/${m.column_number}`;
        }

        try {
            const csrfResponse = await fetch(`${baseUrl}/csrf-token`, { credentials: 'include' });
            const { csrfToken } = await csrfResponse.json();

            const body: Record<string, number | null> = {};
            if (edited.max !== '') body.max_value = parseFloat(edited.max);
            if (edited.min !== '') body.min_value = parseFloat(edited.min);

            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error('Failed to save measurement');
            }

            // Clear the edited value and refresh
            const newEdited = new Map(editedMeasurements);
            newEdited.delete(key);
            setEditedMeasurements(newEdited);
            await fetchMeasurements();
        } catch (error) {
            console.error('Failed to save measurement:', error);
            alert('Failed to save measurement');
        }
    };

    const addProblem = async () => {
        if (!newProblem.position || !newProblem.description) {
            alert('Please fill in both position and description');
            return;
        }

        setSaving(true);
        try {
            const baseUrl = window.location.origin;
            const csrfResponse = await fetch(`${baseUrl}/csrf-token`, { credentials: 'include' });
            const { csrfToken } = await csrfResponse.json();

            const response = await fetch(`${baseUrl}/tension-records/${record.id}/problems`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    position_identifier: newProblem.position,
                    description: newProblem.description,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to add problem');
            }

            setNewProblem({ position: '', description: '' });
            await fetchProblems();
        } catch (error) {
            console.error('Failed to add problem:', error);
            alert('Failed to add problem');
        } finally {
            setSaving(false);
        }
    };

    const startEditProblem = (problem: TensionProblem) => {
        if (!problem.id) return;
        setEditingProblem({
            id: problem.id,
            position: problem.position_identifier ?? 
                (record.record_type === 'twisting'
                    ? String(problem.spindleNumber ?? problem.spindle_number ?? '')
                    : problem.position ?? ''),
            description: problem.description,
            severity: problem.severity ?? 'medium',
        });
    };

    const cancelEditProblem = () => {
        setEditingProblem(null);
    };

    const saveProblem = async () => {
        if (!editingProblem) return;

        setSavingProblemId(editingProblem.id);
        try {
            const baseUrl = window.location.origin;
            const csrfResponse = await fetch(`${baseUrl}/csrf-token`, { credentials: 'include' });
            const { csrfToken } = await csrfResponse.json();

            const response = await fetch(`${baseUrl}/tension-problems/${editingProblem.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    position_identifier: editingProblem.position,
                    description: editingProblem.description,
                    severity: editingProblem.severity,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update problem');
            }

            setEditingProblem(null);
            await fetchProblems();
        } catch (error) {
            console.error('Failed to update problem:', error);
            alert('Failed to update problem');
        } finally {
            setSavingProblemId(null);
        }
    };

    const resolveProblem = async (problemId: number) => {
        setSavingProblemId(problemId);
        try {
            const baseUrl = window.location.origin;
            const csrfResponse = await fetch(`${baseUrl}/csrf-token`, { credentials: 'include' });
            const { csrfToken } = await csrfResponse.json();

            const response = await fetch(`${baseUrl}/tension-problems/${problemId}/resolve`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ resolution_notes: 'Resolved' }),
            });

            if (!response.ok) {
                throw new Error('Failed to resolve problem');
            }

            await fetchProblems();
        } catch (error) {
            console.error('Failed to resolve problem:', error);
            alert('Failed to resolve problem');
        } finally {
            setSavingProblemId(null);
        }
    };

    const handleSaveAndClose = () => {
        onSave?.();
        onOpenChange(false);
    };

    const getProblemPosition = (problem: TensionProblem): string => {
        return problem.position_identifier ?? 
            (record.record_type === 'twisting'
                ? `#${problem.spindleNumber ?? problem.spindle_number ?? 'N/A'}`
                : problem.position ?? 'N/A');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-[90vw] sm:max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                            {record.record_type}
                        </Badge>
                        Edit Tension Record
                    </DialogTitle>
                    <DialogDescription>
                        Update measurements and manage problems for this record
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2">
                    <Tabs defaultValue="measurements" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="measurements">Edit Measurements</TabsTrigger>
                            <TabsTrigger value="problems">
                                Manage Problems ({problems.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="measurements" className="mt-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle>Tension Measurements</CardTitle>
                                    <CardDescription>
                                        Edit individual measurement values. Spec: {specTension} cN (±{tolerance} cN) | Range: {minSpec} - {maxSpec} cN
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="flex h-[200px] items-center justify-center">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        </div>
                                    ) : measurements.length > 0 ? (
                                        <div className="max-h-[400px] overflow-auto border rounded-md">
                                            <Table>
                                                <TableHeader className="sticky top-0 bg-background">
                                                    <TableRow>
                                                        <TableHead className="w-[100px]">
                                                            {record.record_type === 'twisting' ? 'Spindle' : 'Position'}
                                                        </TableHead>
                                                        <TableHead className="text-center">Current Max</TableHead>
                                                        <TableHead className="text-center">Current Min</TableHead>
                                                        <TableHead className="text-center">Avg</TableHead>
                                                        <TableHead className="text-center">Status</TableHead>
                                                        <TableHead className="text-center w-[120px]">New Max</TableHead>
                                                        <TableHead className="text-center w-[120px]">New Min</TableHead>
                                                        <TableHead className="w-[80px]"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(measurements as (TwistingMeasurement | WeavingMeasurement)[]).map((measurement) => {
                                                        const key = getMeasurementKey(measurement);
                                                        const edited = editedMeasurements.get(key);
                                                        const label = getMeasurementLabel(measurement);
                                                        const maxVal = measurement.max_value != null ? Number(measurement.max_value) : null;
                                                        const minVal = measurement.min_value != null ? Number(measurement.min_value) : null;
                                                        const avgVal = measurement.avg_value != null ? Number(measurement.avg_value) : null;

                                                        return (
                                                            <TableRow key={key} className={measurement.is_out_of_spec ? 'bg-destructive/5' : ''}>
                                                                <TableCell className="font-medium">{label}</TableCell>
                                                                <TableCell className="text-center">
                                                                    {maxVal != null ? maxVal.toFixed(1) : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    {minVal != null ? minVal.toFixed(1) : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    {avgVal != null ? avgVal.toFixed(1) : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    {measurement.is_out_of_spec ? (
                                                                        <Badge variant="destructive" className="text-xs">
                                                                            Out of Spec
                                                                        </Badge>
                                                                    ) : measurement.is_complete ? (
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            OK
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            Incomplete
                                                                        </Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Max"
                                                                        value={edited?.max ?? ''}
                                                                        onChange={(e) => handleMeasurementChange(key, 'max', e.target.value)}
                                                                        className="h-8 text-center"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Min"
                                                                        value={edited?.min ?? ''}
                                                                        onChange={(e) => handleMeasurementChange(key, 'min', e.target.value)}
                                                                        className="h-8 text-center"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => saveMeasurement(measurement)}
                                                                        disabled={!edited || (edited.max === '' && edited.min === '')}
                                                                        className="h-8 w-full"
                                                                    >
                                                                        <Save className="h-4 w-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="text-center text-muted-foreground py-8">
                                            No measurements found
                                        </div>
                                    )}
                                    {measurements.length > 0 && (
                                        <p className="text-xs text-muted-foreground mt-2 text-center">
                                            Showing {measurements.length} measurements
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="problems" className="mt-4 space-y-4">
                            {/* Add New Problem */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle>Add New Problem</CardTitle>
                                    <CardDescription>
                                        Report a new issue for this tension record
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-4">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <Label htmlFor="position">
                                                    {record.record_type === 'twisting' ? 'Spindle Number' : 'Position'}
                                                </Label>
                                                <Input
                                                    id="position"
                                                    placeholder={record.record_type === 'twisting' ? 'e.g., 15' : 'e.g., L-A-5'}
                                                    value={newProblem.position}
                                                    onChange={(e) => setNewProblem({ ...newProblem, position: e.target.value })}
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Label htmlFor="description">Description</Label>
                                                <Input
                                                    id="description"
                                                    placeholder="Describe the problem..."
                                                    value={newProblem.description}
                                                    onChange={(e) => setNewProblem({ ...newProblem, description: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <Button
                                                onClick={addProblem}
                                                disabled={saving || !newProblem.position || !newProblem.description}
                                            >
                                                {saving ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <Plus className="h-4 w-4 mr-2" />
                                                )}
                                                Add Problem
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Existing Problems */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle>Existing Problems</CardTitle>
                                    <CardDescription>
                                        View and edit reported issues
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {problems.length > 0 ? (
                                        <div className="max-h-[350px] overflow-auto border rounded-md">
                                            <Table>
                                                <TableHeader className="sticky top-0 bg-background">
                                                    <TableRow>
                                                        <TableHead className="w-[100px]">Position</TableHead>
                                                        <TableHead>Description</TableHead>
                                                        <TableHead className="w-[100px]">Severity</TableHead>
                                                        <TableHead className="w-[100px]">Status</TableHead>
                                                        <TableHead className="w-[150px]">Reported</TableHead>
                                                        <TableHead className="w-[140px] text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {problems.map((problem, index) => {
                                                        const isEditing = editingProblem?.id === problem.id;
                                                        const isSaving = savingProblemId === problem.id;

                                                        if (isEditing && editingProblem) {
                                                            return (
                                                                <TableRow key={problem.id ?? index} className="bg-muted/50">
                                                                    <TableCell>
                                                                        <Input
                                                                            value={editingProblem.position}
                                                                            onChange={(e) => setEditingProblem({
                                                                                ...editingProblem,
                                                                                position: e.target.value
                                                                            })}
                                                                            className="h-8"
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Textarea
                                                                            value={editingProblem.description}
                                                                            onChange={(e) => setEditingProblem({
                                                                                ...editingProblem,
                                                                                description: e.target.value
                                                                            })}
                                                                            className="min-h-[60px]"
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Select
                                                                            value={editingProblem.severity}
                                                                            onValueChange={(value) => setEditingProblem({
                                                                                ...editingProblem,
                                                                                severity: value
                                                                            })}
                                                                        >
                                                                            <SelectTrigger className="h-8">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="low">Low</SelectItem>
                                                                                <SelectItem value="medium">Medium</SelectItem>
                                                                                <SelectItem value="high">High</SelectItem>
                                                                                <SelectItem value="critical">Critical</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {problem.resolution_status ?? 'open'}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-muted-foreground">
                                                                        {problem.reported_at || problem.timestamp
                                                                            ? new Date(problem.reported_at || problem.timestamp!).toLocaleDateString()
                                                                            : '-'}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex justify-end gap-1">
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                onClick={cancelEditProblem}
                                                                                className="h-8 w-8 p-0"
                                                                            >
                                                                                <X className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={saveProblem}
                                                                                disabled={isSaving}
                                                                                className="h-8"
                                                                            >
                                                                                {isSaving ? (
                                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                                ) : (
                                                                                    <Save className="h-4 w-4" />
                                                                                )}
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        }

                                                        return (
                                                            <TableRow key={problem.id ?? index}>
                                                                <TableCell className="font-medium">
                                                                    {getProblemPosition(problem)}
                                                                </TableCell>
                                                                <TableCell className="max-w-[300px]">
                                                                    <p className="truncate" title={problem.description}>
                                                                        {problem.description}
                                                                    </p>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge 
                                                                        variant={
                                                                            problem.severity === 'critical' ? 'destructive' :
                                                                            problem.severity === 'high' ? 'destructive' :
                                                                            'secondary'
                                                                        }
                                                                        className="text-xs"
                                                                    >
                                                                        {problem.severity ?? 'medium'}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge 
                                                                        variant={problem.resolution_status === 'resolved' ? 'default' : 'outline'}
                                                                        className="text-xs"
                                                                    >
                                                                        {problem.resolution_status ?? 'open'}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">
                                                                    {problem.reported_at || problem.timestamp
                                                                        ? new Date(problem.reported_at || problem.timestamp!).toLocaleDateString()
                                                                        : '-'}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex justify-end gap-1">
                                                                        {problem.id && problem.resolution_status !== 'resolved' && (
                                                                            <>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={() => startEditProblem(problem)}
                                                                                    className="h-8 w-8 p-0"
                                                                                    title="Edit problem"
                                                                                >
                                                                                    <PencilIcon className="h-4 w-4" />
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={() => resolveProblem(problem.id!)}
                                                                                    disabled={isSaving}
                                                                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                                                                    title="Mark as resolved"
                                                                                >
                                                                                    {isSaving ? (
                                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                                    ) : (
                                                                                        <CheckCircle className="h-4 w-4" />
                                                                                    )}
                                                                                </Button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="flex h-[100px] items-center justify-center text-muted-foreground">
                                            No problems reported
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-end gap-2 flex-shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSaveAndClose}>
                        <Save className="h-4 w-4 mr-2" />
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
