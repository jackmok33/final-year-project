# Supplied Mantis interface

The interface uses source from the supervisor-supplied **Mantis React Next
TypeScript 4.0.1** template at
`/Users/jack_1/Downloads/mantis-react-next-ts-4.0.1`. Mantis is template source,
not a replacement npm component package. The app remains React/Vite with its
existing router, Redux state, domain rules and browser storage.

`source-manifest.json` records the original paths and SHA-256 hashes for the
62 imported source/asset mappings. Most come from `seed/src`; the statistics card and form action bar come
from `full-version/src`. The source retains its original licensing. `layoutPatterns` separately records the supplied form and
table examples adapted directly in feature components; these are source patterns,
not additional standalone Mantis packages.

## Where the source is used

| Workspace UI                                                                                      | Supplied Mantis source                                                            |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Header and sidebar shell                                                                          | `layout/AppBarStyled`, `MiniDrawerStyled`, `DrawerHeaderStyled`                   |
| Tutor course/admin navigation                                                                     | Expanded vertical presentation from `NavItem`, with controlled React Router links |
| Sidebar scrolling                                                                                 | `components/SimpleBarScroll`, adapted from the template's SimpleBar wrapper       |
| Shared panels, courses, intakes, outcome choices, upload panels and log cards                     | `components/MainCard`                                                             |
| Sign-in                                                                                           | `components/AuthCard` and the supplied `AuthLogin` form pattern                   |
| Dashboard statistics                                                                              | `components/AnalyticEcommerce`, with neutral title/count/hint props               |
| Account avatar and navigation button                                                              | Extended `Avatar` and `IconButton`                                                |
| Decision, correction, password and sign-in help popups                                            | Controlled `CustomizedDialog` adaptation from the supplied dialog example         |
| Form action bars                                                                                  | `components/FormActions`, adapted from the supplied action-bar layout             |
| Route and inline loading                                                                          | `Loader` and `CircularWithPath`                                                   |
| Fields, buttons, tables, menus, statuses, alerts, dialogs, radios, switches and expandable panels | The 38 factories in `theme/overrides/`                                            |
| Fonts, colours and shadows                                                                        | Mantis typography, default light palette and custom-shadow factories              |
| Visible action/navigation icons                                                                   | The template's Ant Design icon family                                             |

Mantis itself uses MUI buttons, fields, layout primitives and tables. These
continue to be imported from `@mui/material` and receive the actual Mantis theme
overrides; avoid adding wrappers that only rename MUI imports. Admissions copy
and application-specific content remain in the existing controlled components.
The PDF canvas, file validation and evidence navigation retain their functionality.

## Compatibility adaptations

- Replace Next.js links/menu hooks in the navigation item with props and React
  Router. The workspace owns permissions, selected course/intake, sign-out and
  drawer state. Shared shell dimensions are in `config.ts`.
- Keep the default light theme and local Public Sans fonts. Workspace action,
  status and secondary-text colours retain accessible contrast. Hover/focus
  input borders use the main colour rather than a pale status background.
- Port removed MUI 7 style slots and combined colour classes to MUI 9 variants,
  `ownerState` callbacks and supported colour selectors. This preserves coloured
  status labels and severity-only alerts.
- Keep typed per-icon imports such as `@ant-design/icons/ArrowRightOutlined`.
  The Vite/Vitest alias resolves their ESM implementations: the supplied version's
  generated root wrappers otherwise resolve to nested default objects in a
  production browser build. Do not remove the alias or add runtime default-unwrapping.
- Use SimpleBar on all supported browsers without the template's user-agent or
  device-detection dependencies. Its scroll area grows between the logo and
  end of the navigation region. Programme/intake labels wrap; account actions are in the header avatar menu.
- Preserve accessible card headings, forwarded refs, caller `sx` arrays and
  isolated rendering with MUI's default theme. Decorative icons are hidden from
  the accessibility tree. Circular loading announces one progress indicator.
