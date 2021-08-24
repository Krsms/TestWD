function getCssPath(classNameOrId, idNotation) {
    return (idNotation || ".") + classNameOrId.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, "\\$&").trim()
}

function splitClassValues(node) {
    return (node.attr("class") || "").trim().split(/\s+/).filter(function (e) {
        return e
    })
}


function getFullPath(el) {
    return el.parentNode.parentNode.tagName.not("html").not("body").map(e=>{
        var tagName = e.tagName.toLowerCase();
        return "string" == typeof e.getAttribute('id') && e.getAttribute('id').trim() && !e.getAttribute('id').match(/\d+/g) 
            ? tagName += getCssPath(e.getAttribute('id'), "#") 
            : "string" == typeof e.getAttribute('class') && e.getAttribute('class').trim() && 
                (tagName += getCssPath(e.getAttribute('class')).replace(/ +/g, ".")), tagName
    }).get().join(">")
}

createElem = function (_elem) {
    console.log('getFullPath: ', getFullPath(_elem));

    var selected_style_props = ['display', 'visibility', 'opacity', 'z-index', 
        'background-image', 'content', 'left', 'right', 'top', 'bottom', 'width', 'height'];
    var _createElem = {};// document.createElement(_elem.tag); 
    _createElem.tagName = _elem.tagName;
    _createElem.innerHTML = _elem.innerHTML;
    _createElem.children = _elem.children;
    console.log('_createElem.tagName ',_elem.attributes);
    // console.log('_createElem.innerHTML ',_createElem.innerHTML);
    // console.log('window.getComputedStyle(_elem) ',window.getComputedStyle(_elem));
    // console.log('_createElem.children ',_createElem.children);
    //set attributes
    // console.log("@@@ aaaa ", _elem.className, typeof _elem.children, _elem.children.length);
    // for (i = 0; i < _elem.childNodes.length; i++) {
    //     // console.log("!@!! ",  window.getComputedStyle(_elem.childNodes[i])['top']);
    // }

    // for (i = 0; i < _elem.children.length; i++) {
    //     // console.log("!!! ",_elem.children[i].innerHTML);
    //     var attrs = _elem.children[i].attributes;
    //     var output = "";
    //     for(var j = attrs.length - 1; j>=0 ; j--) {
    //         console.log(attrs[j].name + " -> " + attrs[j].value);
    //     }
    //     console.log(_elem.children[i].tagName);
    // }

    // _elem.children.forEach(c=>console.log(c.innerHTML));
    // _elem.attributes.forEach(a=>{
    //     if(a)
    //         console.log("@@@ aaaa ", a);
    // });

    for(let prop of _elem.attributes){
        if(_elem.attributes[prop])
            _createElem.setAttribute(prop, _elem.attributes[prop])
    }

    computed_style = window.getComputedStyle(_elem);
    if (computed_style) {
        _createElem.computed_style = {}
        for (i = 0; i < selected_style_props.length; i++) {
            style_prop = selected_style_props[i];
            _createElem.computed_style[style_prop] = computed_style[style_prop];
        }
    }

    return _createElem;
}

getDOMTree = function(){

    var viewportWidth = document.body.clientWidth;
    var viewportHeight = document.body.clientHeight;
    console.log("viewportWidth:", viewportWidth);
    console.log("viewportHeight:", viewportHeight);
    var nodes = document.querySelectorAll("body");
    // nodes.forEach(el=>{
    //     // var startLeftPos = Math.round($(this).offset().left)/ Math.round(viewportWidth);
    //     // var startTopPos = Math.round($(this).offset().top)/ Math.round(viewportHeight);
    //     // var endLeftPos = Math.round($(this).offset().left+$(this).width())/ Math.round(viewportWidth);
    //     // var endTopPos = Math.round($(this).offset().top+$(this).height())/ Math.round(viewportHeight);
    //     console.log(el.offsetWidth, el.offsetHeight);
    //     console.log(el.getBoundingClientRect().width, el.getBoundingClientRect().height);
    //     // console.log(getFullPath(el));
    // });
    var mylist = [];
    // nodes.forEach(el=>
    //         mylist.push(createElem(el))
    //     );

    // mylist.forEach(l=>console.log(l));
}

getDOMTree();