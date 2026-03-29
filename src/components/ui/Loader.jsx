import React from 'react';

const Loader = ({ size = 'md', color = 'var(--primary)', className = '', style = {} }) => {
  const getSize = () => {
    switch (size) {
      case 'sm': return '16px';
      case 'lg': return '48px';
      case 'md':
      default: return '24px';
    }
  };

  const dimension = getSize();

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      <svg
        style={{
          animation: 'spin 1s linear infinite',
          height: dimension,
          width: dimension,
          color: color
        }}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          style={{ opacity: 0.25 }}
        ></circle>
        <path
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          style={{ opacity: 0.75 }}
        ></path>
      </svg>
      {/* We add a unique style block for the spin animation if it's not defined globally */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Loader;
