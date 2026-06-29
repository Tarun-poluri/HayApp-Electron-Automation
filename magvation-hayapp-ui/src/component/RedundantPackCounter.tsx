import React from "react";
import styles from "./RedundantPackCounter.module.css";
import { useTranslation } from "react-i18next";

interface RedundantPackCounterProps {
    value: number;
    min?: number;
    max: number;
    onChange: (newValue: number) => void;
}

export const RedundantPackCounter: React.FC<RedundantPackCounterProps> = ({ value, min = 0, max, onChange }) => {
    const { t } = useTranslation();

    const handleDecrement = () => {
        if (value > min) {
            onChange(value - 1);
        }
    };

    const handleIncrement = () => {
        if (value < max) {
            onChange(value + 1);
        }
    };

    const isMinDisabled = value <= min;
    const isMaxDisabled = value >= max;

    return (
        <div className={styles.container}>
            <button
                className={`${styles.button} ${isMinDisabled ? styles.disabled : ""}`}
                onClick={handleDecrement}
                disabled={isMinDisabled}
                aria-label={t("components.redundantPackCounter.decreaseAriaLabel", {
                    defaultValue: "Decrease redundant pack count",
                })}
            >
                <span className={styles.buttonIcon}>−</span>
            </button>
            <span className={styles.value}>{value}</span>
            <button
                className={`${styles.button} ${isMaxDisabled ? styles.disabled : ""}`}
                onClick={handleIncrement}
                disabled={isMaxDisabled}
                aria-label={t("components.redundantPackCounter.increaseAriaLabel", {
                    defaultValue: "Increase redundant pack count",
                })}
            >
                <span className={styles.buttonIcon}>+</span>
            </button>
        </div>
    );
};
