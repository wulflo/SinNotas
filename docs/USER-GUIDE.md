# Sin Notas User Guide

This guide explains how to use Sin Notas from start to finish: from your first
vault through FSRS review, decks, the productivity panel and the Android build.
It is written for people who use the app, not for people developing it. For the
architecture and internal details, see [SinNotas.md](SinNotas.md).

> Versión en español: [GUIA-DE-USO.md](GUIA-DE-USO.md).

## Contents

1. [What Sin Notas is](#what-sin-notas-is)
2. [Getting started](#getting-started)
3. [The main window](#the-main-window)
4. [The bullet editor](#the-bullet-editor)
5. [Organizing notes](#organizing-notes)
6. [PDF documents and bibliography](#pdf-documents-and-bibliography)
7. [Flashcards and review](#flashcards-and-review)
8. [Decks and note selection](#decks-and-note-selection)
9. [Productivity panel and Pomodoro](#productivity-panel-and-pomodoro)
10. [Settings](#settings)
11. [Sin Notas on Android](#sin-notas-on-android)
12. [Data, backups and sync](#data-backups-and-sync)
13. [Privacy and security](#privacy-and-security)
14. [Common problems](#common-problems)

## What Sin Notas is

Sin Notas is a local-first outliner: your notes are normal Markdown files inside
a folder you choose. On top of those files, the app adds bullet hierarchy, links
between notes, FSRS-7 review cards, a PDF reader, a bibliography, a Kanban
board and a graph of connections.

There is no account, no mandatory cloud and no proprietary database. You can open
the vault with any text editor, back it up with your favorite tool or sync it
with the service you prefer.

## Getting started

### Installing

- **Desktop:** download the installer for the latest release (Windows, Linux or
  macOS) from GitHub.
- **Android:** download the APK and open it with the device's file manager. Sin
  Notas does not install APKs by itself. If you already have a version signed
  with a different key, uninstall the previous one first.

### Choosing the vault

A vault is a folder with `.md` files. On first launch:

1. Press **Select a vault folder** (desktop) or **Choose folder** (Android).
2. Pick an empty folder to start from scratch, or an existing folder with your
   notes.
3. Sin Notas remembers the choice and opens it on later launches.

On Android the folder is chosen with the system picker (SAF). The app keeps the
read and write permission; if the permission is lost or the folder is moved, a
screen appears so you can choose it again.

### Creating your first note

- **Ctrl/Cmd + K** opens the quick search: type a title and press **Create note**
  to create the page.
- You can also use the **+** button in the sidebar or the context menu.
- The page title is editable and also defines the file name.

### Finding and opening notes

- The sidebar search shows pages whose title matches first and, below them,
  **In page content** with snippets of the notes' text.
- On wide screens the dropdown opens over the editor so snippets are not cut
  off; on narrow screens it uses the full available width.
- Results appear in batches of 10: **Show more pages** and **Show more results**
  append the next batch without clearing the previous ones.
- If a snippet is longer than four lines, **View full block** expands it inside
  the dropdown. Arrow keys and **Enter** still work, and **Esc** closes it.

New notes are saved automatically. Text changes are written to disk with a short
delay so typing is not blocked.

### Vault structure

```text
<your folder>/
├── *.md                        # your notes, plain Markdown
├── assets/                     # images and PDF captures
└── .sinnotas/
    ├── chronos/                # snapshots (version history)
    ├── progress/reviews.json   # review history
    └── documents/links.json    # linked PDFs
```

The `.sinnotas/` folder is internal: you can back it up, but you never need to
edit it by hand.

## The main window

### Sidebar

- Lists the vault pages and lets you create, search, rename and delete them.
- Shows up to **20 recent pages**; when there are no pinned or recent pages it
  shows a hint to open a page. For the full list, use the **All pages** icon in
  the navigation grid.
- A page's context menu is text-only: open, rename, copy `[[...]]` link,
  pin/unpin and delete. Pinned pages stay at the top and remain pinned after
  closing and reopening the app: they are stored as `pinned:: true` and
  `pinned-at::` in the `.md` file's frontmatter.
- **Ctrl/Cmd + B** collapses or expands it.
- On desktop you can drag its edge to change the width.
- The context menu of a note offers rename, delete, open history and other
  actions.

### Top bar

Shows the breadcrumb of the open note, the navigation history (back/forward), the
search bar, the compact Pomodoro timer and the Settings entry point. On Android it
adapts to the status bar and the system navigation bar.

### Views

- **Editor:** the main outliner.
- **Journals:** calendar and daily notes.
- **Flashcards:** review and card explorer.
- **Graph:** map of connections between notes.
- **Tasks:** Kanban board.
- **All pages:** full list with sorting and dates.
- **Bibliography:** source manager.
- **Documents:** PDF library and reader.

Each view keeps its state when you switch between them.

### Focus

The **Focus** button in the Flashcards view hides the header and the rest of
the distractions so you can review full screen. Press it again to exit. On
Android the full editor keeps the same behavior.

## The bullet editor

### Basic writing

- **Enter** splits the bullet at the cursor or creates the next one.
- **Shift + Enter** inserts a line break inside the same bullet.
- **Tab** and **Shift + Tab** indent and outdent.
- Hold the left mouse button on a bullet's handle and drag to move it together
  with its whole hierarchy; drop it on another bullet to place it before, after
  or inside it.
- Select several bullets by clicking and dragging, or with **Shift** and drag, to
  copy, cut, move or delete them as a block. Dragging the handle of a bullet that
  is already selected moves the whole group while keeping its order.

### Formatting

- Select text and use the format menu: bold, italic, underline, strikethrough,
  highlight, code and colors.
- **Ctrl/Cmd + B**, **I** and **U** apply bold, italic and underline.
- Links between notes are written as `[[Note title]]`.
- `#tag` labels appear as a pill using the accent color.

### Slash commands

Type `/` at the start of a bullet to open the command menu. From there you can
insert:

- H1–H6 headings,
- Markdown tables,
- images,
- tasks,
- basic cards (`#card`),
- Cloze gaps (`==text==`),
- queries and colors.

### Tables

Click a cell to select it: a toolbar with initial buttons (`+F`, `+C`, `↑F`, …)
appears (hover for the full description). Formatting (bold, italic, underline,
strike, code, cloze and clear formatting) applies **only to the selected cell**,
not to the whole table. You can add/remove rows and columns, reorder them by
dragging and use the cell's context menu. The top-left corner border uses the
same accent variant as the other cells; only the selected cell stands out.

Changes are saved to the Markdown source of the page.

### Images

- Paste an image from the clipboard or insert it from the menu.
- Images are stored in `assets/` and referenced from the note.
- Formats: PNG, JPG/JPEG, WebP, SVG, GIF and BMP.
- You can resize an image and open the occlusion editor from it.

### Searching inside a note

**Ctrl/Cmd + F** opens the note search bar. **Enter** and **Shift + Enter** move
through the matches; **Escape** closes the search. Floating buttons jump to the
start or the end of long notes.

### History and export

- **Version history** saves and restores page snapshots.
- **Export** downloads the current note as plain `.txt` text.

## Organizing notes

### Journals

The **Journals** view shows a calendar. Press a day to create or open its daily
note. Journals are normal notes: you can link them, tag them and turn them into
cards.

### All pages

Lists every note with its creation and modification dates. It allows sorting,
filtering and opening the history of each note.

### Graph and concept map

- The graph draws the connections created by wikilinks.
- Click a node to preview its content, drag it to move it and double-click to
  reset the view.
- The wheel zooms, and the right or middle button pans the canvas.
- From a note you can open the **concept map**, which turns its bullets into a
  navigable diagram.
- In the graph settings you can create color groups by title text and tune the
  simulation forces.

### Kanban

The **Tasks** view has pending, in progress and completed columns. Drag cards
between columns to change their state. You can hide completed cards and add tasks
to the daily note.

## PDF documents and bibliography

### Documents

- The library lists the PDFs in the vault and opens them with the native reader.
- You can link an external PDF without copying it, or import it into
  `assets/pdfs/`.
- Text is selectable: copy it or insert it as a bullet in the active note.
- Split mode shows the PDF and the note side by side; drag the divider to adjust
  the space and double-click to reset it.
- Drag a rectangle over a page to save a capture in `assets/pdf-captures/`,
  insert it into the note or open the occlusion editor.

### Bibliography

- Each resource uses `bib-*` properties in a note's frontmatter.
- The **Reviewing** status works for books, videos and any other resource type;
  it does not imply reading text.
- You can store local or validated remote cover images.
- Child notes are linked with sanitized wikilinks.
- The **Add resource** button searches by DOI, ISBN-10/13 or keywords.

## Flashcards and review

### Creating cards

A card is born from a bullet. There are three main ways:

1. **Basic with `#card`:** the bullet becomes a card. If it contains `::`, the
   left side is the question and the right side is the answer.
2. **Basic with a separator:** `Question? :: Answer` also creates a card, even
   without `#card`.
3. **Cloze:** text highlighted with `==...==` or the `{{c1::text}}` syntax is
   hidden and asked. Add `#card` so the bullet becomes a card.
4. **Image occlusion:** insert an image and draw rectangular, elliptical or
   polygonal areas to hide parts of it. Each area can have a hint.

You can also use the shortcuts **Alt + R** (create basic card) and
**Alt + T** (remove markers) with the cursor in a bullet or with
several bullets selected; when there is a selection, the highest-level bullet is
marked. Both shortcuts appear in the **Flashcards** group of the shortcuts
dialog. `#card` is not added to a bullet that already creates a card with `::`,
`==…==`, `{{…}}` or an occlusion: the notice distinguishes that case from an
empty bullet.

You can also select several bullets and use **Create basic card** or **Convert to
flashcard** from the context menu. To remove the markers without deleting the
content, use **Remove flashcard**.

### Card types

- **Basic:** question and answer.
- **Cloze:** one or more gaps inside a text.
- **Occlusion:** areas of an image that are revealed when you answer.

### FSRS-7

FSRS computes when each card should be seen again based on your history. Each
review stores:

- **Stability:** how long the memory lasts.
- **Difficulty:** how hard the card is for you.
- **Due date:** when it is time to review.
- **History:** last review, number of reviews and learning state.

New cards go through short learning steps (1 and 10 minutes by default) before
entering the review cycle. This avoids misleading initial intervals.

### Review session

1. Open **Flashcards**.
2. Press **Show answer** (or the space bar).
3. Grade it with **Again**, **Hard**, **Good** or **Easy**.
4. The card is rescheduled and the next one appears.

You can undo and redo the last review with the header buttons or the configured
shortcuts. The counter and the progress ring show how many cards are left in the
session.

During a session you can press **Edit card** (**Edit occlusion** for an image
card). Basic cards expose their question and answer; cloze cards open a mini
editor with the card's bullet and its child bullets, preserving indentation;
occlusion cards open the image editor. Saving keeps FSRS properties and leaves
the card in its place in the queue. Occlusion images fit the available card width
without stretching small images, and revealing the answer leaves no empty
separator.

### Review shortcuts

Keyboard shortcuts are configured in **Settings › Flashcards › Review**. By
default:

- **Space:** show answer.
- **1 / 2 / 3 / 4:** Again, Hard, Good, Easy.
- **Ctrl/Cmd + Z:** undo the last review.
- **Ctrl/Cmd + Y:** redo.

You can also use a gamepad from **Settings › Flashcards › Review › Gamepad**.

### Learning mode

Learning mode (in the mobile view and in the review header) includes cards that
are not due yet and does not save FSRS progress. It is useful for practice
without altering the schedule.

### Card explorer

The **Card Explorer** tab lists every card with search by question, answer or
note, sorting by next review, last review or creation date, and pagination.

### Statistics and progress

- **Activity:** oval year wheel of reviews: one ring per month and one arc per day, using the same five intensity levels. The current month is highlighted in the accent color; hovering an arc shows its date and review count.
- **Progress:** accumulated points and an atom visualization that advances
  through stages as you review.
- **Pomodoro:** tracked focus time.

You can erase review statistics from **Settings › Advanced › Maintenance**
without deleting the cards.

## Decks and note selection

### Hierarchical decks

Use `→` in a note title to create a hierarchy. For example:

```text
Mental health
Mental health → Anxiety
Mental health → Anxiety → Topic 1
```

In the note selector, checking a parent deck includes all of its child notes. The
search box does not change the selection, and the draft state is preserved while
you navigate between pages.

### Custom decks

- **Settings › Flashcards › General › My decks** lets you create, edit,
  duplicate the selection and delete decks.
- A deck stores an explicit list of notes; a note can belong to several decks.
- Only one deck is active at a time. Decks are stored in the vault and synced;
  the active deck is a per-device preference.
- The deck selector in the Flashcards header changes the active deck without
  opening Settings.

### Notes with cards

The deck creator tree only shows notes that have at least one card. If you create
a new card, the note appears automatically as soon as you open Settings ›
Flashcards; you do not need to restart the app. The selector refreshes its cache
by rescanning only the modified notes.

## Productivity panel and Pomodoro

On desktop, below the flashcard there is a horizontal panel with three blocks:

- **Pomodoro:** focus and break timer, with start, reset, short break and long
  break.
- **Activity:** review heatmap and focus minutes for the day.
- **Progress:** points and atom stage.

The **Productivity panel** switch, placed right below the card, shows or hides the
panel. The preference is stored on the device. In focus mode the panel remains
available and scrolls if it does not fit.

Pomodoro settings (durations, sessions before the long break, progressive
counter, sound and visibility in the top bar) are in **Settings › Flashcards ›
Pomodoro**.

## Settings

### Appearance

- **Page width:** a percentage of the available width (50–100%, 100% by
  default). It is not a fixed pixel value: Editor, Journals and All pages grow
  with the window; the control is relative to the interface width.
- **Interface language:** automatic, Spanish, English or Chinese.
- **Theme:** light or dark.
- **Visual style:** Aero, Simple or Dracula.
- **Interface color:** eleven accents.
- **Typography:** Sans, Serif, Mono, Dyslexic or an installed font.
- **Text size:** interface, editor, headings and cards separately.

### Flashcards

- **General:** active deck, deck creation and editing, deck notes.
- **Review:** card order, FSRS (retention, maximum interval, steps and
  parameters), due date recalculation, keyboard shortcuts and gamepad.
- **Pomodoro:** timer durations and behavior.

### Shortcuts

- Change the main shortcuts in this tab: click the combination next to an
  action and press the keys you want; it is saved immediately.
- If the combination is already used by another action (or reserved, such as
  Copy/Paste), it is rejected with a notice; the ↺ button restores the default.
- The **Keyboard shortcuts** dialog always shows the active combinations.
  Review rating keys are configured in **Flashcards › Review**.

### Saving

- Lists the notes with active snapshots.
- Shows how many versions they keep and lets you open the history.
- Backups live in `.sinnotas/chronos/` and expire according to the configured
  period.

### Advanced

At the top of this section there is a link to this guide.

- **Updates:** only contacts GitHub when you press the button. On desktop the
  package is verified with the updater signature. On Android this section is not
  shown: the APK is installed manually.
- **Review:** statistics (today's counts, totals and focus minutes), card FSRS
  properties (batch removal, all cards or a single one), centralized flashcard
  removal (with a paged picker of pages/decks and review history). None of these
  actions change the text of your notes.
- **Maintenance:** clear bullet properties, remove unused images, clear cache,
  erase review statistics, delete snapshots and reload the app.
- **Flashcards:** remove card markers across the whole vault without deleting the
  content.
- Every text in this section is translated to English and Chinese; choose the
  preference in **Appearance › Interface language**.

## Sin Notas on Android

The APK opens in the review experience: question, answer, occlusions, editing the
active block and FSRS grading. From there you can open the full editor to access
journals, Kanban, graph, PDFs and bibliography.

### Choosing and keeping the vault

- The first time, the system folder picker opens.
- Sin Notas keeps the permission between launches.
- **Change vault** opens the picker again.
- If the permission is lost, a screen appears so you can choose the folder again.

### Settings and switching modes

At the bottom of the card there is an always-visible **Settings** button, in
addition to the highlighted row in the side menu. From Settings you can:

- change theme, accent color, text size and language;
- open **Pages and editor** to switch to the full editor;
- change vault, update cards and reload the app.

To return to review mode from the full editor, use the **Back to review** button
in the desktop interface.

### Differences from desktop

- The updater is not shown on Android: updates are downloaded from GitHub and
  installed manually.
- The productivity panel (Pomodoro, activity and progress) is hidden in the
  Android full editor to leave room for notes.
- The status bar and navigation bar are respected through the safe-area bridge.

### Updating the APK

1. Download the new release from GitHub.
2. Open the APK with the file manager.
3. Accept the system installation.

Sin Notas does not download or install APKs by itself.

## Data, backups and sync

- Your notes are `.md` files. Copy the whole folder to back up the vault.
- The metadata cache (`.sinnotas_cache.bin`) speeds up startup; it can be cleared
  from **Settings › Advanced › Maintenance** and rebuilds itself.
- To sync between devices, use any file-syncing service. Avoid editing the same
  note on two devices at once.
- Decks, snapshots, review history and document links live in `.sinnotas/` inside
  the vault.
- Review history keeps at most 4,000 events, 5 MB and 365 days.

## Privacy and security

- Sin Notas sends no telemetry and creates no accounts.
- The network is only used when you request an update, a bibliography search or
  open an external link.
- Pasted content is sanitized: only safe formats survive.
- Card HTML is escaped and sanitized with DOMPurify before being displayed.
- File paths are validated against the active vault.
- See [PRIVACY_POLICY.md](../PRIVACY_POLICY.md) for the full policy.

## Common problems

**A new card does not appear in the deck creator.**
Open **Settings › Flashcards** after creating it. The list resyncs automatically
by rescanning only the modified notes. If it still does not appear, press **Sync
vault changes** (↻) in the Flashcards header.

**A note shows no cards.**
Check that the bullet has `#card`, a `::` separator, a `==...==` highlight or
Cloze syntax, and that the note is included in the active deck. Remember that an
empty deck means "no notes", not "all".

**The APK does not update from the app.**
This is intentional: the updater is hidden on Android. Download the APK from the
latest release and install it manually.

**I cannot see the productivity panel.**
On desktop, enable the **Productivity panel** switch below the card. In the
Android full editor it is hidden by design.

**The Android vault does not open.**
Choose the folder again from the startup screen or from **Settings › Change
vault** to renew the SAF permission.

**External changes do not appear.**
Sin Notas watches the vault and applies incremental changes. If a change is not
reflected, press **Reload app** in Settings.

---

Back to the [README](../README.md) · Technical guide: [SinNotas.md](SinNotas.md) ·
Spanish version: [GUIA-DE-USO.md](GUIA-DE-USO.md)
