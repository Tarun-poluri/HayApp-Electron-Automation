import React, { useRef, useState, useContext } from "react";
import { AppContext } from "../App";
import styles from "../subviewcss/closingCountVerification.module.css";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import { CIRVerificationCard } from "../../component/CIRVerificationCard";
import ModalHeader from "../../component/ModalHeader";
import LeftArrow from "../../img/LeftArrow.svg";
import GreenDone from "../../img/GreenDone.svg";
import RedClose from "../../img/RedClose.svg";
import NeedleImage from "../../img/NeedleImage.png";
import { useTranslation } from "react-i18next";
import { useListenable } from "../../util/Listenable";

interface ClosingCountVerificationProps {
    onBack: () => void;
    onConfirm: (notSutureIds: string[]) => void;
}

export const ClosingCountVerification: React.FC<ClosingCountVerificationProps> = ({ onBack, onConfirm }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const appContext = useContext(AppContext);

    const cirVerificationResults = useListenable(appContext.caseService.cirVerification);
    const numCards = cirVerificationResults.length;

    const [activeIndex, setActiveIndex] = useState(0);
    const [activatedIndices, setActivatedIndices] = useState<Set<number>>(new Set([0]));
    const [cardSelections, setCardSelections] = useState<Record<number, "yes" | "no" | undefined>>({});
    const sutureNeedles = Object.values(cardSelections).filter((v) => v === "yes").length;
    const notSutureNeedles = Object.values(cardSelections).filter((v) => v === "no").length;

    const handleCardAction = (index: number, value: "yes" | "no") => {
        setCardSelections((prev) => ({ ...prev, [index]: value }));
        setActivatedIndices((prev) => {
            const newSet = new Set(prev);
            newSet.add(index + 1);
            return newSet;
        });
        setActiveIndex((prev) => Math.min(prev + 1, numCards - 1));
    };

    const handleConfirm = async () => {
        const sutureIds: string[] = [];
        const notSutureIds: string[] = [];

        cirVerificationResults.forEach((result, idx) => {
            const id = result?.id;
            const selection = cardSelections[idx];
            if (selection === "yes" && id) {
                sutureIds.push(id);
            } else if (selection === "no" && id) {
                notSutureIds.push(id);
            }
        });

        await appContext.caseService.parlayInterface.caseManager.cir_verified_needles(sutureIds, notSutureIds);

        onConfirm(notSutureIds);
    };

    const anyReviewed = Object.values(cardSelections).some((v) => v !== undefined);

    return (
        <div className={styles.verificationContainer}>
            <div className={styles.backgroundBlur}>
                <div className={styles.progressBarContainer}>
                    {Array.from({ length: numCards }).map((_, idx) => {
                        const isFilled = idx < Object.keys(cardSelections).length && cardSelections[idx] !== undefined;
                        const nextIsFilled =
                            idx + 1 < Object.keys(cardSelections).length && cardSelections[idx + 1] !== undefined;
                        const marginRight = idx === numCards - 1 ? 0 : isFilled && nextIsFilled ? 0 : 4;
                        return (
                            <div
                                key={idx}
                                className={isFilled ? styles.progressBarSectionActive : styles.progressBarSection}
                                style={{ marginRight }}
                            />
                        );
                    })}
                </div>
                <ModalHeader
                    title={t("cirVerification.verification")}
                    onBack={onBack}
                    backIcon={LeftArrow}
                    hideClose
                    hideHelpDivider
                    helpText={t("cirVerification.help")}
                >
                    <div className={styles.itemChip}>
                        <span className={styles.itemChipText}>
                            {numCards} {t("cirVerification.items")}
                        </span>
                    </div>
                </ModalHeader>

                <main className={styles.mainArea}>
                    <section className={styles.leftArea}>
                        <div className={styles.cardScroll} ref={contentRef}>
                            <div className={styles.cardGrid}>
                                {cirVerificationResults.map((result, i) => {
                                    const isActive = activatedIndices.has(i);
                                    const selection = cardSelections[i];
                                    const yesSelected = selection === "yes";
                                    const noSelected = selection === "no";
                                    const reviewed = selection === "yes" || selection === "no";
                                    const gridResult = cirVerificationResults[i]?.results?.[0] ?? {};
                                    const time = cirVerificationResults[i]?.received_time;
                                    const imageNumber = cirVerificationResults[i]?.image_number;
                                    const gridFilename = gridResult.image_filename_used?.split(/[/\\]/).pop();
                                    const gridImageUrl = gridFilename
                                        ? `http://localhost:8080/haystack_object_images/${gridFilename}`
                                        : NeedleImage;
                                    return (
                                        <CIRVerificationCard
                                            key={i}
                                            isActive={isActive}
                                            reviewed={reviewed}
                                            yesSelected={yesSelected}
                                            noSelected={noSelected}
                                            gridImageUrl={gridImageUrl}
                                            i={i}
                                            handleReviewImageClick={() => {}}
                                            handleCardAction={handleCardAction}
                                            activeIndex={activeIndex}
                                            imageNumber={imageNumber}
                                            time={time}
                                            yesLabel={t("closingCountVerification.sutureNeedle")}
                                            noLabel={t("closingCountVerification.notSutureNeedle")}
                                            reviewedLabel={`Image #${imageNumber ?? i + 1}`}
                                            styles={styles}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <CustomScrollbar
                        targetRef={contentRef}
                        thumbHeight={100}
                        dependency={cirVerificationResults}
                        styles={styles}
                        containerStyle={{ height: "68.33vh" }}
                    />
                </main>

                <footer className={styles.footerContainer}>
                    <div className={styles.footerContentContainer}>
                        <div className={styles.footerCountContainer}>
                            <div className={styles.footerInnerCountContainer}>
                                <div className={styles.footerCountSection}>
                                    <div className={styles.confirmedIcon}>
                                        <img src={GreenDone} alt="Confirmed" />
                                    </div>
                                    <span className={styles.countNumber}>{sutureNeedles}</span>
                                    <span className={styles.countLabel}>
                                        {t("closingCountVerification.sutureNeedles")}
                                    </span>
                                </div>
                                <div className={styles.verticalRectangle} />
                                <div className={styles.footerCountSection}>
                                    <div className={styles.confirmedIcon}>
                                        <img src={RedClose} alt="NotConfirmed" />
                                    </div>
                                    <span className={styles.countNumber}>{notSutureNeedles}</span>
                                    <span className={styles.countLabel}>
                                        {t("closingCountVerification.notSutureNeedles")}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            className={`${styles.confirmButton} ${!anyReviewed ? styles.confirmButtonDisabled : ""}`}
                            onClick={handleConfirm}
                            disabled={!anyReviewed}
                        >
                            <span className={styles.confirmButtonText}>{t("cirVerification.confirm")}</span>
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};
