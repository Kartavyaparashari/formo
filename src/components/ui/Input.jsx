import React, { useId } from 'react';

const Input = React.forwardRef(({
  label,
  error,
  helperText,
  className = '',
  containerStyle = {},
  style = {},
  fullWidth = true,
  leftIcon,
  rightIcon,
  ...props
}, ref) => {
  const id = useId();
  const inputId = props.id || id;

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

  const inputWrapperStyles = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  };

  const inputStyles = {
    padding: '10px 12px',
    paddingLeft: leftIcon ? '36px' : '12px',
    paddingRight: rightIcon ? '36px' : '12px',
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
    ...style
  };

  const helperStyles = {
    marginTop: '6px',
    fontSize: '12px',
    color: error ? '#ef4444' : 'var(--secondary)',
  };

  const iconStyles = {
    position: 'absolute',
    color: 'var(--secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 10px',
  };

  return (
    <div style={containerBaseStyles} className={className}>
      {label && <label htmlFor={inputId} style={labelStyles}>{label}</label>}
      
      <div style={inputWrapperStyles}>
        {leftIcon && <div style={{ ...iconStyles, left: 0 }}>{leftIcon}</div>}
        
        <input
          ref={ref}
          id={inputId}
          style={inputStyles}
          onFocus={(e) => {
            e.target.style.borderColor = error ? '#ef4444' : 'var(--primary)';
            e.target.style.boxShadow = `0 0 0 2px ${error ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? '#ef4444' : 'var(--secondary)';
            e.target.style.boxShadow = 'var(--shadow-sm)';
          }}
          {...props}
        />
        
        {rightIcon && <div style={{ ...iconStyles, right: 0 }}>{rightIcon}</div>}
      </div>

      {(error || helperText) && (
        <span style={helperStyles}>
          {error || helperText}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
