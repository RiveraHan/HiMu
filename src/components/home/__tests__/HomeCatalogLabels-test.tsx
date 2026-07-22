import { render } from "@testing-library/react-native";
import { View } from "react-native";
import i18n from "@/src/i18n";
import { OnAirHero } from "../OnAirHero";
import { VibeSpotlightCard } from "../VibeSpotlightCard";

test("presents raw Home hero and Vibe genres in Spanish without changing them", async () => {
  await i18n.changeLanguage("es");
  const canonical = {
    heroGenre: "Ambient",
    topGenre: "Ambient",
  };

  const screen = await render(
    <View>
      <OnAirHero
        djName="DJ One"
        avatarUrl={null}
        genre={canonical.heroGenre}
        headline="Dynamic headline"
        trackTitle="Dynamic track"
        isLive={false}
        onPlay={jest.fn()}
      />
      <VibeSpotlightCard
        hours="3"
        topGenre={canonical.topGenre}
        streak={2}
        onPress={jest.fn()}
      />
    </View>,
  );

  expect(screen.getByText("Ambiental")).toBeTruthy();
  expect(screen.getByText("Principalmente Ambiental · Racha de 2 días")).toBeTruthy();
  expect(canonical).toEqual({
    heroGenre: "Ambient",
    topGenre: "Ambient",
  });
});
