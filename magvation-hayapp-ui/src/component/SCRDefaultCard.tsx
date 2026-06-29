import React from "react";
import styles from "./SCRDefaultCard.module.css";

interface SCRDefaultCardProps {
    title: string;
    number: number;
    numberContent?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

const SCRDefaultCard: React.FC<SCRDefaultCardProps> = ({ title, number, numberContent, children, className = "" }) => {
    const cardClass = `${styles.defaultCard}${className ? ` ${className}` : ""}`;

    return (
        <div className={cardClass}>
            <div className={styles.cardContentContainer}>
                <span className={styles.cardContentTitle}>{title}</span>
                <div className={styles.numberContainer}>
                    {numberContent !== undefined ? (
                        numberContent
                    ) : (
                        <span
                            className={
                                number === 0 ? `${styles.cardNumberText} ${styles.zeroValue}` : styles.cardNumberText
                            }
                        >
                            {number}
                        </span>
                    )}
                </div>
                {children}
            </div>
        </div>
    );
};

export default SCRDefaultCard;
