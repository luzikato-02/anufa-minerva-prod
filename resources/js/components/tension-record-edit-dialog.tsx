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
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface TensionProblem {
    id?: number;
    position_identifier?: string;
    spindleNumber?: number;
    spindle_number?: number;
    position?: string;
    description: string;
    timestamp?: string;
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

export function TensionRecordEditDialog({ record, open, onOpenChange, onSave }: Props) {
    const [measurements, setMeasurements] = useState<TwistingMeasurement[] | WeavingMeasurement[]>([]);
    const [problems, setProblems] = useState<TensionProblem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editedMeasurements, setEditedMeasurements] = useState<Map<string, { max: string; min: string }>>(new Map());
    const [newProblem, setNewProblem] = useState({ position: '', description: '' });

    const specTension = Number(
        record.spec_tension ?? record.form_data?.specTens ?? 0
    );
    const tolerance = Number(
        record.tension_tolerance ?? record.form_data?.tensPlus ?? 0
    );

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

    const resolveProblem = async (problemId: number) => {
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
        }
    };

    const handleSaveAndClose = () => {
        onSave?.();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-[90vw] sm:max-w-4xl max-h-[90vh] flex flex-col">
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
                                <CardHeader>
                                    <CardTitle>Tension Measurements</CardTitle>
                                    <CardDescription>
                                        Edit individual measurement values. Spec: {specTension} cN (±{tolerance} cN)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="flex h-[200px] items-center justify-center">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        </div>
                                    ) : (
                                        <div className="max-h-[400px] overflow-y-auto">
                                            <div className="grid gap-3">
                                                {(measurements as (TwistingMeasurement | WeavingMeasurement)[]).slice(0, 50).map((measurement) => {
                                                    const key = getMeasurementKey(measurement);
                                                    const edited = editedMeasurements.get(key);
                                                    const label = record.record_type === 'twisting'
                                                        ? `Spindle #${(measurement as TwistingMeasurement).spindle_number}`
                                                        : `${(measurement as WeavingMeasurement).creel_side}-${(measurement as WeavingMeasurement).row_number}-${(measurement as WeavingMeasurement).column_number}`;

                                                    return (
                                                        <div
                                                            key={key}
                                                            className="flex items-center gap-3 p-3 rounded-lg border"
                                                        >
                                                            <div className="w-24 font-medium text-sm">{label}</div>
                                                            <div className="flex items-center gap-2 flex-1">
                                                                <div className="flex-1">
                                                                    <Label className="text-xs text-muted-foreground">Max</Label>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder={measurement.max_value != null ? String(measurement.max_value) : 'N/A'}
                                                                        value={edited?.max ?? ''}
                                                                        onChange={(e) => handleMeasurementChange(key, 'max', e.target.value)}
                                                                        className="h-8"
                                                                    />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <Label className="text-xs text-muted-foreground">Min</Label>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder={measurement.min_value != null ? String(measurement.min_value) : 'N/A'}
                                                                        value={edited?.min ?? ''}
                                                                        onChange={(e) => handleMeasurementChange(key, 'min', e.target.value)}
                                                                        className="h-8"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground w-20 text-center">
                                                                Avg: {measurement.avg_value != null ? Number(measurement.avg_value).toFixed(1) : 'N/A'}
                                                            </div>
                                                            {measurement.is_out_of_spec && (
                                                                <Badge variant="destructive" className="text-xs">
                                                                    Out of Spec
                                                                </Badge>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => saveMeasurement(measurement)}
                                                                disabled={!edited || (edited.max === '' && edited.min === '')}
                                                                className="h-8"
                                                            >
                                                                <Save className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    );
                                                })}
                                                {measurements.length === 0 && (
                                                    <div className="text-center text-muted-foreground py-8">
                                                        No measurements found
                                                    </div>
                                                )}
                                                {measurements.length > 50 && (
                                                    <div className="text-center text-muted-foreground py-2 text-sm">
                                                        Showing first 50 of {measurements.length} measurements
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="problems" className="mt-4 space-y-4">
                            {/* Add New Problem */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Add New Problem</CardTitle>
                                    <CardDescription>
                                        Report a new issue for this tension record
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-4">
                                        <div className="grid grid-cols-2 gap-4">
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
                                            <div className="flex items-end">
                                                <Button
                                                    onClick={addProblem}
                                                    disabled={saving || !newProblem.position || !newProblem.description}
                                                    className="w-full"
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
                                        <div>
                                            <Label htmlFor="description">Description</Label>
                                            <Textarea
                                                id="description"
                                                placeholder="Describe the problem..."
                                                value={newProblem.description}
                                                onChange={(e) => setNewProblem({ ...newProblem, description: e.target.value })}
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Existing Problems */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Existing Problems</CardTitle>
                                    <CardDescription>
                                        Manage reported issues
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {problems.length > 0 ? (
                                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                            {problems.map((problem, index) => (
                                                <div
                                                    key={problem.id ?? index}
                                                    className="flex items-start gap-3 rounded-lg border p-3"
                                                >
                                                    <Badge variant="outline" className="mt-0.5">
                                                        {problem.position_identifier ?? 
                                                         (record.record_type === 'twisting'
                                                            ? `#${problem.spindleNumber ?? problem.spindle_number ?? 'N/A'}`
                                                            : problem.position ?? 'N/A')}
                                                    </Badge>
                                                    <div className="flex-1">
                                                        <p className="text-sm">{problem.description}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {problem.severity && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {problem.severity}
                                                                </Badge>
                                                            )}
                                                            {problem.resolution_status && (
                                                                <Badge 
                                                                    variant={problem.resolution_status === 'resolved' ? 'default' : 'outline'}
                                                                    className="text-xs"
                                                                >
                                                                    {problem.resolution_status}
                                                                </Badge>
                                                            )}
                                                            <span className="text-xs text-muted-foreground">
                                                                {problem.timestamp
                                                                    ? new Date(problem.timestamp).toLocaleString()
                                                                    : 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {problem.id && problem.resolution_status !== 'resolved' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => resolveProblem(problem.id!)}
                                                        >
                                                            Resolve
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
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
