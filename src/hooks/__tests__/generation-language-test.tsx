import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { LocaleContext, type LocaleContextValue } from "@/src/i18n/use-locale";
import { supabase } from "@/src/api/supabase";
import { useCurrentUser } from "../use-auth";
import { useDJs } from "../use-home";
import { useDailyDrop } from "../use-daily-drop";
import { useGenerateMix } from "../use-generate-mix";

jest.mock("@/src/api/supabase", () => ({
  supabase: { from: jest.fn(), functions: { invoke: jest.fn() } },
}));
jest.mock("../use-auth", () => ({ useCurrentUser: jest.fn() }));
jest.mock("../use-home", () => ({
  toPlayerTrack: jest.fn((track) => track),
  useDJs: jest.fn(),
}));

const localeValue = (resolvedLanguage: "en" | "es"): LocaleContextValue => ({
  preference: resolvedLanguage,
  resolvedLanguage,
  setPreference: jest.fn(),
  isSaving: false,
});

function queryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

function wrapper(language: () => "en" | "es", client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>
        <LocaleContext.Provider value={localeValue(language())}>
          {children}
        </LocaleContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe("generation language", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { jobId: "job-1" },
      error: null,
    } as never);
  });

  it("sends the Spanish effective language when starting a mix", async () => {
    const invoke = jest.mocked(supabase.functions.invoke);
    const { result } = await renderHook(() => useGenerateMix(), {
      wrapper: wrapper(() => "es", queryClient()),
    });

    await act(async () => {
      result.current.generate({
        djId: "dj-1",
        title: "DJ One",
        lyrics: "[Verso 1]\nSigo aquí",
      });
    });

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("generate-mix", {
        body: expect.objectContaining({
          djId: "dj-1",
          language: "es",
          lyrics: "[Verso 1]\nSigo aquí",
        }),
      }),
    );
  });

  it("sends the English effective language for the daily drop only once per mount", async () => {
    let language: "en" | "es" = "en";
    const invoke = jest.mocked(supabase.functions.invoke);
    jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
    jest.mocked(useDJs).mockReturnValue({
      data: [
        {
          id: "dj-1",
          owner_id: null,
          name: "DJ One",
          avatar_url: null,
          genre_specialties: ["Ambient"],
        },
      ],
    } as never);

    const { rerender } = await renderHook(() => useDailyDrop(), {
      wrapper: wrapper(() => language, queryClient()),
    });

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("generate-mix", {
        body: expect.objectContaining({
          djId: "dj-1",
          dropDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          language: "en",
        }),
      }),
    );

    language = "es";
    rerender({});

    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
