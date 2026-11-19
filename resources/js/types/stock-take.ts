/** Types for batch stock-taking. */

export interface StockTakeBatch {
    batch_number: string;
    material_code: string;
    material_description: string;
}

export interface RecordedBatch extends StockTakeBatch {
    actual_weight: number;
    total_bobbins: number;
    line_position: number | null;
    row_position: string;
    timestamp_found: string;
    user_found: string;
    explanation: string;
    recorded_at: string;
}

export interface StockTakeSessionResponse {
    success: boolean;
    message?: string;
}

export interface StockTakeBatchCheckResponse {
    exists: boolean;
    already_recorded?: boolean;
    batch_data?: Record<string, string>;
    message?: string;
}

export interface RecordStockBatchPayload {
    session_id: string;
    batch_number: string;
    material_code: string;
    material_description: string;
    actual_weight: number;
    total_bobbins: number;
    line_position: number;
    row_position: string;
    explanation: string;
    found_by: string;
    found_at: string;
}

export interface RecordStockBatchResponse {
    success: boolean;
    message?: string;
    data?: RecordedBatch;
    errors?: Record<string, string[]>;
}
