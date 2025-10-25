'use client';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Delete, X } from 'lucide-react';
import * as React from 'react';
import { exportTwistingDataToCSV } from './utils/csv-export.js';
import {
    clearAllAppData,
    loadFromLocalStorage,
    restoreProblemsWithDates,
} from './utils/localStorage.js';

interface SpindleData {
    max: number | null;
    min: number | null;
}

interface TwistingFormData {
    machineNumber: string;
    itemNumber: string;
    metersCheck: string;
    operator: string;
    dtexNumber: string;
    tpm: string;
    specTens: string;
    tensPlus: string;
    rpm: string;
    yarnCode: string;
}

interface TwistingProblem {
    id: number;
    spindleNumber: number;
    description: string;
    timestamp: Date;
}

export default function TwistingNumpad({
    display,
    setDisplay,
    counter,
    setCounter,
    valueType,
    setValueType,
    spindleData,
    setSpindleData,
    formData,
    problems,
    onReportProblem,
    onOpenRecorder,
    onDataCleared,
}: {
    display: string;
    setDisplay: (value: string) => void;
    counter: number;
    setCounter: (value: number) => void;
    valueType: string;
    setValueType: (value: string) => void;
    spindleData: Record<number, SpindleData>;
    setSpindleData: (
        value:
            | Record<number, SpindleData>
            | ((
                  prev: Record<number, SpindleData>,
              ) => Record<number, SpindleData>),
    ) => void;
    formData: TwistingFormData;
    problems: TwistingProblem[];
    onReportProblem?: (spindleNumber: number) => void;
    onOpenRecorder?: () => void;
    onDataCleared?: () => void;
}) {
    const [openFinishDialog, setOpenFinishDialog] = React.useState(false);
    // Get current spindle's max and min values
    const currentSpindleData = spindleData[counter] || { max: null, min: null };

    const inputNumber = (num: string) => {
        setDisplay(display === '0' ? num : display + num);
    };

    const clear = () => {
        setDisplay('0');
    };

    const deleteLast = () => {
        if (display.length > 1) {
            setDisplay(display.slice(0, -1));
        } else {
            setDisplay('0');
        }
    };

    const incrementCounter = () => {
        setCounter(counter < 84 ? counter + 1 : 84);
    };

    const decrementCounter = () => {
        setCounter(counter > 1 ? counter - 1 : 1);
    };

    const toggleValueType = () => {
        setValueType(valueType === 'Max' ? 'Min' : 'Max');
    };

    const storeValue = (numValue: number) => {
        setSpindleData((prev) => {
            // make sure we always have an object to spread
            const prevEntry: SpindleData = prev[counter] ?? {
                max: null,
                min: null,
            };

            return {
                ...prev,
                [counter]: {
                    ...prevEntry,
                    [valueType.toLowerCase()]: numValue,
                },
            };
        });
    };

    const submitValue = () => {
        const numValue = Number.parseFloat(display);
        if (!isNaN(numValue)) {
            storeValue(numValue);
            setDisplay('0');
            toggleValueType();
            console.log(
                `Submitted ${valueType} value ${numValue} for Spindle ${counter}`,
            );
        }
    };

    const finishValue = (keepTrigger: boolean) => {
      setOpenFinishDialog(false);
        // 1. Get all data from localStorage and export to CSV
        const savedSpindleData = loadFromLocalStorage(
            'twisting-spindle-data',
            {},
        );
        const savedFormData = loadFromLocalStorage('twisting-form-data', {
            machineNumber: '',
            itemNumber: '',
            metersCheck: '',
            operator: '',
            dtexNumber: '',
            tpm: '',
            specTens: '',
            tensPlus: '',
            rpm: '',
        });
        const savedProblems = loadFromLocalStorage('twisting-problems', []);
        const restoredProblems =
            restoreProblemsWithDates<TwistingProblem>(savedProblems);

        // Export the data from localStorage
        exportTwistingDataToCSV(
            savedSpindleData,
            savedFormData,
            restoredProblems,
            'twisting-tension-data',
        );
        console.log('Exported all twisting data from localStorage to CSV');

        if (!keepTrigger) {
            // 2. Clear all localStorage data
            clearAllAppData();
            console.log('Cleared all app data from localStorage');
            // 3. Reset display and counter
            setDisplay('0');
            setCounter(1);
            setValueType('Max');

            // 4. Clear spindle data
            setSpindleData({});

            // 5. Notify parent component to reset form data and problems
            onDataCleared?.();

            console.log('All data cleared - ready for new session');
        }

    };

    const NumberButton = ({
        children,
        onClick,
        className = '',
    }: {
        children: React.ReactNode;
        onClick: () => void;
        className?: string;
    }) => (
        <Button
            variant="outline"
            size="sm"
            className={`h-10 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${className}`}
            onClick={onClick}
        >
            {children}
        </Button>
    );

    const deleteStoredValue = () => {
        setSpindleData((prev) => {
            const prevEntry: SpindleData = prev[counter] ?? {
                max: null,
                min: null,
            };

            return {
                ...prev,
                [counter]: {
                    ...prevEntry,
                    [valueType.toLowerCase()]: null,
                },
            };
        });

        console.log(`Deleted ${valueType} value for Spindle ${counter}`);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-2">
            <Card className="mx-auto w-full max-w-xs shadow-lg">
                <CardHeader className="pb-2">
                    {/* Max and Min Value Displays for Current Spindle */}
                    <div className="mb-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-center">
                            <div className="mb-1 text-xs font-medium text-green-700">
                                Max Value
                            </div>
                            <div className="font-mono text-sm font-bold text-green-800">
                                {currentSpindleData.max ?? '--'}
                            </div>
                        </div>
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-center">
                            <div className="mb-1 text-xs font-medium text-blue-700">
                                Min Value
                            </div>
                            <div className="font-mono text-sm font-bold text-blue-800">
                                {currentSpindleData.min ?? '--'}
                            </div>
                        </div>
                    </div>

                    {/* Speed Number Counter with Arrow Buttons */}
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">
                            Spd No.
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 bg-transparent p-0"
                                onClick={decrementCounter}
                                disabled={counter === 1}
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </Button>

                            <div className="min-w-[50px] text-center text-sm font-semibold text-foreground">
                                {counter} / 84
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 bg-transparent p-0"
                                onClick={incrementCounter}
                                disabled={counter === 84}
                            >
                                <ChevronRight className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    {/* Value Type Toggle with Arrow Buttons */}
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">
                            Value type
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 bg-transparent p-0"
                                onClick={toggleValueType}
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </Button>

                            <div
                                className={`min-w-[50px] text-center text-sm font-semibold ${
                                    valueType === 'Max'
                                        ? 'text-green-700'
                                        : 'text-blue-700'
                                }`}
                            >
                                {valueType}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 bg-transparent p-0"
                                onClick={toggleValueType}
                            >
                                <ChevronRight className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3 text-right">
                        <div className="flex min-h-[2rem] items-center justify-end font-mono text-2xl font-bold text-foreground">
                            {display}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            Entering {valueType} for Spindle {counter}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    {/* First Row - Clear and Delete */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="default"
                            size="sm"
                            className="h-10 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
                            onClick={clear}
                        >
                            <X className="mr-1 h-3 w-3" />
                            Clear
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 bg-transparent text-xs font-medium transition-colors hover:bg-destructive hover:text-destructive-foreground"
                            onClick={deleteLast}
                        >
                            <Delete className="mr-1 h-3 w-3" />
                            Backspace
                        </Button>
                    </div>

                    {/* Numbers Grid */}
                    <div className="grid grid-cols-3 gap-2">
                        {/* Row 1 */}
                        <NumberButton onClick={() => inputNumber('7')}>
                            7
                        </NumberButton>
                        <NumberButton onClick={() => inputNumber('8')}>
                            8
                        </NumberButton>
                        <NumberButton onClick={() => inputNumber('9')}>
                            9
                        </NumberButton>

                        {/* Row 2 */}
                        <NumberButton onClick={() => inputNumber('4')}>
                            4
                        </NumberButton>
                        <NumberButton onClick={() => inputNumber('5')}>
                            5
                        </NumberButton>
                        <NumberButton onClick={() => inputNumber('6')}>
                            6
                        </NumberButton>

                        {/* Row 3 */}
                        <NumberButton onClick={() => inputNumber('1')}>
                            1
                        </NumberButton>
                        <NumberButton onClick={() => inputNumber('2')}>
                            2
                        </NumberButton>
                        <NumberButton onClick={() => inputNumber('3')}>
                            3
                        </NumberButton>

                        {/* Row 4 */}
                        <NumberButton
                            onClick={() => inputNumber('0')}
                            className="col-span-2"
                        >
                            0
                        </NumberButton>
                        <NumberButton onClick={() => inputNumber('.')}>
                            .
                        </NumberButton>
                    </div>

                    {/* Submit and Finish Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            size="sm"
                            className="h-10 bg-green-600 text-sm font-medium text-white hover:bg-green-700"
                            onClick={() => setOpenFinishDialog(true)}
                        >
                            Finish
                        </Button>
                        <Button
                            size="sm"
                            className="h-10 bg-primary text-sm font-medium hover:bg-primary/90"
                            onClick={submitValue}
                        >
                            Submit
                        </Button>
                    </div>
                    {/* Back and Delete Current Value Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 bg-transparent text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                console.log('Data Recorder button clicked');
                                onOpenRecorder?.();
                            }}
                        >
                            Proc. Parameters
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 bg-transparent text-sm font-medium transition-colors hover:bg-destructive hover:text-destructive-foreground"
                            onClick={deleteStoredValue}
                        >
                            <Delete className="mr-1 h-3 w-3" />
                            Delete {valueType}
                        </Button>
                    </div>
                    {/* Report Problem Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-full bg-transparent text-sm font-medium transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                        onClick={() => {
                            console.log(
                                'Report Problem clicked for Spindle',
                                counter,
                            );
                            onReportProblem?.(counter);
                        }}
                    >
                        Report Problem for Spd #{counter}
                    </Button>
                </CardContent>
            </Card>

            <AlertDialog
                open={openFinishDialog}
                onOpenChange={setOpenFinishDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Finish Measurement Session
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Would you like to clear the data on your local
                            device afterwards?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="destructive" onClick={() => finishValue(false)}>Yes, clear all</Button>
                        <Button onClick={() => finishValue(true)}>No, keep them</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
