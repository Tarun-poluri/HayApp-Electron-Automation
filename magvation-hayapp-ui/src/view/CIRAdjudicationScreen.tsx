import { useEffect, useState, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import styles from "../viewcss/CIRAdjudicationScreen.module.css";
import { DynamicButton } from "../component/PillButton";
import { HayDropdown } from "../component/HayDropdown";
import { VirtualKeyboard } from "../component/VirtualKeyboard";
import CaseService from "../services/CaseService";
import { useListenable } from "../util/Listenable";
import { AppContext, AppContextProps } from "./App";
import ModalHeader from "../component/ModalHeader";
import LeftArrow from "../img/LeftArrow.svg";
import CrossIcon from "../img/CrossIcon.svg";
import DownArrow from "../img/DownArrow.svg";
import RightChevron from "../img/RightChevron.svg";
import Multiple from "../img/MultipleIcon.svg";
import Broken from "../img/Broken.svg";
import NotANeedle from "../img/NotANeedle.svg";
import RedCloseNoBg from "../img/RedCloseNoBg.svg";
import GreenCheck from "../img/GreenCheck.svg";
import MinusIcon from "../img/MinusIcon.svg";
import PlusIcon from "../img/PlusIcon.svg";
import WhiteClose from "../img/WhiteClose.svg";
import WhiteCheck from "../img/WhiteCheck.svg";

// --- Types ---
interface AdjudicationData {
    answer: "yes" | "no" | null;
    whatIsIt: "multiple" | "broken" | "not-needle" | null;
    dropdownValue: "Blade" | "K-Wire" | "Hypo" | "Other" | null;
    customItemInput: string;
    needleCount: number | null;
    hasOtherPiece: boolean | null;
    isConfirmed: boolean;
    timestamp?: Date;
    id?: string;
    imageNumber?: number;
}
interface ImageData {
    id: string;
    imageNumber: number;
    imageSrc: string;
    timestamp: string;
    adjudicationData?: AdjudicationData;
}
interface CIRAdjudicationScreenProps {
    source?: "cirAdjudication" | "cirReAdjudication";
    onComplete?: () => void;
    onBack?: () => void;
}

// --- Step Panels ---
interface StepOnePanelProps {
    onNoClick: () => void;
    onYesClick: () => void;
}
function StepOnePanel({ onNoClick, onYesClick }: StepOnePanelProps) {
    const { t } = useTranslation();
    return (
        <section className={styles.stepOnePanel}>
            <div className={styles.stepOnePanelInner}>
                <h2 className={styles.stepOneQuestion}>
                    {t("adjudication.step1.questionPartOne")}{" "}
                    <span className={styles.highlight}>{t("adjudication.step1.one")}</span>{" "}
                    {t("adjudication.step1.questionPartTwo")}
                </h2>
                <div className={styles.stepOneActions}>
                    <DynamicButton
                        label="No"
                        bgColor="rgba(0, 0, 0, 0.05)"
                        borderColor="#FF7083"
                        textColor="#FF7083"
                        Icon={<img src={RedCloseNoBg} alt="Close" />}
                        onClick={onNoClick}
                        isActive={false}
                    />
                    <DynamicButton
                        label="Yes"
                        bgColor="rgba(0, 0, 0, 0.05)"
                        borderColor="#4FE2CE"
                        textColor="#4FE2CE"
                        Icon={<img src={GreenCheck} alt="Done" />}
                        onClick={onYesClick}
                        isActive={false}
                    />
                </div>
            </div>
        </section>
    );
}

interface StepTwoPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onOptionSelect: (optionId: string) => void;
    onEdit: () => void;
    question: string;
}
function StepTwoPanel({ isOpen, onClose, onOptionSelect, onEdit, question }: StepTwoPanelProps) {
    const { t } = useTranslation();
    if (!isOpen) return null;
    const options = [
        {
            id: "multiple",
            label: t("adjudication.step2.options.multiple"),
            icon: <img src={Multiple} alt="Multiple" />,
        },
        {
            id: "broken",
            label: t("adjudication.step2.options.broken"),
            icon: <img src={Broken} alt="Broken" />,
        },
        {
            id: "not-needle",
            label: t("adjudication.step2.options.notNeedle"),
            icon: <img src={NotANeedle} className={styles.icon} alt="Not Needle" />,
        },
    ];
    return (
        <div className={styles.stepTwoPanel}>
            <div className={styles.stepTwoHeader}>
                <div className={styles.stepTwoQuestion}>
                    <div className={styles.stepTwoQuestionText}>{question}</div>
                    <div className={styles.stepTwoHeaderIconContainer} onClick={onClose}>
                        <img className={styles.stepTwoHeaderIcon} src={CrossIcon} alt="Close" />
                        <div className={styles.stepTwoHeaderIconText}>{t("adjudication.step2.no")}</div>
                    </div>
                    <div className={styles.stepTwoHeaderDropdownIcon} onClick={onEdit}>
                        <img className={styles.stepTwoHeaderDropdownIconImage} src={DownArrow} alt="Edit" />
                    </div>
                </div>
            </div>
            <div className={styles.stepTwoDivider} />
            <div className={styles.stepTwoBody}>
                <div className={styles.stepTwoTitle}>{t("adjudication.step2.question")}</div>
                <div className={styles.optionList}>
                    {options.map((option) => (
                        <button key={option.id} className={styles.optionCard} onClick={() => onOptionSelect(option.id)}>
                            <div className={styles.optionInner}>
                                <div className={styles.optionIcon}>{option.icon}</div>
                                <div className={styles.optionLabel}>{option.label}</div>
                                <img className={styles.optionArrow} src={RightChevron} alt="Arrow" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

interface StepThreeMultiplePanelProps {
    isOpen: boolean;
    onClose: () => void;
    editStepOne: () => void;
    editStepTwo: () => void;
    onConfirm: () => void;
    question: string;
    needleCount?: number;
    onNeedleCountChange?: (count: number) => void;
    canConfirm?: boolean;
}
function StepThreeMultiplePanel({
    isOpen,
    onClose,
    editStepTwo,
    editStepOne,
    onConfirm,
    question,
    needleCount = 2,
    onNeedleCountChange,
    canConfirm = false,
}: StepThreeMultiplePanelProps) {
    const { t } = useTranslation();
    const [number, setNumber] = useState(needleCount);
    useEffect(() => {
        setNumber(needleCount);
    }, [needleCount]);
    if (!isOpen) return null;
    const handleIncrement = () => {
        const newCount = number + 1;
        setNumber(newCount);
        onNeedleCountChange?.(newCount);
    };
    const handleDecrement = () => {
        if (number > 2) {
            const newCount = number - 1;
            setNumber(newCount);
            onNeedleCountChange?.(newCount);
        }
    };
    return (
        <div className={styles.stepTwoPanel}>
            <div className={styles.stepTwoHeader}>
                <div className={styles.stepTwoQuestion}>
                    <div className={styles.stepTwoQuestionText}>{question}</div>
                    <div className={styles.stepTwoHeaderIconContainer} onClick={onClose}>
                        <img className={styles.stepTwoHeaderIcon} src={CrossIcon} alt="Close" />
                        <div className={styles.stepTwoHeaderIconText}>{t("adjudication.step2.no")}</div>
                    </div>
                    <div className={styles.stepTwoHeaderDropdownIcon} onClick={editStepOne}>
                        <img className={styles.stepTwoHeaderDropdownIconImage} src={DownArrow} alt="Edit" />
                    </div>
                </div>
            </div>
            <div className={styles.stepTwoDivider} />
            <div className={styles.stepTwoHeader}>
                <div className={styles.stepTwoQuestion}>
                    <div className={styles.stepTwoQuestionText}>{t("adjudication.step2.question")}</div>
                    <div className={styles.stepTwoHeaderIconContainer}>
                        <div className={styles.stepTwoMultipleIconContainer}>
                            <img className={styles.stepTwoHeaderIcon} src={Multiple} alt="Multiple" />
                        </div>
                        <div className={styles.stepTwoHeaderIconText}>{t("adjudication.step2.options.multiple")}</div>
                    </div>
                    <div className={styles.stepTwoHeaderDropdownIcon} onClick={editStepTwo}>
                        <img className={styles.stepTwoHeaderDropdownIconImage} src={DownArrow} alt="Edit" />
                    </div>
                </div>
            </div>
            <div className={styles.stepTwoDivider} />
            <div className={styles.stepTwoBody}>
                <div className={styles.stepTwoTitle}>{t("adjudication.step3.multiple.title")}</div>
                <div className={styles.numberInputContainer}>
                    <div className={styles.numberInput}>
                        <button className={styles.numberButton} onClick={handleDecrement}>
                            <img src={MinusIcon} alt="Minus" />
                        </button>
                        <div className={styles.numberDisplay}>{number}</div>
                        <button
                            className={`${styles.numberButton} ${styles.numberButtonBorder}`}
                            onClick={handleIncrement}
                        >
                            <img src={PlusIcon} alt="Plus" />
                        </button>
                    </div>
                </div>
                <button
                    className={canConfirm ? styles.confirmButton : styles.confirmButtonDisabled}
                    disabled={!canConfirm}
                    onClick={onConfirm}
                >
                    {t("adjudication.actions.confirm")}
                </button>
            </div>
        </div>
    );
}

interface StepThreeBrokenPanelProps {
    isOpen: boolean;
    onClose: () => void;
    editStepOne: () => void;
    editStepTwo: () => void;
    onConfirm: () => void;
    question: string;
    hasOtherPiece?: boolean | null;
    onHasOtherPieceChange?: (hasOtherPiece: boolean) => void;
    canConfirm?: boolean;
    appContext: AppContextProps;
    saveCurrentImageData: (data: AdjudicationData) => void;
    adjudicationData: AdjudicationData;
    currentImageIndex: number;
    currentImage?: ImageData;
}
function StepThreeBrokenPanel({
    isOpen,
    onClose,
    editStepTwo,
    editStepOne,
    onConfirm,
    question,
    hasOtherPiece = null,
    onHasOtherPieceChange,
    canConfirm = false,
}: StepThreeBrokenPanelProps) {
    const { t } = useTranslation();
    const [localHasOtherPiece, setLocalHasOtherPiece] = useState<boolean | null>(hasOtherPiece);
    useEffect(() => {
        setLocalHasOtherPiece(hasOtherPiece);
    }, [hasOtherPiece]);
    if (!isOpen) return null;
    const handleYesClick = () => {
        setLocalHasOtherPiece(true);
        onHasOtherPieceChange?.(true);
    };
    const handleNoClick = () => {
        setLocalHasOtherPiece(false);
        onHasOtherPieceChange?.(false);
    };
    return (
        <div className={styles.stepTwoPanel}>
            <div className={styles.stepTwoHeader}>
                <div className={styles.stepTwoQuestion}>
                    <div className={styles.stepTwoQuestionText}>{question}</div>
                    <div className={styles.stepTwoHeaderIconContainer} onClick={onClose}>
                        <img className={styles.stepTwoHeaderIcon} src={CrossIcon} alt="Close" />
                        <div className={styles.stepTwoHeaderIconText}>{t("adjudication.step2.no")}</div>
                    </div>
                    <div className={styles.stepTwoHeaderDropdownIcon} onClick={editStepOne}>
                        <img className={styles.stepTwoHeaderDropdownIconImage} src={DownArrow} alt="Edit" />
                    </div>
                </div>
            </div>
            <div className={styles.stepTwoDivider} />
            <div className={styles.stepTwoHeader}>
                <div className={styles.stepTwoQuestion}>
                    <div className={styles.stepTwoQuestionText}>{t("adjudication.step2.question")}</div>
                    <div className={styles.stepTwoHeaderIconContainer}>
                        <img className={styles.stepTwoHeaderIcon} src={Broken} alt="Broken" />
                        <div className={styles.stepTwoHeaderIconText}>{t("adjudication.step2.options.broken")}</div>
                    </div>
                    <div className={styles.stepTwoHeaderDropdownIcon} onClick={editStepTwo}>
                        <img className={styles.stepTwoHeaderDropdownIconImage} src={DownArrow} alt="Edit" />
                    </div>
                </div>
            </div>
            <div className={styles.stepTwoDivider} />
            <div className={styles.stepTwoBrokenBody}>
                <div className={styles.stepTwoTitle}>{t("adjudication.step3.broken.title")}</div>
                <div className={styles.stepTwoBrokenButtons}>
                    <DynamicButton
                        label="No"
                        Icon={
                            localHasOtherPiece === false ? (
                                <img src={WhiteClose} alt="Close" />
                            ) : (
                                <img src={RedCloseNoBg} alt="Close" />
                            )
                        }
                        onClick={handleNoClick}
                        isActive={localHasOtherPiece === false}
                        disabled={false}
                        bgColor="rgba(0, 0, 0, 0.05)"
                        borderColor="#FF7083"
                        textColor="#FF7083"
                        fontSize={20}
                        borderRadius={55}
                        height={70}
                        padding="0 30px 0 35px"
                        gap={12}
                        fullWidth={false}
                        className={styles.brokenPanelButton}
                    />
                    <DynamicButton
                        label="Yes"
                        Icon={
                            localHasOtherPiece === true ? (
                                <img src={WhiteCheck} alt="Close" />
                            ) : (
                                <img src={GreenCheck} alt="Close" />
                            )
                        }
                        onClick={handleYesClick}
                        isActive={localHasOtherPiece === true}
                        disabled={false}
                        bgColor="rgba(0, 0, 0, 0.05)"
                        borderColor="#4FE2CE"
                        textColor="#4FE2CE"
                        fontSize={20}
                        borderRadius={55}
                        height={70}
                        padding="0 30px 0 35px"
                        gap={12}
                        fullWidth={false}
                        className={styles.brokenPanelButton}
                    />
                </div>
            </div>
            <button
                className={canConfirm ? styles.confirmButton : styles.confirmButtonDisabled}
                disabled={!canConfirm}
                onClick={onConfirm}
            >
                {t("adjudication.actions.confirm")}
            </button>
        </div>
    );
}

interface StepThreeNotNeedlePanelProps {
    isOpen: boolean;
    onClose: () => void;
    editStepOne: () => void;
    editStepTwo: () => void;
    onConfirm: () => void;
    question: string;
    selectedItemType?: string | null;
    onItemTypeChange?: (itemType: string) => void;
    customItemInput?: string;
    onCustomItemInputChange?: (input: string) => void;
    canConfirm?: boolean;
}
function StepThreeNotNeedlePanel({
    isOpen,
    onClose,
    editStepTwo,
    editStepOne,
    onConfirm,
    question,
    selectedItemType = null,
    onItemTypeChange,
    customItemInput = "",
    onCustomItemInputChange,
    canConfirm = false,
}: StepThreeNotNeedlePanelProps) {
    const { t } = useTranslation();
    const [localSelectedItemType, setLocalSelectedItemType] = useState<string>(selectedItemType || "");
    const [localCustomInput, setLocalCustomInput] = useState<string>(customItemInput);
    const [isKeyboardShowing, setIsKeyboardShowing] = useState<boolean>(false);
    useEffect(() => {
        setLocalSelectedItemType(selectedItemType || "");
    }, [selectedItemType]);
    useEffect(() => {
        setLocalCustomInput(customItemInput);
    }, [customItemInput]);
    if (!isOpen) return null;
    const itemTypes = [
        t("adjudication.step3.notNeedle.options.blade"),
        t("adjudication.step3.notNeedle.options.kWire"),
        t("adjudication.step3.notNeedle.options.hypo"),
        t("adjudication.step3.notNeedle.options.other"),
    ];
    const handleItemTypeSelect = (itemType: string) => {
        setLocalSelectedItemType(itemType);
        onItemTypeChange?.(itemType);
    };
    const handleKeyboardShow = () => setIsKeyboardShowing(true);
    const handleKeyboardHide = () => setIsKeyboardShowing(false);
    const handleVirtualKeyPress = (keyValue: string) => {
        if (keyValue === "backspace") {
            const newValue = localCustomInput.slice(0, -1);
            setLocalCustomInput(newValue);
            onCustomItemInputChange?.(newValue);
        } else if (keyValue === "enter") {
            handleKeyboardHide();
        } else if (keyValue === "space") {
            if (localCustomInput.length < 50) {
                const newValue = localCustomInput + " ";
                setLocalCustomInput(newValue);
                onCustomItemInputChange?.(newValue);
            }
        } else if (keyValue.length === 1) {
            if (localCustomInput.length < 50) {
                const newValue = localCustomInput + keyValue;
                setLocalCustomInput(newValue);
                onCustomItemInputChange?.(newValue);
            }
        }
    };
    return (
        <section className={styles.stepTwoPanel}>
            {!isKeyboardShowing && (
                <div className={styles.stepTwoHeader}>
                    <div className={styles.stepTwoQuestion}>
                        <div className={styles.stepTwoQuestionText}>{question}</div>
                        <div className={styles.stepTwoHeaderIconContainer} onClick={onClose}>
                            <img className={styles.stepTwoHeaderIcon} src={CrossIcon} alt="Close" />
                            <div className={styles.stepTwoHeaderIconText}>{t("adjudication.step2.no")}</div>
                        </div>
                        <div className={styles.stepTwoHeaderDropdownIcon} onClick={editStepOne}>
                            <img className={styles.stepTwoHeaderDropdownIconImage} src={DownArrow} alt="Edit" />
                        </div>
                    </div>
                </div>
            )}
            <div className={styles.stepTwoDivider} />
            <div className={styles.stepTwoHeader}>
                <div className={styles.stepTwoQuestion}>
                    <div className={styles.stepTwoQuestionText}>{t("adjudication.step2.question")}</div>
                    <div className={styles.stepTwoHeaderIconContainer}>
                        <div className={styles.stepTwoMultipleIconContainer}>
                            <img className={styles.smallIcon} src={NotANeedle} alt="Not a Needle" />
                        </div>
                        <div className={styles.stepTwoHeaderIconText}>{t("adjudication.step2.options.notNeedle")}</div>
                    </div>
                    <div className={styles.stepTwoHeaderDropdownIcon} onClick={editStepTwo}>
                        <img className={styles.stepTwoHeaderDropdownIconImage} src={DownArrow} alt="Edit" />
                    </div>
                </div>
            </div>
            <div className={styles.stepTwoDivider} />
            <div className={styles.notNeedleBody}>
                <div className={styles.stepTwoTitle}>{t("adjudication.step3.notNeedle.title")}</div>
                <HayDropdown
                    options={itemTypes}
                    placeholder={t("adjudication.step3.notNeedle.placeholder")}
                    selectedValue={localSelectedItemType}
                    onSelect={handleItemTypeSelect}
                />
                {localSelectedItemType === t("adjudication.step3.notNeedle.options.other") && (
                    <div
                        className={`${styles.otherInputWrapper} ${isKeyboardShowing ? styles.otherInputWrapperActive : ""}`}
                        onClick={handleKeyboardShow}
                    >
                        <input
                            className={styles.otherInputField}
                            type="text"
                            placeholder="Enter custom item type"
                            value={localCustomInput}
                            readOnly
                        />
                    </div>
                )}
            </div>
            <button
                className={canConfirm ? styles.confirmButton : styles.confirmButtonDisabled}
                disabled={!canConfirm}
                onClick={onConfirm}
            >
                {t("adjudication.actions.confirm")}
            </button>
            {isKeyboardShowing && (
                <>
                    <div className={styles.adjKeyboardDismissArea} onClick={handleKeyboardHide} />
                    <div className={styles.adjKeyboardOverlay}>
                        <div className={styles.adjKeyboardArea}>
                            <VirtualKeyboard onKeyPress={handleVirtualKeyPress} />
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}

// --- Main Component ---
export default function CIRAdjudicationScreen(props: CIRAdjudicationScreenProps) {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);

    // --- State for Adjudication Flow ---
    const source = props.source || "cirAdjudication";
    const caseService = CaseService.instance;
    const cirAdjudication = useListenable(caseService.cirAdjudication);
    const cirReAdjudication = useListenable(caseService.cirReAdjudication);

    const [images, setImages] = useState<ImageData[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [adjudicationData, setAdjudicationData] = useState<AdjudicationData>({
        answer: null,
        whatIsIt: null,
        dropdownValue: null,
        customItemInput: "",
        needleCount: null,
        hasOtherPiece: null,
        isConfirmed: false,
        imageNumber: 1,
    });
    const [canConfirm, setCanConfirm] = useState(false);

    // Panel visibility states
    const [showStepTwoPanel, setShowStepTwoPanel] = useState(false);
    const [showStepThreeMultiplePanel, setShowStepThreeMultiplePanel] = useState(false);
    const [showStepThreeBrokenPanel, setShowStepThreeBrokenPanel] = useState(false);
    const [showStepThreeNotNeedlePanel, setShowStepThreeNotNeedlePanel] = useState(false);

    // Overlay state for image
    const [showOverlay, setShowOverlay] = useState(false);

    const progressBarSections = Array.from({ length: images.length }).map((_, idx) => {
        const isFilled = idx <= currentImageIndex;
        const nextIsFilled = idx + 1 <= currentImageIndex;
        const marginRight = idx === images.length - 1 ? 0 : isFilled && nextIsFilled ? 0 : 4;
        return (
            <div
                key={idx}
                className={isFilled ? styles.progressBarSectionActive : styles.progressBarSection}
                style={{ marginRight }}
            />
        );
    });

    useEffect(() => {
        if (!appContext.parlayWrapper.isConnected.value) return;
        if (!props.onComplete) {
            appContext.caseService.parlayInterface.caseManager.set_current_cir_screen("cirAdjudication");
        }
    }, [
        appContext.parlayWrapper.isConnected.value,
        appContext.caseService.parlayInterface.caseManager,
        props.onComplete,
    ]);

    useEffect(() => {
        if (appContext.route.args?.nextIndex !== undefined) {
            setCurrentImageIndex(appContext.route.args.nextIndex);
        }
    }, [appContext.route.args?.nextIndex]);

    // --- Load Images from CaseService ---
    useEffect(() => {
        const results = source === "cirAdjudication" ? cirAdjudication : cirReAdjudication;
        // Check if there's any CBI re-adjudication item
        const cbiReAdjItem = results.find((r) => r?.response_type === "cbi_re_adjudication");

        if (cbiReAdjItem) {
            if (props.onComplete) {
                // In closing count: skip CBI re-adjudication, continue waterfall
                props.onComplete();
                return;
            }
            // Route to CBI needles screen for marker editing
            appContext.navigate({
                path: "cirCbiNeedlesReAdjudication",
                args: {
                    needleData: cbiReAdjItem,
                    source: source,
                },
            });
            return;
        }

        const imgs: ImageData[] = results.map((result, idx) => {
            const id = result?.id || `img_${idx}`;
            const imageFilename = result?.results?.[0]?.image_filename_used;
            const imageSrc = imageFilename
                ? `http://localhost:8080/haystack_object_images/${imageFilename.split(/[/\\]/).pop()}`
                : "";
            const timestamp = result?.received_time || "";
            return {
                id,
                imageNumber: idx + 1,
                imageSrc,
                timestamp,
                adjudicationData: images[idx]?.adjudicationData,
            };
        });
        setImages(imgs);
        if (currentImageIndex >= imgs.length) setCurrentImageIndex(0);
    }, [cirAdjudication, cirReAdjudication, source, appContext]);

    // --- Load Adjudication Data for Current Image ---
    useEffect(() => {
        const img = images[currentImageIndex];
        if (img && img.adjudicationData) {
            setAdjudicationData({
                ...img.adjudicationData,
                imageNumber: img.imageNumber,
            });
        } else {
            setAdjudicationData({
                answer: null,
                whatIsIt: null,
                dropdownValue: null,
                customItemInput: "",
                needleCount: null,
                hasOtherPiece: null,
                isConfirmed: false,
                imageNumber: img?.imageNumber || 1,
            });
        }
    }, [images, currentImageIndex]);

    // --- Can Confirm Logic ---
    useEffect(() => {
        const data = adjudicationData;
        setCanConfirm(
            data.answer === "yes" ||
                (data.whatIsIt === "multiple" && data.needleCount !== null) ||
                (data.whatIsIt === "broken" && data.hasOtherPiece !== null) ||
                (data.whatIsIt === "not-needle" &&
                    (data.dropdownValue === "Blade" ||
                        data.dropdownValue === "K-Wire" ||
                        data.dropdownValue === "Hypo")) ||
                (data.whatIsIt === "not-needle" && data.dropdownValue === "Other" && data.customItemInput !== ""),
        );
    }, [adjudicationData]);

    // --- Restore Panel State from Adjudication Data ---
    useEffect(() => {
        const data = adjudicationData;
        // Reset all panels first
        setShowStepTwoPanel(false);
        setShowStepThreeMultiplePanel(false);
        setShowStepThreeBrokenPanel(false);
        setShowStepThreeNotNeedlePanel(false);

        // Restore panel state based on saved data
        if (data.whatIsIt === "multiple") {
            setShowStepThreeMultiplePanel(true);
        } else if (data.whatIsIt === "broken") {
            setShowStepThreeBrokenPanel(true);
        } else if (data.whatIsIt === "not-needle") {
            setShowStepThreeNotNeedlePanel(true);
        } else if (data.answer === "no") {
            setShowStepTwoPanel(true);
        }
    }, [adjudicationData]);

    // --- State Setters ---
    const setAnswer = useCallback((answer: "yes" | "no") => {
        setAdjudicationData((prev) => ({
            ...prev,
            answer,
            whatIsIt: answer === "yes" ? null : prev.whatIsIt,
            dropdownValue: answer === "yes" ? null : prev.dropdownValue,
            needleCount: answer === "yes" ? null : prev.needleCount,
            hasOtherPiece: answer === "yes" ? null : prev.hasOtherPiece,
            customItemInput: answer === "yes" ? "" : prev.customItemInput,
        }));
    }, []);
    const setWhatIsIt = useCallback((whatIsIt: "multiple" | "broken" | "not-needle") => {
        setAdjudicationData((prev) => ({
            ...prev,
            whatIsIt,
            dropdownValue: whatIsIt === "not-needle" ? prev.dropdownValue : null,
            needleCount: whatIsIt === "multiple" ? prev.needleCount || 2 : null,
            hasOtherPiece: whatIsIt === "broken" ? prev.hasOtherPiece : null,
            customItemInput: whatIsIt === "not-needle" ? prev.customItemInput : "",
        }));
    }, []);
    const setDropdownValue = useCallback((dropdownValue: "Blade" | "K-Wire" | "Hypo" | "Other") => {
        setAdjudicationData((prev) => ({
            ...prev,
            dropdownValue,
            customItemInput: dropdownValue === "Other" ? prev.customItemInput : "",
        }));
    }, []);
    const setCustomItemInput = useCallback((input: string) => {
        setAdjudicationData((prev) => ({
            ...prev,
            customItemInput: input,
        }));
    }, []);
    const setNeedleCount = useCallback((count: number) => {
        setAdjudicationData((prev) => ({
            ...prev,
            needleCount: count,
        }));
    }, []);
    const setHasOtherPiece = useCallback((hasOtherPiece: boolean) => {
        setAdjudicationData((prev) => ({
            ...prev,
            hasOtherPiece,
        }));
    }, []);

    const currentImage = images[currentImageIndex];

    // --- Save Adjudication Data to Images Array ---
    const saveCurrentImageData = useCallback(
        (data: AdjudicationData) => {
            // Always set id to currentImage.id before saving
            const dataWithId = { ...data, id: currentImage?.id };
            if (currentImage?.id) {
                caseService.saveAdjudicationData(currentImage.id, dataWithId);
            }
            setImages((imgs) => {
                const updated = [...imgs];
                if (updated[currentImageIndex]) {
                    updated[currentImageIndex] = {
                        ...updated[currentImageIndex],
                        adjudicationData: dataWithId,
                    };
                }
                return updated;
            });
        },
        [currentImageIndex, currentImage],
    );

    const confirmAdjudication = useCallback(async () => {
        const currentData: AdjudicationData = {
            ...adjudicationData,
            isConfirmed: true,
            timestamp: new Date(),
            id: currentImage?.id,
        };
        setAdjudicationData(currentData);
        saveCurrentImageData(currentData);

        // Save to CaseService for persistence
        if (currentImage?.id) {
            caseService.saveAdjudicationData(currentImage.id, currentData);
        }

        // If more images, advance; else, send to backend and finish
        if (images.length > 1 && currentImageIndex < images.length - 1) {
            setCurrentImageIndex((idx) => idx + 1);
        } else if ((images.length > 1 && currentImageIndex === images.length - 1) || images.length === 1) {
            // Prepare adjudicatedNeedles for backend
            const adjudicatedNeedles = caseService
                .getAllAdjudications()
                .filter((adj): adj is AdjudicationData & { id: string } => adj.id !== undefined)
                .map((adj) => {
                    let reason = "";
                    let hasOtherPiece = null;
                    let other_custom_input = null;
                    let needle_count: number | null = null;
                    if (adj.whatIsIt === "multiple") {
                        reason = "multiple";
                        needle_count = adj.needleCount ?? 2;
                    } else if (adj.whatIsIt === "broken") {
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
                    // Always include hasOtherPiece for broken, needle_count for multiple, omit otherwise
                    if (hasOtherPiece !== null) return { id: adj.id, reason, hasOtherPiece, other_custom_input };
                    if (needle_count !== null) return { id: adj.id, reason, needle_count, other_custom_input };
                    return { id: adj.id, reason, other_custom_input };
                });
            await caseService.parlayInterface.caseManager.cir_adjudicated_needles(adjudicatedNeedles, source);
            resetAdjudication();
            caseService.clearAdjudications();
            if (props.onComplete) {
                props.onComplete();
            } else {
                appContext.navigate({ path: "cirDashboard" });
            }
        }
    }, [adjudicationData, images, currentImageIndex, source, appContext, currentImage]);

    // --- Reset Adjudication State ---
    const resetAdjudication = useCallback(() => {
        const img = images[currentImageIndex];
        setAdjudicationData({
            answer: null,
            whatIsIt: null,
            dropdownValue: null,
            customItemInput: "",
            needleCount: null,
            hasOtherPiece: null,
            isConfirmed: false,
            imageNumber: img?.imageNumber || 1,
        });
    }, [images, currentImageIndex]);

    // --- Panel Navigation Logic ---
    const resetToFirstStep = useCallback(() => {
        setShowStepTwoPanel(false);
        setShowStepThreeMultiplePanel(false);
        setShowStepThreeBrokenPanel(false);
        setShowStepThreeNotNeedlePanel(false);
        resetAdjudication();
    }, [resetAdjudication]);

    const backToStepTwo = useCallback(() => {
        setShowStepThreeMultiplePanel(false);
        setShowStepThreeBrokenPanel(false);
        setShowStepThreeNotNeedlePanel(false);
        setShowStepTwoPanel(true);
    }, []);

    const handleConfirmAndAdvance = useCallback(() => {
        // If we're in the broken panel and "Yes" was selected, navigate to CBI
        if (adjudicationData.whatIsIt === "broken" && adjudicationData.hasOtherPiece === true) {
            // In closing count context, skip CBI flow — just confirm and advance
            if (props.onComplete) {
                confirmAdjudication();
                resetToFirstStep();
                return;
            }
            // Stage 2: navigate to CBI broken needle screen
            saveCurrentImageData({
                ...adjudicationData,
                isConfirmed: false, // Not confirmed until CBI flow completes
                id: currentImage?.id,
            });
            appContext.navigate({
                path: "cirBrokenNeedles",
                args: {
                    skipBrokenQuestion: true,
                    needleIndex: currentImageIndex,
                },
            });
            resetToFirstStep();
            return;
        }

        // Otherwise, normal confirm flow
        confirmAdjudication();
        resetToFirstStep();
    }, [
        adjudicationData,
        currentImage,
        currentImageIndex,
        appContext,
        saveCurrentImageData,
        confirmAdjudication,
        resetToFirstStep,
        props.onComplete,
    ]);

    const handleNoClick = useCallback(() => {
        setAnswer("no");
        setShowStepTwoPanel(true);
    }, [setAnswer]);

    const handleOptionSelect = useCallback(
        (optionId: string) => {
            setWhatIsIt(optionId as "multiple" | "broken" | "not-needle");
            setShowStepTwoPanel(false);

            if (optionId === "multiple") {
                setShowStepThreeMultiplePanel(true);
            } else if (optionId === "broken") {
                setShowStepThreeBrokenPanel(true);
            } else if (optionId === "not-needle") {
                setShowStepThreeNotNeedlePanel(true);
            }
        },
        [setWhatIsIt],
    );

    const isShowingStepOne =
        !showStepTwoPanel && !showStepThreeMultiplePanel && !showStepThreeBrokenPanel && !showStepThreeNotNeedlePanel;

    const isShowingStepTwo =
        showStepTwoPanel && !showStepThreeMultiplePanel && !showStepThreeBrokenPanel && !showStepThreeNotNeedlePanel;

    const handleBack = () => {
        if (currentImageIndex > 0) {
            // Undo current needle's adjudication
            const currentImg = images[currentImageIndex];
            if (currentImg?.id) {
                caseService.saveAdjudicationData(currentImg.id, {
                    answer: null,
                    whatIsIt: null,
                    dropdownValue: null,
                    customItemInput: "",
                    needleCount: null,
                    hasOtherPiece: null,
                    isConfirmed: false,
                    imageNumber: currentImg.imageNumber,
                });
            }
            // Also clear the previous needle so user re-adjudicates it
            const prevImg = images[currentImageIndex - 1];
            if (prevImg?.id) {
                caseService.saveAdjudicationData(prevImg.id, {
                    answer: null,
                    whatIsIt: null,
                    dropdownValue: null,
                    customItemInput: "",
                    needleCount: null,
                    hasOtherPiece: null,
                    isConfirmed: false,
                    imageNumber: prevImg.imageNumber,
                });
            }
            resetToFirstStep();
            setCurrentImageIndex((idx) => idx - 1);
        } else if (props.onBack) {
            props.onBack();
        } else {
            appContext.navigate({ path: "cirDashboard" });
        }
    };

    // --- Overlay logic for imageCard ---
    const imageFilename = currentImage?.imageSrc?.split(/[/\\]/).pop();
    const overlayImageUrl = imageFilename
        ? `http://localhost:8080/haystack_object_images/${imageFilename}-out.png`
        : currentImage?.imageSrc;
    const baseImageUrl = currentImage?.imageSrc;

    return (
        <div className={styles.adjScreen}>
            <div className={styles.backgroundBlur}>
                {/* Full-width progress bar at top */}
                <div className={styles.progressBarContainer}>{progressBarSections}</div>
                <ModalHeader
                    title={
                        source === "cirReAdjudication" ? t("adjudication.reAdjudicationTitle") : t("adjudication.title")
                    }
                    onBack={handleBack}
                    backIcon={LeftArrow}
                    hideClose
                    hideHelpDivider
                    helpText={t("adjudication.header.help")}
                >
                    <div className={styles.itemChip}>
                        <span className={styles.itemChipText}>
                            {currentImageIndex + 1}/{images.length}
                        </span>
                    </div>
                </ModalHeader>
                <main className={styles.adjMain}>
                    <div className={styles.imageCard}>
                        <div className={styles.imageContainer}>
                            <img
                                className="image"
                                src={showOverlay ? overlayImageUrl : baseImageUrl}
                                alt="Suture needle case monitor"
                                style={{ borderRadius: "25px", width: "900px", height: "875px" }}
                            />
                        </div>
                        <div className={styles.controls}>
                            <div className={styles.controls}>
                                <button
                                    className={showOverlay ? styles.hideOverlayButton : styles.showOverlayButton}
                                    onClick={() => setShowOverlay((s) => !s)}
                                >
                                    <span className={showOverlay ? styles.hideOverlayText : styles.showOverlayText}>
                                        {showOverlay ? "Hide Overlay" : "Analysis Overlay"}
                                    </span>
                                </button>
                                <div className={styles.imageTextContainer}>
                                    <span className={styles.imageText}>Image #{currentImage?.imageNumber}</span>
                                    <span className={styles.imageText}>{currentImage?.timestamp}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {isShowingStepOne && (
                        <StepOnePanel
                            onNoClick={handleNoClick}
                            onYesClick={() => {
                                setAnswer("yes");
                                handleConfirmAndAdvance();
                            }}
                        />
                    )}
                    {isShowingStepTwo && (
                        <StepTwoPanel
                            isOpen={true}
                            onClose={resetToFirstStep}
                            onOptionSelect={handleOptionSelect}
                            onEdit={resetToFirstStep}
                            question={t("adjudication.step1.fullQuestion")}
                        />
                    )}
                    {showStepThreeMultiplePanel && (
                        <StepThreeMultiplePanel
                            isOpen={true}
                            onClose={resetToFirstStep}
                            editStepOne={resetToFirstStep}
                            editStepTwo={backToStepTwo}
                            onConfirm={() => handleConfirmAndAdvance()}
                            question={t("adjudication.step1.fullQuestion")}
                            needleCount={adjudicationData.needleCount || 2}
                            onNeedleCountChange={setNeedleCount}
                            canConfirm={canConfirm}
                        />
                    )}
                    {showStepThreeBrokenPanel && (
                        <StepThreeBrokenPanel
                            isOpen={true}
                            onClose={resetToFirstStep}
                            editStepOne={resetToFirstStep}
                            editStepTwo={backToStepTwo}
                            onConfirm={() => handleConfirmAndAdvance()}
                            question={t("adjudication.step1.fullQuestion")}
                            hasOtherPiece={adjudicationData.hasOtherPiece}
                            onHasOtherPieceChange={setHasOtherPiece}
                            canConfirm={canConfirm}
                            appContext={appContext}
                            saveCurrentImageData={saveCurrentImageData}
                            adjudicationData={adjudicationData}
                            currentImageIndex={currentImageIndex}
                            currentImage={currentImage}
                        />
                    )}
                    {showStepThreeNotNeedlePanel && (
                        <StepThreeNotNeedlePanel
                            isOpen={true}
                            onClose={resetToFirstStep}
                            editStepOne={resetToFirstStep}
                            editStepTwo={backToStepTwo}
                            onConfirm={() => handleConfirmAndAdvance()}
                            question={t("adjudication.step1.fullQuestion")}
                            selectedItemType={adjudicationData.dropdownValue}
                            onItemTypeChange={(itemType) =>
                                setDropdownValue(itemType as "Blade" | "K-Wire" | "Hypo" | "Other")
                            }
                            customItemInput={adjudicationData.customItemInput}
                            onCustomItemInputChange={setCustomItemInput}
                            canConfirm={canConfirm}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}
