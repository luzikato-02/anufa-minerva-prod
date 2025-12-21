@php
    // Variables are passed from the parent template via @include
    $productionArea = $productionArea ?? 'Mill Production TCF1 & TCF2';
    $controlPlanNumber = $controlPlanNumber ?? 'W-WSD-W-30#';
    $spReference = $spReference ?? '-';
    $spPublishDate = $spPublishDate ?? '-';
    $publishDate = $publishDate ?? '-';
    $revisionNo = $revisionNo ?? '-';
    $nextReviewDate = $nextReviewDate ?? '-';
    $currentPage = $currentPage ?? 1;
    $totalPages = $totalPages ?? 14;
@endphp

<div class="work-station-header">
    <!-- Top Left Section: Logo, Production Area, Control Plan Number -->
    <div class="header-top-left">
        <div class="logo-placeholder">
            <!-- Company Logo Placeholder -->
            <div style="width: 80px; height: 60px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #999; margin-bottom: 5px;">
                [LOGO]
            </div>
        </div>
        <div class="production-area" style="font-size: 10pt; font-weight: bold; margin-bottom: 3px;">
            {{ $productionArea }}
        </div>
        <div class="document-number" style="font-size: 10pt; font-weight: bold;">
            {{ $documentNumber ?? $controlPlanNumber }}
        </div>
    </div>

    <!-- Centered Title: WORK STATION DOCUMENT -->
    <div class="work-station-title" style="text-align: center; font-size: 24pt; font-weight: bold; margin: 20px 0;">
        WORK STATION DOCUMENT
    </div>

    <!-- Document Info Table -->
    <div class="document-info-table-wrapper" style="margin-bottom: 15px;">
        <table class="document-info-table" style="width: 100%; border-collapse: collapse; font-size: 9pt;">
            <tr>
                <td style="width: 50%; border: 1px solid #000; padding: 8px; vertical-align: top;">
                    <div style="margin-bottom: 8px;">
                        <strong>Reference SP:</strong> {{ $spReference }}
                    </div>
                    <div>
                        <strong>SP Publish Date:</strong> {{ $spPublishDate }}
                    </div>
                </td>
                <td style="width: 50%; border: 1px solid #000; padding: 8px; vertical-align: top;">
                    <div style="margin-bottom: 8px;">
                        <strong>Publish Date:</strong> {{ $publishDate }}
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Revision No / Latest Revision Date:</strong> {{ $revisionNo }}
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Next Review Date:</strong> {{ $nextReviewDate }}
                    </div>
                    <div>
                        <strong>Page:</strong> {{ $currentPage }} of {{ $totalPages }}
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <!-- Separator Line -->
    <div class="header-separator" style="border-top: 2px solid #000; margin: 15px 0;"></div>
</div>

