import { Link } from 'react-router-dom'
import { Icon } from '@/components/common/Icons'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-label-md text-on-surface-variant">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <Icon name="chevronRight" size={14} className="text-outline" /> : null}
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-primary">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-semibold text-on-surface' : ''}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
