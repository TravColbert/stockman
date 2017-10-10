/**
 * @author Travis Colbert trav.colbert@gmail.com
 */

"use strict";

var Laminar = Laminar || {};

Laminar.createModel = function(obj,handlerFunctionObj,debug) {
  debug = debug || false;
  var handlerFunctionProperty = "handlerFunctions";
  var handlerFunctionSuffix = "HandlerFunctions";
  var makeProxyHandlerObj = function(handlerFunctionObj) {
    handlerFunctionObj = handlerFunctionObj || {};

    var markDirty = function(target,property) {
      if(!target.hasOwnProperty("__dirty")) {
        Object.defineProperty(
          target,
          "__dirty",
          {
            configurable:false,
            enumerable:false,
            value:[]
          }
        );
      }
      if(target.__dirty.indexOf(property)<0) target.__dirty.push(property);
      return true;
    };

    var proxyHandler = {
      get: function(target,property) {
        var thisHandler = "get";
        var value = (property in target) ? target[property] : false;
        for(var f in this[handlerFunctionProperty][thisHandler + handlerFunctionSuffix]) {
          value = this[handlerFunctionProperty][thisHandler + handlerFunctionSuffix][f](target,property,value);
        }
        return value;
      },
      set: function(target,property,value,receiver) {
        var thisHandler = "set";
        var result = true;
        for(var f in this[handlerFunctionProperty][thisHandler + handlerFunctionSuffix]) {
          if(debug) console.log("proxyHandler:",thisHandler,":function #",f);
          value = this[handlerFunctionProperty][thisHandler + handlerFunctionSuffix][f](target,property,value,receiver);
        }
        if(debug) console.log("proxyHandler:",thisHandler,": ",JSON.stringify(target),"SET value",value,"on property",property);
        if(!target) return result;
        var result = ((target[property] = value)!==false) ? true : false;
        //if(result) {
          if(debug) console.log("proxyHandler:",thisHandler,": Result of SET value",value,"on property",property,"is",result);
          if(debug) console.log("Performing dirty functions");
          markDirty(target,property);
          this.change(target,property);
        //}
        return result;
      },
      deleteProperty:function(target,property) {
        if(!property in target) return false;
        var thisHandler = "deleteProperty";
        for(var f in this[handlerFunctionProperty][thisHandler + handlerFunctionSuffix]) {
          if(debug) console.log("proxyHandler:",thisHandler,":function #",f);
          this[handlerFunctionProperty][thisHandler + handlerFunctionSuffix][f](target,property);
        }
        var result = !!(delete target[property]);
        //if(result) {
          if(debug) console.log("proxyHandler:",thisHandler,": Result of DELETE operation on property",property,"is",result);
          this.change(target,property);
        //}
        return result;
      },    
      change: function(target,property) {
        var thisHandler = "change";
        for(var f in this[handlerFunctionProperty][thisHandler + handlerFunctionSuffix]) {
          if(debug) console.log("Launching change handler on property:",property);
          this[handlerFunctionProperty][thisHandler + handlerFunctionSuffix][f](target,property);
        }
        return;
      },
      handlerFunctions: handlerFunctionObj
    };

    if(!proxyHandler.hasOwnProperty(handlerFunctionProperty)) {
      Object.defineProperty(
        proxyHandler,
        handlerFunctionProperty,
        {
          configurable:false,
          enumerable:false,
          value:handlerFunctionObj
        }
      );
    }

    if(!handlerFunctionObj.hasOwnProperty("addHandler")) {
      Object.defineProperty(
        handlerFunctionObj,
        "addHandler",
        {
          configurable:false,
          enumerable:false,
          value:function(type,func) {
            if(debug) console.log("createModel: Adding handler: " + type + handlerFunctionSuffix);
            if(!this.hasOwnProperty(type + handlerFunctionSuffix)) return;
            this[type + handlerFunctionSuffix].push(func);
          }
        }
      );
    };

    for(var handler in proxyHandler) {
      if(!proxyHandler.hasOwnProperty(handler) || handler==handlerFunctionProperty) continue;
      if(proxyHandler.handlerFunctions.hasOwnProperty(handler + handlerFunctionSuffix)) continue;
      if(debug) console.log("createModel: Creating empty function array for " + handler + " at: " + handler + handlerFunctionSuffix);
      Object.defineProperty(
        proxyHandler.handlerFunctions,
        handler + handlerFunctionSuffix,
        {
          configurable:false,
          enumerable:false,
          value:[]
        }
      );
    }
    return proxyHandler;
  }

  handlerFunctionObj = handlerFunctionObj || {};
  obj = obj || {};
  var proxyHandlerObj = makeProxyHandlerObj(handlerFunctionObj);
  var newProxyObj = new Proxy(obj,proxyHandlerObj);
  
  Object.defineProperty(
    newProxyObj,
    "__save",
    {
      configurable:false,
      enumerable:false,
      value:function() {
        // Signal listening objects of dirty values;
        if(this.hasOwnProperty("__dirty")) {
          this.__dirty.forEach(function(v,i,a) {
            if(debug) console.log(v,"is dirty");
          });
        }
        return this;
      }
    }
  );

  Object.defineProperty(
    newProxyObj,
    "__getHandlerObject",
    {
      configurable:false,
      enumerable:false,
      value:function() {
        if(debug) console.log("Fetching proxyHandlerObj");
        if(debug) console.log(JSON.stringify(handlerFunctionObj));
        return handlerFunctionObj;
      }
    }
  );


  return newProxyObj;
}