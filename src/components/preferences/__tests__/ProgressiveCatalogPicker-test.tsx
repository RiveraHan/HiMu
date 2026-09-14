import { act, fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";

import i18n from "@/src/i18n";

import {
  ProgressiveCatalogPicker,
  nextCatalogSelection,
  resolveCatalogPickerSurface,
} from "../ProgressiveCatalogPicker";
import {
  CatalogPickerSurface as NativeCatalogPickerSurface,
  catalogPickerKeyboardBehavior,
} from "../CatalogPickerSurface.native";
import {
  CatalogPickerSurface as WebCatalogPickerSurface,
} from "../CatalogPickerSurface.web";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const groups = [
  { label: "electronic", items: ["Ambient", "House"] },
  { label: "global", items: ["Cumbia"] },
] as const;

describe("ProgressiveCatalogPicker", () => {
  beforeEach(async () => {
    await act(async () => i18n.changeLanguage("en"));
  });

  it("keeps a maxed selection unchanged and announces the limit", async () => {
    const onChange = jest.fn();
    const screen = await render(
      <ProgressiveCatalogPicker
        title="Genres"
        groups={groups}
        selected={["Ambient"]}
        min={1}
        max={1}
        getGroupLabel={(value) => value}
        getItemLabel={(value) => value}
        onChange={onChange}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Edit Genres" }));
    expect(screen.getByRole("checkbox", { name: "Ambient" }).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByRole("checkbox", { name: "House" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Choose up to 1")).toBeTruthy();
  });

  it("announces a rejected offline change without changing checkbox semantics", async () => {
    const screen = await render(
      <ProgressiveCatalogPicker
        title="Genres"
        groups={groups}
        selected={[]}
        min={0}
        max={3}
        getGroupLabel={(value) => value}
        getItemLabel={(value) => value}
        chooseLabel="Choose Genres"
        onChange={() => ({ accepted: false, reason: "offline" })}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Choose Genres" }));
    const house = screen.getByRole("checkbox", { name: "House" });
    await fireEvent.press(house);

    expect(house.props.accessibilityState.checked).toBe(false);
    expect(screen.getByTestId("catalog-picker-status")).toHaveTextContent(
      "Selection not changed. Reconnect to update your preferences.",
    );
    expect(screen.queryByText("Selected House. 1 of 3 selected.")).toBeNull();
  });

  it.each([
    {
      locale: "en",
      choose: "Choose genres",
      edit: "Edit genres",
      empty: "No preference: we'll explore different genres.",
    },
    {
      locale: "es",
      choose: "Elegir géneros",
      edit: "Editar géneros",
      empty: "Sin preferencia: exploraremos distintos géneros.",
    },
  ])("uses caller-localized empty and selected controls in $locale", async ({ locale, choose, edit, empty }) => {
    await act(async () => i18n.changeLanguage(locale));
    const props = {
      title: locale === "es" ? "Géneros favoritos" : "Favorite genres",
      groups,
      min: 0,
      max: 3,
      getGroupLabel: (value: string) => value,
      getItemLabel: (value: string) => value,
      onChange: jest.fn(),
      chooseLabel: choose,
      editLabel: edit,
      emptyDescription: empty,
    };
    const emptyScreen = await render(
      <ProgressiveCatalogPicker {...props} selected={[]} />,
    );

    expect(emptyScreen.getByRole("button", { name: choose })).toBeTruthy();
    expect(emptyScreen.getByText(empty)).toBeTruthy();
    await emptyScreen.unmount();

    const selectedScreen = await render(
      <ProgressiveCatalogPicker {...props} selected={["Ambient"]} />,
    );
    expect(selectedScreen.getByRole("button", { name: edit })).toBeTruthy();
    expect(selectedScreen.queryByText(empty)).toBeNull();
  });

  it("keeps the final required selection when a user removes it from the checked option", async () => {
    function RequiredSelectionHarness() {
      const [selected, setSelected] = useState<string[]>(["Ambient"]);
      return (
        <ProgressiveCatalogPicker
          title="Genres"
          groups={groups}
          selected={selected}
          min={1}
          max={3}
          getGroupLabel={(value) => value}
          getItemLabel={(value) => value}
          onChange={setSelected}
        />
      );
    }

    const screen = await render(<RequiredSelectionHarness />);
    await fireEvent.press(screen.getByRole("button", { name: "Edit Genres" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Ambient" }));

    expect(screen.getByRole("checkbox", { name: "Ambient" }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByText("Choose at least 1")).toBeTruthy();
  });

  it("expands one group at a time, filters localized labels, and keeps the selected tray canonical", async () => {
    const screen = await render(
      <ProgressiveCatalogPicker
        title="Genres"
        groups={groups}
        selected={["Ambient"]}
        min={0}
        max={3}
        getGroupLabel={(value) => ({ electronic: "Electrónica", global: "Global" })[value] ?? value}
        getItemLabel={(value) => ({ Ambient: "Ambiente", House: "House", Cumbia: "Cumbia" })[value] ?? value}
        onChange={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Edit Genres" }));
    expect(screen.getAllByText("Ambiente")).toHaveLength(2);
    await fireEvent.press(screen.getByRole("button", { name: "Global" }));
    expect(screen.queryByText("House")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Cumbia" })).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Search Genres"), "ambiente");
    expect(screen.queryByRole("checkbox", { name: "Ambiente" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Electrónica" }));
    expect(screen.getByRole("checkbox", { name: "Ambiente" })).toBeTruthy();
    expect(screen.getByText("Selected: Ambiente")).toBeTruthy();
  });

  it("keeps search results within the one selected expanded group and permits collapse", async () => {
    const screen = await render(
      <ProgressiveCatalogPicker
        title="Genres"
        groups={groups}
        selected={[]}
        min={0}
        max={3}
        getGroupLabel={(value) => value}
        getItemLabel={(value) => value}
        onChange={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Edit Genres" }));
    await fireEvent.changeText(screen.getByPlaceholderText("Search Genres"), "a");
    expect(screen.getByRole("checkbox", { name: "Ambient" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Cumbia" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "global" }));
    expect(screen.getByRole("checkbox", { name: "Cumbia" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Ambient" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "global" }));
    expect(screen.queryByRole("checkbox", { name: "Cumbia" })).toBeNull();
  });

  it("allows legacy over-limit selections to be removed but rejects new additions and below-min removals", () => {
    expect(nextCatalogSelection(["Ambient", "House"], "Ambient", 1, 1)).toEqual({
      next: ["House"],
      rejected: false,
    });
    expect(nextCatalogSelection(["Ambient", "House"], "Cumbia", 1, 1)).toEqual({
      next: ["Ambient", "House"],
      rejected: true,
    });
    expect(nextCatalogSelection(["House"], "House", 1, 3)).toEqual({
      next: ["House"],
      rejected: true,
    });
  });

  it("lets native Back close the sheet before anything else", async () => {
    const onRequestClose = jest.fn();
    const screen = await render(
      <NativeCatalogPickerSurface
        visible
        title="Genres"
        groups={groups}
        selected={[]}
        min={0}
        max={3}
        query=""
        expandedGroup="electronic"
        getGroupLabel={(value) => value}
        getItemLabel={(value) => value}
        onChange={jest.fn()}
        onQueryChange={jest.fn()}
        onExpandedGroupChange={jest.fn()}
        onToggle={jest.fn()}
        onDone={jest.fn()}
        onRequestClose={onRequestClose}
      />,
    );

    await screen.getByTestId("catalog-picker-modal").props.onRequestClose();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it("uses the platform-specific surface and Android keyboard avoidance", () => {
    expect(resolveCatalogPickerSurface("web")).toBe(WebCatalogPickerSurface);
    expect(resolveCatalogPickerSurface("ios")).toBe(NativeCatalogPickerSurface);
    expect(catalogPickerKeyboardBehavior("android")).toBe("height");
    expect(catalogPickerKeyboardBehavior("ios")).toBe("padding");
  });

  it.each([
    {
      locale: "en",
      title: "Genres",
      edit: "Edit Genres",
      selected: "Selected: Ambient",
      done: "Done",
      search: "Search Genres",
      minimum: "Choose at least 1",
      maximum: "Choose up to 3",
      added: "Selected House. 2 of 3 selected.",
    },
    {
      locale: "es",
      title: "Géneros",
      edit: "Editar Géneros",
      selected: "Selección: Ambient",
      done: "Listo",
      search: "Buscar Géneros",
      minimum: "Elige al menos 1",
      maximum: "Elige hasta 3",
      added: "Seleccionaste House. Selecciones: 2 de 3.",
    },
  ])("localizes picker controls and polite selection status in $locale", async ({ locale, title, edit, selected, done, search, minimum, maximum, added }) => {
    await act(async () => i18n.changeLanguage(locale));

    const localizedGroups = [
      groups[0],
      { label: "global", items: ["Cumbia", "Salsa"] },
    ] as const;

    function LocalizedHarness() {
      const [values, setValues] = useState<string[]>(["Ambient"]);
      return (
        <ProgressiveCatalogPicker
          title={title}
          groups={localizedGroups}
          selected={values}
          min={1}
          max={3}
          getGroupLabel={(value) => value}
          getItemLabel={(value) => value}
          onChange={setValues}
        />
      );
    }

    const screen = await render(<LocalizedHarness />);
    expect(screen.getByText(selected)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: edit }));
    expect(screen.getByRole("button", { name: done })).toBeTruthy();
    expect(screen.getByPlaceholderText(search)).toBeTruthy();

    await fireEvent.press(screen.getByRole("checkbox", { name: "House" }));
    const status = screen.getByTestId("catalog-picker-status");
    expect(status.props.accessibilityLiveRegion).toBe("polite");
    expect(status).toHaveTextContent(added);

    await fireEvent.press(screen.getByRole("checkbox", { name: "House" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Ambient" }));
    expect(status).toHaveTextContent(minimum);

    await fireEvent.press(screen.getByRole("checkbox", { name: "House" }));
    await fireEvent.press(screen.getByRole("button", { name: "global" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Cumbia" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Salsa" }));
    expect(status).toHaveTextContent(maximum);
  });
});
