import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, AlertCircle, X, Upload, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { Category } from '../types';
import { categoryLabels, categorySlugToName } from '../utils/helpers.ts';
import { toast } from 'sonner';
import { PopupDialog } from '../components/PopupDialog.tsx';

export const SubmitRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useApp();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('campus-events-general');
  const [content, setContent] = useState('');
  const [proof, setProof] = useState('');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const editRequest = location.state?.editRequest as {
    id: string;
    title: string;
    content: string;
    category: Category;
    proof?: string;
  } | undefined;

  useEffect(() => {
    return () => {
      if (coverImagePreview) {
        URL.revokeObjectURL(coverImagePreview);
      }
    };
  }, [coverImagePreview]);

  useEffect(() => {
    if (!editRequest) return;

    setTitle(editRequest.title || '');
    setContent(editRequest.content || '');
    setCategory(editRequest.category || 'campus-events-general');
    setProof(editRequest.proof || '');
  }, [editRequest]);

  const showWarning = (message: string) => {
    setPopupMessage(message);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    }
  };

  const removeCoverImage = () => {
    if (coverImagePreview) {
      URL.revokeObjectURL(coverImagePreview);
    }
    setCoverImageFile(null);
    setCoverImagePreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const trimmedProof = proof.trim();

    if (!trimmedTitle) {
      showWarning('Title field should be filled');
      return;
    }

    if (!category) {
      showWarning('Category field should be filled');
      return;
    }

    if (!trimmedContent) {
      showWarning('Description field should be filled');
      return;
    }

    if (!trimmedProof) {
      showWarning('Proof / Justification field should be filled');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', trimmedTitle);
      formData.append('content', trimmedContent);
      formData.append('category', categorySlugToName[category]);
      formData.append('proof', trimmedProof);
      formData.append('user_id', currentUser.id);
      if (editRequest?.id) {
        formData.append('topic_id', editRequest.id);
      }
      if (coverImageFile) {
        formData.append('coverImage', coverImageFile);
      }

      const res = await fetch('https://uniconnectforum.onrender.com/api/submit-topic-request/', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
        toast.success(editRequest?.id ? 'Topic request resubmitted successfully' : 'Topic request submitted successfully');

        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        toast.error(data.message || 'Could not submit topic request');
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not submit topic request');
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="university-panel p-12 text-center">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
            <FileText size={32} />
          </div>
          <h2 className="mt-5 text-3xl font-semibold text-slate-900">Request submitted</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Your topic request has been submitted for administrative review. You will receive a notification after it is approved or rejected.
          </p>
          <p className="mt-3 text-sm font-medium text-blue-700">
            You can track its status from your profile page.
          </p>
        </div>
      </div>
    );
  }

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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Topic Request</p>
          <h1 className="mt-3 university-section-title">Submit a topic request</h1>
          {editRequest?.id && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You are updating a request that needs more information. Review the admin note from your profile and resubmit after adding the missing details.
            </div>
          )}
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Propose a new topic for the university forum. Provide clear context and supporting evidence so administrators can review quickly.
          </p>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 shrink-0 text-blue-600" size={18} />
              <div>
                <p className="font-semibold">Before submitting</p>
                <ul className="mt-2 space-y-1 leading-6">
                  <li>Make sure your topic is relevant to campus life or academic activity.</li>
                  <li>Include reliable proof such as an official email, flyer, or announcement.</li>
                  <li>Check whether a similar discussion already exists in the forum.</li>
                </ul>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Topic Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a clear and descriptive topic title"
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
              <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Provide the main details, background, and purpose of the topic"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                rows={6}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Cover Image</label>
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                {!coverImagePreview ? (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-white bg-white px-4 py-10 text-center shadow-sm transition-colors hover:bg-slate-50">
                    <div className="rounded-full bg-blue-50 p-3 text-blue-700">
                      <Upload size={28} />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-800">Upload a supporting cover image</p>
                    <p className="mt-1 text-xs text-slate-500">PNG, JPG, or GIF up to 5MB</p>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <img src={coverImagePreview} alt="Cover preview" className="h-56 w-full object-cover" />
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

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Proof / Justification</label>
              <textarea
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                placeholder="Reference the supporting evidence you have, where it came from, and why the topic should be published."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                rows={4}
              />
              <p className="mt-2 text-xs text-slate-500">
                Include source names, dates, screenshots, links, or other supporting information.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <ClipboardCheck size={16} />
                Submit Request
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-6">
          <div className="university-panel p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Review Standard</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Administrators review student requests for clarity, relevance, and evidence before publishing them to the university forum.
                </p>
              </div>
            </div>
          </div>

          <div className="university-panel p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Submission Guidance</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>Focus on one topic per request.</li>
              <li>Use respectful, professional, campus-appropriate wording.</li>
              <li>Support your request with real, verifiable information.</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
};
