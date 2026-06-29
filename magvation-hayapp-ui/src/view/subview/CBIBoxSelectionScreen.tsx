/** Figma Screens 3.42/3.43 — CBI Box Compartment Selection */
import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/cbiBoxSelectionScreen.module.css";
import { AppContext } from "../App";
import { useListenable } from "../../util/Listenable";
import NeedleImage from "../../img/NeedleImage.png";
import GreenTriangularMarkerDark from "../../img/GreenTriangularMarkerDark.svg";

const CBI_TYPES = ["contaminated", "broken", "incompatible"] as const;

/** Badge color per compartment type (matches needle tap marker colours) */
const BADGE_COLORS: Record<string, string> = {
    contaminated: "#47CE76",
    broken: "#E6A62F",
    incompatible: "#6FC7ED",
};

interface CBIBoxSelectionScreenProps {
    contaminatedCount: number;
    brokenCount: number;
    incompatibleCount: number;
    onConfirm: (selected: string[]) => void;
}

export const CBIBoxSelectionScreen: React.FC<CBIBoxSelectionScreenProps> = ({
    contaminatedCount,
    brokenCount,
    incompatibleCount,
    onConfirm,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const pendingCbiValidations = useListenable(appContext.caseService.pendingCbiValidations);

    const [selected, setSelected] = useState<Record<string, boolean | null>>({
        contaminated: null,
        broken: null,
        incompatible: null,
    });

    const counts: Record<string, number> = {
        contaminated: contaminatedCount,
        broken: brokenCount,
        incompatible: incompatibleCount,
    };

    const allSelected = Object.values(selected).every((v) => v !== null);

    const handleConfirm = () => {
        const selectedKeys = Object.entries(selected)
            .filter(([, v]) => v === false)
            .map(([k]) => k);
        onConfirm(selectedKeys);
    };

    /** Get the most recent CBI image for a given type */
    const getImageForType = (type: string): string => {
        const item = [...pendingCbiValidations].reverse().find((v) => v.type === type && v.image_filename);
        return item?.image_filename ? `http://localhost:8080/hayscan_cbi_images/${item.image_filename}` : NeedleImage;
    };

    return (
        <div className={styles.screenContainer}>
            <div className={styles.contentArea}>
                <span className={styles.instruction}>
                    {t("section1.cbiSelection.instructionLine1")}
                    <br />
                    {t("section1.cbiSelection.instructionLine2")}
                </span>

                <div className={styles.compartmentRow}>
                    {CBI_TYPES.map((type) => (
                        <div
                            key={type}
                            className={`${styles.compartmentCard} ${selected[type] === true ? styles.compartmentCardSelected : ""}`}
                        >
                            <div className={styles.imageWrapper}>
                                <img
                                    className={styles.compartmentImage}
                                    src={getImageForType(type)}
                                    alt={t(`cirDashboard.${type}`)}
                                />
                                {type === "contaminated" ? (
                                    <div className={styles.compartmentBadgeTriangle}>
                                        <img
                                            src={GreenTriangularMarkerDark}
                                            className={styles.triangleBadgeSvg}
                                            alt=""
                                        />
                                        <span className={styles.triangleBadgeNumber}>{counts[type]}</span>
                                    </div>
                                ) : (
                                    <div
                                        className={`${styles.compartmentBadge} ${type === "incompatible" ? styles.compartmentBadgeIncompatible : ""}`}
                                        style={{ borderColor: BADGE_COLORS[type] }}
                                    >
                                        {counts[type]}
                                    </div>
                                )}
                            </div>
                            <span className={styles.compartmentLabel}>{t(`cirDashboard.${type}`)}</span>
                            <div className={styles.toggleRow}>
                                <button
                                    className={`${styles.toggleNo} ${selected[type] === false ? styles.toggleNoActive : ""}`}
                                    onClick={() => setSelected((prev) => ({ ...prev, [type]: false }))}
                                >
                                    {t("section1.cbiSelection.no")} <span className={styles.toggleIcon}>&#10005;</span>
                                </button>
                                <button
                                    className={`${styles.toggleYes} ${selected[type] === true ? styles.toggleYesActive : ""}`}
                                    onClick={() => setSelected((prev) => ({ ...prev, [type]: true }))}
                                >
                                    {t("section1.cbiSelection.yes")} <span className={styles.toggleIcon}>&#10003;</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    className={`${styles.confirmButton} ${!allSelected ? styles.confirmButtonDisabled : ""}`}
                    onClick={handleConfirm}
                    disabled={!allSelected}
                >
                    {t("section1.cbiSelection.confirm")}
                </button>
            </div>
        </div>
    );
};
