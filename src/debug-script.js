/*jslint browser: true, boss:true */
(function (w, d) {

  function isTextNode(n) {
    return n.nodeType === 3;
  }

  function isElementNode(n) {
    return n.nodeType === 1;
  }

  function getNodeFromPoint(x, y) {
    var range, textNode;
    if (d.caretPositionFromPoint) {
      range = d.caretPositionFromPoint(x, y);
      textNode = range.offsetNode;
    } else if (d.caretRangeFromPoint) {
      range = d.caretRangeFromPoint(x, y);
      textNode = range.startContainer;
    }
    return textNode;
  }

  function getInfoFromNode(node) {
    var n = node;
    while (n) {
      if ('cxDebugData' in n) {
        return n;
      }
      n = n.parentNode;
    }
  }

  var elBetweenDelimiters = function (first, last) {
    var els = [];
    var el = first;

    while (el = el.nextSibling) {
      if (el === last) {
        return els;
      }
      els.push(el);
    }
  };

  var markNodes = function (openTag) {
    var data = JSON.parse(openTag.innerHTML);
    var id = openTag.getAttribute('data-cx-open-id');
    var closeTag = d.querySelector('script[data-cx-close-id="' + id + '"]');
    var nodes = elBetweenDelimiters(openTag, closeTag);
    nodes.forEach(function (el) {
      el.cxDebugId = id;
      el.cxDebugData = data;
      el.cxDebugNodes = nodes;
    });
  };

  var openTags = d.querySelectorAll('script[type="cx-debug-open"]');
  Array.prototype.forEach.call(openTags, markNodes);

  var debugOn = false;
  var resetList = [];
  var debugElement;
  var selected = false;

  d.addEventListener('keyup', function (evt) {
    if (evt.keyCode === 17) {
      debugOn = false;
      selected = false;
      resetList.forEach(function (reset) {
        reset();
      });
      resetList = [];
      if (debugElement) {
        debugElement.parentNode.removeChild(debugElement);
      }
    }
  });

  d.addEventListener('keydown', function (evt) {
    if (evt.keyCode === 17) {
      debugOn = true;
      debugElement = d.createElement('div');
      debugElement.style.position = 'fixed';
      debugElement.style.right = '4px';
      debugElement.style.bottom = '4px';
      debugElement.style.width = '380px';
      debugElement.style.backgroundColor = 'rgb(251, 216, 151)';
      debugElement.style.padding = '4px';
      debugElement.style.boxShadow = '2px 2px 8px black';
      debugElement.style.fontSize = '12zpx';
      debugElement.style.color = '#333';
      debugElement.style.overflow = 'auto';
      d.body.appendChild(debugElement);
    }    
  });

  d.addEventListener('click', function (evt) {
    if (!debugOn || selected) {
      return;
    }
    var x = evt.clientX, y = evt.clientY,
        node = getNodeFromPoint(x, y),
        info = getInfoFromNode(node);

    if (info) {
      selected = true;
      var selection = w.getSelection();
      selection.removeAllRanges();
      info.cxDebugNodes.forEach(function (node) {
        // add outline
        if (isTextNode(node)) {
          var range = d.createRange();
          range.setStart(info, 0);
          range.setEnd(info, node.data.length);
          selection.addRange(range);
        }
        else if (isElementNode(node)){
          var oldBoxShadow = node.style.boxShadow;
          node.style.boxShadow = '0px 0px 0px 5px rgba(255, 165, 0, 0.7) inset';
          resetList.push(function () {
            node.style.boxShadow = oldBoxShadow;
          });
        }
      });
      var infoBox = d.createElement('pre');
      infoBox.style.background = 'transparent';
      infoBox.style.margin = '0';
      infoBox.innerHTML = JSON.stringify(info.cxDebugData, undefined, 1);
      debugElement.appendChild(infoBox);
      
    }
  });
}(window, document));