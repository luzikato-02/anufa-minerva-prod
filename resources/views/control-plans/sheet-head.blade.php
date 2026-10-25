{{-- The document header printed at the top of every page. $pageNo is trusted markup (a number, or the PDF's page counter). --}}
<div class="pagehead">
    @if ($s['logo'])
        <img class="logo" src="{{ $s['logo'] }}" alt="">
    @endif
    <div class="mill">@if (in_array('mill', $s['changed'] ?? [], true))<span class="chg">{{ $s['mill'] }}</span>@else{{ $s['mill'] }}@endif<br>{{ $s['doc_no'] }}</div>
    <p class="title">WORK STATION DOCUMENT</p>
    <table class="head">
        {{-- A header value changed since the last release prints bold italic. --}}
        @php($v = fn (string $k) => in_array($k, $s['changed'] ?? [], true) ? '<span class="chg">'.e($s[$k]).'</span>' : e($s[$k]))
        @foreach ([
            ['Referensi SP', $v('sp_ref'), 'Tanggal diterbitkan', $v('issued')],
            ['Tanggal Diterbitkan SP', $v('sp_date'), 'No. Revisi/Tanggal Revisi terakhir', e($s['rev_label'])],
            ['', '', 'Tanggal Review berikutnya', e($s['next_review'])],
            ['', '', 'Halaman', $pageNo.' dari '.$pages],
        ] as $r)
            <tr @class(['last' => $loop->last])>
                <td style="width: 18%">{{ $r[0] }}</td><td style="width: 2%">{{ $r[0] !== '' ? ':' : '' }}</td><td style="width: 22%">{!! $r[1] !!}</td>
                <td style="width: 26%">{{ $r[2] }}</td><td style="width: 2%">:</td><td>{!! $r[3] !!}</td>
            </tr>
        @endforeach
    </table>
</div>
