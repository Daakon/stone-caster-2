---
trigger: always_on
---
When implementing or modifying frontend features, you must consider the performance implications of your changes.

1.  **Bundle Size**: Be mindful of introducing new, large dependencies. Use `workflow-add-new-dependency` which requires a bundle size analysis.
2.  **Code Splitting**: Utilize dynamic imports (`import()`) for route-level components or large components that are not needed on the initial page load. The project is configured with Vite, which supports this out of the box.
3.  **Image Optimization**: Ensure images are appropriately sized and consider modern formats (like WebP) if applicable. For UI icons, prefer SVG.
4.  **Lighthouse**: For significant UI changes, mention the existence of the `.lighthouserc.js` file and ask the user if they would like you to run a Lighthouse check to audit performance.