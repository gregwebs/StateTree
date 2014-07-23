/// <reference path="statetree.d.ts" />
interface Transition {
    from: State[];
    to: State;
    with: Function;
}
interface Signal {
    name: string;
    from(...froms: State[]): Signal;
    to(to: State): Signal;
    dispatch(args: any[]): void;
    transitions: Transition[];
    cb: Function;
    tree: StateChart;
}
