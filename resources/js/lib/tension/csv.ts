/**
 * Builds the CSV text stored in a tension record's `csv_data` field.
 * (The user-facing CSV download lives in `lib/csv-export.ts`.)
 */

import type {
    CreelMeasurements,
    SpindleMeasurements,
    TwistingFormData,
    TwistingProblem,
    WeavingFormData,
    WeavingProblem,
} from '@/types/tension';

const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;

export function buildTwistingCsv(
    spindleData: SpindleMeasurements,
    formData: TwistingFormData,
    problems: TwistingProblem[],
): string {
    const csvRows: string[] = [];

    csvRows.push('TWISTING TENSION DATA EXPORT');
    csvRows.push(`Export Date: ${new Date().toLocaleString()}`);
    csvRows.push('');
    csvRows.push('=== CONFIGURATION PARAMETERS ===');
    csvRows.push('Parameter,Value');
    csvRows.push(`Operator,${formData.operator}`);
    csvRows.push(`Item Number,${formData.itemNumber}`);
    csvRows.push(`Meters Check,${formData.metersCheck}`);
    csvRows.push(`Dtex Number,${formData.dtexNumber}`);
    csvRows.push(`TPM,${formData.tpm}`);
    csvRows.push(`Spec Tens,${formData.specTens}`);
    csvRows.push(`Tens ±,${formData.tensPlus}`);
    csvRows.push(`RPM,${formData.rpm}`);
    csvRows.push(`Machine Number,${formData.machineNumber}`);
    csvRows.push(`Yarn Code,${formData.yarnCode}`);
    csvRows.push('');
    csvRows.push('=== TENSION MEASUREMENT DATA ===');
    csvRows.push('Spindle Number,Max Value,Min Value');

    Object.entries(spindleData).forEach(([spindleNumber, data]) => {
        const maxValue = data.max !== null ? data.max : '';
        const minValue = data.min !== null ? data.min : '';
        csvRows.push(`${spindleNumber},${maxValue},${minValue}`);
    });

    csvRows.push('');
    csvRows.push('=== PROBLEM REPORTS ===');
    csvRows.push('Spindle Number,Description,Timestamp');

    if (problems.length > 0) {
        problems.forEach((problem) => {
            const timestamp = problem.timestamp.toLocaleString();
            csvRows.push(
                `${problem.spindleNumber},${quote(problem.description)},${timestamp}`,
            );
        });
    } else {
        csvRows.push('No problems reported');
    }

    return csvRows.join('\n');
}

export function buildWeavingCsv(
    creelData: CreelMeasurements,
    formData: WeavingFormData,
    problems: WeavingProblem[],
): string {
    const csvRows: string[] = [];

    csvRows.push('WEAVING TENSION DATA EXPORT');
    csvRows.push(`Export Date: ${new Date().toLocaleString()}`);
    csvRows.push('');
    csvRows.push('=== CONFIGURATION PARAMETERS ===');
    csvRows.push('Parameter,Value');
    csvRows.push(`Item Number,${formData.itemNumber}`);
    csvRows.push(`Item Description,${formData.itemDescription}`);
    csvRows.push(`Production Order,${formData.productionOrder}`);
    csvRows.push(`Meters Check,${formData.metersCheck}`);
    csvRows.push(`Bale Number,${formData.baleNumber}`);
    csvRows.push(`Color Code,${formData.colorCode}`);
    csvRows.push(`Spec Tens,${formData.specTens}`);
    csvRows.push(`Tens ±,${formData.tensPlus}`);
    csvRows.push(`Machine Number,${formData.machineNumber}`);
    csvRows.push(`Operator,${formData.operator}`);
    csvRows.push('');
    csvRows.push('=== TENSION MEASUREMENT DATA ===');
    csvRows.push('Position,Creel Side,Row,Column,Max Value,Min Value');

    Object.entries(creelData).forEach(([side, rows]) => {
        Object.entries(rows).forEach(([row, columns]) => {
            Object.entries(columns).forEach(([col, data]) => {
                const position = `${side}-${row}-Col${col}`;
                const maxValue = data.max !== null ? data.max : '';
                const minValue = data.min !== null ? data.min : '';
                csvRows.push(
                    `${position},${side},${row},${col},${maxValue},${minValue}`,
                );
            });
        });
    });

    csvRows.push('');
    csvRows.push('=== PROBLEM REPORTS ===');
    csvRows.push('Position,Description,Timestamp');

    if (problems.length > 0) {
        problems.forEach((problem) => {
            const timestamp = problem.timestamp.toLocaleString();
            csvRows.push(
                `${problem.position},${quote(problem.description)},${timestamp}`,
            );
        });
    } else {
        csvRows.push('No problems reported');
    }

    return csvRows.join('\n');
}
