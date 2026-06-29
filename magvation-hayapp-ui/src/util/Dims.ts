const designWidth = 1920;
const designHeight = 1080;

interface dims {
    width: number;
    height: number;
    scale: number;
}

export function getScaledDims(width: number, height: number): dims {
    //console.log("primary screen size detected as " + width + ", " + height);
    const targetRatio = designWidth / designHeight;
    const screenRatio = width / height;
    //console.log("ratios: " + targetRatio + " - " + screenRatio);

    let targetHeight = 0;
    let targetWidth = 0;
    let scale = 1.0;
    if (screenRatio < targetRatio) {
        targetWidth = width;
        scale = width / designWidth;
        targetHeight = designHeight * scale;
    } else {
        targetHeight = height;
        scale = height / designHeight;
        targetWidth = designWidth * scale;
    }

    //console.log("target window dims " + targetWidth + ", " + targetHeight);
    return {
        width: targetWidth,
        height: targetHeight,
        scale: scale,
    };
}
