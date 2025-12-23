import React from 'react';
const Modal = ({ title, children, onClose }) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-2xl font-bold ml-4" aria-label="Cerrar">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
              aria-hidden="true"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {children}
    </div>
  </div>
);
export default Modal;
