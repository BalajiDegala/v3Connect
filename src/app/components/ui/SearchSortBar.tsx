import { useState } from 'react';
import { Input } from './input';
import { Button } from './button';
import { 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Filter,
  X
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

export interface SortOption {
  label: string;
  value: string;
}

export interface FilterOption {
  label: string;
  value: string;
  options: { label: string; value: string }[];
}

interface SearchSortBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortOptions?: SortOption[];
  sortValue?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (value: string, direction: 'asc' | 'desc') => void;
  filters?: FilterOption[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  className?: string;
}

export function SearchSortBar({
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  sortOptions = [],
  sortValue = '',
  sortDirection = 'desc',
  onSortChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  className = '',
}: SearchSortBarProps) {
  const [localSortDir, setLocalSortDir] = useState<'asc' | 'desc'>(sortDirection);

  const handleSortSelect = (value: string) => {
    if (onSortChange) {
      onSortChange(value, localSortDir);
    }
  };

  const toggleSortDirection = () => {
    const newDir = localSortDir === 'asc' ? 'desc' : 'asc';
    setLocalSortDir(newDir);
    if (onSortChange && sortValue) {
      onSortChange(sortValue, newDir);
    }
  };

  const clearSearch = () => {
    onSearchChange('');
  };

  const activeFiltersCount = Object.values(filterValues).filter(v => v && v !== 'all').length;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-8"
        />
        {searchValue && (
          <button
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filters */}
      {filters.length > 0 && onFilterChange && (
        <div className="flex items-center gap-2">
          {filters.map((filter) => (
            <Select
              key={filter.value}
              value={filterValues[filter.value] || 'all'}
              onValueChange={(value) => onFilterChange(filter.value, value)}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filter.label}</SelectItem>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                filters.forEach(f => onFilterChange(f.value, 'all'));
              }}
              className="h-9 px-2 text-muted-foreground"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Sort */}
      {sortOptions.length > 0 && onSortChange && (
        <div className="flex items-center gap-1">
          <Select value={sortValue} onValueChange={handleSortSelect}>
            <SelectTrigger className="w-[140px] h-9">
              <ArrowUpDown className="w-3 h-3 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={toggleSortDirection}
            title={localSortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {localSortDir === 'asc' ? (
              <ArrowUp className="w-4 h-4" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// Utility function to apply search, filter, and sort to an array
export function applySearchSortFilter<T>(
  data: T[],
  searchValue: string,
  searchFields: (keyof T | ((item: T) => string))[],
  sortField?: keyof T | ((item: T) => any),
  sortDirection: 'asc' | 'desc' = 'desc',
  filters?: Record<string, { field: keyof T | ((item: T) => string); value: string }>
): T[] {
  let result = [...data];

  // Apply search
  if (searchValue.trim()) {
    const searchLower = searchValue.toLowerCase();
    result = result.filter((item) =>
      searchFields.some((field) => {
        const value = typeof field === 'function' ? field(item) : item[field];
        return String(value || '').toLowerCase().includes(searchLower);
      })
    );
  }

  // Apply filters
  if (filters) {
    Object.entries(filters).forEach(([key, config]) => {
      if (config.value && config.value !== 'all') {
        result = result.filter((item) => {
          const fieldValue = typeof config.field === 'function' 
            ? config.field(item) 
            : item[config.field];
          return String(fieldValue).toLowerCase() === config.value.toLowerCase();
        });
      }
    });
  }

  // Apply sort
  if (sortField) {
    result.sort((a, b) => {
      const aVal = typeof sortField === 'function' ? sortField(a) : a[sortField];
      const bVal = typeof sortField === 'function' ? sortField(b) : b[sortField];
      
      // Handle dates
      if (aVal instanceof Date || (typeof aVal === 'string' && !isNaN(Date.parse(aVal)))) {
        const dateA = new Date(aVal).getTime();
        const dateB = new Date(bVal as any).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // Handle numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Handle strings
      const strA = String(aVal || '').toLowerCase();
      const strB = String(bVal || '').toLowerCase();
      if (sortDirection === 'asc') {
        return strA.localeCompare(strB);
      }
      return strB.localeCompare(strA);
    });
  }

  return result;
}
