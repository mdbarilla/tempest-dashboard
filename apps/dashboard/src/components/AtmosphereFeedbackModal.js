import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import './AtmosphereFeedbackModal.css';

const FEEDBACK_CATEGORIES_KEY = 'tempest-feedback-modal-categories';
const FEEDBACK_REWRITE_KEY = 'tempest-feedback-modal-rewrite';

function getStoredFeedbackForm() {
  try {
    const c = sessionStorage.getItem(FEEDBACK_CATEGORIES_KEY);
    const r = sessionStorage.getItem(FEEDBACK_REWRITE_KEY);
    return {
      categories: c ? JSON.parse(c) : [],
      rewrite: r != null ? r : '',
    };
  } catch {
    return { categories: [], rewrite: '' };
  }
}

function setStoredFeedbackForm(categories, rewrite) {
  try {
    sessionStorage.setItem(FEEDBACK_CATEGORIES_KEY, JSON.stringify(categories));
    sessionStorage.setItem(FEEDBACK_REWRITE_KEY, rewrite);
  } catch {
    // ignore
  }
}

function clearStoredFeedbackForm() {
  try {
    sessionStorage.removeItem(FEEDBACK_CATEGORIES_KEY);
    sessionStorage.removeItem(FEEDBACK_REWRITE_KEY);
  } catch {
    // ignore
  }
}

/** Categories for thumbs-down feedback. slug = API value, label = display. */
export const FEEDBACK_CATEGORIES = [
  { slug: 'repetition', label: 'Repetition bug (phrase repeated)' },
  { slug: 'meta_garbled', label: 'Meta-commentary or garbled output' },
  { slug: 'incorrect_conditions', label: 'Incorrect or mismatched conditions' },
  { slug: 'too_poetic', label: 'Too prosaic or poetic' },
  { slug: 'too_generic', label: 'Too generic or vague' },
  { slug: 'wrong_time', label: 'Wrong time of day' },
  { slug: 'forbidden_words', label: 'Forbidden words (humid, calm, etc.)' },
  { slug: 'wrong_length', label: 'Too long or too short' },
  { slug: 'other', label: 'Other' },
];

const AtmosphereFeedbackModal = ({
  isOpen,
  description,
  onClose,
  onSubmit,
  isSubmitting,
  feedbackPayload,
}) => {
  const [categories, setCategories] = useState([]);
  const [rewrite, setRewrite] = useState('');
  const hasRestoredForOpen = useRef(false);

  // Restore form from sessionStorage when modal opens (e.g. after refresh)
  useEffect(() => {
    if (isOpen) {
      if (!hasRestoredForOpen.current) {
        const { categories: c, rewrite: r } = getStoredFeedbackForm();
        setCategories(c);
        setRewrite(r);
        hasRestoredForOpen.current = true;
      }
    } else {
      hasRestoredForOpen.current = false;
      clearStoredFeedbackForm();
    }
  }, [isOpen]);

  // Persist form while modal is open
  useEffect(() => {
    if (isOpen && (categories.length > 0 || rewrite.trim())) {
      setStoredFeedbackForm(categories, rewrite);
    }
  }, [isOpen, categories, rewrite]);

  const toggleCategory = (slug) => {
    setCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleClose = () => {
    clearStoredFeedbackForm();
    onClose();
  };

  const handleSubmit = () => {
    onSubmit({
      ...(feedbackPayload || {}),
      label: 'down',
      category: categories.length ? categories : ['other'],
      rewrite: rewrite.trim() || null,
    });
    setCategories([]);
    setRewrite('');
    clearStoredFeedbackForm();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      ariaLabelledBy="atmosphere-feedback-title"
      className="atmosphere-feedback-modal"
    >
      <div className="atmosphere-feedback-header">
          <span id="atmosphere-feedback-title">Why wasn't this helpful?</span>
          <button
            type="button"
            className="atmosphere-feedback-close"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="atmosphere-feedback-original">
          <span className="atmosphere-feedback-original-label">Description:</span>
          <p className="atmosphere-feedback-original-text">&quot;{description}&quot;</p>
        </div>

        <div className="atmosphere-feedback-body">
          <label className="atmosphere-feedback-label">What was wrong? (select any)</label>
          <div className="atmosphere-feedback-categories">
            {FEEDBACK_CATEGORIES.map(({ slug, label }) => (
              <button
                key={slug}
                type="button"
                className={`atmosphere-feedback-category ${categories.includes(slug) ? 'selected' : ''}`}
                onClick={() => toggleCategory(slug)}
                disabled={isSubmitting}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="atmosphere-feedback-label">
            Optional: Suggest a better description (used to tune the model)
          </label>
          <textarea
            className="atmosphere-feedback-rewrite"
            value={rewrite}
            onChange={(e) => setRewrite(e.target.value)}
            placeholder="e.g. Crisp, breezy afternoon with patchy clouds."
            rows={2}
            maxLength={200}
            disabled={isSubmitting}
            aria-label="Suggest a better description"
          />
        </div>

        <div className="atmosphere-feedback-actions">
          <button
            type="button"
            className="atmosphere-feedback-submit"
            onClick={handleSubmit}
            disabled={isSubmitting || categories.length === 0}
          >
            {isSubmitting ? 'Submitting…' : 'Submit feedback'}
          </button>
          <button
            type="button"
            className="atmosphere-feedback-cancel"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
    </Modal>
  );
};

export default AtmosphereFeedbackModal;
