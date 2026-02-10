import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import './Modal.css';

/**
 * Shared modal component with consistent backdrop blur, scrim, and scale-in animation.
 * All modals in the app should use this for unified behavior and visual specs.
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Called when backdrop is clicked or Escape is pressed
 * @param {React.ReactNode} children - Modal panel content
 * @param {string} size - 'sm' | 'md' | 'lg' - Panel size on desktop (sm: 400px, md: 560px, lg: 85% max 1100x750)
 * @param {string} ariaLabelledBy - ID of the element that labels the modal (for accessibility)
 * @param {string} ariaDescribedBy - ID of the element that describes the modal (optional)
 * @param {string} className - Additional class names for the panel
 * @param {boolean} fullScreenOnMobile - Use full-screen layout on mobile (default: true)
 */
const Modal = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  ariaLabelledBy,
  ariaDescribedBy,
  className = '',
  fullScreenOnMobile = true,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className={`modal-overlay modal-overlay--${fullScreenOnMobile ? 'responsive' : 'centered'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy || undefined}
    >
      <div
        className="modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div
        className={`modal-panel modal-panel--${size} ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
