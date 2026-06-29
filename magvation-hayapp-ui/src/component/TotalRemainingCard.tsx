import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./TotalRemainingCard.module.css";
import InterimStar from "../img/InterimStar.svg";

export type TotalRemainingVariant = "cir" | "scr";

export interface TotalRemainingCardProps {
    title: string;
    remaining: number;
    /** Needles added during interim count — when > 0, show the extra strip */
    extraNeedleCount: number;
    variant: TotalRemainingVariant;
}

export const TotalRemainingCard: React.FC<TotalRemainingCardProps> = ({
    title,
    remaining,
    extraNeedleCount,
    variant,
}) => {
    const { t } = useTranslation();
    const hasExtra = extraNeedleCount > 0;

    const cardClass = [
        styles.card,
        variant === "cir" ? styles.cardCir : styles.cardScr,
        hasExtra ? styles.cardWithExtra : "",
    ]
        .filter(Boolean)
        .join(" ");

    const titleClass = variant === "cir" ? styles.titleCir : styles.titleScr;
    const numberClass = variant === "cir" ? styles.numberCir : styles.numberScr;

    return (
        <div className={cardClass}>
            <span className={titleClass}>{title}</span>
            <span className={`${numberClass} ${remaining === 0 && !hasExtra ? styles.zeroValue : ""}`}>
                {remaining}
            </span>
            {hasExtra ? (
                <div className={styles.extraBar}>
                    <span className={styles.extraBadge}>
                        <img src={InterimStar} alt="" className={styles.extraStar} />
                        <span className={styles.extraBadgeNum}>{extraNeedleCount}</span>
                    </span>
                    <span className={styles.extraLabel}>{t("extraNeedles.extra")}</span>
                </div>
            ) : null}
        </div>
    );
};

export default TotalRemainingCard;