- Keep captions supplied by pages; remove sales/trend text from the statistics
  card. File inputs, controls, the prototype account chooser and loading remain functional.
- Use Mantis accordions for section details and accessible PDF text. Criteria-weight bars use Mantis-styled `LinearProgress`; numeric
  inputs provide their accessible values without duplicate labels.

Template source is excluded from application coverage totals. Colocated companion
tests cover component contracts, navigation, utility functions, control handlers,
severity/colour compatibility, keyboard focus and progress announcements. The
full browser suite checks real layout, scrolling and all application workflows.
jsdom's unsupported pseudo-element style probe is adapted in the test setup for
SimpleBar; browser rendering remains the layout verification boundary.

## Screen layouts

Forms follow `full-version/src/views/forms/layouts/multi-column.tsx`: a static
`InputLabel` above each MUI field, with a one-unit gap. Labels use stable React
IDs, select controls reference their label explicitly, and mapped criteria fields
have independent IDs. Validation, required state, helper text and handlers remain
with the feature. The shared `FormActions` uses the separated, right-aligned
`CardActions` pattern from `views/forms/layouts/action-bar.tsx`.

Application, batch and account lists follow `views/tables/mui-table/basic.tsx`:
`MainCard content={false}`, a full-width table, and padded first/last cells.
Application filters and list notices have their own padded areas outside the
rows. Feature-specific columns, counts and links stay in their existing files;
there is no generic table engine or sample sales/customer data.

These are the template's own MUI compositions. Do not add a wrapper merely to
make a MUI import look like a Mantis import. Continue reusing the imported shell,
navigation, statistic cards and control overrides for dashboard screens.

## Shared customized dialog

`components/CustomizedDialog` extracts the supplied
`full-version/src/sections/components-overview/dialogs/CustomizedDialog.tsx`
dialog styling, title spacing and Mantis close control. It is a controlled
adaptation of that example, not an unchanged standalone component supplied by the
template. Demo state, placeholder text and unused footer styling are omitted.
DecisionPage, CorrectionPage, Layout's password form and LoginPage help use the
same implementation; labels, content and open/close state stay with their callers.

The adaptation retains MUI focus restoration and adds unique accessible title IDs
and a busy guard for close, Escape and backdrop dismissal. The close control stays
outside the title so it cannot become part of the dialog's accessible name.
These application compatibility changes are documented rather than passed off as
original template behavior. The manifest records the original source hash.

## Revised Figma implementation (23 October 2026)

The user's full-resolution `UCL Application Review Workspace — Frontend Review.png`
is the layout reference. Figma MCP metadata located the `final` page (`50:27395`),
but design-context calls reached the account's Starter-plan quota. Implementation
therefore used the supplied PNG and local template source; no exact component IDs
or token bindings from that final page could be retrieved.

The imported/adapted `TabsCard` follows `sections/components-overview/tabs/BasicTabs`;
`TablePagination` follows `components/third-party/react-table/TablePagination` with
controlled callbacks instead of requiring TanStack Table. `SingleFileUpload` uses
the supplied dropzone/placeholder composition, `react-dropzone` and the actual
Mantis upload SVG. The hidden file input is outside its clickable drop area to
avoid nesting interactive controls. Tab, Tabs, Pagination and PaginationItem
factories extend the existing Mantis theme for MUI 9.

Feature tables remain the supplied MUI-table composition with product-specific
columns. Analytics uses the Mantis list composition and progress styling. Selected
decision choices combine MainCard with Mantis-styled radios. Form/layout primitives
such as Box, Stack and Typography are MUI primitives used by Mantis itself.

Admissions queries, permissions, stored records, CSV/PDF operations, prototype
sign-in matching and evidence fixtures remain custom product code. Imported
components do not implement application assessment or authentication. The source
manifest separates imported mappings from adapted feature-layout references,
with original source hashes checked against the supplied folder.
