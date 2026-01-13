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

.summary-table th {
    background-color: #4a4a4a;
    color: white;
}

.summary-table .row-header {
    background-color: #e9e9e9;
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

.oos-table th {
    background-color: #dc3545;
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

    <h2>CATATAN TENSION WEAVING</h2>

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
            <td><strong>Production Order:</strong> {{ $record->production_order ?? '-' }}</td>
            <td><strong>Bale Number:</strong> {{ $record->bale_number ?? '-' }}</td>
        </tr>
        <tr>
            <td><strong>Color Code:</strong> {{ $record->color_code ?? '-' }}</td>
            <td><strong>Meters Check:</strong> {{ $record->meters_check ?? '-' }}</td>
        </tr>
        <tr>
            <td><strong>Spec Tension:</strong> {{ $record->spec_tension ?? '-' }} (± {{ $record->tension_tolerance ?? '0' }})</td>
            <td><strong>Status:</strong> {{ ucfirst($record->status) }}</td>
        </tr>
        <tr>
            <td colspan="2"><strong>Tanggal:</strong> {{ $record->created_at->format('Y-m-d H:i') }}</td>
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
        {{-- Left Column: Statistics by Creel Side --}}
        <div class="col-table">
            <div class="section-title">Statistik per Creel Side</div>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Side</th>
                        <th>Total</th>
                        <th>Done</th>
                        <th>OOS</th>
                        <th>Avg</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($sideStats as $side => $sideStat)
                        <tr>
                            <td class="row-header">{{ $creelSides[$side] ?? $side }}</td>
                            <td>{{ $sideStat['total'] ?? 0 }}</td>
                            <td>{{ $sideStat['completed'] ?? 0 }}</td>
                            <td class="{{ ($sideStat['out_of_spec'] ?? 0) > 0 ? 'out-of-spec-value' : '' }}">
                                {{ $sideStat['out_of_spec'] ?? 0 }}
                            </td>
                            <td>{{ number_format($sideStat['avg_tension'] ?? 0, 1) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        {{-- Right Column: Statistics by Row --}}
        <div class="col-table">
            <div class="section-title">Statistik per Row</div>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Row</th>
                        <th>Total</th>
                        <th>Done</th>
                        <th>OOS</th>
                        <th>Avg</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($rowStats as $row => $rowStat)
                        <tr>
                            <td class="row-header">Row {{ $row }}</td>
                            <td>{{ $rowStat['total'] ?? 0 }}</td>
                            <td>{{ $rowStat['completed'] ?? 0 }}</td>
                            <td class="{{ ($rowStat['out_of_spec'] ?? 0) > 0 ? 'out-of-spec-value' : '' }}">
                                {{ $rowStat['out_of_spec'] ?? 0 }}
                            </td>
                            <td>{{ number_format($rowStat['avg_tension'] ?? 0, 1) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>

    @if ($outOfSpecMeasurements->count() > 0)
        <div style="margin-top: 10px;">
            <div class="section-title">Pengukuran Out of Spec ({{ $outOfSpecMeasurements->count() }})</div>
            
            <div class="clearfix">
                {{-- Left Column: First half of out-of-spec --}}
                <div class="col-table">
                    <table class="oos-table">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Side</th>
                                <th>Row</th>
                                <th>Col</th>
                                <th>Avg</th>
                            </tr>
                        </thead>
                        <tbody>
                        @php
                            $halfCount = min(50, ceil($outOfSpecMeasurements->count() / 2));
                            $firstHalf = $outOfSpecMeasurements->take($halfCount);
                        @endphp
                        @for ($i = 0; $i < 50; $i++)
                            @php $m = $firstHalf->get($i); @endphp
                            <tr>
                                <td>{{ $i + 1 }}</td>
                                <td>{{ $m->creel_side ?? '' }}</td>
                                <td>{{ $m->row_number ?? '' }}</td>
                                <td>{{ $m->column_number ?? '' }}</td>
                                <td class="{{ $m ? 'out-of-spec-value' : '' }}">{{ $m ? number_format($m->avg_value, 1) : '' }}</td>
                            </tr>
                        @endfor
                        </tbody>
                    </table>
                </div>

                {{-- Right Column: Second half of out-of-spec --}}
                <div class="col-table">
                    <table class="oos-table">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Side</th>
                                <th>Row</th>
                                <th>Col</th>
                                <th>Avg</th>
                            </tr>
                        </thead>
                        <tbody>
                        @php
                            $secondHalf = $outOfSpecMeasurements->skip($halfCount)->take(50);
                        @endphp
                        @for ($i = 0; $i < 50; $i++)
                            @php $m = $secondHalf->get($i); @endphp
                            <tr>
                                <td>{{ $halfCount + $i + 1 }}</td>
                                <td>{{ $m->creel_side ?? '' }}</td>
                                <td>{{ $m->row_number ?? '' }}</td>
                                <td>{{ $m->column_number ?? '' }}</td>
                                <td class="{{ $m ? 'out-of-spec-value' : '' }}">{{ $m ? number_format($m->avg_value, 1) : '' }}</td>
                            </tr>
                        @endfor
                        </tbody>
                    </table>
                </div>
            </div>

            @if ($outOfSpecMeasurements->count() > 100)
                <p style="text-align: center; font-style: italic; margin-top: 5px;">
                    ... dan {{ $outOfSpecMeasurements->count() - 100 }} pengukuran out-of-spec lainnya
                </p>
            @endif
        </div>
    @endif

    @if ($problems->count() > 0)
        <div style="margin-top: 10px;">
            <div class="section-title">Masalah Dilaporkan ({{ $problems->count() }})</div>
            <table class="problems-table">
                <thead>
                    <tr>
                        <th style="width: 18%;">Posisi</th>
                        <th style="width: 17%;">Tipe</th>
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
