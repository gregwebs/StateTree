declare var lodash

// for exports
declare var ender
declare var define
declare var module

interface MakeStateTree { ():StateChart; }

interface StateChart {
  root            : RootState;

  currentStates() : AnyState[];
  activeStates()  : AnyState[];
  isActive        : {[name: string]: bool;};
  statesByName    : {[name: string]: AnyState;};
  stateFromName(name: string): AnyState;

  handleError      : Function;

  defaultToHistory : bool;
  defaultToHistoryState();

  enterFn(state: State)      : void;
  exitFn( state: State)      : void;
  enter(fn: (State) => void) : void;
  exit( fn: (State) => void) : void;

  intersect(...states: State[]): StateIntersection;
}

interface HasStateCallbacks {
  enter(fn: Function): State;
  exit(fn: Function): State;
}

interface StateIntersection extends HasStateCallbacks {}

interface StateCallback {
  (state: State): void;
}

interface AnyState extends HasStateCallbacks {
  name: string;
  statechart: StateChart;
  childStates: State[];
  defaultSubState?: State;
  history?: State;

  subStatesAreConcurrent: bool;
  concurrentSubStates();

  enterFns: Function[];
  exitFns: Function[];

  subState(name: string, nestingFn?: StateCallback): State;
  defaultTo(state:State): State;
  changeDefaultTo(state: State): State;

  goTo(data?:any): State[];
  defaultState();
  activeSubState(): State;

  onlyEnterThrough(...states: State[]);
  allowedFrom?: State[];

  isActive(): bool;
  activeChildState(): State;
}

interface State extends AnyState {
  parentState: State;
}

interface RootState extends AnyState { }

