{{-- The document header printed at the top of every page. $pageNo is trusted markup (a number, or the PDF's page counter). --}}
<div class="pagehead">
    <div class="mill">{{ $s['mill'] }}<br>{{ $s['doc_no'] }}</div>
    <p class="title">WORK STATION DOCUMENT</p>
    <table class="head">
        @foreach ([
            ['Referensi SP', e($s['sp_ref']), 'Tanggal diterbitkan', e($s['issued'])],
            ['Tanggal Diterbitkan SP', e($s['sp_date']), 'No. Revisi/Tanggal Revisi terakhir', e($s['rev_label'])],
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
