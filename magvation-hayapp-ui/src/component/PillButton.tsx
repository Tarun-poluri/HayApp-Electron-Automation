import React from "react";
import styles from "./PillButton.module.css";

export interface DynamicButtonProps {
    label: string;
    Icon?: React.ReactNode;
    inactiveIcon?: React.ReactNode;
    onClick?: () => void;
    // State
    isActive?: boolean;
    disabled?: boolean;
    // Colors - Normal state
    bgColor?: string;
    borderColor?: string;
    textColor?: string;
    iconColor?: string;
    // Colors - Active state
    activeBgColor?: string;
    activeBorderColor?: string;
    activeTextColor?: string;
    activeIconColor?: string;
    // Colors - Disabled state
    disabledBgColor?: string;
    disabledBorderColor?: string;
    disabledTextColor?: string;
    disabledIconColor?: string;
    // Sizing
    fullWidth?: boolean;
    height?: string | number;
    padding?: string;
    // Border
    borderWidth?: string | number;
    borderRadius?: string | number;
    // Typography
    fontSize?: string | number;
    fontWeight?: string | number;
    // Opacity
    opacity?: number;
    // Other
    gap?: string | number;
    className?: string;
    // Icon sizing
    iconSize?: string | number;
}

export const DynamicButton = ({
    label,
    Icon,
    inactiveIcon,
    onClick,
    isActive = false,
    disabled = false,
    // Normal state colors
    bgColor = "transparent",
    borderColor = "#3ebcab",
    textColor = "#3ebcab",
    // Active state colors
    activeBgColor,
    activeBorderColor,
    activeTextColor = "#fff",
    // Disabled state colors
    disabledBgColor,
    disabledBorderColor,
    disabledTextColor,
    // Sizing - now using viewport units
    fullWidth = false,
    height = "6.48vh",
    padding = "1.48vh 1.04vw 1.48vh 1.56vw",
    // Border
    borderWidth = "0.10vw",
    borderRadius = "2.86vw",
    // Typography
    fontSize = "1.85vh",
    fontWeight,
    // Opacity
    opacity = 1,
    // Other
    gap = "0.63vw",
    className,
    // Icon sizing
    iconSize,
}: DynamicButtonProps) => {
    // Determine current state
    const isDisabled = disabled;
    const isCurrentlyActive = isActive && !isDisabled;

    // Calculate colors based on state
    // When disabled: use disabled colors
    // When active (and not disabled): use active colors
    // When inactive (not active, not disabled): ALWAYS use normal colors (bgColor, borderColor, textColor)
    const currentBgColor = isDisabled
        ? disabledBgColor || bgColor
        : isCurrentlyActive
          ? activeBgColor || borderColor
          : bgColor; // When inactive and not disabled, always use bgColor

    const currentBorderColor = isDisabled
        ? disabledBorderColor || borderColor
        : isCurrentlyActive
          ? activeBorderColor || borderColor
          : borderColor;

    const currentTextColor = isDisabled
        ? disabledTextColor || textColor
        : isCurrentlyActive
          ? activeTextColor
          : textColor;

    // Determine which icon to show
    // When disabled: use inactiveIcon if provided, otherwise Icon (with disabledIconColor to contrast with disabled background)
    // When not disabled (active or inactive): use Icon
    const currentIcon = isDisabled ? inactiveIcon || Icon : Icon;

    return (
        <button
            className={`${styles["primary-large"]} ${className || ""}`}
            style={
                {
                    backgroundColor: currentBgColor,
                    borderColor: currentBorderColor,
                    borderWidth: typeof borderWidth === "number" ? `${borderWidth}px` : borderWidth,
                    borderRadius: typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
                    opacity: opacity,
                    width: fullWidth ? "100%" : "auto",
                    height: typeof height === "number" ? `${height}px` : height,
                    padding: padding,
                    gap: typeof gap === "number" ? `${gap}px` : gap,
                    cursor: disabled ? "not-allowed" : onClick ? "pointer" : "default",
                } as React.CSSProperties
            }
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
        >
            <span
                className={styles["text-wrapper"]}
                style={{
                    color: currentTextColor,
                    fontSize: typeof fontSize === "number" ? `${fontSize}px` : fontSize,
                    fontWeight: fontWeight,
                }}
            >
                {label}
            </span>
            {currentIcon && (
                <span
                    className={styles["icon-wrapper"]}
                    style={{
                        width: iconSize ? (typeof iconSize === "number" ? `${iconSize}px` : iconSize) : undefined,
                        height: iconSize ? (typeof iconSize === "number" ? `${iconSize}px` : iconSize) : undefined,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    {currentIcon}
                </span>
            )}
        </button>
    );
};
