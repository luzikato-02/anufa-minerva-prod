<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Twisting Tension Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 9px;
            line-height: 1.3;
            color: #333;
        }

        .header {
            text-align: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 2px solid #333;
        }

        .header h1 {
            font-size: 16px;
            margin-bottom: 3px;
            text-transform: uppercase;
        }

        .header .subtitle {
            font-size: 10px;
            color: #666;
        }

        .info-section {
            margin-bottom: 10px;
        }

        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
        }

        .info-table td {
            padding: 3px 6px;
            border: 1px solid #ddd;
            font-size: 9px;
        }

        .info-table .label {
            background-color: #f5f5f5;
            font-weight: bold;
            width: 20%;
        }

        .info-table .value {
            width: 30%;
        }

        .stats-section {
            margin-bottom: 10px;
        }

        .stats-grid {
            width: 100%;
            border-collapse: collapse;
        }

        .stats-grid td {
            padding: 4px 8px;
            border: 1px solid #ddd;
            text-align: center;
            font-size: 9px;
        }

        .stats-grid .stat-label {
            background-color: #f0f0f0;
            font-weight: bold;
        }

        .stats-grid .stat-value {
            font-size: 11px;
            font-weight: bold;
        }

        .stats-grid .in-spec {
            background-color: #d4edda;
            color: #155724;
        }

        .stats-grid .out-of-spec {
            background-color: #f8d7da;
            color: #721c24;
        }

        .section-title {
            font-size: 11px;
            font-weight: bold;
            margin: 10px 0 5px 0;
            padding: 4px 8px;
            background-color: #333;
            color: white;
        }

        .measurements-container {
            display: table;
            width: 100%;
        }

        .measurements-column {
            display: table-cell;
            width: 25%;
            padding: 0 2px;
            vertical-align: top;
        }

        .measurement-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
        }

        .measurement-table th {
            background-color: #4a4a4a;
            color: white;
            padding: 3px 2px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #333;
        }

        .measurement-table td {
            padding: 2px;
            text-align: center;
            border: 1px solid #ddd;
        }

        .measurement-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }

        .measurement-table .spindle-num {
            font-weight: bold;
            background-color: #e9e9e9;
            width: 15%;
        }

        .measurement-table .out-of-spec-row {
            background-color: #fff3cd !important;
        }

        .measurement-table .out-of-spec-value {
            color: #dc3545;
            font-weight: bold;
        }

        .measurement-table .incomplete {
            color: #999;
            font-style: italic;
        }

        .problems-section {
            margin-top: 15px;
            page-break-inside: avoid;
        }

        .problems-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
        }

        .problems-table th {
            background-color: #dc3545;
            color: white;
            padding: 4px;
            text-align: left;
            border: 1px solid #333;
        }

        .problems-table td {
            padding: 3px 4px;
            border: 1px solid #ddd;
        }

        .problems-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }

        .severity-low {
            color: #28a745;
        }

        .severity-medium {
            color: #ffc107;
        }

        .severity-high {
            color: #fd7e14;
        }

        .severity-critical {
            color: #dc3545;
            font-weight: bold;
        }

        .footer {
            margin-top: 15px;
            padding-top: 8px;
            border-top: 1px solid #ddd;
            font-size: 8px;
            color: #666;
            text-align: center;
        }

        .clearfix::after {
            content: "";
            display: table;
            clear: both;
        }

        .col-half {
            width: 48%;
            float: left;
            margin-right: 2%;
        }

        .col-half:last-child {
            margin-right: 0;
        }

        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Twisting Tension Report</h1>
        <div class="subtitle">Generated: {{ now()->format('Y-m-d H:i:s') }}</div>
    </div>

    <div class="info-section">
        <table class="info-table">
            <tr>
                <td class="label">Operator</td>
                <td class="value">{{ $record->operator ?? '-' }}</td>
                <td class="label">Machine Number</td>
                <td class="value">{{ $record->machine_number ?? '-' }}</td>
            </tr>
            <tr>
                <td class="label">Item Number</td>
                <td class="value">{{ $record->item_number ?? '-' }}</td>
                <td class="label">Item Description</td>
                <td class="value">{{ $record->item_description ?? '-' }}</td>
            </tr>
            <tr>
                <td class="label">DTEX Number</td>
                <td class="value">{{ $record->dtex_number ?? '-' }}</td>
                <td class="label">Yarn Code</td>
                <td class="value">{{ $record->yarn_code ?? '-' }}</td>
            </tr>
            <tr>
                <td class="label">TPM</td>
                <td class="value">{{ $record->tpm ?? '-' }}</td>
                <td class="label">RPM</td>
                <td class="value">{{ $record->rpm ?? '-' }}</td>
            </tr>
            <tr>
                <td class="label">Spec Tension</td>
                <td class="value">{{ $record->spec_tension ?? '-' }}</td>
                <td class="label">Tolerance (±)</td>
                <td class="value">{{ $record->tension_tolerance ?? '-' }}</td>
            </tr>
            <tr>
                <td class="label">Meters Check</td>
                <td class="value">{{ $record->meters_check ?? '-' }}</td>
                <td class="label">Record Date</td>
                <td class="value">{{ $record->created_at->format('Y-m-d H:i') }}</td>
            </tr>
        </table>
    </div>

    <div class="stats-section">
        <table class="stats-grid">
            <tr>
                <td class="stat-label">Total Measurements</td>
                <td class="stat-label">Completed</td>
                <td class="stat-label">In Spec</td>
                <td class="stat-label">Out of Spec</td>
                <td class="stat-label">Progress</td>
                <td class="stat-label">Avg Tension</td>
            </tr>
            <tr>
                <td class="stat-value">{{ $stats['total'] ?? 0 }}</td>
                <td class="stat-value">{{ $stats['completed'] ?? 0 }}</td>
                <td class="stat-value in-spec">{{ $stats['in_spec'] ?? 0 }}</td>
                <td class="stat-value out-of-spec">{{ $stats['out_of_spec'] ?? 0 }}</td>
                <td class="stat-value">{{ $record->progress_percentage ?? 0 }}%</td>
                <td class="stat-value">{{ number_format($tensionStats['avg'] ?? 0, 2) }}</td>
            </tr>
        </table>
    </div>

    <div class="section-title">Spindle Measurements</div>

    <div class="measurements-container">
        {{-- Column 1: Spindles 1-21 --}}
        <div class="measurements-column">
            <table class="measurement-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Max</th>
                        <th>Min</th>
                        <th>Avg</th>
                    </tr>
                </thead>
                <tbody>
                    @for ($i = 1; $i <= 21; $i++)
                        @php
                            $measurement = $measurements->firstWhere('spindle_number', $i);
                            $isOutOfSpec = $measurement && $measurement->is_out_of_spec;
                            $isComplete = $measurement && $measurement->is_complete;
                        @endphp
                        <tr class="{{ $isOutOfSpec ? 'out-of-spec-row' : '' }}">
                            <td class="spindle-num">{{ $i }}</td>
                            @if ($isComplete)
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->max_value, 1) }}</td>
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->min_value, 1) }}</td>
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->avg_value, 1) }}</td>
                            @else
                                <td class="incomplete">-</td>
                                <td class="incomplete">-</td>
                                <td class="incomplete">-</td>
                            @endif
                        </tr>
                    @endfor
                </tbody>
            </table>
        </div>

        {{-- Column 2: Spindles 22-42 --}}
        <div class="measurements-column">
            <table class="measurement-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Max</th>
                        <th>Min</th>
                        <th>Avg</th>
                    </tr>
                </thead>
                <tbody>
                    @for ($i = 22; $i <= 42; $i++)
                        @php
                            $measurement = $measurements->firstWhere('spindle_number', $i);
                            $isOutOfSpec = $measurement && $measurement->is_out_of_spec;
                            $isComplete = $measurement && $measurement->is_complete;
                        @endphp
                        <tr class="{{ $isOutOfSpec ? 'out-of-spec-row' : '' }}">
                            <td class="spindle-num">{{ $i }}</td>
                            @if ($isComplete)
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->max_value, 1) }}</td>
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->min_value, 1) }}</td>
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->avg_value, 1) }}</td>
                            @else
                                <td class="incomplete">-</td>
                                <td class="incomplete">-</td>
                                <td class="incomplete">-</td>
                            @endif
                        </tr>
                    @endfor
                </tbody>
            </table>
        </div>

        {{-- Column 3: Spindles 43-63 --}}
        <div class="measurements-column">
            <table class="measurement-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Max</th>
                        <th>Min</th>
                        <th>Avg</th>
                    </tr>
                </thead>
                <tbody>
                    @for ($i = 43; $i <= 63; $i++)
                        @php
                            $measurement = $measurements->firstWhere('spindle_number', $i);
                            $isOutOfSpec = $measurement && $measurement->is_out_of_spec;
                            $isComplete = $measurement && $measurement->is_complete;
                        @endphp
                        <tr class="{{ $isOutOfSpec ? 'out-of-spec-row' : '' }}">
                            <td class="spindle-num">{{ $i }}</td>
                            @if ($isComplete)
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->max_value, 1) }}</td>
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->min_value, 1) }}</td>
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->avg_value, 1) }}</td>
                            @else
                                <td class="incomplete">-</td>
                                <td class="incomplete">-</td>
                                <td class="incomplete">-</td>
                            @endif
                        </tr>
                    @endfor
                </tbody>
            </table>
        </div>

        {{-- Column 4: Spindles 64-84 --}}
        <div class="measurements-column">
            <table class="measurement-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Max</th>
                        <th>Min</th>
                        <th>Avg</th>
                    </tr>
                </thead>
                <tbody>
                    @for ($i = 64; $i <= 84; $i++)
                        @php
                            $measurement = $measurements->firstWhere('spindle_number', $i);
                            $isOutOfSpec = $measurement && $measurement->is_out_of_spec;
                            $isComplete = $measurement && $measurement->is_complete;
                        @endphp
                        <tr class="{{ $isOutOfSpec ? 'out-of-spec-row' : '' }}">
                            <td class="spindle-num">{{ $i }}</td>
                            @if ($isComplete)
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->max_value, 1) }}</td>
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->min_value, 1) }}</td>
                                <td class="{{ $isOutOfSpec ? 'out-of-spec-value' : '' }}">{{ number_format($measurement->avg_value, 1) }}</td>
                            @else
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
        <div class="problems-section">
            <div class="section-title">Reported Problems ({{ $problems->count() }})</div>
            <table class="problems-table">
                <thead>
                    <tr>
                        <th style="width: 12%;">Spindle</th>
                        <th style="width: 15%;">Type</th>
                        <th style="width: 43%;">Description</th>
                        <th style="width: 12%;">Severity</th>
                        <th style="width: 18%;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($problems as $problem)
                        <tr>
                            <td>{{ $problem->position_identifier }}</td>
                            <td>{{ ucfirst(str_replace('_', ' ', $problem->problem_type)) }}</td>
                            <td>{{ $problem->description }}</td>
                            <td class="severity-{{ $problem->severity }}">{{ ucfirst($problem->severity) }}</td>
                            <td>{{ ucfirst(str_replace('_', ' ', $problem->resolution_status)) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endif

    <div class="footer">
        <p>Record ID: {{ $record->id }} | Status: {{ ucfirst($record->status) }} | User: {{ $record->user->name ?? 'N/A' }}</p>
    </div>
</body>
</html>
