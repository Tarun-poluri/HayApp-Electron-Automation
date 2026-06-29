import React from "react";
import styles from "../subviewcss/interimCountReasonSelect.module.css";
import { useTranslation } from "react-i18next";
import BlackRightArrow from "../../img/BlackRightArrow.svg";
import interimCavityClosure from "../../img/InterimCavityClosure.svg";
import interimSomebodyAsking from "../../img/IntermSomebodyAskingInterim.svg";

export type InterimCountReasonId = "cavity_closure" | "external_request";

interface InterimCountReasonSelectProps {
    selectedReason: InterimCountReasonId | null;
    onSelectReason: (reason: InterimCountReasonId) => void;
}

export const InterimCountReasonSelect: React.FC<InterimCountReasonSelectProps> = ({
    selectedReason,
    onSelectReason,
}) => {
    const { t } = useTranslation();

    const options: { id: InterimCountReasonId; titleKey: string; illustration: string }[] = [
        { id: "cavity_closure", titleKey: "interimCount.reasonCavityClosure", illustration: interimCavityClosure },
        {
            id: "external_request",
            titleKey: "interimCount.reasonExternalRequest",
            illustration: interimSomebodyAsking,
        },
    ];

    return (
        <div className={styles.wrap}>
            <p className={styles.prompt}>{t("interimCount.reasonPrompt")}</p>
            <div className={styles.cards}>
                {options.map(({ id, titleKey, illustration }) => (
                    <button
                        key={id}
                        type="button"
                        className={`${styles.card} ${selectedReason === id ? styles.cardSelected : ""}`}
                        onClick={() => onSelectReason(id)}
                    >
                        <div className={styles.illustration} aria-hidden>
                            <img src={illustration} alt="" className={styles.artImg} />
                        </div>
                        <div className={styles.cardTitle}>{t(titleKey)}</div>
                        <div className={styles.arrowBtn}>
                            <img src={BlackRightArrow} alt="" />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
