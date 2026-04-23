'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SpecFilterDef {
  key: string;           // e.g. "Kiểu thoát"
  label: string;         // e.g. "Kiểu thoát"
  type: string;          // e.g. "checkbox"
  values: string[];      // e.g. ["Thoát sàn", "Thoát ngang"]
}

interface SubcategorySpecFilterProps {
  filters: SpecFilterDef[];
}

// ─── URL helpers ─────────────────────────────────────────────────────────────

/** 
 * spec_filters are stored in URL as: ?sf_Kiểu+thoát=Thoát+sàn 
 * Key prefix: "sf_" (spec filter)
 */
const SF_PREFIX = 'sf_';

function getActiveValues(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.get(SF_PREFIX + key) || '';
  return raw ? raw.split(',').filter(Boolean) : [];
}

function countAllActive(searchParams: URLSearchParams, filters: SpecFilterDef[]): number {
  return filters.reduce((acc, f) => acc + getActiveValues(searchParams, f.key).length, 0);
}

// ─── Single spec filter pill group ──────────────────────────────────────────

function SpecFilterGroup({
  filter,
  onToggle,
}: {
  filter: SpecFilterDef;
  onToggle: (key: string, value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const searchParams = useSearchParams();
  const activeValues = getActiveValues(searchParams, filter.key);

  return (
    <div className="border-b border-neutral-100 last:border-0 py-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-neutral-800 group-hover:text-neutral-900">
            {filter.label}
          </span>
          {activeValues.length > 0 && (
            <span className="flex items-center justify-center bg-[#2E7A96] text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-lg leading-none">
              {activeValues.length}
            </span>
          )}
        </div>
        {isOpen
          ? <ChevronUp className="h-3.5 w-3.5 text-neutral-400 shrink-0" strokeWidth={2} />
          : <ChevronDown className="h-3.5 w-3.5 text-neutral-400 shrink-0" strokeWidth={2} />
        }
      </button>

      {isOpen && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {filter.values.map(val => {
            const isActive = activeValues.includes(val);
            return (
              <button
                key={val}
                onClick={() => onToggle(filter.key, val)}
                className={`
                  px-2.5 py-1 rounded-md text-[12.5px] font-medium transition-all duration-150 border
                  ${isActive
                    ? 'bg-[#2E7A96] text-white border-[#2E7A96] shadow-sm'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-[#2E7A96]/40 hover:text-[#2E7A96] hover:bg-[#2E7A96]/5'
                  }
                `}
              >
                {val}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main SubcategorySpecFilter component ───────────────────────────────────

export function SubcategorySpecFilter({ filters }: SubcategorySpecFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCount = countAllActive(searchParams, filters);

  const handleToggle = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const urlKey = SF_PREFIX + key;
    const current = (params.get(urlKey) || '').split(',').filter(Boolean);

    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];

    if (updated.length > 0) {
      params.set(urlKey, updated.join(','));
    } else {
      params.delete(urlKey);
    }
    params.delete('page');

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    filters.forEach(f => params.delete(SF_PREFIX + f.key));
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams, filters]);

  if (!filters || filters.length === 0) return null;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-neutral-500" strokeWidth={1.5} />
          <span className="text-[13px] font-semibold text-neutral-700 uppercase tracking-wider">
            Lọc nâng cao
          </span>
          {activeCount > 0 && (
            <span className="flex items-center justify-center bg-[#2E7A96] text-white text-[11px] font-bold h-5 min-w-5 px-1.5 rounded-lg">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-[12px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            <X className="h-3 w-3" strokeWidth={2} />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      {/* Filter groups */}
      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 px-4">
        {filters.map(f => (
          <SpecFilterGroup
            key={f.key}
            filter={f}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Active spec filter chips (for inline display above product grid) ─────────

export function ActiveSpecFilterChips({
  filters,
}: {
  filters: SpecFilterDef[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active: { key: string; label: string; value: string }[] = [];
  filters.forEach(f => {
    getActiveValues(searchParams, f.key).forEach(v => {
      active.push({ key: f.key, label: f.label, value: v });
    });
  });

  const removeOne = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const urlKey = SF_PREFIX + key;
    const current = (params.get(urlKey) || '').split(',').filter(Boolean);
    const updated = current.filter(v => v !== value);
    if (updated.length > 0) params.set(urlKey, updated.join(','));
    else params.delete(urlKey);
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map(({ key, label, value }) => (
        <button
          key={`${key}:${value}`}
          onClick={() => removeOne(key, value)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium 
                     bg-[#2E7A96]/10 text-[#2E7A96] border border-[#2E7A96]/20 hover:bg-[#2E7A96]/20 transition-colors"
        >
          <span className="text-[#2E7A96]/60 text-[11px]">{label}:</span>
          {value}
          <X className="h-3 w-3 opacity-60" strokeWidth={2.5} />
        </button>
      ))}
    </div>
  );
}
