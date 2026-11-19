/** Shared types for weaving and twisting tension records. */

export interface Measurement {
    max: number | null;
    min: number | null;
    updatedAt?: string;
}

/** Twisting measurements keyed by spindle number. */
export type SpindleMeasurements = Record<string, Measurement>;

/** Weaving measurements keyed by creel side → row → column. */
export type CreelMeasurements = Record<
    string,
    Record<string, Record<string, Measurement>>
>;

export interface TwistingFormData {
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

export interface WeavingFormData {
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

export interface TwistingProblem {
    spindleNumber: number;
    description: string;
    timestamp: Date;
}

export interface WeavingProblem {
    position: string;
    description: string;
    timestamp: Date;
}

/** The payload sent to and returned from `/tension-records`. */
export interface TensionRecordPayload {
    id?: string;
    record_type: 'twisting' | 'weaving';
    timestamp: string;
    csv_data: string;
    form_data: object;
    measurement_data: object;
    problems: unknown[];
    metadata: {
        total_measurements: number;
        completed_measurements: number;
        progress_percentage: number;
        operator: string;
        machine_number: string;
        item_number: string;
        item_description?: string;
        yarn_code?: string;
    };
}

/** A resumable, server-side weaving session for one production order. */
export interface WeavingSession {
    id: number;
    form_data: Partial<WeavingFormData>;
    measurement_data: CreelMeasurements | null;
    problems?: unknown[];
}
