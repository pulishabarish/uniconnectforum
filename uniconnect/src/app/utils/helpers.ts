import { Category } from '../types';

export const categoryLabels: Record<Category, string> = {
  'campus-events-general': 'General Events',
  'campus-events-sports': 'Sports & Athletics',
  'campus-events-cultural': 'Cultural Events',
  'campus-events-workshops': 'Workshops & Seminars',
  'jobs-internships-tech': 'Tech Jobs',
  'jobs-internships-business': 'Business & Finance',
  'jobs-internships-research': 'Research Positions',
  'jobs-internships-oncampus': 'On-Campus Jobs',
  'academics-datascience': 'Data Science',
  'academics-engineering': 'Engineering',
  'academics-business': 'Business',
  'academics-arts': 'Arts & Humanities',
  'announcements-admin': 'Administrative',
  'announcements-safety': 'Safety & Security',
  'announcements-facilities': 'Facilities',
  'announcements-policy': 'Policy Updates',
  'research-stem': 'STEM Research',
  'research-social': 'Social Sciences',
  'research-medical': 'Medical & Health',
  'research-opportunities': 'Research Opportunities'
};

export const categoryNameToSlug: Record<string, Category> = {
  'General Events': 'campus-events-general',
  'Sports & Athletics': 'campus-events-sports',
  'Cultural Events': 'campus-events-cultural',
  'Workshops & Seminars': 'campus-events-workshops',
  'Tech Jobs': 'jobs-internships-tech',
  'Business & Finance': 'jobs-internships-business',
  'Research Positions': 'jobs-internships-research',
  'On-Campus Jobs': 'jobs-internships-oncampus',
  'Data Science': 'academics-datascience',
  'Engineering': 'academics-engineering',
  'Business': 'academics-business',
  'Arts & Humanities': 'academics-arts',
  'Administrative': 'announcements-admin',
  'Safety & Security': 'announcements-safety',
  'Facilities': 'announcements-facilities',
  'Policy Updates': 'announcements-policy',
  'STEM Research': 'research-stem',
  'Social Sciences': 'research-social',
  'Medical & Health': 'research-medical',
  'Research Opportunities': 'research-opportunities'
};

export const categorySlugToName: Record<Category, string> = Object.entries(categoryNameToSlug)
  .reduce((acc, [name, slug]) => {
    acc[slug] = name;
    return acc;
  }, {} as Record<Category, string>);

export const categoryColors: Record<Category, string> = {
  'campus-events-general': 'bg-blue-100 text-blue-700',
  'campus-events-sports': 'bg-blue-100 text-blue-700',
  'campus-events-cultural': 'bg-blue-100 text-blue-700',
  'campus-events-workshops': 'bg-blue-100 text-blue-700',
  'jobs-internships-tech': 'bg-green-100 text-green-700',
  'jobs-internships-business': 'bg-green-100 text-green-700',
  'jobs-internships-research': 'bg-green-100 text-green-700',
  'jobs-internships-oncampus': 'bg-green-100 text-green-700',
  'academics-datascience': 'bg-purple-100 text-purple-700',
  'academics-engineering': 'bg-purple-100 text-purple-700',
  'academics-business': 'bg-purple-100 text-purple-700',
  'academics-arts': 'bg-purple-100 text-purple-700',
  'announcements-admin': 'bg-red-100 text-red-700',
  'announcements-safety': 'bg-red-100 text-red-700',
  'announcements-facilities': 'bg-red-100 text-red-700',
  'announcements-policy': 'bg-red-100 text-red-700',
  'research-stem': 'bg-orange-100 text-orange-700',
  'research-social': 'bg-orange-100 text-orange-700',
  'research-medical': 'bg-orange-100 text-orange-700',
  'research-opportunities': 'bg-orange-100 text-orange-700'
};

// Main categories with their subcategories
export const mainCategories = {
  'campus-events': {
    label: 'Campus Events',
    subcategories: [
      'campus-events-general',
      'campus-events-sports',
      'campus-events-cultural',
      'campus-events-workshops'
    ] as Category[]
  },
  'jobs-internships': {
    label: 'Jobs & Internships',
    subcategories: [
      'jobs-internships-tech',
      'jobs-internships-business',
      'jobs-internships-research',
      'jobs-internships-oncampus'
    ] as Category[]
  },
  'academics': {
    label: 'Academics',
    subcategories: [
      'academics-datascience',
      'academics-engineering',
      'academics-business',
      'academics-arts'
    ] as Category[]
  },
  'announcements': {
    label: 'Announcements',
    subcategories: [
      'announcements-admin',
      'announcements-safety',
      'announcements-facilities',
      'announcements-policy'
    ] as Category[]
  },
  'research': {
    label: 'Research',
    subcategories: [
      'research-stem',
      'research-social',
      'research-medical',
      'research-opportunities'
    ] as Category[]
  }
};

export type MainCategoryKey = keyof typeof mainCategories;

// Helper to get main category from subcategory
export const getMainCategory = (category: Category): MainCategoryKey => {
  const categoryPrefix = category.split('-').slice(0, -1).join('-');
  return categoryPrefix as MainCategoryKey;
};

export const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMs / 3600000);
  const diffInDays = Math.floor(diffInMs / 86400000);

  if (diffInMinutes < 1) return 'just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const getRoleBadgeColor = (role: 'student' | 'faculty' | 'admin'): string => {
  switch (role) {
    case 'student':
      return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'faculty':
      return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'admin':
      return 'bg-purple-50 text-purple-600 border-purple-200';
  }
};
