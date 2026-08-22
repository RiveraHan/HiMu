import { act, render, waitFor } from "@testing-library/react-native";
import { getLocales } from "expo-localization";
import { AppState, Text, type AppStateStatus } from "react-native";
import type {
  UserPreferences,
  UserPreferencesPatch,
} from "@/src/types/preferences";
import type { LanguagePreference } from "../types";
import i18n from "../index";
import {
  readLanguageState,
  writeLanguageState,
  type StoredLanguageState,
} from "../locale-storage";
import { LocaleProvider } from "../LocaleProvider";
import { useLocale } from "../use-locale";
import { syncDocumentLanguage as syncWebDocumentLanguage } from "../document-language.web";

let mockUser: { id: string } | null = null;
let mockSettings: UserPreferences | undefined;
let mockDeviceLanguageCode = "en";
const mockMutateAsync = jest.fn<Promise<void>, [UserPreferencesPatch]>();
const mockShowToast = jest.fn();
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

function installDocumentLanguage(initialLanguage: string) {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement: { lang: initialLanguage } },
  });
}

jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => mockUser,
}));
jest.mock("@/src/api/auth-scope", () => ({
  isCurrentMutationUser: (userId: string) => mockUser?.id === userId,
}));
jest.mock("@/src/hooks/use-settings", () => ({
  useSettings: () => ({ data: mockSettings }),
  useUpdateSettings: () => ({ mutateAsync: mockMutateAsync }),
}));
jest.mock("../locale-storage", () => ({
  readLanguageState: jest.fn(),
  writeLanguageState: jest.fn(),
}));
jest.mock("../index", () => ({
  __esModule: true,
  default: {
    changeLanguage: jest.fn(async () => undefined),
    t: jest.fn((key: string) => key),
  },
}));
jest.mock("@/src/stores/toast-store", () => ({
  useToastStore: {
    getState: () => ({ show: mockShowToast }),
  },
}));
jest.mock("../document-language", () =>
  jest.requireActual("../document-language.web"),
);

const { syncDocumentLanguage: syncNativeDocumentLanguage } =
  jest.requireActual<typeof import("../document-language.native")>(
    "../document-language.native",
  );

type LocaleValue = ReturnType<typeof useLocale>;
let currentLocale: LocaleValue | null = null;

