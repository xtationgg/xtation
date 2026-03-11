export const SCENE_API_CHANNEL = "xtation.scene";
export const SCENE_API_VERSION = "1.0";

export const SCENE_API_COMMANDS = [
  "hello",
  "getState",
  "getCapabilities",
  "setStatePartial",
  "applyPreset",
  "setEnvironmentMode",
  "setHdriProfile",
  "setCameraShot",
  "setCameraMotion",
  "setLight",
  "setScreen",
  "setScreenMedia",
  "setScreenAudio",
  "playPauseMedia",
  "captureStill",
  "exportPack",
] as const;
export const SCENE_API_EVENTS = [
  "ready",
  "stateChanged",
  "commandAccepted",
  "commandCompleted",
  "commandFailed",
  "screenMediaChanged",
  "screenRemoved",
  "providerPlaybackSync",
  "providerMuteSync",
  "providerReady",
  "providerLoading",
  "providerState",
  "mediaError",
] as const;
export const SCENE_API_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNSUPPORTED_COMMAND",
  "VALIDATION_FAILED",
  "UNAUTHORIZED_ORIGIN",
  "RATE_LIMITED",
  "BUSY",
  "TIMEOUT",
  "CORS_BLOCKED",
  "MEDIA_UNSUPPORTED",
  "INTERNAL_ERROR",
] as const;

export type SceneApiCommandName = (typeof SCENE_API_COMMANDS)[number];
export type SceneApiKind = "command" | "response" | "event";
export type SceneApiErrorCode = (typeof SCENE_API_ERROR_CODES)[number];

export type SceneApiError = {
  code: SceneApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
};

export type SceneApiEnvelopeBase = {
  channel: string;
  sessionId: string;
  apiVersion: string;
  kind: SceneApiKind;
  domain: "scene";
  name: string;
  requestId: string;
  ts: number;
  origin: "host" | "scene";
};

export type SceneApiCommandMessage = SceneApiEnvelopeBase & {
  kind: "command";
  origin: "host";
  name: SceneApiCommandName;
  payload?: unknown;
  idempotencyKey?: string;
  expectedStateVersion?: number;
  timeoutMs?: number;
};

export type SceneApiResponseMessage = SceneApiEnvelopeBase & {
  kind: "response";
  origin: "scene";
  ok: boolean;
  result: unknown;
  error: SceneApiError | null;
  stateVersion: number;
};

export type SceneApiEventMessage = SceneApiEnvelopeBase & {
  kind: "event";
  origin: "scene";
  payload: unknown;
  stateVersion: number;
};

export type SceneApiCapabilities = {
  apiVersion: string;
  supportedApiVersions: string[];
  channel: string;
  commands: SceneApiCommandName[];
  events: string[];
  errors: SceneApiErrorCode[];
  limits: {
    maxScreens: number;
    supportedProviders: string[];
    maxTextureSize: number;
    captureFormats: Array<"png" | "jpg">;
    exportFormats: string[];
    maxModelUploadMB: number;
  };
  execution: {
    minTimeoutMs: number;
    defaultTimeoutMs: number;
    maxTimeoutMs: number;
    maxRetryCount: number;
    idempotencyTtlMs: number;
  };
  featureFlags: {
    providerMedia: boolean;
    serverMediaResolver: boolean;
    stateVersioning: boolean;
    idempotency: boolean;
    postMessageBridge: boolean;
    windowBridge: boolean;
    screenDirectManipulation: boolean;
    lightDirectManipulation: boolean;
  };
};

