import React, { useState } from 'react';
import { Home, Calendar, Briefcase, BookOpen, Megaphone, Microscope, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { Category } from '../types';
import { categoryLabels, mainCategories, MainCategoryKey } from '../utils/helpers.ts';

interface SidebarProps {
  selectedCategory: Category | 'all';
  onCategorySelect: (category: Category | 'all') => void;
  selectedMainCategory: MainCategoryKey | 'all';
  onMainCategorySelect: (category: MainCategoryKey | 'all') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onCategorySelect,
  selectedMainCategory,
  onMainCategorySelect
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<MainCategoryKey>>(new Set(['campus-events', 'academics']));

  const toggleCategory = (key: MainCategoryKey) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCategories(newExpanded);
  };

  const handleMainCategoryClick = (key: MainCategoryKey) => {
    toggleCategory(key);
    onMainCategorySelect(key);
  };

  const mainCategoryIcons: Record<MainCategoryKey, React.ReactNode> = {
    'campus-events': <Calendar size={18} />,
    'jobs-internships': <Briefcase size={18} />,
    'academics': <BookOpen size={18} />,
    'announcements': <Megaphone size={18} />,
    'research': <Microscope size={18} />
  };

  return (
    <aside className="hidden xl:block xl:w-80 xl:flex-shrink-0">
      <div className="sticky top-[5.5rem] px-6 pb-8">
        <div className="max-h-[calc(100vh-7rem)] space-y-5 overflow-y-auto pr-2">
        <div className="university-panel overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Navigation</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Explore Campus Topics</h2>
          </div>
          <div className="p-4">
            <nav className="space-y-2">
              <button
                onClick={() => {
                  onCategorySelect('all');
                  onMainCategorySelect('all');
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  selectedCategory === 'all' && selectedMainCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Home size={18} />
                <span>All Discussions</span>
              </button>

              {Object.entries(mainCategories).map(([key, data]) => {
                const mainKey = key as MainCategoryKey;
                const isExpanded = expandedCategories.has(mainKey);
                const isMainSelected = selectedMainCategory === mainKey && selectedCategory === 'all';

                return (
                  <div key={mainKey} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-1.5">
                    <button
                      onClick={() => handleMainCategoryClick(mainKey)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                        isMainSelected
                          ? 'bg-white text-blue-800 shadow-sm ring-1 ring-blue-100'
                          : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      <span className={isMainSelected ? 'text-blue-700' : 'text-slate-500'}>{mainCategoryIcons[mainKey]}</span>
                      <span className="flex-1 text-left">{data.label}</span>
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>

                    {isExpanded && (
                      <div className="mt-1 space-y-1 px-2 pb-2">
                        {data.subcategories.map((subcat) => (
                          <button
                            key={subcat}
                            onClick={() => onCategorySelect(subcat)}
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                              selectedCategory === subcat
                                ? 'bg-blue-50 text-blue-800'
                                : 'text-slate-600 hover:bg-white'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                            <span>{categoryLabels[subcat]}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="university-panel p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Community Standards</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use professional language, share credible information, and keep discussions tied to university life and academic priorities.
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </aside>
  );
};
