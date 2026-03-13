import React from 'react';

export default function HelpModal({onClose}) {

    return (
    <div className="modal-backdrop">
      <div className="modal-shell">
        <div className="modal-header">
          <h2>How-to and FAQ</h2>
          <button className="cancel-btn" aria-label="Close help modal" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <p>blablabla</p>
        </div>

        
      </div>
    </div>
  );
}
