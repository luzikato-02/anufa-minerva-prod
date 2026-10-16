<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>{{ $s['doc_no'] }} Rev {{ $s['rev'] }}</title>
{{--
    One template for the print preview ($screen) and the PDF. In the PDF the document header is a fixed block in
    the top page margin, so dompdf repeats it on every physical page however far the plan table runs; on screen
    each logical page draws its own copy.
--}}
<style>
    @page { size: A4 landscape; margin: 50mm 10mm 10mm 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: DejaVu Sans, Arial, sans-serif; font-size: 8pt; color: #111; background: #fff; }
    .pagehead { position: fixed; top: -42mm; left: 0; right: 0; height: 40mm; }
    .pageno:before { content: counter(page); }
    .break { page-break-before: always; }
    .screen { background: #ebe9e3; padding: 24px 0; }
    .screen .page { position: relative; width: 277mm; min-height: 190mm; margin: 0 auto 24px; padding: 10mm; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.1), 0 8px 24px rgba(0,0,0,.08); }
    .screen .pagehead { position: static; height: auto; margin-bottom: 6px; }
    .screen .page-label { width: 277mm; margin: 0 auto 6px; font-size: 9pt; color: #585c61; }
    .mill { margin-bottom: 6px; line-height: 1.35; }
    .title { margin: 0 0 6px; text-align: center; font-size: 11pt; font-weight: bold; letter-spacing: .04em; }
    table { width: 100%; border-collapse: collapse; }
    .head td { padding: 1px 4px; border: 0; vertical-align: top; }
    /* The rule under the header block. On the last row's cells, not the table: dompdf draws cell borders reliably. */
    .head tr.last td { padding-bottom: 5px; border-bottom: 0.6pt solid #1f1f1f; }
    .section { margin: 0 0 6px; text-align: center; font-size: 10pt; font-weight: bold; }
    .grid th, .grid td { border: 0.6pt solid #1f1f1f; padding: 2px 3px; vertical-align: top; text-align: left; overflow-wrap: break-word; }
    .grid th { text-align: center; vertical-align: middle; font-weight: bold; background: #f2f2f2; }
    .grid thead { display: table-header-group; }
    .grid tr { page-break-inside: avoid; }
    .grid ul { margin: 0; padding-left: 12px; }
    .history td { vertical-align: middle; }
    .planhead { margin: 0 0 4px; }
    .planhead td { border: 0; padding: 0; vertical-align: middle; }
    .phase span { margin-right: 14px; white-space: nowrap; }
    .box { display: inline-block; width: 9px; height: 9px; border: 0.6pt solid #111; text-align: center; line-height: 9px; font-size: 7pt; margin-right: 3px; vertical-align: middle; }
    .plantitle { text-align: center; font-size: 10pt; font-weight: bold; }
    .info td { border: 0.6pt solid #1f1f1f; padding: 2px 4px; vertical-align: top; }
    .main { margin-top: 6px; font-size: 7pt; }
    .main td.center { text-align: center; }
    /*
     * Merged cells (process no., group, process name, machine) are drawn by hiding the borders between rows, not
     * with rowspan: dompdf drops a rowspan cell that crosses a page break, shifting every cell after it one column left.
     */
    .main td.more { border-bottom: none; }
    .main td.cont { border-top: none; }
    /* Document codes never break at their hyphens (QA-IK-14 must not wrap as "QA-IK-" / "14"). */
    .nw { white-space: nowrap; }
    .placeholder { color: #6b6f73; font-style: italic; }
    .watermark { position: fixed; top: 22%; left: 18%; width: 64%; text-align: center; font-size: 110pt; font-weight: bold; color: rgba(179, 38, 30, 0.10); transform: rotate(-24deg); z-index: 0; }
    .screen .watermark { position: absolute; top: 38%; }
</style>
</head>
<body class="{{ $screen ? 'screen' : '' }}">
@php
    $info = $s['info'];
    $pages = $s['pages'] ?? \App\ControlPlans\PrintSheet::PAGES;
    // Escapes the text, then keeps each word holding a document code on one line, brackets and commas included.
    $text = fn (string $t) => preg_replace_callback('/\S*[A-Z]+(?:-[A-Z0-9]+)+\S*/', fn ($m) => '<span class="nw">'.$m[0].'</span>', e($t));
    // Column widths of the characteristics table, in percent of the page width (they add up to 100). dompdf ignores
    // <col> widths, so they go on the cells.
    $widths = [4, 6, 7.5, 7.5, 3, 8, 6, 5, 10.5, 9, 3.5, 6, 8, 5, 11];
    $cw = fn (int $i) => 'width: '.$widths[$i].'%';
@endphp

@if (! $screen)
    @include('control-plans.sheet-head', ['s' => $s, 'pageNo' => '<span class="pageno"></span>', 'pages' => $pages])
    @if ($s['watermark'])
        <div class="watermark">DRAFT</div>
    @endif
@endif

@foreach ([1, 2] as $page)
    @if ($screen)
        <p class="page-label">Page {{ $page }} · {{ $page === 1 ? 'Revision history' : 'Control plan' }}</p>
    @endif
    <div @class(['page', 'break' => ! $screen && $page === 2])>
        @if ($screen)
            @if ($s['watermark'])
                <div class="watermark">DRAFT</div>
            @endif
            @include('control-plans.sheet-head', ['s' => $s, 'pageNo' => (string) $page, 'pages' => $pages])
        @endif

        @if ($page === 1)
            <p class="section">REVISION HISTORY</p>
            <table class="grid history">
                <thead>
                    <tr><th style="width: 7%">Page</th><th style="width: 15%">Date of Revision</th><th style="width: 9%">Revision No</th><th style="width: 54%">Description</th><th style="width: 15%">Revised by</th></tr>
                </thead>
                <tbody>
                    @forelse ($s['history'] as $h)
                        <tr>
                            <td>{{ $h['page'] }}</td>
                            <td>{{ $h['date'] }}</td>
                            <td>{{ $h['rev'] }}</td>
                            <td>
                                @if (count($h['description']) > 1)
                                    <ul>@foreach ($h['description'] as $d)<li>{!! $text($d) !!}</li>@endforeach</ul>
                                @else
                                    {!! $text($h['description'][0] ?? '') !!}
                                @endif
                            </td>
                            <td>{{ $h['revised_by'] }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="placeholder">No revision history yet. The author writes it when submitting a revision for review.</td></tr>
                    @endforelse
                </tbody>
            </table>
        @else
            <table class="planhead">
                <tr>
                    <td class="phase" style="width: 34%">
                        @foreach ($s['phases'] as $key => $label)
                            <span><span class="box">{{ ($info['phase'] ?? '') === $key ? '×' : '' }}</span>{{ $label }}</span>
                        @endforeach
                    </td>
                    <td class="plantitle">{{ $s['title'] }}</td>
                    <td style="width: 34%"></td>
                </tr>
            </table>
            <table class="info grid">
                <tr>
                    <td colspan="2"><b>Control Plan Number:</b> {{ $s['doc_no'] }}</td>
                    <td><b>Key Contact/Phone:</b> {{ $info['key_contact'] ?? '' }}</td>
                    <td colspan="2"><b>Date (Orig.):</b> {{ $s['issued'] }}</td>
                    <td><b>Date (Rev.):</b> {{ $s['release_date'] }}</td>
                </tr>
                <tr>
                    <td colspan="2"><b>Part Number / Latest Change Level:</b> {{ $info['part_number'] ?? '' }}</td>
                    <td><b>Core Team:</b> {{ $info['core_team'] ?? '' }}</td>
                    <td></td>
                    <td colspan="2"><b>Customer Engineering Approval/Date (If Req'd.)</b> {{ trim(($info['cust_eng_name'] ?? '').' '.($info['cust_eng_date'] ?? '')) }}</td>
                </tr>
                <tr>
                    <td colspan="2"><b>Part Name / Description:</b> {{ $info['part_name'] ?? '' }}</td>
                    <td><b>Organization/Plan Approval/Date:</b> <span class="nw">{{ $s['status'] === 'released' || $s['status'] === 'superseded' ? $s['release_date'] : '' }}</span></td>
                    <td></td>
                    <td colspan="2"><b>Customer Quality Approval/Date (If Req'd.)</b> {{ trim(($info['cust_qual_name'] ?? '').' '.($info['cust_qual_date'] ?? '')) }}</td>
                </tr>
                <tr>
                    <td><b>Organization/Plant:</b> {{ $info['org_plant'] ?? '' }}</td>
                    <td><b>Organization Code:</b> {{ $info['org_code'] ?? '' }}</td>
                    <td><b>Other Approval/Date (If Req'd.)</b> {{ trim(($info['other1_name'] ?? '').' '.($info['other1_date'] ?? '')) }}</td>
                    <td></td>
                    <td colspan="2"><b>Other Approval (If Req'd.)</b> {{ trim(($info['other2_name'] ?? '').' '.($info['other2_date'] ?? '')) }}</td>
                </tr>
            </table>
            <table class="grid main">
                <thead>
                    <tr><th rowspan="3">Process No.</th><th rowspan="3" colspan="2">Process Name</th><th rowspan="3">Machine, Device, Jig, Tools for MFG</th><th colspan="3">Characteristic</th><th rowspan="3">Special Char. Class</th><th colspan="6">Methods</th><th rowspan="3">Reaction Plan</th></tr>
                    <tr><th rowspan="2">No.</th><th rowspan="2">Product</th><th rowspan="2">Process</th><th rowspan="2">Product/Process Specification/ Tolerance</th><th rowspan="2">Evaluation/ Measurement technique</th><th colspan="2">Sample</th><th rowspan="2">Control Method</th><th rowspan="2">PIC</th></tr>
                    <tr><th>Size</th><th>Freq</th></tr>
                </thead>
                <tbody>
                    @forelse ($s['rows'] as $r => $row)
                        <tr>
                            @foreach ($row as $i => $cell)
                                @php($continues = ! empty($s['rows'][$r + 1][$i]['covered']))
                                <td style="{{ $cw($i) }}" @class(['center' => in_array($i, [0, 4, 7, 10], true), 'cont' => ! empty($cell['covered']), 'more' => $continues])>@if (empty($cell['covered'])){!! $text($cell['text']) !!}@endif</td>
                            @endforeach
                        </tr>
                    @empty
                        <tr><td colspan="15" class="placeholder">No characteristics yet.</td></tr>
                    @endforelse
                </tbody>
            </table>
        @endif
    </div>
@endforeach
</body>
</html>
