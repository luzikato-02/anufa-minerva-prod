import '@tanstack/react-table';

declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData> {
        refetch?: () => void;
        allRoles?: { id: number; name: string }[];
        currentUserId?: number;
        /** Users table: the AI models on offer, for the AI Models dialog (admins only). */
        aiCatalog?: { models: string[]; systemDefault: string | null } | null;
        onStatusChange?: (id: string, status: string) => void;
        /** Opens a record in the side panel (row menu, keyboard users). */
        openDetails?: (id: string) => void;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData, TValue> {
        /** Human label for the Columns menu (defaults to the column id). */
        label?: string;
        /** Right-align numeric columns, header included. */
        align?: 'left' | 'right';
        /** Extra classes for this column's header and cells. */
        className?: string;
    }
}
