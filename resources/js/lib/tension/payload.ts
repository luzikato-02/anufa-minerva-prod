/**
 * Builds the tension record payload from what the recording screens have
 * saved in localStorage.
 */

import {
    loadFromLocalStorage,
    restoreProblemsWithDates,
} from '@/lib/localStorage';
import type {
    CreelMeasurements,
    SpindleMeasurements,
    TensionRecordPayload,
    TwistingFormData,
    TwistingProblem,
    WeavingFormData,
    WeavingProblem,
} from '@/types/tension';
import { buildTwistingCsv, buildWeavingCsv } from './csv';

const percentage = (completed: number, total: number) =>
    total > 0 ? Math.round((completed / total) * 100) : 0;

export function prepareTwistingDataForDatabase(): TensionRecordPayload {
    const spindleData = loadFromLocalStorage<SpindleMeasurements>(
        'twisting-spindle-data',
        {},
    );
    const formData = loadFromLocalStorage<TwistingFormData>(
        'twisting-form-data',
        {
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
        },
    );
    const problems = loadFromLocalStorage<unknown[]>('twisting-problems', []);
    const restoredProblems =
        restoreProblemsWithDates<TwistingProblem>(problems);

    const entries = Object.entries(spindleData);
    const totalMeasurements = entries.length;
    const completedMeasurements = entries.filter(
        ([, data]) => data.max !== null && data.min !== null,
    ).length;

    return {
        record_type: 'twisting',
        timestamp: new Date().toISOString(),
        csv_data: buildTwistingCsv(spindleData, formData, restoredProblems),
        form_data: formData,
        measurement_data: spindleData,
        problems: restoredProblems,
        metadata: {
            total_measurements: totalMeasurements,
            completed_measurements: completedMeasurements,
            progress_percentage: percentage(
                completedMeasurements,
                totalMeasurements,
            ),
            operator: formData.operator,
            machine_number: formData.machineNumber,
            item_number: formData.itemNumber,
            yarn_code: formData.yarnCode,
        },
    };
}

export function prepareWeavingDataForDatabase(): TensionRecordPayload {
    const creelData = loadFromLocalStorage<CreelMeasurements>(
        'weaving-creel-data',
        { AI: {}, BI: {}, AO: {}, BO: {} },
    );
    const formData = loadFromLocalStorage<WeavingFormData>(
        'weaving-form-data',
        {
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
        },
    );
    const problems = loadFromLocalStorage<unknown[]>('weaving-problems', []);
    const restoredProblems = restoreProblemsWithDates<WeavingProblem>(problems);

    let totalMeasurements = 0;
    let completedMeasurements = 0;
    Object.values(creelData).forEach((rows) => {
        Object.values(rows).forEach((columns) => {
            Object.values(columns).forEach((data) => {
                totalMeasurements++;
                if (data.max !== null && data.min !== null) {
                    completedMeasurements++;
                }
            });
        });
    });

    return {
        record_type: 'weaving',
        timestamp: new Date().toISOString(),
        csv_data: buildWeavingCsv(creelData, formData, restoredProblems),
        form_data: formData,
        measurement_data: creelData,
        problems: restoredProblems,
        metadata: {
            total_measurements: totalMeasurements,
            completed_measurements: completedMeasurements,
            progress_percentage: percentage(
                completedMeasurements,
                totalMeasurements,
            ),
            operator: formData.operator,
            machine_number: formData.machineNumber,
            item_number: formData.itemNumber,
            item_description: formData.itemDescription,
        },
    };
}
