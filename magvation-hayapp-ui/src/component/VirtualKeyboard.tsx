import React, { useMemo, useState } from "react";
import styles from "./VirtualKeyboard.module.css";

interface VirtualKeyboardProps {
    onKeyPress: (key: string) => void;
}

type KeyDef = {
    label: string;
    value: string;
    subLabel?: string;
    width: number;
};

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ onKeyPress }) => {
    const [shiftActive, setShiftActive] = useState(false);
    const [capsActive, setCapsActive] = useState(false);
    const isShifted = shiftActive || capsActive;

    const keyboardRows: KeyDef[][] = useMemo(
        () => [
            [
                { label: "Esc", value: "esc", width: 1.2 },
                { label: "~", subLabel: "`", value: "`", width: 1 },
                { label: "!", subLabel: "1", value: "1", width: 1 },
                { label: "@", subLabel: "2", value: "2", width: 1 },
                { label: "#", subLabel: "3", value: "3", width: 1 },
                { label: "$", subLabel: "4", value: "4", width: 1 },
                { label: "%", subLabel: "5", value: "5", width: 1 },
                { label: "^", subLabel: "6", value: "6", width: 1 },
                { label: "&", subLabel: "7", value: "7", width: 1 },
                { label: "*", subLabel: "8", value: "8", width: 1 },
                { label: "(", subLabel: "9", value: "9", width: 1 },
                { label: ")", subLabel: "0", value: "0", width: 1 },
                { label: "_", subLabel: "-", value: "-", width: 1 },
                { label: "+", subLabel: "=", value: "=", width: 1 },
                { label: "⌫", value: "backspace", width: 1.8 },
            ],
            [
                { label: "Tab", value: "tab", width: 1.5 },
                { label: "q", value: "q", width: 1 },
                { label: "w", value: "w", width: 1 },
                { label: "e", value: "e", width: 1 },
                { label: "r", value: "r", width: 1 },
                { label: "t", value: "t", width: 1 },
                { label: "y", value: "y", width: 1 },
                { label: "u", value: "u", width: 1 },
                { label: "i", value: "i", width: 1 },
                { label: "o", value: "o", width: 1 },
                { label: "p", value: "p", width: 1 },
                { label: "{", subLabel: "[", value: "[", width: 1 },
                { label: "}", subLabel: "]", value: "]", width: 1 },
                { label: "|", subLabel: "\\", value: "\\", width: 1 },
                { label: "Del", value: "backspace", width: 1.3 },
            ],
            [
                { label: "Caps", value: "caps", width: 1.7 },
                { label: "a", value: "a", width: 1 },
                { label: "s", value: "s", width: 1 },
                { label: "d", value: "d", width: 1 },
                { label: "f", value: "f", width: 1 },
                { label: "g", value: "g", width: 1 },
                { label: "h", value: "h", width: 1 },
                { label: "j", value: "j", width: 1 },
                { label: "k", value: "k", width: 1 },
                { label: "l", value: "l", width: 1 },
                { label: ":", subLabel: ";", value: ";", width: 1 },
                { label: '"', subLabel: "'", value: "'", width: 1 },
                { label: "Enter", value: "enter", width: 2.2 },
            ],
            [
                { label: "Shift", value: "shift", width: 2.2 },
                { label: "z", value: "z", width: 1 },
                { label: "x", value: "x", width: 1 },
                { label: "c", value: "c", width: 1 },
                { label: "v", value: "v", width: 1 },
                { label: "b", value: "b", width: 1 },
                { label: "n", value: "n", width: 1 },
                { label: "m", value: "m", width: 1 },
                { label: "<", subLabel: ",", value: ",", width: 1 },
                { label: ">", subLabel: ".", value: ".", width: 1 },
                { label: "?", subLabel: "/", value: "/", width: 1 },
                { label: "^", value: "up", width: 1 },
                { label: "Shift", value: "shift", width: 2.2 },
            ],
            [
                { label: "Fn", value: "fn", width: 1.2 },
                { label: "Ctrl", value: "ctrl", width: 1.2 },
                { label: "⊞", value: "win", width: 1.2 },
                { label: "Alt", value: "alt", width: 1.2 },
                { label: "", value: "space", width: 6.2 },
                { label: "Alt", value: "alt", width: 1.2 },
                { label: "Ctrl", value: "ctrl", width: 1.2 },
                { label: "<", value: "left", width: 1 },
                { label: "v", value: "down", width: 1 },
                { label: ">", value: "right", width: 1 },
                { label: "☐", value: "menu", width: 1.2 },
            ],
        ],
        [],
    );

    const handleKeyClick = (key: KeyDef) => {
        if (key.value === "shift") {
            setShiftActive((prev) => !prev);
            return;
        }
        if (key.value === "caps") {
            setCapsActive((prev) => !prev);
            return;
        }

        if (key.value.length === 1) {
            if (isShifted && key.subLabel) {
                onKeyPress(key.label);
            } else {
                onKeyPress(isShifted ? key.value.toUpperCase() : key.value);
            }
        } else {
            onKeyPress(key.value);
        }

        if (shiftActive) {
            setShiftActive(false);
        }
    };

    const renderLabel = (key: KeyDef) => {
        if (isShifted && key.value.length === 1 && !key.subLabel) {
            return key.label.toUpperCase();
        }
        return key.label;
    };

    return (
        <div className={styles.keyboardContainer}>
            <div className={styles.keyboard}>
                {keyboardRows.map((row, rowIndex) => (
                    <div key={rowIndex} className={styles.keyboardRow}>
                        {row.map((key, keyIndex) => {
                            const isActive =
                                (key.value === "shift" && shiftActive) || (key.value === "caps" && capsActive);

                            const dominant = key.subLabel ? (isShifted ? key.label : key.subLabel) : renderLabel(key);
                            const secondary = key.subLabel ? (isShifted ? key.subLabel : key.label) : undefined;

                            return (
                                <button
                                    key={keyIndex}
                                    type="button"
                                    className={`${styles.key} ${isActive ? styles.keyActive : ""}`}
                                    style={{ flex: key.width }}
                                    onClick={() => handleKeyClick(key)}
                                >
                                    {secondary && <span className={styles.keySubLabel}>{secondary}</span>}
                                    <span className={styles.keyLabel}>{dominant}</span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};
