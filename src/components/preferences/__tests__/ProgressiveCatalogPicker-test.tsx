import { fireEvent, render } from "@testing-library/react-native";

import {
  ProgressiveCatalogPicker,
  nextCatalogSelection,
} from "../ProgressiveCatalogPicker";
import { CatalogPickerSurface as NativeCatalogPickerSurface } from "../CatalogPickerSurface.native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const groups = [
  { label: "electronic", items: ["Ambient", "House"] },
  { label: "global", items: ["Cumbia"] },
] as const;

describe("ProgressiveCatalogPicker", () => {
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
    expect(screen.getByRole("checkbox", { name: "Ambiente" })).toBeTruthy();
    expect(screen.getByText("Selected: Ambiente")).toBeTruthy();
  });

  it("allows legacy over-limit selections to be removed but rejects new additions", () => {
    expect(nextCatalogSelection(["Ambient", "House"], "Ambient", 1)).toEqual({
      next: ["House"],
      rejected: false,
    });
    expect(nextCatalogSelection(["Ambient", "House"], "Cumbia", 1)).toEqual({
      next: ["Ambient", "House"],
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
});