function preferences(language: LanguagePreference): UserPreferences {
  return {
    language,
    audio: { lossless: false, downloadQuality: "high" },
    notifications: { push: true, emailNewsletters: false },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function Probe() {
  currentLocale = useLocale();
  return (
    <Text testID="locale">
      {`${currentLocale.preference}:${currentLocale.resolvedLanguage}:${currentLocale.isSaving}`}
    </Text>
  );
}

async function renderProvider() {
  return await render(
    <LocaleProvider>
      <Probe />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMutateAsync.mockReset();
  mockUser = null;
  mockSettings = undefined;
  mockDeviceLanguageCode = "en";
  jest
    .mocked(getLocales)
    .mockImplementation(
      () =>
        [{ languageCode: mockDeviceLanguageCode }] as ReturnType<
          typeof getLocales
        >,
    );
  currentLocale = null;
  jest.mocked(readLanguageState).mockResolvedValue(null);
  jest.mocked(writeLanguageState).mockResolvedValue(undefined);
  mockMutateAsync.mockResolvedValue(undefined);
});

afterEach(() => {
  if (originalDocument) {
    Object.defineProperty(globalThis, "document", originalDocument);
  } else {
    Reflect.deleteProperty(globalThis, "document");
  }
  jest.restoreAllMocks();
});

test("keeps the web document language aligned with initial and live preferences", async () => {
  mockDeviceLanguageCode = "es-MX";
  installDocumentLanguage("en");

  await renderProvider();

  await waitFor(() => expect(document.documentElement.lang).toBe("es"));
  await act(async () => currentLocale!.setPreference("en"));
  await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  await act(async () => currentLocale!.setPreference("es"));
  await waitFor(() => expect(document.documentElement.lang).toBe("es"));
});

test("does not touch the document language on native", async () => {
  installDocumentLanguage("native-owner");

  syncNativeDocumentLanguage("es");

  expect(document.documentElement.lang).toBe("native-owner");
});

test("does not require a document during web static rendering", () => {
  Reflect.deleteProperty(globalThis, "document");

  expect(() => syncWebDocumentLanguage("es")).not.toThrow();
});

test("an unauthenticated user resolves system from the device", async () => {
  mockDeviceLanguageCode = "es-MX";

  const view = await renderProvider();

  expect(view.getByTestId("locale").props.children).toBe("system:es:false");
  expect(readLanguageState).not.toHaveBeenCalled();
});

test("applies a cached explicit preference before remote settings", async () => {
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");
  jest.mocked(readLanguageState).mockResolvedValue({
    preference: "es",
    pendingSync: false,
  });

  await renderProvider();

  await waitFor(() => {
    expect(jest.mocked(i18n.changeLanguage)).toHaveBeenCalledWith("en");
  });
  expect(jest.mocked(i18n.changeLanguage).mock.calls.map(([language]) => language)).toEqual([
    "es",
    "en",
  ]);
});

test("remote settings replace a clean cached preference", async () => {
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");
  jest.mocked(readLanguageState).mockResolvedValue({
    preference: "es",
    pendingSync: false,
  });

  const view = await renderProvider();

  await waitFor(() => {
    expect(view.getByTestId("locale").props.children).toBe("en:en:false");
  });
  expect(writeLanguageState).toHaveBeenCalledWith("user-1", {
    preference: "en",
    pendingSync: false,
  });
});

test("retains and retries a cached pending preference", async () => {
  const update = deferred<void>();
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");
  jest.mocked(readLanguageState).mockResolvedValue({
    preference: "es",
    pendingSync: true,
  });
  mockMutateAsync.mockReturnValue(update.promise);

  const view = await renderProvider();

  await waitFor(() =>
    expect(mockMutateAsync).toHaveBeenCalledWith({ language: "es" }),
  );
  expect(view.getByTestId("locale").props.children).toBe("es:es:true");

  await act(async () => {
    update.resolve();
    await update.promise;
  });
});

test("changes i18next before awaiting persistence", async () => {
  const localWrite = deferred<void>();
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");

  await renderProvider();
  await waitFor(() => expect(currentLocale).not.toBeNull());
  await waitFor(() => expect(currentLocale?.preference).toBe("en"));
  jest.clearAllMocks();
  jest.mocked(writeLanguageState).mockReturnValue(localWrite.promise);
  mockMutateAsync.mockResolvedValue(undefined);

  let save!: Promise<void>;
  await act(async () => {
    save = currentLocale!.setPreference("es");
    await Promise.resolve();
  });

  expect(currentLocale?.preference).toBe("es");
  expect(i18n.changeLanguage).toHaveBeenCalledWith("es");
  expect(writeLanguageState).toHaveBeenCalledWith("user-1", {
    preference: "es",
    pendingSync: true,
  });
  expect(mockMutateAsync).not.toHaveBeenCalled();

  await act(async () => {
    localWrite.resolve();
    await localWrite.promise;
  });
  await act(async () => save);
});

test("a local write failure keeps Spanish, continues remotely, and shows feedback", async () => {
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");

  await renderProvider();
  await waitFor(() => expect(currentLocale?.preference).toBe("en"));
  jest.clearAllMocks();
  jest.mocked(writeLanguageState)
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValue(undefined);
  mockMutateAsync.mockResolvedValue(undefined);

  await act(async () => currentLocale!.setPreference("es"));

  expect(currentLocale?.resolvedLanguage).toBe("es");
  expect(mockMutateAsync).toHaveBeenCalledWith({ language: "es" });
  expect(mockShowToast).toHaveBeenCalledWith(
    "error",
    "common.errors.generic",
    "common.errors.savePreference",
  );
});

test("a remote failure keeps Spanish pending and shows feedback", async () => {
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");

  await renderProvider();
  await waitFor(() => expect(currentLocale?.preference).toBe("en"));
  jest.clearAllMocks();
  jest.mocked(writeLanguageState).mockResolvedValue(undefined);
  mockMutateAsync.mockRejectedValue(new Error("offline"));

  await act(async () => currentLocale!.setPreference("es"));

  expect(currentLocale?.resolvedLanguage).toBe("es");
  expect(writeLanguageState).toHaveBeenCalledTimes(1);
  expect(writeLanguageState).toHaveBeenLastCalledWith("user-1", {
    preference: "es",
    pendingSync: true,
  });
  expect(mockShowToast).toHaveBeenCalledWith(
    "error",
    "common.errors.generic",
    "common.errors.savePreference",
  );
});

test("exposes a failed pending sync and retries it explicitly", async () => {
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");
  mockMutateAsync
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(undefined);

  await renderProvider();
  await waitFor(() => expect(currentLocale?.preference).toBe("en"));
  await act(async () => currentLocale!.setPreference("es"));

  expect(currentLocale?.saveError).toBe(true);
  expect(currentLocale?.isSaving).toBe(false);

  await act(async () => currentLocale!.retryPreference!());
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(currentLocale?.saveError).toBe(false));
  expect(writeLanguageState).toHaveBeenCalledWith("user-1", {
    preference: "es",
    pendingSync: false,
  });
});

test("retries a failed clean local persistence write explicitly", async () => {
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");
  jest.mocked(writeLanguageState)
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValueOnce(undefined);

  await renderProvider();
  await waitFor(() => expect(currentLocale?.saveError).toBe(true));
  expect(writeLanguageState).toHaveBeenCalledTimes(1);

  await act(async () => currentLocale!.retryPreference!());
  await waitFor(() => expect(writeLanguageState).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(currentLocale?.saveError).toBe(false));
});

test("retries a failed pending sync on foreground without concurrent duplicates", async () => {
  const retry = deferred<void>();
  let appStateListener: ((state: AppStateStatus) => void) | null = null;
  const removeListener = jest.fn();
  jest.spyOn(AppState, "addEventListener")
    .mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove: removeListener };
    });
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");
  jest.mocked(readLanguageState).mockResolvedValue({
    preference: "es",
    pendingSync: true,
  });
  mockMutateAsync
    .mockRejectedValueOnce(new Error("offline"))
    .mockReturnValueOnce(retry.promise);

  const view = await renderProvider();

  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
  await waitFor(() => {
    expect(view.getByTestId("locale").props.children).toBe("es:es:false");
  });
  expect(appStateListener).not.toBeNull();
  expect(writeLanguageState).not.toHaveBeenCalledWith("user-1", {
    preference: "es",
    pendingSync: false,
  });

  await act(async () => {
    appStateListener!("background");
    appStateListener!("active");
  });
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
  expect(view.getByTestId("locale").props.children).toBe("es:es:true");

  await act(async () => {
    appStateListener!("background");
    appStateListener!("active");
    await Promise.resolve();
  });
  expect(mockMutateAsync).toHaveBeenCalledTimes(2);

  await act(async () => {
    retry.resolve();
    await retry.promise;
  });
  await waitFor(() => {
    expect(writeLanguageState).toHaveBeenCalledWith("user-1", {
      preference: "es",
      pendingSync: false,
    });
    expect(view.getByTestId("locale").props.children).toBe("es:es:false");
  });
  expect(mockMutateAsync).toHaveBeenNthCalledWith(2, { language: "es" });

  await view.unmount();
  expect(removeListener).toHaveBeenCalledTimes(1);
});

