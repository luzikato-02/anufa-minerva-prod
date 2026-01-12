<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Weaving Tension Report</title>
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

        .side-section {
            margin-bottom: 12px;
            page-break-inside: avoid;
        }

        .side-title {
            font-size: 10px;
            font-weight: bold;
            margin: 8px 0 4px 0;
            padding: 3px 6px;
            background-color: #4a4a4a;
            color: white;
        }

        .side-stats {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5px;
        }

        .side-stats td {
            padding: 3px 6px;
            border: 1px solid #ddd;
            text-align: center;
            font-size: 8px;
        }

        .side-stats .side-stat-label {
            background-color: #f0f0f0;
            font-weight: bold;
        }

        .row-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7px;
            margin-bottom: 3px;
        }

        .row-table th {
            background-color: #666;
            color: white;
            padding: 2px 3px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #333;
        }

        .row-table td {
            padding: 2px 3px;
            text-align: center;
            border: 1px solid #ddd;
        }

        .row-table .row-label {
            background-color: #e9e9e9;
            font-weight: bold;
            width: 8%;
        }

        .row-table .out-of-spec-value {
            background-color: #fff3cd;
            color: #dc3545;
            font-weight: bold;
        }

        .row-table .incomplete {
            color: #999;
        }

        .out-of-spec-section {
            margin-top: 15px;
            page-break-inside: avoid;
        }

        .out-of-spec-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
        }

        .out-of-spec-table th {
            background-color: #dc3545;
            color: white;
            padding: 4px;
            text-align: left;
            border: 1px solid #333;
        }

        .out-of-spec-table td {
            padding: 3px 4px;
            border: 1px solid #ddd;
        }

        .out-of-spec-table tr:nth-child(even) {
            background-color: #f9f9f9;
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

        .page-break {
            page-break-before: always;
        }

        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }

        .summary-table th, .summary-table td {
            padding: 4px 6px;
            border: 1px solid #ddd;
            text-align: center;
            font-size: 8px;
        }

        .summary-table th {
            background-color: #4a4a4a;
            color: white;
        }

        .summary-table .row-header {
            background-color: #e9e9e9;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Weaving Tension Report</h1>
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
                <td class="label">Production Order</td>
                <td class="value">{{ $record->production_order ?? '-' }}</td>
                <td class="label">Bale Number</td>
                <td class="value">{{ $record->bale_number ?? '-' }}</td>
            </tr>
            <tr>
                <td class="label">Color Code</td>
                <td class="value">{{ $record->color_code ?? '-' }}</td>
                <td class="label">Meters Check</td>
                <td class="value">{{ $record->meters_check ?? '-' }}</td>
            </tr>
            <tr>
                <td class="label">Spec Tension</td>
                <td class="value">{{ $record->spec_tension ?? '-' }}</td>
                <td class="label">Tolerance (±)</td>
                <td class="value">{{ $record->tension_tolerance ?? '-' }}</td>
            </tr>
            <tr>
                <td class="label">Record Date</td>
                <td class="value">{{ $record->created_at->format('Y-m-d H:i') }}</td>
                <td class="label">Status</td>
                <td class="value">{{ ucfirst($record->status) }}</td>
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

    <div class="section-title">Statistics by Creel Side</div>

    <table class="summary-table">
        <thead>
            <tr>
                <th>Creel Side</th>
                <th>Total</th>
                <th>Completed</th>
                <th>Out of Spec</th>
                <th>Avg Tension</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($sideStats as $side => $sideStat)
                <tr>
                    <td class="row-header">{{ $creelSides[$side] ?? $side }}</td>
                    <td>{{ $sideStat['total'] ?? 0 }}</td>
                    <td>{{ $sideStat['completed'] ?? 0 }}</td>
                    <td style="{{ ($sideStat['out_of_spec'] ?? 0) > 0 ? 'color: #dc3545; font-weight: bold;' : '' }}">
                        {{ $sideStat['out_of_spec'] ?? 0 }}
                    </td>
                    <td>{{ number_format($sideStat['avg_tension'] ?? 0, 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="section-title">Statistics by Row</div>

    <table class="summary-table">
        <thead>
            <tr>
                <th>Row</th>
                <th>Total</th>
                <th>Completed</th>
                <th>Out of Spec</th>
                <th>Avg Tension</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($rowStats as $row => $rowStat)
                <tr>
                    <td class="row-header">Row {{ $row }}</td>
                    <td>{{ $rowStat['total'] ?? 0 }}</td>
                    <td>{{ $rowStat['completed'] ?? 0 }}</td>
                    <td style="{{ ($rowStat['out_of_spec'] ?? 0) > 0 ? 'color: #dc3545; font-weight: bold;' : '' }}">
                        {{ $rowStat['out_of_spec'] ?? 0 }}
                    </td>
                    <td>{{ number_format($rowStat['avg_tension'] ?? 0, 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    @if ($outOfSpecMeasurements->count() > 0)
        <div class="out-of-spec-section">
            <div class="section-title">Out of Spec Measurements ({{ $outOfSpecMeasurements->count() }})</div>
            <table class="out-of-spec-table">
                <thead>
                    <tr>
                        <th style="width: 18%;">Position</th>
                        <th style="width: 12%;">Side</th>
                        <th style="width: 10%;">Row</th>
                        <th style="width: 10%;">Col</th>
                        <th style="width: 12%;">Max</th>
                        <th style="width: 12%;">Min</th>
                        <th style="width: 12%;">Avg</th>
                        <th style="width: 14%;">Range</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($outOfSpecMeasurements->take(50) as $measurement)
                        <tr>
                            <td>{{ $measurement->position_code }}</td>
                            <td>{{ $creelSides[$measurement->creel_side] ?? $measurement->creel_side }}</td>
                            <td>{{ $measurement->row_number }}</td>
                            <td>{{ $measurement->column_number }}</td>
                            <td>{{ number_format($measurement->max_value, 1) }}</td>
                            <td>{{ number_format($measurement->min_value, 1) }}</td>
                            <td style="color: #dc3545; font-weight: bold;">{{ number_format($measurement->avg_value, 1) }}</td>
                            <td>{{ number_format($measurement->range_value, 1) }}</td>
                        </tr>
                    @endforeach
                    @if ($outOfSpecMeasurements->count() > 50)
                        <tr>
                            <td colspan="8" style="text-align: center; font-style: italic;">
                                ... and {{ $outOfSpecMeasurements->count() - 50 }} more out-of-spec measurements
                            </td>
                        </tr>
                    @endif
                </tbody>
            </table>
        </div>
    @endif

    @if ($problems->count() > 0)
        <div class="problems-section">
            <div class="section-title">Reported Problems ({{ $problems->count() }})</div>
            <table class="problems-table">
                <thead>
                    <tr>
                        <th style="width: 15%;">Position</th>
                        <th style="width: 15%;">Type</th>
                        <th style="width: 40%;">Description</th>
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
