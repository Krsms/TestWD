; (function (undefined) {
    "use strict";

    function evaluateXPath(xpath, contextNode) { //find nodes/value from xpath
        var doc = document, found, out = [], next;

        if (contextNode && typeof contextNode === "object") {
            if (contextNode.nodeType === document.DOCUMENT_NODE) {
                doc = contextNode;
            }
            else {
                doc = contextNode.ownerDocument;
            }
        }

        found = doc.evaluate(xpath, contextNode || doc, null, XPathResult.ANY_TYPE, null);
        switch (found.resultType) {
            case found.STRING_TYPE: return found.stringValue;
            case found.NUMBER_TYPE: return found.numberValue;
            case found.BOOLEAN_TYPE: return found.booleanValue;
            default:
                while ((next = found.iterateNext())) {
                    out.push(next);
                }
                return out;
        }
    }

    function getValueFromPairMap(map, e1, e2) {
        if (map.has(e1) && map.get(e1).has(e2)) {
            return map.get(e1).get(e2);
        } else if (map.has(e2) && map.get(e2).has(e1)) {
            return map.get(e2).get(e1);
        }
    }

    var Webdext = {
        evaluateXPath: evaluateXPath,
        getValueFromPairMap: getValueFromPairMap
    };
    Object.defineProperty(Webdext, "version", { value: "0.0.1" });

    // exports
    this.Webdext = Webdext;
}).call(this);

; (function (undefined) {
    "use strict";

    // imports
    var evaluateXPath = Webdext.evaluateXPath;

    function XPathStep(properties) {
        if (typeof properties !== "object") {
            throw new TypeError("Constructor only accepts object as argument.");
        }

        if (properties === null) {
            throw new TypeError("Constructor argument must not null.");
        }

        var paramNames = ["abbreviation", "axis", "nodetest", "predicates"];
        for (var key in properties) {
            if (paramNames.indexOf(key) === -1) {
                throw new Error(
                    "Illegal constructor argument, property: " + key + " is not supported."
                );
            }
        } //examing keys in 'properties'

        if ("abbreviation" in properties && Object.keys(properties).length > 1) {
            throw new Error("abbreviation property can't be passed with other properties.");
        }

        if (!("abbreviation" in properties || "nodetest" in properties)) {
            throw new Error(
                "nodetest property is mandatory when the XPathStep is not an abbreviation."
            );
        }

        if ("abbreviation" in properties) {
            this.abbreviation = properties.abbreviation;
        } else {
            if ("predicates" in properties) {
                if (Array.isArray(properties.predicates)) {
                    this.predicates = properties.predicates;
                } else {
                    throw new TypeError("predicates property must be an Array.");
                }
            }

            this.nodetest = properties.nodetest;

            if ("axis" in properties) {
                this.axis = properties.axis;
            }
        }
    }
    XPathStep.prototype.toString = function () {
        if (this.abbreviation) {
            return this.abbreviation;
        }

        var stepStr = "";

        if (this.axis) {
            stepStr += this.axis + "::" + this.nodetest;
        } else {
            stepStr += this.nodetest;
        }

        if (this.predicates) {
            var predicatesLength = this.predicates.length;
            for (var i = 0; i < predicatesLength; i++) {
                stepStr += "[" + this.predicates[i] + "]";
            }
        }
        return stepStr;
    };

    function LocationXPath(steps, absolute) { //create full xpath string
        if (!Array.isArray(steps)) {
            throw new TypeError("Constructor argument must be an array");
        }

        for (var i = steps.length; i--;) {
            if (!(steps[i] instanceof XPathStep)) {
                throw new TypeError("All steps element must be an instance of XPathStep.");
            }
        }

        if (typeof absolute !== "undefined" && typeof absolute !== "boolean") {
            throw new TypeError("absolute parameter must be a boolean.");
        }

        this.steps = steps;

        if (typeof absolute === "undefined") {
            this.absolute = true;
        } else {
            this.absolute = absolute;
        }
    }
    LocationXPath.prototype.toString = function () {
        if (this.absolute) {
            return "/" + this.steps.join("/");
        } else {
            return "./" + this.steps.join("/");
        }
    };

    function IndexedXPathStep(nodetest, position) {
        if (!/^[1-9][0-9]*$/.test(position)) {
            throw new TypeError("Second parameter must be a positional predicate (an integer > 0).");
        }

        var properties = {
            nodetest: nodetest,
            predicates: [position]
        };
        XPathStep.call(this, properties); // create a XPathStep obj using properties.
    }
    IndexedXPathStep.prototype = Object.create( //making IndexedXPathStep inherit from XPathStep
        XPathStep.prototype,
        {
            constructor: {
                configurable: true,
                enumerable: true,
                value: IndexedXPathStep,
                writable: true
            },

            position: {
                configurable: true,
                enumerable: true,
                get: function () {
                    return this.predicates[0];
                }
            }
        }
    );

    function IndexedXPath(steps, absolute) {
        for (var i = steps.length; i--;) {
            if (!(steps[i] instanceof IndexedXPathStep)) {
                throw new TypeError("All steps element must be an instance of IndexedXPathStep.");
            }
        }
        LocationXPath.call(this, steps, absolute);
    }

    IndexedXPath.prototype = Object.create(
        LocationXPath.prototype,
        {
            constructor: {
                configurable: true,
                enumerable: true,
                value: IndexedXPath,
                writable: true
            }
        }
    );

    function getIndexedXPathStep(node) { //transform type
        var nodetest = "node()";

        if (node.nodeType === Node.ELEMENT_NODE) {
            nodetest = node.tagName.toLowerCase();
        } else if (node.nodeType === Node.TEXT_NODE) {
            nodetest = "text()";
        }

        var elements = evaluateXPath("./" + nodetest, node.parentNode);
        var elementsLength = elements.length, position = 0;

        for (var i = 0; i < elementsLength; i++) {
            if (elements[i].isSameNode(node)) {
                position = i + 1;
                break;
            }
        }
        return new IndexedXPathStep(nodetest, position);
    }

    function getIndexedXPath(node) {
        var steps = [];
        var goUp = true;

        while (goUp) {
            if (node.nodeName.toUpperCase() === "HTML") {
                goUp = false;
            }

            var step = getIndexedXPathStep(node);
            steps.push(step);
            node = node.parentNode;
        }
        return new IndexedXPath(steps.reverse()); //IndexedXPathStep chain
    }

    function parseIndexedXPath(str) {
        var splitted = str.split("/");
        var absolute = splitted[0] === "";
        splitted.shift();
        var stepPattern = /([0-9a-zA-Z@()]+)\[(\d+)\]/;
        var nOfSteps = splitted.length;
        var indexedXPathSteps = [];

        for (var i = 0; i < nOfSteps; i++) {
            var matches = stepPattern.exec(splitted[i]);
            var step = new IndexedXPathStep(matches[1], parseInt(matches[2]));
            indexedXPathSteps.push(step);
        }
        return new IndexedXPath(indexedXPathSteps, absolute);
    }

    // exports
    Webdext.XPath = {
        XPathStep: XPathStep,
        LocationXPath: LocationXPath,
        IndexedXPathStep: IndexedXPathStep,
        IndexedXPath: IndexedXPath,
        getIndexedXPathStep: getIndexedXPathStep,
        getIndexedXPath: getIndexedXPath,
        parseIndexedXPath: parseIndexedXPath
    };
}).call(this);

; (function (undefined) {
    "use strict";

    function defaultSubstitutionCost(e1, e2) {
        if (e1 === e2) {
            return 0;
        }
        return Number.MAX_VALUE;
    }

    function defaultInsertionCost() {
        return 1;
    }

    function defaultDeletionCost() {
        return 1;
    }

    function editDistance(s1, s2, substitutionCost, insertionCost, deletionCost) {
        if (typeof substitutionCost === "undefined" || substitutionCost === null) {
            substitutionCost = defaultSubstitutionCost;
        } else if (typeof substitutionCost !== "function") {
            throw new TypeError("substitutionCost must be a function.");
        }

        if (typeof insertionCost === "undefined" || insertionCost === null) {
            insertionCost = defaultInsertionCost;
        } else if (typeof insertionCost !== "function") {
            throw new TypeError("insertionCost must be a function.");
        }

        if (typeof deletionCost === "undefined" || deletionCost === null) {
            deletionCost = defaultDeletionCost;
        } else if (typeof deletionCost !== "function") {
            throw new TypeError("deletionCost must be a function.");
        }

        var s1Length = s1.length,
            s2Length = s2.length,
            m = new Array(s1Length + 1); //(s2Length+1) x (s1Length+1)

        for (var i = 0; i <= s1Length; i++) {
            m[i] = new Array(s2Length + 1);
            m[i][0] = i;
        }

        for (var j = 1; j <= s2Length; j++) {
            m[0][j] = j;
        }

        for (i = 1; i <= s1Length; i++) {
            for (j = 1; j <= s2Length; j++) {
                var alignment = m[i - 1][j - 1] + substitutionCost(s1[i - 1], s2[j - 1]);
                var insertion = m[i][j - 1] + insertionCost(s2[j - 1]);
                var deletion = m[i - 1][j] + deletionCost(s1[i - 1]);

                m[i][j] = Math.min(alignment, insertion, deletion);
            }
        }
        return m[s1Length][s2Length];
    }

    function alignPairwise(s1, s2, substitutionCost, insertionCost, deletionCost) {
        if (typeof substitutionCost === "undefined" || substitutionCost === null) {
            substitutionCost = defaultSubstitutionCost;
        } else if (typeof substitutionCost !== "function") {
            throw new TypeError("substitutionCost must be a function.");
        }

        if (typeof insertionCost === "undefined" || insertionCost === null) {
            insertionCost = defaultInsertionCost;
        } else if (typeof insertionCost !== "function") {
            throw new TypeError("insertionCost must be a function.");
        }

        if (typeof deletionCost === "undefined" || deletionCost === null) {
            deletionCost = defaultDeletionCost;
        } else if (typeof deletionCost !== "function") {
            throw new TypeError("deletionCost must be a function.");
        }

        var STEP = {
            "Alignment": 0,
            "Insertion": 1,
            "Deletion": 2
        },
            s1Length = s1.length,
            s2Length = s2.length,
            m = new Array(s1Length + 1),
            steps = new Array(s1Length + 1);

        for (var i = 0; i <= s1Length; i++) {
            m[i] = new Array(s2Length + 1);
            m[i][0] = i;
            steps[i] = new Array(s2Length + 1);

            if (i === 0) {
                steps[i][0] = STEP.Alignment;
            } else {
                steps[i][0] = STEP.Deletion;
            }
        }

        for (var j = 1; j <= s2Length; j++) {
            m[0][j] = j;
            steps[0][j] = STEP.Insertion;
        }

        for (i = 1; i <= s1Length; i++) {
            for (j = 1; j <= s2Length; j++) {
                var alignment = m[i - 1][j - 1] + substitutionCost(s1[i - 1], s2[j - 1]);
                var insertion = m[i][j - 1] + insertionCost(s2[j - 1]);
                var deletion = m[i - 1][j] + deletionCost(s1[i - 1]);

                m[i][j] = Math.min(alignment, insertion, deletion);

                if (m[i][j] === alignment) {
                    steps[i][j] = STEP.Alignment;
                } else if (m[i][j] === insertion) {
                    steps[i][j] = STEP.Insertion;
                } else if (m[i][j] === deletion) {
                    steps[i][j] = STEP.Deletion;
                }
            }
        }

        i = s1Length;
        j = s2Length;
        var alignedSequence = [];

        while (i > 0 || j > 0) {
            var step = steps[i][j];
            if (step === STEP.Alignment) {
                alignedSequence.push([s1[i - 1], s2[j - 1]]);
                i--;
                j--;
            } else if (step === STEP.Insertion) {
                alignedSequence.push([null, s2[j - 1]]);
                j--;
            } else if (step === STEP.Deletion) {
                alignedSequence.push([s1[i - 1], null]);
                i--;
            }
        }
        return alignedSequence.reverse();
    }

    // @TODO
    // function alignMultiple = function(sequences) {
    // };

    function commonSubsequenceLength(alignment) {
        var counter = 0,
            alignmentLength = alignment.length;

        for (var i = 0; i < alignmentLength; i++) {
            var common = true,
                first = alignment[i][0];

            if (first === null) {
                common = false;
            } else {
                var alignmentColumnLength = alignment[i].length;
                for (var j = 1; j < alignmentColumnLength; j++) {
                    if (alignment[i][j] === null) {
                        common = false;
                        break;
                    } else if (alignment[i][j] !== first) {
                        common = false;
                        break;
                    }
                }
            }
            if (common) {
                counter++;
            }
        }
        return counter;
    }

    // exports
    Webdext.Sequal = {
        editDistance: editDistance,
        alignPairwise: alignPairwise,
        commonSubsequenceLength: commonSubsequenceLength
    };
}).call(this);

