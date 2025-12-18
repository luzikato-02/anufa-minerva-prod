<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Control Plan - {{ $controlPlan->document_number }}</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 10mm;
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 9px;
            margin: 0;
            padding: 0;
            color: #000;
        }

        .header {
            margin-bottom: 10px;
        }

        .header-top {
            font-size: 11px;
            font-weight: normal;
            margin-bottom: 5px;
        }

        .header-title {
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            margin: 15px 0;
        }

        .header-info {
            width: 100%;
            margin-bottom: 15px;
        }

        .header-info td {
            vertical-align: top;
            padding: 2px 0;
            border: none;
        }

        .header-info .left-col {
            width: 45%;
        }

        .header-info .right-col {
            width: 55%;
            text-align: right;
        }

        .header-info .label {
            display: inline-block;
            min-width: 180px;
        }

        .header-info .separator {
            display: inline-block;
            width: 20px;
            text-align: center;
        }

        table.main-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
        }

        table.main-table th,
        table.main-table td {
            border: 1px solid #000;
            padding: 4px 3px;
            text-align: center;
            vertical-align: middle;
        }

        table.main-table th {
            background-color: #f0f0f0;
            font-weight: bold;
        }

        table.main-table thead tr:first-child th {
            background-color: #e8e8e8;
        }

        .process-name-cell {
            writing-mode: vertical-rl;
            text-orientation: mixed;
            transform: rotate(180deg);
            white-space: nowrap;
            padding: 5px 2px;
            font-weight: bold;
            background-color: #fff8dc;
        }

        .text-left {
            text-align: left;
        }

        .text-small {
            font-size: 7px;
        }

        .footer {
            margin-top: 20px;
            font-size: 10px;
            font-weight: bold;
        }

        /* Column widths */
        .col-process-no { width: 4%; }
        .col-process-name { width: 5%; }
        .col-machine { width: 8%; }
        .col-char-no { width: 3%; }
        .col-char-product { width: 8%; }
        .col-char-process { width: 8%; }
        .col-special { width: 4%; }
        .col-spec { width: 10%; }
        .col-eval { width: 9%; }
        .col-sample-size { width: 6%; }
        .col-sample-freq { width: 6%; }
        .col-control { width: 7%; }
        .col-reaction { width: 10%; }

        .rowspan-cell {
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-top">
            {{ $controlPlan->title ?? 'Mill Production' }}<br>
            {{ $controlPlan->document_number }}
        </div>

        <div class="header-title">WORK STATION DOCUMENT</div>

        <table class="header-info" style="border: none;">
            <tr>
                <td class="left-col" style="border: none;">
                    <div><span class="label">Referensi SP</span><span class="separator">:</span>{{ $controlPlan->document_number }}</div>
                    <div><span class="label">Tanggal Diterbitkan SP</span><span class="separator">:</span>{{ $controlPlan->created_at ? $controlPlan->created_at->format('d F Y') : '-' }}</div>
                </td>
                <td class="right-col" style="border: none;">
                    <div><span class="label">Tanggal diterbitkan</span><span class="separator">:</span>{{ $controlPlan->created_at ? $controlPlan->created_at->format('d F Y') : '-' }}</div>
                    <div><span class="label">No. Revisi/Tanggal Revisi terakhir</span><span class="separator">:</span>{{ $revision ?? '1' }} / {{ $controlPlan->updated_at ? $controlPlan->updated_at->format('d F Y') : '-' }}</div>
                    <div><span class="label">Tanggal Review berikutnya</span><span class="separator">:</span>{{ $nextReviewDate ?? '-' }}</div>
                    <div><span class="label">Halaman</span><span class="separator">:</span>1 dari 1</div>
                </td>
            </tr>
        </table>
    </div>

    <table class="main-table">
        <thead>
            <tr>
                <th rowspan="3" class="col-process-no">Process<br>No.</th>
                <th rowspan="3" class="col-process-name">Process Name</th>
                <th rowspan="3" class="col-machine">Machine,<br>Device, Jig,<br>Tools for<br>MFG</th>
                <th colspan="3">Characteristic</th>
                <th rowspan="3" class="col-special">Special<br>Char.<br>Class</th>
                <th colspan="5">Methods</th>
                <th rowspan="3" class="col-reaction">Reaction Plan</th>
            </tr>
            <tr>
                <th rowspan="2" class="col-char-no">No.</th>
                <th rowspan="2" class="col-char-product">Product</th>
                <th rowspan="2" class="col-char-process">Process</th>
                <th rowspan="2" class="col-spec">Product/Process<br>Specification/<br>Tolerance</th>
                <th rowspan="2" class="col-eval">Evaluation/<br>Measurement<br>technique</th>
                <th colspan="2">Sample</th>
                <th rowspan="2" class="col-control">Control<br>Method</th>
            </tr>
            <tr>
                <th class="col-sample-size">Size</th>
                <th class="col-sample-freq">Freq</th>
            </tr>
        </thead>
        <tbody>
            @php
                $groupedItems = [];
                $currentGroup = null;
                $groupIndex = 0;
                
                foreach ($controlPlan->items as $item) {
                    $processNo = $item->process_no;
                    if ($currentGroup !== $processNo) {
                        $currentGroup = $processNo;
                        $groupIndex++;
                        $groupedItems[$groupIndex] = [
                            'process_no' => $processNo,
                            'process_name' => $item->process_step,
                            'items' => []
                        ];
                    }
                    $groupedItems[$groupIndex]['items'][] = $item;
                }
            @endphp

            @foreach ($groupedItems as $group)
                @php $rowCount = count($group['items']); @endphp
                @foreach ($group['items'] as $index => $item)
                    <tr>
                        @if ($index === 0)
                            <td rowspan="{{ $rowCount }}" class="rowspan-cell">{{ $group['process_no'] }}</td>
                            <td rowspan="{{ $rowCount }}" class="process-name-cell">{{ $group['process_name'] }}</td>
                        @endif
                        <td class="text-left">{{ $item->machine_device_jig_tools }}</td>
                        <td>{{ $item->process_items ?: '-' }}</td>
                        <td class="text-left">{{ $item->product_process_characteristics }}</td>
                        <td class="text-left">{{ $item->process_items }}</td>
                        <td>{{ $item->special_characteristics ?: '-' }}</td>
                        <td class="text-small">{{ $item->product_process_specification_tolerance }}</td>
                        <td>{{ $item->control_method }}</td>
                        <td>{{ $item->sample_size }}</td>
                        <td>{{ $item->sample_frequency }}</td>
                        <td>{{ $item->control_method }}</td>
                        <td class="text-left text-small">{{ $item->reaction_plan }}</td>
                    </tr>
                @endforeach
            @endforeach

            @if ($controlPlan->items->isEmpty())
                <tr>
                    <td colspan="13" style="padding: 20px; text-align: center; color: #666;">
                        No items in this control plan
                    </td>
                </tr>
            @endif
        </tbody>
    </table>

    <div class="footer">
        COMPANY USE
    </div>
</body>
</html>
