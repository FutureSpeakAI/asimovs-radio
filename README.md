# Asimov's Radio

Emotional arc orchestration through music. A standalone MCP server that tracks session mood, frustration, and milestones to inject contextually appropriate musical references into AI agent workflows.

## Install

One command:

```bash
claude mcp add --transport stdio -s user asimovs-radio -- npx -y asimovs-radio
```

That's it. Restart Claude Code and the 8 `radio_*` tools are available.

## Install from source

```bash
git clone https://github.com/FutureSpeakAI/asimovs-radio.git
cd asimovs-radio && npm install
claude mcp add --transport stdio -s user asimovs-radio -- node $(pwd)/index.js
```

## Tools

| Tool | Description |
|------|-------------|
| `radio_vibe` | Set the session's emotional baseline |
| `radio_add_song` | Add a song to your personal library |
| `radio_search` | Search songs by text, artist, tags, or valence |
| `radio_mode` | View or override the arc mode (mirror/shift/celebration) |
| `radio_arc` | Get the full session emotional arc state |
| `radio_status` | System status dashboard |
| `radio_signal` | Feed mood changes, agent completions, and failures into the arc engine |
| `radio_inject` | Get the current musical context injection for agent delegation |

## How it works

You set a vibe at the start of a session. The arc engine enters **mirror mode**, reflecting your emotional state through song selections from your personal library. As you work:

- **Mirror**: Matches your current energy. Songs align with the mood.
- **Shift**: When sustained frustration is detected (3+ consecutive high readings), the engine shifts toward resolution, selecting songs that lean forward.
- **Celebration**: When milestones are hit (tests pass, deploys succeed), the engine reinforces the win.

The operator never configures modes. They experience music appearing at the right moments. The machinery is architectural.

Songs are tagged with emotional valence (uplifting, neutral, melancholy, intense, calming) and rotated by least-played to keep the library fresh.

## What it doesn't do

- No streaming, no playback, no audio processing
- No lyric generation or fetching (you supply all content)
- No external API calls
- No data leaves your machine

Your library is stored in `.asimovs-radio/state.json` in the project root.

## License

MIT. Extracted from [Asimov's Mind](https://github.com/FutureSpeakAI/asimovs-mind) by [FutureSpeak.AI](https://github.com/FutureSpeakAI).