test("a successful pending retry marks the cache clean", async () => {
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");
  const pending: StoredLanguageState = {
    preference: "es",
    pendingSync: true,
  };
  jest.mocked(readLanguageState).mockResolvedValue(pending);

  await renderProvider();

  await waitFor(() => {
    expect(writeLanguageState).toHaveBeenCalledWith("user-1", {
      preference: "es",
      pendingSync: false,
    });
  });
});

test("a user change cannot let an older retry replace the new user's pending preference", async () => {
  const firstUpdate = deferred<void>();
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");
  jest
    .mocked(readLanguageState)
    .mockResolvedValueOnce({ preference: "es", pendingSync: true })
    .mockResolvedValueOnce({ preference: "en", pendingSync: true });
  mockMutateAsync
    .mockReturnValueOnce(firstUpdate.promise)
    .mockResolvedValueOnce(undefined);

  const view = await renderProvider();
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));

  mockUser = { id: "user-2" };
  mockSettings = preferences("es");
  await view.rerender(
    <LocaleProvider>
      <Probe />
    </LocaleProvider>,
  );
  await waitFor(() => expect(currentLocale?.preference).toBe("en"));

  await act(async () => {
    firstUpdate.resolve();
    await firstUpdate.promise;
  });

  await waitFor(() => {
    expect(mockMutateAsync).toHaveBeenCalledWith({ language: "en" });
  });
  expect(currentLocale?.preference).toBe("en");
});

