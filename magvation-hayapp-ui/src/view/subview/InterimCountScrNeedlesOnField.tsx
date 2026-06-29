import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/interimCountScrNeedlesOnField.module.css";
import illustrationCount from "../../img/InterimCountSutureNeedles.svg";
import illustrationRecount from "../../img/InterimRecountSutureNeedles.svg";

export type InterimCountScrNeedlesOnFieldVariant = "count" | "recount";

interface InterimCountScrNeedlesOnFieldProps {
    variant: InterimCountScrNeedlesOnFieldVariant;
}

export const InterimCountScrNeedlesOnField: React.FC<InterimCountScrNeedlesOnFieldProps> = ({ variant }) => {
    const { t } = useTranslation();
    const instructionKey =
        variant === "recount"
            ? "interimCount.scrNeedlesOnField.recountInstruction"
            : "interimCount.scrNeedlesOnField.instruction";
    const illustration = variant === "recount" ? illustrationRecount : illustrationCount;

    return (
        <div className={styles.wrap}>
            <div className={styles.artWrap}>
                <img
                    src={illustration}
                    alt={t("interimCount.scrNeedlesOnField.illustrationAlt")}
                    className={styles.art}
                />
            </div>
            <p className={styles.instruction}>{t(instructionKey)}</p>
        </div>
    );
};
