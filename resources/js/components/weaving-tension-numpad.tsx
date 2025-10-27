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
import { useState } from 'react';
import { exportWeavingDataToCSV } from './utils/csv-export';
import {
    clearAllAppData,
    loadFromLocalStorage,
    restoreProblemsWithDates,
} from './utils/localStorage';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DialogDescription } from '@/components/ui/dialog';

interface SpindleData {
    max: number | null;
    min: number | null;
}

interface CreelData {
    [side: string]: {
        [row: string]: {
            [col: number]: SpindleData;
        };
    };
}

interface WeavingFormData {
    machineNumber: string;
    metersCheck: string;
    itemNumber: string;
    itemDescription: string;
    operator: string;
    productionOrder: string;
    baleNumber: string;
    colorCode: string;
    specTens: string;
    tensPlus: string;
}

interface WeavingProblem {
    id: number;
    position: string;
    description: string;
    timestamp: Date;
}

export default function WeavingNumpad({
    display,
    setDisplay,
    counter,
    setCounter,
    valueType,
    setValueType,
    creelSideIndex,
    setCreelSideIndex,
    creelRowIndex,
    setCreelRowIndex,
    creelData,
    setCreelData,
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
    creelSideIndex: number;
    setCreelSideIndex: (value: number) => void;
    creelRowIndex: number;
    setCreelRowIndex: (value: number) => void;
    creelData: CreelData;
    setCreelData: (value: CreelData | ((prev: CreelData) => CreelData)) => void;
    formData: WeavingFormData;
    problems: WeavingProblem[];
    onReportProblem?: (position: string) => void;
    onOpenRecorder?: () => void;
    onDataCleared?: () => void;
}) {
    const [openFinishDialog, setOpenFinishDialog] =
        React.useState<boolean>(false);
    // Creel side and row options
    const creelSideOptions = ['AI', 'BI', 'AO', 'BO'];
    const creelRowOptions = ['A', 'B', 'C', 'D', 'E'];

    // Get current position's max and min values
    const currentSide = creelSideOptions[creelSideIndex];
    const currentRow = creelRowOptions[creelRowIndex];
    const currentSpindleData = creelData[currentSide]?.[currentRow]?.[
        counter
    ] || { max: null, min: null };
    const [isSpindleModalOpen, setIsSpindleModalOpen] = useState(false);
    const [spindleInput, setSpindleInput] = useState(String(counter));

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
        setCounter(counter < 120 ? counter + 1 : 120);
    };

    const decrementCounter = () => {
        setCounter(counter > 1 ? counter - 1 : 1);
    };

    const incrementCreelSide = () => {
        setCreelSideIndex((creelSideIndex + 1) % creelSideOptions.length);
    };

    const decrementCreelSide = () => {
        setCreelSideIndex(
            (creelSideIndex - 1 + creelSideOptions.length) %
                creelSideOptions.length,
        );
    };

    const incrementCreelRow = () => {
        setCreelRowIndex((creelRowIndex + 1) % creelRowOptions.length);
    };

    const decrementCreelRow = () => {
        setCreelRowIndex(
            (creelRowIndex - 1 + creelRowOptions.length) %
                creelRowOptions.length,
        );
    };

    const toggleValueType = () => {
        setValueType(valueType === 'Max' ? 'Min' : 'Max');
    };

    const storeValue = (numValue: number) => {
        setCreelData((prev) => {
            const newData = { ...prev };

            // Ensure the structure exists
            if (!newData[currentSide]) {
                newData[currentSide] = {};
            }
            if (!newData[currentSide][currentRow]) {
                newData[currentSide][currentRow] = {};
            }
            if (!newData[currentSide][currentRow][counter]) {
                newData[currentSide][currentRow][counter] = {
                    max: null,
                    min: null,
                };
            }

            // Store the value
            newData[currentSide][currentRow][counter] = {
                ...newData[currentSide][currentRow][counter],
                [valueType.toLowerCase()]: numValue,
            };

            return newData;
        });
    };

    const submitValue = () => {
        const numValue = Number.parseFloat(display);
        if (!isNaN(numValue)) {
            storeValue(numValue);
            setDisplay('0');
            console.log(
                `Submitted ${valueType} value ${numValue} for ${currentSide}-${currentRow}-Col${counter}`,
            );
        }
        toggleValueType();
    };

    const finishValue = (keepTrigger: boolean) => {
        setOpenFinishDialog(false);
        // 1. Get all data from localStorage and export to CSV
        const savedCreelData = loadFromLocalStorage('weaving-creel-data', {
            AI: {},
            BI: {},
            AO: {},
            BO: {},
        });
        const savedFormData = loadFromLocalStorage('weaving-form-data', {
            machineNumber: '',
            metersCheck: '',
            itemNumber: '',
            itemDescription: '',
            operator: '',
            productionOrder: '',
            baleNumber: '',
            colorCode: '',
            specTens: '',
            tensPlus: '',
        });
        const savedProblems = loadFromLocalStorage('weaving-problems', []);
        const restoredProblems =
            restoreProblemsWithDates<WeavingProblem>(savedProblems);

        // Export the data from localStorage
        exportWeavingDataToCSV(
            savedCreelData,
            savedFormData,
            restoredProblems,
            'weaving-tension-data',
        );
        console.log('Exported all weaving data from localStorage to CSV');

        if (!keepTrigger) {
            // 2. Clear all localStorage data
            clearAllAppData();
            console.log('Cleared all app data from localStorage');

            // 3. Reset display and counters
            setDisplay('0');
            setCounter(1);
            setValueType('Max');
            setCreelSideIndex(0);
            setCreelRowIndex(0);

            // 4. Clear creel data
            setCreelData({
                AI: {},
                BI: {},
                AO: {},
                BO: {},
            });

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
        setCreelData((prev) => {
            const newData = { ...prev };

            if (newData[currentSide]?.[currentRow]?.[counter]) {
                newData[currentSide][currentRow][counter] = {
                    ...newData[currentSide][currentRow][counter],
                    [valueType.toLowerCase()]: null,
                };
            }

            return newData;
        });

        console.log(
            `Deleted ${valueType} value for ${currentSide}-${currentRow}-Col${counter}`,
        );
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-2">
            <Card className="mx-auto w-full max-w-xs shadow-lg">
                <CardHeader className="pb-2">
                    {/* Max and Min Value Displays for Current Position */}
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

                    {/* Creel Side Counter with Arrow Buttons */}
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">
                            Creel Side
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 bg-transparent p-0"
                                onClick={decrementCreelSide}
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </Button>

                            <div className="min-w-[50px] text-center text-sm font-semibold text-foreground">
                                {creelSideOptions[creelSideIndex]}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 bg-transparent p-0"
                                onClick={incrementCreelSide}
                            >
                                <ChevronRight className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    {/* Creel Row Counter with Arrow Buttons */}
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">
                            Creel Row
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 bg-transparent p-0"
                                onClick={decrementCreelRow}
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </Button>

                            <div className="min-w-[50px] text-center text-sm font-semibold text-foreground">
                                {creelRowOptions[creelRowIndex]}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 bg-transparent p-0"
                                onClick={incrementCreelRow}
                            >
                                <ChevronRight className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    {/* Column Number Counter with Arrow Buttons */}
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">
                            Col No.
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

                            {/* <div className="min-w-[50px] text-center text-sm font-semibold text-foreground">
                                {counter} / 120
                            </div> */}

                            <button
                                onClick={() => {
                                    setSpindleInput(String(counter));
                                    setIsSpindleModalOpen(true);
                                }}
                                className="min-w-[50px] cursor-pointer rounded px-2 py-1 text-center text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                                type="button"
                            >
                                {counter} / 120
                            </button>

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 bg-transparent p-0"
                                onClick={incrementCounter}
                                disabled={counter === 120}
                            >
                                <ChevronRight className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    {/* Spindle Number Modal */}
                    <Dialog
                        open={isSpindleModalOpen}
                        onOpenChange={setIsSpindleModalOpen}
                    >
                        <DialogContent className="w-80">
                            <DialogHeader>
                                <DialogTitle>Go to Spindle</DialogTitle>
                                <DialogDescription>
                                    Enter a spindle number between 1 and 84
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <input
                                    type="number"
                                    min="1"
                                    max="84"
                                    value={spindleInput}
                                    onChange={(e) =>
                                        setSpindleInput(e.target.value)
                                    }
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                                    placeholder="Enter spindle number"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            setIsSpindleModalOpen(false)
                                        }
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            const num =
                                                Number.parseInt(spindleInput);
                                            if (
                                                !isNaN(num) &&
                                                num >= 1 &&
                                                num <= 120
                                            ) {
                                                setCounter(num);
                                                setIsSpindleModalOpen(false);
                                                console.log(
                                                    `Jumped to spindle ${num}`,
                                                );
                                            } else {
                                                alert(
                                                    'Please enter a number between 1 and 120',
                                                );
                                            }
                                        }}
                                        className="flex-1 bg-primary hover:bg-primary/90"
                                    >
                                        Jump!
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

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
                            Entering {valueType} for {currentSide}-{currentRow}
                            -Col{counter}
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
                            const fullPosition = `${currentSide}-${currentRow}-Col${counter}`;
                            console.log(
                                'Report Problem clicked for',
                                fullPosition,
                            );
                            onReportProblem?.(fullPosition);
                        }}
                    >
                        Report Problem for {currentSide}-{currentRow}-Col
                        {counter}
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
                        <Button
                            variant="destructive"
                            onClick={() => finishValue(false)}
                        >
                            Yes, clear all
                        </Button>
                        <Button onClick={() => finishValue(true)}>
                            No, keep them
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
