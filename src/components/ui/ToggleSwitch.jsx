import React from 'react';

const ToggleSwitch = React.forwardRef(({
    label,
    checked,
    onChange,
    disabled = false,
    variant = 'primary',
    size = 'md',
    className = '',
    style = {},
    ...props
}, ref) => {
    const inputRef = React.useRef(null);

    // Get accent color based on variant (used for the active track)
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

    // Size styles for the switch dimensions
    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return { width: '36px', height: '20px', thumbSize: '16px', fontSize: '12px' };
            case 'lg':
                return { width: '56px', height: '32px', thumbSize: '28px', fontSize: '16px' };
            case 'md':
            default:
                return { width: '44px', height: '24px', thumbSize: '20px', fontSize: '14px' };
        }
    };

    const accentColor = getVariantColor();
    const sizeStyles = getSizeStyles();

    // Track styles (the background of the switch)
    const trackStyles = {
        position: 'relative',
        display: 'inline-block',
        width: sizeStyles.width,
        height: sizeStyles.height,
        borderRadius: sizeStyles.height, // pill shape
        backgroundColor: checked ? accentColor : 'var(--surface)',
        border: `1px solid ${checked ? accentColor : 'var(--secondary)'}`,
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
    };

    // Thumb styles (the movable circle)
    const thumbStyles = {
        position: 'absolute',
        top: '50%',
        transform: `translateY(-50%) ${checked ? `translateX(calc(${sizeStyles.width} - ${sizeStyles.thumbSize} - 2px))` : 'translateX(2px)'}`,
        width: sizeStyles.thumbSize,
        height: sizeStyles.thumbSize,
        borderRadius: '50%',
        backgroundColor: 'white',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.2s ease',
    };

    // Wrapper styles for label + switch
    const wrapperStyles = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: 'var(--font-sans)',
        ...style,
    };

    const labelStyles = {
        fontSize: sizeStyles.fontSize,
        cursor: disabled ? 'not-allowed' : 'pointer',
    };

    // Handle click on the wrapper (or label) to toggle
    const handleClick = (e) => {
        if (disabled) return;
        if (inputRef.current) {
            const newChecked = !checked;
            // Simulate a change event
            const event = {
                target: { checked: newChecked },
                currentTarget: { checked: newChecked },
            };
            onChange(event);
        }
    };

    return (
        <div style={wrapperStyles} className={className}>
            <div
                style={trackStyles}
                onClick={handleClick}
                role="presentation"
            >
                <div style={thumbStyles} />
            </div>
            <input
                type="checkbox"
                ref={(node) => {
                    inputRef.current = node;
                    if (ref) {
                        if (typeof ref === 'function') ref(node);
                        else ref.current = node;
                    }
                }}
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                style={{ display: 'none' }}
                {...props}
            />
            {label && (
                <span style={labelStyles} onClick={handleClick}>
                    {label}
                </span>
            )}
        </div>
    );
});

ToggleSwitch.displayName = 'ToggleSwitch';

export default ToggleSwitch;