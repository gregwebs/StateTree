interface MakeStateTree {
    (): StateChart;
}
interface StateChart {
    root: RootState;
    currentStates(): AnyState[];
    activeStates(): AnyState[];
    isActive: {
        [name: string]: bool;
    };
    statesByName: {
        [name: string]: AnyState;
    };
    stateFromName(name: string): AnyState;
    handleError: Function;
    defaultToHistory: bool;
    defaultToHistoryState();
    enterFn(state: State): void;
    exitFn(state: State): void;
    enter(fn: (State: any) => void): void;
    exit(fn: (State: any) => void): void;
    intersect(...states: State[]): StateIntersection;
}
interface HasStateCallbacks {
    enter(fn: Function): State;
    exit(fn: Function): State;
}
interface StateIntersection extends HasStateCallbacks {
}
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
    defaultTo(state: State): State;
    changeDefaultTo(state: State): State;
    goTo(data?: any): State[];
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
interface RootState extends AnyState {
}
