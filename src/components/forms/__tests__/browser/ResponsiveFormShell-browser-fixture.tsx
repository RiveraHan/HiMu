import "../../../../theme";

import { useLayoutEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { Pressable, Text, TextInput, View } from "react-native";

import { ResponsiveFormShell } from "../../ResponsiveFormShell";

const viewport = { width: 720, height: 422 } as const;

const steps = [
  { id: "details", label: "Details" },
  { id: "identity", label: "Identity" },
  { id: "review", label: "Review" },
] as const;

function queryTestElement(testID: string) {
  const element = document.querySelector<HTMLElement>(`[data-testid="${testID}"]`);

  if (!element) {
    throw new Error(`Missing production element: ${testID}`);
  }

  return element;
}

function LongForm() {
  return (
    <View testID="browser-long-form" style={{ gap: 12 }}>
      {Array.from({ length: 16 }, (_, index) => (
        <View key={index} style={{ gap: 4 }}>
          <Text>{`Profile field ${index + 1}`}</Text>
          <TextInput
            accessibilityLabel={`Profile field ${index + 1}`}
            defaultValue={`Value ${index + 1}`}
            style={{ borderWidth: 1, height: 44, paddingHorizontal: 8 }}
          />
        </View>
      ))}
    </View>
  );
}

function LongReview() {
  return (
    <View testID="browser-long-review" style={{ gap: 8 }}>
      {Array.from({ length: 12 }, (_, index) => (
        <Text key={index}>{`Review item ${index + 1}: confirmed`}</Text>
      ))}
    </View>
  );
}

function BrowserFixture() {
  useLayoutEffect(() => {
    const inspectProductionShell = () => {
      const scroll = queryTestElement("responsive-form-scroll-view");
      const scrollContent = scroll.firstElementChild as HTMLElement | null;
      const shell = queryTestElement("responsive-form-shell");
      const longForm = queryTestElement("browser-long-form");
      const longReview = queryTestElement("browser-long-review");
      const footer = queryTestElement("responsive-form-footer");
      const action = queryTestElement("browser-final-action");

      if (!scrollContent) {
        throw new Error("The production ScrollView has no content container");
      }

      const scrollStyle = getComputedStyle(scroll);
      const scrollContentStyle = getComputedStyle(scrollContent);
      const scrollRect = scroll.getBoundingClientRect();
      const actionRectBeforeScroll = action.getBoundingClientRect();
      const beforeScroll = {
        scrollTop: scroll.scrollTop,
        actionBelowViewport: actionRectBeforeScroll.top >= scrollRect.bottom,
      };

      scroll.scrollTo({
        top: scroll.scrollHeight,
        left: 0,
        behavior: "instant",
      });
      action.focus();

      const actionRectAfterScroll = action.getBoundingClientRect();
      const result = {
        viewport: {
          ...viewport,
          scrollRenderedWidth: scrollRect.width,
          scrollRenderedHeight: scrollRect.height,
        },
        productionScrollCss: {
          overflowX: scrollStyle.overflowX,
          overflowY: scrollStyle.overflowY,
          flexGrow: scrollStyle.flexGrow,
          flexShrink: scrollStyle.flexShrink,
          flexBasis: scrollStyle.flexBasis,
          contentFlexGrow: scrollContentStyle.flexGrow,
        },
        productionTree: {
          shellInScroll: scroll.contains(shell),
          longFormInScroll: scroll.contains(longForm),
          longReviewInScroll: scroll.contains(longReview),
          footerInScroll: scroll.contains(footer),
          actionInFooter: footer.contains(action),
        },
        beforeScroll,
        afterScroll: {
          scrollTop: scroll.scrollTop,
          actionVisible:
            actionRectAfterScroll.top >= scrollRect.top &&
            actionRectAfterScroll.bottom <= scrollRect.bottom,
          actionFocused: document.activeElement === action,
          actionTabIndex: action.tabIndex,
        },
      };

      const resultElement = document.querySelector("#browser-test-result");
      if (!resultElement) {
        throw new Error("Missing browser test result element");
      }
      resultElement.textContent = JSON.stringify(result);
    };

    inspectProductionShell();
  }, []);

  return (
    <ResponsiveFormShell
      title="Create your DJ"
      description="Complete every field and review before publishing."
      steps={steps}
      activeStep="identity"
      form={<LongForm />}
      review={<LongReview />}
      footer={
        <Pressable
          testID="browser-final-action"
          accessibilityRole="button"
          accessibilityLabel="Create DJ"
          onPress={() => undefined}
          style={{ height: 48, justifyContent: "center" }}
        >
          <Text>Create DJ</Text>
        </Pressable>
      }
    />
  );
}

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("Missing browser fixture root");
}

createRoot(rootElement).render(<BrowserFixture />);
