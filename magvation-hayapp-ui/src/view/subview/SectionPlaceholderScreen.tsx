import React from "react";
import styles from "../subviewcss/sectionPlaceholderScreen.module.css";

interface SectionPlaceholderScreenProps {
    sectionNumber: number;
    title: string;
    description: string;
}

export const SectionPlaceholderScreen: React.FC<SectionPlaceholderScreenProps> = ({
    sectionNumber,
    title,
    description,
}) => {
    return (
        <div className={styles.screenContainer}>
            <div className={styles.badge}>
                <span className={styles.badgeText}>{title}</span>
            </div>
            <span className={styles.description}>{description}</span>
            <span className={styles.subtitle}>Section {sectionNumber} — Under Construction</span>
        </div>
    );
};