export type SceneApiClientOptions = {
  target: HTMLIFrameElement | Window;
  targetOrigin?: string;
  timeoutMs?: number;
  autoHello?: boolean;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const createRequestId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export class SceneApiClient {
  private readonly target: HTMLIFrameElement | Window;
  private readonly targetOrigin: string;
  private readonly defaultTimeoutMs: number;
  private sessionId = "";
  private disposed = false;
  private readonly listeners = new Set<(event: SceneApiEventMessage) => void>();
  private readonly pending = new Map<
    string,
    {
      resolve: (value: SceneApiResponseMessage) => void;
      reject: (reason?: unknown) => void;
      timer: number;
    }
  >();

  constructor(options: SceneApiClientOptions) {
    this.target = options.target;
    this.targetOrigin = options.targetOrigin ?? window.location.origin;
    this.defaultTimeoutMs = Math.max(250, options.timeoutMs ?? 12_000);
    window.addEventListener("message", this.onMessage);
    if (options.autoHello) {
      void this.hello().catch(() => {
        // Auto hello is best-effort.
      });
    }
  }

  getSessionId() {
    return this.sessionId;
  }

  async hello(requestedVersion = SCENE_API_VERSION) {
    const response = await this.send("hello", {
      requestedVersion,
    });
    if (response.ok && isObjectRecord(response.result) && typeof response.result.sessionId === "string") {
      this.sessionId = response.result.sessionId;
    }
    return response;
  }

  async command(
    name: Exclude<SceneApiCommandName, "hello">,
    payload?: unknown,
    options?: {
      idempotencyKey?: string;
      expectedStateVersion?: number;
      timeoutMs?: number;
    }
  ) {
    if (!this.sessionId) {
      const helloResponse = await this.hello();
      if (!helloResponse.ok) {
        return helloResponse;
      }
    }
    return this.send(name, payload, options);
  }

  async getCapabilities(options?: { timeoutMs?: number }) {
    const response = await this.command("getCapabilities", undefined, {
      timeoutMs: options?.timeoutMs,
    });
    if (!response.ok || !isObjectRecord(response.result)) return null;
    const capabilities = response.result.capabilities;
    if (!isObjectRecord(capabilities)) return null;
    return capabilities as SceneApiCapabilities;
  }

  async getState(options?: { timeoutMs?: number }) {
    const response = await this.command("getState", undefined, {
      timeoutMs: options?.timeoutMs,
    });
    if (!response.ok || !isObjectRecord(response.result)) return null;
    const state = response.result.state;
    return isObjectRecord(state) ? state : null;
  }

  waitForEvent(
    name: string,
    options?: {
      timeoutMs?: number;
      filter?: (event: SceneApiEventMessage) => boolean;
    }
  ) {
    const timeoutMs = Math.max(250, options?.timeoutMs ?? this.defaultTimeoutMs);
    return new Promise<SceneApiEventMessage>((resolve, reject) => {
      let timer = 0;
      const stop = this.onEvent((event) => {
        if (event.name !== name) return;
        if (options?.filter && !options.filter(event)) return;
        window.clearTimeout(timer);
        stop();
        resolve(event);
      });
      timer = window.setTimeout(() => {
        stop();
        reject(new Error(`Scene API event timeout: ${name}`));
      }, timeoutMs);
    });
  }

  onEvent(listener: (event: SceneApiEventMessage) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("message", this.onMessage);
    this.pending.forEach(({ timer, reject }) => {
      window.clearTimeout(timer);
      reject(new Error("Scene API client destroyed"));
    });
    this.pending.clear();
    this.listeners.clear();
  }

  private getTargetWindow() {
    if (this.target instanceof HTMLIFrameElement) {
      return this.target.contentWindow;
    }
    return this.target;
  }

  private readonly onMessage = (event: MessageEvent<unknown>) => {
    if (this.disposed) return;
    if (this.targetOrigin !== "*" && event.origin !== this.targetOrigin) return;
    const data = event.data;
    if (!isObjectRecord(data)) return;
    if (data.channel !== SCENE_API_CHANNEL || data.domain !== "scene") return;
    if (data.kind === "event") {
      const sceneEvent = data as SceneApiEventMessage;
      this.listeners.forEach((listener) => {
        try {
          listener(sceneEvent);
        } catch {
          // Listener failures must not break message handling.
        }
      });
      return;
    }
    if (data.kind === "response" && typeof data.requestId === "string") {
      const pending = this.pending.get(data.requestId);
      if (!pending) return;
      this.pending.delete(data.requestId);
      window.clearTimeout(pending.timer);
      pending.resolve(data as SceneApiResponseMessage);
    }
  };

  private async send(
    name: SceneApiCommandName,
    payload?: unknown,
    options?: {
      idempotencyKey?: string;
      expectedStateVersion?: number;
      timeoutMs?: number;
    }
  ): Promise<SceneApiResponseMessage> {
    if (this.disposed) {
      throw new Error("Scene API client has been disposed");
    }
    const targetWindow = this.getTargetWindow();
    if (!targetWindow) {
      throw new Error("Scene iframe target window is not available");
    }
    const requestId = createRequestId();
    const timeoutMs = Math.max(250, options?.timeoutMs ?? this.defaultTimeoutMs);
    const message: SceneApiCommandMessage = {
      channel: SCENE_API_CHANNEL,
      sessionId: name === "hello" ? "" : this.sessionId,
      apiVersion: SCENE_API_VERSION,
      kind: "command",
      domain: "scene",
      name,
      requestId,
      ts: Date.now(),
      origin: "host",
      payload,
      ...(typeof options?.idempotencyKey === "string" && options.idempotencyKey.length > 0
        ? { idempotencyKey: options.idempotencyKey }
        : {}),
      ...(typeof options?.expectedStateVersion === "number"
        ? { expectedStateVersion: options.expectedStateVersion }
        : {}),
      timeoutMs,
    };

    return new Promise<SceneApiResponseMessage>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Scene API timeout for command: ${name}`));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      targetWindow.postMessage(message, this.targetOrigin);
    });
  }
}

export const createSceneApiClient = (options: SceneApiClientOptions) => new SceneApiClient(options);
