/// <reference path="statetree.d.ts" />
interface Transition {
    from: State[];
    to: State;
    with: Function;
}
interface Signal {
    name: string;
    dispatch(args: any[]);
    transitions: Transition[];
    cb: Function;
    tree: StateChart;
}
