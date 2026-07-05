# Creel Export Data Patterns

Reference for every encoding variant found in raw creel XLSX exports and how the import pipeline handles each one.

## Column layout (A–M)

| Col | Field | Notes |
|-----|-------|-------|
| A | Order number | SAP production order |
| B | Net weight | Float, kg |
| C | Creel side | See side formats below |
| D | Creel from | Starting position, see position formats |
| E | Creel to | Ending position |
| F | Count | Total bobbin count for this batch entry |
| G | Batch | Batch/lot number — row is skipped if empty |
| H | Material | Material/yarn code |
| I | Machine | Loom/machine number |
| J | Date | `YYYYMMDD` string |
| K | Operator | Operator ID |
| L | Shift load | Shift number |
| M | User name | SAP username |

---

## Side field formats

### Standard sides
Single or compound known tokens. The controller treats any side that `str_contains` a known 2-letter code as covering that side.

| Value | Meaning |
|-------|---------|
| `AI` | Inner side of Rack A |
| `AO` | Outer side of Rack A |
| `BI` | Inner side of Rack B |
| `BO` | Outer side of Rack B |
| `AIBI` | Both inner sides (Rack A inner + Rack B inner) |
| `AOBO` | Both outer sides |
| `AIBO` | Rack A inner + Rack B outer |
| `AOBI` | Rack A outer + Rack B inner |

### Auto-normalized typos (no user input needed)

| Raw value | Normalized to | Rule |
|-----------|--------------|------|
| `AI BI` | `AIBI` | Space between known tokens → join |
| `AO BO` | `AOBO` | Same |
| `BO AO` | `AOBO` | Reordered tokens → canonical order |
| `AIB` | `AIBI` | Incomplete 4-char compound → complete |

### Ambiguous / unrecoverable (user correction required)

| Value | Problem |
|-------|---------|
| `O` | Could be `AO` or `BO` |
| `B` | Could be `BI` or `BO` |

---

## Position field formats

A position is a **column number** (1–100) followed by a **row letter** (A–E).

### Standard position: `{col}{row}`
Examples: `1A`, `37E`, `100C`, `15AE` (two-letter = rectangle bounding box).

### Auto-fixable typos

| Raw | Fix | Rule |
|-----|-----|------|
| `12E.` | `12E` | Strip trailing non-alphanumeric |

### User correction required

| Raw | Problem |
|-----|---------|
| `37` | Digits only — row letter missing |
| `25` | Same |
| `60W` | `W` is not a valid creel row (valid: A–E) |
| `95S` | Same — `S` is invalid |

---

## Multi-side row formats

When a single XLSX row encodes bobbins on more than one side, several encoding conventions are used.

### 1. Descriptive prefix format

**Detection:** The `from` or `to` cell starts with a known side token followed by a space.

**Semantics:** `SIDE startPos-endPos` specifies the range for that sub-side. `SIDE startPos-count` (digits after the dash) specifies the starting position and a bobbin count; the end position is computed in snake (column-major) order.

```
Side  | From           | To             | Result
------+----------------+----------------+--------------------------------
AOBO  | AO 69A-70B     | BO 61A-70C     | {AO, 69A, 70B} + {BO, 61A, 70C}
AIBI  | AI 84D-95A     | BI 84B-95E     | {AI, 84D, 95A} + {BI, 84B, 95E}
BO,AIBI | BO 85A-88C   | AIBI 79A-8     | {BO, 85A, 88C} + {AIBI, 79A, 79D}
```

For the count variant (`AIBI 79A-8`): count bobbins ÷ number of sub-sides = positions per side. Advance that many steps from the start in snake order to find the end position.

> AIBI has 2 sub-sides (AI and BI). `79A-8` → 8 ÷ 2 = 4 positions per side.  
> Snake from 79A: 79A → 79B → 79C → 79D → end = **79D**.

If a cell appears truncated (e.g., `AIBI 87D-9` where `9` is an incomplete number), that sub-side entry falls back to a user-correction issue instead of producing a wrong range.

### 2. Space-paired format

**Detection:** Side has N space/comma-separated components AND from/to each have exactly N space-separated tokens that all match `\d+[A-E]`.

Each component i of the side maps to token i of from and token i of to.

```
Side      | From      | To        | Result
----------+-----------+-----------+--------------------------------
AO AIBI   | 61A 81B   | 70B 82C   | {AO, 61A, 70B} + {AIBI, 81B, 82C}
BO AIBI   | 61A 82D   | 70C 83E   | {BO, 61A, 70C} + {AIBI, 82D, 83E}
AIBI AOBO | 79A 61A   | 83D 62A   | {AIBI, 79A, 83D} + {AOBO, 61A, 62A}
AOBO AIBI | 85A 91A   | 88C 93C   | {AOBO, 85A, 88C} + {AIBI, 91A, 93C}
```

### 3. Compound side, shared range

**Detection:** Side has N components; from/to are each a single valid `\d+[A-E]{1,2}`.

The same from/to range applies to every sub-side.

```
Side      | From | To  | Result
----------+------+-----+--------------------------------
AIBI AOBO | 88B  | 90E | {AIBI, 88B, 90E} + {AOBO, 88B, 90E}
BO AO     | 37A  | 44E | {BO, 37A, 44E} + {AO, 37A, 44E}
```

---

## Empty rows

Rows with an empty batch field (column G) are silently skipped. Rows with an empty batch AND empty side/from/to are also skipped (these appear as blank separator rows in some exports).

---

## Upload flow

1. File is parsed server-side on first upload.
2. Auto-normalizable rows (typos, descriptive prefix, space-paired, shared-range) are resolved in memory.
3. Rows with ambiguous sides, missing row letters, invalid row letters, or unrecognized patterns are returned to the frontend as `issues`.
4. The UI shows a **correction dialog** listing each issue with: row number, batch ID, current value, and a description of the problem. The user provides corrected values or marks the row to skip.
5. The corrected values are re-submitted alongside the original file. The server applies the corrections and saves the record.
