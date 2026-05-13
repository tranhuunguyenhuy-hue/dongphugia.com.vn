import { Box, CheckCircle2, PackageOpen } from 'lucide-react';

interface ProductBoxIncludesProps {
  items: string[];
}

export function ProductBoxIncludes({ items }: ProductBoxIncludesProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-8 mb-6">
      {/* Premium Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#2E7A96]/10 text-[#2E7A96]">
          <PackageOpen className="w-4 h-4" />
        </div>
        <h3 className="text-[17px] font-bold text-stone-900 tracking-tight">Nguyên hộp bao gồm</h3>
      </div>

      {/* Items Grid Layout */}
      <div className="bg-gradient-to-br from-stone-50 to-white rounded-2xl p-5 md:p-6 border border-stone-200/60 shadow-sm relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute -right-4 -top-4 text-stone-100/50 rotate-12 pointer-events-none">
          <Box className="w-24 h-24" />
        </div>
        
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 relative z-10">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-3 group">
              <CheckCircle2 className="w-4 h-4 text-[#2E7A96] mt-0.5 flex-shrink-0 transition-transform group-hover:scale-110" />
              <span className="text-[14px] text-stone-700 font-medium leading-relaxed group-hover:text-stone-900 transition-colors">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
