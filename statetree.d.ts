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

  enterFn: Function;
  exitFn: Function;
  enter(fn:Function):State;
  exit(fn:Function):State;

  subState(name:String, nestingFn?: StateCallback): State;
  defaultTo(state:State):State;
  changeDefaultTo(state:State):State;

  goTo():AnyState;
  defaultState();
  activeSubState():State;
}

interface State extends AnyState {
  parentState:State;
}

interface RootState extends AnyState { }
