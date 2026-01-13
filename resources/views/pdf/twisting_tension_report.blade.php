<!DOCTYPE html>
<html>
<head>
    <style>
body { 
    font-family: sans-serif; 
    font-size: 9px;
    margin: 0;
}

.col-table {
    width: 48%;
    float: left;
    margin-right: 2%;
    margin-left: 0.5%
}

.col-table:last-child {
    margin-right: 0;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 2px;
    table-layout: fixed;
}

th, td {
    border: 1px solid #000;
    padding: 2px 4px;
    word-wrap: break-word;
    text-align: center;
    font-size: 10px;
}

.head-table td {
    border: 0;
    text-align: left;
    padding: 1px 4px;
}

.stats-table td {
    padding: 3px 6px;
}

.stats-label {
    background-color: #f0f0f0;
    font-weight: bold;
}

.in-spec {
    background-color: #d4edda;
    color: #155724;
}

.out-of-spec {
    background-color: #f8d7da;
    color: #721c24;
}

.out-of-spec-row {
    background-color: #fff3cd;
}

.out-of-spec-value {
    color: #dc3545;
    font-weight: bold;
}

.incomplete {
    color: #999;
}

th:nth-child(1), td:nth-child(1) { width: 12%; }
th:nth-child(2), td:nth-child(2) { width: 22%; }
th:nth-child(3), td:nth-child(3) { width: 22%; }
th:nth-child(4), td:nth-child(4) { width: 22%; }
th:nth-child(5), td:nth-child(5) { width: 22%; }

h2, h3 { 
    margin: 2px 0; 
    font-size: 12px;
}

.clearfix::after {
    content: "";
    display: table;
    clear: both;
}

.section-title {
    font-size: 11px;
    font-weight: bold;
    margin: 8px 0 4px 0;
    padding: 3px 6px;
    background-color: #333;
    color: white;
}

.problems-table th {
    background-color: #dc3545;
    color: white;
}

