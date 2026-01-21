# Design Guidelines

This document outlines the design guidelines for the DR-YP application to ensure a consistent and cohesive user experience.

## Navigation Bar (Header)

The following guidelines should be followed for all navigation bars (headers) in the application.

### General Style

*   **BackgroundColor:** `#ffffff` (White)
*   **Height:** The default height provided by `expo-router`'s `Stack.Screen` is used.
*   **Shadow:** No shadow should be visible. Set `headerShadowVisible: false`.
*   **Bottom Border:** A 1px solid bottom border with the color `#e0e0e0` should be used. This can be achieved by setting `headerStyle: { borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }` or by adding a `borderBottomWidth` to the header style in the component.

### Title

*   **Font Family:** `Zaloga`
*   **Font Size:** `28`
*   **Color:** `#1a1a1a` (Almost Black)
*   **Alignment:** The title should be aligned to the left.

### Back Button

*   **Color:** The back button arrow color should be `#1a1a1a`. This can be set using `headerTintColor`.

### Example Implementation

When using a custom header in a component:

```jsx
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 28,
    color: '#1a1a1a',
    textAlign: 'left',
    fontFamily: 'Zaloga',
  },
});
```

When using `Stack.Screen` options:

```jsx
<Stack.Screen 
  name="screen-name" 
  options={{ 
    title: 'Screen Title',
    headerShown: true,
    headerStyle: {
      backgroundColor: '#ffffff',
    },
    headerTintColor: '#1a1a1a',
    headerTitleStyle: {
      fontFamily: 'Zaloga',
      fontSize: 28,
    },
    headerShadowVisible: false,
  }} 
/>
```
