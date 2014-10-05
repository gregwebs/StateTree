interface EnhancedError extends Error {
    stack: any;
}
interface MakeStateTree {
    (): StateChart;
}
interface StateChart {
    root: RootState;
    currentStates(): AnyState[];
    activeStates(): AnyState[];
    isActive: {
        [name: string]: boolean;
    };
    statesByName: {
        [name: string]: AnyState;
    };
    stateFromName(name: string): AnyState;
    handleError(e: Error, cb: () => void): boolean;
    defaultToHistory: boolean;
    defaultToHistoryState(): void;
    enterFn(state: State): void;
    enterFn(state: State, data: any): void;
    exitFn(state: State): void;
    enter(fn: StateCallback): void;
    exit(fn: StateCallback): void;
    safeCallback(cb: () => void): boolean;
    signal(name: string, cb: Function): Function;
}
interface StateDataCallback {
    (state: State): void;
    (state: State, data: any): void;
}
interface StateCallback {
    (state: State, data?: any): void;
}
interface HasStateCallbacks {
    enter(fn: (state: State) => void): State;
    enter(fn: (state: State, data: any) => void): State;
    exit(fn: StateCallback): State;
}
interface StateIntersection extends HasStateCallbacks {
}
interface AnyState extends HasStateCallbacks {
    name: string;
    statechart: StateChart;
    childStates: State[];
    defaultSubState?: State;
    history?: State;
    subStatesAreConcurrent: boolean;
    concurrentSubStates(): State;
    enterFns: StateDataCallback[];
    exitFns: StateCallback[];
    subState(name: string, nestingFn?: (State: any) => void): State;
    defaultTo(state: State): State;
    changeDefaultTo(state: State): State;
    goTo(data?: any): State[];
    defaultState(): State;
    activeSubState(): State;
    onlyEnterThrough(...states: State[]): State;
    allowedFrom?: State[];
    setData(data: any): State;
    isActive(): boolean;
    activeChildState(): State;
    data: any;
    intersect(...states: State[]): StateIntersection;
}
interface State extends AnyState {
    parentState: State;
}
interface RootState extends AnyState {
}
declare module "StateTree" {
    export = makeStateTree;
}
