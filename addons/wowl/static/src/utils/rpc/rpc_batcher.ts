import { useService } from "../../core/hooks";
import { RPC } from "../../services/rpc";

async function nextTick(): Promise<void> {
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
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
  private _options: BatchOptions;
  private _endpoint: Endpoint;
  private _batches: Array<RPCBatch>;

  constructor(options: BatchOptions, endpoint: Endpoint = "/wowl/batch-query-dispatch") {
    this._options = options;
    this._endpoint = endpoint;
    this._batches = new Array<RPCBatch>();
  }

  rpc(route: string, params?: { [key: string]: any }): Promise<any> {

    let batchToUse = this._batches.find((batch) => batch.available);

    if (!batchToUse) {
      batchToUse = new RPCBatch(this._options, this._endpoint);
      this._batches.push(batchToUse);
    }

    return batchToUse.rpc(route, params);
  }
}

class RPCBatch {
  private _options: BatchOptions;
  private _endpoint: Endpoint;
  private _rpcs: Array<BatchedRPC>;
  private _callback: any;

  private _state = BatchState.Idling;
  private _id = 0;
  private _rpc: RPC;

  constructor(options: BatchOptions, endpoint: Endpoint = "/wowl/batch-query-dispatch") {
    this._options = options;
    this._endpoint = endpoint;
    this._rpcs = new Array<BatchedRPC>();
    this._rpc = useService("rpc");
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

    this._rpcs.push({
      id: this._id++,
      rpc: { route: route, params: params },
    });

    if (
      this._state === BatchState.Idling ||
      (this._state === BatchState.Gathering && this._options.strategy === BatchStrategy.Amount)
    ) {
      this._startGatheringState();
    }

    return new Promise<any>((resolve) => {
      this._callback = resolve;
    });
  }

  async _startGatheringState() {
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

    // todo break down results

    this._callback(results);

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
