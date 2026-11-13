interface Props {
  tabs: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ tabs, value, onChange }: Props) {
  return (
    <div className="flex gap-6 overflow-x-auto border-b border-[#deded9]" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={`shrink-0 border-b-2 py-3 text-sm font-semibold ${value === tab.value ? "border-ink text-ink" : "border-transparent text-muted"}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
