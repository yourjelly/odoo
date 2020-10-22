import {useService} from "../core/hooks";
import {RPC} from "./rpc";

async function nextTick(): Promise<void> {
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  await new Promise((resolve) => setTimeout(resolve));
}

enum BatchStrategy {
  Time = "Time",
  Tick = "Tick",
  Amount = "Amount",
}

enum BatchState {
  Idling = "Idling",
  Gathering = "Gathering",
  Fetching = "Fetching",
}

interface BatchOptions {
  strategy: BatchStrategy;
  strategyValue: number;
}

interface RPCParams {
  route: string,
  params: object
}

interface BatchedRPC {
  id: number;
  rpc: RPCParams;
}

type Endpoint = string;

/*
class RPCBatchDispatcher {
  private _options: BatchOptions;
  private _endpoint: Endpoint;

  private _runningBatches: Array<RPCBatch>;
  private _gatheringBatches: Array<RPCBatch>;
  private _idleBatches: Array<RPCBatch>;

  constructor(options: BatchOptions, endpoint: Endpoint) {
    this._options = options;
    this._endpoint = endpoint;
    this._runningBatches = new Array<RPCBatch>();
    this._gatheringBatches = new Array<RPCBatch>();
    this._idleBatches = new Array<RPCBatch>();
  }

  dispatch(rpc: RPC) {

    // search first gathering element
    let batchToUse = this._gatheringBatches.pop() ?? this._idleBatches.pop();

    if (!batchToUse) {
      batchToUse = new RPCBatch(this._options, this._endpoint);
    }

    this._gatheringBatches.push(batchToUse);
    return batchToUse.executeInBatch(rpc)

  }
}
*/

class RPCBatch {
  private _options: BatchOptions;
  private _endpoint: Endpoint;
  private _rpcs: Array<BatchedRPC>;
  private _callback: Promise;

  private _state = BatchState.Idling;
  private _id = 0;
  private _rpc: RPC;

  constructor(options: BatchOptions, endpoint: Endpoint) {
    this._options = options;
    this._endpoint = endpoint;
    this._rpcs = new Array<BatchedRPC>();
    this._rpc = useService('rpc');
  }

  get state(): BatchState {
    return this._state;
  }

  async rpc(rpc: RPCParams) {

    if (this._state === BatchState.Fetching) {
      throw new Error("This batch is already fetching data, you cannot add any more rpcs to it.");
    }

    this._rpcs.push({
      id: this._id++,
      rpc: rpc,
    });

    if (this._state === BatchState.Idling) {
      this._startGatheringState();
    }

    return this._callback;

  }

  async _startGatheringState() {
    this._state = BatchState.Gathering;

    switch (this._options.strategy) {
      case BatchStrategy.Time:
        setTimeout(this._fetch, this._options.strategyValue);
        break;

      case BatchStrategy.Tick:
        let tickCounter = 0;
        while (tickCounter !== this._options.strategyValue) await nextTick();
        this._fetch();
        break;

      case BatchStrategy.Amount:
        if (this._rpcs.length === this._options.strategyValue)
          this._fetch();
        break;
    }
  }

  async _fetch() {
    this._state = BatchState.Fetching;

    const params = {
      rpcs: this._rpcs
    }

    const results = await this._rpc(this._endpoint, params);

    // todo break down results

    this._callback.resolve(results);

    this._reset();
  }

  _reset() {
    this._rpcs = new Array<BatchedRPC>();
    this._state = BatchState.Idling;
    this._id = 0;
  }
}

/**
 * return await new Promise(resolve => {
          setTimeout(async () => {
            const res = await this._fetch();
            resolve(res);
          }, 1000);
        });
 */
