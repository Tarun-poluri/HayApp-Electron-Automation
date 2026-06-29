import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/waitForCIRClosingCount.module.css";

interface WaitForCIRClosingCountProps {
    /** Translation key for the instruction text. Defaults to "scrClosingCount.waitForCIR". */
    textKey?: string;
    /** Custom content to render instead of the default translated text span. */
    children?: React.ReactNode;
}

export const WaitForCIRClosingCount: React.FC<WaitForCIRClosingCountProps> = ({
    textKey = "scrClosingCount.waitForCIR",
    children,
}) => {
    const { t } = useTranslation();

    return (
        <div className={styles.contentArea}>
            <div className={styles.card}>
                <div className={styles.dotRing}>
                    {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} className={styles.dot} style={{ "--i": i } as React.CSSProperties} />
                    ))}
                </div>
                {children || <span className={styles.waitText}>{t(textKey)}</span>}
            </div>
        </div>
    );
};
