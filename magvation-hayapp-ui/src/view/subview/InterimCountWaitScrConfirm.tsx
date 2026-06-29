import React from "react";
import { useTranslation } from "react-i18next";
import waitStyles from "../subviewcss/waitForSCRValidations.module.css";

export const InterimCountWaitScrConfirm: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className={waitStyles.contentArea}>
            <div className={waitStyles.card}>
                <div className={waitStyles.dotRing}>
                    {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} className={waitStyles.dot} style={{ "--i": i } as React.CSSProperties} />
                    ))}
                </div>
                <span className={waitStyles.waitText}>{t("interimCount.waitScrConfirm")}</span>
            </div>
        </div>
    );
};
