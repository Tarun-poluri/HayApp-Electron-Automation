import React, { useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import stepStyles from "../subviewcss/scrClosingCountStep.module.css";
import SCRHayStackButton from "../../component/SCRHayStackButton";
import { AppContext } from "../App";

interface InterimCountScrConfirmNeedlesProps {
    count: number | null;
    onYes: () => void;
    onNo: () => void;
}

export const InterimCountScrConfirmNeedles: React.FC<InterimCountScrConfirmNeedlesProps> = ({ count, onYes, onNo }) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const ready = count !== null && count >= 0;
    const displayCount = count ?? 0;

    const question =
        displayCount === 1
            ? t("interimCount.scrConfirmNeedles.questionOne")
            : t("interimCount.scrConfirmNeedles.questionOther", { count: displayCount });

    useEffect(() => {
        if (!ready) return;
        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        if (!haystackDefs) return;

        const handler = (event: { button: string }) => {
            if (event.button === "yes") onYes();
            else if (event.button === "no") onNo();
        };

        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [ready, appContext.caseService.parlayInterface.hayStack, onYes, onNo]);

    return (
        <div className={stepStyles.contentArea}>
            <div className={stepStyles.card}>
                <div className={stepStyles.imagePlaceholder} aria-hidden />
                <div className={stepStyles.instructionTextWrapper}>
                    <span className={stepStyles.instructionText}>
                        {ready ? question : t("interimCount.scrConfirmNeedles.loading")}
                    </span>
                </div>
                <div className={stepStyles.buttonRow}>
                    <SCRHayStackButton
                        type="yes"
                        active={ready}
                        title={ready ? t("interimCount.scrConfirmNeedles.yes") : undefined}
                        circleClassName={ready ? stepStyles.confirmColor : stepStyles.grayCircle}
                        onClick={ready ? onYes : undefined}
                    />
                    <SCRHayStackButton type="validate" circleClassName={stepStyles.grayCircle} />
                    <SCRHayStackButton type="action" circleClassName={stepStyles.grayCircle} />
                    <SCRHayStackButton
                        type="no"
                        active={ready}
                        title={ready ? t("interimCount.scrConfirmNeedles.no") : undefined}
                        circleClassName={ready ? stepStyles.noColor : stepStyles.grayCircle}
                        onClick={ready ? onNo : undefined}
                    />
                </div>
            </div>
        </div>
    );
};
