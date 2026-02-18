import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * List vs. dashboard view toggle. Renders as text in header next to timestamp.
 * On /: shows "• List" → navigate to /conditions.
 * On /conditions: shows "• Dashboard" → navigate to /.
 * Bullet and label use same gap as row for even spacing (PM  •  List).
 */
function ViewToggle() {
  const navigate = useNavigate();
  const location = useLocation();
  const isConditions = location.pathname === '/conditions';

  const handleClick = (e) => {
    e.preventDefault();
    if (isConditions) navigate('/');
    else navigate('/conditions');
  };

  const label = isConditions ? 'Dashboard' : 'Currently';
  const title = isConditions ? 'Dashboard (overview)' : 'Current conditions';

  return (
    <button
      type="button"
      className="view-toggle"
      onClick={handleClick}
      title={title}
      aria-label={title}
    >
      <span className="view-toggle-bullet" aria-hidden="true">•</span>
      <span className="view-toggle-label">{label}</span>
    </button>
  );
}

export default ViewToggle;
