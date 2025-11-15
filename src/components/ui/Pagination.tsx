import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  showFirstLast?: boolean;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  showFirstLast = true,
  className = '',
}) => {
  const range = (start: number, end: number) => {
    const length = end - start + 1;
    return Array.from({ length }, (_, i) => start + i);
  };

  const paginationRange = () => {
    const totalPageNumbers = siblingCount * 2 + 3;

    if (totalPages <= totalPageNumbers) {
      return range(1, totalPages);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftRange = range(1, 3 + 2 * siblingCount);
      return [...leftRange, 'dots', totalPages];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightRange = range(totalPages - (2 + 2 * siblingCount), totalPages);
      return [1, 'dots', ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = range(leftSiblingIndex, rightSiblingIndex);
      return [1, 'dots', ...middleRange, 'dots', totalPages];
    }

    return range(1, totalPages);
  };

  const pages = paginationRange();

  const PageButton: React.FC<{
    page: number | string;
    isActive?: boolean;
    onClick?: () => void;
  }> = ({ page, isActive, onClick }) => {
    if (page === 'dots') {
      return (
        <span className="px-3 py-2 text-gray-400" aria-hidden="true">
          ...
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={onClick}
        className={`min-w-[40px] px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-vh-red/30 ${
          isActive
            ? 'bg-vh-red text-white shadow-sm'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        aria-label={`Go to page ${page}`}
        aria-current={isActive ? 'page' : undefined}
      >
        {page}
      </button>
    );
  };

  const NavButton: React.FC<{
    onClick: () => void;
    disabled: boolean;
    children: React.ReactNode;
    'aria-label': string;
  }> = ({ onClick, disabled, children, 'aria-label': ariaLabel }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-vh-red/30"
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );

  return (
    <nav
      className={`flex items-center justify-center gap-1 ${className}`}
      aria-label="Pagination"
    >
      {showFirstLast && (
        <NavButton
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="Go to first page"
        >
          <ChevronsLeft size={18} />
        </NavButton>
      )}

      <NavButton
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Go to previous page"
      >
        <ChevronLeft size={18} />
      </NavButton>

      <div className="flex items-center gap-1">
        {pages.map((page, index) => (
          <PageButton
            key={index}
            page={page}
            isActive={page === currentPage}
            onClick={() => typeof page === 'number' && onPageChange(page)}
          />
        ))}
      </div>

      <NavButton
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Go to next page"
      >
        <ChevronRight size={18} />
      </NavButton>

      {showFirstLast && (
        <NavButton
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Go to last page"
        >
          <ChevronsRight size={18} />
        </NavButton>
      )}
    </nav>
  );
};

export default Pagination;
