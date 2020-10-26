import { useService } from "../../core/hooks";
import { RPC } from "../../services/rpc";

async function nextTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
}

export enum BatchStrategy {
  Time = "Time",
  Tick = "Tick",
  Amount = "Amount",
}

export enum BatchState {
  Idling = "Idling",
  Gathering = "Gathering",
  Fetching = "Fetching",
}

export interface BatchOptions {
  strategy: BatchStrategy;
  strategyValue: number;
}

interface BatchedRPC {
  id: number;
  rpc: { route: string; params?: { [key: string]: any } };
}

type Endpoint = string;

export class RPCBatchManager {
  private readonly _options: BatchOptions;
  private readonly _endpoint: Endpoint;
  private _batchPool: Array<RPCBatch>;

  constructor(options: BatchOptions, endpoint: Endpoint = "/wowl/batch-query-dispatch") {
    this._options = options;
    this._endpoint = endpoint;
    this._batchPool = new Array<RPCBatch>();
  }

  rpc(route: string, params?: { [key: string]: any }): Promise<any> {
    let batchToUse = this._batchPool.find((batch) => batch.available);

    if (!batchToUse) {
      console.log("Generating a new RPC batch");
      batchToUse = new RPCBatch(this._options, this._endpoint);
      this._batchPool.push(batchToUse);
    }

    return batchToUse.rpc(route, params);
  }
}

class RPCBatch {
  private _options: BatchOptions;
  private readonly _endpoint: Endpoint;
  private _rpcs: Array<BatchedRPC>;
  private _callbacks: Map<number, any>;

  private _state = BatchState.Idling;
  private _id = 0;
  private readonly _rpc: RPC;

  constructor(options: BatchOptions, endpoint: Endpoint = "/wowl/batch-query-dispatch") {
    this._options = options;
    this._endpoint = endpoint;
    this._rpcs = new Array<BatchedRPC>();
    this._rpc = useService("rpc"); // attention bound to wrong components after a while
    this._callbacks = new Map();
  }

  get state(): BatchState {
    return this._state;
  }

  get available() {
    return this._state === BatchState.Idling || this._state === BatchState.Gathering;
  }

  async rpc(route: string, params?: { [key: string]: any }): Promise<any> {
    if (this._state === BatchState.Fetching) {
      throw new Error("This batch is already fetching data, you cannot add any more rpcs to it.");
    }

    console.log("Adding an RPC to a batch. Element", this._id);

    this._rpcs.push({
      id: ++this._id,
      rpc: { route: route, params: params },
    });

    if (
      this._state === BatchState.Idling ||
      (this._state === BatchState.Gathering && this._options.strategy === BatchStrategy.Amount)
    ) {
      this._gather();
    }

    return new Promise<any>((resolve) => {
      this._callbacks.set(this._id, resolve.bind(this));
    });
  }

  async _gather() {
    this._state = BatchState.Gathering;

    switch (this._options.strategy) {
      case BatchStrategy.Time:
        setTimeout(this._fetch.bind(this), this._options.strategyValue);
        break;

      case BatchStrategy.Tick:
        let tickCounter = 0;
        while (tickCounter !== this._options.strategyValue) {
          await nextTick();
          tickCounter++;
        }
        this._fetch();
        break;

      case BatchStrategy.Amount:
        if (this._rpcs.length === this._options.strategyValue) this._fetch();
        break;
    }
  }

  async _fetch() {
    this._state = BatchState.Fetching;

    const params = {
      rpcs: this._rpcs,
    };

    const results = await this._rpc(this._endpoint, params);

    results.forEach((result: any) => {
      this._callbacks.get(result.id)(result.data);
    });

    this._reset();
  }

  _reset() {
    this._rpcs = new Array<BatchedRPC>();
    this._state = BatchState.Idling;
    this._id = 0;
    this._callbacks = new Map();
  }
}
