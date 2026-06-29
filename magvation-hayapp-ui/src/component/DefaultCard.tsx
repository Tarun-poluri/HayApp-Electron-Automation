import React from "react";
import styles from "./DefaultCard.module.css";

interface DefaultCardProps {
    title: string;
    number: number;
    numberContent?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

const DefaultCard: React.FC<DefaultCardProps> = ({ title, number, numberContent, children, className = "" }) => {
    const cardClass = `${styles.defaultCard}${className ? ` ${className}` : ""}`;

    return (
        <div className={cardClass}>
            <div className={styles.cardContentContainer}>
                <span className={styles.cardContentTitle}>{title}</span>
                <div className={styles.NumberContainer}>
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
            </div>
            {children}
        </div>
    );
};

export default DefaultCard;
