(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter,
    doc = require('doc-js'),
    venfix = require('venfix'),
    interact = require('interact-js');

var droppables = [];

function checkElementLocation(element, position){
    var boundingRect = element.getBoundingClientRect();

    return boundingRect.left < position.x && boundingRect.left + boundingRect.width > position.x &&
        boundingRect.top < position.y && boundingRect.top + boundingRect.height > position.y;
}

function emitDroppableEvent(event, grabbable, position){
    var droppable,
        targets;
    for(var i = 0; i < droppables.length; i++) {
        droppable = droppables[i];
        targets;

        if(typeof droppable.selector === 'string'){
            targets = doc(droppable.delegate).find(droppable.selector);
        }else{
            if(doc(droppable.selector).closest(droppable.delegate)){
                targets = [droppable.selector];
            }
        }

        for(var j = 0; j < targets.length; j++) {
            if(checkElementLocation(targets[i], position)){
                droppable._emit(event, {
                    target: targets[i],
                    grabbable: grabbable,
                    position: position
                });
            }
        }
    }
}

function getterSetter(get, set){
    return function(){
        if(arguments.length === 0){
            return get.call(this);
        }else{
            set.apply(this, arguments);
        }
    };
}

function Grab(grabbable, target, interaction){
    var targetRects = target.getBoundingClientRect();
    this.target = target;
    this.grabbable = grabbable;

    this.targetOffset = {
        x: targetRects.left - interaction.pageX,
        y: targetRects.top - interaction.pageY
    }

    this._position = {
        x:0,
        y:0
    };
    this.position({
        x: interaction.pageX,
        y: interaction.pageY
    });
}
Grab.prototype = Object.create(EventEmitter.prototype);
Grab.prototype.constructor = Grab;
Grab.prototype.position = getterSetter(
    function(){
        return {
            x: this._position.x,
            y: this._position.y
        };
    },
    function(position){
        this._position.x = position.x;
        this._position.y = position.y;
        this.emit('move', this.position());
        emitDroppableEvent('hover', this.grabbable, this.position());
    }
);

function Grabbable(delegate, selector){
    if(arguments.length < 2){
        selector = delegate;
        delegate = document;
    }

    this.delegate = delegate;
    this.selector = selector;

    doc.ready(this.init.bind(this));
}
Grabbable.prototype = Object.create(EventEmitter.prototype);
Grabbable.prototype.constructor = Grabbable;
Grabbable.prototype.init = function(){
    this.delegate = doc(this.delegate)[0];

    if(!this.delegate){
        return;
    }

    interact.on('start', this.delegate, this._start.bind(this));
    interact.on('drag', this.delegate, this._drag.bind(this));
    interact.on('end', this.delegate, this._end.bind(this));
    interact.on('cancel', this.delegate, this._end.bind(this));
};
Grabbable.prototype._start = function(interaction){
    var grabbable = this,
        target = interaction.target;

    if(!doc(target).is(grabbable.selector)){
        return;
    }

    this.target = target;
    this.currentGrab = new Grab(this, target, interaction);

    return this;
};
Grabbable.prototype._drag = function(interaction){
    var grabbable = this,
        target = this.target;

    if(!target){
        return;
    }

    if(!this.grabStarted){
        this.emit('grab', this.currentGrab);
        this.grabStarted = true;
    }

    interaction.preventDefault();

    var moveDelta = interaction.getMoveDelta(),
        oldPosition = this.currentGrab.position();

    this.currentGrab.position({
        x: oldPosition.x + moveDelta.x,
        y: oldPosition.y + moveDelta.y
    });

    return this;
};
Grabbable.prototype._end = function(interaction){
    var grabbable = this,
        target = this.target;

    if(!target){
        return;
    }

    if(this.grabStarted){
        this.emit('drop', this.currentGrab.position());
        emitDroppableEvent('drop', this, this.currentGrab.position());
    }

    delete this.target;
    delete this.currentGrab;
    delete this.grabStarted;

    return this;
}
Grabbable.prototype.createGhost = function(element){
    element = element || this.target;
    var ghost = element.cloneNode(true),
        grab = this.currentGrab;

    ghost.style.cssText = document.defaultView.getComputedStyle(element, '').cssText;

    ghost.style.position = 'absolute';
    ghost.style.opacity = '0.5';
    ghost.style.top = '0';
    ghost.style.left = '0';

    grab.on('move', function(position){
        ghost.style[venfix('transform')] = 'translate3d(' + (grab.targetOffset.x + position.x) + 'px,' + (grab.targetOffset.y + position.y) + 'px,0)'
    });

    ghost.destroy = function(){
        ghost.parentNode.removeChild(ghost);
    };

    document.body.appendChild(ghost);

    return ghost;
}

function grabbable(delegate, selector){
    var instance = Object.create(Grabbable.prototype);
    Grabbable.apply(instance, arguments);

    return instance;
}


function Droppable(delegate, selector){
    droppables.push(this);

    if(arguments.length < 2){
        selector = delegate;
        delegate = document;
    }

    this.delegate = delegate;
    this.selector = selector;

    doc.ready(this.init.bind(this));
}
Droppable.prototype = Object.create(EventEmitter.prototype);
Droppable.prototype.constructor = Droppable;
Droppable.prototype.init = function(){
    this.delegate = doc(this.delegate)[0];

    if(!this.delegate){
        return;
    }
};
Droppable.prototype.destroy = function(){
    var dropableIndex = droppables.indexOf(this);

    droppables.splice(dropableIndex, 1);
};
Droppable.prototype._emit = function(event, details){

    this.emit(event, details);
};

function droppable(delegate, selector){
    var instance = Object.create(Droppable.prototype);
    Droppable.apply(instance, arguments);

    return instance;
}

module.exports = {
    grabbable: grabbable,
    droppable: droppable
};
},{"doc-js":4,"events":1,"interact-js":8,"venfix":9}],3:[function(require,module,exports){
var arrayProto = [],
    isList = require('./isList');
    getTargets = require('./getTargets'),
    getTarget = require('./getTarget'),
    space = ' ',
    d = document; // aliased for minification

///[README.md]

function isIn(array, item){
    for(var i = 0; i < array.length; i++) {
        if(item === array[i]){
            return true;
        }
    }
}

/**

    ## .find

    finds elements that match the query within the scope of target

        //fluent
        doc(target).find(query);

        //legacy
        doc.find(target, query);
*/

function find(target, query){
    target = getTargets(target);
    if(query == null){
        return target;
    }

    if(isList(target)){
        var results = [];
        for (var i = 0; i < target.length; i++) {
            var subResults = doc.find(target[i], query);
            for(var j = 0; j < subResults.length; j++) {
                if(!isIn(results, subResults[j])){
                    results.push(subResults[j]);
                }
            }
        }
        return results;
    }

    return target ? target.querySelectorAll(query) : [];
};

/**

    ## .findOne

    finds the first element that matches the query within the scope of target

        //fluent
        doc(target).findOne(query);

        //legacy
        doc.findOne(target, query);
*/

function findOne(target, query){
    target = getTarget(target);
    if(query == null){
        return target;
    }

    if(isList(target)){
        var result;
        for (var i = 0; i < target.length; i++) {
            result = findOne(target[i], query);
            if(result){
                break;
            }
        }
        return result;
    }

    return target ? target.querySelector(query) : null;
};

/**

    ## .closest

    recurses up the DOM from the target node, checking if the current element matches the query

        //fluent
        doc(target).closest(query);

        //legacy
        doc.closest(target, query);
*/

function closest(target, query){
    target = getTarget(target);

    if(isList(target)){
        target = target[0];
    }

    while(
        target &&
        target.ownerDocument &&
        !is(target, query)
    ){
        target = target.parentNode;
    }

    return target === d && target !== query ? null : target;
};

/**

    ## .is

    returns true if the target element matches the query

        //fluent
        doc(target).is(query);

        //legacy
        doc.is(target, query);
*/

function is(target, query){
    target = getTarget(target);

    if(isList(target)){
        target = target[0];
    }

    if(!target.ownerDocument || typeof query !== 'string'){
        return target === query;
    }
    return target === query || arrayProto.indexOf.call(find(target.parentNode, query), target) >= 0;
};

/**

    ## .addClass

    adds classes to the target

        //fluent
        doc(target).addClass(query);

        //legacy
        doc.addClass(target, query);
*/

function addClass(target, classes){
    target = getTargets(target);

    if(isList(target)){
        for (var i = 0; i < target.length; i++) {
            addClass(target[i], classes);
        }
        return this;
    }
    if(!classes){
        return this;
    }

    var classes = classes.split(space),
        currentClasses = target.classList ? null : target.className.split(space);

    for(var i = 0; i < classes.length; i++){
        var classToAdd = classes[i];
        if(!classToAdd || classToAdd === space){
            continue;
        }
        if(target.classList){
            target.classList.add(classToAdd);
        } else if(!currentClasses.indexOf(classToAdd)>=0){
            currentClasses.push(classToAdd);
        }
    }
    if(!target.classList){
        target.className = currentClasses.join(space);
    }
    return this;
};

/**

    ## .removeClass

    removes classes from the target

        //fluent
        doc(target).removeClass(query);

        //legacy
        doc.removeClass(target, query);
*/

function removeClass(target, classes){
    target = getTargets(target);

    if(isList(target)){
        for (var i = 0; i < target.length; i++) {
            removeClass(target[i], classes);
        }
        return this;
    }

    if(!classes){
        return this;
    }

    var classes = classes.split(space),
        currentClasses = target.classList ? null : target.className.split(space);

    for(var i = 0; i < classes.length; i++){
        var classToRemove = classes[i];
        if(!classToRemove || classToRemove === space){
            continue;
        }
        if(target.classList){
            target.classList.remove(classToRemove);
            continue;
        }
        var removeIndex = currentClasses.indexOf(classToRemove);
        if(removeIndex >= 0){
            currentClasses.splice(removeIndex, 1);
        }
    }
    if(!target.classList){
        target.className = currentClasses.join(space);
    }
    return this;
};

function addEvent(settings){
    var target = getTarget(settings.target);
    if(target){
        target.addEventListener(settings.event, settings.callback, false);
    }else{
        console.warn('No elements matched the selector, so no events were bound.');
    }
}

/**

    ## .on

    binds a callback to a target when a DOM event is raised.

        //fluent
        doc(target/proxy).on(events, target[optional], callback);

    note: if a target is passed to the .on function, doc's target will be used as the proxy.

        //legacy
        doc.on(events, target, query, proxy[optional]);
*/

function on(events, target, callback, proxy){

    target = getTargets(target);
    proxy = getTargets(proxy);

    // handles multiple targets
    if(isList(target)){
        var multiRemoveCallbacks = [];
        for (var i = 0; i < target.length; i++) {
            multiRemoveCallbacks.push(on(events, target[i], callback, proxy));
        }
        return function(){
            while(multiRemoveCallbacks.length){
                multiRemoveCallbacks.pop();
            }
        };
    }

    // handles multiple proxies
    // Already handles multiple proxies and targets,
    // because the target loop calls this loop.
    if(isList(proxy)){
        var multiRemoveCallbacks = [];
        for (var i = 0; i < proxy.length; i++) {
            multiRemoveCallbacks.push(on(events, target, callback, proxy[i]));
        }
        return function(){
            while(multiRemoveCallbacks.length){
                multiRemoveCallbacks.pop();
            }
        };
    }

    var removeCallbacks = [];

    if(typeof events === 'string'){
        events = events.split(space);
    }

    for(var i = 0; i < events.length; i++){
        var eventSettings = {};
        if(proxy){
            if(proxy === true){
                proxy = d;
            }
            eventSettings.target = proxy;
            eventSettings.callback = function(event){
                var closestTarget = closest(event.target, target);
                if(closestTarget){
                    callback(event, closestTarget);
                }
            };
        }else{
            eventSettings.target = target;
            eventSettings.callback = callback;
        }

        eventSettings.event = events[i];

        addEvent(eventSettings);

        removeCallbacks.push(eventSettings);
    }

    return function(){
        while(removeCallbacks.length){
            var removeCallback = removeCallbacks.pop();
            getTarget(removeCallback.target).removeEventListener(removeCallback.event, removeCallback.callback);
        }
    }
};

/**

    ## .off

    removes events assigned to a target.

        //fluent
        doc(target/proxy).off(events, target[optional], callback);

    note: if a target is passed to the .on function, doc's target will be used as the proxy.

        //legacy
        doc.off(events, target, callback, proxy);
*/

function off(events, target, callback, proxy){
    if(isList(target)){
        for (var i = 0; i < target.length; i++) {
            off(events, target[i], callback, proxy);
        }
        return this;
    }
    if(proxy instanceof Array){
        for (var i = 0; i < proxy.length; i++) {
            off(events, target, callback, proxy[i]);
        }
        return this;
    }

    if(typeof events === 'string'){
        events = events.split(space);
    }

    if(typeof callback !== 'function'){
        proxy = callback;
        callback = null;
    }

    proxy = proxy ? getTarget(proxy) : d;

    var targets = typeof target === 'string' ? find(target, proxy) : [target];

    for(var targetIndex = 0; targetIndex < targets.length; targetIndex++){
        var currentTarget = targets[targetIndex];

        for(var i = 0; i < events.length; i++){
            currentTarget.removeEventListener(events[i], callback);
        }
    }
    return this;
};

/**

    ## .append

    adds elements to a target

        //fluent
        doc(target).append(children);

        //legacy
        doc.append(target, children);
*/

function append(target, children){
    var target = getTarget(target),
        children = getTarget(children);

    if(isList(target)){
        target = target[0];
    }

    if(isList(children)){
        for (var i = 0; i < children.length; i++) {
            append(target, children[i]);
        }
        return;
    }

    target.appendChild(children);
};

/**

    ## .prepend

    adds elements to the front of a target

        //fluent
        doc(target).prepend(children);

        //legacy
        doc.prepend(target, children);
*/

function prepend(target, children){
    var target = getTarget(target),
        children = getTarget(children);

    if(isList(target)){
        target = target[0];
    }

    if(isList(children)){
        //reversed because otherwise the would get put in in the wrong order.
        for (var i = children.length -1; i; i--) {
            prepend(target, children[i]);
        }
        return;
    }

    target.insertBefore(children, target.firstChild);
};

/**

    ## .isVisible

    checks if an element or any of its parents display properties are set to 'none'

        //fluent
        doc(target).isVisible();

        //legacy
        doc.isVisible(target);
*/

function isVisible(target){
    var target = getTarget(target);
    if(!target){
        return;
    }
    if(isList(target)){
        var i = -1;

        while (target[i++] && isVisible(target[i])) {}
        return target.length >= i;
    }
    while(target.parentNode && target.style.display !== 'none'){
        target = target.parentNode;
    }

    return target === d;
};



/**

    ## .ready

    call a callback when the document is ready.

        //fluent
        doc().ready(callback);

        //legacy
        doc.ready(callback);
*/

function ready(target, callback){
    if(typeof target === 'function' && !callback){
        callback = target;
    }
    if(document.body){
        callback();
    }else{
        doc.on('load', window, function(){
            callback();
        });
    }
};

var doc = {};
doc.find = find;
doc.findOne = findOne;
doc.closest = closest;
doc.is = is;
doc.addClass = addClass;
doc.removeClass = removeClass;
doc.off = off;
doc.on = on;
doc.append = append;
doc.prepend = prepend;
doc.isVisible = isVisible;
doc.ready = ready;

module.exports = doc;
},{"./getTarget":5,"./getTargets":6,"./isList":7}],4:[function(require,module,exports){
var doc = require('./doc'),
    isList = require('./isList'),
    getTargets = require('./getTargets'),
    flocProto = [];

function Floc(items){
    this.push.apply(this, items);
}
Floc.prototype = flocProto;
flocProto.constructor = Floc;

function floc(target){
    var instance = getTargets(target);

    if(!isList(instance)){
        if(instance){
            instance = [instance];
        }else{
            instance = [];
        }
    }
    return new Floc(instance);
}

for(var key in doc){
    if(typeof doc[key] === 'function'){
        floc[key] = doc[key];
        flocProto[key] = (function(key){
            // This is also extremely dodgy and fast
            return function(a,b,c,d,e,f){
                var result = doc[key](this, a,b,c,d,e,f);

                if(result !== doc && isList(result)){
                    return floc(result);
                }
                return result;
            };
        }(key));
    }
}
flocProto.on = function(events, target, callback){
    var proxy = this;
    if(typeof target === 'function'){
        callback = target;
        target = this;
        proxy = null;
    }
    doc.on(events, target, callback, proxy);
    return this;
};

flocProto.off = function(events, target, callback){
    var reference = this;
    if(typeof target === 'function'){
        callback = target;
        target = this;
        reference = null;
    }
    doc.off(events, target, callback, reference);
    return this;
};

module.exports = floc;
},{"./doc":3,"./getTargets":6,"./isList":7}],5:[function(require,module,exports){
var singleId = /^#\w+$/,
    d = document; // aliased for minification

module.exports = function getTarget(target){
    if(typeof target === 'string'){
        if(singleId.exec(target)){
            return d.getElementById(target.slice(1));
        }
        return d.querySelector(target);
    }

    return target;
}
},{}],6:[function(require,module,exports){

var singleClass = /^\.\w+$/,
    singleId = /^#\w+$/,
    singleTag = /^\w+$/,
    d = document; // aliased for minification

module.exports = function getTargets(target){
    if(typeof target === 'string'){
        if(singleId.exec(target)){
            // If you have more than 1 of the same id in your page,
            // thats your own stupid fault.
            return [d.getElementById(target.slice(1))];
        }
        if(singleTag.exec(target)){
            return d.getElementsByTagName(target);
        }
        if(singleClass.exec(target)){
            return d.getElementsByClassName(target.slice(1));
        }
        return d.querySelectorAll(target);
    }

    return target;
};
},{}],7:[function(require,module,exports){
module.exports = function isList(object){
    return object !== window && (object instanceof Array || object && typeof object === 'object' && 'length' in object);
}
},{}],8:[function(require,module,exports){
var interactions = [],
    minMoveDistance = 5,
    interact,
    maximumMovesToPersist = 1000, // Should be plenty..
    propertiesToCopy = 'target,pageX,pageY,clientX,clientY,offsetX,offsetY,screenX,screenY,shiftKey,x,y'.split(','); // Stuff that will be on every interaction.

function Interact(){
    this._elements = [];
}
Interact.prototype.on = function(eventName, target, callback){
    if(!target){
        return;
    }
    target._interactEvents = target._interactEvents || {};
    target._interactEvents[eventName] = target._interactEvents[eventName] || []
    target._interactEvents[eventName].push({
        callback: callback,
        interact: this
    });

    return this;
};
Interact.prototype.emit = function(eventName, target, event, interaction){
    if(!target){
        return;
    }

    var interact = this,
        currentTarget = target;

    interaction.originalEvent = event;
    interaction.preventDefault = function(){
        event.preventDefault();
    }
    interaction.stopPropagation = function(){
        event.stopPropagation();
    }

    while(currentTarget){
        currentTarget._interactEvents &&
        currentTarget._interactEvents[eventName] &&
        currentTarget._interactEvents[eventName].forEach(function(listenerInfo){
            if(listenerInfo.interact === interact){
                listenerInfo.callback.call(interaction, interaction);
            }
        });
        currentTarget = currentTarget.parentNode;
    }

    return this;
};
Interact.prototype.off =
Interact.prototype.removeListener = function(eventName, target, callback){
    if(!target || !target._interactEvents || !target._interactEvents[eventName]){
        return;
    }
    var interactListeners = target._interactEvents[eventName],
        listenerInfo;
    for(var i = 0; i < interactListeners.length; i++) {
        listenerInfo = interactListeners[i];
        if(listenerInfo.interact === interact && listenerInfo.callback === callback){
            interactListeners.splice(i,1);
            i--;
        }
    }

    return this;
};
interact = new Interact();

    // For some reason touch browsers never change the event target during a touch.
    // This is, lets face it, fucking stupid.
function getActualTarget() {
    var scrollX = window.scrollX,
        scrollY = window.scrollY;

    // IE is stupid and doesn't support scrollX/Y
    if(scrollX === undefined){
        scrollX = document.body.scrollLeft;
        scrollY = document.body.scrollTop;
    }

    return document.elementFromPoint(this.pageX - window.scrollX, this.pageY - window.scrollY);
}

function getMoveDistance(x1,y1,x2,y2){
    var adj = Math.abs(x1 - x2),
        opp = Math.abs(y1 - y2);

    return Math.sqrt(Math.pow(adj,2) + Math.pow(opp,2));
}

function destroyInteraction(interaction){
    for(var i = 0; i < interactions.length; i++){
        if(interactions[i].identifier === interaction.identifier){
            interactions.splice(i,1);
        }
    }
}

function getInteraction(identifier){
    for(var i = 0; i < interactions.length; i++){
        if(interactions[i].identifier === identifier){
            return interactions[i];
        }
    }
}

function setInheritedData(interaction, data){
    for(var i = 0; i < propertiesToCopy.length; i++) {
        interaction[propertiesToCopy[i]] = data[propertiesToCopy[i]]
    }
}

function Interaction(event, interactionInfo){
    // If there is no event (eg: desktop) just make the identifier undefined
    if(!event){
        event = {};
    }
    // If there is no extra info about the interaction (eg: desktop) just use the event itself
    if(!interactionInfo){
        interactionInfo = event;
    }

    // If there is another interaction with the same ID, something went wrong.
    // KILL IT WITH FIRE!
    var oldInteraction = getInteraction(interactionInfo.identifier);
    oldInteraction && oldInteraction.destroy();

    this.identifier = interactionInfo.identifier;

    this.moves = [];

    interactions.push(this);
}

Interaction.prototype = {
    constructor: Interaction,
    getActualTarget: getActualTarget,
    destroy: function(){
        interact.on('destroy', this.target, this, this);
        destroyInteraction(this);
    },
    start: function(event, interactionInfo){
        // If there is no extra info about the interaction (eg: desktop) just use the event itself
        if(!interactionInfo){
            interactionInfo = event;
        }

        var lastStart = {
                time: new Date()
            };
        setInheritedData(lastStart, interactionInfo);
        this.lastStart = lastStart;

        setInheritedData(this, interactionInfo);

        interact.emit('start', event.target, event, this);
        return this;
    },
    move: function(event, interactionInfo){
        // If there is no extra info about the interaction (eg: desktop) just use the event itself
        if(!interactionInfo){
            interactionInfo = event;
        }

        var currentTouch = {
                time: new Date()
            };

        setInheritedData(currentTouch, interactionInfo);

        // Update the interaction
        setInheritedData(this, interactionInfo);

        this.moves.push(currentTouch);

        // Memory saver, culls any moves that are over the maximum to keep.
        this.moves = this.moves.slice(-maximumMovesToPersist);

        var lastMove = this.moves[this.moves.length-2];
        lastMove && (currentTouch.angle = Math.atan2(currentTouch.pageY - lastMove.pageY, currentTouch.pageX - lastMove.pageX) * 180 / Math.PI);
        this.angle = currentTouch.angle || 0;

        interact.emit('move', event.target, event, this);
        return this;
    },
    drag: function(event, interactionInfo){
        // If there is no extra info about the interaction (eg: desktop) just use the event itself
        if(!interactionInfo){
            interactionInfo = event;
        }

        var currentTouch = {
                time: new Date(),
                isDrag: true
            };

        setInheritedData(currentTouch, interactionInfo);

        // Update the interaction
        setInheritedData(this, interactionInfo);

        if(!this.moves){
            this.moves = [];
        }

        this.moves.push(currentTouch);

        // Memory saver, culls any moves that are over the maximum to keep.
        this.moves = this.moves.slice(-maximumMovesToPersist);

        if(!this.dragStarted && getMoveDistance(this.lastStart.pageX, this.lastStart.pageY, currentTouch.pageX, currentTouch.pageY) > minMoveDistance){
            this.dragStarted = true;
        }

        var lastDrag = this.moves[this.moves.length-2] || this.lastStart;
        lastDrag && (currentTouch.angle = Math.atan2(currentTouch.pageY - lastDrag.pageY, currentTouch.pageX - lastDrag.pageX) * 180 / Math.PI);
        this.angle = currentTouch.angle || 0;

        if(this.dragStarted){
            interact.emit('drag', event.target, event, this);
        }
        return this;
    },
    end: function(event, interactionInfo){
        if(!interactionInfo){
            interactionInfo = event;
        }

        // Update the interaction
        setInheritedData(this, interactionInfo);

        interact.emit('end', event.target, event, this);

        return this;
    },
    cancel: function(event, interactionInfo){
        if(!interactionInfo){
            interactionInfo = event;
        }

        // Update the interaction
        setInheritedData(this, interactionInfo);

        interact.emit('cancel', event.target, event, this);

        return this;
    },
    getMoveDistance: function(){
        if(this.moves.length > 1){
            var current = this.moves[this.moves.length-1],
                previous = this.moves[this.moves.length-2];

            return getMoveDistance(current.pageX, current.pageY, previous.pageX, previous.pageY);
        }
    },
    getMoveDelta: function(){
        if(this.moves.length > 1){
            var current = this.moves[this.moves.length-1],
                previous = this.moves[this.moves.length-2];

            return {
                x: current.pageX - previous.pageX,
                y: current.pageY - previous.pageY
            };
        }
    },
    getSpeed: function(){
        if(this.moves.length > 1){
            var current = this.moves[this.moves.length-1],
                previous = this.moves[this.moves.length-2];

            return this.getMoveDistance() / (current.time - previous.time);
        }
        return 0;
    },
    getCurrentAngle: function(blend){
        var currentPosition,
            lastAngle,
            i = this.moves.length-1,
            angle,
            firstAngle,
            angles = [],
            blendSteps = 20/(this.getSpeed()*2+1),
            stepsUsed = 0;

        if(this.moves && this.moves.length){

            currentPosition = this.moves[i];
            angle = firstAngle = currentPosition.angle;

            if(blend && this.moves.length > 1){
                while(--i > 0 && this.moves.length - i < blendSteps){
                    lastAngle = this.moves[i].angle;
                    if(Math.abs(lastAngle - firstAngle) > 180){
                        angle -= lastAngle
                    }else{
                        angle += lastAngle
                    }
                    stepsUsed++;
                }
                angle = angle/stepsUsed;
            }
        }
        return angle;
    },
    getAllInteractions: function(){
        return interactions.slice();
    }
};

function start(event){
    var touch;

    for(var i = 0; i < event.changedTouches.length; i++){
        touch = event.changedTouches[i];
        new Interaction(event, event.changedTouches[i]).start(event, touch);
    }
}
function drag(event){
    var touch;

    for(var i = 0; i < event.changedTouches.length; i++){
        touch = event.changedTouches[i];
        getInteraction(touch.identifier).drag(event, touch);
    }
}
function end(event){
    var touch;

    for(var i = 0; i < event.changedTouches.length; i++){
        touch = event.changedTouches[i];
        getInteraction(touch.identifier).end(event, touch).destroy();
    }
}
function cancel(event){
    var touch;

    for(var i = 0; i < event.changedTouches.length; i++){
        touch = event.changedTouches[i];
        getInteraction(touch.identifier).cancel(event, touch).destroy();
    }
}

addEvent(document, 'touchstart', start);
addEvent(document, 'touchmove', drag);
addEvent(document, 'touchend', end);
addEvent(document, 'touchcancel', cancel);

var mouseIsDown = false;
addEvent(document, 'mousedown', function(event){
    mouseIsDown = true;
    if(!interactions.length){
        new Interaction(event);
    }
    getInteraction().start(event);
});
addEvent(document, 'mousemove', function(event){
    if(!interactions.length){
        new Interaction(event);
    }
    var interaction = getInteraction();
    if(!interaction){
        return;
    }
    if(mouseIsDown){
        interaction.drag(event);
    }else{
        interaction.move(event);
    }
});
addEvent(document, 'mouseup', function(event){
    mouseIsDown = false;
    var interaction = getInteraction();
    if(!interaction){
        return;
    }
    interaction.end(event, null);
});

function addEvent(element, type, callback) {
    if(element.addEventListener){
        element.addEventListener(type, callback);
    }
    else if(document.attachEvent){
        element.attachEvent("on"+ type, callback);
    }
}

module.exports = interact;
},{}],9:[function(require,module,exports){
var cache = {};

function venfix(property, target){
    var bodyStyle = document.body.style;

    if(!target && cache[property]){
        return cache[property];
    }

    target = target || bodyStyle;

    var props = [];

    for(var key in target){
        props.push(key);
    }

    if(property in target){
        return property;
    }

    var propertyRegex = new RegExp('^(' + venfix.prefixes.join('|') + ')' + property + '$', 'i');

    for(var i = 0; i < props.length; i++) {
        if(props[i].match(propertyRegex)){
            if(target === bodyStyle){
                cache[property] = props[i]
            }
            return props[i];
        }
    }
}

// Add extensibility
venfix.prefixes = ['webkit', 'moz', 'ms', 'o'];

module.exports = venfix;
},{}]},{},[2])