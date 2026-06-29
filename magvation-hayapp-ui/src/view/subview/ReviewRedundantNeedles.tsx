import React, { useLayoutEffect, useRef, useState } from "react";
import styles from "../subviewcss/reviewRedundantNeedles.module.css";
import { useTranslation } from "react-i18next";
import { SutureSheetHeader } from "../../component/SutureSheetHeader";
import { CustomScrollbar } from "../../component/CustomScrollbar";
import { RedundantPackCounter } from "../../component/RedundantPackCounter";
import { RedundantNeedleItem } from "../../types/SutureTypes";
import { formatNeedleUse } from "../../util/setupHelpers";
import { SutureNeedleCategory } from "../../component/CategoryBadge";
import OpenRowLabel from "../../img/OpenRowLabel.svg";
import CloseRowLabel from "../../img/CloseRowLabel.svg";
import JITRowLabel from "../../img/JITRowLabel.svg";
import TableDivider from "../../img/TableDivider.svg";
import UndoWhite from "../../img/UndoWhite.svg";
import WhiteCheck from "../../img/WhiteCheck.svg";
import BlackRightArrow from "../../img/BlackRightArrow.svg";
import { getTipTypeIcon } from "../../util/needleTipUtils";
import Edit from "../../img/Edit.svg";

interface ReviewRedundantNeedlesProps {
    items: RedundantNeedleItem[];
    onBack: () => void;
    onContinue: () => void;
    onSkip: () => void;
    onUpdateRedundantPack: (id: string, newValue: number) => void;
}

