<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Support\Facades\DB;

/**
 * SQL fragment builders for querying JSON columns across the three drivers
 * this app supports: sqlite, mysql/mariadb, and pgsql. Postgres has no
 * JSON_EXTRACT/JSON_UNQUOTE — it uses the ->/->> operators instead — and its
 * booleans reject `= 0` / `= 1` comparisons, so raw SQL touching JSON columns
 * or boolean flags needs to branch on driver.
 */
trait HandlesJsonColumns
{
    private function jsonDriver(): string
    {
        return DB::connection()->getDriverName();
    }

    /**
     * Extracts an unquoted scalar from a JSON column at a MySQL-style path,
     * e.g. '$.operator' or '$[0].yarn_type'.
     */
    private function jsonExtract(string $column, string $path): string
    {
        return match ($this->jsonDriver()) {
            'pgsql'  => $this->pgsqlJsonPath($column, $path),
            'sqlite' => "JSON_EXTRACT({$column}, '{$path}')",
            default  => "JSON_UNQUOTE(JSON_EXTRACT({$column}, '{$path}'))",
        };
    }

    /**
     * Length of a top-level JSON array column. JSON_ARRAY_LENGTH is what
     * SQLite calls it; Postgres folds the unquoted identifier to its own
     * lowercase json_array_length(), so the same fragment covers both.
     */
    private function jsonArrayLength(string $column): string
    {
        return in_array($this->jsonDriver(), ['mysql', 'mariadb'], true)
            ? "JSON_LENGTH({$column})"
            : "JSON_ARRAY_LENGTH({$column})";
    }

    /**
     * SQL literal for a boolean value in raw SQL — Postgres booleans reject
     * `= 0` / `= 1`, so this can't just be a hardcoded literal.
     */
    private function boolLiteral(bool $value): string
    {
        return $this->jsonDriver() === 'pgsql'
            ? ($value ? 'true' : 'false')
            : ($value ? '1' : '0');
    }

    /**
     * Integer type name for use inside CAST(... AS <type>) — MySQL's UNSIGNED
     * has no equivalent on the other drivers.
     */
    private function castIntType(): string
    {
        return in_array($this->jsonDriver(), ['mysql', 'mariadb'], true) ? 'UNSIGNED' : 'INTEGER';
    }

    /**
     * Converts a MySQL-style JSON path ('$.foo', '$[0].foo') into a Postgres
     * ->/->> chain. The final hop uses ->> (text); earlier hops use -> (json),
     * since only the last extraction needs to be unwrapped to a scalar.
     */
    private function pgsqlJsonPath(string $column, string $path): string
    {
        preg_match_all('/\.([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\]/', $path, $matches, PREG_SET_ORDER);

        $expr = $column;
        $last = count($matches) - 1;

        foreach ($matches as $i => $m) {
            $op = $i === $last ? '->>' : '->';
            $expr .= $m[1] !== '' ? "{$op}'{$m[1]}'" : "{$op}{$m[2]}";
        }

        return $expr;
    }
}
