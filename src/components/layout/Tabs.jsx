import React, { useState } from 'react';

const Tabs = ({ tabs = [], defaultActive = 0, onChange, className = '', style = {} }) => {
  const [activeIndex, setActiveIndex] = useState(defaultActive);

  const handleTabClick = (index) => {
    setActiveIndex(index);
    if (onChange) onChange(index);
  };

  return (
    <div className={className} style={{ fontFamily: 'var(--font-sans)', width: '100%', ...style }}>
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        borderBottom: '1px solid rgba(148, 163, 184, 0.3)',
        marginBottom: '1.5rem',
        scrollbarWidth: 'none'
      }}>
        {tabs.map((tab, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={index}
              onClick={() => handleTabClick(index)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0.75rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: isActive ? '600' : '500',
                color: isActive ? 'var(--primary)' : 'var(--secondary)',
                borderBottom: `2px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--secondary)';
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {tabs[activeIndex] && tabs[activeIndex].content}
      </div>
    </div>
  );
};

export default Tabs;
