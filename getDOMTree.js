getDOMTree = ()=> {
        // each node includes additional useful information - such as position, etc. 
        var selected_style_props = ['display', 'visibility', 'opacity', 'z-index', 'background-image', 'content', 'image'];
        
        //-- get elements in processing order
        getElements = function () {
            var tree_stack = new Array();
            var result_stack = new Array();

            tree_stack.push(document);//.querySelector("body")
            // if we have some other nodes
            while (tree_stack.length != 0) {
                // get element
                el = tree_stack.pop();
                // put it in result stack
                result_stack.push(el);
                //add children of element to stack
                for (i = 0; i < el.childNodes.length; i++) {//childNodes.length  childrenCount
                    tree_stack.push(createElem(el.childNodes[i]));
                }
            }
            return result_stack
        }

        //-- creates node with all information
        createNode = function (element) {
            node = {};
            node.name = element.nodeName;
            node.type = element.nodeType;
            //VALUE
            if (element.nodeValue) {
                node.value = element.nodeValue;
            }
            //COMPUTED STYLE
            computed_style = window.getComputedStyle(element);
            if (computed_style) {
                node.computed_style = {}
                for (i = 0; i < selected_style_props.length; i++) {
                    style_prop = selected_style_props[i]
                    node.computed_style[style_prop] = computed_style[style_prop]
                }
            }
            //POSITION
            try {
                // IT HAS BOUNDINGCLIENTRECT
                if (typeof element.getBoundingClientRect === 'function') {
                    bb = element.getBoundingClientRect()
                    node.position = {'left': Math.round(bb.left), 'top': Math.round(bb.top), 
                                     'right': Math.round(bb.right), 'bottom': Math.round(bb.bottom)};
                    // TRY TO COMPUTE IT
                } else {
                    bb = null
                    var range = document.createRange();
                    range.selectNodeContents(element);
                    bb = range.getBoundingClientRect();
                    if (bb) {
                        node.position = {'left': Math.round(bb.left), 'top': Math.round(bb.top), 
                                         'right': Math.round(bb.right), 'bottom': Math.round(bb.bottom)};
                    }
                }
            } catch (err) { }
            // ATTRIBUTES
            attrs = element.attributes
            if (attrs) {
                node.attrs = {}
                for (i = 0; i < attrs.length; i++) {
                    node.attrs[attrs[i].nodeName] = attrs[i].nodeValue
                }
            }
            return node
        }

        createElem = function (_elem) {
            var _createElem = {};//document.createElement(_elem.tag); 
            _createElem.tagName = _elem.tag;
            _createElem.innerHTML = _elem.content;

            //set attributes
            for(var prop in _elem.attr){
                _createElem.setAttribute(prop,_elem.attr[prop])
            }
            // //set style 
            // for(var prop in _elem.style){
            //     _createElem.style[prop] = _elem.style[prop];
            // }
          
            computed_style = window.getComputedStyle(_elem);
            if (computed_style) {
                _createElem.computed_style = {}
                for (i = 0; i < selected_style_props.length; i++) {
                    style_prop = selected_style_props[i]
                    _createElem.computed_style[style_prop] = computed_style[style_prop]
                }
            }

            try {
                // IT HAS BOUNDINGCLIENTRECT
                if (typeof _elem.getBoundingClientRect === 'function') {
                    bb = _elem.getBoundingClientRect()
                    _createElem.position = {'left': Math.round(bb.left), 'top': Math.round(bb.top), 
                                     'right': Math.round(bb.right), 'bottom': Math.round(bb.bottom)};
                    // TRY TO COMPUTE IT
                } else {
                    bb = null
                    var range = document.createRange();
                    range.selectNodeContents(_elem);
                    bb = range.getBoundingClientRect();
                    if (bb) {
                        _createElem.position = {'left': Math.round(bb.left), 'top': Math.round(bb.top), 
                                         'right': Math.round(bb.right), 'bottom': Math.round(bb.bottom)};
                    }
                }
            } catch (err) { }

            return _createElem;
        }
        //---------- RUN -----------//
        // element_stack = getElements();
        element_stack = document.querySelectorAll("body *");
        processed_stack = new Array();

        console.log('element_stack.length: ',element_stack.length);
        
        element_stack.forEach(ele => {
            console.log('ele: ',ele);
            // node = createNode(ele);
            node = createElem(ele);
            // add children
            if (ele.childNodes.length > 0) {//childNodes.length  childrenCount
                node.childNodes = []
                for (i = 0; i < ele.childNodes.length; i++) {
                    childNode = ele.childNodes[i];
                    
                    console.log(typeof childNode);
                    console.log(childNode);
                    //processed_stack.pop();
                    node.childNodes.unshift(createElem(childNode));
                }
            }
            // add result to stack
            processed_stack.push(node)
        });

        // while (element_stack.length != 0) {
        //     element = element_stack.pop();
        //     console.log('element: ',element);
        //     node = createNode(element);
        //     // add children
        //     if (element.childNodes.length > 0) {//childNodes.length  childrenCount
        //         node.childNodes = []
        //         for (i = 0; i < element.childNodes.length; i++) {
        //             childNode = processed_stack.pop();
        //             node.childNodes.unshift(childNode);
        //         }
        //     }
        //     // add result to stack
        //     processed_stack.push(node)
        // }
        return processed_stack;
    }

    getDOMTree();