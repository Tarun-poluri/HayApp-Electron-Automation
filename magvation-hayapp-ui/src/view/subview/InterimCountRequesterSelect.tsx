import React from "react";
import styles from "../subviewcss/interimCountRequesterSelect.module.css";
import { useTranslation } from "react-i18next";
import BlackRightArrow from "../../img/BlackRightArrow.svg";
import cirRoleIcon from "../../img/CIR.svg";
import scrRoleIcon from "../../img/SCR.svg";
import surgeonIcon from "../../img/InterimSurgeon.svg";
import otherIcon from "../../img/Document.svg";

export type InterimCountRequesterId = "cir" | "scr" | "surgeon" | "other";

interface InterimCountRequesterSelectProps {
    selectedRequester: InterimCountRequesterId | null;
    onSelectRequester: (id: InterimCountRequesterId) => void;
}

export const InterimCountRequesterSelect: React.FC<InterimCountRequesterSelectProps> = ({
    selectedRequester,
    onSelectRequester,
}) => {
    const { t } = useTranslation();

    const options: { id: InterimCountRequesterId; titleKey: string; illustration: string }[] = [
        { id: "cir", titleKey: "interimCount.requesterCIR", illustration: cirRoleIcon },
        { id: "scr", titleKey: "interimCount.requesterSCR", illustration: scrRoleIcon },
        { id: "surgeon", titleKey: "interimCount.requesterSurgeon", illustration: surgeonIcon },
        { id: "other", titleKey: "interimCount.requesterOther", illustration: otherIcon },
    ];

    return (
        <div className={styles.wrap}>
            <p className={styles.prompt}>{t("interimCount.requesterPrompt")}</p>
            <div className={styles.cards}>
                {options.map(({ id, titleKey, illustration }) => (
                    <button
                        key={id}
                        type="button"
                        className={`${styles.card} ${selectedRequester === id ? styles.cardSelected : ""}`}
                        onClick={() => onSelectRequester(id)}
                    >
                        <div className={styles.iconCircle} aria-hidden>
                            <img
                                src={illustration}
                                alt=""
                                className={`${styles.iconImg} ${id === "other" ? styles.iconImgOther : ""}`}
                            />
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
