import React, { useCallback, useContext, useRef, useState, RefObject, ReactNode, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "../viewcss/CIRCBINeedlesScreen.module.css";
import { DynamicButton } from "../component/PillButton";
import { AppContext } from "./App";
import ModalHeader from "../component/ModalHeader";
import CloseIcon from "../img/WhiteClose.svg";
import QuestionMessageIcon from "../img/QuestionMessage.svg";
import RedCloseNoBgIcon from "../img/RedCloseNoBg.svg";
import GreenCheckIcon from "../img/GreenCheck.svg";
import CaptureItemIcon from "../img/CaptureItemIcon.svg";
import BlackRightArrowIcon from "../img/BlackRightArrow.svg";
import UndoIcon from "../img/Undo.svg";
import WhiteUndoIcon from "../img/WhiteUndo.svg";
import BlackCloseIcon from "../img/BlackClose.svg";
import ContaminatedNeedleImage from "../img/ContaminatedNeedle.svg";
import BrokenNeedleImage from "../img/BrokenNeedle.svg";
import IncompatibleNeedleImage from "../img/IncompatibleNeedle.svg";
import MisplacedNeedleImage from "../img/MisplacedNeedle.svg";
import ContaminatedCBI from "../img/ContaminatedCBI.svg";
import IncompatibleCBI from "../img/IncompatibleCBI.svg";
import BrokenCBI from "../img/BrokenCBI.svg";
import TakePhotoContaminated from "../img/TakePhotoContaminated.svg";
import TakePhotoIncompatible from "../img/TakePhotoIncompatible.svg";
import TakePhotoBroken from "../img/TakePhotoBroken.svg";
import WhiteBubbleArrowIcon from "../img/WhiteBubbleArrow.svg";
import ContaminatedNeedleMarkerImage from "../img/ContaminatedNeedleMarker.svg";
import BrokenNeedleMarkerImage from "../img/BrokenNeedleMarker.svg";
import IncompatibleNeedleMarkerImage from "../img/IncompatibleNeedleMarker.svg";
import CBIBoxCompartments from "../img/CBIBoxCompartments.svg";
import { useListenable } from "../util/Listenable";
import type { AdjudicationData } from "../services/CaseService";

// --- Types ---
type CBINeedlesEntryPoint = "contaminated" | "incompatible" | "broken" | "misplaced" | "select";
type CBINeedleType = "contaminated" | "incompatible" | "broken";
type CBINeedlesScreen =
    | "choose-type"
    | "what-was-found"
    | "question"
    | "capture-initial"
    | "capture-image"
    | "photo-confirmation"
    | "count-needles";
interface NeedleMarker {
    id: number;
    x: number;
    y: number;
    number: number;
    type: CBINeedleType;
}
interface CBINeedlesState {
    entryPoint: CBINeedlesEntryPoint;
    currentScreen: CBINeedlesScreen;
    selectedNeedleType: CBINeedleType | null;
    resolvedNeedleType: CBINeedleType | null;
    needleMarkers: NeedleMarker[];
    needleCount: number;
    photoAccepted: boolean;
    questionAnswered: "yes" | "no" | null;
    lastConfirmedAt: Date | null;
    lastAction?: string;
    updatedAt: number;
    imageSrc: string | null;
    misplaced: boolean;
    imageNaturalWidth: number;
    imageNaturalHeight: number;
}

function computeInitialScreen(entryPoint: CBINeedlesEntryPoint, skipBrokenQuestion?: boolean): CBINeedlesScreen {
    if (skipBrokenQuestion && entryPoint === "broken") return "capture-initial";
    // All entry points start at the Identify & Record screen
    return "capture-initial";
}
function computeResolvedNeedleType(
    entryPoint: CBINeedlesEntryPoint,
    selected: CBINeedleType | null,
): CBINeedleType | null {
    if (entryPoint === "select" || entryPoint === "misplaced") return selected;
    return entryPoint as CBINeedleType;
}

function CaptureImageCard({
    imageNumber,
    imageTime,
    imageSrc,
    imageAlt = "Captured photo",
    onClick,
    containerRef,
    imgRef,
    onImgLoad,
    children,
}: {
    imageNumber?: number | null;
    imageTime?: string | null;
    imageSrc?: string | null;
    imageAlt?: string;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    containerRef?: RefObject<HTMLDivElement>;
    imgRef?: RefObject<HTMLImageElement>;
    onImgLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
    children?: ReactNode;
}) {
    const { t } = useTranslation();
    const resolvedImageSrc = imageSrc || undefined;

    return (
        <div className={styles.imageCard}>
            <div
                ref={containerRef}
                className={styles.imageContainer}
                onClick={onClick}
                style={{ position: "relative" }}
            >
                <img
                    ref={imgRef}
                    src={resolvedImageSrc}
                    alt={imageAlt}
                    className={styles.image}
                    onLoad={onImgLoad}
                    onError={(e) => {
                        e.currentTarget.style.display = "none";
                    }}
                />
                {/* Overlay info at bottom right */}
                {(imageNumber !== undefined || imageTime) && (
                    <div className={styles.imageInfoOverlay}>
                        {imageNumber !== undefined && imageNumber !== null && (
                            <span
                                className={styles.imageInfoText}
                            >{`${t("cbi.captureItem.imageNumber")}${imageNumber}`}</span>
                        )}
                        {imageTime && <span className={styles.imageInfoText}>{imageTime}</span>}
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}

function QuestionScreen({
    onYes,
    onNo,
    onBack,
    onClose,
}: {
    onYes: () => void;
    onNo: () => void;
    onBack: () => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className={styles.captureScreen}>
            <ModalHeader title={t("cbi.question.header")} onBack={onBack} onClose={onClose} showLeftPadding={true} />

            <main className={styles.captureBrokenMain}>
                <div className={styles.questionPanelContainer}>
                    <div className={styles.questionScreenContainer}>
                        <div className={styles.brokenContentContainer}>
                            <img src={QuestionMessageIcon} alt="Broken Needle" className={styles.brokenIcon} />
                            <h2 className={styles.questionTitle}>{t("cbi.broken.question")}</h2>
                            <div className={styles.brokenNeedlesConfirmationButtons}>
                                <DynamicButton
                                    label={t("cbi.broken.no")}
                                    borderColor="#ff465e"
                                    textColor="#ff465e"
                                    fullWidth
                                    Icon={<img src={RedCloseNoBgIcon} alt="Close" />}
                                    onClick={onNo}
                                    isActive={false}
                                    disabled={false}
                                />
                                <DynamicButton
                                    label={t("cbi.broken.yes")}
                                    borderColor="#3ebcab"
                                    textColor="#3ebcab"
                                    fullWidth
                                    Icon={<img src={GreenCheckIcon} alt="Done" />}
                                    onClick={onYes}
                                    isActive={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function CaptureItemScreen({
    onProceed,
    onBack,
    onClose,
    screenType = "initial",
    needleType,
    questionAnswered = "no",
    skipBrokenQuestion = false,
    entryPoint,
}: {
    onProceed: () => void;
    onBack: () => void;
    onClose: () => void;
    screenType?: "initial" | "capture";
    needleType?: CBINeedleType | "misplaced";
    questionAnswered?: "yes" | "no";
    skipBrokenQuestion?: boolean;
    entryPoint?: CBINeedlesEntryPoint;
}) {
    const { t } = useTranslation();

    function getInstructions() {
        const highlightClass = styles.cbiBoxHighlight;
        const highlightComponent = <span className={highlightClass} />;
        const highlightClasses: Record<CBINeedleType, string> = {
            contaminated: styles.contaminatedHighlight,
            broken: styles.brokenHighlight,
            incompatible: styles.incompatibleHighlight,
        };
        if (screenType === "capture") {
            const captureKeys: Record<CBINeedleType, string> = {
                contaminated: "cbi.captureItem.captureInstructionContaminated",
                broken: "cbi.captureItem.captureInstructionBroken",
                incompatible: "cbi.captureItem.captureInstructionIncompatible",
            };
            if (needleType && needleType in captureKeys) {
                return (
                    <p className={styles.instructionText}>
                        <Trans
                            i18nKey={captureKeys[needleType as CBINeedleType]}
                            components={{
                                highlight: <span className={highlightClasses[needleType as CBINeedleType]} />,
                            }}
                        />
                    </p>
                );
            }
            return (
                <p className={styles.instructionText}>
                    <Trans
                        i18nKey="cbi.captureItem.captureInstruction-2.24"
                        components={{ highlight: highlightComponent }}
                    />
                </p>
            );
        }

        // For misplaced flow with broken (fragment) - must come before general broken check
        if (entryPoint === "misplaced" && needleType === "broken" && screenType === "initial") {
            return (
                <p className={styles.instructionText}>
                    <Trans
                        i18nKey="cbi.broken.captureItem.instructionMisplaced"
                        components={{
                            highlight: <span className={highlightClasses[needleType as CBINeedleType]} />,
                        }}
                    />
                </p>
            );
        }

        // Initial screen instructions for broken needle
        if (needleType === "broken" && screenType === "initial") {
            // Non-adjudication paths: question removed, show direct placement instruction
            if (!skipBrokenQuestion) {
                return (
                    <p className={styles.instructionText}>
                        <Trans
                            i18nKey="cbi.broken.captureItem.instructionSelectDirect"
                            components={{
                                highlight: <span className={highlightClasses[needleType as CBINeedleType]} />,
                            }}
                        />
                    </p>
                );
            }
            // Adjudication path (skipBrokenQuestion=true) falls through to the check below
        }

        if (needleType === "incompatible" && screenType === "initial") {
            return (
                <p className={styles.instructionText}>
                    <Trans
                        i18nKey="cbi.incompatible.captureItem.instructionInitial"
                        components={{
                            highlight: <span className={highlightClasses[needleType as CBINeedleType]} />,
                        }}
                    />
                </p>
            );
        }

        if (
            entryPoint === "select" &&
            screenType === "initial" &&
            needleType !== "broken" &&
            needleType !== "incompatible"
        ) {
            return (
                <p className={styles.instructionText}>
                    <Trans
                        i18nKey="cbi.captureItem.instructionSelectInitial"
                        components={{ highlight: highlightComponent }}
                    />
                </p>
            );
        }

        if (needleType === "broken" && skipBrokenQuestion && screenType === "initial") {
            return (
                <p className={styles.instructionText}>
                    <Trans
                        i18nKey="cbi.broken.captureItem.instructionAdjudicationPart1"
                        components={{
                            highlight: <span className={highlightClasses[needleType as CBINeedleType]} />,
                        }}
                    />
                </p>
            );
        }

        // For contaminated entry point with initial screen
        if (entryPoint === "contaminated" && needleType === "contaminated" && screenType === "initial") {
            return (
                <p className={styles.instructionText}>
                    <Trans
                        i18nKey="cbi.captureItem.instructionPart1"
                        components={{
                            highlight: <span className={highlightClasses[needleType as CBINeedleType]} />,
                        }}
                    />
                    {"\n"}
                    {t("cbi.captureItem.cbiBox")} {t("cbi.captureItem.instructionPart2")}
                </p>
            );
        }

        // For misplaced flow with contaminated (complete suture needle)
        if (entryPoint === "misplaced" && needleType === "contaminated" && screenType === "initial") {
            return (
                <p className={styles.instructionText}>
                    <Trans
                        i18nKey="cbi.captureItem.instructionPart1"
                        components={{
                            highlight: <span className={highlightClasses[needleType as CBINeedleType]} />,
                        }}
                    />
                    {"\n"}
                    {t("cbi.captureItem.cbiBox")} {t("cbi.captureItem.instructionPart2")}
                </p>
            );
        }

        if (needleType === "broken") {
            const instructionKey =
                questionAnswered === "yes"
                    ? "cbi.broken.captureItem.instructionPart1Plural"
                    : "cbi.broken.captureItem.instructionPart1";
            return (
                <p className={styles.instructionText}>
                    {t(instructionKey)}
                    {"\n"}
                    <Trans
                        i18nKey="cbi.broken.captureItem.instructionHighlight"
                        values={{ box: t("cbi.captureItem.cbiBox") }}
                        components={{ highlight: highlightComponent }}
                    />
                </p>
            );
        }

        return (
            <p className={styles.instructionText}>
                {t("cbi.captureItem.instructionPart1")}
                {"\n"}
                <Trans
                    i18nKey="cbi.captureItem.instructionHighlight"
                    values={{ box: t("cbi.captureItem.cbiBox") }}
                    components={{ highlight: highlightComponent }}
                />
                {"\n"}
                {t("cbi.captureItem.instructionPart2")}
            </p>
        );
    }

    const showProceedButton = screenType === "initial";

    // Determine the header title based on screen state
    function getHeaderTitle(): string | undefined {
        if (screenType === "initial") {
            // For misplaced flow, show specific titles
            if (entryPoint === "misplaced") {
                if (needleType === "broken") {
                    return t("cbi.captureItem.title-2.24"); // Capture Suture Needle Fragment Image
                }
                if (needleType === "contaminated") {
                    return t("cbi.captureItem.titleContaminated"); // Contaminated Suture Needles
                }
            }
            // For "select" entry point
            if (entryPoint === "select") {
                // broken+yes shows the two-fragments title; broken+no and incompatible skip capture-initial entirely
                if (needleType === "broken" && questionAnswered === "yes") {
                    return t("cbi.captureItem.titleBrokenTwoFragments");
                }
                return t("cbi.captureItem.titleIdentifyRecord");
            }
            // Adjudication path: skipBrokenQuestion means they already confirmed having the other piece
            if (skipBrokenQuestion && needleType === "broken") {
                return t("cbi.captureItem.title-2.23");
            }
            // Broken notification flow: first screen before any question
            if (entryPoint === "broken" && needleType === "broken" && questionAnswered !== "yes") {
                return t("cbi.captureItem.titleBrokenNotification");
            }
            // For other entry points (contaminated and incompatible no longer reach capture-initial)
            if (needleType === "broken" && questionAnswered === "yes") {
                return t("cbi.captureItem.titleBrokenTwoFragments");
            }
        }
        if (screenType === "capture") {
            if (needleType === "contaminated") {
                return t("cbi.captureItem.titleContaminated");
            }
            if (needleType === "incompatible") {
                return t("cbi.captureItem.titleIncompatible");
            }
            if (needleType === "broken") {
                return t("cbi.captureItem.title-2.24");
            }
            return t("cbi.captureItem.title-2.24");
        }
        return undefined;
    }
    const headerTitle = getHeaderTitle() || t("cbi.captureItem.title");

    // Select the appropriate image based on screen type and needle type
    function getImage() {
        // For capture screen, always show TakePhotoCBI regardless of type
        if (screenType === "capture") {
            if (needleType === "contaminated") {
                return TakePhotoContaminated;
            }
            if (needleType === "incompatible") {
                return TakePhotoIncompatible;
            }
            if (needleType === "broken") {
                return TakePhotoBroken;
            }
            return TakePhotoContaminated;
        }

        // For "select" entry point on initial screen before type selection, show CBIBoxCompartments
        // Check this BEFORE specific needle types
        if (entryPoint === "select" && screenType === "initial" && !needleType) {
            return CBIBoxCompartments;
        }

        // For initial screen, show type-specific images
        if (needleType === "contaminated") {
            return ContaminatedCBI;
        }
        if (needleType === "incompatible") {
            return IncompatibleCBI;
        }
        if (needleType === "broken") {
            return BrokenCBI;
        }

        return CaptureItemIcon;
    }

    return (
        <div className={styles.captureScreen}>
            <ModalHeader title={headerTitle} onBack={onBack} onClose={onClose} showLeftPadding={true} />
            <main className={screenType === "capture" ? styles.capturePhotoMain : styles.captureMain}>
                <img src={getImage()} alt="Capture Item" />
                <div className={styles.captureInstructions}>
                    {getInstructions()}

                    {showProceedButton && (
                        <div className={styles.proceedButtonContainer}>
                            <DynamicButton
                                label={t("cbi.captureItem.proceed")}
                                bgColor="#fff"
                                borderColor="#fff"
                                textColor="#000"
                                fullWidth
                                Icon={<img src={BlackRightArrowIcon} alt="Proceed" />}
                                onClick={onProceed}
                                isActive={false}
                            />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function PhotoConfirmationScreen({
    onRetake,
    onYes,
    onBack,
    onClose,
    imageSrc,
    imageNumber,
    imageTime,
    needleType = "contaminated",
    onImgLoad,
}: {
    onRetake: () => void;
    onYes: () => void;
    onBack: () => void;
    onClose: () => void;
    imageSrc?: string | null;
    imageNumber?: number | null;
    imageTime?: string | null;
    needleType?: CBINeedleType | "misplaced";
    onImgLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
    const { t } = useTranslation();

    // Determine header title based on needle type
    function getHeaderTitle(): string {
        if (needleType === "contaminated") {
            return t("cbi.captureItem.titleContaminated");
        }
        if (needleType === "incompatible") {
            return t("cbi.captureItem.titleIncompatible");
        }
        return t("cbi.captureItem.title-2.24");
    }
    const headerTitle = getHeaderTitle();

    return (
        <div className={styles.captureScreen}>
            <ModalHeader title={headerTitle} onBack={onBack} onClose={onClose} showLeftPadding={true} />

            <main className={styles.adjMain}>
                <div className={styles.adjContainer}>
                    <CaptureImageCard
                        imageSrc={imageSrc}
                        imageNumber={imageNumber}
                        imageTime={imageTime}
                        onImgLoad={onImgLoad}
                    />

                    <div className={styles.photoConfirmationPanel}>
                        <div className={styles.photoConfirmationPanelInner}>
                            <div className={styles.photoConfirmationBody}>
                                <h2 className={styles.photoConfirmationTitle}>{t("cbi.photoConfirmation.question")}</h2>
                                <div className={styles.confirmationButtons}>
                                    <DynamicButton
                                        label={t("cbi.photoConfirmation.retake")}
                                        bgColor="#777481"
                                        borderColor="#000000"
                                        textColor="#fff"
                                        fullWidth
                                        onClick={onRetake}
                                        isActive={false}
                                    />
                                    <DynamicButton
                                        label={t("cbi.photoConfirmation.yes")}
                                        bgColor="#fff"
                                        borderColor="#000"
                                        fullWidth
                                        textColor="#000"
                                        onClick={onYes}
                                        isActive={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function CountNeedlesScreen({
    onBack,
    onClose,
    onConfirm,
    onAddMarker,
    onUndo,
    onClear,
    needleMarkers,
    canConfirm,
    imageSrc,
    imageNumber,
    imageTime,
    needleType = "contaminated",
    entryPoint,
    showMarkers,
    onToggleMarkers,
}: {
    onBack: () => void;
    onClose: () => void;
    onConfirm: () => void;
    onAddMarker: (x: number, y: number) => void;
    onUndo: () => void;
    onClear: () => void;
    needleMarkers: NeedleMarker[];
    canConfirm: boolean;
    imageSrc?: string | null;
    imageNumber?: number | null;
    imageTime?: string | null;
    needleType?: CBINeedleType | "misplaced";
    entryPoint?: CBINeedlesEntryPoint;
    showMarkers: boolean;
    onToggleMarkers: () => void;
}) {
    const { t } = useTranslation();

    const imageContainerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const [imgDims, setImgDims] = useState({
        displayedWidth: 900,
        displayedHeight: 875,
        naturalWidth: 900,
        naturalHeight: 875,
    });

    const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setImgDims({
            displayedWidth: img.offsetWidth,
            displayedHeight: img.offsetHeight,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
        });
    };

    useEffect(() => {
        function updateDims() {
            if (imgRef.current) {
                setImgDims({
                    displayedWidth: imgRef.current.offsetWidth,
                    displayedHeight: imgRef.current.offsetHeight,
                    naturalWidth: imgRef.current.naturalWidth,
                    naturalHeight: imgRef.current.naturalHeight,
                });
            }
        }
        updateDims();
        window.addEventListener("resize", updateDims);
        return () => window.removeEventListener("resize", updateDims);
    }, [imageSrc]);

    const count = needleMarkers.length;

    function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
        if (!imageContainerRef.current || !imgRef.current) return;
        const container = imageContainerRef.current;
        const img = imgRef.current;
        const rect = container.getBoundingClientRect();
        const displayedWidth = img.offsetWidth;
        const displayedHeight = img.offsetHeight;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const xNatural = (x / displayedWidth) * naturalWidth;
        const yNatural = (y / displayedHeight) * naturalHeight;

        onAddMarker(xNatural, yNatural);
    }

    // Use percentages for marker positioning
    const displayedMarkers =
        imgDims.naturalWidth > 1 && imgDims.naturalHeight > 1
            ? needleMarkers.map((marker) => ({
                  ...marker,
                  leftPercent: (marker.x / imgDims.naturalWidth) * 100,
                  topPercent: (marker.y / imgDims.naturalHeight) * 100,
              }))
            : [];

    const handleUndo = () => {
        onUndo();
    };

    const handleClearAll = () => {
        onClear();
    };

    // Determine header title based on needle type
    function getHeaderTitle(): string {
        const typeNameMap: Partial<Record<CBINeedleType | "misplaced", string>> = {
            contaminated: t("cbi.select.contaminated.name"),
            incompatible: t("cbi.select.incompatible.name"),
            broken: t("cbi.select.broken.name"),
        };
        const typeName = needleType ? (typeNameMap[needleType] ?? "") : "";
        return t("cbi.countNeedles.header", { type: typeName });
    }
    const headerTitle = getHeaderTitle() || t("cbi.captureItem.title");

    return (
        <div className={styles.captureScreen}>
            <ModalHeader title={headerTitle} onBack={onBack} onClose={onClose} showLeftPadding={true} />

            <main className={styles.adjMain}>
                <div className={styles.adjContainer}>
                    <CaptureImageCard
                        containerRef={imageContainerRef as React.RefObject<HTMLDivElement>}
                        imgRef={imgRef as React.RefObject<HTMLImageElement>}
                        onClick={handleImageClick}
                        imageSrc={imageSrc}
                        imageNumber={imageNumber}
                        imageTime={imageTime}
                        onImgLoad={handleImgLoad}
                    >
                        {/* Marker toggle button */}
                        <button
                            className={styles.markerToggleButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onToggleMarkers();
                            }}
                            type="button"
                        >
                            {showMarkers ? t("cbi.hideMarkers") : t("cbi.showMarkers")}
                        </button>

                        {/* Marker overlay - check showMarkers state */}
                        {showMarkers &&
                            displayedMarkers.map((position) => (
                                <div
                                    key={position.id}
                                    className={styles.needleIconWrapper}
                                    style={{
                                        left: `${position.leftPercent}%`,
                                        top: `${position.topPercent}%`,
                                    }}
                                >
                                    <img
                                        src={
                                            needleType === "incompatible"
                                                ? IncompatibleNeedleMarkerImage
                                                : needleType === "broken"
                                                  ? BrokenNeedleMarkerImage
                                                  : ContaminatedNeedleMarkerImage
                                        }
                                        alt="Needle marker"
                                    />
                                    <span className={styles.needleNumber}>{position.number}</span>
                                </div>
                            ))}
                    </CaptureImageCard>

                    <div className={styles.countNeedlesPanel}>
                        <div className={styles.countNeedlesPanelInner}>
                            <div className={styles.countNeedlesBody}>
                                <h2 className={styles.countNeedlesTitle}>
                                    {needleType === "incompatible" ? (
                                        <Trans
                                            i18nKey="cbi.incompatible.countNeedles.instructionFull"
                                            components={{ highlight: <span className={styles.cbiBoxHighlight} /> }}
                                        />
                                    ) : entryPoint === "misplaced" && needleType === "contaminated" ? (
                                        <>
                                            {t("cbi.countNeedles.instructionMisplacedContaminated")}{" "}
                                            <span className={styles.cbiBoxHighlight}>
                                                {t("cbi.countNeedles.instructionPart2")}
                                            </span>
                                        </>
                                    ) : entryPoint === "contaminated" && needleType === "contaminated" ? (
                                        <Trans
                                            i18nKey="cbi.countNeedles.instructionContaminatedSelect"
                                            components={{ highlight: <span className={styles.cbiBoxHighlight} /> }}
                                        />
                                    ) : entryPoint === "select" && needleType === "contaminated" ? (
                                        <Trans
                                            i18nKey="cbi.countNeedles.instructionContaminatedSelect"
                                            components={{ highlight: <span className={styles.cbiBoxHighlight} /> }}
                                        />
                                    ) : (
                                        <>
                                            {t("cbi.countNeedles.instructionPart1")}{" "}
                                            <span className={styles.cbiBoxHighlight}>
                                                {t("cbi.countNeedles.instructionPart2")}
                                            </span>
                                        </>
                                    )}
                                </h2>
                                <div className={styles.countControls}>
                                    <div className={styles.buttonRow}>
                                        <div className={styles.needleCountButtonContainer}>
                                            <DynamicButton
                                                label={`${t("cbi.countNeedles.undo")}`}
                                                bgColor="#777481"
                                                borderColor="#000000"
                                                textColor="#fff"
                                                disabledBgColor="#53515A"
                                                disabledBorderColor="#000000"
                                                disabledTextColor="#000000"
                                                opacity={1}
                                                fullWidth
                                                inactiveIcon={<img src={UndoIcon} alt="Undo" />}
                                                Icon={<img src={WhiteUndoIcon} alt="Undo" />}
                                                onClick={handleUndo}
                                                disabled={count === 0}
                                            />
                                        </div>
                                        <div className={styles.needleCountButtonContainer}>
                                            <DynamicButton
                                                label={`${t("cbi.countNeedles.clearAll")}`}
                                                bgColor="#777481"
                                                borderColor="#000000"
                                                textColor="#fff"
                                                disabledBgColor="#53515A"
                                                disabledBorderColor="#000000"
                                                disabledTextColor="#000000"
                                                opacity={1}
                                                fullWidth
                                                inactiveIcon={<img src={BlackCloseIcon} alt="Clear All" />}
                                                Icon={<img src={CloseIcon} alt="Clear All" />}
                                                onClick={handleClearAll}
                                                disabled={count === 0}
                                                isActive={false}
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.countDisplay}>
                                        <div className={styles.countNumber}>{count}</div>
                                    </div>
                                </div>

                                <DynamicButton
                                    label={t("cbi.countNeedles.confirm")}
                                    bgColor="#FFFFFF"
                                    borderColor="#000000"
                                    textColor="#000000"
                                    disabledBgColor="#53515A"
                                    disabledBorderColor="#000000"
                                    disabledTextColor="#000000"
                                    opacity={1}
                                    onClick={onConfirm}
                                    disabled={!canConfirm}
                                    fullWidth={true}
                                    isActive={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function ChooseItemTypeScreen({
    onContaminatedClick,
    onBrokenClick,
    onIncompatibleClick,
    onMisplacedClick,
    onBack,
    onClose,
    showMisplaced,
}: {
    onContaminatedClick: () => void;
    onBrokenClick: () => void;
    onIncompatibleClick: () => void;
    onMisplacedClick: () => void;
    onBack: () => void;
    onClose: () => void;
    showMisplaced?: boolean;
}) {
    const { t } = useTranslation();

    return (
        <div className={styles.captureScreen}>
            <ModalHeader
                title={t("cbi.select.titleIdentify")}
                onBack={onBack}
                onClose={onClose}
                showLeftPadding={true}
            />

            <main className={styles.chooseTypeMain}>
                <h2 className={styles.chooseTypeTitle}>{t("cbi.select.title")}</h2>

                <div className={styles.chooseTypeGrid}>
                    <button
                        className={`${styles.chooseTypeCard} ${styles.contaminatedCard}`}
                        onClick={onContaminatedClick}
                    >
                        <div className={styles.chooseTypeIcon}>
                            <img src={ContaminatedNeedleImage} alt="Contaminated Needle" />
                        </div>
                        <div className={styles.chooseTypeTextBlock}>
                            <span className={styles.chooseTypeName}>{t("cbi.select.contaminated.name")}</span>
                            <span className={styles.chooseTypeLabel}>{t("cbi.select.contaminated.label")}</span>
                        </div>
                        <div className={styles.chooseTypeArrow}>
                            <img src={WhiteBubbleArrowIcon} alt="Arrow" />
                        </div>
                    </button>

                    <button className={`${styles.chooseTypeCard} ${styles.brokenCard}`} onClick={onBrokenClick}>
                        <div className={styles.chooseTypeIcon}>
                            <img src={BrokenNeedleImage} alt="Broken Needle" />
                        </div>
                        <div className={styles.chooseTypeTextBlock}>
                            <span className={styles.chooseTypeName}>{t("cbi.select.broken.name")}</span>
                            <span className={styles.chooseTypeLabel}>{t("cbi.select.broken.label")}</span>
                        </div>
                        <div className={styles.chooseTypeArrow}>
                            <img src={WhiteBubbleArrowIcon} alt="Arrow" />
                        </div>
                    </button>

                    <button
                        className={`${styles.chooseTypeCard} ${styles.incompatibleCard}`}
                        onClick={onIncompatibleClick}
                    >
                        <div className={styles.chooseTypeIcon}>
                            <img src={IncompatibleNeedleImage} alt="Incompatible Needle" />
                        </div>
                        <div className={styles.chooseTypeTextBlock}>
                            <span className={styles.chooseTypeName}>{t("cbi.select.incompatible.name")}</span>
                            <span className={styles.chooseTypeLabel}>{t("cbi.select.incompatible.label")}</span>
                        </div>
                        <div className={styles.chooseTypeArrow}>
                            <img src={WhiteBubbleArrowIcon} alt="Arrow" />
                        </div>
                    </button>
                </div>
                {showMisplaced && (
                    <div className={styles.chooseTypeBottomRow}>
                        <button
                            className={`${styles.chooseTypeCard} ${styles.misplacedCard}`}
                            onClick={onMisplacedClick}
                        >
                            <div className={styles.chooseTypeIcon}>
                                <img src={MisplacedNeedleImage} alt="Misplaced Needle" />
                            </div>
                            <div className={styles.chooseTypeTextBlock}>
                                <span className={styles.chooseTypeName}>{t("cbi.select.misplaced.name")}</span>
                                <span className={styles.chooseTypeLabel}>{t("cbi.select.misplaced.label")}</span>
                            </div>
                            <div className={styles.chooseTypeArrow}>
                                <img src={WhiteBubbleArrowIcon} alt="Arrow" />
                            </div>
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

function WhatWasFoundScreen({
    onCompleteNeedleClick,
    onFragmentClick,
    onBack,
    onClose,
}: {
    onCompleteNeedleClick: () => void;
    onFragmentClick: () => void;
    onBack: () => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className={styles.captureScreen}>
            <ModalHeader title={t("cbi.question.header")} onBack={onBack} onClose={onClose} showLeftPadding={true} />

            <main className={styles.captureBrokenMain}>
                <div className={styles.questionContainer}>
                    <h2 className={styles.whatWasFoundTitle}>{t("misplaced.whatWasFound")}</h2>
                </div>

                <div className={styles.optionsContainer}>
                    <div className={styles.optionCard} onClick={onCompleteNeedleClick}>
                        <div className={styles.cardBorder} style={{ borderColor: "#1DA593" }}>
                            <div className={styles.cardIcon}>
                                <img src={ContaminatedNeedleImage} alt="Complete Suture Needle" />
                            </div>
                            <div className={styles.cardTitle}>{t("misplaced.completeSutureNeedle")}</div>
                            <div className={styles.cardArrow}>
                                <img src={WhiteBubbleArrowIcon} alt="Arrow" />
                            </div>
                        </div>
                    </div>

                    <div className={styles.optionCard} onClick={onFragmentClick}>
                        <div className={styles.cardBorder} style={{ borderColor: "#E6A62F" }}>
                            <div className={styles.cardIcon}>
                                <img src={BrokenNeedleImage} alt="Fragment of a Broken Needle" />
                            </div>
                            <div className={styles.cardTitle}>{t("misplaced.fragmentOfBrokenNeedle")}</div>
                            <div className={styles.cardArrow}>
                                <img src={WhiteBubbleArrowIcon} alt="Arrow" />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// --- Main Component ---
export default function CIRCBINeedlesScreen({
    needleType = "contaminated",
    skipBrokenQuestion = false,
    reAdjudicationData,
    onComplete,
    onBack,
    fromFoundNonSterile = false,
}: {
    needleType?: CBINeedlesEntryPoint;
    skipBrokenQuestion?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reAdjudicationData?: any;
    onComplete?: () => void;
    onBack?: () => void;
    fromFoundNonSterile?: boolean;
}) {
    const appContext = useContext(AppContext);
    const cbiImage = useListenable(appContext.caseService.cbiImage);
    const misplacedCount = useListenable(appContext.caseService.misplaced);
    const wholeMisplacedCount = useListenable(appContext.caseService.wholeMisplaced);
    const hasMisplaced = (misplacedCount ?? 0) + (wholeMisplacedCount ?? 0) > 0;

    // Clear old photo state when component mounts OR when needleType changes to prevent reuse
    useEffect(() => {
        appContext.caseService.cbiImage.set(null);
    }, [needleType, appContext.caseService]);

    const [state, setState] = useState<CBINeedlesState>(() => {
        // If we have re-adjudication data, start in count-needles screen with existing markers
        if (reAdjudicationData) {
            const cbiData = reAdjudicationData.cbi_data;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const markers = (cbiData?.markers || []).map((m: any, idx: number) => ({
                id: idx + 1,
                x: m.x,
                y: m.y,
                number: idx + 1,
                type: cbiData.type as CBINeedleType,
            }));

            return {
                entryPoint: cbiData.type as CBINeedlesEntryPoint,
                currentScreen: "count-needles",
                selectedNeedleType: cbiData.type as CBINeedleType,
                resolvedNeedleType: cbiData.type as CBINeedleType,
                needleMarkers: markers,
                needleCount: markers.length,
                photoAccepted: true,
                questionAnswered: null,
                lastConfirmedAt: null,
                lastAction: "re-adjudication-loaded",
                updatedAt: Date.now(),
                imageSrc: `http://localhost:8080/hayscan_cbi_images/${reAdjudicationData.image_filename}`,
                misplaced: cbiData?.misplaced || false,
                imageNaturalWidth: cbiData?.imageNaturalWidth || 900,
                imageNaturalHeight: cbiData?.imageNaturalHeight || 875,
            };
        }

        return {
            entryPoint: needleType,
            currentScreen: computeInitialScreen(needleType, skipBrokenQuestion),
            selectedNeedleType:
                needleType === "select" || needleType === "misplaced" ? null : (needleType as CBINeedleType),
            resolvedNeedleType: computeResolvedNeedleType(
                needleType,
                needleType === "select" || needleType === "misplaced" ? null : (needleType as CBINeedleType),
            ),
            needleMarkers: [],
            needleCount: 0,
            photoAccepted: false,
            questionAnswered: skipBrokenQuestion && needleType === "broken" ? "yes" : null,
            lastConfirmedAt: null,
            lastAction: "initialized",
            updatedAt: Date.now(),
            imageSrc: null,
            misplaced: false,
            imageNaturalWidth: 900,
            imageNaturalHeight: 875,
        };
    });
    const [nextMarkerId, setNextMarkerId] = useState(
        reAdjudicationData ? (reAdjudicationData.cbi_data?.markers?.length || 0) + 1 : 1,
    );
    const [showMarkers, setShowMarkers] = useState(true);

    const routeBack = useCallback(() => {
        if (skipBrokenQuestion && needleType === "broken" && typeof appContext.route.args?.needleIndex === "number") {
            const caseService = appContext.caseService;
            const remaining = caseService.cirAdjudication.value.length;
            const currentIndex = appContext.route.args.needleIndex;

            // Check if this was the last adjudication
            if (currentIndex + 1 >= remaining) {
                // All adjudications are done, send to backend
                const adjudicatedNeedles = caseService
                    .getAllAdjudications()
                    .filter((adj): adj is AdjudicationData & { id: string } => adj.id !== undefined)
                    .map((adj) => {
                        let reason = "";
                        let hasOtherPiece = null;
                        let other_custom_input = null;
                        if (adj.whatIsIt === "multiple") reason = "multiple";
                        else if (adj.whatIsIt === "broken") {
                            reason = "broken";
                            hasOtherPiece = adj.hasOtherPiece ?? null;
                        } else if (adj.whatIsIt === "not-needle") {
                            if (adj.dropdownValue === "Blade") reason = "blade";
                            else if (adj.dropdownValue === "K-Wire") reason = "k-wire";
                            else if (adj.dropdownValue === "Hypo") reason = "hypo";
                            else if (adj.dropdownValue === "Other") {
                                reason = "other";
                                other_custom_input = adj.customItemInput ?? null;
                            }
                        }
                        return hasOtherPiece !== null
                            ? { id: adj.id, reason, hasOtherPiece, other_custom_input }
                            : { id: adj.id, reason, other_custom_input };
                    });
                caseService.parlayInterface.caseManager.cir_adjudicated_needles(adjudicatedNeedles, "cirAdjudication");
                appContext.navigate({ path: "cirDashboard" });
                caseService.clearAdjudications();
            } else {
                // More adjudications to do, go to the next one
                appContext.navigate({
                    path: "cirAdjudication",
                    args: { nextIndex: currentIndex + 1 },
                });
            }
        } else {
            appContext.navigate({ path: "cirDashboard" });
        }
    }, [appContext, skipBrokenQuestion, needleType, onComplete]);

    const canConfirm = reAdjudicationData ? true : state.needleCount > 0;

    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;
        appContext.caseService.parlayInterface.caseManager.set_current_cir_screen("cirCbiNeedles");
    }, [appContext.parlayWrapper.isConnected.value, appContext.caseService.parlayInterface.caseManager]);

    useEffect(() => {
        if (state.currentScreen === "capture-image" && cbiImage?.image_filename && !state.imageSrc) {
            setState((prev) => ({
                ...prev,
                currentScreen: "photo-confirmation",
                imageSrc: `http://localhost:8080/hayscan_cbi_images/${cbiImage.image_filename}`,
                lastAction: "received-cbi-image",
            }));
        }
    }, [cbiImage, state.currentScreen, state.imageSrc]);
    useEffect(() => {
        setShowMarkers(true);
    }, [state.currentScreen]);
    useEffect(() => {
        if (state.currentScreen === "capture-image") {
            appContext.caseService.parlayInterface.hayScanner.open_camera(50000);
        }
    }, [state.currentScreen, appContext.caseService.parlayInterface.hayScanner]);

    function handlePhotoImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const img = e.currentTarget;
        setState((prev) => ({
            ...prev,
            imageNaturalWidth: img.naturalWidth,
            imageNaturalHeight: img.naturalHeight,
        }));
    }

    function updateState(
        partial: Partial<CBINeedlesState>,
        opts?: { clearMarkers?: boolean; resetMarkerSequence?: boolean },
    ) {
        setState((prev) => {
            let newMarkers = partial.needleMarkers;
            let newNextMarkerId = nextMarkerId;
            if (opts?.clearMarkers) {
                newMarkers = [];
                newNextMarkerId = 1;
            }
            if (opts?.resetMarkerSequence) {
                newNextMarkerId = 1;
            } else if (newMarkers) {
                const maxId = newMarkers.length > 0 ? Math.max(...newMarkers.map((m) => m.id)) : 0;
                newNextMarkerId = maxId + 1;
            }
            setNextMarkerId(newNextMarkerId);

            const composed: CBINeedlesState = {
                ...prev,
                ...partial,
                needleMarkers: newMarkers !== undefined ? newMarkers : prev.needleMarkers,
                updatedAt: Date.now(),
            };
            composed.resolvedNeedleType = computeResolvedNeedleType(composed.entryPoint, composed.selectedNeedleType);
            composed.needleCount = composed.needleMarkers.length;
            return composed;
        });
    }

    function proceedFromInitial() {
        // If entryPoint is "select" and no needle type selected yet, proceed to choose-type screen
        if (state.entryPoint === "select" && !state.selectedNeedleType) {
            updateState(
                {
                    currentScreen: "choose-type",
                    lastAction: "proceed-from-initial-to-choose-type",
                    imageSrc: null,
                },
                { clearMarkers: true },
            );
        } else if (
            state.entryPoint === "misplaced" &&
            state.lastAction !== "misplaced-complete-needle" &&
            state.lastAction !== "misplaced-fragment"
        ) {
            // Misplaced notification: initial screen → what-was-found (skip choose-type)
            updateState(
                {
                    currentScreen: "what-was-found",
                    lastAction: "proceed-to-what-was-found",
                    imageSrc: null,
                },
                { clearMarkers: true },
            );
        } else {
            // Contaminated/incompatible notifications, select+type, question-yes, misplaced CBI box → capture-image
            appContext.caseService.cbiImage.set(null);
            updateState(
                {
                    currentScreen: "capture-image",
                    lastAction: "proceed-from-initial",
                    imageSrc: null,
                },
                { clearMarkers: true },
            );
        }
    }
    function proceedFromCapture() {
        updateState({
            currentScreen: "photo-confirmation",
            lastAction: "proceed-from-capture",
        });
    }
    function retakePhoto() {
        appContext.caseService.cbiImage.set(null);
        appContext.caseService.parlayInterface.hayScanner.close_active_screen();
        updateState(
            {
                currentScreen: "capture-image",
                photoAccepted: false,
                lastAction: "retake-photo",
                imageSrc: null,
            },
            { clearMarkers: true },
        );
    }
    function confirmPhoto() {
        updateState({
            currentScreen: "count-needles",
            photoAccepted: true,
            lastAction: "confirm-photo",
        });
    }
    async function confirmCount() {
        if (!reAdjudicationData && state.needleCount <= 0) return;
        if (state.imageSrc && (reAdjudicationData || state.needleMarkers.length > 0) && state.resolvedNeedleType) {
            const validTypes: CBINeedleType[] = ["contaminated", "incompatible", "broken"];
            const type: CBINeedleType = state.resolvedNeedleType;
            if (!validTypes.includes(type)) {
                return;
            }
            const misplaced = state.misplaced;

            const markersForValidation = state.needleMarkers.map((m) => ({
                x: m.x,
                y: m.y,
                number: m.number,
                type: m.type,
            }));

            // If this is a re-adjudication, call the re-adjudication endpoint
            if (reAdjudicationData) {
                await appContext.caseService.parlayInterface.caseManager.cbi_needles_re_adjudicated(
                    reAdjudicationData.id,
                    type,
                    state.needleMarkers.length,
                    reAdjudicationData.image_filename,
                    reAdjudicationData.image_number,
                    reAdjudicationData.received_time,
                    misplaced,
                    markersForValidation,
                    state.imageNaturalWidth,
                    state.imageNaturalHeight,
                );
            } else {
                await appContext.caseService.parlayInterface.caseManager.cbi_needles_counted(
                    type,
                    state.needleMarkers.length,
                    cbiImage?.image_filename || "",
                    cbiImage?.image_number || 0,
                    cbiImage?.received_time || "",
                    misplaced,
                    markersForValidation,
                    state.imageNaturalWidth,
                    state.imageNaturalHeight,
                    true, // cir_confirmed=true means CIR has processed it, so notification should clear
                    fromFoundNonSterile, // skip decrementing existing CBI notification counts
                );
                // Backend will clear the notification when cir_confirmed=true
                // Backend also tracks last_cbi_images_by_type in app_state and broadcasts via update_dashboards
            }

            // If coming from adjudication flow, mark the current adjudication as confirmed
            if (
                skipBrokenQuestion &&
                needleType === "broken" &&
                typeof appContext.route.args?.needleIndex === "number"
            ) {
                const needleIndex = appContext.route.args.needleIndex;
                const adjudicationItem = appContext.caseService.cirAdjudication.value[needleIndex];

                if (adjudicationItem?.id) {
                    const currentAdjudication = appContext.caseService.getAdjudication(adjudicationItem.id);
                    if (currentAdjudication) {
                        appContext.caseService.saveAdjudicationData(adjudicationItem.id, {
                            ...currentAdjudication,
                            isConfirmed: true,
                            timestamp: new Date(),
                        });
                    }
                }
            }

            appContext.caseService.cbiImage.set(null);
            updateState(
                {
                    lastConfirmedAt: new Date(),
                    lastAction: "confirm-count",
                    imageSrc: null,
                },
                { clearMarkers: true },
            );
            if (onComplete) {
                onComplete();
            } else {
                routeBack();
            }
        }
    }
    function goBack() {
        const s = state;
        switch (s.currentScreen) {
            case "choose-type":
                // Go back to capture-initial, clearing any previously selected type
                if (s.entryPoint === "select") {
                    updateState(
                        {
                            currentScreen: "capture-initial",
                            selectedNeedleType: null,
                            resolvedNeedleType: null,
                            lastAction: "back-to-capture-initial-from-choose-type",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                } else {
                    appContext.caseService.cbiImage.set(null);
                    appContext.caseService.parlayInterface.caseManager.clear_cbi_image();
                    routeBack();
                }
                break;
            case "what-was-found":
                // Came from choose-type (misplaced card) or backed from CBI-box in select flow → choose-type
                if (s.lastAction === "choose-misplaced" || s.lastAction === "back-to-what-was-found-select") {
                    updateState(
                        {
                            entryPoint: "select",
                            currentScreen: "choose-type",
                            selectedNeedleType: null,
                            lastAction: "back-to-choose-type",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                } else if (s.entryPoint === "misplaced") {
                    // Misplaced notification flow → back to initial Identify & Record screen
                    updateState(
                        {
                            currentScreen: "capture-initial",
                            lastAction: "back-to-capture-initial-from-what-was-found",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                } else {
                    appContext.caseService.cbiImage.set(null);
                    appContext.caseService.parlayInterface.caseManager.clear_cbi_image();
                    routeBack();
                }
                break;
            case "question":
                if (s.entryPoint === "misplaced") {
                    updateState(
                        {
                            currentScreen: "what-was-found",
                            selectedNeedleType: null,
                            questionAnswered: null,
                            lastAction: "back-to-what-was-found",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                } else if (s.entryPoint === "select") {
                    updateState(
                        {
                            currentScreen: "choose-type",
                            selectedNeedleType: null,
                            questionAnswered: null,
                            lastAction: "back-to-choose-type",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                } else if (s.entryPoint === "broken") {
                    // Broken notification flow: question was preceded by Identify & Record screen
                    updateState(
                        {
                            currentScreen: "capture-initial",
                            questionAnswered: null,
                            lastAction: "back-to-capture-initial-from-question",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                } else {
                    appContext.caseService.cbiImage.set(null);
                    appContext.caseService.parlayInterface.caseManager.clear_cbi_image();
                    routeBack();
                }
                break;
            case "capture-initial":
                // For adjudication flow (skipBrokenQuestion), go back to adjudication screen
                if (
                    skipBrokenQuestion &&
                    needleType === "broken" &&
                    typeof appContext.route.args?.needleIndex === "number"
                ) {
                    appContext.navigate({
                        path: "cirAdjudication",
                        args: { nextIndex: appContext.route.args.needleIndex },
                    });
                }
                // After question-yes: back to question (select+broken and broken notification flows)
                else if (s.lastAction === "question-yes") {
                    updateState(
                        {
                            currentScreen: "question",
                            photoAccepted: false,
                            lastAction: "back-to-question",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                }
                // After misplaced CBI box placement: back to what-was-found
                else if (s.lastAction === "misplaced-complete-needle" || s.lastAction === "misplaced-fragment") {
                    updateState(
                        {
                            currentScreen: "what-was-found",
                            selectedNeedleType: null,
                            // Tag which flow we came from so what-was-found back handler routes correctly
                            lastAction:
                                needleType === "misplaced"
                                    ? "back-to-what-was-found-notification"
                                    : "back-to-what-was-found-select",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                }
                // All other cases: first screen for any flow → back to dashboard
                else {
                    appContext.caseService.cbiImage.set(null);
                    appContext.caseService.parlayInterface.caseManager.clear_cbi_image();
                    routeBack();
                }
                break;
            case "capture-image":
                appContext.caseService.parlayInterface.hayScanner.close_active_screen();
                // For adjudication flow (skipBrokenQuestion), go back to capture-initial
                if (skipBrokenQuestion && needleType === "broken") {
                    updateState(
                        {
                            currentScreen: "capture-initial",
                            photoAccepted: false,
                            lastAction: "back-to-capture-initial",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                }
                // For broken needle flow, go back based on entry point and question answer
                else if (s.resolvedNeedleType === "broken") {
                    if (s.entryPoint === "misplaced") {
                        // Misplaced fragment flow came directly from what-was-found — go back there
                        appContext.caseService.cbiImage.set(null);
                        updateState(
                            {
                                currentScreen: "what-was-found",
                                photoAccepted: false,
                                lastAction: "back-to-what-was-found",
                                imageSrc: null,
                            },
                            { clearMarkers: true },
                        );
                    } else if (s.questionAnswered === "yes") {
                        // User said yes (has other fragment), came through capture-initial (CBI box) — restore that screen
                        appContext.caseService.cbiImage.set(null);
                        updateState(
                            {
                                currentScreen: "capture-initial",
                                photoAccepted: false,
                                lastAction: "question-yes", // preserves CBI box rendering
                                imageSrc: null,
                            },
                            { clearMarkers: true },
                        );
                    } else if (s.entryPoint === "broken") {
                        // Broken notification flow: came directly from capture-initial — go back there
                        appContext.caseService.cbiImage.set(null);
                        updateState(
                            {
                                currentScreen: "capture-initial",
                                photoAccepted: false,
                                lastAction: "back-to-capture-initial",
                                imageSrc: null,
                            },
                            { clearMarkers: true },
                        );
                    } else {
                        // User said no (no other fragment), came directly from question — go back there
                        updateState(
                            {
                                currentScreen: "question",
                                photoAccepted: false,
                                lastAction: "back-to-question",
                                imageSrc: null,
                            },
                            { clearMarkers: true },
                        );
                    }
                }
                // For misplaced complete needle, came directly from what-was-found — go back there
                else if (s.entryPoint === "misplaced") {
                    appContext.caseService.cbiImage.set(null);
                    updateState(
                        {
                            currentScreen: "what-was-found",
                            photoAccepted: false,
                            lastAction: "back-to-what-was-found",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                }
                // For select entry point flow (non-broken), go back to choose-type (card select screen)
                else if (s.entryPoint === "select") {
                    updateState(
                        {
                            currentScreen: "choose-type",
                            photoAccepted: false,
                            lastAction: "back-to-choose-type",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                } else {
                    // Contaminated/incompatible notifications — Identify & Record was the prior screen
                    updateState(
                        {
                            currentScreen: "capture-initial",
                            photoAccepted: false,
                            lastAction: "back-to-capture-initial",
                            imageSrc: null,
                        },
                        { clearMarkers: true },
                    );
                }
                break;
            case "photo-confirmation":
                appContext.caseService.cbiImage.set(null);
                updateState({
                    currentScreen: "capture-image",
                    photoAccepted: false,
                    lastAction: "back-to-capture-image",
                    imageSrc: null,
                });
                break;
            case "count-needles":
                if (reAdjudicationData && onBack) {
                    onBack();
                } else {
                    updateState(
                        {
                            currentScreen: "photo-confirmation",
                            lastAction: "back-to-photo-confirmation",
                        },
                        { clearMarkers: true },
                    );
                }
                break;
            default:
                appContext.caseService.cbiImage.set(null);
                appContext.caseService.parlayInterface.caseManager.clear_cbi_image();
                routeBack();
                break;
        }
    }
    function close() {
        appContext.caseService.cbiImage.set(null);
        appContext.caseService.parlayInterface.caseManager.clear_cbi_image();
        // For adjudication flow, go back to adjudication with current needle
        if (skipBrokenQuestion && needleType === "broken" && typeof appContext.route.args?.needleIndex === "number") {
            appContext.navigate({
                path: "cirAdjudication",
                args: { nextIndex: appContext.route.args.needleIndex },
            });
        } else {
            routeBack();
        }
    }

    function addNeedleMarker(x: number, y: number) {
        updateState({
            needleMarkers: [
                ...state.needleMarkers,
                {
                    id: nextMarkerId,
                    x,
                    y,
                    number: state.needleMarkers.length + 1,
                    type: state.resolvedNeedleType ?? "contaminated",
                },
            ],
            lastAction: "add-needle-marker",
        });
        setNextMarkerId(nextMarkerId + 1);
    }

    function undoNeedleMarker() {
        if (state.needleMarkers.length === 0) return;
        updateState({
            needleMarkers: state.needleMarkers.slice(0, -1).map((m, i) => ({ ...m, number: i + 1 })),
            lastAction: "undo-needle-marker",
        });
    }
    function clearNeedleMarkers() {
        if (state.needleMarkers.length === 0) return;
        updateState(
            {
                needleMarkers: [],
                lastAction: "clear-needle-markers",
            },
            { resetMarkerSequence: true },
        );
    }

    function chooseContaminated() {
        updateState(
            {
                selectedNeedleType: "contaminated",
                currentScreen: "capture-image",
                questionAnswered: null,
                photoAccepted: false,
                lastAction: "choose-contaminated",
                imageSrc: null,
            },
            { clearMarkers: true },
        );
    }
    function chooseBroken() {
        updateState(
            {
                selectedNeedleType: "broken",
                currentScreen: "capture-initial",
                questionAnswered: null,
                photoAccepted: false,
                lastAction: "choose-broken",
                imageSrc: null,
            },
            { clearMarkers: true },
        );
    }
    function chooseIncompatible() {
        appContext.caseService.cbiImage.set(null);
        updateState(
            {
                selectedNeedleType: "incompatible",
                currentScreen: "capture-image",
                questionAnswered: null,
                photoAccepted: false,
                lastAction: "choose-incompatible",
                imageSrc: null,
            },
            { clearMarkers: true },
        );
    }
    function chooseMisplaced() {
        updateState(
            {
                entryPoint: "misplaced", // Set entryPoint to "misplaced" for this flow
                selectedNeedleType: null,
                currentScreen: "what-was-found",
                questionAnswered: null,
                photoAccepted: false,
                lastAction: "choose-misplaced",
                imageSrc: null,
            },
            { clearMarkers: true },
        );
    }
    function setMisplacedCompleteNeedle() {
        updateState(
            {
                selectedNeedleType: "contaminated",
                resolvedNeedleType: "contaminated",
                currentScreen: "capture-image",
                questionAnswered: null,
                photoAccepted: false,
                lastAction: "misplaced-complete-needle",
                imageSrc: null,
                misplaced: true,
            },
            { clearMarkers: true },
        );
    }
    function setMisplacedFragment() {
        updateState(
            {
                selectedNeedleType: "broken",
                resolvedNeedleType: "broken",
                currentScreen: "capture-image",
                questionAnswered: "no",
                photoAccepted: false,
                lastAction: "misplaced-fragment",
                imageSrc: null,
                misplaced: true,
            },
            { clearMarkers: true },
        );
    }

    function answerQuestionYes() {
        updateState(
            {
                questionAnswered: "yes",
                currentScreen: "capture-initial",
                photoAccepted: false,
                lastAction: "question-yes",
                imageSrc: null,
            },
            { clearMarkers: true },
        );
    }
    function answerQuestionNo() {
        appContext.caseService.cbiImage.set(null);
        updateState(
            {
                questionAnswered: "no",
                currentScreen: "capture-image",
                photoAccepted: false,
                lastAction: "question-no",
                imageSrc: null,
            },
            { clearMarkers: true },
        );
    }

    const resolvedNeedleType = state.resolvedNeedleType;
    const currentScreen = state.currentScreen;

    if (currentScreen === "what-was-found") {
        return (
            <WhatWasFoundScreen
                onCompleteNeedleClick={setMisplacedCompleteNeedle}
                onFragmentClick={setMisplacedFragment}
                onBack={goBack}
                onClose={close}
            />
        );
    }
    if (currentScreen === "choose-type") {
        return (
            <ChooseItemTypeScreen
                onContaminatedClick={chooseContaminated}
                onBrokenClick={chooseBroken}
                onIncompatibleClick={chooseIncompatible}
                onMisplacedClick={chooseMisplaced}
                onBack={goBack}
                onClose={close}
                showMisplaced={hasMisplaced}
            />
        );
    }
    if (currentScreen === "question") {
        return <QuestionScreen onYes={answerQuestionYes} onNo={answerQuestionNo} onBack={goBack} onClose={close} />;
    }
    if (currentScreen === "capture-initial") {
        // Show type-specific CBI box content only for placement screens;
        // all initial notification/select screens show the generic Identify & Record view
        const isCbiBoxPlacement =
            state.lastAction === "question-yes" ||
            state.lastAction === "misplaced-complete-needle" ||
            state.lastAction === "misplaced-fragment" ||
            state.lastAction === "choose-broken" ||
            state.entryPoint === "broken" ||
            (skipBrokenQuestion && needleType === "broken");
        const displayNeedleType = isCbiBoxPlacement
            ? ((resolvedNeedleType || state.selectedNeedleType) as CBINeedleType | "misplaced" | undefined)
            : undefined;
        const displayEntryPoint = isCbiBoxPlacement ? state.entryPoint : "select";
        return (
            <CaptureItemScreen
                onProceed={proceedFromInitial}
                onBack={goBack}
                onClose={close}
                screenType="initial"
                needleType={displayNeedleType}
                questionAnswered={state.questionAnswered ?? undefined}
                skipBrokenQuestion={skipBrokenQuestion}
                entryPoint={displayEntryPoint}
            />
        );
    }
    if (currentScreen === "capture-image") {
        return (
            <CaptureItemScreen
                onProceed={proceedFromCapture}
                onBack={goBack}
                onClose={close}
                screenType="capture"
                needleType={resolvedNeedleType ?? undefined}
                questionAnswered={state.questionAnswered ?? undefined}
                skipBrokenQuestion={skipBrokenQuestion}
            />
        );
    }
    if (currentScreen === "photo-confirmation") {
        return (
            <PhotoConfirmationScreen
                onRetake={retakePhoto}
                onYes={confirmPhoto}
                onBack={goBack}
                onClose={close}
                imageSrc={state.imageSrc}
                imageNumber={cbiImage?.image_number ?? null}
                imageTime={cbiImage?.received_time ?? null}
                needleType={resolvedNeedleType ?? state.selectedNeedleType ?? "contaminated"}
                onImgLoad={handlePhotoImgLoad}
            />
        );
    }
    if (currentScreen === "count-needles") {
        return (
            <CountNeedlesScreen
                onBack={goBack}
                onClose={close}
                onConfirm={confirmCount}
                needleType={resolvedNeedleType || "contaminated"}
                entryPoint={state.entryPoint}
                onAddMarker={addNeedleMarker}
                onUndo={undoNeedleMarker}
                onClear={clearNeedleMarkers}
                needleMarkers={state.needleMarkers}
                canConfirm={canConfirm}
                imageSrc={state.imageSrc}
                imageNumber={cbiImage?.image_number ?? null}
                imageTime={cbiImage?.received_time ?? null}
                showMarkers={showMarkers}
                onToggleMarkers={() => setShowMarkers((prev) => !prev)}
            />
        );
    }
    // Fallback: show what-was-found screen only if we're in misplaced flow without a selected type
    if (!resolvedNeedleType && state.entryPoint === "misplaced") {
        return (
            <WhatWasFoundScreen
                onCompleteNeedleClick={setMisplacedCompleteNeedle}
                onFragmentClick={setMisplacedFragment}
                onBack={close}
                onClose={close}
            />
        );
    }
    return null;
}