(function(_, undefined){
  var DEBUG = true
  function State(name: string, parentState?: AnyState): void {
    this.name = name
    this.childStates = []
    this.subStatesAreConcurrent = false
    this.enterFns = []
    this.exitFns = []

    if (parentState) {
      this.parentState = parentState
      parentState.childStates.push(this)
      this.statechart = parentState.statechart
      if (this.statechart.statesByName[name]) {
        throw new Error("state already exists: " + name)
      }
      this.statechart.statesByName[name] = this
    }
  }

  State.prototype.subState = function(name: string, nestingFn?: StateCallback): State {
    var state = new State(name, this)
    if (nestingFn) nestingFn(state)
    return state
  }

  State.prototype.defaultState = function(): State {
    if(!this.parentState) throw new Error("cannot default root state")
    this.parentState.defaultTo(this)
    return this
  }

  State.prototype.changeDefaultTo = function(state: State): State {
    if (this.subStatesAreConcurrent) errorDefaultAndConcurrent(state)
    this.defaultSubState = state
    return this
  }

  State.prototype.defaultTo = function(state: State): State {
    if (this.defaultSubState) { throw new Error("default sub state '" +
      this.defaultSubState.name + "' already exists. Will not change it to '" +
      state.name +
      "'. To dynamically change default states use '.changeDefaultTo'")
    }
    return this.changeDefaultTo(state)
  }

  var errorDefaultAndConcurrent = (state: State): void => {
    throw new Error("cannot have a default sub state among concurrent states")
  }

  State.prototype.concurrentSubStates = function(): State {
    if (this.defaultSubState) errorDefaultAndConcurrent(this.defaultSubState)
    this.subStatesAreConcurrent = true
    return this
  }

  State.prototype.enter = function(fn: Function): State {
    this.enterFns.push(fn)
    return this
  }

  State.prototype.exit = function(fn: Function): State {
    this.exitFns.push(fn)
    return this
  }

  State.prototype.onlyEnterThrough = function(...states: State[]): State {
    if (this.allowedFrom) { throw new Error("allowed states are already set") }
    this.allowedFrom = _.map(states, (state) => state.name)
    return this
  }

  State.prototype.isActive = function(): bool {
    return !!this.statechart.isActive[this.name]
  }

  State.prototype.activeChildState = function():State {
    return _.find(this.childStates, (state) => state.isActive())
  }


  // TODO: configurable for error reporting
  function safeCallback(statechart: StateChart, cb: Function, ...args: any[]): void {
    if (!cb) { return }
    try { cb.apply(undefined, args) }
    catch(e) { 
      statechart.handleError(e, cb, args)
    }
  }

  function exitStates(exited: State[]): void {
    _.each(exited.reverse(), (state: State) => {
      state.statechart.isActive[state.name] = false
      if(state.parentState) state.parentState.history = state
      state.statechart.exitFn(state)
      lodash.each(state.exitFns, (exitFn) => {
        safeCallback(state.statechart, exitFn, state)
      })
    })
  }

  function iterateActive(tree: AnyState, cb: Function): void {
    _.each(tree.childStates, (state: State) => {
      if (state.isActive()) {
        cb(state)
        iterateActive(state, cb)
      }
    })
  }

  function moveUpToActive(state: State, entered: State[]): AnyState {
    if (state.isActive()) { return state } else {
      entered.push(state)
      return moveUpToActive(state.parentState, entered)
    }
  }


  var inGoTo = []
  function handlePendingGoTo(currentState: State): void {
    var nextState = inGoTo.shift()
    if (inGoTo.length > 0) {
      throw new Error("requested to goTo multiple other states " +
        _(inGoTo).pluck('name') +
        " while using a goTo to enter state " + currentState.name
      )
    }
    if (nextState) nextState.goTo()
  }

  // returns: an array of the states that were exited for this goTo
  //
  // this is the heart & soul of the statemachine
  // our state machine is actually a tree with active branches
  // statechart.isActive knows about every active state
  // start from the state we want to go to and find an active branch
  // Exit the other tree of the branch and enter the states we moved through to find the branch
  //
  // goTo during an enter/exit callback should generally be avoided
  // during goTo() all the enter/exit functions combined can only goTo one other state
  // otherwise an exception will be thrown
  //
  // goTo takes an optional data parameter that will be passed
  // to the enter callback, but only for this goTo state.
  // Other states entered will not have their enter callback receive the data
  State.prototype.goTo = function(data?: any): State[] {
    if (inGoTo.length > 0) {
      inGoTo.push(this)
      return
    }

    var statechart : StateChart = this.statechart
    var entered : State[] = []
    var exited  : State[] = []
    var alreadyActive = moveUpToActive(this, entered)
    entered.reverse()

    if (alreadyActive.name === this.name) {
      handlePendingGoTo(this)
      return []
      // throw new Error("already in state: " + this.name)
    }

    if (!alreadyActive.subStatesAreConcurrent) {
      _.each(alreadyActive.childStates, (state: State) => {
        if (state.name != entered[0].name) {
          if (state.isActive()){
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

    // check to see if any state transitions are restricted
    _.each(entered, (state: State) => {
      if (!state.allowedFrom || state.allowedFrom.length === 0) return

      // My use case was only looking at the state that goTo is called on
      if ((state.allowedFrom.indexOf(this.name) === -1) && (state.name !== this.name)) {
        throw new Error("cannot transition to state '" + state.name +
          "' from '" + this.name + "'. Allowed states: " +
          state.allowedFrom.join(", ")
        )
      }
    })

    exitStates(exited)

    _.each(entered, (state: State) => {
      statechart.enterFn(state)
      statechart.isActive[state.name] = true
      var dataParam = this.name == state.name ? data : undefined
      lodash.each(state.enterFns, (enterFn) => {
        safeCallback(statechart, enterFn, state, dataParam)
      })
    })

    if (DEBUG) {
      if (statechart.currentStates().indexOf(expected) == -1) {
        throw new Error("expected to go to state " + this.name + ", but now in states " + _(statechart.currentStates()).pluck('name').join(","))
      }
    }

    handlePendingGoTo(this)
    return exited
  }

  // A StateIntersection allows enter & exit callbacks to be triggered when multiple states are entered/exited
  // TODO: check that the states are concurrent with each other
  function StateIntersection(states: State[]): void {
    this.states = states
  }

  StateIntersection.prototype.enter = function(fn:(StateIntersection) => void): void {
    var enterFn = (...args: any[]) => {
      if (_.all(this.states, (state) => state.isActive())) {
        if (DEBUG) { console.log('enter intersection: ' + _.map(this.states, (state: State) => state.name).join(' & ')) }
        fn.apply(undefined, args)
      }
    }
    _.each(this.states, (state: State) => { state.enter(enterFn) })
  }

  StateIntersection.prototype.exit = function(fn:(StateIntersection) => void): void {
    var exitFn = (...args: any[]) => {
      if (_.all(this.states, (state) => !state.isActive())) { 
        if (DEBUG) { console.log('exit intersection: ' + _.map(this.states, (state: State) => state.name).join(' & ')) }
        fn.apply(undefined, args)
      }
    }
    _.each(this.states, (state: State) => { state.exit(exitFn) })
  }

  function StateChart(root: RootState): StateChart {
    var statesByName = {}
    statesByName[root.name] = root
    var isActive = {}
    isActive[root.name] = true

    var chart = {
      root: root
      // stateFromName is preferred. won't throw an error.
    , statesByName: statesByName
      // get a state object from its name.
      // throw error if state name does not exist
    , stateFromName: (name:string):State => {
        var res = statesByName[name]
        if (!res) throw new Error("invalid state name: " + name)
        return res
      }
    , isActive: isActive
    , handleError: (e) => {
        if(e.message) console.log(e.message)
        if(e.stack)   console.log(e.stack)
      }
      // if true, always use the history state once it is available as the default state
    , defaultToHistory: false
    , defaultToHistoryState: function(){ this.defaultToHistory = true }
    , activeStates: function(){ 
        var actives = [this.root]
        iterateActive(this.root, (state) => actives.push(state))
        return actives
      }
      // return just the leaves of the active states
    , currentStates: function(){ 
        var leaves = []
        var statechart = this
        iterateActive(statechart.root, (state) => {
          if (!_.any(state.childStates, (child: State) => child.isActive()))
            leaves.push(state)
        })
        return (leaves.length == 0) ? [this.root] : leaves
      }
    , enterFn: (state: State) => {
        if(DEBUG) console.log("entering " + state.name)
      }
    , enter: function(fn: (State) => void){
        this.enterFn = fn
        return this
      }
    , exitFn: (state:State) => {
        if(DEBUG) {
          console.log("exiting: " + state.name + " history of " + state.parentState.name)
        }
      }
    , exit: function(fn:(State) => void){
        this.exitFn = fn
        return this
      }
    , intersect: (...states: State[]) => new StateIntersection(states)
    }
    root.statechart = chart;
    return chart;
  }

  var makeStateTree = () => StateChart(new State("root"))

  // module is a reserved word in TypeScript, guess I need to use their module thing
  // if(typeof this.module !== "undefined" && module.exports) { module.exports = makeStateTree; }
  if(typeof window !== "undefined") { window['makeStateTree'] = makeStateTree; }
  if (typeof ender === 'undefined') { this['makeStateTree'] = makeStateTree; }
  if (typeof define === "function" && define.amd) { define("makeStateTree", [], function () { return makeStateTree; }); }
}).call(this, lodash)
