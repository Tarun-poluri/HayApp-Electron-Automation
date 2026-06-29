import React from "react";
import styles from "./VerificationCard.module.css";
import BlackArrow from "../img/BlackArrow.svg";

interface VerificationCardProps {
    title: string;
    number: number;
    buttonText: string;
    onClick?: () => void;
    active?: boolean;
    variant?: "verification" | "adjudication" | "readjudication";
    children?: React.ReactNode;
}

const VerificationCard: React.FC<VerificationCardProps> = ({
    title,
    number,
    buttonText,
    active = false,
    variant = "verification",
    children,
    onClick,
}) => {
    let cardClass = styles.verificationCard;
    if (active) {
        if (variant === "verification") cardClass += ` ${styles.activeVerification}`;
        else if (variant === "adjudication") cardClass += ` ${styles.activeAdjudication}`;
        else if (variant === "readjudication") cardClass += ` ${styles.activeReAdjudication}`;
    }

    return (
        <div className={cardClass}>
            <div className={styles.cardContentContainer}>
                <span className={styles.cardContentTitle}>{title}</span>
                <span className={styles.cardNumberText}>{number}</span>
            </div>
            {active && (
                <button className={styles.actionButton} onClick={onClick}>
                    <span className={styles.buttonText}>{buttonText}</span>
                    <img src={BlackArrow} alt="arrow" />
                </button>
            )}
            {children}
        </div>
    );
};

export default VerificationCard;
