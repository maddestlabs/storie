/**
 * Backwards-compat shim.
 *
 * The feature was renamed from “presentation sync” -> “host sync”.
 * Keep these exports so older imports and code continue to work.
 */

export {
  HostSync as PresentationSync,
  parseHostParams as parsePresentationParams,
  createHostSessionIds as createPresentationSessionIds,
  makeClientJoinUrl as makeJoinUrl
} from './host-sync.js';

export type {
  HostRole as PresentationRole,
  HostTransport as PresentationTransport,
  HostMessage as PresentationMessage,
  HostSyncConfig as PresentationSyncConfig,
  HostSessionInfo as PresentationSessionInfo
} from './host-sync.js';
