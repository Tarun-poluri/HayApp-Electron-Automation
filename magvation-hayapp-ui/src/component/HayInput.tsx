import React, { useState, useEffect, useRef } from "react";
import styles from "./HayInput.module.css";
import { FullKey, Action, HayKeyboard, KeyboardType } from "./HayKeyboard";

interface HayInputProps {
    value?: string;
    placeholder?: string;
    onChange?: (value: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    onKeyboardShow?: () => void;
    onKeyboardHide?: () => void;
    className?: string;
    disabled?: boolean;
    maxLength?: number;
    autoFocus?: boolean;
    type?: "text" | "email" | "password" | "number";
    showKeyboard?: boolean;
    keyboardType?: KeyboardType;
    // Touchscreen optimizations: TODO: add system keyboard support
}

export function HayInput({
    value = "",
    placeholder = "Enter text",
    onChange,
    onFocus,
    onBlur,
    onKeyboardShow,
    onKeyboardHide,
    className = "",
    disabled = false,
    maxLength,
    autoFocus = false,
    type = "text",
    showKeyboard = true,
    keyboardType = KeyboardType.Standard,
}: HayInputProps) {
    const [inputValue, setInputValue] = useState<string>(value);
    const [isSelected, setIsSelected] = useState<boolean>(false);
    const [isUsingKeyboard, setIsUsingKeyboard] = useState<boolean>(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Update internal state when external value prop changes
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        onChange?.(newValue);
    };

    const handleFocus = () => {
        setIsSelected(true);
        onFocus?.();
        onKeyboardShow?.();
    };

    const handleInputClick = () => {
        // If the input is clicked, show the keyboard
        setIsSelected(true);
        setIsUsingKeyboard(false); // Reset the keyboard state
        onKeyboardShow?.();
    };

    const handleBlur = () => {
        // Use a longer delay to allow for keyboard interactions
        // This prevents the keyboard from hiding when clicking keys
        setTimeout(() => {
            if (!isUsingKeyboard) {
                setIsSelected(false);
                onKeyboardHide?.();
            }
        }, 300);
        onBlur?.();
    };

    const handleKeyClicked = (key: FullKey, shifted: boolean) => {
        // Mark that we're using the keyboard immediately
        setIsUsingKeyboard(true);

        if (key.function === Action.INPUT) {
            let ch = key.value;
            if (shifted) {
                if (key.shiftValue) {
                    ch = key.shiftValue;
                } else {
                    ch = key.value.toUpperCase();
                }
            }

            const newValue = inputValue + ch;
            setInputValue(newValue);
            onChange?.(newValue);
        } else if (key.function === Action.BACKSPACE && inputValue.length > 0) {
            const newValue = inputValue.substring(0, inputValue.length - 1);
            setInputValue(newValue);
            onChange?.(newValue);
        } else if (key.function === Action.ENTER) {
            // Hide the keyboard when ENTER is pressed
            setIsSelected(false);
            setIsUsingKeyboard(false);
            onKeyboardHide?.();
        }

        // Ensure the input stays focused after key click
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 0);
    };

    return (
        <>
            <div className={styles.inputContainer}>
                <input
                    ref={inputRef}
                    type={type}
                    className={`${styles.inputField} ${className}`}
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onClick={handleInputClick}
                    disabled={disabled}
                    maxLength={maxLength}
                    autoFocus={autoFocus}
                />
            </div>
            {isSelected && showKeyboard && (
                <div
                    className={styles.fullScreenKeyboard}
                    onClick={(e) => {
                        // If clicking on the background (not the keyboard), hide the keyboard
                        if (e.target === e.currentTarget) {
                            setIsUsingKeyboard(false);
                            setIsSelected(false);
                            onKeyboardHide?.();
                        }
                    }}
                >
                    <div
                        className={styles.keyboardContainer}
                        onMouseDown={(e) => {
                            // Prevent the input from losing focus when clicking on keyboard
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            // Prevent clicks on the keyboard from bubbling up
                            e.stopPropagation();
                        }}
                    >
                        <HayKeyboard onKeyClicked={handleKeyClicked} type={keyboardType} />
                    </div>
                </div>
            )}
        </>
    );
}
