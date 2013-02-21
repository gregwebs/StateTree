interface MakeStateTree {
    (): StateChart;
}
interface StateChart {
    root: RootState;
    currentStates(): AnyState[];
    activeStates(): AnyState[];
    isActive: {
        [name: string]: Boolean;
    };
    statesByName: {
        [name: string]: AnyState;
    };
    stateFromName(name: string): AnyState;
    handleError: Function;
    defaultToHistory: Boolean;
    defaultToHistoryState();
    enterFn(state: State): void;
    exitFn(state: State): void;
    enter(fn: (State: any) => void): void;
    exit(fn: (State: any) => void): void;
}
interface StateCallback {
    (state: State): void;
}
interface AnyState {
    name: string;
    statechart: StateChart;
    childStates: State[];
    defaultSubState?: State;
    history?: State;
    subStatesAreConcurrent: bool;
    concurrentSubStates();
    enterFns: Function[];
    exitFns: Function[];
    enter(fn: Function): State;
    exit(fn: Function): State;
    subState(name: string, nestingFn?: StateCallback): State;
    defaultTo(state: State): State;
    changeDefaultTo(state: State): State;
    goTo(data?: any): AnyState;
    defaultState();
    activeSubState(): State;
    onlyEnterThrough(...states: State[]);
    allowedFrom?: State[];
    activeChildState(): State;
}
interface State extends AnyState {
    parentState: State;
}
interface RootState extends AnyState {
}
