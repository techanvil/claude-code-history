# claude-code-history

A Claude Code mod that adds a `/history` command for browsing your past prompts and reusing them.

`/history` opens a pane beside the chat that lists the prompts you've sent, newest first, read from `~/.claude/history.jsonl`. Pick one and it goes back into the prompt box for you to edit or send.

## Features

- **Search as you type.** The search box is focused when the pane opens. `/history <search>` opens it already filtered.
- **This project or all projects.** Press the scope button (or `s` once focus is off the search box) to switch between the current folder's prompts and every project's.
- **Grouped by project.** In the all-projects view, a header names the project wherever it changes. Each project gets the shortest name that tells it apart from the others, so several checkouts of one repository are shown by the folder that differs (for example `sitekit-instawp-xyz` rather than `google-site-kit`).
- **One line per prompt**, with how long ago it was sent (`5m`, `3h`, `12d`). Repeats of the same prompt in a project are collapsed into one row.

## Keys

| Key | Does |
| --- | --- |
| Type | Filter the list |
| Enter in the search box | Put the first match in the prompt box |
| ↓ / ↑ | Move between the search box and the list |
| PgUp / PgDn | Page the list (once a row has the keyboard) |
| Enter on a row | Put that prompt in the prompt box and close the pane |
| `s` | Switch between this project and all projects (once focus is off the search box) |
| Esc | Close the pane |

## Install

At the prompt of a Claude Code terminal session, run:

```
/plugin install history --marketplace techanvil/claude-code-history
```

Answer `y` to add the marketplace, then pick a scope. Requires Claude Code 2.1.275 or later.

### From a local clone

To run the mod from a folder you're working on, point Claude Code at it in the `env` block of `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/claude-code-history"
  }
}
```

Start a new session, or for a single session run `claude --plugin-dir /path/to/claude-code-history`. Interactive sessions watch the folder, so saving a file reloads the mod.

## Settings

The pane asks for 60% of the terminal's width when it's docked beside a fullscreen transcript. Change `WIDTH` at the top of `hooks/register.tsx` to adjust it. A width you set yourself by dragging the dock's edge takes priority, and Claude Code caps how wide the dock can go.

## Limits

- The history file is read each time `/history` runs, so prompts sent while the pane is open appear the next time you open it.
- At most the newest 200 matches are listed.
- Page keys don't work while the search box has the keyboard. Press ↓ to move into the list first.
- The mobile app has no text field, so there `/history <search>` is the only filter.

## Development

```sh
claude plugin validate .   # check the manifest and hooks module
claude plugin test .       # run tests/*.test.tsx
npx tsc -p .               # type-check (after Claude Code has loaded the mod once)
```

Claude Code writes the API types to `.claude-plugin/types/` each time it loads the mod. That folder is ignored by git.

## License

MIT. See [LICENSE](LICENSE).
