// Type declarations for CSS imports (web-only builds).
// Allows TypeScript to resolve `.css` side-effect imports and
// `.module.css` CSS Modules imports used by React Native Web components.

declare module '*.css';

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
