import { BeatmapDetails } from "../models/api";
import { QueryOrder, SearchSummary } from "../models/ipc";
import { Metrics } from "../models/metrics";
import { Node } from "../models/filter";
import { invoke } from "./invoke";

export interface ResultPage {
  beatmaps: BeatmapDetails[];
  owned: number[];
}

export const queryBridge = {
  search: (node: Node, name: string, limit?: number, order?: QueryOrder) =>
    invoke<SearchSummary>("search:query", node, name, limit, order),
  getResultPage: (id: string, page: number, pageSize: number) => invoke<ResultPage>("search:page", id, page, pageSize),
  getMetrics: () => invoke<Metrics | null>("server:metrics"),
};
