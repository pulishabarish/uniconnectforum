import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, FileText, ImagePlus } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { Category } from '../types';
import { categoryLabels, categorySlugToName } from '../utils/helpers.ts';
import { toast } from 'sonner';
import { PopupDialog } from '../components/PopupDialog.tsx';

export const CreateTopicPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('campus-events-general');
  const [content, setContent] = useState('');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [popupMessage, setPopupMessage] = useState('');

  useEffect(() => {
    return () => {
      if (coverImagePreview) {
        URL.revokeObjectURL(coverImagePreview);
      }
    };
  }, [coverImagePreview]);

  const showWarning = (message: string) => {
    setPopupMessage(message);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showWarning('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showWarning('Image size should be less than 5MB');
      return;
    }

    if (coverImagePreview) {
      URL.revokeObjectURL(coverImagePreview);
    }

    setCoverImageFile(file);
    setCoverImagePreview(URL.createObjectURL(file));
  };

  const removeCoverImage = () => {
    if (coverImagePreview) {
      URL.revokeObjectURL(coverImagePreview);
    }
    setCoverImageFile(null);
    setCoverImagePreview('');
  };

  const validateForm = () => {
    if (!title.trim()) {
      showWarning('Title field should be filled');
      return false;
    }

    if (!category.trim()) {
      showWarning('Category field should be filled');
      return false;
    }

    if (!content.trim()) {
      showWarning('Content field should be filled');
      return false;
    }

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = String(currentUser?.id ?? storedUser.USER_ID ?? '').trim();
    if (!userId) {
      showWarning('User field should be filled');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('content', content.trim());
      formData.append('category', categorySlugToName[category]);
      formData.append('user_id', String(currentUser?.id ?? user.USER_ID));
      if (coverImageFile) {
        formData.append('coverImage', coverImageFile);
      }

      const res = await fetch('https://uniconnectforum.onrender.com/api/create-topic/', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        const isFacultyOrAdmin = currentUser?.role === 'faculty' || currentUser?.role === 'admin';
        toast.success(
          isFacultyOrAdmin ? 'Topic published successfully' : 'Topic submitted for approval'
        );
        navigate('/');
      } else {
        toast.error(data.message || 'Failed to create topic');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to create topic');
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <PopupDialog
        isOpen={Boolean(popupMessage)}
        title="Please Fill Required Field"
        message={popupMessage}
        confirmLabel="OK"
        onConfirm={() => setPopupMessage('')}
      />

      <button
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        Return to Discussion Feed
      </button>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
        <div className="university-panel p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Publishing Workspace</p>
          <h1 className="mt-3 university-section-title">Create a university-ready topic</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Draft a clear, well-structured discussion that reflects professional campus communication standards.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a precise and informative topic title"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                {(Object.keys(categoryLabels) as Category[]).map(cat => (
                  <option key={cat} value={cat}>
                    {categoryLabels[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Discussion Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder="Summarize the issue, provide context, and guide readers toward a productive discussion."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Cover Image</label>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                {!coverImagePreview ? (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-white bg-white px-4 py-10 text-center shadow-sm transition-colors hover:bg-slate-50">
                    <div className="rounded-full bg-blue-50 p-3 text-blue-700">
                      <ImagePlus size={28} />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-800">Upload a professional cover image</p>
                    <p className="mt-1 text-xs text-slate-500">PNG, JPG, or GIF up to 5MB</p>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <img src={coverImagePreview} alt="Cover preview" className="h-64 w-full object-cover" />
                    <button
                      type="button"
                      onClick={removeCoverImage}
                      className="absolute right-3 top-3 rounded-full bg-white/95 p-2 text-slate-700 shadow-sm transition hover:bg-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Upload size={16} />
              Publish Topic
            </button>
          </form>
        </div>

        <aside className="space-y-6">
          <div className="university-panel p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
                <FileText size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Publishing Guidance</h2>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                  <li>Use a direct, informative title that helps readers understand the topic immediately.</li>
                  <li>Provide context, expected outcomes, or questions that guide constructive replies.</li>
                  <li>Keep the language professional and relevant to university life.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="university-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Posting Role</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900 capitalize">{currentUser?.role || 'Faculty'}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Topics published from this workspace appear in the main university discussion feed and should meet institutional communication expectations.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
};
