import React, { useContext, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "../viewcss/RemoveFromCBI.module.css";
import { DynamicButton } from "../component/PillButton";
import { AppContext } from "./App";
import ModalHeader from "../component/ModalHeader";
import QuestionMessageIcon from "../img/QuestionMessage.svg";
import RedCloseNoBgIcon from "../img/RedCloseNoBg.svg";
import GreenCheckIcon from "../img/GreenCheck.svg";
import ContaminatedNeedleImage from "../img/ContaminatedNeedle.svg";
import BrokenNeedleImage from "../img/BrokenNeedle.svg";
import IncompatibleNeedleImage from "../img/IncompatibleNeedle.svg";
import WhiteBubbleArrowIcon from "../img/WhiteBubbleArrow.svg";
import TakePhotoContaminated from "../img/TakePhotoContaminated.svg";
import TakePhotoIncompatible from "../img/TakePhotoIncompatible.svg";
import TakePhotoBroken from "../img/TakePhotoBroken.svg";
import BlackRightArrowIcon from "../img/BlackRightArrow.svg";
import ContaminatedNeedleMarkerImage from "../img/ContaminatedNeedleMarker.svg";
import BrokenNeedleMarkerImage from "../img/BrokenNeedleMarker.svg";
import IncompatibleNeedleMarkerImage from "../img/IncompatibleNeedleMarker.svg";
import CloseIcon from "../img/WhiteClose.svg";
import UndoIcon from "../img/Undo.svg";
import WhiteUndoIcon from "../img/WhiteUndo.svg";
import BlackCloseIcon from "../img/BlackClose.svg";
import { useListenable } from "../util/Listenable";
import { VirtualKeyboard } from "../component/VirtualKeyboard";
import Close from "../img/WhiteClose.svg";
import RemoveFromCBIContaminated from "../img/RemoveFromCBIContaminated.svg";
import RemoveFromCBIBroken from "../img/RemoveFromCBIBroken.svg";
import RemoveFromCBIIncompatible from "../img/RemoveFromCBIIncompatible.svg";

type CBINeedleType = "contaminated" | "incompatible" | "broken";
type RemoveFromCBIScreen =
    | "confirm"
    | "select-type"
    | "identify-record"
    | "capture-image"
    | "photo-confirmation"
    | "count-needles"
    | "compare-images";

interface NeedleMarker {
    id: number;
    x: number;
    y: number;
    number: number;
}

const RemoveFromCBI: React.FC = () => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const cbiImage = useListenable(appContext.caseService.cbiImage);
    const lastCbiImageByType = useListenable(appContext.caseService.lastCbiImageByType);
    const contaminatedCount = useListenable(appContext.caseService.contaminatedNeedleCount);
    const incompatibleCount = useListenable(appContext.caseService.incompatibleNeedleCount);
    const brokenCount = useListenable(appContext.caseService.brokenNeedleCount);

    const [screen, setScreen] = useState<RemoveFromCBIScreen>("confirm");
    const [selectedType, setSelectedType] = useState<CBINeedleType | null>(null);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [imageNumber, setImageNumber] = useState<number | null>(null);
    const [imageTime, setImageTime] = useState<string | null>(null);
    const [needleMarkers, setNeedleMarkers] = useState<NeedleMarker[]>([]);
    const [showMarkers, setShowMarkers] = useState(true);
    const [nextMarkerId, setNextMarkerId] = useState(1);
    const [imgDims, setImgDims] = useState({ naturalWidth: 900, naturalHeight: 875 });

    const [selectedOption, setSelectedOption] = useState<"sharp" | "blade" | "kwire" | "other" | null>(null);
    const [otherInput, setOtherInput] = useState<string>("");
    const [isKeyboardShowing, setIsKeyboardShowing] = useState<boolean>(false);
    const [selectedImageView, setSelectedImageView] = useState<"new" | "previous">("new");

    const imageContainerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const otherInputRef = useRef<HTMLInputElement>(null);

    const navigateToDashboard = () => {
        appContext.caseService.cbiImage.set(null);
        appContext.navigate({ path: "cirDashboard" });
    };

    // Open camera when on capture-image screen
    useEffect(() => {
        if (screen === "capture-image") {
            appContext.caseService.parlayInterface.hayScanner.open_camera(50000);
        }
    }, [screen, appContext.caseService.parlayInterface.hayScanner]);

    // Listen for captured image
    useEffect(() => {
        if (screen === "capture-image" && cbiImage?.image_filename && !imageSrc) {
            setImageSrc(`http://localhost:8080/hayscan_cbi_images/${cbiImage.image_filename}`);
            setImageNumber(cbiImage.image_number ?? null);
            setImageTime(cbiImage.received_time ?? null);
            setScreen("photo-confirmation");
        }
    }, [cbiImage, screen, imageSrc]);

    // Reset marker visibility when screen changes
    useEffect(() => {
        setShowMarkers(true);
    }, [screen]);

    // Reset compare-images state when entering that screen
    useEffect(() => {
        if (screen === "compare-images") {
            setSelectedOption(null);
            setOtherInput("");
            setIsKeyboardShowing(false);
            setSelectedImageView("new");
        }
    }, [screen]);

    const highlightClasses: Record<CBINeedleType, string> = {
        contaminated: styles.contaminatedHighlight,
        broken: styles.brokenHighlight,
        incompatible: styles.incompatibleHighlight,
    };

    const takePhotoImages: Record<CBINeedleType, string> = {
        contaminated: TakePhotoContaminated,
        broken: TakePhotoBroken,
        incompatible: TakePhotoIncompatible,
    };

    const removeFromCBIImages: Record<CBINeedleType, string> = {
        contaminated: RemoveFromCBIContaminated,
        broken: RemoveFromCBIBroken,
        incompatible: RemoveFromCBIIncompatible,
    };

    const captureInstructionKeys: Record<CBINeedleType, string> = {
        contaminated: "cbi.captureItem.captureInstructionContaminated",
        broken: "cbi.captureItem.captureInstructionBroken",
        incompatible: "cbi.captureItem.captureInstructionIncompatible",
    };

    const typeNames: Record<CBINeedleType, string> = {
        contaminated: t("cbi.select.contaminated.name"),
        broken: t("cbi.select.broken.name"),
        incompatible: t("cbi.select.incompatible.name"),
    };

    function handleSelectType(type: CBINeedleType) {
        setSelectedType(type);
        setScreen("identify-record");
    }

    function handleProceedToCapture() {
        appContext.caseService.cbiImage.set(null);
        setImageSrc(null);
        setNeedleMarkers([]);
        setNextMarkerId(1);
        setScreen("capture-image");
    }

    function handleRetakePhoto() {
        appContext.caseService.cbiImage.set(null);
        appContext.caseService.parlayInterface.hayScanner.close_active_screen();
        setImageSrc(null);
        setNeedleMarkers([]);
        setNextMarkerId(1);
        setScreen("capture-image");
    }

    function handlePhotoConfirmed() {
        setScreen("count-needles");
    }

    function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
        if (!imageContainerRef.current || !imgRef.current) return;
        const img = imgRef.current;
        const rect = imageContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const xNatural = (x / img.offsetWidth) * img.naturalWidth;
        const yNatural = (y / img.offsetHeight) * img.naturalHeight;
        const newMarker: NeedleMarker = { id: nextMarkerId, x: xNatural, y: yNatural, number: nextMarkerId };
        setNeedleMarkers((prev) => [...prev, newMarker]);
        setNextMarkerId((prev) => prev + 1);
    }

    function handlePhotoImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const img = e.currentTarget;
        setImgDims({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
    }

    function handleUndo() {
        setNeedleMarkers((prev) => prev.slice(0, -1));
        setNextMarkerId((prev) => Math.max(1, prev - 1));
    }

    function handleClearAll() {
        setNeedleMarkers([]);
        setNextMarkerId(1);
    }

    function handleOptionSelect(option: "sharp" | "blade" | "kwire" | "other") {
        setSelectedOption(option);
        if (option !== "other") {
            setOtherInput("");
            setIsKeyboardShowing(false);
        }
    }

    async function handleConfirmCompare() {
        if (!selectedType) return;
        const previousValidation = lastCbiImageByType?.[selectedType] ?? null;
        const newFilename = imageSrc?.split("/").pop() ?? "";
        await appContext.caseService.parlayInterface.caseManager.cbi_removed_confirmed(
            selectedType,
            newFilename,
            imageNumber ?? 0,
            imageTime ?? "",
            needleMarkers.map((m) => ({ x: m.x, y: m.y, number: m.number, type: selectedType })),
            imgDims.naturalWidth,
            imgDims.naturalHeight,
            previousValidation?.image_filename ?? "",
            previousValidation?.image_number ?? 0,
            previousValidation?.received_time ?? "",
            (previousValidation?.markers ?? []).map((m) => ({ x: m.x, y: m.y, number: m.number, type: selectedType })),
            previousValidation?.imageNaturalWidth ?? 0,
            previousValidation?.imageNaturalHeight ?? 0,
            selectedOption ?? "",
            selectedOption === "other" ? otherInput : "",
        );
        navigateToDashboard();
    }

    function handleVirtualKeyPressCompare(keyValue: string) {
        if (keyValue === "backspace") {
            setOtherInput((prev) => prev.slice(0, -1));
        } else if (keyValue === "enter") {
            setIsKeyboardShowing(false);
        } else if (keyValue === "space") {
            setOtherInput((prev) => (prev.length < 50 ? prev + " " : prev));
        } else if (keyValue.length === 1) {
            setOtherInput((prev) => (prev.length < 50 ? prev + keyValue : prev));
        }
    }

    const count = needleMarkers.length;
    const canConfirm = true;

    const displayedMarkers =
        imgDims.naturalWidth > 1 && imgDims.naturalHeight > 1
            ? needleMarkers.map((marker) => ({
                  ...marker,
                  leftPercent: (marker.x / imgDims.naturalWidth) * 100,
                  topPercent: (marker.y / imgDims.naturalHeight) * 100,
              }))
            : [];

    // Shared image card used by photo-confirmation and count-needles screens
    const renderImageCard = (clickable: boolean) => (
        <div className={styles.imageCard}>
            <div
                ref={imageContainerRef}
                className={styles.imageContainer}
                onClick={clickable ? handleImageClick : undefined}
                style={{ position: "relative" }}
            >
                <img
                    ref={imgRef}
                    src={imageSrc || undefined}
                    alt="Captured photo"
                    className={styles.image}
                    onLoad={handlePhotoImgLoad}
                    onError={(e) => {
                        e.currentTarget.style.display = "none";
                    }}
                />
                {(imageNumber !== null || imageTime) && (
                    <div className={styles.imageInfoOverlay}>
                        {imageNumber !== null && (
                            <span
                                className={styles.imageInfoText}
                            >{`${t("cbi.captureItem.imageNumber")}${imageNumber}`}</span>
                        )}
                        {imageTime && <span className={styles.imageInfoText}>{imageTime}</span>}
                    </div>
                )}
                {clickable && selectedType && (
                    <>
                        <button
                            className={styles.markerToggleButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setShowMarkers((v) => !v);
                            }}
                            type="button"
                        >
                            {showMarkers ? t("cbi.hideMarkers") : t("cbi.showMarkers")}
                        </button>
                        {showMarkers &&
                            displayedMarkers.map((position) => (
                                <div
                                    key={position.id}
                                    className={styles.needleIconWrapper}
                                    style={{ left: `${position.leftPercent}%`, top: `${position.topPercent}%` }}
                                >
                                    <img
                                        src={
                                            selectedType === "incompatible"
                                                ? IncompatibleNeedleMarkerImage
                                                : selectedType === "broken"
                                                  ? BrokenNeedleMarkerImage
                                                  : ContaminatedNeedleMarkerImage
                                        }
                                        alt="Needle marker"
                                    />
                                    <span className={styles.needleNumber}>{position.number}</span>
                                </div>
                            ))}
                    </>
                )}
            </div>
        </div>
    );

    // ---- Screen: confirm ----
    if (screen === "confirm") {
        return (
            <div className={styles.captureScreen}>
                <ModalHeader
                    title={t("removeFromCBI.header")}
                    onBack={navigateToDashboard}
                    onClose={navigateToDashboard}
                    showLeftPadding={true}
                />
                <main className={styles.captureBrokenMain}>
                    <div className={styles.questionPanelContainer}>
                        <div className={styles.questionScreenContainer}>
                            <div className={styles.brokenContentContainer}>
                                <img src={QuestionMessageIcon} alt="Question" className={styles.brokenIcon} />
                                <h2 className={styles.questionTitle}>{t("removeFromCBI.confirm.question")}</h2>
                                <div className={styles.brokenNeedlesConfirmationButtons}>
                                    <DynamicButton
                                        label={t("removeFromCBI.confirm.no")}
                                        borderColor="#ff465e"
                                        textColor="#ff465e"
                                        fullWidth
                                        Icon={<img src={RedCloseNoBgIcon} alt="Close" />}
                                        onClick={navigateToDashboard}
                                        isActive={false}
                                        disabled={false}
                                    />
                                    <DynamicButton
                                        label={t("removeFromCBI.confirm.yes")}
                                        borderColor="#3ebcab"
                                        textColor="#3ebcab"
                                        fullWidth
                                        Icon={<img src={GreenCheckIcon} alt="Done" />}
                                        onClick={() => setScreen("select-type")}
                                        isActive={false}
                                        disabled={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // ---- Screen: select-type ----
    if (screen === "select-type") {
        return (
            <div className={styles.captureScreen}>
                <ModalHeader
                    title={t("removeFromCBI.header")}
                    onBack={() => setScreen("confirm")}
                    onClose={navigateToDashboard}
                    showLeftPadding={true}
                />
                <main className={styles.chooseTypeMain}>
                    <h2 className={styles.chooseTypeTitle}>{t("removeFromCBI.selectType.title")}</h2>
                    <div className={styles.chooseTypeGrid}>
                        {(contaminatedCount ?? 0) > 0 && (
                            <button
                                className={`${styles.chooseTypeCard} ${styles.contaminatedCard}`}
                                onClick={() => handleSelectType("contaminated")}
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
                        )}
                        {(brokenCount ?? 0) > 0 && (
                            <button
                                className={`${styles.chooseTypeCard} ${styles.brokenCard}`}
                                onClick={() => handleSelectType("broken")}
                            >
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
                        )}
                        {(incompatibleCount ?? 0) > 0 && (
                            <button
                                className={`${styles.chooseTypeCard} ${styles.incompatibleCard}`}
                                onClick={() => handleSelectType("incompatible")}
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
                        )}
                    </div>
                </main>
            </div>
        );
    }

    // ---- Screen: identify-record ----
    if (screen === "identify-record" && selectedType) {
        return (
            <div className={styles.captureScreen}>
                <ModalHeader
                    title={t("removeFromCBI.header")}
                    onBack={() => setScreen("select-type")}
                    onClose={navigateToDashboard}
                    showLeftPadding={true}
                />
                <main className={styles.captureMain}>
                    <img src={removeFromCBIImages[selectedType]} alt="CBI Compartment" />
                    <div className={styles.captureInstructions}>
                        <p className={styles.instructionText}>
                            <Trans
                                i18nKey="removeFromCBI.identifyRecord.instruction"
                                values={{ type: typeNames[selectedType] }}
                                components={{ highlight: <span className={highlightClasses[selectedType]} /> }}
                            />
                        </p>
                        <div className={styles.proceedButtonContainer}>
                            <DynamicButton
                                label={t("cbi.captureItem.proceed")}
                                bgColor="#fff"
                                borderColor="#fff"
                                textColor="#000"
                                fullWidth
                                Icon={<img src={BlackRightArrowIcon} alt="Proceed" />}
                                onClick={handleProceedToCapture}
                                isActive={false}
                            />
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // ---- Screen: capture-image ----
    if (screen === "capture-image" && selectedType) {
        return (
            <div className={styles.captureScreen}>
                <ModalHeader
                    title={t("removeFromCBI.header")}
                    onBack={() => {
                        appContext.caseService.cbiImage.set(null);
                        appContext.caseService.parlayInterface.hayScanner.close_active_screen();
                        setImageSrc(null);
                        setScreen("identify-record");
                    }}
                    onClose={navigateToDashboard}
                    showLeftPadding={true}
                />
                <main className={styles.capturePhotoMain}>
                    <img src={takePhotoImages[selectedType]} alt="Take Photo" />
                    <div className={styles.captureInstructions}>
                        <p className={styles.instructionText}>
                            <Trans
                                i18nKey={captureInstructionKeys[selectedType]}
                                components={{ highlight: <span className={highlightClasses[selectedType]} /> }}
                            />
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    // ---- Screen: photo-confirmation ----
    if (screen === "photo-confirmation" && selectedType) {
        const headerTitle =
            selectedType === "contaminated"
                ? t("cbi.captureItem.titleContaminated")
                : selectedType === "incompatible"
                  ? t("cbi.captureItem.titleIncompatible")
                  : t("cbi.captureItem.title-2.24");

        return (
            <div className={styles.captureScreen}>
                <ModalHeader
                    title={headerTitle}
                    onBack={handleRetakePhoto}
                    onClose={navigateToDashboard}
                    showLeftPadding={true}
                />
                <main className={styles.adjMain}>
                    <div className={styles.adjContainer}>
                        {renderImageCard(false)}
                        <div className={styles.photoConfirmationPanel}>
                            <div className={styles.photoConfirmationPanelInner}>
                                <div className={styles.photoConfirmationBody}>
                                    <h2 className={styles.photoConfirmationTitle}>
                                        {t("cbi.photoConfirmation.question")}
                                    </h2>
                                    <div className={styles.confirmationButtons}>
                                        <DynamicButton
                                            label={t("cbi.photoConfirmation.retake")}
                                            bgColor="#777481"
                                            borderColor="#000000"
                                            textColor="#fff"
                                            fullWidth
                                            onClick={handleRetakePhoto}
                                            isActive={false}
                                        />
                                        <DynamicButton
                                            label={t("cbi.photoConfirmation.yes")}
                                            bgColor="#fff"
                                            borderColor="#000"
                                            fullWidth
                                            textColor="#000"
                                            onClick={handlePhotoConfirmed}
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

    // ---- Screen: count-needles ----
    if (screen === "count-needles" && selectedType) {
        const headerTitle = t("cbi.countNeedles.header", { type: typeNames[selectedType] });

        return (
            <div className={styles.captureScreen}>
                <ModalHeader
                    title={headerTitle}
                    onBack={() => setScreen("photo-confirmation")}
                    onClose={navigateToDashboard}
                    showLeftPadding={true}
                />
                <main className={styles.adjMain}>
                    <div className={styles.adjContainer}>
                        {renderImageCard(true)}
                        <div className={styles.countNeedlesPanel}>
                            <div className={styles.countNeedlesPanelInner}>
                                <div className={styles.countNeedlesBody}>
                                    <h2 className={styles.countNeedlesTitle}>
                                        <Trans
                                            i18nKey="cbi.countNeedles.instructionRemoveFromCBI"
                                            values={{ type: typeNames[selectedType] }}
                                            components={{
                                                highlight: <span className={highlightClasses[selectedType]} />,
                                            }}
                                        />
                                    </h2>
                                    <div className={styles.countControls}>
                                        <div className={styles.buttonRow}>
                                            <div className={styles.needleCountButtonContainer}>
                                                <DynamicButton
                                                    label={t("cbi.countNeedles.undo")}
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
                                                    label={t("cbi.countNeedles.clearAll")}
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
                                        onClick={() => setScreen("compare-images")}
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
    if (screen === "compare-images" && selectedType) {
        const headerTitle = t("removeFromCBI.compare.header", { type: typeNames[selectedType] });
        const canConfirmCompare =
            selectedOption !== null && (selectedOption !== "other" || otherInput.trim().length > 0);
        const compareOptions: Array<"sharp" | "blade" | "kwire" | "other"> = isKeyboardShowing
            ? ["kwire", "other"]
            : ["sharp", "blade", "kwire", "other"];

        const previousValidation = lastCbiImageByType?.[selectedType] ?? null;

        const compareDisplaySrc =
            selectedImageView === "new"
                ? imageSrc
                : previousValidation?.image_filename
                  ? `http://localhost:8080/hayscan_cbi_images/${previousValidation.image_filename}`
                  : null;
        const compareDisplayNumber: number | null =
            selectedImageView === "new" ? imageNumber : (previousValidation?.image_number ?? null);
        const compareDisplayTime: string | null =
            selectedImageView === "new" ? imageTime : (previousValidation?.received_time ?? null);

        const prevNatW = previousValidation?.imageNaturalWidth ?? 900;
        const prevNatH = previousValidation?.imageNaturalHeight ?? 875;
        const compareDisplayMarkers =
            selectedImageView === "new"
                ? imgDims.naturalWidth > 1 && imgDims.naturalHeight > 1
                    ? needleMarkers.map((m) => ({
                          ...m,
                          leftPercent: (m.x / imgDims.naturalWidth) * 100,
                          topPercent: (m.y / imgDims.naturalHeight) * 100,
                      }))
                    : []
                : (previousValidation?.markers ?? []).map((m) => ({
                      id: m.number,
                      x: m.x,
                      y: m.y,
                      number: m.number,
                      leftPercent: (m.x / prevNatW) * 100,
                      topPercent: (m.y / prevNatH) * 100,
                  }));

        const markerImg =
            selectedType === "incompatible"
                ? IncompatibleNeedleMarkerImage
                : selectedType === "broken"
                  ? BrokenNeedleMarkerImage
                  : ContaminatedNeedleMarkerImage;

        return (
            <div className={styles.captureScreen}>
                <ModalHeader
                    title={headerTitle}
                    onBack={() => setScreen("count-needles")}
                    onClose={navigateToDashboard}
                    showLeftPadding={true}
                />
                <main className={styles.adjMain}>
                    <div className={styles.adjContainer}>
                        <div className={styles.imageCard}>
                            <div className={styles.imageButtonContainer}>
                                <button
                                    className={
                                        selectedImageView === "previous" ? styles.activeButton : styles.inactiveButton
                                    }
                                    onClick={() => setSelectedImageView("previous")}
                                >
                                    <span
                                        className={
                                            selectedImageView === "previous"
                                                ? styles.activeButtonText
                                                : styles.inactiveButtonText
                                        }
                                    >
                                        {t("removeFromCBI.compare.previous")}
                                    </span>
                                </button>
                                <button
                                    className={
                                        selectedImageView === "new" ? styles.activeButton : styles.inactiveButton
                                    }
                                    onClick={() => setSelectedImageView("new")}
                                >
                                    <span
                                        className={
                                            selectedImageView === "new"
                                                ? styles.activeButtonText
                                                : styles.inactiveButtonText
                                        }
                                    >
                                        {t("removeFromCBI.compare.new")}
                                    </span>
                                </button>
                            </div>
                            <div className={styles.imageContainer} style={{ position: "relative" }}>
                                <img
                                    src={compareDisplaySrc || undefined}
                                    alt="Captured photo"
                                    className={styles.image}
                                    onLoad={handlePhotoImgLoad}
                                    onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                    }}
                                />
                                {(compareDisplayNumber !== null || compareDisplayTime) && (
                                    <div className={styles.imageInfoOverlay}>
                                        {compareDisplayNumber !== null && (
                                            <span
                                                className={styles.imageInfoText}
                                            >{`${t("cbi.captureItem.imageNumber")}${compareDisplayNumber}`}</span>
                                        )}
                                        {compareDisplayTime && (
                                            <span className={styles.imageInfoText}>{compareDisplayTime}</span>
                                        )}
                                    </div>
                                )}
                                {compareDisplayMarkers.map((m) => (
                                    <div
                                        key={m.id}
                                        className={styles.needleIconWrapper}
                                        style={{ left: `${m.leftPercent}%`, top: `${m.topPercent}%` }}
                                    >
                                        <img src={markerImg} alt="Needle marker" />
                                        <span className={styles.needleNumber}>{m.number}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className={styles.compareImagesPanel}>
                            <div
                                className={`${styles.compareImagesPanelInner} ${isKeyboardShowing ? styles.compareImagesPanelInnerKeyboard : ""}`}
                            >
                                {!isKeyboardShowing && (
                                    <span className={styles.compareImagesTitleText}>
                                        {t("removeFromCBI.compare.instruction", { type: typeNames[selectedType] })}
                                    </span>
                                )}
                                <div className={styles.compareImagesOptionsContainer}>
                                    {isKeyboardShowing && <div className={styles.divider} />}
                                    {compareOptions.map((option, i) => (
                                        <React.Fragment key={option}>
                                            {i > 0 && <div className={styles.divider} />}
                                            <button
                                                type="button"
                                                className={styles.compareImagesOption}
                                                onClick={() => handleOptionSelect(option)}
                                            >
                                                {selectedOption === option ? (
                                                    <div className={styles.radioActive}>
                                                        <div className={styles.radioActiveInner} />
                                                    </div>
                                                ) : (
                                                    <div className={styles.radioInactive} />
                                                )}
                                                <span className={styles.compareImagesOptionText}>
                                                    {t(`removeFromCBI.compare.${option}`)}
                                                </span>
                                            </button>
                                        </React.Fragment>
                                    ))}
                                </div>
                                {selectedOption === "other" && (
                                    <div
                                        className={`${styles.otherInputWrapper} ${isKeyboardShowing ? styles.otherInputWrapperActive : ""}`}
                                        onClick={() => {
                                            setIsKeyboardShowing(true);
                                            otherInputRef.current?.focus();
                                        }}
                                    >
                                        <input
                                            ref={otherInputRef}
                                            className={styles.otherInputField}
                                            type="text"
                                            placeholder={t("removeFromCBI.compare.provide")}
                                            value={otherInput}
                                            onChange={() => {}}
                                            onKeyDown={(e) => e.preventDefault()}
                                            onFocus={() => setIsKeyboardShowing(true)}
                                        />
                                        {otherInput && (
                                            <button
                                                className={styles.otherInputClearButton}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setOtherInput("");
                                                    setIsKeyboardShowing(true);
                                                }}
                                                onTouchEnd={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setOtherInput("");
                                                    setIsKeyboardShowing(true);
                                                }}
                                            >
                                                <img src={Close} width={32} height={32} alt="clear" />
                                            </button>
                                        )}
                                    </div>
                                )}
                                <div className={styles.compareConfirmContainer}>
                                    <DynamicButton
                                        label={t("removeFromCBI.compare.confirm")}
                                        bgColor="#FFFFFF"
                                        borderColor="#000000"
                                        textColor="#000000"
                                        disabledBgColor="#53515A"
                                        disabledBorderColor="#000000"
                                        disabledTextColor="#000000"
                                        opacity={1}
                                        onClick={handleConfirmCompare}
                                        disabled={!canConfirmCompare}
                                        fullWidth={true}
                                        isActive={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
                {isKeyboardShowing && (
                    <>
                        <div className={styles.adjKeyboardDismissArea} onClick={() => setIsKeyboardShowing(false)} />
                        <div className={styles.adjKeyboardOverlay}>
                            <div className={styles.adjKeyboardArea}>
                                <VirtualKeyboard onKeyPress={handleVirtualKeyPressCompare} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    return null;
};

export default RemoveFromCBI;
