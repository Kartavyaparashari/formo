import React, { useId } from 'react';

const Select = React.forwardRef(({
  label,
  options = [],
  error,
  helperText,
  className = '',
  containerStyle = {},
  style = {},
  fullWidth = true,
  placeholder,
  children,
  ...props
}, ref) => {
  const id = useId();
  const selectId = props.id || id;

  const containerBaseStyles = {
    display: 'flex',
    flexDirection: 'column',
    width: fullWidth ? '100%' : 'auto',
    marginBottom: '16px',
    fontFamily: 'var(--font-sans)',
    ...containerStyle
  };

  const labelStyles = {
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--text)',
  };

  const selectWrapperStyles = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  };

  const selectStyles = {
    padding: '10px 36px 10px 12px', /* extra right padding to avoid text overlapping the arrow */
    fontSize: '14px',
    borderRadius: 'var(--radius-md)',
    border: `var(--border-width) solid ${error ? '#ef4444' : 'var(--secondary)'}`,
    background: 'var(--surface)',
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: 'var(--shadow-sm)',
    width: '100%',
    fontFamily: 'var(--font-sans)',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    cursor: 'pointer',
    ...style
  };

  const helperStyles = {
    marginTop: '6px',
    fontSize: '12px',
    color: error ? '#ef4444' : 'var(--secondary)',
  };

  const arrowIconStyles = {
    position: 'absolute',
    right: '12px',
    pointerEvents: 'none',
    color: 'var(--secondary)',
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <div style={containerBaseStyles} className={className}>
      {label && <label htmlFor={selectId} style={labelStyles}>{label}</label>}
      
      <div style={selectWrapperStyles}>
        <select
          ref={ref}
          id={selectId}
          style={selectStyles}
          onFocus={(e) => {
            e.target.style.borderColor = error ? '#ef4444' : 'var(--primary)';
            e.target.style.boxShadow = `0 0 0 2px ${error ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? '#ef4444' : 'var(--secondary)';
            e.target.style.boxShadow = 'var(--shadow-sm)';
          }}
          defaultValue={placeholder ? "" : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((opt, index) => (
            <option key={index} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {children}
        </select>
        
        <div style={arrowIconStyles}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {(error || helperText) && (
        <span style={helperStyles}>
          {error || helperText}
        </span>
      )}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
