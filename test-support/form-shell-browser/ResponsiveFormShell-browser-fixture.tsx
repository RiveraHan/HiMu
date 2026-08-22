import "../../src/theme";

import { useLayoutEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { Pressable, Text, TextInput, View } from "react-native";

import { GlassCard } from "../../src/components/GlassCard";
import { Avatar } from "../../src/components/Avatar";
import { EqualizerBars } from "../../src/components/EqualizerBars";
import { HimuImage } from "../../src/components/media/HimuImage";
import { ScreenCanvas } from "../../src/components/ScreenCanvas";
import { ResponsiveFormShell } from "../../src/components/forms/ResponsiveFormShell";
import { StyleSheet } from "../../src/theme/react-native-unistyles";

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
  const forwardedImageFrame = imageProbeStyles.frame(73, 53);

  useLayoutEffect(() => {
    const inspectProductionShell = () => {
      const scroll = queryTestElement("responsive-form-scroll-view");
      const scrollContent = scroll.firstElementChild as HTMLElement | null;
      const shell = queryTestElement("responsive-form-shell");
      const longForm = queryTestElement("browser-long-form");
      const longReview = queryTestElement("browser-long-review");
      const footer = queryTestElement("responsive-form-footer");
      const action = queryTestElement("browser-final-action");
      const directStyleProbe = queryTestElement("browser-direct-style-probe");
      const glassStyleProbe = queryTestElement("browser-glass-style-probe");
      const canvasStyleProbe = queryTestElement("browser-canvas-style-probe");
      const avatarStyleProbe = queryTestElement("browser-avatar-style-probe");
      const imageStyleProbe = queryTestElement("browser-image-style-probe");
      const imageNativeProbe = queryTestElement("himu-image-native");
      const equalizerProbe = queryTestElement("browser-equalizer-style-probe");
      const equalizerBar = Array.from(equalizerProbe.querySelectorAll<HTMLElement>("*")).find(
        (node) => node.childElementCount === 0,
      );

      if (!equalizerBar) {
        throw new Error("The production EqualizerBars has no rendered bar");
      }

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
      const directStyleProbeCss = getComputedStyle(directStyleProbe);
      const glassStyleProbeCss = getComputedStyle(glassStyleProbe);
      const canvasStyleProbeCss = getComputedStyle(canvasStyleProbe);
      const avatarStyleProbeCss = getComputedStyle(avatarStyleProbe);
      const imageStyleProbeCss = getComputedStyle(imageStyleProbe);
      const imageNativeProbeCss = getComputedStyle(imageNativeProbe);
      const equalizerBarCss = getComputedStyle(equalizerBar);
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
        compositeStyleForwarding: {
          direct: {
            height: directStyleProbeCss.height,
            minHeight: directStyleProbeCss.minHeight,
            padding: directStyleProbeCss.padding,
            gap: directStyleProbeCss.gap,
          },
          glass: {
            height: glassStyleProbeCss.height,
            minHeight: glassStyleProbeCss.minHeight,
            padding: glassStyleProbeCss.padding,
            gap: glassStyleProbeCss.gap,
          },
          canvas: {
            height: canvasStyleProbeCss.height,
            minHeight: canvasStyleProbeCss.minHeight,
            padding: canvasStyleProbeCss.padding,
            gap: canvasStyleProbeCss.gap,
          },
          avatar: {
            width: avatarStyleProbeCss.width,
            height: avatarStyleProbeCss.height,
            borderRadius: avatarStyleProbeCss.borderRadius,
          },
          image: {
            width: imageStyleProbeCss.width,
            height: imageStyleProbeCss.height,
            borderRadius: imageStyleProbeCss.borderRadius,
          },
          imageNative: {
            width: imageNativeProbeCss.width,
            height: imageNativeProbeCss.height,
            position: imageNativeProbeCss.position,
          },
          equalizerBar: {
            width: equalizerBarCss.width,
            height: equalizerBarCss.height,
            borderRadius: equalizerBarCss.borderRadius,
          },
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
    <>
      <View style={styles.probeContainer}>
        <View testID="browser-direct-style-probe" style={directProbeStyles.frame} />
        <GlassCard testID="browser-glass-style-probe" style={glassProbeStyles.frame}>
          <Text>Glass style probe</Text>
        </GlassCard>
        <ScreenCanvas testID="browser-canvas-style-probe" style={canvasProbeStyles.frame} />
        <Avatar testID="browser-avatar-style-probe" fallback="Listener" size="lg" />
        <HimuImage
          testID="browser-image-style-probe"
          source="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
          fallback={<Text>Image fallback</Text>}
          style={[imageProbeStyles.decoration, forwardedImageFrame]}
        />
        <View testID="browser-equalizer-style-probe">
          <EqualizerBars bars={1} height={14} />
        </View>
      </View>
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
    </>
  );
}

const styles = StyleSheet.create({
  probeContainer: {
    position: "absolute",
    left: -10000,
    top: 0,
    width: 320,
  },
});

const directProbeStyles = StyleSheet.create({
  frame: {
    height: 61,
    minHeight: 61,
    padding: 11,
    gap: 7,
  },
});

const glassProbeStyles = StyleSheet.create({
  frame: {
    height: 62,
    minHeight: 62,
    padding: 12,
    gap: 8,
  },
});

const canvasProbeStyles = StyleSheet.create({
  frame: {
    height: 64,
    minHeight: 64,
    padding: 16,
    gap: 12,
  },
});

const imageProbeStyles = StyleSheet.create({
  frame: (width: number, height: number) => ({
    width,
    height,
  }),
  decoration: { borderRadius: 17 },
});

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("Missing browser fixture root");
}

createRoot(rootElement).render(<BrowserFixture />);
