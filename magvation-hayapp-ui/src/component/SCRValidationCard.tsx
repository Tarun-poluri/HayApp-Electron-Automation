import React from "react";
import styles from "./SCRValidationCard.module.css";

interface SCRValidationCardProps {
    title: string;
    number: number;
    active?: boolean;
    numberContent?: React.ReactNode;
    children?: React.ReactNode;
}

const SCRValidationCard: React.FC<SCRValidationCardProps> = ({
    title,
    number,
    active = false,
    numberContent,
    children,
}) => {
    let cardClass = styles.validationCard;
    if (active) {
        cardClass += ` ${styles.activeValidation}`;
    }

    return (
        <div className={cardClass}>
            <div className={styles.cardContentContainer}>
                <div className={styles.cardTextContainer}>
                    <span className={styles.cardContentTitle}>{title}</span>
                    <div className={styles.cardNumberContainer}>
                        {numberContent !== undefined ? (
                            numberContent
                        ) : (
                            <span className={styles.cardNumberText}>{number}</span>
                        )}
                    </div>
                </div>
            </div>
            {children}
        </div>
    );
};

export default SCRValidationCard;
