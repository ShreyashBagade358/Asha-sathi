import { useMemo, useState, type ReactNode } from 'react'
import { ASHAButton, StatusChip, type StatusChipVariant } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { EmptyState } from '@/components/common/EmptyState'
import { Icon } from '@/components/common/Icons'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  align?: 'left' | 'right'
  accessor?: (row: T) => string | number
  render?: (row: T) => ReactNode
}

export interface TablePagination {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  pagination?: TablePagination
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  keyExtractor: (row: T) => string
  statusFor?: (row: T) => { status: StatusChipVariant; label: string }
}

function cellValue<T>(row: T, col: Column<T>): string | number {
  if (col.accessor) return col.accessor(row)
  const value = (row as Record<string, unknown>)[col.key]
  if (value === null || value === undefined) return ''
  return typeof value === 'object' ? '' : String(value)
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  pagination = {} as TablePagination,
  onSort,
  keyExtractor,
  statusFor,
}: DataTableProps<T>) {
  const { t } = useLocalization()
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return
    const dir = sort?.key === col.key ? (sort.dir === 'asc' ? 'desc' : 'asc') : 'asc'
    setSort({ key: col.key, dir })
    onSort?.(col.key, dir)
  }

  const rows = useMemo(() => {
    if (sort && !onSort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col) {
        return [...data].sort((a, b) => {
          const av = cellValue(a, col)
          const bv = cellValue(b, col)
          const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
          return sort.dir === 'asc' ? cmp : -cmp
        })
      }
    }
    return data
  }, [data, columns, sort, onSort])

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1
  const hasPagination = Boolean(pagination) && pagination.total > pagination.pageSize

  return (
    <div className="card-surface overflow-hidden">
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-low">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3 text-label-md uppercase tracking-wide text-on-surface-variant ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  <button
                    type="button"
                    disabled={!col.sortable}
                    onClick={() => handleSort(col)}
                    className={`inline-flex items-center gap-1 ${col.sortable ? 'cursor-pointer hover:text-on-surface' : 'cursor-default'}`}
                  >
                    {col.header}
                    {col.sortable ? (
                      <Icon
                        name={sort?.key === col.key ? (sort.dir === 'asc' ? 'chevronDown' : 'chevronUp') : 'chevronDown'}
                        size={14}
                        className={`${sort?.key === col.key ? 'text-primary' : 'text-outline'}`}
                      />
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
            {rows.map((row) => {
              const chip = statusFor?.(row)
              return (
                <tr key={keyExtractor(row)} className="transition-colors hover:bg-surface-container-low">
                  {columns.map((col) => (
                    <td key={col.key} className={`whitespace-nowrap px-4 py-3 text-body-md ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {col.render ? (
                        col.render(row)
                      ) : chip && col.key === 'status' ? (
                        <StatusChip status={chip.status} label={chip.label} />
                      ) : (
                        cellValue(row, col)
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-container-lowest/70">
            <LoadingSpinner />
          </div>
        ) : null}
        {!loading && rows.length === 0 ? (
          <EmptyState title={t('common.noData')} icon={<Icon name="fileText" size={28} />} />
        ) : null}
      </div>

      {hasPagination && pagination ? (
        <div className="flex items-center justify-between gap-4 border-t border-outline-variant px-4 py-3">
          <p className="text-body-md text-on-surface-variant">
            {t('common.page')} {pagination.page} {t('common.of')} {totalPages} · {pagination.total} {t('common.rows')}
          </p>
          <div className="flex gap-2">
            <ASHAButton
              variant="outline"
              fullWidth={false}
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              icon={<Icon name="chevronLeft" size={16} />}
              label={t('common.previous')}
            />
            <ASHAButton
              variant="outline"
              fullWidth={false}
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              icon={<Icon name="chevronRight" size={16} />}
              label={t('common.next')}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
