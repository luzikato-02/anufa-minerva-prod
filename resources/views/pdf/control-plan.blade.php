<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Control Plan - {{ $controlPlan->document_number ?? 'N/A' }}</title>
    <style>
        @page {
            margin: 20mm;
            size: A4;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #000;
        }
        
        .work-station-header {
            margin-bottom: 20px;
        }
        
        .header-top-left {
            float: left;
            width: 200px;
        }
        
        .logo-placeholder {
            margin-bottom: 5px;
        }
        
        .work-station-title {
            clear: both;
            text-align: center;
            margin: 20px 0;
        }
        
        .document-info-table {
            clear: both;
        }
        
        .manufacturing-step-table {
            margin: 20px 0;
        }
        
        .document-title {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            text-decoration: underline;
            margin: 20px 0;
        }
        
        table {
            border-collapse: collapse;
            width: 100%;
        }
        
        th, td {
            border: 1px solid #000;
        }
        
        .page-break {
            page-break-after: always;
        }
    </style>
</head>
<body>
    @php
        $controlPlanData = $controlPlan->toArray();
        $revisionHistory = $controlPlan->revisionHistory->toArray();
        $items = $controlPlan->items->toArray();
        
        // Calculate total pages
        $revisionHistoryPages = ceil(count($revisionHistory) / 5);
        $itemsPerPage = 3; // First page shows 3 items
        $remainingItems = max(0, count($items) - $itemsPerPage);
        $additionalItemPages = ceil($remainingItems / 10); // Assume 10 items per page after first page
        $totalPages = 1 + $revisionHistoryPages + 1 + max(1, $additionalItemPages); // 1 header + revision pages + 1 control plan page + item pages
        
        // Format dates
        $spPublishDate = $controlPlan->tanggal_diterbitkan_sp ? \Carbon\Carbon::parse($controlPlan->tanggal_diterbitkan_sp)->format('Y-m-d') : '-';
        $documentPublishDate = $controlPlan->tanggal_diterbitkan ? \Carbon\Carbon::parse($controlPlan->tanggal_diterbitkan)->format('Y-m-d') : '-';
        $nextReviewDate = $controlPlan->tanggal_review_berikutnya ? \Carbon\Carbon::parse($controlPlan->tanggal_review_berikutnya)->format('Y-m-d') : '-';
        
        // Get original and revision dates
        $dateOrig = $controlPlan->tanggal_diterbitkan ? \Carbon\Carbon::parse($controlPlan->tanggal_diterbitkan)->format('Y-m-d') : '-';
        $latestRevision = $controlPlan->revisionHistory()->orderBy('date_of_revision', 'desc')->first();
        $dateRev = $latestRevision && $latestRevision->date_of_revision ? \Carbon\Carbon::parse($latestRevision->date_of_revision)->format('Y-m-d') : '-';
        
        // Determine manufacturing step checkmarks
        $manufacturingStep = $controlPlan->manufacturing_step ?? 'production';
        $prototypeChecked = in_array($manufacturingStep, ['prototype']) ? 'X' : '';
        $preLaunchChecked = in_array($manufacturingStep, ['pre-launch']) ? 'X' : '';
        $productionChecked = in_array($manufacturingStep, ['production']) ? 'X' : '';
    @endphp

    <!-- Document Header -->
    @include('pdf.partials.work-station-header', [
        'productionArea' => $controlPlan->production_area ?? 'Mill Production TCF1 & TCF2',
        'documentNumber' => $controlPlan->document_number ?? '-',
        'spReference' => $controlPlan->referensi_sp ?? '-',
        'spPublishDate' => $spPublishDate,
        'publishDate' => $documentPublishDate,
        'revisionNo' => $controlPlan->no_revisi_tanggal_revisi_terakhir ?? '-',
        'nextReviewDate' => $nextReviewDate,
        'currentPage' => 1,
        'totalPages' => $totalPages
    ])

    <!-- Revision History Section -->
    @php
        $revisionHistoryPages = ceil(count($revisionHistory) / 5);
    @endphp
    
    @for($page = 1; $page <= $revisionHistoryPages; $page++)
        @include('pdf.components.revision-history-table', [
            'revisionHistory' => $revisionHistory,
            'itemsPerPage' => 5,
            'currentPage' => $page,
            'totalPages' => $revisionHistoryPages
        ])
    @endfor

    <!-- Control Plan First Page -->
    <div class="page-break"></div>
    
    <!-- Document Title -->
    <div class="document-title">
        {{ $controlPlan->title ?? 'CONTROL PLAN' }}
    </div>
    
    <!-- Manufacturing Step Table -->
    <table class="manufacturing-step-table" style="width: auto; margin: 20px 0; border-collapse: collapse;">
        <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; width: 100px;">
                <strong>Prototype</strong><br>
                {{ $prototypeChecked }}
            </td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; width: 100px;">
                <strong>Pre-launch</strong><br>
                {{ $preLaunchChecked }}
            </td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center; width: 100px;">
                <strong>Production</strong><br>
                {{ $productionChecked }}
            </td>
        </tr>
    </table>
    
    <!-- Control Plan Information Table -->
    @include('pdf.components.control-plan-information-table', [
        'controlPlan' => $controlPlanData,
        'dateOrig' => $dateOrig,
        'dateRev' => $dateRev
    ])
    
    <!-- Control Plan Items Table (First Page - 3 items) -->
    @include('pdf.components.control-plan-items-table', [
        'items' => $items,
        'startIndex' => 0,
        'limit' => 3,
        'showHeader' => true
    ])
    
    <!-- Additional Pages for Remaining Items -->
    @if(count($items) > 3)
        @php
            $remainingItems = array_slice($items, 3);
            $itemsPerAdditionalPage = 10;
            $additionalPages = ceil(count($remainingItems) / $itemsPerAdditionalPage);
        @endphp
        
        @for($page = 1; $page <= $additionalPages; $page++)
            <div class="page-break"></div>
            
            <!-- Header for additional pages -->
            @include('pdf.partials.work-station-header', [
                'productionArea' => $controlPlan->production_area ?? 'Mill Production TCF1 & TCF2',
                'documentNumber' => $controlPlan->document_number ?? '-',
                'spReference' => $controlPlan->referensi_sp ?? '-',
                'spPublishDate' => $spPublishDate,
                'publishDate' => $documentPublishDate,
                'revisionNo' => $controlPlan->no_revisi_tanggal_revisi_terakhir ?? '-',
                'nextReviewDate' => $nextReviewDate,
                'currentPage' => 1 + $revisionHistoryPages + 1 + $page,
                'totalPages' => $totalPages
            ])
            
            @include('pdf.components.control-plan-items-table', [
                'items' => $remainingItems,
                'startIndex' => ($page - 1) * $itemsPerAdditionalPage,
                'limit' => $itemsPerAdditionalPage,
                'showHeader' => true
            ])
        @endfor
    @endif
</body>
</html>

