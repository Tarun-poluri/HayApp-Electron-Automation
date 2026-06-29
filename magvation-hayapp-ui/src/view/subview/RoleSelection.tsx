import React from "react";
import styles from "../subviewcss/roleSelection.module.css";
import { useTranslation } from "react-i18next";
import CIRImg from "../../img/CIR.svg";
import SCRImg from "../../img/SCR.svg";
import BlackRightArrowImg from "../../img/BlackRightArrow.svg";

interface RoleSelectionProps {
    onSelectCIR: () => void;
    onSelectSCR: () => void;
}

export const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectCIR, onSelectSCR }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                {t("setup.roleSelection.header") || "Please log in to proceed with the Start Count."}
            </div>
            <div className={styles.container}>
                <div className={styles.card} onClick={onSelectCIR}>
                    <div className={styles.iconContainer}>
                        <img src={CIRImg} className={`${styles.icon} ${styles.cirIcon}`} alt="CIR" />
                    </div>
                    <div className={styles.label}>{t("setup.roleSelection.cir") || "CIR Role"}</div>
                    <div className={styles.subtitle}>{t("setup.roleSelection.circulator") || "Circulator"}</div>
                    <button className={styles.arrowButton}>
                        <img src={BlackRightArrowImg} className={styles.arrowIcon} alt="Go" />
                    </button>
                </div>

                <div className={styles.card} onClick={onSelectSCR}>
                    <div className={styles.iconContainer}>
                        <img src={SCRImg} className={`${styles.icon} ${styles.scrIcon}`} alt="SCR" />
                    </div>
                    <div className={styles.label}>{t("setup.roleSelection.scr") || "SCR Role"}</div>
                    <div className={styles.subtitle}>{t("setup.roleSelection.scrub") || "Scrub"}</div>
                    <button className={styles.arrowButton}>
                        <img src={BlackRightArrowImg} className={styles.arrowIcon} alt="Go" />
                    </button>
                </div>
            </div>
        </div>
    );
};
