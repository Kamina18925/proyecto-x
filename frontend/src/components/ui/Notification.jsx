import { useState, useEffect } from 'react';

const Notification = ({ message, type = 'info', duration = 3500, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) setTimeout(onClose, 300); // Allow time for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div
      className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white transition-all duration-300 z-50 ${
        getTypeStyles()
      } ${isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform -translate-y-4 pointer-events-none'}`}
    >
      {message}
      <button
        onClick={() => {
          setIsVisible(false);
          if (onClose) setTimeout(onClose, 300);
        }}
        className="ml-4 text-white hover:text-gray-200"
      >
        &times;
      </button>
    </div>
  );
};

export default Notification;