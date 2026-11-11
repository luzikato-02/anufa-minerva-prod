import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { PAGE_SIZE_OPTIONS } from '@/hooks/use-server-table';
import { cn } from '@/lib/utils';
import {
    type Column,
    type Header,
    type Table as TanstackTable,
    flexRender,
} from '@tanstack/react-table';
import {
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ChevronsUpDown,
    Columns3,
    SearchIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { DensityToggle } from './density-toggle';

const numberFormat = new Intl.NumberFormat('en-US');

function columnLabel<T>(column: Column<T, unknown>) {
    return column.columnDef.meta?.label ?? column.id;
}

function alignClass<T>(column: Column<T, unknown>) {
    return column.columnDef.meta?.align === 'right' ? 'text-right' : undefined;
}

function SortableHeader<T>({ header }: { header: Header<T, unknown> }) {
    const column = header.column;
    const content = flexRender(column.columnDef.header, header.getContext());

    if (!column.getCanSort()) {
        return content;
    }

    const sorted = column.getIsSorted();
    const Icon =
        sorted === 'asc'
            ? ArrowUp
            : sorted === 'desc'
              ? ArrowDown
              : ChevronsUpDown;

    return (
        <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className={cn(
                '-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                sorted && 'text-foreground',
                column.columnDef.meta?.align === 'right' && 'flex-row-reverse',
            )}
        >
            {content}
            <Icon
                className={cn('size-3', !sorted && 'opacity-40')}
                aria-hidden="true"
            />
        </button>
    );
}

export interface DataGridProps<T> {
    table: TanstackTable<T>;
    loading: boolean;
    error: string | null;
    /** Total rows on the server (for "1–50 of 412"). */
    total: number;
    onRetry?: () => void;
    search?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
    /** Filter controls shown after the search box. */
    filters?: ReactNode;
    /** Shown in the toolbar while rows are selected. */
    selectionActions?: ReactNode;
    /**
     * Rows selected across every page. The table only holds the current page,
     * so lists that keep selections while paging pass their own count.
     */
    selectedTotal?: number;
    /** Always-visible toolbar actions (export, etc.), before the Columns menu. */
    actions?: ReactNode;
    emptyMessage?: ReactNode;
    /** Accessible name for the table, e.g. "Twisting tension records". */
    label: string;
    className?: string;
    /**
     * Opens a record when its row is clicked (ignored on buttons, inputs and
     * checkboxes). Rows then also take focus: Enter or Space opens, ↑/↓ move.
     */
    onRowClick?: (rowId: string) => void;
    /** Row shown as open in a side panel. */
    activeRowId?: string | null;
}

const INTERACTIVE =
    'button, a, input, select, textarea, label, [role="checkbox"], [role="menuitem"], [data-slot="dropdown-menu-trigger"]';

/**
 * Dense, server-paginated table used by every review screen: a one-row
 * toolbar, a sticky header, sortable columns, loading/empty/error states and
 * a pagination footer with page size. Pair it with `useServerTable`.
 */
export function DataGrid<T>({
    table,
    loading,
    error,
    total,
    onRetry,
    search,
    onSearchChange,
    searchPlaceholder = 'Search…',
    filters,
    selectionActions,
    selectedTotal,
    actions,
    emptyMessage = 'No records match these filters.',
    label,
    className,
    onRowClick,
    activeRowId,
}: DataGridProps<T>) {
    const { pageIndex, pageSize } = table.getState().pagination;
    const rows = table.getRowModel().rows;
    const visibleColumnCount = table.getVisibleLeafColumns().length;
    const selectedCount =
        selectedTotal ?? table.getSelectedRowModel().rows.length;
    const pageCount = Math.max(table.getPageCount(), 1);
    const firstRow = total === 0 ? 0 : pageIndex * pageSize + 1;
    const lastRow = Math.min(total, (pageIndex + 1) * pageSize);
    const showSkeleton = loading && rows.length === 0 && !error;

    return (
        <div className={cn('flex min-w-0 flex-col gap-2', className)}>
            <div className="flex flex-wrap items-center gap-1.5">
                {onSearchChange && (
                    <label className="flex h-(--density-control-h) w-full items-center gap-1.5 rounded-md border bg-background px-2 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/50 sm:w-60">
                        <SearchIcon
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        <input
                            type="search"
                            value={search ?? ''}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder={searchPlaceholder}
                            aria-label={searchPlaceholder}
                            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                        />
                    </label>
                )}
                {filters}
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    {selectedCount > 0 && (
                        <>
                            <span className="text-xs font-medium tabular-nums">
                                {selectedCount} selected
                            </span>
                            {selectionActions}
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => table.resetRowSelection(true)}
                            >
                                Clear
                            </Button>
                        </>
                    )}
                    {actions}
                    <DensityToggle size="sm" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="xs">
                                <Columns3 />
                                Columns
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="text-xs">
                                Show columns
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {table
                                .getAllLeafColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                        onSelect={(e) => e.preventDefault()}
                                        className="text-xs"
                                    >
                                        {columnLabel(column)}
                                    </DropdownMenuCheckboxItem>
                                ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
                <Table
                    size="dense"
                    aria-label={label}
                    aria-busy={loading}
                    containerClassName="max-h-[max(24rem,calc(100svh-11rem))] overflow-y-auto"
                    className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted"
                >
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow
                                key={headerGroup.id}
                                className="hover:bg-transparent"
                            >
                                {headerGroup.headers.map((header) => {
                                    const sorted = header.column.getIsSorted();
                                    return (
                                        <TableHead
                                            key={header.id}
                                            aria-sort={
                                                sorted === 'asc'
                                                    ? 'ascending'
                                                    : sorted === 'desc'
                                                      ? 'descending'
                                                      : undefined
                                            }
                                            className={cn(
                                                alignClass(header.column),
                                                header.column.columnDef.meta
                                                    ?.className,
                                            )}
                                        >
                                            {header.isPlaceholder ? null : (
                                                <SortableHeader
                                                    header={header}
                                                />
                                            )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody
                        className={cn(
                            'transition-opacity',
                            loading && rows.length > 0 && 'opacity-60',
                        )}
                    >
                        {error ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell
                                    colSpan={visibleColumnCount}
                                    className="h-24! text-center"
                                >
                                    <div className="flex flex-col items-center gap-2 text-sm">
                                        <span>
                                            Couldn&apos;t load records ({error}
                                            ).
                                        </span>
                                        {onRetry && (
                                            <Button
                                                variant="outline"
                                                size="xs"
                                                onClick={onRetry}
                                            >
                                                Try again
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : showSkeleton ? (
                            Array.from(
                                { length: Math.min(pageSize, 12) },
                                (_, i) => (
                                    <TableRow
                                        key={`skeleton-${i}`}
                                        className="hover:bg-transparent"
                                    >
                                        {table
                                            .getVisibleLeafColumns()
                                            .map((column) => (
                                                <TableCell key={column.id}>
                                                    <Skeleton className="h-3 w-full max-w-24" />
                                                </TableCell>
                                            ))}
                                    </TableRow>
                                ),
                            )
                        ) : rows.length ? (
                            rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={
                                        row.getIsSelected()
                                            ? 'selected'
                                            : undefined
                                    }
                                    aria-current={
                                        activeRowId === row.id
                                            ? 'true'
                                            : undefined
                                    }
                                    onClick={
                                        onRowClick
                                            ? (event) => {
                                                  if (
                                                      (
                                                          event.target as HTMLElement
                                                      ).closest(INTERACTIVE) ||
                                                      window
                                                          .getSelection()
                                                          ?.toString()
                                                  )
                                                      return;
                                                  onRowClick(row.id);
                                              }
                                            : undefined
                                    }
                                    tabIndex={onRowClick ? 0 : undefined}
                                    onKeyDown={
                                        onRowClick
                                            ? (event) => {
                                                  if (
                                                      event.target !==
                                                      event.currentTarget
                                                  )
                                                      return;
                                                  if (
                                                      event.key === 'Enter' ||
                                                      event.key === ' '
                                                  ) {
                                                      event.preventDefault();
                                                      onRowClick(row.id);
                                                  } else if (
                                                      event.key ===
                                                          'ArrowDown' ||
                                                      event.key === 'ArrowUp'
                                                  ) {
                                                      event.preventDefault();
                                                      const next =
                                                          event.key ===
                                                          'ArrowDown'
                                                              ? event
                                                                    .currentTarget
                                                                    .nextElementSibling
                                                              : event
                                                                    .currentTarget
                                                                    .previousElementSibling;
                                                      (
                                                          next as HTMLElement | null
                                                      )?.focus();
                                                  }
                                              }
                                            : undefined
                                    }
                                    className={cn(
                                        onRowClick &&
                                            'cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                                        activeRowId === row.id &&
                                            'bg-muted font-medium hover:bg-muted',
                                    )}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn(
                                                alignClass(cell.column),
                                                cell.column.columnDef.meta
                                                    ?.className,
                                            )}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow className="hover:bg-transparent">
                                <TableCell
                                    colSpan={visibleColumnCount}
                                    className="h-28! text-center text-sm"
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <span>
                                            {search?.trim() ? (
                                                <>
                                                    No records match &ldquo;
                                                    {search.trim()}&rdquo;.
                                                </>
                                            ) : (
                                                emptyMessage
                                            )}
                                        </span>
                                        {search?.trim() && onSearchChange && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="xs"
                                                    onClick={() =>
                                                        onSearchChange('')
                                                    }
                                                >
                                                    Clear search
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                    {showSkeleton
                        ? 'Loading records…'
                        : total === 0
                          ? 'No records'
                          : `Showing ${numberFormat.format(firstRow)}–${numberFormat.format(lastRow)} of ${numberFormat.format(total)}`}
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5">
                        Rows
                        <Select
                            value={String(pageSize)}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value));
                                table.setPageIndex(0);
                            }}
                        >
                            <SelectTrigger
                                aria-label="Rows per page"
                                className="h-7! w-18 px-2 text-xs"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PAGE_SIZE_OPTIONS.map((size) => (
                                    <SelectItem
                                        key={size}
                                        value={String(size)}
                                        className="text-xs"
                                    >
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                    <span className="tabular-nums">
                        Page {pageIndex + 1} of {pageCount}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon-xs"
                            aria-label="First page"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <ChevronsLeft />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-xs"
                            aria-label="Previous page"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <ChevronLeft />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-xs"
                            aria-label="Next page"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <ChevronRight />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-xs"
                            aria-label="Last page"
                            onClick={() => table.setPageIndex(pageCount - 1)}
                            disabled={!table.getCanNextPage()}
                        >
                            <ChevronsRight />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
