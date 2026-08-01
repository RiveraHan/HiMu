import { en, es } from "../resources";

function leafKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [path] : leafKeys(child, path);
  });
}

test("English and Spanish expose the same translation keys", () => {
  expect(leafKeys(es).sort()).toEqual(leafKeys(en).sort());
});

test("library recovery copy remains exactly bilingual", () => {
  expect(en.common.errors).toMatchObject({
    saveFailedTitle: "Couldn't save",
    saveRestoredMessage: "Your previous settings were restored.",
  });
  expect(es.common.errors).toMatchObject({
    saveFailedTitle: "No se pudo guardar",
    saveRestoredMessage: "Se restauraron tus ajustes anteriores.",
  });
  expect(en.profile.favorites).toMatchObject({
    unavailable: "Favorites are unavailable",
    discoverAction: "Discover music",
  });
  expect(es.profile.favorites).toMatchObject({
    unavailable: "Los favoritos no están disponibles",
    discoverAction: "Descubrir música",
  });
  expect(en.discover).toMatchObject({
    searchUnavailableTitle: "Search is unavailable",
    searchUnavailableMessage: "We couldn't update these results.",
    recommendationsUnavailable: "Recommendations are unavailable",
    shelfEmpty: "No tracks here yet",
  });
  expect(es.discover).toMatchObject({
    searchUnavailableTitle: "La búsqueda no está disponible",
    searchUnavailableMessage: "No pudimos actualizar estos resultados.",
    recommendationsUnavailable: "Las recomendaciones no están disponibles.",
    shelfEmpty: "Aún no hay canciones aquí",
  });
});
