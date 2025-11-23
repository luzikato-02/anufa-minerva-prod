<!DOCTYPE html>
<html>
<head>
    <style>
body { 
    font-family: sans-serif; 
    font-size: 9px; /* smaller font */
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
    table-layout: fixed; /* fix column width */
}


th, td {
    border: 1px solid #000;
    padding: 2px 4px; /* smaller padding */
    word-wrap: break-word;
    text-align: center;
    font-size: 10px; /* even smaller font inside table */
}

/* Shrink first 4 columns */
th:nth-child(1), td:nth-child(1) { width: 10%; }   /* No */
th:nth-child(2), td:nth-child(2) { width: 15%; }  /* Side */
th:nth-child(3), td:nth-child(3) { width: 15%; }  /* Row */
th:nth-child(4), td:nth-child(4) { width: 15%; }  /* Col */

/* Meters column will auto-adjust
th:nth-child(5), td:nth-child(5) { width: 65%; } */

h2, h3 { 
    margin: 2px 0; 
    font-size: 12px; /* scale headers down */
}

/* Clear floats after the row */
.clearfix::after {
    content: "";
    display: table;
    clear: both;
}
</style>


</head>
<body>

    <h2>CATATAN CABLE FINISH EARLIER</h2>

    <table class='head-table' style="border:0;">
        <tr><td><strong>Machine:</strong> {{ $metadata['machine_number'] }}</td></tr>
        <tr><td><strong>Style:</strong> {{ $metadata['style'] }}</td></tr>
        <tr><td><strong>Production Order:</strong> {{ $metadata['production_order'] }}</td></tr>
        <tr><td><strong>Roll Construction:</strong> {{ $metadata['roll_construction'] }}</td></tr>
        {{-- <tr><td><strong>Total Finish Earlier:</strong> {{ $metadata['total_finish_earlier'] }}</td></tr>
        <tr><td><strong>Average Meters Finish:</strong> {{ number_format($metadata['average_meters_finish'], 0) }}</td></tr> --}}
    </table>

    <div class="clearfix">
    <div class="col-table">
        <table>
            <thead>
                <tr>
                    <th>No</th>
                    <th>Side</th>
                    <th>Row</th>
                    <th>Col</th>
                    <th>Meters</th>
                    <th>Asal Mesin Twisting</th>
                </tr>
            </thead>
            <tbody>
            @for ($i = 0; $i < 50; $i++)
                <tr>
                    <td>{{ $i + 1 }}</td>
                    <td>{{ $entries[$i]['creel_side'] ?? '' }}</td>
                    <td>{{ $entries[$i]['row_number'] ?? '' }}</td>
                    <td>{{ $entries[$i]['column_number'] ?? '' }}</td>
                    <td>{{ $entries[$i]['meters_finish'] ?? '' }}</td>
                    <td></td>
                </tr>
            @endfor
            </tbody>
        </table>
    </div>

    <div class="col-table">
        <table>
            <thead>
                <tr>
                    <th>No</th>
                    <th>Side</th>
                    <th>Row</th>
                    <th>Col</th>
                    <th>Meters</th>
                    <th>Asal Mesin Twisting</th>
                </tr>
            </thead>
            <tbody>
            @for ($i = 50; $i < 100; $i++)
                <tr>
                    <td>{{ $i + 1 }}</td>
                    <td>{{ $entries[$i]['creel_side'] ?? '' }}</td>
                    <td>{{ $entries[$i]['row_number'] ?? '' }}</td>
                    <td>{{ $entries[$i]['column_number'] ?? '' }}</td>
                    <td>{{ $entries[$i]['meters_finish'] ?? '' }}</td>
                    <td></td>
                </tr>
            @endfor
            </tbody>
        </table>
    </div>
</div>
</div>


</body>
</html>