export const ReviewRedundantNeedles: React.FC<ReviewRedundantNeedlesProps> = ({
    items,
    onBack,
    onContinue,
    onSkip,
    onUpdateRedundantPack,
}) => {
    const { t } = useTranslation();
    const [showScrollbar, setShowScrollbar] = useState(false);
    const [confirmedItems, setConfirmedItems] = useState<Set<string>>(new Set());
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    const listRef = useRef<HTMLDivElement>(null);

    const THUMB_HEIGHT = 84;

    useLayoutEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const update = () => setShowScrollbar(el.scrollHeight > el.clientHeight + 1);
        update();

        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [items]);

    const getCalculatedValues = (item: RedundantNeedleItem) => {
        const totalNeedles = item.needlesPerPack * item.packsToOpen;
        const totalSuturePacks = item.packsToOpen - item.potentialRedundantPack;
        const finalTotalNeedles = totalSuturePacks * item.needlesPerPack;
        return { totalNeedles, totalSuturePacks, finalTotalNeedles };
    };

    // Calculate total redundant packs and needles
    const totalRedundantPacks = items.reduce((sum, item) => sum + item.potentialRedundantPack, 0);
    const totalRedundantNeedles = items.reduce(
        (sum, item) => sum + item.potentialRedundantPack * item.needlesPerPack,
        0,
    );

    const getCategoryRowLabel = (category: SutureNeedleCategory) => {
        switch (category) {
            case "Open":
                return OpenRowLabel;
            case "Closing":
                return CloseRowLabel;
            case "JIT":
                return JITRowLabel;
            default:
                return OpenRowLabel;
        }
    };

    const handleConfirmItem = (itemId: string) => {
        setConfirmedItems((prev) => new Set(prev).add(itemId));
        // Clear editing mode if we're confirming the item we were editing
        if (editingItemId === itemId) {
            setEditingItemId(null);
        }
    };

    const handleEditItem = (itemId: string) => {
        setConfirmedItems((prev) => {
            const newSet = new Set(prev);
            newSet.delete(itemId);
            return newSet;
        });
        // Set this item as the one being edited
        setEditingItemId(itemId);
    };

    const handleSkipItem = (itemId: string) => {
        // Skip means keep all packs (0 packs are redundant)
        onUpdateRedundantPack(itemId, 0); // No packs are redundant
        setConfirmedItems((prev) => new Set(prev).add(itemId));
        // Clear editing mode if we're skipping the item we were editing
        if (editingItemId === itemId) {
            setEditingItemId(null);
        }
    };

    const getCategoryOrder = (category: SutureNeedleCategory): number => {
        if (category === "Open") return 0;
        if (category === "JIT") return 1;
        if (category === "Closing") return 2;
        return 3;
    };

    const getActiveBorderStyle = (category: SutureNeedleCategory): React.CSSProperties => {
        if (category === "JIT") return { border: "3px solid #FFF" };
        if (category === "Closing") return { border: "3px solid #75CAF8" };
        return { border: "3px solid #D2B2FF" };
    };

    const getConfirmNumberBgColor = (category: SutureNeedleCategory): string => {
        if (category === "JIT") return "#5C5C6B";
        if (category === "Closing") return "#3782C8";
        return "#9C42F5";
    };

    const itemConfirmedCard = (item: RedundantNeedleItem) => {
        // Display NON-redundant packs and needles in confirmed card (what we're keeping)
        const packsToKeep = item.packsToOpen - item.potentialRedundantPack;
        const needlesToKeep = packsToKeep * item.needlesPerPack;
        const packLabel =
            packsToKeep === 1
                ? t("setup.reviewRedundantNeedles.pack", { defaultValue: "Pack" })
                : t("setup.reviewRedundantNeedles.packs", { defaultValue: "Packs" });

        return (
            <div className={styles.confirmCardContainer}>
                <div className={styles.confirmCardContentContainer}>
                    <button className={styles.skipButton} onClick={() => handleEditItem(item.id)}>
                        <img className={styles.undoIcon} src={Edit} alt="Edit" />
                        <span className={styles.skipText}>
                            {t("setup.reviewRedundantNeedles.edit", { defaultValue: "Edit" })}
                        </span>
                    </button>
                    <div className={styles.confirmedTitle}>
                        <img src={WhiteCheck} alt="Confirmed" className={styles.confirmedIcon} />
                        <span className={styles.confirmedText}>
                            {t("setup.reviewRedundantNeedles.confirmed", { defaultValue: "Confirmed" })}
                        </span>
                    </div>
                    <div className={styles.countsContainer}>
                        <div className={styles.countCell}>
                            <span className={styles.countNumber}>{packsToKeep}</span>
                            <span className={styles.countText}>{packLabel}</span>
                        </div>
                        <div className={styles.countCell}>
                            <span className={styles.countNumber}>{needlesToKeep}</span>
                            <span className={styles.countText}>
                                {t("setup.reviewRedundantNeedles.totalNeedlesFinal", { defaultValue: "Total Needles" })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const allItemsConfirmed = confirmedItems.size === items.length;

    const proceedButton = () => {
        return (
            <div className={styles.proceedContainer}>
                <span className={styles.proceedText}>
                    {t("setup.reviewRedundantNeedles.proceedText", {
                        defaultValue: "You can now proceed to the next step.",
                    })}
                </span>
                <button
                    className={styles.proceedButton}
                    disabled={!allItemsConfirmed}
                    onClick={allItemsConfirmed ? onContinue : undefined}
                >
                    <span className={styles.proceedButtonText}>
                        {t("setup.reviewRedundantNeedles.proceed", { defaultValue: "Proceed" })}
                    </span>
                    <img src={BlackRightArrow} alt="Proceed" className={styles.proceedIcon} />
                </button>
            </div>
        );
    };

    const newSutureSheetRender = () => {
        return (
            <div className={styles.container}>
                <SutureSheetHeader
                    title={t("setup.reviewRedundantNeedles.title", { defaultValue: "Review Redundant Needles" })}
                    onBack={onBack}
                    packNumber={totalRedundantPacks}
                    needleNumber={totalRedundantNeedles}
                    redundant={true}
                    onSkip={() => {
                        // Reset all confirmations so skip-all overwrites any partial progress
                        setConfirmedItems(new Set());
                        setEditingItemId(null);
                        onSkip();
                    }}
                />
                <div className={styles.mainContent}>
                    <div ref={listRef} className={styles.scrollableList}>
                        {[...items]
                            .sort(
                                (a, b) =>
                                    getCategoryOrder(a.sutureNeedleCategory) - getCategoryOrder(b.sutureNeedleCategory),
                            )
                            .map((item) => {
                                const calculated = getCalculatedValues(item);
                                // Counter shows packs to KEEP (non-redundant)
                                const packsToKeep = item.packsToOpen - item.potentialRedundantPack;
                                const finalTotalNeedles = packsToKeep * item.needlesPerPack;
                                const needlesPerSuture =
                                    item.numSutures && item.numSutures > 0
                                        ? Math.round(item.needlesPerPack / item.numSutures)
                                        : 0;

                                // Determine if this item should have the active border
                                let isActiveItem = false;
                                if (editingItemId) {
                                    // If we're editing an item, highlight that one
                                    isActiveItem = item.id === editingItemId;
                                } else {
                                    // Otherwise, highlight the first unconfirmed item
                                    const firstUnconfirmedItem = items.find((i) => !confirmedItems.has(i.id));
                                    isActiveItem = !confirmedItems.has(item.id) && firstUnconfirmedItem?.id === item.id;
                                }

                                return (
                                    <div key={item.id} className={styles.rowContainer}>
                                        <div className={styles.rowLeftContainer}>
                                            <div className={styles.rowLabelContainer}>
                                                <div className={styles.rowLabelContent}>
                                                    <img
                                                        src={getCategoryRowLabel(item.sutureNeedleCategory)}
                                                        alt="Row Label"
                                                        className={styles.rowLabel}
                                                    />
                                                </div>
                                            </div>
                                            <div className={styles.rowContentContainer}>
                                                <div className={styles.rowImageContainer}>
                                                    {item.image && (
                                                        <img
                                                            src={`http://localhost:8080/suture_pack_images/${item.image}`}
                                                            alt={item.nomenclature}
                                                            className={styles.rowImage}
                                                        />
                                                    )}
                                                </div>
                                                <div className={styles.rowTableContainer}>
                                                    <div className={styles.rowTableTopContainer}>
                                                        <div className={styles.rowTableTitleContainer}>
                                                            <div className={styles.rowTableTitleContent}>
                                                                <span className={styles.rowTableTitleText}>
                                                                    {item.nomenclature}
                                                                </span>
                                                                <div className={styles.rowTableCode}>
                                                                    <span className={styles.rowTableCodeText}>
                                                                        {item.subLabel}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className={styles.rowTableUseContainer}>
                                                                <span className={styles.rowTableUseTitleText}>
                                                                    {t("setup.reviewRedundantNeedles.intendedUse", {
                                                                        defaultValue: "Intended Use:",
                                                                    })}
                                                                </span>
                                                                <div className={styles.rowTableUse}>
                                                                    <span className={styles.rowTableUseText}>
                                                                        {formatNeedleUse(item.sutureNeedleUse)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className={styles.rowTableBottomContainer}>
                                                        <div className={styles.rowSutureInfoTableContainer}>
                                                            <span className={styles.rowSutureInfoTitleText}>
                                                                {t("setup.reviewRedundantNeedles.sutureInformation", {
                                                                    defaultValue: "Suture Information",
                                                                })}
                                                            </span>
                                                            <div className={styles.rowTableSutureInfoTable}>
                                                                <div className={styles.sutureInfoTableCell}>
                                                                    <span className={styles.cellHeaderText}>
                                                                        {item.sutureLength || "N/A"}
                                                                    </span>
                                                                    <span className={styles.cellTitleText}>
                                                                        {t("setup.reviewRedundantNeedles.length", {
                                                                            defaultValue: "Length",
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                <div className={styles.sutureInfoTableCell}>
                                                                    <span className={styles.cellHeaderText}>
                                                                        {item.sutureColor || "N/A"}
                                                                    </span>
                                                                    <span className={styles.cellTitleText}>
                                                                        {t("setup.reviewRedundantNeedles.color", {
                                                                            defaultValue: "Color",
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                <div className={styles.sutureInfoTableCell}>
                                                                    <span className={styles.cellHeaderText}>
                                                                        {item.sutureStyle || "N/A"}
                                                                    </span>
                                                                    <span className={styles.cellTitleText}>
                                                                        {t("setup.reviewRedundantNeedles.style", {
                                                                            defaultValue: "Style",
                                                                        })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className={styles.needleInfoTable}>
                                                            <div className={styles.needleInfoTopTable}>
                                                                <div className={styles.needleInfoTopCell}>
                                                                    <span className={styles.needleInfoTopNumber}>
                                                                        {item.packsToOpen}
                                                                    </span>
                                                                    <span className={styles.needleInfoTopText}>
                                                                        {t("setup.reviewRedundantNeedles.packs", {
                                                                            defaultValue: "Packs",
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                <div className={styles.needleInfoTopCell}>
                                                                    <span className={styles.needleInfoTopNumber}>
                                                                        {item.numSutures || 1}
                                                                    </span>
                                                                    <span className={styles.needleInfoTopText}>
                                                                        {t(
                                                                            "setup.reviewRedundantNeedles.suturesPerPack",
                                                                            {
                                                                                defaultValue: "Sutures per Pack",
                                                                            },
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div className={styles.needleInfoTopCell}>
                                                                    <span className={styles.needleInfoTopNumber}>
                                                                        {needlesPerSuture}
                                                                    </span>
                                                                    <span className={styles.needleInfoTopText}>
                                                                        {t(
                                                                            "setup.reviewRedundantNeedles.needlesPerSuture",
                                                                            { defaultValue: "Needles per Suture" },
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div className={styles.needleInfoTopCell}>
                                                                    <span className={styles.needleInfoTopNumber}>
                                                                        {calculated.totalNeedles}
                                                                    </span>
                                                                    <span className={styles.needleInfoTopText}>
                                                                        {t(
                                                                            "setup.reviewRedundantNeedles.totalNeedles",
                                                                            {
                                                                                defaultValue: "Total Needles",
                                                                            },
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className={styles.needleInfoBottomTable}>
                                                                <span className={styles.needleInfoBottomTitle}>
                                                                    {t(
                                                                        "setup.reviewRedundantNeedles.needleInformation",
                                                                        {
                                                                            defaultValue: "Needle Information",
                                                                        },
                                                                    )}
                                                                </span>
                                                                <div className={styles.needleInfoBottomTableContent}>
                                                                    <div className={styles.needleInfoBottomCell}>
                                                                        <span className={styles.cellHeaderText}>
                                                                            {item.needleSize || "N/A"}
                                                                        </span>
                                                                        <span className={styles.cellTitleText}>
                                                                            {t("setup.reviewRedundantNeedles.size", {
                                                                                defaultValue: "Size",
                                                                            })}
                                                                        </span>
                                                                    </div>
                                                                    <div className={styles.needleInfoBottomCell}>
                                                                        <span className={styles.cellHeaderText}>
                                                                            {item.needleArc || "N/A"}
                                                                        </span>
                                                                        <span className={styles.cellTitleText}>
                                                                            {t("setup.reviewRedundantNeedles.arc", {
                                                                                defaultValue: "Arc",
                                                                            })}
                                                                        </span>
                                                                    </div>
                                                                    <div className={styles.needleInfoBottomCell}>
                                                                        <div className={styles.tipTypeContainer}>
                                                                            <img
                                                                                className={styles.tipTypeIcon}
                                                                                src={getTipTypeIcon(item.needleTip)}
                                                                                alt="Tip Type"
                                                                            />
                                                                            <span className={styles.cellHeaderText}>
                                                                                {item.needleTip || "N/A"}
                                                                            </span>
                                                                        </div>
                                                                        <span className={styles.cellTitleText}>
                                                                            {t("setup.reviewRedundantNeedles.tipType", {
                                                                                defaultValue: "Tip Type",
                                                                            })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <img
                                                className={styles.tableDivider}
                                                src={TableDivider}
                                                alt="Table Divider"
                                            />
                                        </div>
                                        {confirmedItems.has(item.id) ? (
                                            itemConfirmedCard(item)
                                        ) : (
                                            <div
                                                className={`${styles.confirmCardContainer} ${isActiveItem ? styles.confirmCardContainerActive : ""}`}
                                                style={
                                                    isActiveItem
                                                        ? getActiveBorderStyle(item.sutureNeedleCategory)
                                                        : undefined
                                                }
                                            >
                                                <div className={styles.confirmCardContentContainer}>
                                                    <button
                                                        className={styles.skipButton}
                                                        onClick={() => handleSkipItem(item.id)}
                                                    >
                                                        <img className={styles.undoIcon} src={UndoWhite} alt="Undo" />
                                                        <span className={styles.skipText}>
                                                            {t("setup.reviewRedundantNeedles.skip", {
                                                                defaultValue: "Skip",
                                                            })}
                                                        </span>
                                                    </button>
                                                    <RedundantPackCounter
                                                        value={packsToKeep}
                                                        min={0}
                                                        max={item.packsToOpen}
                                                        onChange={(newPacksToKeep) => {
                                                            // Calculate redundant packs from packs to keep
                                                            const redundantPacks = item.packsToOpen - newPacksToKeep;
                                                            onUpdateRedundantPack(item.id, redundantPacks);
                                                        }}
                                                    />
                                                    <span className={styles.confirmCardText}>
                                                        {t("setup.reviewRedundantNeedles.adjustedPacksAmount", {
                                                            defaultValue: "Adjusted Packs Amount",
                                                        })}
                                                    </span>
                                                    <button
                                                        className={styles.confirmCardButton}
                                                        onClick={() => handleConfirmItem(item.id)}
                                                    >
                                                        <span className={styles.confirmButtonText}>
                                                            {t("setup.reviewRedundantNeedles.confirmTotal", {
                                                                defaultValue: "Confirm Total",
                                                            })}
                                                        </span>
                                                        <div
                                                            className={styles.confirmNumberContainer}
                                                            style={{
                                                                background: getConfirmNumberBgColor(
                                                                    item.sutureNeedleCategory,
                                                                ),
                                                            }}
                                                        >
                                                            <span className={styles.confirmNumberText}>
                                                                {finalTotalNeedles}
                                                            </span>
                                                        </div>
                                                        <span className={styles.confirmButtonText}>
                                                            {t("setup.reviewRedundantNeedles.sutureNeedles", {
                                                                defaultValue: "Suture Needles",
                                                            })}
                                                        </span>
                                                    </button>
                                                    <span className={styles.confirmCardText}>
                                                        {item.potentialRedundantPack}{" "}
                                                        {item.potentialRedundantPack === 1
                                                            ? t("setup.reviewRedundantNeedles.packIs", {
                                                                  defaultValue: "pack is",
                                                              })
                                                            : t("setup.reviewRedundantNeedles.packsAre", {
                                                                  defaultValue: "packs are",
                                                              })}{" "}
                                                        {t("setup.reviewRedundantNeedles.potentiallyRedundant", {
                                                            defaultValue: "potentially redundant",
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        {proceedButton()}
                    </div>

                    {showScrollbar && (
                        <CustomScrollbar
                            targetRef={listRef}
                            thumbHeight={THUMB_HEIGHT}
                            dependency={items}
                            styles={styles}
                        />
                    )}
                </div>
            </div>
        );
    };

    return newSutureSheetRender();
};
