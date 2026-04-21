import React from 'react';
import { Category } from '../types';
import { categoryLabels, categoryColors } from '../utils/helpers.ts';

interface CategoryTagProps {
  category: Category;
  size?: 'sm' | 'md';
}

export const CategoryTag: React.FC<CategoryTagProps> = ({ category, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-sm';
  
  return (
    <span className={`inline-flex items-center rounded-full font-semibold tracking-[0.08em] uppercase ${categoryColors[category]} ${sizeClasses}`}>
      {categoryLabels[category]}
    </span>
  );
};
