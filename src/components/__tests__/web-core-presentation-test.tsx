import { render } from "@testing-library/react-native";

import {
  WEB_CORE_PRESENTATION_REGISTRY_KEY,
  registerWebCorePresentation,
  useWebCorePresentation,
} from "@/src/components/web-core-presentation";

const registryHost = globalThis as typeof globalThis & Record<string, unknown>;

function PresentationProbe() {
  useWebCorePresentation("himu-web-core-presentation/app-shell");
  return null;
}

describe("web core presentation registration", () => {
  beforeEach(() => {
    delete registryHost[WEB_CORE_PRESENTATION_REGISTRY_KEY];
  });

  afterEach(() => {
    delete registryHost[WEB_CORE_PRESENTATION_REGISTRY_KEY];
  });

  it("records a mounted core presentation through the production registration effect", async () => {
    await render(<PresentationProbe />);

    expect(registryHost[WEB_CORE_PRESENTATION_REGISTRY_KEY]).toEqual([
      "himu-web-core-presentation/app-shell",
    ]);
  });

  it("keeps the global presentation evidence bounded and duplicate-free", () => {
    registerWebCorePresentation("himu-web-core-presentation/app-shell");
    registerWebCorePresentation("himu-web-core-presentation/app-shell");
    registerWebCorePresentation("not-a-core-presentation" as never);

    for (let index = 0; index < 40; index += 1) {
      registerWebCorePresentation(
        `himu-web-core-presentation/fixture-${index}` as never,
      );
    }

    const markers = registryHost[WEB_CORE_PRESENTATION_REGISTRY_KEY] as string[];
    expect(markers).toHaveLength(32);
    expect(markers[0]).toBe("himu-web-core-presentation/fixture-8");
    expect(markers[31]).toBe("himu-web-core-presentation/fixture-39");
  });
});
