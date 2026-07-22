import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import type { UserPreferences } from "@/src/types/preferences";
import type { LanguagePreference } from "../types";
import i18n from "../index";
import {
  readLanguageState,
  writeLanguageState,
  type StoredLanguageState,
} from "../locale-storage";
import { LocaleProvider } from "../LocaleProvider";
import { useLocale } from "../use-locale";

let mockUser: { id: string } | null = null;
let mockSettings: UserPreferences | undefined;
let mockDeviceLanguageCode = "en";
const mockMutateAsync = jest.fn<Promise<void>, [UserPreferences]>();
const mockShowToast = jest.fn();

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: mockDeviceLanguageCode }],
}));
jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => mockUser,
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
  mockUser = null;
  mockSettings = undefined;
  mockDeviceLanguageCode = "en";
  currentLocale = null;
  jest.mocked(readLanguageState).mockResolvedValue(null);
  jest.mocked(writeLanguageState).mockResolvedValue(undefined);
  mockMutateAsync.mockResolvedValue(undefined);
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

  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(preferences("es")));
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
  jest.mocked(writeLanguageState).mockReturnValue(localWrite.promise);

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
  expect(mockMutateAsync).toHaveBeenCalledWith(preferences("es"));
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
    expect(mockMutateAsync).toHaveBeenCalledWith(preferences("en"));
  });
  expect(currentLocale?.preference).toBe("en");
});
