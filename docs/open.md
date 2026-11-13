# Open files

```mermaid
flowchart TB
  A[Enter or o on a file] --> B{Open with}
  B --> C[Default app]
  B --> D[Editor in a tmux or herdr pane]
  B --> E[Any command]
  F[t] --> G[Shell in a new tmux or herdr pane]
  H[e or right-click] --> I[File manager, the file selected]
```

- Open files in their default app, an editor in a tmux or herdr pane, or any command, and `t` opens a shell in a folder in a new tmux or herdr pane (where Terminal target says)
- `e`, the right-click menu and the folder button in the preview header show a file in the file manager with the file selected: on Linux through the FileManager1 D-Bus service that Files, Dolphin, Nemo, Caja and Thunar answer, and without one the folder opens in the default app; Finder on macOS; Explorer on Windows. A folder shows selected in its parent

<img src="media/multiplexer.gif" alt="Enter opens hoard.ts in nvim in a tmux pane to the right of Claude" width="800">
