'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
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
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

interface TensionProblem {
    id?: number;
    spindleNumber?: number;
    spindle_number?: number;
    position?: string;
    description: string;
    timestamp?: string;
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
    spindle_number: number;
    max_value: number | null;
    min_value: number | null;
    avg_value: number | null;
    is_complete: boolean;
    is_out_of_spec: boolean;
}

interface WeavingMeasurement {
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
}

export function TensionRecordViewDialog({ record, open, onOpenChange }: Props) {
    const [measurements, setMeasurements] = useState<TwistingMeasurement[] | WeavingMeasurement[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Axis range controls
    const [yAxisMin, setYAxisMin] = useState<string>('');
    const [yAxisMax, setYAxisMax] = useState<string>('');
    const [xAxisMin, setXAxisMin] = useState<string>('');
    const [xAxisMax, setXAxisMax] = useState<string>('');
    const [useCustomYAxis, setUseCustomYAxis] = useState(false);
    const [useCustomXAxis, setUseCustomXAxis] = useState(false);

    const specTension = Number(
        record.spec_tension ?? record.form_data?.specTens ?? 0
    );

    const tolerance = Number(
        record.tension_tolerance ?? record.form_data?.tensPlus ?? 0
    );

    const minSpec = Number(specTension) - Number(tolerance);
    const maxSpec = Number(specTension) + Number(tolerance);

    const parseFallbackMeasurements = useCallback(() => {
        if (!record.measurement_data || record.record_type !== 'twisting') {
            return;
        }
        const data = Object.entries(record.measurement_data).map(
            ([key, value]) => {
                const maxValue = value?.max !== null && value?.max !== undefined ? Number(value.max) : null;
                const minValue = value?.min !== null && value?.min !== undefined ? Number(value.min) : null;
                const avgValue = maxValue !== null && minValue !== null ? (maxValue + minValue) / 2 : null;
                
                return {
                    spindle_number: parseInt(key),
                    max_value: maxValue,
                    min_value: minValue,
                    avg_value: avgValue,
                    is_complete: maxValue !== null && minValue !== null,
                    is_out_of_spec: false,
                };
            }
        );
        setMeasurements(data.sort((a, b) => a.spindle_number - b.spindle_number));
    }, [record.measurement_data, record.record_type]);

    useEffect(() => {
        if (!open || !record.id) return;

        const fetchMeasurements = async () => {
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
                // Fallback to measurement_data from record
                parseFallbackMeasurements();
            } finally {
                setLoading(false);
            }
        };

        fetchMeasurements();
    }, [open, record.id, parseFallbackMeasurements]);

    const getChartData = () => {
        if (record.record_type === 'twisting') {
            return (measurements as TwistingMeasurement[])
                .filter((m) => m.is_complete || (m.max_value !== null && m.min_value !== null))
                .map((m) => {
                    const maxValue = m.max_value !== null ? Number(m.max_value) : null;
                    const minValue = m.min_value !== null ? Number(m.min_value) : null;
                    const avgValue = m.avg_value !== null 
                        ? Number(m.avg_value) 
                        : (maxValue !== null && minValue !== null ? (maxValue + minValue) / 2 : null);
                    
                    return {
                        name: `#${m.spindle_number}`,
                        position: m.spindle_number,
                        max: maxValue,
                        min: minValue,
                        avg: avgValue,
                    };
                });
        } else {
            // For weaving, group by side and show averages
            return (measurements as WeavingMeasurement[])
                .filter((m) => m.is_complete || (m.max_value !== null && m.min_value !== null))
                .slice(0, 50) // Limit to first 50 for readability
                .map((m, index) => {
                    const maxValue = m.max_value !== null ? Number(m.max_value) : null;
                    const minValue = m.min_value !== null ? Number(m.min_value) : null;
                    const avgValue = m.avg_value !== null 
                        ? Number(m.avg_value) 
                        : (maxValue !== null && minValue !== null ? (maxValue + minValue) / 2 : null);
                    
                    return {
                        name: `${m.creel_side}-${m.row_number}-${m.column_number}`,
                        position: index + 1,
                        max: maxValue,
                        min: minValue,
                        avg: avgValue,
                    };
                });
        }
    };

    const chartData = getChartData();

    // Calculate smart Y-axis domain excluding zero values
    const getYAxisDomain = () => {
        if (useCustomYAxis && yAxisMin !== '' && yAxisMax !== '') {
            return [parseFloat(yAxisMin), parseFloat(yAxisMax)];
        }

        if (useCustomYAxis && yAxisMin !== '' && yAxisMax === '') {
            // Only min is set
            if (chartData.length === 0) {
                return [parseFloat(yAxisMin), 'auto'];
            }
            const allValues = chartData.flatMap(d => [d.max, d.min, d.avg])
                .filter((v): v is number => v !== null && v !== undefined && v !== 0);
            
            if (allValues.length === 0) {
                return [parseFloat(yAxisMin), 'auto'];
            }
            
            const maxValue = Math.max(...allValues);
            const padding = maxValue * 0.1;
            return [parseFloat(yAxisMin), maxValue + padding];
        }

        if (useCustomYAxis && yAxisMin === '' && yAxisMax !== '') {
            // Only max is set
            if (chartData.length === 0) {
                return ['auto', parseFloat(yAxisMax)];
            }
            const allValues = chartData.flatMap(d => [d.max, d.min, d.avg])
                .filter((v): v is number => v !== null && v !== undefined && v !== 0);
            
            if (allValues.length === 0) {
                return ['auto', parseFloat(yAxisMax)];
            }
            
            const minValue = Math.min(...allValues);
            const padding = minValue * 0.1;
            return [Math.max(0, minValue - padding), parseFloat(yAxisMax)];
        }

        if (chartData.length === 0) {
            return ['auto', 'auto'];
        }

        // Get all non-zero values
        const allValues = chartData.flatMap(d => [d.max, d.min, d.avg])
            .filter((v): v is number => v !== null && v !== undefined && v !== 0);

        if (allValues.length === 0) {
            return ['auto', 'auto'];
        }

        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        
        // Add 10% padding
        const padding = (maxValue - minValue) * 0.1;
        return [
            Math.max(0, minValue - padding),
            maxValue + padding
        ];
    };

    // Get X-axis domain (for filtering data points)
    const getFilteredChartData = () => {
        if (!useCustomXAxis || xAxisMin === '' || xAxisMax === '') {
            return chartData;
        }

        const minPos = parseInt(xAxisMin);
        const maxPos = parseInt(xAxisMax);

        return chartData.filter((d, index) => {
            const position = d.position ?? index + 1;
            return position >= minPos && position <= maxPos;
        });
    };

    const filteredChartData = getFilteredChartData();

    const getRecordDetails = () => {
        const operator = record.operator ?? record.metadata?.operator ?? 'N/A';
        const machineNumber = record.machine_number ?? record.metadata?.machine_number ?? record.form_data?.machineNumber ?? 'N/A';
        const itemNumber = record.item_number ?? record.metadata?.item_number ?? record.form_data?.itemNumber ?? 'N/A';

        if (record.record_type === 'twisting') {
            return {
                'Operator': operator,
                'Machine Number': machineNumber,
                'Item Number': itemNumber,
                'Yarn Code': record.metadata?.yarn_code ?? record.form_data?.yarnCode ?? 'N/A',
                'Dtex Number': record.form_data?.dtexNumber ?? 'N/A',
                'TPM': record.form_data?.tpm ?? 'N/A',
                'RPM': record.form_data?.rpm ?? 'N/A',
                'Spec. Tension (cN)': specTension || 0,
                'Tolerance (±cN)': tolerance || 'N/A',
                'Meters Check': record.form_data?.metersCheck ?? 'N/A',
            };
        } else {
            return {
                'Operator': operator,
                'Machine Number': machineNumber,
                'Item Number': itemNumber,
                'Item Description': record.item_description ?? record.metadata?.item_description ?? 'N/A',
                'Production Order': record.form_data?.productionOrder ?? 'N/A',
                'Bale Number': record.form_data?.baleNumber ?? 'N/A',
                'Color Code': record.form_data?.colorCode ?? 'N/A',
                'Spec. Tension (cN)': specTension || 0,
                'Tolerance (±cN)': tolerance || 'N/A',
                'Meters Check': record.form_data?.metersCheck ?? 'N/A',
            };
        }
    };

    const details = getRecordDetails();

    const totalMeasurements = record.total_measurements ?? record.metadata?.total_measurements ?? 0;
    const completedMeasurements = record.completed_measurements ?? record.metadata?.completed_measurements ?? 0;
    const progressPercentage = record.progress_percentage ?? record.metadata?.progress_percentage ?? 0;

    const resetAxisRanges = () => {
        setYAxisMin('');
        setYAxisMax('');
        setXAxisMin('');
        setXAxisMax('');
        setUseCustomYAxis(false);
        setUseCustomXAxis(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-[90vw] sm:max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                            {record.record_type}
                        </Badge>
                        Tension Record Details
                    </DialogTitle>
                    <DialogDescription>
                        Recorded on {record.created_at ? new Date(record.created_at).toLocaleString() : 'N/A'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2">
                <Tabs defaultValue="chart" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="chart">Tension Chart</TabsTrigger>
                        <TabsTrigger value="details">Session Details</TabsTrigger>
                        <TabsTrigger value="problems">
                            Problems ({record.problems?.length ?? 0})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="chart" className="mt-4 space-y-4">
                        {/* Axis Range Controls - Now as Accordion */}
                        <Accordion type="single" collapsible className="w-full mb-6">
                            <AccordionItem value="chart-controls" className="border rounded-lg px-4">
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <div>
                                            <h3 className="text-base font-semibold">Chart Controls</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Adjust the axis ranges to focus on specific data ranges
                                            </p>
                                        </div>
                                        {(useCustomYAxis || useCustomXAxis) && (
                                            <Badge variant="secondary" className="ml-2">
                                                Custom Range Active
                                            </Badge>
                                        )}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-4 pb-6">
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Y-Axis Controls */}
                                            <div className="space-y-3">
                                                <Label className="text-sm font-medium">Y-Axis Range (Tension in cN)</Label>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <Label htmlFor="y-min" className="text-xs text-muted-foreground">Min</Label>
                                                        <Input
                                                            id="y-min"
                                                            type="number"
                                                            placeholder="Auto"
                                                            value={yAxisMin}
                                                            onChange={(e) => {
                                                                setYAxisMin(e.target.value);
                                                                setUseCustomYAxis(e.target.value !== '' || yAxisMax !== '');
                                                            }}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                    <span className="text-muted-foreground mt-6">to</span>
                                                    <div className="flex-1">
                                                        <Label htmlFor="y-max" className="text-xs text-muted-foreground">Max</Label>
                                                        <Input
                                                            id="y-max"
                                                            type="number"
                                                            placeholder="Auto"
                                                            value={yAxisMax}
                                                            onChange={(e) => {
                                                                setYAxisMax(e.target.value);
                                                                setUseCustomYAxis(yAxisMin !== '' || e.target.value !== '');
                                                            }}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* X-Axis Controls */}
                                            <div className="space-y-3">
                                                <Label className="text-sm font-medium">
                                                    X-Axis Range ({record.record_type === 'twisting' ? 'Spindle' : 'Position'} #)
                                                </Label>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <Label htmlFor="x-min" className="text-xs text-muted-foreground">Min</Label>
                                                        <Input
                                                            id="x-min"
                                                            type="number"
                                                            placeholder="Start"
                                                            value={xAxisMin}
                                                            onChange={(e) => {
                                                                setXAxisMin(e.target.value);
                                                                setUseCustomXAxis(e.target.value !== '' || xAxisMax !== '');
                                                            }}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                    <span className="text-muted-foreground mt-6">to</span>
                                                    <div className="flex-1">
                                                        <Label htmlFor="x-max" className="text-xs text-muted-foreground">Max</Label>
                                                        <Input
                                                            id="x-max"
                                                            type="number"
                                                            placeholder="End"
                                                            value={xAxisMax}
                                                            onChange={(e) => {
                                                                setXAxisMax(e.target.value);
                                                                setUseCustomXAxis(xAxisMin !== '' || e.target.value !== '');
                                                            }}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={resetAxisRanges}
                                                disabled={!useCustomYAxis && !useCustomXAxis}
                                            >
                                                Reset to Auto
                                            </Button>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        {/* Chart Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Tension Measurements</CardTitle>
                                <CardDescription>
                                    {completedMeasurements} of {totalMeasurements} measurements ({progressPercentage}% complete)
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="flex h-[300px] items-center justify-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <p className="text-sm text-muted-foreground">Loading measurements...</p>
                                        </div>
                                    </div>
                                ) : filteredChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={480}>
                                        <LineChart data={filteredChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="name"
                                                angle={-45}
                                                textAnchor="end"
                                                height={60}
                                                interval={Math.floor(filteredChartData.length / 15)}
                                                fontSize={12}
                                            />
                                            <YAxis
                                                label={{ value: 'Tension (cN)', angle: -90, position: 'insideLeft' }}
                                                domain={getYAxisDomain() as any}
                                                fontSize={12}
                                            />
                                            <Tooltip
                                                formatter={(value, name) => {
                                                    // Convert to number if it's a string
                                                    const numValue = typeof value === 'string' ? parseFloat(value) : value;
                                                    const formattedValue = typeof numValue === 'number' && !isNaN(numValue) 
                                                        ? `${numValue.toFixed(2)} cN` 
                                                        : 'N/A';
                                                    const label = name === 'max' ? 'Max Tension' : 
                                                                 name === 'min' ? 'Min Tension' : 
                                                                 name === 'avg' ? 'Avg Tension' : name;
                                                    return [formattedValue, label];
                                                }}
                                                labelFormatter={(label) => `Position: ${label}`}
                                            />
                                            <Legend verticalAlign="top" height={36} />

                                            {/* Reference lines for spec limits */}
                                            {specTension > 0 && (
                                                <>
                                                    <ReferenceLine
                                                        y={maxSpec}
                                                        stroke="#ef4444"
                                                        strokeDasharray="5 5"
                                                        label={{ value: `Max: ${maxSpec}`, position: 'right', fill: '#ef4444', fontSize: 10 }}
                                                    />
                                                    <ReferenceLine
                                                        y={Number(specTension)}
                                                        stroke="#22c55e"
                                                        strokeDasharray="3 3"
                                                        label={{ value: `Spec: ${specTension}`, position: 'right', fill: '#22c55e', fontSize: 10 }}
                                                    />
                                                    <ReferenceLine
                                                        y={minSpec}
                                                        stroke="#ef4444"
                                                        strokeDasharray="5 5"
                                                        label={{ value: `Min: ${minSpec}`, position: 'right', fill: '#ef4444', fontSize: 10 }}
                                                    />
                                                </>
                                            )}

                                            <Line
                                                type="monotone"
                                                dataKey="max"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                dot={{ r: 2 }}
                                                name="Max Tension"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="min"
                                                stroke="#f97316"
                                                strokeWidth={2}
                                                dot={{ r: 2 }}
                                                name="Min Tension"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="avg"
                                                stroke="#8b5cf6"
                                                strokeWidth={2}
                                                dot={{ r: 2 }}
                                                name="Avg Tension"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                                        No measurement data available
                                    </div>
                                )}

                                <div className="mt-2 flex justify-center gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-green-500" />
                                        <span>Spec: {specTension || 0} cN</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-red-500" />
                                        <span>Limits: {minSpec} - {maxSpec} cN</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="details" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Session Information</CardTitle>
                                <CardDescription>
                                    Parameters recorded during this measurement session
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(details).map(([key, value]) => (
                                        <div key={key} className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground">{key}</p>
                                            <p className="text-sm font-semibold">{value}</p>
                                        </div>
                                    ))}
                                </div>

                                <Separator className="my-4" />

                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Progress</h4>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 bg-muted rounded-full h-2">
                                            <div
                                                className="bg-primary h-2 rounded-full transition-all"
                                                style={{ width: `${progressPercentage}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium">{progressPercentage}%</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {completedMeasurements} of {totalMeasurements} measurements completed
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="problems" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Reported Problems</CardTitle>
                                <CardDescription>
                                    Issues detected during this measurement session
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {record.problems && record.problems.length > 0 ? (
                                    <div className="space-y-3">
                                        {record.problems.map((problem: TensionProblem, index: number) => (
                                            <div
                                                key={problem.id ?? index}
                                                className="flex items-start gap-3 rounded-lg border p-3"
                                            >
                                                <Badge variant="outline" className="mt-0.5">
                                                    {record.record_type === 'twisting'
                                                        ? `#${problem.spindleNumber ?? problem.spindle_number ?? 'N/A'}`
                                                        : problem.position ?? 'N/A'}
                                                </Badge>
                                                <div className="flex-1">
                                                    <p className="text-sm">{problem.description}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {problem.timestamp
                                                            ? new Date(problem.timestamp).toLocaleString()
                                                            : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex h-[100px] items-center justify-center text-muted-foreground">
                                        No problems reported for this session
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t flex-shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button
                        onClick={() => {
                            const baseUrl = window.location.origin;
                            window.location.href = `${baseUrl}/tension-records/${record.id}/download`;
                        }}
                    >
                        Download CSV
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}