.severity-low { color: #28a745; }
.severity-medium { color: #ffc107; }
.severity-high { color: #fd7e14; }
.severity-critical { color: #dc3545; font-weight: bold; }
</style>
</head>
<body>

    <h2>CATATAN TENSION TWISTING</h2>

    <table class='head-table' style="border:0;">
        <tr>
            <td><strong>Operator:</strong> {{ $record->operator ?? '-' }}</td>
            <td><strong>Machine:</strong> {{ $record->machine_number ?? '-' }}</td>
        </tr>
        <tr>
            <td><strong>Item Number:</strong> {{ $record->item_number ?? '-' }}</td>
            <td><strong>Item Description:</strong> {{ $record->item_description ?? '-' }}</td>
        </tr>
        <tr>
            <td><strong>DTEX Number:</strong> {{ $record->dtex_number ?? '-' }}</td>
            <td><strong>Yarn Code:</strong> {{ $record->yarn_code ?? '-' }}</td>
        </tr>
        <tr>
            <td><strong>TPM:</strong> {{ $record->tpm ?? '-' }}</td>
            <td><strong>RPM:</strong> {{ $record->rpm ?? '-' }}</td>
        </tr>
        <tr>
            <td><strong>Spec Tension:</strong> {{ $record->spec_tension ?? '-' }} (± {{ $record->tension_tolerance ?? '0' }})</td>
            <td><strong>Meters Check:</strong> {{ $record->meters_check ?? '-' }}</td>
        </tr>
        <tr>
            <td><strong>Tanggal:</strong> {{ $record->created_at->format('Y-m-d H:i') }}</td>
            <td><strong>Status:</strong> {{ ucfirst($record->status) }}</td>
        </tr>
    </table>

    <table class="stats-table" style="margin-top: 8px; margin-bottom: 8px;">
        <tr>
            <td class="stats-label">Total</td>
            <td class="stats-label">Completed</td>
            <td class="stats-label">In Spec</td>
            <td class="stats-label">Out of Spec</td>
            <td class="stats-label">Avg Tension</td>
        </tr>
        <tr>
            <td>{{ $stats['total'] ?? 0 }}</td>
            <td>{{ $stats['completed'] ?? 0 }}</td>
            <td class="in-spec">{{ $stats['in_spec'] ?? 0 }}</td>
            <td class="out-of-spec">{{ $stats['out_of_spec'] ?? 0 }}</td>
            <td>{{ number_format($tensionStats['avg'] ?? 0, 2) }}</td>
        </tr>
    </table>

    <div class="clearfix">
        {{-- Left Column: Spindles 1-42 --}}
        <div class="col-table">
            <table>
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Max</th>
                        <th>Min</th>
                        <th>Avg</th>
                        <th>Range</th>
                    </tr>
                </thead>
                <tbody>
                @for ($i = 1; $i <= 42; $i++)
                    @php
                        $measurement = $measurements->firstWhere('spindle_number', $i);
                        $isOutOfSpec = $measurement && $measurement->is_out_of_spec;
                        $isComplete = $measurement && $measurement->is_complete;
                    @endphp
                    <tr class="{{ $isOutOfSpec ? 'out-of-spec-row' : '' }}">
                        <td>{{ $i }}</td>
                        @if ($isComplete)
                            <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->max_value, 1) }}</td>
                            <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->min_value, 1) }}</td>
                            <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->avg_value, 1) }}</td>
                            <td>{{ number_format($measurement->range_value, 1) }}</td>
                        @else
                            <td class="incomplete">-</td>
                            <td class="incomplete">-</td>
                            <td class="incomplete">-</td>
                            <td class="incomplete">-</td>
                        @endif
                    </tr>
                @endfor
                </tbody>
            </table>
        </div>

        {{-- Right Column: Spindles 43-84 --}}
        <div class="col-table">
            <table>
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Max</th>
                        <th>Min</th>
                        <th>Avg</th>
                        <th>Range</th>
                    </tr>
                </thead>
                <tbody>
                @for ($i = 43; $i <= 84; $i++)
                    @php
                        $measurement = $measurements->firstWhere('spindle_number', $i);
                        $isOutOfSpec = $measurement && $measurement->is_out_of_spec;
                        $isComplete = $measurement && $measurement->is_complete;
                    @endphp
                    <tr class="{{ $isOutOfSpec ? 'out-of-spec-row' : '' }}">
                        <td>{{ $i }}</td>
                        @if ($isComplete)
                            <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->max_value, 1) }}</td>
                            <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->min_value, 1) }}</td>
                            <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->avg_value, 1) }}</td>
                            <td>{{ number_format($measurement->range_value, 1) }}</td>
                        @else
                            <td class="incomplete">-</td>
                            <td class="incomplete">-</td>
                            <td class="incomplete">-</td>
                            <td class="incomplete">-</td>
                        @endif
                    </tr>
                @endfor
                </tbody>
            </table>
        </div>
    </div>

    @if ($problems->count() > 0)
        <div style="margin-top: 10px;">
            <div class="section-title">Masalah Dilaporkan ({{ $problems->count() }})</div>
            <table class="problems-table">
                <thead>
                    <tr>
                        <th style="width: 15%;">Spindle</th>
                        <th style="width: 20%;">Tipe</th>
                        <th style="width: 35%;">Deskripsi</th>
                        <th style="width: 15%;">Severity</th>
                        <th style="width: 15%;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($problems as $problem)
                        <tr>
                            <td>{{ $problem->position_identifier }}</td>
                            <td>{{ ucfirst(str_replace('_', ' ', $problem->problem_type)) }}</td>
                            <td style="text-align: left;">{{ $problem->description }}</td>
                            <td class="severity-{{ $problem->severity }}">{{ ucfirst($problem->severity) }}</td>
                            <td>{{ ucfirst(str_replace('_', ' ', $problem->resolution_status)) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif

</body>
</html>
