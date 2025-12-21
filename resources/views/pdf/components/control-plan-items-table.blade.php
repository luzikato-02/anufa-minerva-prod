@php
    // Component variables
    $items = $items ?? [];
    $startIndex = $startIndex ?? 0;
    $limit = $limit ?? null; // null means show all
    $showHeader = $showHeader ?? true;
@endphp

<div class="control-plan-items-section">
    @if($showHeader)
    <!-- Control Plan Items Table Header -->
    <table style="width: 100%; border-collapse: collapse; font-size: 7pt; margin-top: 20px;">
        <thead>
            <tr style="background-color: #f0f0f0;">
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Process No</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Process Name</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Process Item No.</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Product</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Process</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Special Characteristics</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Product/Process Tolerance</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Measurement Technique</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Sample Size</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Sample Freq</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Control Method</th>
                <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Reaction Plan</th>
            </tr>
        </thead>
        <tbody>
    @else
    <table style="width: 100%; border-collapse: collapse; font-size: 7pt; margin-top: 20px;">
        <tbody>
    @endif
            @php
                $displayItems = $limit !== null 
                    ? array_slice($items, $startIndex, $limit)
                    : array_slice($items, $startIndex);
            @endphp
            
            @forelse($displayItems as $item)
                <tr>
                    <td style="border: 1px solid #000; padding: 4px; text-align: center;">
                        {{ $item['process_no'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: left;">
                        {{ $item['process_step'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: left;">
                        {{ $item['process_items'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: left;">
                        {{ $item['product_characteristics'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: left;">
                        {{ $item['process_characteristics'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: center;">
                        {{ $item['special_characteristics'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: left;">
                        {{ $item['product_process_specification_tolerance'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: left;">
                        {{ $item['evaluation_measurement_technique'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: center;">
                        {{ $item['sample_size'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: center;">
                        {{ $item['sample_frequency'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: left;">
                        {{ $item['control_method'] ?? '-' }}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: left;">
                        {{ $item['reaction_plan'] ?? '-' }}
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="12" style="border: 1px solid #000; padding: 12px; text-align: center; color: #999;">
                        No items available
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>

