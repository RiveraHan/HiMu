import { StyleSheet } from 'react-native-unistyles';
import { breakpoints } from './breakpoints';
import { appThemes } from './theme';


type AppBreakpoints = typeof breakpoints
type AppThemes = typeof appThemes

declare module 'react-native-unistyles' {
    export interface UnistylesThemes extends AppThemes {}
    export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
    settings: {
        initialTheme: 'dark',
    },
    breakpoints,
    themes: appThemes
})
