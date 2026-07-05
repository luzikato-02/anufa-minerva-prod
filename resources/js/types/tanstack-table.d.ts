import '@tanstack/react-table';

declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData> {
        refetch?: () => void;
        allRoles?: { id: number; name: string }[];
        currentUserId?: number;
        onStatusChange?: (id: string, status: string) => void;
    }
}
