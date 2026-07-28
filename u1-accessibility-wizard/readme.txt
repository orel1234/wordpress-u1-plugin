U1 Accessibility Wizard (WordPress Plugin)
========================================

Install:
- Upload the ZIP in WP Admin → Plugins → Add New → Upload Plugin
- Activate “U1 Accessibility Wizard”

Use Wizard:
- Open any frontend page while logged in as admin
- Click “U1 Wizard” in the WP top admin bar OR add ?u1wizard=1 to the URL
- Steps:
  1) INIT: Set U1 JS/CSS URLs + focus colors
  2) COMPONENTS: Select component type → Add mapping → Pick selectors by clicking elements
  3) SKIP LINKS: For each preset, pick a target element + optional text
  4) APPLY: Save & apply immediately on the current page

Storage:
- Saved in wp_options → u1_accessibility_config