test("an older deferred clean write cannot replace a new user's completed retry", async () => {
  const oldCleanWrite = deferred<void>();
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");

  const view = await renderProvider();
  await waitFor(() => expect(currentLocale?.preference).toBe("en"));
  jest.clearAllMocks();
  jest.mocked(readLanguageState).mockResolvedValueOnce({
    preference: "en",
    pendingSync: true,
  });
  jest.mocked(writeLanguageState).mockImplementation(async (userId, state) => {
    if (userId === "user-1" && !state.pendingSync) {
      return oldCleanWrite.promise;
    }
  });

  let oldSave!: Promise<void>;
  await act(async () => {
    oldSave = currentLocale!.setPreference("es");
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(writeLanguageState).toHaveBeenCalledWith("user-1", {
      preference: "es",
      pendingSync: false,
    }),
  );

  mockUser = { id: "user-2" };
  mockSettings = preferences("es");
  await view.rerender(
    <LocaleProvider>
      <Probe />
    </LocaleProvider>,
  );
  expect(currentLocale?.preference).toBe("en");

  await act(async () => {
    oldCleanWrite.resolve();
    await oldSave;
  });

  await waitFor(() => {
    expect(writeLanguageState).toHaveBeenCalledWith("user-2", {
      preference: "en",
      pendingSync: false,
    });
  });
  expect(currentLocale?.preference).toBe("en");
});

test("overlapping selections persist the newest preference last", async () => {
  const firstPendingWrite = deferred<void>();
  let stored: StoredLanguageState | null = null;
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");

  await renderProvider();
  await waitFor(() => expect(currentLocale?.preference).toBe("en"));
  jest.clearAllMocks();
  jest.mocked(writeLanguageState).mockImplementation(async (_userId, state) => {
    if (state.preference === "es" && state.pendingSync) {
      await firstPendingWrite.promise;
    }
    stored = state;
  });

  let firstSave!: Promise<void>;
  let secondSave!: Promise<void>;
  await act(async () => {
    firstSave = currentLocale!.setPreference("es");
    await Promise.resolve();
  });
  await act(async () => {
    secondSave = currentLocale!.setPreference("en");
    await Promise.resolve();
  });

  expect(currentLocale?.preference).toBe("en");
  expect(writeLanguageState).toHaveBeenCalledTimes(1);

  await act(async () => {
    firstPendingWrite.resolve();
    await Promise.all([firstSave, secondSave]);
  });

  expect(stored).toEqual({ preference: "en", pendingSync: false });
  expect(mockMutateAsync).toHaveBeenLastCalledWith({ language: "en" });
  expect(currentLocale?.preference).toBe("en");
});

test("unmounted A persistence cannot toast, update state, or write B settings", async () => {
  const oldWrite = deferred<void>();
  mockUser = { id: "user-1" };
  mockSettings = preferences("en");
  const a = await renderProvider();
  await waitFor(() => expect(currentLocale?.preference).toBe("en"));
  jest.clearAllMocks();
  jest.mocked(writeLanguageState).mockImplementationOnce(() => oldWrite.promise);

  let oldSave!: Promise<void>;
  await act(async () => {
    oldSave = currentLocale!.setPreference("es");
    await Promise.resolve();
  });
  await a.unmount();

  mockUser = { id: "user-2" };
  mockSettings = preferences("en");
  await renderProvider();
  oldWrite.reject(new Error("old A failure"));
  await act(async () => {
    await oldSave;
  });

  expect(mockShowToast).not.toHaveBeenCalled();
  expect(mockMutateAsync).not.toHaveBeenCalledWith({ language: "es" });
  expect(currentLocale?.preference).toBe("en");
});

test.each(["resolve", "reject"] as const)(
  "a keyed direct A to B switch ignores a stale local-write %s",
  async (outcome) => {
    const oldWrite = deferred<void>();
    mockUser = { id: "user-1" };
    mockSettings = preferences("en");
    const view = await render(
      <LocaleProvider key="user-1">
        <Probe />
      </LocaleProvider>,
    );
    await waitFor(() => expect(currentLocale?.preference).toBe("en"));
    jest.clearAllMocks();
    jest.mocked(writeLanguageState).mockImplementation((userId, state) => {
      if (
        userId === "user-1" &&
        state.preference === "es" &&
        state.pendingSync
      ) {
        return oldWrite.promise;
      }
      return Promise.resolve();
    });

    let staleSave!: Promise<void>;
    await act(async () => {
      staleSave = currentLocale!.setPreference("es");
      await Promise.resolve();
    });

    mockUser = { id: "user-2" };
    mockSettings = preferences("en");
    await view.rerender(
      <LocaleProvider key="user-2">
        <Probe />
      </LocaleProvider>,
    );
    await waitFor(() => expect(currentLocale?.preference).toBe("en"));

    await act(async () => {
      if (outcome === "resolve") oldWrite.resolve();
      else oldWrite.reject(new Error("stale A write"));
      await staleSave;
    });

    expect(mockShowToast).not.toHaveBeenCalled();
    expect(mockMutateAsync).not.toHaveBeenCalledWith({ language: "es" });
    expect(writeLanguageState).not.toHaveBeenCalledWith("user-2", {
      preference: "es",
      pendingSync: expect.any(Boolean),
    });
    expect(currentLocale?.preference).toBe("en");
  },
);