; (function (undefined) {
    "use strict";

    // imports
    var evaluateXPath = Webdext.evaluateXPath;
    var getIndexedXPath = Webdext.XPath.getIndexedXPath;

    var DATA_TYPE = {
        TEXT: 1,
        HYPERLINK: 2,
        IMAGE: 3,
        META:4 //Edit by Kris
    };
    var SKIP_ELEMENTS = ["SCRIPT", "STYLE", "OBJECT", "PARAM", "SVG"];

    var nodeIndexCounter = 0;

    /*
     * When native Map implementation is not available on the environment 
     */
    if (typeof Map === "undefined") {
        var Iterator = function (data) {
            this.data = data;
            this.currentIndex = 0;
        };
        Iterator.prototype.next = function () {
            if (this.currentIndex >= this.data.length) {
                return { value: undefined, done: true };
            }
            return { value: this.data[this.currentIndex++], done: false };
        };
        var MapIterator = function (map) {
            this.map = map;
            this.currentIndex = 0;
        };
        MapIterator.prototype.next = function () {
            if (this.currentIndex >= this.map._keys.length) {
                return { value: undefined, done: true };
            }
            var value = [];
            value.push(this.map._keys[this.currentIndex]);
            value.push(this.map._values[this.currentIndex]);
            this.currentIndex++;
            return { value: value, done: false };
        };

        this.Map = function () {
            this._keys = [];
            this._values = [];
        };
        this.Map.prototype.set = function (key, value) {
            var index = this._keys.indexOf(key);
            if (index === -1) {
                this._keys.push(key);
                this._values.push(value);
            } else {
                this._values[index] = value;
            }
        };
        this.Map.prototype.get = function (key) {
            var index = this._keys.indexOf(key);
            if (index !== -1) {
                return this._values[index];
            }
        };
        this.Map.prototype.delete = function (key) {
            var index = this._keys.indexOf(key);
            if (index > -1) {
                this._keys.splice(index, 1);
                return this._values.splice(index, 1)[0];
            } else {
                return null;
            }
        };
        this.Map.prototype.has = function (key) {
            return !(this._keys.indexOf(key) === -1);
        };
        this.Map.prototype.clear = function () {
            this._keys.splice(0, this._keys.length);
            this._values.splice(0, this._values.length);
        };
        this.Map.prototype.keys = function () {
            return new Iterator(this._keys);
        };
        this.Map.prototype.values = function () {
            return new Iterator(this._values);
        };
        this.Map.prototype.entries = function () {
            return new MapIterator(this);
        };

        Object.defineProperty(
            this.Map.prototype,
            "size",
            {
                get: function () {
                    return this._keys.length;
                }
            }
        );
    }

    function mergeArrayUnique(array1, array2) { //union of two arrays
        var mergeArray = array1.concat([]);
        var array2Length = array2.length;

        for (var i = 0; i < array2Length; i++) {
            var element = array2[i];
            if (mergeArray.indexOf(element) === -1) {
                mergeArray.push(element);
            }
        }
        return mergeArray;
    }

    function Vertex(data) {
        if (data) {
            this.data = data;
        } else {
            this.data = [];
        }
    }

    function DirectedAcyclicGraph(vertices) {
        if (vertices) {
            this.vertices = vertices;
        } else {
            this.vertices = [];
        }
        this.outboundMap = new Map();
    }

    DirectedAcyclicGraph.prototype.addVertex = function (vertex) {
        this.vertices.push(vertex);
    };
    DirectedAcyclicGraph.prototype.numOfVertices = function () {
        return this.vertices.length;
    };
    DirectedAcyclicGraph.prototype.createEdge = function (fromVertex, toVertex) {
        var outboundVertices = this.outboundMap.get(fromVertex);
        if (outboundVertices) {
            if (outboundVertices.indexOf(toVertex) === -1) {
                outboundVertices.push(toVertex);
            }
        } else {
            outboundVertices = [toVertex];
            this.outboundMap.set(fromVertex, outboundVertices);
        }
    };
    DirectedAcyclicGraph.prototype._isBeforeOrder = function (vertex1, vertex2) {
        // determin whether vertex1 appears before vertex2
        var outboundVertices = this.outboundMap.get(vertex1);

        if (!outboundVertices) {
            return false;
        }

        if (outboundVertices.indexOf(vertex2) > -1) {
            return true;
        }

        for (var i = outboundVertices.length; i--;) {
            if (this._isBeforeOrder(outboundVertices[i], vertex2)) {
                return true;
            }
        }

        return false;
    };
    
    DirectedAcyclicGraph.prototype.isBeforeOrder = function (vertex1, vertex2) {
        if (vertex1 === vertex2) {
            return false;
        }

        var isVertex1BeforeVertex2 = this._isBeforeOrder(vertex1, vertex2);
        var isVertex2BeforeVertex1 = this._isBeforeOrder(vertex2, vertex1);

        if (isVertex1BeforeVertex2) {
            return true;
        }

        if (isVertex2BeforeVertex1) {
            return false;
        }

        this.createEdge(vertex1, vertex2);
        return true;
    };
    
    DirectedAcyclicGraph.prototype.isPathExists = function (vertex1, vertex2) {
        if (vertex1 === vertex2) {
            return true;
        }

        var isVertex1BeforeVertex2 = this._isBeforeOrder(vertex1, vertex2);
        var isVertex2BeforeVertex1 = this._isBeforeOrder(vertex2, vertex1);

        return isVertex1BeforeVertex2 || isVertex2BeforeVertex1;
    };

    DirectedAcyclicGraph.prototype.mergeVertices = function (vertex1, vertex2) {
        var mergedData = mergeArrayUnique(vertex1.data, vertex2.data);
        var mergedVertex = new Vertex(mergedData);
        this.vertices.splice(this.vertices.indexOf(vertex1), 1);
        this.vertices.splice(this.vertices.indexOf(vertex2), 1);
        this.vertices.push(mergedVertex);

        var outboundVertices1 = this.outboundMap.get(vertex1);
        var outboundVertices2 = this.outboundMap.get(vertex2);

        if (!outboundVertices1 && !Array.isArray(outboundVertices1)) {
            outboundVertices1 = [];
        }

        if (!outboundVertices2 && !Array.isArray(outboundVertices2)) {
            outboundVertices2 = [];
        }

        var outboundVertices = outboundVertices1.concat(outboundVertices2);
        if (outboundVertices.length > 0) {
            this.outboundMap.delete(vertex1);
            this.outboundMap.delete(vertex2);
            this.outboundMap.set(mergedVertex, outboundVertices);
        }

        var valueIterator = this.outboundMap.values(), //All outboundVertice arrays
            value = valueIterator.next();

        while (!value.done) {
            var indexOfVertex1 = value.value.indexOf(vertex1);
            var indexOfVertex2 = value.value.indexOf(vertex2);

            if (indexOfVertex1 > -1) {
                value.value.splice(indexOfVertex1, 1);
            }

            if (indexOfVertex2 > -1) {
                value.value.splice(indexOfVertex2, 1);
            }

            if (indexOfVertex1 > -1 || indexOfVertex2 > -1) {
                value.value.push(mergedVertex);
            }

            value = valueIterator.next();
        }

        return mergedVertex; //merge data, modify inboundMap and outboundMap
    };

    function normVector(vector) { //calculate a vector's 'length'
        var values = [];
        for (var key in vector) {
            values.push(vector[key]);
        }

        if (Math.hasOwnProperty("hypot")) {
            return Math.hypot.apply(null, values);
        } else {
            var sum = 0, valuesLength = values.length;
            for (var i = valuesLength; i--;) {
                sum += Math.pow(values[i], 2);
            }
            return Math.sqrt(sum);
        }
    }

    function parseUrl(url) {
        var parsedUrl = new URL(url);

        if (Object.keys(parsedUrl).length > 0) {
            return {
                "url": url,
                "hostname": parsedUrl.hostname,
                "pathname": parsedUrl.pathname
            };
        }

        var parser = document.createElement("a");
        parser.href = url;

        return {
            "url": url,
            "hostname": parser.hostname,
            "pathname": parser.pathname
        };
    }

    function TagPathStep(tagName, direction) {
        this.tagName = tagName;
        this.direction = direction;
        this.value = this.tagName + "," + this.direction;
    }
    TagPathStep.prototype.toString = function () {
        return "<" + this.tagName + ">" + this.direction;
    };

    function getTagPath(node, contextNode) {
        if (typeof contextNode === "undefined") {
            contextNode = document.documentElement.parentNode;
        }

        var tagPath = [],
            currentNode = node;

        while (currentNode !== contextNode) {
            var prevSibling = currentNode.previousSibling,
                parentNode = currentNode.parentNode;

            if (prevSibling !== null &&
                [Node.ELEMENT_NODE, Node.TEXT_NODE].indexOf(prevSibling.nodeType) > -1
            ) {
                tagPath.push(new TagPathStep(prevSibling.nodeName, "S"));
                currentNode = prevSibling;
            } else if (prevSibling !== null) {
                currentNode = prevSibling;
            } else if (parentNode.nodeType === Node.ELEMENT_NODE) {
                tagPath.push(new TagPathStep(parentNode.nodeName, "C"));
                currentNode = parentNode;
            } else {
                currentNode = contextNode;
            }
        }

        return tagPath.reverse();
    }

    function createTermFrequencyVector(text) {
        var termFrequencyVector = {},
            terms = text.toLocaleLowerCase().split(" ");

        for (var i = terms.length; i--;) {
            var term = terms[i];
            if (term in termFrequencyVector) {
                termFrequencyVector[term]++;
            } else {
                termFrequencyVector[term] = 1;
            }
        }
        return termFrequencyVector;
    }

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

    function WNode(node, wParent) {
        this.nodeIndex = null;
        this.indexedXPath = getIndexedXPath(node);

        if (typeof wParent === "undefined" || wParent === null) {
            this.parent = null;
        } else {
            this.parent = wParent;
            this.parent.addChild(this);
        }
    }

    WNode.prototype.xpath = function () {
        return this.indexedXPath.toString();
    };

    WNode.prototype.getSiblingIndex = function () {
        if (this.parent !== null) {
            return this.parent.getChildIndex(this);
        }
        return 0;
    };

    function WElementNode(node, wParent) {
        WNode.call(this, node, wParent);
        this.tagName = node.nodeName;
        this.children = null;

        var rect = node.getBoundingClientRect();
        this.area = roundToNearest5(rect.width * rect.height);
        this.rectangleSize = {
            "width": roundToNearest5(rect.width),
            "height": roundToNearest5(rect.height)
        };
        this.coordinate = {
            'left': roundToNearest5(rect.left+window.scrollX),
            'top': roundToNearest5(rect.top+window.scrollY),
        };
    }

    WElementNode.prototype = Object.create(
        WNode.prototype,
        {
            constructor: {
                configurable: true,
                enumerable: true,
                value: WElementNode,
                writable: true
            },
            dataContent: {
                get: function () {
                    var leafNodes = this.getLeafNodes();
                    var leafNodesLength = leafNodes.length;
                    var dc = [];

                    for (var i = 0; i < leafNodesLength; i++) {
                        var leafNode = leafNodes[i];

                        if (!leafNode.isSeparatorNode()) {
                            dc.push(leafNode.dataContent);
                        }
                    }
                    return dc.join(" ");
                }
            }
        }
    );

    WElementNode.prototype.addChild = function (wNode) {
        if (this.children === null) {
            this.children = [];
        }
        if (wNode instanceof WNode) {
            this.children.push(wNode);
        } else
            throw new TypeError("addChild() must receive a WNode argument.");
    };

    WElementNode.prototype.isLeafNode = function () {
        return this.getChildrenCount() === 0;
    };

    WElementNode.prototype.isSeparatorNode = function () {
        if (this.isLeafNode()) {
            return true;
        } else {
            var leafNodes = this.getLeafNodes();
            return leafNodes.every(function (l) {
                return l.isSeparatorNode();
            });
        }
    };

    WElementNode.prototype.getChild = function (childIndex) {
        if (this.children === null)
            throw new RangeError("This node doesn't have any children.");

        if (childIndex > this.children.length || childIndex < 1)
            throw new RangeError("childIndex is out of range when calling getChild().");

        return this.children[childIndex - 1];
    };

    WElementNode.prototype.getChildIndex = function (wNode) {
        if (this.children === null)
            return 0;
        return this.children.indexOf(wNode) + 1;
    };

    WElementNode.prototype.getChildrenCount = function () {
        if (this.children === null)
            return 0;
        return this.children.length;
    };

    WElementNode.prototype.getChildrenSubset = function (startIndex, stopIndex) {
        if (typeof stopIndex === "undefined")
            stopIndex = this.children.length;

        if (this.children === null)
            throw new RangeError("This node doesn't have any children.");

        var n_of_children = this.children.length;
        if (n_of_children === 0) {
            throw new RangeError("This node doesn't have any children.");
        } else if (startIndex > n_of_children) {
            throw new RangeError("startIndex is out of range.");
        } else if (stopIndex > n_of_children) {
            throw new RangeError("stopIndex is out of range.");
        } else if (startIndex <= 0) {
            throw new RangeError("startIndex can't be less than or equals to zero.");
        } else if (stopIndex <= 0) {
            throw new RangeError("stopIndex can't be less than or equals to zero.");
        } else if (startIndex > stopIndex) {
            throw new RangeError("startIndex can't be greater than stopIndex.");
        }
        return this.children.slice(startIndex - 1, stopIndex);
    };

    WElementNode.prototype.getLeafNodes = function () {
        if (this.isLeafNode())
            return [this];

        var leafNodes = [],
            childrenLength = this.children.length;

        for (var i = 0; i < childrenLength; i++) {
            var c = this.children[i];

            if (c.isLeafNode()) {
                leafNodes.push(c);
            } else {
                var childLeafNodes = c.getLeafNodes();
                var childLeafNodesLength = childLeafNodes.length;

                for (var j = 0; j < childLeafNodesLength; j++) {
                    leafNodes.push(childLeafNodes[j]);
                }
            }
        }
        return leafNodes;
    };

    function WTextNode(node, wParent) {
        WNode.call(this, node, wParent);
        this.tagPath = getTagPath(node);
        this.textContent = node.nodeValue.trim().replace(/\s+/, " ");
        this.termFrequencyVector = createTermFrequencyVector(this.textContent);
        this.normVector = normVector(this.termFrequencyVector);
        this.dataType = DATA_TYPE.TEXT;
        this.presentationStyle = getPresentationStyle(node);
    }

    WTextNode.prototype = Object.create(
        WNode.prototype,
        {
            constructor: {
                configurable: true,
                enumerable: true,
                value: WTextNode,
                writable: true
            },
            dataContent: {
                get: function () {
                    return this.textContent;
                }
            }
        }
    );
    WTextNode.prototype.isLeafNode = function () {
        return true;
    };
    WTextNode.prototype.isSeparatorNode = function () {
        return false;
    };
    WTextNode.prototype.getLeafNodes = function () {
        return [this];
    };

    function WHyperlinkNode(node, wParent) {
        WNode.call(this, node, wParent);
        this.tagPath = getTagPath(node);

        if (node.href || node.rel || node.getAttribute('data-url')) { // ?
            this.href = parseUrl(node.href || node.rel || node.getAttribute('data-url'));
        } else{
            this.href = null;
        }

        this.dataType = DATA_TYPE.HYPERLINK;
        this.presentationStyle = getPresentationStyle(node);
    }
    WHyperlinkNode.prototype = Object.create(
        WNode.prototype,
        {
            constructor: {
                configurable: true,
                enumerable: true,
                value: WHyperlinkNode,
                writable: true
            },
            dataContent: {
                get: function () {
                    if (this.href) {
                        return this.href.url;
                    }

                    return "";
                }
            }
        }
    );
    WHyperlinkNode.prototype.xpath = function () {
        return this.indexedXPath.toString() + "/@href[1]";
    };
    WHyperlinkNode.prototype.isLeafNode = function () {
        return true;
    };
    WHyperlinkNode.prototype.isSeparatorNode = function () {
        return false;
    };
    WHyperlinkNode.prototype.getLeafNodes = function () {
        return [this];
    };

    function WImageNode(node, wParent) {
        WElementNode.call(this, node, wParent);
        this.tagPath = getTagPath(node);

        if (node.src || node.getAttribute('data-src')) {  //data-src??
            this.src = parseUrl(node.src || node.getAttribute('data-src'));
        } else {
            this.src = null;
        }
        this.dataType = DATA_TYPE.IMAGE;
        this.presentationStyle = getPresentationStyle(node);
    }
    WImageNode.prototype = Object.create(
        WElementNode.prototype,
        {
            constructor: {
                configurable: true,
                enumerable: true,
                value: WImageNode,
                writable: true
            },
            dataContent: {
                get: function () {
                    if (this.src) {
                        return this.src.url;
                    }
                    return "";
                }
            }
        }
    );
    WImageNode.prototype.isLeafNode = function () {
        return true;
    };
    WImageNode.prototype.isSeparatorNode = function () {
        return false;
    };
    WImageNode.prototype.getLeafNodes = function () {
        return [this];
    };

    function createWNode(node, wParent) {
        var wNode = null;

        if (node.nodeType === Node.TEXT_NODE) {
            // don't create WTextNode for whitespace between elements
            if (node.nodeValue.replace(/\s+/, " ").trim() !== "") {
                wNode = new WTextNode(node, wParent);
                wNode.nodeIndex = nodeIndexCounter++;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (['PICTURE', 'FIGURE', 'IMG'].indexOf(node.nodeName.toUpperCase())>-1) {
                wNode = new WImageNode(node, wParent);
                wNode.nodeIndex = nodeIndexCounter++;
            } else {
                try {
                    wNode = new WElementNode(node, wParent);
                    wNode.nodeIndex = nodeIndexCounter++;
                } catch (error) {
                    console.error(error);
                }
                if (node.nodeName.toUpperCase() === "A") {
                    var wHyperlinkNode = new WHyperlinkNode(node, wNode);
                    wHyperlinkNode.nodeIndex = nodeIndexCounter++;
                }
            }
        }
        return wNode;
    }

    function createWTree(node, wParent) {
        if (typeof node === "undefined") {
            node = document.documentElement;
        }

        var wNode = createWNode(node, wParent);

        // skip HEAD children, we don't need them for data extraction
        if (node.nodeName === "HEAD") { //may need change
            return wNode;
        }

        var childNodes = node.childNodes;
        var cnLength = childNodes.length;

        for (var i = 0; i < cnLength; i++) {
            var childNode = childNodes[i];
            if ([Node.ELEMENT_NODE, Node.TEXT_NODE].indexOf(childNode.nodeType) === -1) {
                continue;
            }
            if (SKIP_ELEMENTS.indexOf(childNode.nodeName.toUpperCase()) > -1) {
                continue;
            }
            createWTree(childNode, wNode);
        }

        return wNode;
    }

    function findWNode(node, wRoot) {
        var indexedXPath = getIndexedXPath(node);
        // we don't need HTML step
        var steps = indexedXPath.steps.slice(1);
        var wNode = wRoot;

        while (steps.length > 0) {
            var step = steps.shift();
            var childrenCount = wNode.getChildrenCount();
            var index = 0;
            var isFound = false;

            for (var i = 0; i < childrenCount; i++) {
                var child = wNode.getChild(i + 1);
                if (child instanceof WElementNode) {
                    if (child.tagName.toUpperCase() === step.nodetest.toUpperCase()) {
                        index++;
                        if (index === step.position) {
                            wNode = child;
                            isFound = true;
                            break;
                        }
                    }
                } else if (child.dataType === DATA_TYPE.TEXT) {
                    var currentNode = evaluateXPath(child.indexedXPath.xpath())[0];
                    if (node.isSameNode(currentNode)) {
                        wNode = child;
                        isFound = true;
                        break;
                    }
                }
            }
            if (!isFound) {
                return null;
            }
        }
        return wNode;
    }

    // exports
    Webdext.Model = {
        DATA_TYPE: DATA_TYPE,
        SKIP_ELEMENTS: SKIP_ELEMENTS,

        Vertex: Vertex,
        DirectedAcyclicGraph: DirectedAcyclicGraph,

        normVector: normVector,
        parseUrl: parseUrl,

        TagPathStep: TagPathStep,
        getTagPath: getTagPath,

        createTermFrequencyVector: createTermFrequencyVector,
        getPresentationStyle: getPresentationStyle,

        WNode: WNode,
        WElementNode: WElementNode,
        WTextNode: WTextNode,
        WHyperlinkNode: WHyperlinkNode,
        WImageNode: WImageNode,

        createWNode: createWNode,
        createWTree: createWTree,
        findWNode: findWNode
    };
}).call(this);

; (function (undefined) {
    "use strict";

    // imports
    var DATA_TYPE = Webdext.Model.DATA_TYPE,
        getValueFromPairMap = Webdext.getValueFromPairMap,
        sequenceEditDistance = Webdext.Sequal.editDistance;

    var WEIGHTS = {
        DATA_TYPE: 1,
        DATA_CONTENT: 0.49,
        TAG_PATH: 0.48,
        PRESENTATION_STYLE: 0.81,
        RECTANGLE_SIZE: 0.81
    };
    var TOTAL_WEIGHTS = {
        TEXT: WEIGHTS.DATA_TYPE + WEIGHTS.DATA_CONTENT + WEIGHTS.PRESENTATION_STYLE,
        HYPERLINK: WEIGHTS.DATA_TYPE + WEIGHTS.DATA_CONTENT + WEIGHTS.PRESENTATION_STYLE,
        IMAGE: WEIGHTS.DATA_TYPE + WEIGHTS.DATA_CONTENT + WEIGHTS.RECTANGLE_SIZE
    };
    var THRESHOLDS = {
        ELEMENT_NODE: 0.81, //initial value: 0.99 
        TEXT_NODE: 0.72,
        HYPERLINK_NODE: 0.9,
        IMAGE_NODE: 0.9,
        TREE: 0.5
    };
    var MATCH_WEIGHTS = {
        VISUALLY_ALIGNED: 3,
        NOT_VISUALLY_ALIGNED: 0.1
    };

    var treeClusterMap = new Map();

    function dotProduct(tfv1, tfv2) { //calculate product value of common term frequences from two term frequence vect 
        var terms1 = Object.keys(tfv1),
            terms2 = Object.keys(tfv2),
            longerTerms = terms1,
            shorterTerms = terms2,
            terms1Length = terms1.length,
            terms2Length = terms2.length,
            shorterTermsLength = terms2Length;

        if (terms1Length < terms2Length) {
            longerTerms = terms2;
            shorterTerms = terms1;
            shorterTermsLength = terms1Length;
        }

        var dotProduct = 0;
        for (var i = shorterTermsLength; i--;) {
            var term = shorterTerms[i];
            if (longerTerms.indexOf(term) > -1) {
                dotProduct += tfv1[term] * tfv2[term];
            }
        }

        return dotProduct;
    }

    function cosineSimilarity(wNode1, wNode2) {
        var tfv1 = wNode1.termFrequencyVector,
            tfv2 = wNode2.termFrequencyVector,
            dp = dotProduct(tfv1, tfv2);

        if (dp === 0) {
            return 0;
        }

        return dp / (wNode1.normVector * wNode2.normVector);
    }

    function urlSimilarity(url1, url2) {
        if (url1 === null && url2 === null) {
            return 1;
        } else if (url1 === null || url2 === null) {
            return 0;
        }

        var hostNameSimilarity = url1.hostname === url2.hostname ? 1 : 0;
        var pathNameSimilarity = url1.pathname === url2.pathname ? 1 : 0.5;
        // var pathNameEditDistance = sequenceEditDistance(url1.pathname, url2.pathname);
        // var normalizedEditDistance = pathNameEditDistance / (
        //     url1.pathname.length + url2.pathname.length
        // );
        // var pathNameSimilarity = 1 - normalizedEditDistance;

        return (hostNameSimilarity + pathNameSimilarity) / 2;
    }

    function tagPathSubstitutionCost(e1, e2) {
        if (e1.value === e2.value) {
            return 0;
        } else {
            return 2;
        }
    }

    function tagPathInsertionCost() {
        return 1;
    }

    function tagPathDeletionCost() {
        return 1;
    }

    function tagPathEditDistance(tp1, tp2) {
        return sequenceEditDistance(
            tp1,
            tp2,
            tagPathSubstitutionCost,
            tagPathInsertionCost,
            tagPathDeletionCost
        );
    }

    function tagPathSimilarity(tp1, tp2) {
        if (tp1.length === 0 && tp2.length === 0) {
            return 1;
        }

        var editDistance = tagPathEditDistance(tp1, tp2);

        return 1.0 - (editDistance / (tp1.length + tp2.length));
    }

    function presentationStyleSimilarity(ps1, ps2) {
        var styles = Object.keys(ps1);
        var stylesLength = styles.length,
            similarStylesCount = 0;

        for (var i = stylesLength; i--;) {
            var style = styles[i];
            if (ps1[style] === ps2[style]) {
                similarStylesCount++;
            }
        }

        return similarStylesCount / stylesLength;
    }

    function rectangleSizeSimilarity(rs1, rs2) {
        var maxWidth = Math.max(rs1.width, rs2.width);
        var normalizedWidthDiff = 0;
        if (maxWidth !== 0) {
            normalizedWidthDiff = Math.abs(rs1.width - rs2.width) / maxWidth;
        }

        var maxHeight = Math.max(rs1.height, rs2.height);
        var normalizedHeightDiff = 0;
        if (maxHeight !== 0) {
            normalizedHeightDiff = Math.abs(rs1.height - rs2.height) / maxHeight;
        }

        return 1 - ((normalizedWidthDiff + normalizedHeightDiff) / 2);
    }

    function wElementNodeSimilarity(wen1, wen2) {
        return wen1.tagName.toUpperCase() === wen2.tagName.toUpperCase() ? 1 : 0;
    }

    function wTextNodeSimilarity(wtn1, wtn2) {
        var cosineSim = cosineSimilarity(wtn1, wtn2);
        var weightedCosineSim = cosineSim * WEIGHTS.DATA_CONTENT;

        // var tagPathSim = tagPathSimilarity(wtn1.tagPath, wtn2.tagPath);
        // var weightedTagPathSim = tagPathSim * WEIGHTS.TAG_PATH;

        var psSim = presentationStyleSimilarity(wtn1.presentationStyle, wtn2.presentationStyle);
        var weightedPSSim = psSim * WEIGHTS.PRESENTATION_STYLE;

        // var totalSim = weightedCosineSim + weightedTagPathSim + weightedPSSim + WEIGHTS.DATA_TYPE;
        var totalSim = weightedCosineSim + weightedPSSim + WEIGHTS.DATA_TYPE;

        return totalSim / TOTAL_WEIGHTS.TEXT;
    }

    function wHyperlinkNodeSimilarity(whn1, whn2) {
        var urlSim = urlSimilarity(whn1.href, whn2.href);
        var weightedUrlSim = urlSim * WEIGHTS.DATA_CONTENT;

        // var tagPathSim = tagPathSimilarity(whn1.tagPath, whn2.tagPath);
        // var weightedTagPathSim = tagPathSim * WEIGHTS.TAG_PATH;

        var psSim = presentationStyleSimilarity(whn1.presentationStyle, whn2.presentationStyle);
        var weightedPSSim = psSim * WEIGHTS.PRESENTATION_STYLE;

        // var totalSim = weightedUrlSim + weightedTagPathSim + weightedPSSim + WEIGHTS.DATA_TYPE;
        var totalSim = weightedUrlSim + weightedPSSim + WEIGHTS.DATA_TYPE;

        return totalSim / TOTAL_WEIGHTS.HYPERLINK;
    }

    function wImageNodeSimilarity(win1, win2) {
        var urlSim = urlSimilarity(win1.src, win2.src);
        var weightedUrlSim = urlSim * WEIGHTS.DATA_CONTENT;

        // var tagPathSim = tagPathSimilarity(win1.tagPath, win2.tagPath);
        // var weightedTagPathSim = tagPathSim * WEIGHTS.TAG_PATH;

        var rsSim = rectangleSizeSimilarity(win1.rectangleSize, win2.rectangleSize);
        var weightedRSSim = rsSim * WEIGHTS.RECTANGLE_SIZE;

        // var totalSim = weightedUrlSim + weightedTagPathSim + weightedRSSim + WEIGHTS.DATA_TYPE;
        var totalSim = weightedUrlSim + weightedRSSim + WEIGHTS.DATA_TYPE;

        return totalSim / TOTAL_WEIGHTS.IMAGE;
    }


    function wNodeSimilarity(wNode1, wNode2) {
        if (wNode1.dataType !== wNode2.dataType) {
            return 0;
        }
        if (wNode1.dataType === DATA_TYPE.TEXT) {
            return wTextNodeSimilarity(wNode1, wNode2);
        } else if (wNode1.dataType === DATA_TYPE.HYPERLINK) {
            return wHyperlinkNodeSimilarity(wNode1, wNode2);
        } else if (wNode1.dataType === DATA_TYPE.IMAGE) {
            return wImageNodeSimilarity(wNode1, wNode2);
        } else {
            return wElementNodeSimilarity(wNode1, wNode2);
        }
    }

    function SimilarityMap(similarityFunction) { //  format is like: {wNode1: {wNode2: similarity}}  
        //  similarity: result after calling similarityFunction(wNode1, wNode2)
        this.map = new Map();
        this.similarityFunction = similarityFunction;
    }
    SimilarityMap.prototype.get = function (wNode1, wNode2) {
        if (this.map.has(wNode1) && this.map.get(wNode1).has(wNode2)) {
            return this.map.get(wNode1).get(wNode2);
        } else if (this.map.has(wNode2) && this.map.get(wNode2).has(wNode1)) {
            return this.map.get(wNode2).get(wNode1);
        }

        var similarity = this.similarityFunction(wNode1, wNode2);
        if (this.map.has(wNode1)) {
            this.map.get(wNode1).set(wNode2, similarity);
        } else if (this.map.has(wNode2)) {
            this.map.get(wNode2).set(wNode1, similarity);
        } else {
            var innerMap = new Map();
            innerMap.set(wNode2, similarity);
            this.map.set(wNode1, innerMap);
        }

        return similarity;
    };

    var wTextNodeSimilarityMap = new SimilarityMap(wTextNodeSimilarity);
    var wHyperlinkNodeSimilarityMap = new SimilarityMap(wHyperlinkNodeSimilarity);
    var wImageNodeSimilarityMap = new SimilarityMap(wImageNodeSimilarity);

    function memoizedWTextNodeSimilarity(wNode1, wNode2) {
        return wTextNodeSimilarityMap.get(wNode1, wNode2);
    }

    function memoizedWHyperlinkNodeSimilarity(wNode1, wNode2) {
        return wHyperlinkNodeSimilarityMap.get(wNode1, wNode2);
    }

    function memoizedWImageNodeSimilarity(wNode1, wNode2) {
        return wImageNodeSimilarityMap.get(wNode1, wNode2);
    }

    /*
    * Complexity = cluster1.length * cluster2.length
    */
    function clusterSimilarity(cluster1, cluster2, dataSimilarityFunc) {
        var sum = 0,
            cluster1Length = cluster1.length,
            cluster2Length = cluster2.length;

        for (var i = cluster1Length; i--;) {
            for (var j = cluster2Length; j--;) {
                sum += dataSimilarityFunc(cluster1[i], cluster2[j]);
            }
        }

        return sum / (cluster1Length * cluster2Length);
    }

    function findClusters( //!!!
        nodeSet, similarityThreshold, clusterSimilarityFunc, nodeSimilarityFunc
    ) {
        var clusters = [],
            nodeSetLength = nodeSet.length,
            simPairMap = new Map();

        for (var i = 0; i < nodeSetLength; i++) {
            clusters.push([nodeSet[i]]);
        }

        // Need nodeSetLength > 100 to optimize on amazon.com-search pages
        if (nodeSetLength === 1 || nodeSetLength > 499) {
            return clusters;
        }

        // get distance for all possible pairs
        // consider removing this and rely on memoization
        for (i = 0; i < nodeSetLength - 1; i++) {
            var innerMap = new Map();

            for (var j = i + 1; j < nodeSetLength; j++) {
                var similarity = nodeSimilarityFunc(nodeSet[i], nodeSet[j]);
                innerMap.set(nodeSet[j], similarity);
            }

            simPairMap.set(nodeSet[i], innerMap);
        }

        // get nearest neighbor for each 1-element cluster
        var nearestNeighbors = new Map();
        for (i = 0; i < nodeSetLength; i++) {
            var maxSimilarity = Number.MIN_VALUE,
                nnIndex = i;

            for (j = 0; j < nodeSetLength; j++) {
                if (i !== j) {
                    var currSimilarity = getValueFromPairMap(
                        simPairMap,
                        nodeSet[i],
                        nodeSet[j]
                    );
                    if (currSimilarity > maxSimilarity) {
                        maxSimilarity = currSimilarity;
                        nnIndex = j;
                    }
                }
            }

            nearestNeighbors.set(
                clusters[i],
                { cluster: clusters[nnIndex], similarity: maxSimilarity }
            );
        }

        var csf = function (c1, c2) {
            return clusterSimilarityFunc(c1, c2, nodeSimilarityFunc);
        };
        var clusterSimMap = new SimilarityMap(csf);

        while (clusters.length > 1) {
            var maxSimilarity = Number.MIN_VALUE,
                toMerge1 = null,
                toMerge2 = null;

            // find pair with maximum similarity
            var entryIterator = nearestNeighbors.entries(),
                entry = entryIterator.next();

            while (!entry.done) {
                var nn = entry.value[1];

                // consider speed up when similarity == 1
                if (nn.similarity > maxSimilarity) {
                    toMerge1 = entry.value[0];
                    toMerge2 = nn.cluster;
                    maxSimilarity = nn.similarity;
                }

                entry = entryIterator.next();
            }

            // stop clustering
            if (maxSimilarity <= similarityThreshold) {
                break;
            }

            // merging
            clusters.splice(clusters.indexOf(toMerge2), 1);
            toMerge1.push.apply(toMerge1, toMerge2);
            nearestNeighbors.delete(toMerge2);

            // find clusters whose nearest neighbor may be affected by merging
            var affectedClusters = [],
                newClusterLength = clusters.length;

            for (i = newClusterLength; i--;) {
                var c = clusters[i];
                if (c !== toMerge1) {
                    var nn = nearestNeighbors.get(c).cluster;
                    if (nn === toMerge1 || nn === toMerge2) {
                        affectedClusters.push(c);
                    }
                }
            }

            affectedClusters.push(toMerge1);
            var acLength = affectedClusters.length;

            // update nearest neighbor for affected cluster
            for (i = acLength; i--;) {
                var ac = affectedClusters[i],
                    maxSimilarity = Number.MIN_VALUE,
                    nnIndex;

                for (j = newClusterLength; j--;) {
                    if (ac !== clusters[j]) {
                        var currSimilarity = clusterSimMap.get(ac, clusters[j]);
                        if (currSimilarity > maxSimilarity) {
                            maxSimilarity = currSimilarity;
                            nnIndex = j;
                        }
                    }
                }

                nearestNeighbors.set(
                    ac,
                    { cluster: clusters[nnIndex], similarity: maxSimilarity }
                );
            }
        }
        return clusters;
    }

    function clusterWNodes(wNodeSet) {
        var wTextNodes = [],
            wHyperlinkNodes = [],
            wImageNodes = [],
            wElementNodes = [],
            wNodeSetLength = wNodeSet.length;

        for (var i = 0; i < wNodeSetLength; i++) {
            var wNode = wNodeSet[i];

            if (wNode.dataType === DATA_TYPE.TEXT) {
                wTextNodes.push(wNode);
            } else if (wNode.dataType === DATA_TYPE.HYPERLINK) {
                wHyperlinkNodes.push(wNode);
            } else if (wNode.dataType === DATA_TYPE.IMAGE) { //image in div background?
                wImageNodes.push(wNode);
            } else {
                wElementNodes.push(wNode);
            }
        }

        var elementClusters = [],
            textClusters = [],
            hyperlinkClusters = [],
            imageClusters = [];

        if (wElementNodes.length > 0) {
            elementClusters = findClusters(
                wElementNodes,
                THRESHOLDS.ELEMENT_NODE,
                clusterSimilarity,
                wElementNodeSimilarity
            );
        }

        if (wTextNodes.length > 0) {
            textClusters = findClusters(
                wTextNodes,
                THRESHOLDS.TEXT_NODE,
                clusterSimilarity,
                memoizedWTextNodeSimilarity
            );
        }

        if (wHyperlinkNodes.length > 0) {
            hyperlinkClusters = findClusters(
                wHyperlinkNodes,
                THRESHOLDS.HYPERLINK_NODE,
                clusterSimilarity,
                memoizedWHyperlinkNodeSimilarity
            );
        }

        if (wImageNodes.length > 0) {
            imageClusters = findClusters(
                wImageNodes,
                THRESHOLDS.IMAGE_NODE,
                clusterSimilarity,
                memoizedWImageNodeSimilarity
            );
        }

        var clusters = [];
        clusters.push.apply(clusters, elementClusters);
        clusters.push.apply(clusters, textClusters);
        clusters.push.apply(clusters, hyperlinkClusters);
        clusters.push.apply(clusters, imageClusters);

        return clusters;
    }

    /**
    * Complexity: 
    */
    function wTreeSimilarity(wTree1, wTree2) {
        var leafNodes1 = [],
            leafNodes2 = [];

        if (Array.isArray(wTree1)) {
            for (var i = 0, wTree1Length = wTree1.length; i < wTree1Length; i++) {
                leafNodes1.push.apply(leafNodes1, wTree1[i].getLeafNodes());
            }
        } else {
            leafNodes1 = wTree1.getLeafNodes();
        }

        if (Array.isArray(wTree2)) {
            for (var i = 0, wTree2Length = wTree2.length; i < wTree2Length; i++) {
                leafNodes2.push.apply(leafNodes2, wTree2[i].getLeafNodes());
            }
        } else {
            leafNodes2 = wTree2.getLeafNodes();
        }

        var leafNodes1Length = leafNodes1.length,
            leafNodes2Length = leafNodes2.length;

        for (var i = leafNodes1Length; i--;) {
            leafNodes1[i].inTree1 = true;
        }

        for (i = leafNodes2Length; i--;) {
            leafNodes2[i].inTree1 = false;
        }

        var leafNodesSet = leafNodes1.concat(leafNodes2);
        var leafNodeClusters = clusterWNodes(leafNodesSet);
        var leafNodeClustersLength = leafNodeClusters.length,
            nOfCluster1 = 0,
            nOfCluster2 = 0,
            nOfCluster1And2 = 0;

        for (i = leafNodeClustersLength; i--;) {
            var cluster = leafNodeClusters[i];
            var containsTree1Node = cluster.some(function (wNode) {
                return wNode.inTree1;
            });
            var containsTree2Node = cluster.some(function (wNode) {
                return !wNode.inTree1;
            });
            var containsBoth = containsTree1Node && containsTree2Node;

            if (containsBoth) {
                nOfCluster1++;
                nOfCluster2++;
                nOfCluster1And2++;
            } else if (containsTree1Node) {
                nOfCluster1++;
            } else if (containsTree2Node) {
                nOfCluster2++;
            }
        }

        for (i = leafNodes1Length + leafNodes2Length; i--;) {
            delete leafNodesSet[i].inTree1;
        }

        return nOfCluster1And2 / Math.max(nOfCluster1, nOfCluster2);
    }

    var wTreeSimilarityMap = new SimilarityMap(wTreeSimilarity);

    function memoizedWTreeSimilarity(wTree1, wTree2) {
        return wTreeSimilarityMap.get(wTree1, wTree2);
    }

    function filterTreeClusters(clusters, wNodeSet) {
        var clustersLength = clusters.length,
            filteredClusters = [];

        for (var i = 0; i < clustersLength; i++) {
            var cluster = clusters[i],
                clusterLength = cluster.length,
                filteredCluster = [];

            for (var j = 0; j < clusterLength; j++) {
                if (wNodeSet.indexOf(cluster[j]) > -1) {
                    filteredCluster.push(cluster[j]);
                }
            }

            if (filteredCluster.length > 0) {
                filteredClusters.push(filteredCluster);
            }
        }

        return filteredClusters;
    }

    function clusterWTrees(wNodeSet) {
        var parent = wNodeSet[0].parent;
        var clusters = treeClusterMap.get(parent);

        if (clusters) {
            if (parent.getChildrenCount() === wNodeSet.length) {
                return clusters;
            } else {
                return filterTreeClusters(clusters, wNodeSet);
            }
        }

        clusters = findClusters(
            wNodeSet,
            THRESHOLDS.TREE,
            clusterSimilarity,
            memoizedWTreeSimilarity
        );

        if (parent.getChildrenCount() === wNodeSet.length) {
            treeClusterMap.set(parent, clusters);
        }

        return clusters;
    }

    function wNodeMatchWeight(wNode1, wNode2) {
        if (wNode1.dataType && wNode2.dataType) {
            return wNodeSimilarity(wNode1, wNode2);
        }
        else {
            if (wNode1.tagName !== wNode2.tagName) {
                return 0;
            }

            var isSameLeftCoord = wNode1.coordinate.left === wNode2.coordinate.left;
            var isSameTopCoord = wNode1.coordinate.top === wNode2.coordinate.top;

            if (isSameLeftCoord || isSameTopCoord) {
                return MATCH_WEIGHTS.VISUALLY_ALIGNED;
            } else {
                return MATCH_WEIGHTS.NOT_VISUALLY_ALIGNED;
            }
        }
    }

    // exports
    Webdext.Similarity = {
        THRESHOLDS: THRESHOLDS,

        dotProduct: dotProduct,
        cosineSimilarity: cosineSimilarity,
        urlSimilarity: urlSimilarity,
        tagPathEditDistance: tagPathEditDistance,
        tagPathSimilarity: tagPathSimilarity,
        presentationStyleSimilarity: presentationStyleSimilarity,
        rectangleSizeSimilarity: rectangleSizeSimilarity,

        SimilarityMap: SimilarityMap,

        wElementNodeSimilarity: wElementNodeSimilarity,
        wTextNodeSimilarity: wTextNodeSimilarity,
        wHyperlinkNodeSimilarity: wHyperlinkNodeSimilarity,
        wImageNodeSimilarity: wImageNodeSimilarity,
        wNodeSimilarity: wNodeSimilarity,
        memoizedWTextNodeSimilarity: memoizedWTextNodeSimilarity,
        memoizedWHyperlinkNodeSimilarity: memoizedWHyperlinkNodeSimilarity,
        memoizedWImageNodeSimilarity: memoizedWImageNodeSimilarity,

        wNodeMatchWeight: wNodeMatchWeight,

        // @TODO add test
        clusterSimilarity: clusterSimilarity,
        // @TODO add test
        findClusters: findClusters,
        clusterWNodes: clusterWNodes,

        wTreeSimilarity: wTreeSimilarity,
        memoizedWTreeSimilarity: memoizedWTreeSimilarity,
        filterTreeClusters: filterTreeClusters,
        clusterWTrees: clusterWTrees
    };
}).call(this);

; (function (undefined) {
    "use strict";

    // imports
    var evaluateXPath = Webdext.evaluateXPath,
        DATA_TYPE = Webdext.Model.DATA_TYPE,
        Vertex = Webdext.Model.Vertex,
        DirectedAcyclicGraph = Webdext.Model.DirectedAcyclicGraph,
        WNode = Webdext.Model.WNode,
        WElementNode = Webdext.Model.WElementNode,
        createWTree = Webdext.Model.createWTree,
        findWNode = Webdext.Model.findWNode,
        THRESHOLDS = Webdext.Similarity.THRESHOLDS,
        clusterSimilarity = Webdext.Similarity.clusterSimilarity,
        findClusters = Webdext.Similarity.findClusters,
        memoizedWTreeSimilarity = Webdext.Similarity.memoizedWTreeSimilarity,
        clusterWTrees = Webdext.Similarity.clusterWTrees,
        wNodeMatchWeight = Webdext.Similarity.wNodeMatchWeight;

    var AREA_FACTOR = 0.8;

    function CoarseGrainedRegion(parent, minIndex, maxIndex) {
        this.parent = parent;
        this.minIndex = minIndex;
        this.maxIndex = maxIndex;
    }
    CoarseGrainedRegion.prototype.getSiblingNodes = function () {
        return this.parent.getChildrenSubset(this.minIndex, this.maxIndex);
    };

    function Record(wNodeSet) {
        this.wNodeSet = wNodeSet;
        this.dataItems = null; // value is set by calling alignRecordSet()
    }
    Record.prototype.size = function () {
        return this.wNodeSet.length;
    };
    Record.prototype.equals = function (anotherRec) {
        var wNodeSetLength = this.wNodeSet.length;

        if (wNodeSetLength !== anotherRec.wNodeSet.length) {
            return false;
        }

        for (var i = wNodeSetLength; i--;) {
            if (anotherRec.wNodeSet.indexOf(this.wNodeSet[i]) === -1) {
                return false;
            }
        }

        return true;
    };
    Record.prototype.getLeafNodes = function () {
        var wNodeSetLength = this.wNodeSet.length,
            leafNodes = [];

        for (var i = 0; i < wNodeSetLength; i++) {
            var lns = this.wNodeSet[i].getLeafNodes();
            if (lns.length > 0) {
                leafNodes.push.apply(leafNodes, lns);
            }
        }

        return leafNodes;
    };
    Record.prototype.toString = function () {
        var leafNodes = this.getLeafNodes();
        var leafNodesLength = leafNodes.length,
            dataContents = [];

        for (var i = 0; i < leafNodesLength; i++) {
            var leafNode = leafNodes[i];

            if (!leafNode.isSeparatorNode()) {
                dataContents.push(leafNode.dataContent);
            }
        }

        return dataContents.join(", ");
    };
    Record.prototype.toJSON = function () {
        var wNodeSetLength = this.wNodeSet.length,
            nodeXPaths = [];

        for (var i = 0; i < wNodeSetLength; i++) {
            nodeXPaths.push(this.wNodeSet[i].xpath());
        }

        var dataItemsLength = this.dataItems.length,
            dataItems = [];

        for (var i = 0; i < dataItemsLength; i++) {
            var dataNode = this.dataItems[i];
            var dataType, dataItem;

            if (dataNode === null) {
                dataItem = { xpath: null, type: null, value: "" };
            } else {
                if (dataNode.dataType === DATA_TYPE.HYPERLINK) {
                    dataType = "hyperlink";
                } else if (dataNode.dataType === DATA_TYPE.IMAGE) {
                    dataType = "image";
                } else {
                    dataType = "text";
                }

                dataItem = {
                    xpath: dataNode.xpath(),
                    type: dataType,
                    value: dataNode.dataContent
                };
            }

            dataItems.push(dataItem);
        }

        return {
            nodeXPaths: nodeXPaths,
            dataItems: dataItems
        };
    };
    Record.prototype.getAverageSimilarity = function () {
        var sumSimilarity = 0,
            divisor = 0,
            wNodeSetLength = this.wNodeSet.length;

        for (var i = 0, firstLimit = wNodeSetLength - 1; i < firstLimit; i++) {
            for (var j = i + 1, secondLimit = wNodeSetLength; j < secondLimit; j++) {
                sumSimilarity += memoizedWTreeSimilarity(this.wNodeSet[i], this.wNodeSet[j]);
                divisor++;
            }
        }

        if (divisor === 0) {
            return 0;
        }

        return sumSimilarity / divisor;
    };
    Record.prototype.getArea = function () {
        var sumArea = 0,
            wNodeSetLength = this.wNodeSet.length;

        for (var i = wNodeSetLength; i--;) {
            var wNode = this.wNodeSet[i];

            if (wNode instanceof WElementNode) {
                sumArea += wNode.area;
            }
        }
        return sumArea;
    };

    function RecordSet(recSet) {
        this.recordSet = recSet;
    }
    RecordSet.prototype.size = function () {
        return this.recordSet.length;
    };
    RecordSet.prototype.getSiblingIndexRange = function () {
        var siblingIndexes = [],
            recSetLength = this.recordSet.length;

        for (var i = 0; i < recSetLength; i++) {
            var record = this.recordSet[i],
                recordLength = record.size();

            for (var j = 0; j < recordLength; j++) {
                siblingIndexes.push(record.wNodeSet[j].getSiblingIndex());
            }
        }

        return {
            min: Math.min.apply(null, siblingIndexes),
            max: Math.max.apply(null, siblingIndexes)
        };
    };
    RecordSet.prototype.toJSON = function () {
        var recordSetLength = this.recordSet.length,
            records = [];

        for (var i = 0; i < recordSetLength; i++) {
            records.push(this.recordSet[i].toJSON());
        }

        return records;
    };
    RecordSet.prototype.getArea = function () {
        var sumArea = 0,
            recSetLength = this.recordSet.length;

        for (var i = recSetLength; i--;) {
            sumArea += this.recordSet[i].getArea();
        }
        return sumArea;
    };

    RecordSet.prototype.getCoordinate = function () { //Edit by Kris
        var rec = this.recordSet[0];
        if(!rec.wNodeSet[0].coordinate){
            return rec.wNodeSet[0].parent.coordinate;
        }
        return rec.wNodeSet[0].coordinate;
    };

    RecordSet.prototype.getAverageSimilarity = function () {
        var sumSimilarity = 0,
            divisor = 0,
            recSetLength = this.recordSet.length;

        for (var i = 0, firstLimit = recSetLength - 1; i < firstLimit; i++) {
            for (var j = i + 1, secondLimit = recSetLength; j < secondLimit; j++) {
                sumSimilarity += memoizedWTreeSimilarity(
                    this.recordSet[i].wNodeSet,
                    this.recordSet[j].wNodeSet
                );
                divisor++;
            }
        }

        if (divisor === 0) {
            return 0;
        }

        return sumSimilarity / divisor;
    };
    RecordSet.prototype.getSumOfCRecordSimilarity = function () {
        var sumSimilarity = 0,
            recSetLength = this.recordSet.length;

        for (var i = recSetLength; i--;) {
            sumSimilarity += this.recordSet[i].getAverageSimilarity();
        }

        return sumSimilarity;
    };
    RecordSet.prototype.getCohesion = function () {
        var avgCRecordsSimilarity = this.getSumOfCRecordSimilarity() / this.recordSet.length;
        return this.getAverageSimilarity() / (1 + avgCRecordsSimilarity);
    };
    RecordSet.prototype.numOfColumns = function () {
        return this.dataItems[0].length;
    };
    RecordSet.prototype.getDataItem = function (row, column) {
        return this.dataItems[row][column].dataContent;
    };

    /**
    * Expecting a WNode or Record 
    */
    function mineCRecFromTree(wTree) {
        var wNodeSet = null;

        if (wTree instanceof Record) {
            wNodeSet = wTree.wNodeSet;
        } else if (wTree instanceof WNode) {
            if (wTree.isLeafNode()) {
                return [];
            } else {
                wNodeSet = wTree.children;
            }
        }

        var cRecSetList = mineCRecFromNodeSet(wNodeSet);

        var cRecSetListLength = cRecSetList.length,
            coveredChildren = [];

        for (var i = cRecSetListLength; i--;) {
            var cRecSet = cRecSetList[i],
                cRecSetLength = cRecSet.size();

            for (var j = cRecSetLength; j--;) {
                coveredChildren.push.apply(coveredChildren, cRecSet.recordSet[j].wNodeSet);
            }
        }

        var wNodeSetLength = wNodeSet.length,
            uncoveredChildren = [];

        for (i = 0; i < wNodeSetLength; i++) {
            var wNode = wNodeSet[i];
            if (coveredChildren.indexOf(wNode) === -1) {
                uncoveredChildren.push(wNode);
            }
        }

        var uncoveredChildrenLength = uncoveredChildren.length;

        for (i = 0; i < uncoveredChildrenLength; i++) {
            var childCRecSetList = mineCRecFromTree(uncoveredChildren[i]);
            if (childCRecSetList.length > 0) {
                cRecSetList.push.apply(cRecSetList, childCRecSetList);
            }
        }
        return cRecSetList;
    }

    function mineCRecFromNodeSet(wNodeSet) {
        if (wNodeSet.length < 2) {
            return [];
        }

        var coarseGrainedRegions = identifyCoarseGrainedRegions(wNodeSet); //!!!
        var cgrsLength = coarseGrainedRegions.length,
            cRecSetList = [];

        for (var i = 0; i < cgrsLength; i++) {
            var cgr = coarseGrainedRegions[i];
            var cRecSet = segmentCoarseGrainedRegion(cgr); //!!!

            if (cRecSet) {
                cRecSetList.push(cRecSet);
                var indexRange = cRecSet.getSiblingIndexRange();

                if (indexRange.min > cgr.minIndex) {
                    var leftSiblingNodes = cgr.parent.getChildrenSubset(
                        cgr.minIndex,
                        indexRange.min - 1
                    );
                    var leftCRecSetList = mineCRecFromNodeSet(leftSiblingNodes);
                    if (leftCRecSetList.length > 0) {
                        cRecSetList.push.apply(cRecSetList, leftCRecSetList);
                    }
                }

                if (indexRange.max < cgr.maxIndex) {
                    var rightSiblingNodes = cgr.parent.getChildrenSubset(
                        indexRange.max + 1,
                        cgr.maxIndex
                    );
                    var rightCRecSetList = mineCRecFromNodeSet(rightSiblingNodes);
                    if (rightCRecSetList.length > 0) {
                        cRecSetList.push.apply(cRecSetList, rightCRecSetList);
                    }
                }
            }
        }

        return cRecSetList;
    }

    function identifyCoarseGrainedRegions(wNodeSet) {
        var clusters = clusterWTrees(wNodeSet);

        var clustersLength = clusters.length,
            coarseGrainedRegions = [];

        
        // filter only non all separator nodes cluster and length > 1
        // create CoarseGrainedRegion from those clusters
        for (var i = 0; i < clustersLength; i++) {
            var cluster = clusters[i],
                clusterLength = cluster.length,
                allSeparatorCluster = true;
                
            for (var j = clusterLength; j--;) {
                if (!cluster[j].isSeparatorNode()) {
                    allSeparatorCluster = false;
                    break;
                }
            }

            if (!allSeparatorCluster && cluster.length > 1) {  //>1
                var siblingIndexes = [];
                for (j = clusterLength; j--;) {
                    siblingIndexes.push(cluster[j].getSiblingIndex());
                }
                var cgr = new CoarseGrainedRegion(
                    cluster[0].parent,
                    Math.min.apply(null, siblingIndexes),
                    Math.max.apply(null, siblingIndexes)
                );
                coarseGrainedRegions.push(cgr);
            }
        }

        // merge overlapping coarse grained regions
        var merge;

        do {
            merge = false;
            var cgrsLength = coarseGrainedRegions.length,
                toMergeIndex1 = null,
                toMergeIndex2 = null;

            for (var i = 0; i < cgrsLength - 1; i++) {
                var cgr1 = coarseGrainedRegions[i];
                for (var j = i + 1; j < cgrsLength; j++) {
                    var cgr2 = coarseGrainedRegions[j];

                    if (cgr1.minIndex <= cgr2.minIndex && cgr2.minIndex <= cgr1.maxIndex) {
                        merge = true;
                    } else if (cgr2.minIndex <= cgr1.minIndex && cgr1.minIndex <= cgr2.maxIndex) {
                        merge = true;
                    }

                    if (merge) {
                        toMergeIndex1 = i;
                        toMergeIndex2 = j;
                        break;
                    }
                }

                if (merge) {
                    break;
                }
            }

            if (merge) {
                var toMerge1 = coarseGrainedRegions.splice(toMergeIndex1, 1)[0],
                    toMerge2 = coarseGrainedRegions.splice(toMergeIndex2 - 1, 1)[0],
                    mergedCGR = new CoarseGrainedRegion(
                        toMerge1.parent,
                        Math.min(toMerge1.minIndex, toMerge2.minIndex),
                        Math.max(toMerge1.maxIndex, toMerge2.maxIndex)
                    );
                coarseGrainedRegions.push(mergedCGR);
            }
        } while (merge);
        
        return coarseGrainedRegions;
    }

    function isSubsetOfExistingCRecSet(cRecSetList, cRecSet) {
        return cRecSetList.some(function (crs) {
            return cRecSet.recordSet.every(function (record) {
                return crs.recordSet.some(function (rec) {
                    return rec.equals(record);
                });
            });
        });
    }

    function segmentCoarseGrainedRegion(cgr) {
        var wNodeSet = cgr.getSiblingNodes();
        var wNodeSetLength = wNodeSet.length,
            cRecSetList = [];

        for (var i = 0; i < wNodeSetLength; i++) {
            var wNode = wNodeSet[i];
            if (!wNode.isSeparatorNode()) {
                var cRecSet = integratedCRecMine(wNodeSet.slice(i));

                if (cRecSet !== null) {
                    if (isSubsetOfExistingCRecSet(cRecSetList, cRecSet)) {
                        break;
                    }
                    cRecSetList.push(cRecSet);
                }
            }
        }

        var areaList = cRecSetList.map(function (cRecSet) {
            return cRecSet.getArea();
        });
        var maxArea = Math.max.apply(null, areaList) * AREA_FACTOR;
        var largeCRecSetList = cRecSetList.filter(function (cRecSet) {
            return cRecSet.getArea() > maxArea;
        });

        var cohesionList = largeCRecSetList.map(function (cRecSet) {
            return cRecSet.getCohesion();
        });
        var maxCohesion = Math.max.apply(null, cohesionList);

        return largeCRecSetList[cohesionList.indexOf(maxCohesion)];
    }

    function integratedCRecMine(wNodeSet) {
        var anySeparatorNode = wNodeSet.some(function (wNode) {
            return wNode.isSeparatorNode();
        });

        if (!anySeparatorNode) {
            return headOrderBasedCRecMine(wNodeSet);
        }

        var separatorCRecSet = separatorBasedCRecMine(wNodeSet);
        var headOrderCRecSet = headOrderBasedCRecMine(wNodeSet);

        if (separatorCRecSet !== null && headOrderCRecSet === null) {
            return separatorCRecSet;
        } else if (separatorCRecSet === null && headOrderCRecSet !== null) {
            return headOrderCRecSet;
        } else if (separatorCRecSet === null && headOrderCRecSet === null) {
            return null;
        }

        var separatorCRecSetArea = separatorCRecSet.getArea();
        var headOrderCRecSetArea = headOrderCRecSet.getArea();

        if (separatorCRecSetArea > headOrderCRecSetArea) {
            return separatorCRecSet;
        } else if (separatorCRecSetArea < headOrderCRecSetArea) {
            return headOrderCRecSet;
        }

        if (separatorCRecSet.getCohesion() > headOrderCRecSet.getCohesion()) {
            return separatorCRecSet;
        } else {
            return headOrderCRecSet;
        }
    };

    function createRecordSetFromTreeCluster(treeCluster) {
        var recordSet = treeCluster.map(function (wNodeSet) {
            return new Record(wNodeSet);
        });

        return new RecordSet(recordSet);
    }

    function generatePrefixSubparts(wNodeSet) {// decompose wNodeSet into a list of wNode
        var wNodeSetLength = wNodeSet.length,
            prefixSubparts = [];

        for (var i = 1; i <= wNodeSetLength; i++) {
            prefixSubparts.push(wNodeSet.slice(0, i));
        }

        return prefixSubparts;
    }

    function findSimilarPrefixSubpart(treeCluster, prefixSubparts) {
        var prefixSubpartsLength = prefixSubparts.length,
            similarPrefixSubparts = [];

        for (var i = 0; i < prefixSubpartsLength; i++) {
            var prefixSubpart = prefixSubparts[i];
            var similarity = clusterSimilarity(
                treeCluster,
                [prefixSubpart],
                memoizedWTreeSimilarity
            );

            if (similarity > THRESHOLDS.TREE) {
                similarPrefixSubparts.push(prefixSubpart);
            }
        }

        var similarPrefixSubpartsLength = similarPrefixSubparts.length,
            selectedRecordSet, maxCohesion;

        for (i = 0; i < similarPrefixSubpartsLength; i++) {
            var prefixSubpart = similarPrefixSubparts[i];
            var newTreeCluster = treeCluster.concat([prefixSubpart]);
            var rs = createRecordSetFromTreeCluster(newTreeCluster);
            var rsCohesion = rs.getCohesion();

            if (typeof maxCohesion === "undefined" || rsCohesion > maxCohesion) {
                maxCohesion = rsCohesion;
                selectedRecordSet = rs;
            }
        }

        return selectedRecordSet;
    }

    function mineCRecFromSubParts(subPartList) {
        var treeClusters = findClusters(
            subPartList,
            THRESHOLDS.TREE,
            clusterSimilarity,
            memoizedWTreeSimilarity
        );
        var firstSubPart = subPartList[0];
        var treeCluster;

        for (var i = 0; i < treeClusters.length; i++) {
            if (treeClusters[i].indexOf(firstSubPart) > -1) {
                treeCluster = treeClusters[i];
                break;
            }
        }

        var treeClusterLength = treeCluster.length,
            treeClusterIndexes = [];

        for (i = 0; i < treeClusterLength; i++) {
            treeClusterIndexes.push(subPartList.indexOf(treeCluster[i]));
        }

        var lastSubPartIndexInTC = Math.max.apply(null, treeClusterIndexes);
        var lastSubPartIndex = subPartList.length - 1;

        if (lastSubPartIndexInTC < lastSubPartIndex) {
            var nextTree = subPartList[lastSubPartIndexInTC + 1];
            var prefixSubparts = generatePrefixSubparts(nextTree);
            var recordSet = findSimilarPrefixSubpart(treeCluster, prefixSubparts);

            if (recordSet) {
                return recordSet;
            }
        }

        if (lastSubPartIndexInTC > 0) {
            var lastTreeinTC = subPartList[lastSubPartIndexInTC];

            if (lastTreeinTC.length === 1) {
                return createRecordSetFromTreeCluster(treeCluster);
            }

            var prefixSubparts = generatePrefixSubparts(lastTreeinTC);
            treeCluster.splice(treeCluster.indexOf(lastTreeinTC), 1);
            var recordSet = findSimilarPrefixSubpart(treeCluster, prefixSubparts);

            if (recordSet) {
                return recordSet;
            }
        }

        return null;
    }

    function findSeparatorTagsSet(wNodeSet) {
        var separatorList = [],
            separator = null,
            wNodeSetLength = wNodeSet.length;

        for (var i = 0; i < wNodeSetLength; i++) {
            var wNode = wNodeSet[i];

            if (wNode.isSeparatorNode()) {
                if (separator === null) {
                    separator = [];
                    separator.push(wNode.tagName);
                    separatorList.push(separator);
                } else {
                    separator.push(wNode.tagName);
                }
            } else {
                separator = null;
            }
        }

        var separatorListLength = separatorList.length,
            separatorTagsList = [];

        for (i = 0; i < separatorListLength; i++) {
            separatorTagsList.push(separatorList[i].join(","));
        }

        var separatorTagsSet = [];

        for (i = 0; i < separatorListLength; i++) {
            var separatorTags = separatorTagsList[i];
            if (separatorTagsSet.indexOf(separatorTags) === -1) {
                separatorTagsSet.push(separatorTags);
            }
        }

        return separatorTagsSet;
    }

    function separateSiblings(siblings, separatorTags) {
        var separatorNodesLength = separatorTags.split(",").length,
            siblingsLength = siblings.length,
            i = 0,
            subPartList = [],
            subPart = [];

        while (i < siblingsLength) {
            var currentLength = siblingsLength - i;

            if (separatorNodesLength <= currentLength) {
                var currentElements = siblings.slice(i, i + separatorNodesLength);
                var currentTagList = currentElements.map(function (e) {
                    return e.tagName;
                });
                var currentTags = currentTagList.join(",");

                if (currentTags === separatorTags) {
                    if (subPart.length > 0) {
                        subPartList.push(subPart);
                    }
                    subPart = [];
                    i += separatorNodesLength;
                } else {
                    subPart.push(siblings[i]);
                    i++;
                }
            } else {
                subPart.push.apply(subPart, siblings.slice(i));
                subPartList.push(subPart);
                subPart = [];
                i = siblingsLength;
            }
        }

        if (subPart.length > 0) {
            subPartList.push(subPart);
        }

        return subPartList;
    }

    function separatorBasedCRecMine(wNodeSet) {
        var separatorTagsSet = findSeparatorTagsSet(wNodeSet);
        var separatorTagsSetLength = separatorTagsSet.length,
            cRecSetList = [];


        for (var i = 0; i < separatorTagsSetLength; i++) {
            var separatorTags = separatorTagsSet[i];
            var subPartList = separateSiblings(wNodeSet, separatorTags);
            var subPartListLength = subPartList.length,
                subPartListWOSeparator = [];

            for (var j = 0; j < subPartListLength; j++) {
                var subPart = subPartList[j];
                var subPartWOSeparator = subPart.filter(function (wNode) {
                    return !wNode.isSeparatorNode();
                });
                if (subPartWOSeparator.length > 0) {
                    subPartListWOSeparator.push(subPartWOSeparator);
                }
            }

            if (subPartListWOSeparator.length > 0) {
                var cRecSet = mineCRecFromSubParts(subPartListWOSeparator);

                if (cRecSet) {
                    cRecSetList.push(cRecSet);
                }
            }
        }

        if (cRecSetList.length === 0) {
            return null;
        }

        var areaList = cRecSetList.map(function (cRecSet) {
            return cRecSet.getArea();
        });
        var maxArea = Math.max.apply(null, areaList);
        var largeCRecSetList = cRecSetList.filter(function (cRecSet) {
            return cRecSet.getArea() === maxArea;
        });

        if (largeCRecSetList.length === 1) {
            return largeCRecSetList[0];
        }

        var cohesionList = largeCRecSetList.map(function (cRecSet) {
            return cRecSet.getCohesion();
        });
        var maxCohesion = Math.max.apply(null, cohesionList);

        return largeCRecSetList[cohesionList.indexOf(maxCohesion)];
    }

    function headBasedCRecMine(wNodeSet) {
        var clusters = clusterWTrees(wNodeSet);
        var clustersLength = clusters.length,
            firstHeadNode = wNodeSet[0],
            firstHeadNodeCluster = null;

        for (var i = 0; i < clustersLength; i++) {
            if (clusters[i].indexOf(firstHeadNode) > -1) {
                firstHeadNodeCluster = clusters[i];
                break;
            }
        }

        var wNodeSetLength = wNodeSet.length,
            subPartList = [],
            subPart = [];

        for (i = 0; i < wNodeSetLength; i++) {
            var wNode = wNodeSet[i];

            if (firstHeadNodeCluster.indexOf(wNode) > -1) {
                if (subPart.length > 0) {
                    subPartList.push(subPart);
                }

                subPart = [];
                subPart.push(wNode);
            } else {
                subPart.push(wNode);
            }
        }

        if (subPart.length > 0) {
            subPartList.push(subPart);
        }

        return mineCRecFromSubParts(subPartList);
    }

    function orderBasedCRecMine(wNodeSet) {
        var clusters = clusterWTrees(wNodeSet);
        var clustersLength = clusters.length,
            vertices = [];

        for (var i = clustersLength; i--;) {
            var cluster = clusters[i];
            var vertex = new Vertex(cluster);
            vertices.push(vertex);

            for (var j = cluster.length; j--;) {
                cluster[j].vertex = vertex;
            }
        }

        var dag = new DirectedAcyclicGraph(vertices);
        var subPartList = [],
            wNodeSetLength = wNodeSet.length,
            maxIndex = wNodeSetLength - 1,
            i = 0;

        while (i < wNodeSetLength) {
            var j = i;

            while (j < maxIndex && dag.isBeforeOrder(wNodeSet[j].vertex, wNodeSet[j + 1].vertex)) {
                j++;
            }

            subPartList.push(wNodeSet.slice(i, j + 1));
            i = j + 1;
        }

        for (var i = wNodeSetLength; i--;) {
            delete wNodeSet[i].vertex;
        }

        return mineCRecFromSubParts(subPartList);
    }

    function headOrderBasedCRecMine(wNodeSet) {
        var wNodeSetWOSeparator = wNodeSet.filter(function (wNode) {
            return !wNode.isSeparatorNode();
        });
        var headCRecSet = headBasedCRecMine(wNodeSetWOSeparator);
        var orderCRecSet = orderBasedCRecMine(wNodeSetWOSeparator);

        if (headCRecSet !== null && orderCRecSet === null) {
            return headCRecSet;
        } else if (headCRecSet === null && orderCRecSet !== null) {
            return orderCRecSet;
        } else if (headCRecSet === null && orderCRecSet === null) {
            return null;
        }

        var headCRecSetArea = headCRecSet.getArea();
        var orderCRecSetArea = orderCRecSet.getArea();

        if (headCRecSetArea > orderCRecSetArea) {
            return headCRecSet;
        } else if (headCRecSetArea < orderCRecSetArea) {
            return orderCRecSet;
        } else {
            if (headCRecSet.getCohesion() > orderCRecSet.getCohesion()) {
                return headCRecSet;
            } else {
                return orderCRecSet;
            }
        }
    }

    function mineRecFromCRec(cRecSetList) {
        var cRecSetListLength = cRecSetList.length,
            recSetList = [];

        for (var i = 0; i < cRecSetListLength; i++) {
            var cRecSet = cRecSetList[i];
            var furtherCRecSet = furtherMineCRec(cRecSet);

            if (furtherCRecSet === null || isSingleColumnTable(furtherCRecSet)) {
                recSetList.push(cRecSet);
            } else {
                recSetList.push.apply(recSetList, mineRecFromCRec([furtherCRecSet]));
            }
        }

        return recSetList;
    }

    function isSingleColumnTable(cRecSet) {
        return cRecSet.recordSet.every(function (record) {
            return record.getLeafNodes().length === 1;
        });
    }

    function furtherMineCRec(cRecSet) {
        var cRecSetSize = cRecSet.size(),
            cRecSetList = [];

        for (var i = 0; i < cRecSetSize; i++) {
            var furtherCRecSetList = mineCRecFromTree(cRecSet.recordSet[i]);
            cRecSetList.push.apply(cRecSetList, furtherCRecSetList);
        }

        cRecSetList = aggregateSimilarCRecSets(cRecSetList);
        var areaList = cRecSetList.map(function (crs) {
            return crs.getArea();
        });
        var maxArea = Math.max.apply(null, areaList);
        var maxCRecSet = cRecSetList[areaList.indexOf(maxArea)];

        return maxArea > AREA_FACTOR * cRecSet.getArea() ? maxCRecSet : null;
    }

    function recordSetSimilarity(recSet1, recSet2) {
        var recSet1Size = recSet1.size(),
            recSet2Size = recSet2.size(),
            sum = 0;

        for (var i = 0; i < recSet1Size; i++) {
            for (var j = 0; j < recSet2Size; j++) {
                sum += memoizedWTreeSimilarity(
                    recSet1.recordSet[i].wNodeSet,
                    recSet2.recordSet[j].wNodeSet
                );
            }
        }

        return sum / (recSet1Size * recSet2Size);
    }

    function aggregateSimilarCRecSets(cRecSetList) {
        while (cRecSetList.length > 1) {
            var cRecSetListLength = cRecSetList.length,
                anyMerging = false;

            for (var i = 0; i < cRecSetListLength - 1; i++) {
                for (var j = i + 1; j < cRecSetListLength; j++) {
                    var similarity = recordSetSimilarity(
                        cRecSetList[i],
                        cRecSetList[j]
                    );
                    if (similarity > THRESHOLDS.TREE) { //Edit by Kris
                        var recordSet = cRecSetList[i].recordSet.concat(cRecSetList[j].recordSet);
                        cRecSetList.splice(i, 1);
                        cRecSetList.splice(j - 1, 1);
                        cRecSetList.push(new RecordSet(recordSet));
                        anyMerging = true;
                        break;
                    }
                }

                if (anyMerging) {
                    break;
                }
            }

            if (!anyMerging) {
                break;
            }
        }

        return cRecSetList;
    }

    function recordComparator(r1, r2) {
        var r1NodeIndex = r1.wNodeSet[0].nodeIndex;
        var r2NodeIndex = r2.wNodeSet[0].nodeIndex;

        if (r1NodeIndex < r2NodeIndex) {
            return -1;
        } else if (r1NodeIndex > r2NodeIndex) {
            return 1;
        } else {
            return 0;
        }
    }

    function sortRecordSet(rs) {
        rs.recordSet.sort(recordComparator);
    }

    function recordSetAreaComparator(rs1, rs2) {// sort by sum of area
        var rs1Area = rs1.getArea();
        var rs2Area = rs2.getArea();

        if (rs1Area < rs2Area) {
            return -1;
        } else if (rs1Area > rs2Area) {
            return 1;
        } else {
            return 0;
        }
    }

    function recordSetCoordinateComparator(rs1, rs2) { // sort by coordinate
        var rs1C = rs1.getCoordinate();
        var rs2C = rs2.getCoordinate();

        if (rs1C.top < rs2C.top) {
            return 1;
        } else if (rs1C.top > rs2C.top) {
            return -1;
        } else if (rs1C.left < rs2C.left) {
            return 1;
        } else if (rs1C.left > rs2C.left) {
            return -1;
        } else {
            return 0;
        }
    }

    function extractDataRecords() {
        var wTree = createWTree();
        var bodyNode = evaluateXPath("/html/body")[0];
        var wBodyNode = findWNode(bodyNode, wTree);
        // console.log( bodyNode.innerMap);

        var cRecSetList = mineCRecFromTree(wBodyNode);
        
        var cRecSetListLength = cRecSetList.length;
        for (var i = cRecSetListLength; i--;) {
            sortRecordSet(cRecSetList[i]);
        }

        var recSetList = mineRecFromCRec(cRecSetList);
        return recSetList.sort(recordSetCoordinateComparator).reverse(); //sort recordSets descendingly by comparator
    }

    const resultRegions = [];
    let widthCeiling = 0.8, heightCeiling = 0.8, widthFloor = 0.1, heightFloor = 0.1;

    function extractDataRecords1() {
        var wTree = createWTree();
        var bodyNode = evaluateXPath("/html/body")[0];
        var wBodyNode = findWNode(bodyNode, wTree);
        // console.log( bodyNode.innerMap);
        
        mineRegions(wBodyNode);
         console.log(resultRegions.length);
        // return cRecSetList;
    }

    const viewportWidth = document.body.clientWidth;
    const viewportHeight = document.body.clientHeight;
    
    function mineRegions(wNode){
        console.log('@!@! ', JSON.stringify(wNode.rectangleSize));
       
        for(let i = 0; i<wNode.children.length; i++){
            let cNode = wNode.children[i];
            if(!cNode.tagName)
                continue;
            let nodeWidth = cNode.rectangleSize.width, nodeHeight = cNode.rectangleSize.height;
            if(nodeWidth<20 || nodeHeight<20){
                continue;
            }
           
            if(nodeWidth/wNode.rectangleSize.width>=widthCeiling || nodeHeight/wNode.rectangleSize.height>=heightCeiling){
                console.log('mmm  ', JSON.stringify(cNode.xpath()));
                mineRegions(cNode);
            }else if (nodeWidth/wNode.rectangleSize.width>widthFloor && nodeHeight/wNode.rectangleSize.height>heightFloor){
                console.log('rrr  ', JSON.stringify(cNode.xpath()));
                // let color = (Math.random(40)+nodeWidth+nodeHeight)%255;  'rgb('+color+','+ color+','+color+')';
                document.evaluate(cNode.xpath(), document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.style.background = 'rgb(148,111,245,0.6)';
                resultRegions.push(cNode);
            }
        }
    }



    function pairwiseTreeMatchingWeight(wTree1, wTree2) {
        if (wTree1.isLeafNode() || wTree2.isLeafNode()) {
            return wNodeMatchWeight(wTree1, wTree2);
        } else if (wTree1.tagName !== wTree2.tagName) {
            return 0;
        }

        var children1 = wTree1.children;
        var children2 = wTree2.children;

        var children1Length = children1.length,
            children2Length = children2.length,
            m = new Array(children1Length + 1);

        for (var i = 0; i <= children1Length; i++) {
            m[i] = new Array(children2Length + 1);
            m[i][0] = 0;
        }

        for (var j = 1; j <= children2Length; j++) {
            m[0][j] = 0;
        }

        for (var i = 1; i <= children1Length; i++) {
            for (var j = 1; j <= children2Length; j++) {
                var matchWeight = pairwiseTreeMatchingWeight(children1[i - 1], children2[j - 1]);
                var alignment = m[i - 1][j - 1] + matchWeight;
                m[i][j] = Math.max(alignment, m[i][j - 1], m[i - 1][j]);
            }
        }

        return m[children1Length][children2Length] + wNodeMatchWeight(wTree1, wTree2);
    }

    function pairwiseTreeMatching(wNodeSet1, wNodeSet2) {
        var STEP = {
            "Alignment": 0,
            "Insertion": 1,
            "Deletion": 2
        },
            wNodeSet1Length = wNodeSet1.length,
            wNodeSet2Length = wNodeSet2.length,
            m = new Array(wNodeSet1Length + 1),
            steps = new Array(wNodeSet1Length + 1),
            pairwiseMatchWeightMap = new Map();

        for (var i = 0; i <= wNodeSet1Length; i++) {
            m[i] = new Array(wNodeSet2Length + 1);
            m[i][0] = 0;
            steps[i] = new Array(wNodeSet2Length + 1);

            if (i === 0) {
                steps[i][0] = STEP.Alignment;
            } else {
                steps[i][0] = STEP.Deletion;
            }
        }

        for (var j = 1; j <= wNodeSet2Length; j++) {
            m[0][j] = 0;
            steps[0][j] = STEP.Insertion;
        }

        for (var i = 1; i <= wNodeSet1Length; i++) {
            for (var j = 1; j <= wNodeSet2Length; j++) {
                var matchWeight = pairwiseTreeMatchingWeight(wNodeSet1[i - 1], wNodeSet2[j - 1]);
                var innerMap = pairwiseMatchWeightMap.get(wNodeSet1[i - 1]);
                if (!innerMap) {
                    innerMap = new Map();
                    pairwiseMatchWeightMap.set(wNodeSet1[i - 1], innerMap);
                }
                innerMap.set(wNodeSet2[j - 1], matchWeight);

                var alignment = m[i - 1][j - 1] + matchWeight;
                var insertion = m[i][j - 1];
                var deletion = m[i - 1][j];

                m[i][j] = Math.max(alignment, insertion, deletion);

                if (m[i][j] === alignment) {
                    steps[i][j] = STEP.Alignment;
                } else if (m[i][j] === insertion) {
                    steps[i][j] = STEP.Insertion;
                } else if (m[i][j] === deletion) {
                    steps[i][j] = STEP.Deletion;
                }
            }
        }

        i = wNodeSet1Length;
        j = wNodeSet2Length;
        var matchedPairs = [];

        while (i > 0 || j > 0) {
            var step = steps[i][j];
            if (step === STEP.Alignment) {
                matchedPairs.push({
                    weight: pairwiseMatchWeightMap.get(wNodeSet1[i - 1]).get(wNodeSet2[j - 1]),
                    wNode1: wNodeSet1[i - 1],
                    wNode2: wNodeSet2[j - 1]
                });
                i--;
                j--;
            } else if (step === STEP.Insertion) {
                j--;
            } else if (step === STEP.Deletion) {
                i--;
            }
        }

        return matchedPairs;
    }

    function matchComparator(match1, match2) {
        if (match1.weight < match2.weight) {
            return -1;
        } else if (match1.weight > match2.weight) {
            return 1;
        } else {
            return 0;
        }
    }

    function wNodeComparator(wNode1, wNode2) {
        if (wNode1.nodeIndex < wNode2.nodeIndex) {
            return -1;
        } else if (wNode1.nodeIndex > wNode2.nodeIndex) {
            return 1;
        } else {
            return 0;
        }
    }

    function vertexComparator(vertex1, vertex2) {
        if (vertex1.data[0].nodeIndex < vertex2.data[0].nodeIndex) {
            return -1;
        } else if (vertex1.data[0].nodeIndex > vertex2.data[0].nodeIndex) {
            return 1;
        } else {
            return 0;
        }
    }

    function multiTreeMatching(wTreeSet, recNum) {
        var wTreeSetLength = wTreeSet.length;

        if (wTreeSetLength === 0) {
            return [];
        }

        var childNodeSetList = [];

        if (wTreeSet[0] instanceof Record) {
            for (var i = 0; i < wTreeSetLength; i++) {
                var record = wTreeSet[i];
                childNodeSetList.push(record.wNodeSet);
                var recordWNodeSetLength = record.wNodeSet.length;

                for (var j = recordWNodeSetLength; j--;) {
                    record.wNodeSet[j].rowNumber = i;
                }
            }
        } else {
            var wNodeSet = wTreeSet;

            var allAreSeparatorNodes = true;
            for (var i = wTreeSetLength; i--;) {
                if (!wNodeSet[i].isSeparatorNode()) {
                    allAreSeparatorNodes = false;
                    break;
                }
            }

            if (allAreSeparatorNodes) {
                return [];
            }

            var anyDataItemNode = false;
            for (var i = wTreeSetLength; i--;) {
                if (wNodeSet[i].dataType) {
                    anyDataItemNode = true;
                    break;
                }
            }

            if (anyDataItemNode) {
                var dataItems = new Array(recNum);
                for (var i = 0; i < wTreeSetLength; i++) {
                    var wNode = wNodeSet[i];
                    dataItems[wNode.rowNumber] = [wNode];
                }
                for (var i = 0; i < recNum; i++) {
                    if (typeof dataItems[i] === "undefined") {
                        dataItems[i] = [null];
                    }
                }
                return dataItems;
            }

            for (var i = 0; i < wTreeSetLength; i++) {
                var wNode = wNodeSet[i];
                if (!wNode.isLeafNode()) {
                    childNodeSetList.push(wNode.children);
                    var childrenCount = wNode.getChildrenCount();

                    for (var j = childrenCount; j--;) {
                        wNode.children[j].rowNumber = wNode.rowNumber;
                    }
                }
            }
        }

        var childNodeSetListLength = childNodeSetList.length,
            dag = new DirectedAcyclicGraph();

        for (var i = 0; i < childNodeSetListLength; i++) {
            var childNodeSet = childNodeSetList[i];
            var childNodeSetLength = childNodeSet.length;

            for (var j = 0; j < childNodeSetLength; j++) {
                var childNode = childNodeSet[j];
                var vertex = new Vertex([childNode]);
                dag.addVertex(vertex);
                childNode.vertex = vertex;

                if (j > 0) {
                    dag.createEdge(childNodeSet[j - 1].vertex, childNode.vertex);
                }
            }
        }

        var pairwiseAlignments = [];
        for (var i = 0; i < childNodeSetListLength - 1; i++) {
            for (var j = i + 1; j < childNodeSetListLength; j++) {
                var matchedPairs = pairwiseTreeMatching(childNodeSetList[i], childNodeSetList[j]);
                pairwiseAlignments.push.apply(pairwiseAlignments, matchedPairs);
            }
        }
        pairwiseAlignments.sort(matchComparator);

        while (pairwiseAlignments.length > 0) {
            var pa = pairwiseAlignments.pop();

            if (dag.isPathExists(pa.wNode1.vertex, pa.wNode2.vertex)) {
                continue;
            }

            var mergedVertex = dag.mergeVertices(pa.wNode1.vertex, pa.wNode2.vertex);
            var mergedVertexDataLength = mergedVertex.data.length;

            for (var i = mergedVertexDataLength; i--;) {
                mergedVertex.data[i].vertex = mergedVertex;
            }

            if (dag.numOfVertices() === 1) {
                break;
            }
        }

        var numOfVertices = dag.numOfVertices();
        for (var i = 0; i < numOfVertices; i++) {
            dag.vertices[i].data.sort(wNodeComparator);
        }
        dag.vertices.sort(vertexComparator);

        var dataItemSet = new Array(recNum);
        for (var i = 0; i < recNum; i++) {
            dataItemSet[i] = [];
        }

        for (var i = 0; i < numOfVertices; i++) {
            var dataItems = multiTreeMatching(dag.vertices[i].data, recNum);
            if (dataItems.length > 0) {
                for (var j = 0; j < recNum; j++) {
                    dataItemSet[j].push.apply(dataItemSet[j], dataItems[j]);
                }
            }
        }

        return dataItemSet;
    }

    function alignRecordSet(recSet) {
        var recNum = recSet.size();
        var dataItemSet = multiTreeMatching(recSet.recordSet, recNum);
        for (var i = recNum; i--;) {
            recSet.recordSet[i].dataItems = dataItemSet[i];
        }
        return recSet;
    }

    function extract() {
        var recSetList = extractDataRecords();
        var alignedRecSetList = [],
            recSetListLength = recSetList.length;
        for (var i = 0; i < recSetListLength; i++) {
            try {
                alignedRecSetList.push(alignRecordSet(recSetList[i]));
            }
            catch (error) {
                console.log("Failed aligning data items on record set = " + i);
                console.error(error);
            }
        }
        console.log("alignedRecSetList");
        window.alignedRecSetList = alignedRecSetList;
        return alignedRecSetList;
    }

    function extract1() {
        var recSetList = extractDataRecords1();
        console.log("recSetList");
        window.recSetList = recSetList;
        return recSetList;
    }

    // exports
    Webdext.Extraction = {
        CoarseGrainedRegion: CoarseGrainedRegion,
        Record: Record,
        RecordSet: RecordSet,

        isSubsetOfExistingCRecSet: isSubsetOfExistingCRecSet,
        findSeparatorTagsSet: findSeparatorTagsSet,
        separateSiblings: separateSiblings,

        identifyCoarseGrainedRegions: identifyCoarseGrainedRegions,
        segmentCoarseGrainedRegion: segmentCoarseGrainedRegion,

        integratedCRecMine: integratedCRecMine,
        separatorBasedCRecMine: separatorBasedCRecMine,
        headOrderBasedCRecMine: headOrderBasedCRecMine,
        headBasedCRecMine: headBasedCRecMine,
        orderBasedCRecMine: orderBasedCRecMine,

        mineCRecFromTree: mineCRecFromTree,
        mineCRecFromNodeSet: mineCRecFromNodeSet,

        furtherMineCRec: furtherMineCRec,
        recordSetSimilarity: recordSetSimilarity,
        aggregateSimilarCRecSets: aggregateSimilarCRecSets,

        mineRecFromCRec: mineRecFromCRec,
        sortRecordSet: sortRecordSet,
        extractDataRecords: extractDataRecords,

        pairwiseTreeMatchingWeight: pairwiseTreeMatchingWeight,
        pairwiseTreeMatching: pairwiseTreeMatching,
        multiTreeMatching: multiTreeMatching,

        alignRecordSet: alignRecordSet
    };
    Webdext.extract = extract1;
}).call(this);


// var startTime = window.performance.now();
// var recSetList = Webdext.extract();
// var extractionTime = window.performance.now() - startTime;
// chrome.runtime.sendMessage({
//     info: "dataExtractedByIntell",
//     data: {
//         pageUrl: location.href,
//         recSetList: recSetList,
//         extractionTime: extractionTime,
//         memoryUsage: window.performance.memory.usedJSHeapSize
//     }
// });
