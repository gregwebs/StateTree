interface Window { angular: any; }

interface StateChart {
  root: RootState;
  currentStates():AnyState[];
  activeStates(): AnyState[];
  isActive: {[name:string]: Boolean;};
  statesByName: {[name:string]: AnyState;};
  stateFromName(name:string): AnyState;
  handleError: Function;
  defaultToHistory: Boolean;
  defaultToHistoryState();
  enterFn(state:State):undefined;
  enter(fn:(State) => undefined):undefined;
  exitFn(state:State):undefined;
  exit(fn:(State) => undefined):undefined;
}

interface StateCallback {
  (state:State): undefined;
}

interface AnyState {
  name:string;
  statechart:StateChart;
  childStates:State[];
  defaultSubState?:State;
  history?:State;

  subStatesAreConcurrent:Boolean;
  concurrentSubStates();

  enterFns: Function[];
  exitFns: Function[];
  enter(fn:Function):State;
  exit(fn:Function):State;

  subState(name:String, nestingFn?: StateCallback): State;
  defaultTo(state:State):State;
  changeDefaultTo(state:State):State;

  goTo(data?:any):AnyState;
  defaultState();
  activeSubState():State;
}

interface State extends AnyState {
  parentState:State;
}

interface RootState extends AnyState { }
