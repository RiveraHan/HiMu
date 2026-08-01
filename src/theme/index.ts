import { StyleSheet } from 'react-native-unistyles';
import { breakpoints } from './breakpoints';
import { appThemes } from './theme';


type AppBreakpoints = typeof breakpoints
type AppThemes = typeof appThemes

declare module 'react-native-unistyles' {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    export interface UnistylesThemes extends AppThemes {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
    settings: {
        initialTheme: 'dark',
    },
    breakpoints,
    themes: appThemes
})
