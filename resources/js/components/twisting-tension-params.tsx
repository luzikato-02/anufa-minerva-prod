'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { clearAllAppData } from './utils/localStorage';

interface TensionData {
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

export default function TwistingParams({
    formData,
    setFormData,
    onStartRecording,
}: {
    formData: TensionData;
    setFormData: (
        value: TensionData | ((prev: TensionData) => TensionData),
    ) => void;
    onStartRecording?: () => void;
}) {
    const handleInputChange = (field: keyof TensionData, value: string) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const startRecording = () => {
        console.log('Started recording with data:', formData);
        onStartRecording?.();
    };

    const clearData = () => {
        setFormData({
            machineNumber: '',
            itemNumber: '',
            metersCheck: '',
            operator: '',
            dtexNumber: '',
            tpm: '',
            specTens: '',
            tensPlus: '',
            rpm: '',
            yarnCode: '',
        });
        console.log('Data cleared');
    };

    const clearAllData = () => {
        if (
            confirm(
                'Are you sure you want to clear all saved data? This will remove all forms, measurements, and problem reports.',
            )
        ) {
            clearAllAppData();
            clearData();
            console.log('All app data cleared from localStorage');
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-2">
            <Card className="mx-auto w-full max-w-xs shadow-lg">
                <CardHeader className="pb-3">
                    <CardTitle className="text-center text-lg font-semibold">
                        Twisting Tension Recorder
                    </CardTitle>
                    <p className="text-center text-xs text-muted-foreground">
                        Configure recording parameters
                    </p>
                    <Separator className="mt-3" />
                </CardHeader>

                <CardContent className="space-y-1">
                    {/* Form Fields */}
                    <div className="space-y-1">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label
                                    htmlFor="operator"
                                    className="text-xs font-medium text-foreground"
                                >
                                    Operator
                                </Label>
                                <Input
                                    id="operator"
                                    type="text"
                                    value={formData.operator}
                                    onChange={(e) =>
                                        handleInputChange(
                                            'operator',
                                            e.target.value,
                                        )
                                    }
                                    className="h-7 text-sm"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="yarnCode"
                                    className="text-xs font-medium text-foreground"
                                >
                                    Yarn Mat Code
                                </Label>
                                <Input
                                    id="operator"
                                    type="text"
                                    value={formData.yarnCode}
                                    onChange={(e) =>
                                        handleInputChange(
                                            'yarnCode',
                                            e.target.value,
                                        )
                                    }
                                    className="h-7 text-sm"
                                />
                            </div>
                        </div>

                        {/* Item Number and Meters Check side by side */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label
                                    htmlFor="itemNumber"
                                    className="text-xs font-medium text-foreground"
                                >
                                    Item Number
                                </Label>
                                <Input
                                    id="itemNumber"
                                    type="text"
                                    value={formData.itemNumber}
                                    onChange={(e) =>
                                        handleInputChange(
                                            'itemNumber',
                                            e.target.value,
                                        )
                                    }
                                    className="h-7 text-sm"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="metersCheck"
                                    className="text-xs font-medium text-foreground"
                                >
                                    Meters Check
                                </Label>
                                <Input
                                    id="metersCheck"
                                    type="text"
                                    value={formData.metersCheck}
                                    onChange={(e) =>
                                        handleInputChange(
                                            'metersCheck',
                                            e.target.value,
                                        )
                                    }
                                    className="h-7 text-sm"
                                />
                            </div>
                        </div>

                        {/* Dtex Number and TPM side by side */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label
                                    htmlFor="dtexNumber"
                                    className="text-xs font-medium text-foreground"
                                >
                                    Dtex Number
                                </Label>
                                <Input
                                    id="dtexNumber"
                                    type="text"
                                    value={formData.dtexNumber}
                                    onChange={(e) =>
                                        handleInputChange(
                                            'dtexNumber',
                                            e.target.value,
                                        )
                                    }
                                    className="h-7 text-sm"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="tpm"
                                    className="text-xs font-medium text-foreground"
                                >
                                    TPM
                                </Label>
                                <Input
                                    id="tpm"
                                    type="text"
                                    value={formData.tpm}
                                    onChange={(e) =>
                                        handleInputChange('tpm', e.target.value)
                                    }
                                    className="h-7 text-sm"
                                />
                            </div>
                        </div>

                        {/* Spec Tens and Tens ± side by side */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label
                                    htmlFor="specTens"
                                    className="text-xs font-medium text-foreground"
                                >
                                    Spec Tens
                                </Label>
                                <Input
                                    id="specTens"
                                    type="text"
                                    value={formData.specTens}
                                    onChange={(e) =>
                                        handleInputChange(
                                            'specTens',
                                            e.target.value,
                                        )
                                    }
                                    className="h-7 text-sm"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="tensPlus"
                                    className="text-xs font-medium text-foreground"
                                >
                                    Tens ±
                                </Label>
                                <Input
                                    id="tensPlus"
                                    type="text"
                                    value={formData.tensPlus}
                                    onChange={(e) =>
                                        handleInputChange(
                                            'tensPlus',
                                            e.target.value,
                                        )
                                    }
                                    className="h-7 text-sm"
                                />
                            </div>
                        </div>

                        {/* RPM and Machine Number side by side */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label
                                    htmlFor="rpm"
                                    className="text-xs font-medium text-foreground"
                                >
                                    RPM
                                </Label>
                                <Input
                                    id="rpm"
                                    type="text"
                                    value={formData.rpm}
                                    onChange={(e) =>
                                        handleInputChange('rpm', e.target.value)
                                    }
                                    className="h-7 text-sm"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="machineNumber"
                                    className="text-xs font-medium text-foreground"
                                >
                                    Machine Number
                                </Label>
                                <Input
                                    id="machineNumber"
                                    type="text"
                                    value={formData.machineNumber}
                                    onChange={(e) =>
                                        handleInputChange(
                                            'machineNumber',
                                            e.target.value,
                                        )
                                    }
                                    className="h-7 text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Separator before buttons */}
                    <div className="py-2">
                        <Separator />
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-1">
                        <Button
                            size="sm"
                            className="h-10 w-full text-sm font-medium"
                            onClick={startRecording}
                        >
                            Start Recording
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 bg-transparent text-sm font-medium"
                                onClick={clearData}
                            >
                                Clear Form
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 bg-transparent text-xs font-medium hover:bg-destructive hover:text-destructive-foreground"
                                onClick={clearAllData}
                            >
                                Clear All Data
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
