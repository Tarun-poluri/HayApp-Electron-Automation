import React from "react";
import styles from "../subviewcss/countReconciliationScreen.module.css";
import { useTranslation } from "react-i18next";
import GreenDone from "../../img/GreenDone.svg";
import WarningIcon from "../../img/Warning.svg";
import InterimStar from "../../img/InterimStar.svg";

interface CountReconciliationScreenProps {
    systemCount: number;
    scrCount: number;
    onOk?: () => void;
    hideButtons?: boolean;
}

export const CountReconciliationScreen: React.FC<CountReconciliationScreenProps> = ({
    systemCount,
    scrCount,
    onOk,
    hideButtons = false,
}) => {
    const { t } = useTranslation();
    const operator = systemCount === scrCount ? "=" : systemCount < scrCount ? "<" : ">";
    const isMatch = systemCount === scrCount;
    const titleKey = isMatch ? "interimCount.done.completedMatch" : "interimCount.done.completedMismatch";
    const showMisplacedBar = systemCount > scrCount;
    const showExtraBar = scrCount > systemCount;
    const scrCardHasBottomBand = showMisplacedBar || showExtraBar;

    return (
        <div className={styles.screenContainer}>
            <div className={styles.titleRow}>
                {isMatch ? (
                    <img src={GreenDone} alt="" className={styles.titleIcon} />
                ) : (
                    <img src={WarningIcon} alt="" className={styles.titleIcon} />
                )}
                <div className={styles.titleText}>{t(titleKey)}</div>
            </div>

            <div className={styles.cardsRow}>
                <div className={styles.card}>
                    <div className={styles.cardTop}>
                        <div className={styles.cardLabel}>{t("interimCount.done.systemCountLabel")}</div>
                        <div className={styles.cardDivider} />
                    </div>
                    <div className={styles.cardNumber}>{systemCount}</div>
                </div>

                <div className={styles.operator}>{operator}</div>

                <div className={`${styles.card} ${scrCardHasBottomBand ? styles.cardScrWithBottomBand : ""}`}>
                    <div className={styles.cardTop}>
                        <div className={styles.cardLabel}>{t("interimCount.done.scrCountLabel")}</div>
                        <div className={styles.cardDivider} />
                    </div>
                    <div className={styles.cardNumber}>{scrCount}</div>
                    {showMisplacedBar ? (
                        <div className={styles.cardMisplacedBar}>
                            <span className={styles.misplacedBadge}>{systemCount - scrCount}</span>
                            <span className={styles.misplacedLabel}>{t("interimCount.done.misplaced")}</span>
                        </div>
                    ) : null}
                    {showExtraBar ? (
                        <div className={styles.cardExtraBar}>
                            <span className={styles.extraBadge}>
                                <img src={InterimStar} alt="" className={styles.extraStarImg} />
                                <span className={styles.extraBadgeNumber}>{scrCount - systemCount}</span>
                            </span>
                            <span className={styles.misplacedLabel}>{t("interimCount.done.extra")}</span>
                        </div>
                    ) : null}
                </div>
            </div>

            {!hideButtons && onOk ? (
                <button className={styles.okButton} onClick={onOk}>
                    {t("interimCount.done.ok")}
                </button>
            ) : (
                <div className={styles.buttonSpacer} />
            )}
        </div>
    );
};

export default CountReconciliationScreen;
