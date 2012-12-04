/// <reference path="./statetree.d.ts" />
declare var lodash // remove lodash dependency?

// for exports
declare var ender
declare var define
declare var module
interface Window { makeStateTree():StateChart; }

(function(_, undefined){
  var DEBUG = true
  var State = function(name:string, parentState?:AnyState):undefined {
    this.name = name
    this.childStates = []
    this.subStatesAreConcurrent = false

    if (parentState) {
      this.parentState = parentState
      parentState.childStates.push(this)
      this.statechart = parentState.statechart
      this.statechart.statesByName[name] = this
    }
  }

  State.prototype.subState = function(name:string, nestingFn?: StateCallback):State {
    var state = new State(name, this)
    if (nestingFn) nestingFn(state)
    return state
  }
  State.prototype.defaultState = function():State {
    if(!this.parentState) throw new Error("cannot default root state")
    this.parentState.defaultTo(this)
    return this
  }
  State.prototype.changeDefaultTo = function(state:State):State {
    this.defaultSubState = state
    return this
  }
  State.prototype.defaultTo = function(state:State):State {
    if (this.defaultSubState) errorDefaultAndConcurrent(state)
    return this.changeDefaultTo(state)
  }
  var errorDefaultAndConcurrent = (state:State):undefined => {
    throw new Error("cannot have a default sub state among concurrent states")
  }
  State.prototype.concurrentSubStates = function():State {
    if (this.defaultSubState) errorDefaultAndConcurrent(this.defaultSubState)
    this.subStatesAreConcurrent = true
    return this
  }
  var assertEmptyFn = (fn:Function, name:String) => {
    if(fn) throw new Error(name + " function already defined")
  }
  State.prototype.enter = function(fn:Function):State {
    assertEmptyFn(this.enterFn, "enter")
    this.enterFn = fn
    return this
  }
  State.prototype.exit = function(fn:Function):State {
    assertEmptyFn(this.exitFn, "exit")
    this.exitFn = fn
    return this
  }
  State.prototype.activeChildState = function():State {
    return _.find(this.childStates, (state) => this.statechart.isActive[state.name])
  }

  // TODO: configurable for error reporting
  var safeCallback = (statechart:StateChart, cb:Function, ...args:any[]):undefined => {
    if (!cb) return undefined
    try { cb.apply(undefined, args) }
    catch(e) { 
      statechart.handleError(e, cb, args)
    }
  }

  var exitStates = (exited:State[]):undefined => {
    _.each(exited.reverse(), (state:State) => {
      state.statechart.isActive[state.name] = false
      if(state.parentState) state.parentState.history = state
      if(DEBUG) { console.log("exiting: " + state.name + " history of " + state.parentState.name) }
      safeCallback(state.statechart, state.exitFn, state)
    })
  }

  var iterateActive = (tree:AnyState, cb:Function):undefined => {
    _.each(tree.childStates, (node) => {
      if (tree.statechart.isActive[node.name]) {
        cb(node)
        iterateActive(node, cb)
      }
    })
  }

  var moveUpToActive = (state:State, entered:State[]):AnyState => {
    if (state.statechart.isActive[ state.name ]) {
      return state
    } else {
      entered.push(state)
      return moveUpToActive(state.parentState, entered)
    }
  }


  var inGoTo = []
  var handlePendingGoTo = (currentState:State):State => {
    var nextState = inGoTo.shift()
    if (inGoTo.length > 0) {
      throw new Error("requested to goTo multiple other states " +
        _(inGoTo).pluck('name') +
        " while using a goTo to enter state " + currentState.name
      )
    }
    if (nextState) nextState.goTo()
    return currentState
  }

  // this is the heart & soul of the statemachine
  // our state machine is actually a tree with active branches
  // statechart.isActive knows about every active state
  // start from the state we want to go to and find an active branch
  // Exit the other tree of the branch and enter the states we moved through to find the branch
  //
  // during goTo() all the enter/exit functions combined can goTo one other state
  // or an exception will be thrown
  // In general only one top-level state should goTo another
  State.prototype.goTo = function():AnyState {
    if (inGoTo.length > 0) {
      inGoTo.push(this)
      return
    }

    var statechart = this.statechart
    var entered = []
    var exited = []
    var alreadyActive = moveUpToActive(this, entered)
    entered.reverse()

    if (alreadyActive.name === this.name) {
      return handlePendingGoTo(this)
      // TODO: throw new Error("already in states: " + this.name)
    }

    if (!alreadyActive.subStatesAreConcurrent) {
      _.each(<Array>alreadyActive.childStates, (state) => {
        if (state.name != entered[0].name) {
          if (statechart.isActive[state.name]){
            exited.push(state)
            iterateActive(state, (s) => exited.push(s))
          }
        }
      })
    }

    var expected = this
    if (entered.length > 0) {
      var last = null
      var def = null
      while (def =
              ((last = entered[entered.length - 1]) &&
                (
                  (statechart.defaultToHistory && last.history) ||
                  last.defaultSubState
                )
              )
            ){
        entered.push(def)
        expected = def
      }
    } else throw new Error("impossible!")

    exitStates(exited)

    _.each(entered, (state:State) => {
      if(DEBUG) console.log("entering " + state.name)
      statechart.isActive[state.name] = true
      safeCallback(statechart, state.enterFn, state)
    })

    if (DEBUG) {
      if (statechart.currentStates().indexOf(expected) == -1) {
        throw new Error("expected to go to state " + this.name +
        ", but now in states " +
        _(statechart.currentStates()).pluck('name').join(","))
      }
    }

    return handlePendingGoTo(this)
  }

  var StateChart = (root:RootState):StateChart => {
    var statesByName = {}
    statesByName[root.name] = root
    var isActive = {}
    isActive[root.name] = true

    var chart = {
      root: root
    , statesByName: statesByName
    , isActive: isActive
    , handleError: (e) => {
      if(e.message) console.log(e.message)
      if(e.stack)   console.log(e.stack)
    }
    , defaultToHistory: false
    , defaultToHistoryState: function(){ this.defaultToHistory = true }
    , activeStates: function(){ 
        var actives = [this.root]
        iterateActive(this.root, (state) => actives.push(state))
        return actives
      }
    , currentStates: function(){ 
        var leaves = []
        var statechart = this
        iterateActive(statechart.root, (state) => {
          if (!_.any(state.childStates, (child) => statechart.isActive[child]))
            leaves.push(state)
        })
        return (leaves.length == 0) ? [this.root] : leaves
      }
    }
    root.statechart = chart;
    return chart;
  }

  var makeStateTree = () => StateChart(new State("root"))

  // module is a reserved word in TypeScript, guess I need to use their module thing
  // if(typeof this.module !== "undefined" && module.exports) { module.exports = makeStateTree; }
  if(typeof window !== "undefined") { window.makeStateTree = makeStateTree; }
  if (typeof ender === 'undefined') { this['makeStateTree'] = makeStateTree; }
  if (typeof define === "function" && define.amd) { define("makeStateTree", [], function () { return makeStateTree; }); }
}).call(this, lodash)
