(function (_, undefined) {
    var DEBUG = true;
    var State = function (name, parentState) {
        this.name = name;
        this.childStates = [];
        this.subStatesAreConcurrent = false;
        this.enterFns = [];
        this.exitFns = [];
        if(parentState) {
            this.parentState = parentState;
            parentState.childStates.push(this);
            this.statechart = parentState.statechart;
            this.statechart.statesByName[name] = this;
        }
    };
    State.prototype.subState = function (name, nestingFn) {
        var state = new State(name, this);
        if(nestingFn) {
            nestingFn(state);
        }
        return state;
    };
    State.prototype.defaultState = function () {
        if(!this.parentState) {
            throw new Error("cannot default root state");
        }
        this.parentState.defaultTo(this);
        return this;
    };
    State.prototype.changeDefaultTo = function (state) {
        this.defaultSubState = state;
        return this;
    };
    State.prototype.defaultTo = function (state) {
        if(this.defaultSubState) {
            errorDefaultAndConcurrent(state);
        }
        return this.changeDefaultTo(state);
    };
    var errorDefaultAndConcurrent = function (state) {
        throw new Error("cannot have a default sub state among concurrent states");
    };
    State.prototype.concurrentSubStates = function () {
        if(this.defaultSubState) {
            errorDefaultAndConcurrent(this.defaultSubState);
        }
        this.subStatesAreConcurrent = true;
        return this;
    };
    State.prototype.enter = function (fn) {
        this.enterFns.push(fn);
        return this;
    };
    State.prototype.exit = function (fn) {
        this.exitFns.push(fn);
        return this;
    };
    State.prototype.activeChildState = function () {
        var _this = this;
        return _.find(this.childStates, function (state) {
            return _this.statechart.isActive[state.name];
        });
    };
    var safeCallback = function (statechart, cb) {
        var args = [];
        for (var _i = 0; _i < (arguments.length - 2); _i++) {
            args[_i] = arguments[_i + 2];
        }
        if(!cb) {
            return undefined;
        }
        try  {
            cb.apply(undefined, args);
        } catch (e) {
            statechart.handleError(e, cb, args);
        }
    };
    var exitStates = function (exited) {
        _.each(exited.reverse(), function (state) {
            state.statechart.isActive[state.name] = false;
            if(state.parentState) {
                state.parentState.history = state;
            }
            state.statechart.exitFn(state);
            lodash.each(state.exitFns, function (exitFn) {
                safeCallback(state.statechart, exitFn, state);
            });
        });
    };
    var iterateActive = function (tree, cb) {
        _.each(tree.childStates, function (node) {
            if(tree.statechart.isActive[node.name]) {
                cb(node);
                iterateActive(node, cb);
            }
        });
    };
    var moveUpToActive = function (state, entered) {
        if(state.statechart.isActive[state.name]) {
            return state;
        } else {
            entered.push(state);
            return moveUpToActive(state.parentState, entered);
        }
    };
    var inGoTo = [];
    var handlePendingGoTo = function (currentState) {
        var nextState = inGoTo.shift();
        if(inGoTo.length > 0) {
            throw new Error("requested to goTo multiple other states " + _(inGoTo).pluck('name') + " while using a goTo to enter state " + currentState.name);
        }
        if(nextState) {
            nextState.goTo();
        }
        return currentState;
    };
    State.prototype.goTo = function () {
        if(inGoTo.length > 0) {
            inGoTo.push(this);
            return;
        }
        var statechart = this.statechart;
        var entered = [];
        var exited = [];
        var alreadyActive = moveUpToActive(this, entered);
        entered.reverse();
        if(alreadyActive.name === this.name) {
            return handlePendingGoTo(this);
        }
        if(!alreadyActive.subStatesAreConcurrent) {
            _.each(alreadyActive.childStates, function (state) {
                if(state.name != entered[0].name) {
                    if(statechart.isActive[state.name]) {
                        exited.push(state);
                        iterateActive(state, function (s) {
                            return exited.push(s);
                        });
                    }
                }
            });
        }
        var expected = this;
        if(entered.length > 0) {
            var last = null;
            var def = null;
            while(def = ((last = entered[entered.length - 1]) && ((statechart.defaultToHistory && last.history) || last.defaultSubState))) {
                entered.push(def);
                expected = def;
            }
        } else {
            throw new Error("impossible!");
        }
        exitStates(exited);
        _.each(entered, function (state) {
            statechart.enterFn(state);
            statechart.isActive[state.name] = true;
            lodash.each(state.enterFns, function (enterFn) {
                safeCallback(statechart, enterFn, state);
            });
        });
        if(DEBUG) {
            if(statechart.currentStates().indexOf(expected) == -1) {
                throw new Error("expected to go to state " + this.name + ", but now in states " + _(statechart.currentStates()).pluck('name').join(","));
            }
        }
        return handlePendingGoTo(this);
    };
    var StateChart = function (root) {
        var statesByName = {
        };
        statesByName[root.name] = root;
        var isActive = {
        };
        isActive[root.name] = true;
        var chart = {
            root: root,
            statesByName: statesByName,
            stateFromName: function (name) {
                var res = statesByName[name];
                if(!res) {
                    throw new Error("invalid state name: " + name);
                }
                return res;
            },
            isActive: isActive,
            handleError: function (e) {
                if(e.message) {
                    console.log(e.message);
                }
                if(e.stack) {
                    console.log(e.stack);
                }
            },
            defaultToHistory: false,
            defaultToHistoryState: function () {
                this.defaultToHistory = true;
            },
            activeStates: function () {
                var actives = [
                    this.root
                ];
                iterateActive(this.root, function (state) {
                    return actives.push(state);
                });
                return actives;
            },
            currentStates: function () {
                var leaves = [];
                var statechart = this;
                iterateActive(statechart.root, function (state) {
                    if(!_.any(state.childStates, function (child) {
                        return statechart.isActive[child];
                    })) {
                        leaves.push(state);
                    }
                });
                return (leaves.length == 0) ? [
                    this.root
                ] : leaves;
            },
            enterFn: function (state) {
                if(DEBUG) {
                    console.log("entering " + state.name);
                }
            },
            enter: function (fn) {
                this.enterFn = fn;
                return this;
            },
            exitFn: function (state) {
                if(DEBUG) {
                    console.log("exiting: " + state.name + " history of " + state.parentState.name);
                }
            },
            exit: function (fn) {
                this.exitFn = fn;
                return this;
            }
        };
        root.statechart = chart;
        return chart;
    };
    var makeStateTree = function () {
        return StateChart(new State("root"));
    };
    if(typeof window !== "undefined") {
        window.makeStateTree = makeStateTree;
    }
    if(typeof ender === 'undefined') {
        this['makeStateTree'] = makeStateTree;
    }
    if(typeof define === "function" && define.amd) {
        define("makeStateTree", [], function () {
            return makeStateTree;
        });
    }
}).call(this, lodash);
//@ sourceMappingURL=statetree.js.map
