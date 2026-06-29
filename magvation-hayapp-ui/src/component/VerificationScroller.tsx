/* filepath: /home/collin/Promenade/magvation/magvation-hayapp-ui/src/component/VerificationScroller.tsx */
import React, { useRef, useState, useEffect } from "react";
import styles from "./VerificationScroller.module.css";
import UpArrow from "../img/UpArrow.svg";
import DownArrow from "../img/DownArrow.svg";

const SCROLL_STEP = 60;

interface VerificationScrollbarProps {
    scrollContentRef: React.RefObject<HTMLDivElement>;
    height?: string | number;
}

export const VerificationScrollbar: React.FC<VerificationScrollbarProps> = ({ scrollContentRef, height }) => {
    const scrollBarBackRef = useRef<HTMLDivElement>(null);
    const [thumbTop, setThumbTop] = useState(0);
    const [thumbHeight, setThumbHeight] = useState(100);
    const [trackHeight, setTrackHeight] = useState(0);

    // Calculate dimensions based on viewport
    const getResponsiveDimensions = () => {
        const vh = window.innerHeight / 100;
        const arrowHeight = 5.56 * vh; // 5.56vh
        const gap = 0.46 * vh; // 0.46vh
        const thumbGap = 1.85 * vh; // 1.85vh
        const totalHeight = 68.33 * vh; // 68.33vh (738px / 1080 * 100)
        return {
            arrowHeight,
            gap,
            thumbGap,
            trackHeight: totalHeight - 2 * (arrowHeight + gap + thumbGap),
        };
    };

    const updateThumb = () => {
        const content = scrollContentRef.current;
        if (!content) return;
        const { scrollTop, scrollHeight, clientHeight } = content;
        const { trackHeight: currentTrackHeight } = getResponsiveDimensions();
        setTrackHeight(currentTrackHeight);
        const ratio = clientHeight / scrollHeight;
        const thumbH = Math.max(ratio * currentTrackHeight, 40);
        const maxThumbTop = currentTrackHeight - thumbH;
        const thumbT = (scrollTop / (scrollHeight - clientHeight)) * maxThumbTop || 0;
        setThumbHeight(thumbH);
        setThumbTop(thumbT);
    };

    useEffect(() => {
        updateThumb();
        const content = scrollContentRef.current;
        if (!content) return;
        content.addEventListener("scroll", updateThumb);
        window.addEventListener("resize", updateThumb);
        return () => {
            content.removeEventListener("scroll", updateThumb);
            window.removeEventListener("resize", updateThumb);
        };
    }, [scrollContentRef]);

    useEffect(() => {
        const scrollBarBack = scrollBarBackRef.current;
        const content = scrollContentRef.current;
        if (!scrollBarBack || !content) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            content.scrollBy({ top: e.deltaY });
        };

        scrollBarBack.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            scrollBarBack.removeEventListener("wheel", onWheel);
        };
    }, [scrollContentRef]);

    const scrollBy = (delta: number) => {
        if (scrollContentRef.current) {
            scrollContentRef.current.scrollBy({ top: delta, behavior: "smooth" });
        }
    };

    const onThumbMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startTop = thumbTop;
        const content = scrollContentRef.current;
        if (!content) return;
        const maxThumbTop = trackHeight - thumbHeight;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dy = moveEvent.clientY - startY;
            const newThumbTop = Math.min(Math.max(startTop + dy, 0), maxThumbTop);
            setThumbTop(newThumbTop);
            const scrollRatio = newThumbTop / maxThumbTop;
            content.scrollTop = scrollRatio * (content.scrollHeight - content.clientHeight);
        };

        const onMouseUp = () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    };

    const onThumbTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        const startY = e.touches[0].clientY;
        const startTop = thumbTop;
        const content = scrollContentRef.current;
        if (!content) return;
        const maxThumbTop = trackHeight - thumbHeight;

        const onTouchMove = (moveEvent: TouchEvent) => {
            const dy = moveEvent.touches[0].clientY - startY;
            const newThumbTop = Math.min(Math.max(startTop + dy, 0), maxThumbTop);
            setThumbTop(newThumbTop);
            const scrollRatio = newThumbTop / maxThumbTop;
            content.scrollTop = scrollRatio * (content.scrollHeight - content.clientHeight);
        };

        const onTouchEnd = () => {
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
        };

        window.addEventListener("touchmove", onTouchMove);
        window.addEventListener("touchend", onTouchEnd);
    };

    const { arrowHeight, gap, thumbGap } = getResponsiveDimensions();

    return (
        <div className={styles.scrollBarContainer} style={height ? { height } : undefined}>
            <div className={styles.scrollBarBack} ref={scrollBarBackRef} style={height ? { height } : undefined}>
                <div
                    className={`${styles.arrowContainer} ${styles.top}`}
                    onClick={() => scrollBy(-SCROLL_STEP)}
                    style={{ cursor: "pointer" }}
                >
                    <img className={styles.arrow} src={UpArrow} alt="Arrow" />
                </div>
                <div
                    className={styles.scrollBar}
                    style={{
                        top: arrowHeight + gap + thumbGap + thumbTop,
                        height: `${thumbHeight}px`,
                    }}
                    onMouseDown={onThumbMouseDown}
                    onTouchStart={onThumbTouchStart}
                />
                <div
                    className={`${styles.arrowContainer} ${styles.bottom}`}
                    onClick={() => scrollBy(SCROLL_STEP)}
                    style={{ cursor: "pointer" }}
                >
                    <img className={styles.arrow} src={DownArrow} alt="Arrow" />
                </div>
            </div>
        </div>
    );
};
