import type { ReactNode } from 'react';

export interface ASHADataTableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
}

export interface ASHADataTableProps<T> {
  columns: ASHADataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  className?: string;
}

export function ASHADataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'No data available',
  className
}: ASHADataTableProps<T>) {
  return (
    <div
      className={[
        'overflow-x-auto rounded-xl border border-outlineVariant/40 bg-white shadow-sm',
        className ?? ''
      ].join(' ')}
    >
      <table className="min-w-full divide-y divide-outlineVariant/40 text-left">
        <thead>
          <tr className="bg-surfaceContainerLow">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className="px-4 py-3 text-[14px] font-semibold leading-5 tracking-wide text-onSurfaceVariant"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outlineVariant/40">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-[16px] leading-6 text-onSurfaceVariant"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="transition-colors hover:bg-surfaceContainerLow"
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className="px-4 py-3 text-[16px] leading-6 text-onSurface"
                  >
                    {column.render
                      ? column.render(row)
                      : (row[column.key as keyof T] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
