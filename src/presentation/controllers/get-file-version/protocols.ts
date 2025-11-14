import { Controller, Request, Response, Validator } from "../../protocols/index.js";
import { VersionInfo } from "../../../data/protocols/file-repository.js";

export interface GetFileVersionRequest {
  projectName: string;
  fileName: string;
  versionId: string;
}

export interface GetFileVersionResponse {
  content: string;
}

export interface ListFileVersionsRequest {
  projectName: string;
  fileName: string;
}

export interface ListFileVersionsResponse {
  versions: VersionInfo[];
}

export interface RevertFileVersionRequest {
  projectName: string;
  fileName: string;
  versionId: string;
}

export interface RevertFileVersionResponse {
  content: string;
}

export type GetFileVersionController = Controller<GetFileVersionRequest, GetFileVersionResponse>;
export type ListFileVersionsController = Controller<ListFileVersionsRequest, ListFileVersionsResponse>;
export type RevertFileVersionController = Controller<RevertFileVersionRequest, RevertFileVersionResponse>;
export type RequestValidator = Validator;
export type { Request, Response };