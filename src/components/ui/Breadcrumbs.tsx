import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  separator?: React.ReactNode;
  className?: string;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  showHome = true,
  separator,
  className = '',
}) => {
  const allItems = showHome
    ? [{ label: 'Home', href: '/', icon: <Home size={16} /> }, ...items]
    : items;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center flex-wrap gap-2 text-sm">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;

          return (
            <li key={index} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 text-gray-600 hover:text-vh-red transition-colors font-medium"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={`flex items-center gap-1.5 ${
                    isLast ? 'text-gray-900 font-semibold' : 'text-gray-600'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}
              {!isLast && (
                <span className="text-gray-400" aria-hidden="true">
                  {separator || <ChevronRight size={16} />}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
