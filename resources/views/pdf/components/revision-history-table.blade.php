@php
    // Component variables
    $revisionHistory = $revisionHistory ?? [];
    $itemsPerPage = $itemsPerPage ?? 5;
    $currentPage = $currentPage ?? 1;
    $totalPages = $totalPages ?? 1;
    $shouldPageBreak = ($currentPage == $totalPages) ? 'page-break-after: always;' : '';
@endphp

<div class="revision-history-section" style="{{ $shouldPageBreak }}">
    <!-- Title: REVISION HISTORY -->
    <div style="text-align: center; margin: 20px 0;">
        <h2 style="font-size: 18pt; font-weight: bold; text-decoration: underline; margin: 0;">
            REVISION HISTORY
        </h2>
    </div>

    <!-- Revision History Table -->
    <table style="width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 20px;">
        <thead>
            <tr style="background-color: #f0f0f0;">
                <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">Page</th>
                <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">Date of Revision</th>
                <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">Revision No</th>
                <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">Description</th>
                <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">Revised By</th>
            </tr>
        </thead>
        <tbody>
            @php
                $startIndex = ($currentPage - 1) * $itemsPerPage;
                $endIndex = min($startIndex + $itemsPerPage, count($revisionHistory));
                $pageItems = array_slice($revisionHistory, $startIndex, $itemsPerPage);
            @endphp
            
            @forelse($pageItems as $index => $revision)
                <tr>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center;">
                        {{ $revision['page'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center;">
                        {{ isset($revision['date_of_revision']) ? \Carbon\Carbon::parse($revision['date_of_revision'])->format('Y-m-d') : '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center;">
                        {{ $revision['revision_number'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: left;">
                        {{ $revision['description'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: center;">
                        {{ $revision['revised_by'] ?? '-' }}
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="5" style="border: 1px solid #000; padding: 12px; text-align: center; color: #999;">
                        No revision history available
                    </td>
                </tr>
            @endforelse
            
            {{-- Fill remaining rows if less than itemsPerPage --}}
            @for($i = count($pageItems); $i < $itemsPerPage; $i++)
                <tr>
                    <td style="border: 1px solid #000; padding: 6px;">&nbsp;</td>
                    <td style="border: 1px solid #000; padding: 6px;">&nbsp;</td>
                    <td style="border: 1px solid #000; padding: 6px;">&nbsp;</td>
                    <td style="border: 1px solid #000; padding: 6px;">&nbsp;</td>
                    <td style="border: 1px solid #000; padding: 6px;">&nbsp;</td>
                </tr>
            @endfor
        </tbody>
    </table>
</div>

