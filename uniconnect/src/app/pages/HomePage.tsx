import React, { useEffect, useState, useMemo } from 'react';
import { Search, ArrowUpDown, TrendingUp, Clock3, MessagesSquare, Layers3 } from 'lucide-react';
import { Sidebar } from '../components/Sidebar.tsx';
import { TopicCard } from '../components/TopicCard.tsx';
import { Category } from '../types';
import { mainCategories, MainCategoryKey, categoryLabels, categoryNameToSlug } from '../utils/helpers.ts';
import { useApp } from '../context/AppContext.tsx';

type SortOption = 'recent' | 'active' | 'upvoted';
type RoleFilter = 'all' | 'student' | 'faculty' | 'admin';
type StatusFilter = 'all' | 'active' | 'inactive';
type DateFilter = 'all' | '7d' | '30d' | '90d';

export const HomePage: React.FC = () => {
  const { currentUser } = useApp();

  const [topics, setTopics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<MainCategoryKey | 'all'>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  useEffect(() => {
    setIsLoading(true);
    setLoadError('');

    const params = new URLSearchParams();

    if (currentUser?.id) {
      params.set('user_id', currentUser.id);
    }
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (roleFilter !== 'all') params.set('role', roleFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (dateFilter !== 'all') params.set('date_range', dateFilter);

    const query = params.toString();
    const url = query
      ? `https://uniconnectforum.onrender.com/api/topics/?${query}`
      : 'https://uniconnectforum.onrender.com/api/topics/';

    fetch(url)
      .then(res => res.json())
      .then(data => {
        const mapped = data.map((t: any) => ({
          id: String(t.TOPIC_ID),
          title: t.TITLE,
          content: t.DESCRIPTION,
          imageUrl: t.COVER_IMAGE_PATH
            ? (String(t.COVER_IMAGE_PATH).startsWith('http')
                ? t.COVER_IMAGE_PATH
                : `https://uniconnectforum.onrender.com${t.COVER_IMAGE_PATH}`)
            : undefined,
          category: categoryNameToSlug[t.CATEGORY_NAME] || 'campus-events-general',
          authorId: String(t.CREATED_BY),
          authorName: `${t.FIRST_NAME} ${t.LAST_NAME}`,
          authorRole: t.ROLE,
          createdAt: new Date(t.CREATED_AT),
          upvotes: Number(t.TOPIC_UPVOTES || 0),
          replyCount: t.REPLY_COUNT || 0,
          isActive: String(t.STATUS || 'approved').toLowerCase() !== 'inactive',
          upvotedBy: Number(t.HAS_UPVOTED) === 1 && currentUser?.id ? [currentUser.id] : [],
          followers: []
        }));

        setTopics(mapped);
        setIsLoading(false);
      })
      .catch(error => {
        console.error(error);
        setTopics([]);
        setLoadError('Could not load topics right now.');
        setIsLoading(false);
      });
  }, [currentUser, searchQuery, roleFilter, statusFilter, dateFilter]);

  const handleMainCategoryChange = (mainCat: MainCategoryKey | 'all') => {
    setSelectedMainCategory(mainCat);
    setSelectedSubCategory('all');
  };

  const handleTopicUpvote = async (topicId: string) => {
    if (!currentUser) return;

    const previousTopics = topics;

    setTopics(prevTopics =>
      prevTopics.map(topic => {
        if (topic.id !== topicId) {
          return topic;
        }

        const hasUpvoted = topic.upvotedBy.includes(currentUser.id);

        return {
          ...topic,
          upvotes: hasUpvoted ? topic.upvotes - 1 : topic.upvotes + 1,
          upvotedBy: hasUpvoted
            ? topic.upvotedBy.filter((id: string) => id !== currentUser.id)
            : [...topic.upvotedBy, currentUser.id]
        };
      })
    );

    try {
      const res = await fetch('https://uniconnectforum.onrender.com/api/upvote-topic/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic_id: topicId,
          user_id: currentUser.id
        })
      });

      const data = await res.json();

      if (!data.success) {
        setTopics(previousTopics);
      }
    } catch (error) {
      console.error(error);
      setTopics(previousTopics);
    }
  };

  const filteredAndSortedTopics = useMemo(() => {
    let filtered = topics;

    if (selectedSubCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedSubCategory);
    } else if (selectedMainCategory !== 'all') {
      const subcats = mainCategories[selectedMainCategory].subcategories;
      filtered = filtered.filter(t => subcats.includes(t.category));
    }

    return [...filtered].sort((a, b) => {
      const aPriority =
        (currentUser?.followedTopics?.includes(a.id) ? 2 : 0) +
        (currentUser && a.upvotedBy.includes(currentUser.id) ? 1 : 0);
      const bPriority =
        (currentUser?.followedTopics?.includes(b.id) ? 2 : 0) +
        (currentUser && b.upvotedBy.includes(currentUser.id) ? 1 : 0);

      if (bPriority !== aPriority) {
        return bPriority - aPriority;
      }

      switch (sortBy) {
        case 'recent':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'active':
          return b.replyCount - a.replyCount;
        case 'upvoted':
          return b.upvotes - a.upvotes;
        default:
          return 0;
      }
    });
  }, [
    topics,
    selectedMainCategory,
    selectedSubCategory,
    sortBy,
    currentUser
  ]);

  const heroStats = [
    currentUser?.role === 'student'
      ? { label: 'Topics Available', value: topics.length, icon: Layers3 }
      : currentUser?.role === 'faculty'
      ? { label: 'Faculty-Led Topics', value: topics.filter(topic => topic.authorRole === 'faculty' || topic.authorRole === 'admin').length, icon: Layers3 }
      : { label: 'Topics Under Oversight', value: topics.length, icon: Layers3 },
    currentUser?.role === 'student'
      ? { label: 'Active Discussions', value: topics.filter(topic => topic.isActive).length, icon: MessagesSquare }
      : currentUser?.role === 'faculty'
      ? { label: 'Student Questions', value: topics.filter(topic => topic.authorRole === 'student').length, icon: MessagesSquare }
      : { label: 'Flagged / Inactive', value: topics.filter(topic => !topic.isActive).length, icon: MessagesSquare },
    currentUser?.role === 'student'
      ? { label: 'Most Upvoted Topic', value: topics.reduce((max, topic) => Math.max(max, topic.upvotes), 0), icon: TrendingUp }
      : currentUser?.role === 'faculty'
      ? { label: 'Most Replied Thread', value: topics.reduce((max, topic) => Math.max(max, topic.replyCount), 0), icon: TrendingUp }
      : { label: 'Approval Queue', value: topics.filter(topic => !topic.isActive).length, icon: TrendingUp }
  ];

  const roleSummary = currentUser?.role === 'student'
    ? {
        heading: 'Your student overview',
        body: 'Track active campus discussions, follow helpful threads, and stay current on opportunities and updates relevant to your interests.',
      }
    : currentUser?.role === 'faculty'
    ? {
        heading: 'Your faculty overview',
        body: 'Monitor student-led discussion volume, surface the most active threads, and step into conversations where guidance or clarification helps.',
      }
    : {
        heading: 'Your admin overview',
        body: 'Review platform health at a glance, monitor discussion activity, and move quickly between moderation, approvals, and oversight tasks.',
      };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-0 pb-10 pt-6 xl:flex-row xl:gap-8 xl:pt-8 xl:px-2">
      <Sidebar
        selectedCategory={selectedSubCategory}
        onCategorySelect={setSelectedSubCategory}
        selectedMainCategory={selectedMainCategory}
        onMainCategorySelect={handleMainCategoryChange}
      />

      <main className="min-w-0 flex-1 px-4 sm:px-6 xl:px-0">
        <section className="university-panel mb-6 overflow-hidden xl:hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Browse Topics</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Mobile category filters</h2>
          </div>
          <div className="space-y-4 p-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => {
                  setSelectedMainCategory('all');
                  setSelectedSubCategory('all');
                }}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  selectedMainCategory === 'all' && selectedSubCategory === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                All
              </button>
              {Object.entries(mainCategories).map(([key, data]) => (
                <button
                  key={key}
                  onClick={() => handleMainCategoryChange(key as MainCategoryKey)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selectedMainCategory === key && selectedSubCategory === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {data.label}
                </button>
              ))}
            </div>

            {(selectedMainCategory !== 'all' || selectedSubCategory !== 'all') && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedSubCategory('all')}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    selectedSubCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  All in section
                </button>
                {(selectedMainCategory === 'all'
                  ? Object.values(mainCategories).flatMap((categoryGroup) => categoryGroup.subcategories)
                  : mainCategories[selectedMainCategory].subcategories
                ).map((subcat) => (
                  <button
                    key={subcat}
                    onClick={() => setSelectedSubCategory(subcat)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      selectedSubCategory === subcat
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {categoryLabels[subcat]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="university-panel overflow-hidden">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.8fr_1fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">UniConnect</p>
              <h1 className="mt-3 university-section-title max-w-3xl">
                Trusted campus discussions for academics, opportunities, research, and official updates.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Browse university conversations in a structured feed designed for informed student participation, faculty insight, and administrative clarity.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{roleSummary.heading}</p>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">{currentUser?.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Signed in as <span className="font-semibold capitalize text-slate-900">{currentUser?.role}</span>. {roleSummary.body}
              </p>
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-200 bg-slate-50/70 px-6 py-5 sm:grid-cols-3 lg:px-8">
            {heroStats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="university-panel mt-8 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Discussion Feed</h2>
              <p className="mt-1 university-subtitle">Search, review, and sort university-wide conversations.</p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search topics, announcements, or keywords"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="relative">
                <ArrowUpDown className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="recent">Newest First</option>
                  <option value="active">Most Active</option>
                  <option value="upvoted">Most Upvoted</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admins</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All Topic States</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All Dates</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {isLoading ? (
            <div className="university-panel p-12 text-center text-slate-500">
              <Clock3 size={28} className="mx-auto mb-3 text-slate-400" />
              Loading university discussions...
            </div>
          ) : loadError ? (
            <div className="university-panel p-12 text-center text-red-600">{loadError}</div>
          ) : filteredAndSortedTopics.length > 0 ? (
            filteredAndSortedTopics.map(topic => (
              <TopicCard key={topic.id} topic={topic} onUpvote={handleTopicUpvote} />
            ))
          ) : (
            <div className="university-panel p-12 text-center text-slate-600">
              No discussions matched your current search or category filters.
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
