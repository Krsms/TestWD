const roundToNearest5 = x => Math.round(x/5)*5

function getPresentationStyle(node) {
    var computedNode = node.nodeType === Node.TEXT_NODE ? node.parentNode : node,
    rectInfo = computedNode.getBoundingClientRect(),
    style = window.getComputedStyle(computedNode),
    fontWeightMap = {
        "lighter": "100",
        "normal": "400",
        "bold": "700"
    },
    fontWeight = style.fontWeight;

    if (fontWeight in fontWeightMap) {
        fontWeight = fontWeightMap[fontWeight];
    }

    var textDecoration = style.textDecoration;
    if ("textDecorationLine" in style) {
        textDecoration = style.textDecorationLine;
    }

    return {
        "fontWeight": fontWeight,
        "textDecoration": textDecoration,
        "fontFamily": style.fontFamily,
        "fontSize": style.fontSize,
        "color": style.color,
        "fontStyle": style.fontStyle,
        "display": style.display,
        'visibility': style.visibility,
        'height': roundToNearest5(rectInfo.height),
        'width': roundToNearest5(rectInfo.width),
        'left': roundToNearest5(rectInfo.left+window.scrollX),
        'top': roundToNearest5(rectInfo.top+window.scrollY),
        'backgroundImage': style.backgroundImage,
        'backgroundColor': style.backgroundColor
    };
}