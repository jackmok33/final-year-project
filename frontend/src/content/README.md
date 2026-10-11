# Interface content

Display text lives here, mirroring the file that owns it:

```text
components/auth/DemoSignIn.tsx
content/components/auth/DemoSignIn.content.ts

pages/ApplicationsPage.tsx
content/pages/ApplicationsPage.content.ts
```

Every page or component that owns copy reads its matching file through the same
typed hook:

```tsx
const content = useContent('demoSignIn')

<Typography>{content.signIn}</Typography>
<Button>{content.continue}</Button>
```

The registry in `index.ts` maps keys to content files. TypeScript checks both the
key and the fields and formatter arguments returned for that key. Register a new
file there when adding interface copy. There is no provider, asynchronous fetch
or separate hook per screen.

Store titles, descriptions, labels, help text, accessibility labels, empty-state
messages and confirmation copy here. Use named formatter functions for dynamic
sentences, passing values from the component rather than building sentence
fragments in JSX. `textValue` preserves React's handling of missing text values
when a formatter needs it. `branding.content.ts` shares the workspace name and
browser title; Vite injects the title into the HTML in development and production.

`domain/types.content.ts` holds the shared document, section, outcome and workflow
labels. Keep canonical outcome and status values in the domain models and use
labels for display, so changing copy does not change filtering or decisions.

Pages retain queries, temporary form state, validation and handlers. Content
files contain copy and presentation formatters, not admissions rules or service
calls. Applicant records, tutor notes, demo fixtures and service-returned messages
remain data. Components that only render supplied values (such as `SummaryCards`
and `FilePicker`) do not need an empty content file or an unused hook call.
