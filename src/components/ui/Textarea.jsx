import React from 'react';

const Textarea = React.forwardRef(({
    label,
    value,
    onChange,
    placeholder = '',
    rows = 3,
    disabled = false,
    error = '',
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    style = {},
    ...props
}, ref) => {
    // Get border/focus color based on variant
    const getVariantColor = () => {
        switch (variant) {
            case 'secondary':
                return 'var(--secondary)';
            case 'outline':
                return 'var(--primary)';
            case 'danger':
                return '#ef4444';
            case 'primary':
            default:
                return 'var(--primary)';
        }
    };

    // Size styles for padding and font size
    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return { padding: '6px 10px', fontSize: '12px', borderRadius: 'var(--radius-sm)' };
            case 'lg':
                return { padding: '12px 16px', fontSize: '16px', borderRadius: 'var(--radius-lg)' };
            case 'md':
            default:
                return { padding: '8px 12px', fontSize: '14px', borderRadius: 'var(--radius-md)' };
        }
    };

    const accentColor = getVariantColor();
    const sizeStyles = getSizeStyles();

    // Textarea styles
    const textareaStyles = {
        width: fullWidth ? '100%' : 'auto',
        fontFamily: 'var(--font-sans)',
        backgroundColor: 'var(--background)',
        color: 'var(--text)',
        border: error ? `1px solid #ef4444` : `1px solid ${accentColor}`,
        transition: 'all 0.2s ease',
        outline: 'none',
        resize: 'vertical',
        ...sizeStyles,
        ...style,
    };

    // Focus effect (using :focus pseudo-class, but since we're using inline styles, we rely on global CSS or a separate class)
    // We'll add a className to allow global focus styles via CSS.
    const focusClassName = `textarea-focus-${variant}`;

    // Container styles
    const containerStyles = {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: fullWidth ? '100%' : 'auto',
    };

    // Label styles
    const labelStyles = {
        fontSize: '0.875rem',
        fontWeight: '500',
        color: error ? '#ef4444' : 'var(--text)',
        fontFamily: 'var(--font-sans)',
    };

    // Error message styles
    const errorStyles = {
        fontSize: '0.75rem',
        color: '#ef4444',
        marginTop: '2px',
        fontFamily: 'var(--font-sans)',
    };

    return (
        <div style={containerStyles} className={className}>
            {label && <label style={labelStyles}>{label}</label>}
            <textarea
                ref={ref}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={rows}
                disabled={disabled}
                style={textareaStyles}
                className={`${focusClassName} ${disabled ? 'textarea-disabled' : ''}`}
                {...props}
            />
            {error && <div style={errorStyles}>{error}</div>}
        </div>
    );
});

Textarea.displayName = 'Textarea';

// Add a global style (optional – include in your main CSS)
// For focus states, you can add to your global.css:
/*
.textarea-focus-primary:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
}
.textarea-focus-secondary:focus {
  border-color: var(--secondary);
  box-shadow: 0 0 0 2px rgba(100,116,139,0.2);
}
.textarea-focus-danger:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px rgba(239,68,68,0.2);
}
.textarea-focus-outline:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
}
.textarea-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--surface);
}
*/
export default Textarea;