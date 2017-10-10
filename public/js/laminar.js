/**
 * @author Travis Colbert trav.colbert@gmail.com
 */

"use strict";

var Laminar = Laminar || {};

Laminar.Widget = (function(){
  /**
   * The default class that will be added to every Laminar Widget object
   * @type String
   */
  var defaultElementClass = "lm";
  var defaultElementType = "div";

  /**
   * Find any element in the DOM
   *
   * @param {String} selector The DOM selector string to look for or blank to
   * search the whole document body.
   *
   * @returns {Object} A DOM object
   */
  var _findElement = function(selector) {
    selector = selector || "body";
    return document.querySelector(selector);
  }
  /**
   * If there is an element with the same ID specified in the configObj then
   * remove that DOM element so that a new one can be created.
   *
   * @private
   * @param {Object} configObj The configuration object
   */
  /*
  var _clobber = function(configObj) {
    if(configObj.hasOwnProperty("clobber")) {
      if(configObj.hasOwnProperty("id")) {
        var theElement = document.querySelector("#" + configObj.id);
        if(theElement) {
          theElement.parentNode.removeChild(theElement);
          return true;
        }
      }
    }
    return false;
  };
  */

  /**
   * Acquire all of the attibutes of the DOM object and put them in the
   * engulfing Laminar object.
   * @param {*} domObj
   * @return configuration object
   */
  var _gobble = function(domObj) {
    var attributeList = domObj.attributes;
    //console.log(attributeList);
    //console.log("Gobbling element with the following attribs: " + JSON.stringify(attributeList));
    var widgetConfigObj = {};
    for(var count=0;count<attributeList.length;count++) {
      widgetConfigObj[attributeList[count]["name"]] = attributeList[count]["value"];
    }
    widgetConfigObj["element"] = domObj["tagName"];
    var myId = domObj.getAttribute('id');
    if(myId!==null || myId!==undefined) widgetConfigObj["id"] = myId;
    var parentID = domObj.parentNode.getAttribute("id");
    widgetConfigObj["parent"] = (parentID) ? "#" + parentID : "body";
    if(widgetConfigObj.hasOwnProperty("class")) {
      widgetConfigObj.classlist = widgetConfigObj.class.split(" ");
    }
    //widgetConfigObj.clobber = true;
    return widgetConfigObj;
  }

  /**
   * @constructor
   *
   * The constructor accepts a configObj also a DOM object. If a DOM object is
   * passed then the DOM object is 'gobbled' into the Laminar Object.
   *
   * @property {object} configObj   The configuration object
   */
  function Widget(configObj) {
    configObj = configObj || {};

    this.events = {};
    this.subscriptions = [];
    this.states = [];
    this.mutations = new MutationObserver(function(mutation) {
      for(var m in mutation) {
        if(mutation.hasOwnProperty(m)) {
          // console.log("Mutation: '" + mutation[m].attributeName + "' occurred");
          // console.log("Target: '" + mutation[m].target.tagName + "'");
          // console.log(JSON.stringify(mutation[m]));
        }
      }
    });


    if(configObj) {
      var p;
      var gobbledElement = false;
      if(configObj.nodeType) {
        // You gave is a DOM object...
        gobbledElement = true;
        this.domElement = configObj;
        this.addClass(defaultElementClass);
        configObj = _gobble(this.domElement);
      } else if(typeof configObj=="string") {
        // If you gave us a CSS selector...
        this.domElement = _findElement(configObj);
        this.addClass(defaultElementClass);
      } else {
        this.element = configObj.element || defaultElementType;
        this.domElement = document.createElement(this.element);
      }

      p = configObj.parent || "body"; // Set the parent of this object

      if(configObj.hasOwnProperty("id")) this.set("id",configObj.id);
      if(configObj.hasOwnProperty("type")) this.set("type",configObj.type);
      this.addClass(defaultElementClass);
      if(configObj.hasOwnProperty("classlist")) this.addClasses(configObj.classlist);
      if(configObj.hasOwnProperty("content")) this.content(configObj.content);
      if(configObj.hasOwnProperty("value")) this.set("value",configObj.value);
      if(configObj.hasOwnProperty("proplist")) this.setProps(configObj.proplist);
      if(configObj.hasOwnProperty("datalist")) this.setData(configObj.datalist);
      if(configObj.hasOwnProperty("statelist")) {
        this.states = configObj.statelist;
        this.setState();
      }
      if(configObj.hasOwnProperty("responsive")) {
        if(typeof configObj.responsive == "function") {
          this.responsive = configObj.responsive;
          window.addEventListener("resize",function(){
            this.responsive(this);
          }.bind(this));
        }
      }
      /**
       * gobbledElement is set TRUE when we give Laminar a DOM object.
       * Otherwise, it's a new object that hasn't been plugged into the DOM
       * fully.
       * setParent() does this step but not for pre-existing DOM objects
       */
      if(!gobbledElement) this.setParent(p);
    }

    this.mutations.observe(this.domElement, {attributes: true});
  }

  /**
   * Set or add an HTML attribute.
   *
   * HTML attributes are like this button: <button disabled="disabled">Disabled Button</button>.
   * The 'disabled' is an attribute.
   *
   * @param {string} attrib The HTML attribute to set
   * @param {string} val  The new value of the attribute
   * @returns {Object} The Laminar Widget object
   */
  Widget.prototype.set = function(attrib,val) {
    if(attrib=="value" && this.element.toLowerCase()=="input") return this.setValue(val);
    this.domElement.setAttribute(attrib,val);
    return this;
  };

  Widget.prototype.unset = function(attrib) {
    if(attrib=="value" && this.element.toLowerCase()=="input") return this.setValue('');
    this.domElement.removeAttribute(attrib);
    return this;
  }

  /**
   * Set or change the object's parent
   *
   * This can effectively MOVE an object from one part of the DOM to another
   *
   * @returns {Object} This Laminar widget
   */
  Widget.prototype.setParent = function(elementSelector) {
    if(elementSelector===null || elementSelector==="undefined") return this;

    if(elementSelector instanceof Widget) {
      //console.log("Found a parent thats a Laminar.Widget. ID: " + elementSelector.getId());
      this.parent = "#" + elementSelector.getId();
    } else if(elementSelector.nodeType) {    // Its a DOM object
      //console.log("Found a parent thats a DOM object");
      this.parent = "#" + elementSelector.getAttribute("id");
    } else if(typeof elementSelector=="string")  {
      //console.log("Found a parent thats a CSS selector");
      this.parent = elementSelector;
    }
    this.remove();
    this.update();
    return this;
  }


  /**
   * Set an input's value
   *
   * @param {string} val The value to put into the input
   * @returns {Object} The Laminar Widet object
   */
  Widget.prototype.setValue = function(val) {
    this.domElement.value = val;
    return this;
  };

  /**
   * Set a new element type
   *
   * @param {string} element The type of element to change to
   * @returns {Object} The Laminar Widget object
   */
  Widget.prototype.setElement = function(type) {
    for(var attribute in this.domElement.attributes) {
      console.log("Attribute",attribute,"value",this.domElement.attributes[attribute]);
    }
  };

  /**
   * Get the value of an HTML attribute.
   *
   * @param {string} attrib The HTML attribute
   * @returns {string} The value of the HTML attribute
   */
  Widget.prototype.get = function(attrib) {
    if(attrib=="value" && this.element.toLowerCase()=="input") return this.domElement.value;
    return this.domElement.getAttribute(attrib);
  };

  /**
   * Get the dataset attribute
   *
   * These are data-___ attributes that are handled specially in HTML5
   *
   * @param {string} attrib The dataset attribute
   * @returns {string} The value of the dataset attribute
   */
  Widget.prototype.getData = function(attrib) {
    //if(!attrib || attrib==null || !this.domElement.dataset.hasOwnProperty(attrib)) return false;
    return this.domElement.dataset[attrib];
  };

  Widget.prototype.setData = function(dataList) {
    for(var key in dataList) {
      if(dataList.hasOwnProperty(key)) {
        // console.log("Setting key: " + key + " to: " + dataList[key]);
        this.domElement.dataset[key] = dataList[key];
      }
    }
  };

/*
  Widget.prototype.setData = function(attrib,value) {
    console.log("Setting data: " + attrib + " to: " + value);
    if(Array.isArray(attrib)) {
      this.setDataList(attrib);
    }
    this.domElement.dataset[attrib] = value;
    return this;
  };
*/
  /**
   * Get the value of an HTML input
   *
   * @returns {string} The value of the HTML attribute
   */
  Widget.prototype.value = function() {
    return this.get("value");
  };

  /**
   * Find children of this DOM element
   *
   * Use an optional CSS selector to narrow-down the number of children
   *
   * @param {string} selector The (optional) CSS selector
   * @returns {Object} The Laminar Widget object
   */
  Widget.prototype.findChildren = function(selector) {
    if(selector === null || selector === undefined) return this.domElement.children;
    return this.domElement.querySelectorAll(selector);
  };

  /**
   * Remove this element from the DOM
   *
   * The removed object is stil in memory just no longer in the DOM
   *
   * @returns {Object} This removed Laminar Widget object
   */
  Widget.prototype.remove = function() {
    if(this.domElement.parentNode!="undefined" && this.domElement.parentNode!==null) {
      return this.domElement.parentNode.removeChild(this.domElement);
    }
    return false;
  };

  /**
   * Remove a child element from the DOM
   *
   * @param {String} selector   A selector of elements to remove
   * @returns {Object} The Laminar widget
   */
  Widget.prototype.removeChild = function(childSelector) {
    this.domElement.removeChild(this.find(childSelector));
    return this;
  };

  /**
   * Sets HTML properties of a DOM element
   *
   * Format is:
   * [
   *  [propertyname, propertyvalue],
   *  [propertyname, propertyvalue],
   *  ...
   * ]
   *
   * @param {Array} List of property/value pairs
   */
  Widget.prototype.setProps = function(props) {
    if(props===null || props===undefined || props.length<1) return false;
    props.forEach(function(e,i,a) {
      if (e[0]===null || e[0]===undefined || e[0]=='') {
        // Delete the property

      } else {
        this.set(e[0],e[1]);
      }
    }.bind(this));
  };

  /**
   * Returns a propery value
   *
   * @param {string} prop The property to return
   * @returns {string} The property value
   */
  Widget.prototype.getProp = function(prop) {
    return this.domElement[prop] || false;
  };

  Widget.prototype.getAttributes = function() {
    var attrs = this.getProp("attributes");
    var attrList = {};
    for(var count=0;count<attrs.length;count++) {
      attrList[attrs[count].name] = attrs[count].value;
    }
    return attrList;
  };

  Widget.prototype.getId = function() {
    return this.getProp("id");
  };

  Widget.prototype.getTagName = function() {
    return this.getProp("tagName");
  };

  Widget.prototype.getClassList = function() {
    return this.getProp("classList");
  }
  /**
   * Get position of both TOP and LEFT sides of element taking into
   * consideration the containing elements.
   *
   * This is an absolute position
   */
  Widget.prototype.getOffset = function() {
    var element = this.domElement;
    var top = 0, left = 0;
        top += element.offsetTop  || 0;
        left += element.offsetLeft || 0;
    do {
        element = element.offsetParent;
    } while(element);

    return {
        top: top,
        left: left
    };
  }
  /**
   * Return the position of the LEFT side of this widget
   *
   * @returns {number} The pixels of the left side of the widget
   */
  Widget.prototype.getLeft = function() {
    return this.getOffset().left;
  };
  /**
   * Return the position of the TOP side of this widget
   *
   * @returns {number} The pixels of the top side of the widget
   */
  Widget.prototype.getTop = function() {
    return this.getOffset().top;
  };

  Widget.prototype.getScrollTop = function() {
    return this.domElement.scrollTop;
  };

  Widget.prototype.getBoundingTop = function() {
    return this.domElement.getBoundingClientRect().top;
  };

  Widget.prototype.getBoundingBottom = function() {
    return this.domElement.getBoundingClientRect().bottom;
  }

  Widget.prototype.getBoundingLeft = function() {
    return this.domElement.getBoundingClientRect().left;
  }
  /**
   * Return the position of this widget (left,top)
   *
   * @returns {Object} The pixels of the top and left side of the widget
   */
  Widget.prototype.getPosition = function() {
    return {left: this.getLeft(), top: this.getTop()}
  };

  Widget.prototype.getDimensions = function() {
    return {height: this.getHeight(), width: this.getWidth()};
  };

  Widget.prototype.getHeight = function() {
    return this.domElement.offsetHeight;
  };

  Widget.prototype.getWidth = function() {
    return this.domElement.offsetWidth;
  };

  /**
   * Remove a class from the widget's classlist
   *
   * @param {String} classname  The name of the class to remove
   * @return {Object}  This Laminar widget
   */
  Widget.prototype.removeClass = function(classname) {
    this.domElement.classList.remove(classname);
    return this;
  };
  /**
   * Add a classname to this widget
   *
   * @param {string} classname - the class name to add
   */
  Widget.prototype.addClass = function(classname) {
    if (this.domElement.classList) {
      this.domElement.classList.add(classname);
    } else {
      this.domElement.classname += ' ' + classname;
    }
    return this;
  };
  /**
   * Adds an array of classnames to this widget
   *
   * @param {Array} classlist An array list of classnames to add
   * @returns {Object}  This Laminar widget
   */
  Widget.prototype.addClasses = function(classlist) {
    for(var c in classlist) this.addClass(classlist[c]);
    return this;
  };

  // STATE MANAGEMENT //
  /**
   * Sets the 'state' of a widget to one of only a set of pre-defined class
   * names
   *
   * @param {String} string A name of a predefined state
   * @returns {Object}  This Laminar widget
   */
  Widget.prototype.setState = function(state) {
    if(state===undefined || state===null) {
      state = (this.states.length>0) ? this.states[0] : null;
    }

    var statePosition = this.states.indexOf(state);
    if(this.states.length>0 && statePosition>-1) {
      this.addClass(state);
      for(var i=0;i<this.states.length;i++) {
        if(i!=statePosition) this.removeClass(this.states[i]);
      }
    }

    this.dispatchEvent("statechange");

    return this;
  }

  Widget.prototype.setNextState = function() {
    var statePosition = this.states.indexOf(this.getState());
    if(++statePosition>=this.states.length) statePosition=0;
    this.setState(this.states[statePosition]);
    return this;
  }

  Widget.prototype.setPrevState = function() {
    var statePosition = this.states.indexOf(this.getState());
    if(--statePosition<0) statePosition=(this.states.length-1);
    this.setState(this.states[statePosition]);
    return this;
  }

  Widget.prototype.getState = function() {
    for(var i=0;i<this.states.length;i++) {
      if(this.hasClass(this.states[i])) return this.states[i];
    }
    return false;
  }


  /**
   * Checks for the existence of 'classname' in this widget's class list
   *
   * @param {String} classname  The class name to look for
   * @returns {String}  The name of the class or 'false'
   */
  Widget.prototype.hasClass = function(classname) {
    if(this.domElement.classList) return this.domElement.classList.contains(classname);
    return false;
  };
  Widget.prototype.toggleClass = function(classname) {
    this.domElement.classList.toggle(classname);
    return this;
  };

  /**
   * Manipulate the CSS for an element
   *
   * @param {string} prop The CSS attribute to change
   * @param {string} val  The CSS attribute value
   * @return {Object} This Laminar Widget object
   */
  Widget.prototype.css = function(prop,val) {
    this.domElement.style[prop] = val;
    return this;
  };
  /** Hide element in the DOM */
  Widget.prototype.hide = function() {
    this.css("display","none");
    return this;
  };
  /** Show an element in the DOM */
  Widget.prototype.show = function() {
    this.css("display","");
    return this;
  };
  /**
   * Adds HTML content AFTER the widget
   *
   * @param {String} content  The HTML content to add
   * @returns {Object}   The Waminar widget
   */
  Widget.prototype.after = function(content) {
    this.domElement.insertAdjacentHTML('afterend',content);
    return this;
  };
  /**
   * Adds HTML content BEFORE the widget
   *
   * @param {String} content  The HTML content to add
   * @returns {Object}   The Laminar widget
   */
  Widget.prototype.prepend = function(content) {
    this.domElement.insertAdjacentHTML('afterbegin',content);
    return this;
  };
  /**
   * Adds HTML content at the end of the widget's content
   *
   * @param {String} content  The HTML content to add
   * @returns {Object}    The Laminar widget
   */
  Widget.prototype.append = function(content) {
    this.domElement.insertAdjacentHTML("beforeend",content);
    return this;
  };
  /**
   * Adds HTML content at the beginning of the widget's content
   *
   * @parem {String} content  The HTML content to add
   * @returns {Object}    The Laminar widget
   */
  Widget.prototype.before = function(content) {
    this.domElement.insertAdjacentHTML('beforebegin',content);
    return this;
  };
  /**
   * Returns this widget's DOM children
   *
   * @returns {HTMLCollection}  Child elements of this node
   */
  Widget.prototype.children = function() {
    return this.domElement.children;
  };
  /**
   * Clears the contents of the widget.
   *
   * If the widget is of a type INPUT then the VALUE is cleared.
   *
   * @returns {Object} This Laminar widget
   */
  Widget.prototype.empty = function(content) {
    if(!this.hasOwnProperty("element")) return this;
    if(this.element.toLowerCase()=="input") {
      this.domElement.value = '';
    } else {
      this.domElement.innerHTML = '';
    }
    if(content) this.content(content);
    return this;
  };

  /**
   * Appends content into the DOM element
   * If the content is an array, each element is appended.
   * If the content is a Laminar Widget then the widget is inserted into this.
   * Otherwise, the content is appended to this.
   *
   * @param content The content to insert
   * @returns {Object} The Laminar widget
   */
  Widget.prototype.content = function(content) {
    if(Array.isArray(content)) {
      for(var i=0;i<content.length;i++) this.content(content[i]);
    } else if(content instanceof Laminar.Widget) {
      content.parent = this.domElement.id;
      this.domElement.appendChild(content.domElement);
    } else {
      this.domElement.insertAdjacentHTML("beforeend",content);
    }
    return this;
  };

  /**
   * Appends HTML content into the DOM element or returns the content
   *
   * @param {String} content  The HTML content to insert
   * @returns {Object} The Laminar widget or the HTML content
   */
  Widget.prototype.html = function(content) {
    if(content === null || content === undefined) return this.domElement.innerHTML;
    this.domElement.innerHTML = content;
    return this;
  };

  /**
   * Write the object to the DOM
   *
   * @returns {Object} This Laminar widget
   */
  Widget.prototype.update = function(func) {
    if(this.parent!==null) {
      var foundObject = _findElement(this.parent);
      if(foundObject) {
        foundObject.appendChild(this.domElement);
        if(typeof func === "function") {
          // console.log("Invoking init function");
          func(this);
        }
      }
    }
    return this;
  }

  /**
   * Events, Subscriptions and Publishing
   **/

  Widget.prototype.dispatchEvent = function(eventName) {
    // console.log("Dispatching event: " + eventName);
    var event = new Event(eventName, {
      bubbles:true
    });
    this.domElement.dispatchEvent(event);
  };

  Widget.prototype.listenEvent = function(eventName, func, configObj) {
    if(typeof(func)!=="function") return this;
    this.domElement.addEventListener(eventName, function(e) {
      // console.log("Event fired: " + e.type);
      if(typeof(func)==="function") {
        func(e, this);    // The event type and the object detecting the event
        if(configObj) {
          if(configObj.hasOwnProperty("doOnce") && configObj.doOnce===true)  {
            func = null;
          }
        }
      }
    }.bind(this));
    return this;
  };

  /*
  Widget.prototype.setEvent = function(event, func) {
    if(typeof(func)!=="function") return this;
    this.events[event] = func;
    this.domElement.addEventListener(event,function(e){
      console.log("Event fired: " + e.type);
      this.events[e.type](e, this);
    }.bind(this));
    return this;
  };
  */

  Widget.prototype.watch = function(obj,propertyName,func) {
    var valPropertyName = "__val_" + propertyName;
    var setterFunctions = "__fnc_" + propertyName;
    var thisWidget = this;
    Object.defineProperty(
      obj,
      valPropertyName,
      {
        configurable:true,
        writable:true
      }
    );
    Object.defineProperty(
      obj,
      propertyName,
      {
        configurable: true,
        set: function(val) {
          this[valPropertyName] = val;
          for(var c=0;c<this[setterFunctions].length; c++) {
            this[setterFunctions][c].call(thisWidget,val);
          }
        },
        get: function() {
          return this[valPropertyName]
        }
      }
    );
    /* If functon holder property does not exist, create it */
    if(!obj.hasOwnProperty(setterFunctions)) {
      obj[setterFunctions] = [];
    }
    obj[setterFunctions].push(func);
  };

  Widget.prototype.subscribe = function(obj,evnt,func) {
    var setSubscribe = function(obj,evnt,func) {
      var token = obj.subscribe(evnt,func);
      if(token) return {event:evnt, token:token, obj:obj};
    }

    if(Array.isArray(evnt)) {
      for(var i in evnt) {
        this.subscriptions.push(setSubscribe(obj,evnt[i],func.bind(this)));
      }
    } else {
      this.subscriptions.push(setSubscribe(obj,evnt,func.bind(this)));
    }
  };

  Widget.prototype.getSubscription = function(obj,evnt) {
    for(var count in this.subscriptions) {
      if(this.subscriptions[count].event == evnt && this.subscriptions[count].obj == obj)
        return this.subscriptions[count].token;
    }
    return false;
  };

  Widget.prototype.unsubscribe = function(obj, evnt) {
    var token = this.getSubscription(obj,evnt);
    if(token) {
      return obj.unsubscribe(token);
    }
  };

  return Widget;
})();