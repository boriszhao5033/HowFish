import { ChevronDown } from 'lucide-react';

import { useData } from '../../context/DataContext';
import { useAppStore } from '../../store/useAppStore';
import { getRegionFlag } from '../../types/schema';

export function RegionSelector() {
  const { data } = useData();
  const selectedRegion = useAppStore((state) => state.selectedRegion);
  const setSelectedRegion = useAppStore((state) => state.setSelectedRegion);

  const regions = data
    ? Object.entries(data.regions.regions).filter(([, config]) => config.enabled)
    : [];

  return (
    <div className="relative inline-flex shrink-0 items-center">
      <select
        aria-label="选择市场地区"
        value={selectedRegion}
        onChange={(event) => setSelectedRegion(event.target.value)}
        className="h-9 max-w-[7.5rem] cursor-pointer appearance-none rounded-full border border-[#E2EBF0] bg-white/80 py-0 pl-3 pr-7 text-xs font-medium text-[#0B4F71] outline-none transition-colors hover:border-[#0B4F71]/30 focus:border-[#0B4F71]/40 focus:ring-4 focus:ring-[#0B4F71]/10 dark:border-[#1E354A] dark:bg-[#102030]/80 dark:text-[#38BDF8] dark:hover:border-[#38BDF8]/40 dark:focus:ring-[#38BDF8]/10"
      >
        <option value="global">{`${getRegionFlag('global')} 全球`}</option>
        {regions.map(([key, config]) => (
          <option key={key} value={key}>
            {`${getRegionFlag(key)} ${config.label}`}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[#52667A] dark:text-[#94A3B8]"
      />
    </div>
  );
}