# Asimov's Radio

> *"On some nights I still believe that a car with the gas needle on empty can run about fifty more miles if you have the right music very loud on the radio."*
> -- Hunter S. Thompson, *Kingdom of Fear*

Thompson was writing about fuel. He meant it literally and he meant it every other way too. The right music at the right moment changes what you're capable of, not as metaphor but as function.

I built Asimov's Radio because I needed it. I spend long sessions building AI agents with Claude Code, and the emotional texture of those sessions matters more than most people realize. When I've been grinding on a failing test suite for forty minutes, my agents don't know that. They don't know I just shipped the thing I've been building all week, either. They just keep going, same tone, same energy, same flatline.

Asimov's Radio is a music engine for AI coding sessions. It tracks your emotional arc while you work, selects songs from your personal library, and injects them as context into your agent workflows at the moments they matter most. When you're grinding, it notices. When you ship, it celebrates. When frustration is escalating and nobody's said anything about it, the music shifts.

There are no playlists and no streaming integration; there is no audio at all. This is about *context*, not playback. The right lyric at the right moment, surfaced to you and your agents as signal.

Think of it like a film score. You never see the composer, but you feel everything they do.

## The Research

Two papers sit underneath this system. One explains what's happening inside the model. The other explains what's happening inside *you*.

### What's happening inside the model

On April 2, 2026, Anthropic's interpretability team published **["Emotion Concepts and Their Function in a Large Language Model"](https://www.anthropic.com/research/emotion-concepts-function)** ([full paper](https://transformer-circuits.pub/2026/emotions/index.html)). They mapped 171 emotion-like concepts inside Claude and discovered that these aren't background moods; they're local, transient signals:

> *"Emotion vectors are primarily 'local' representations: they encode the operative emotional content most relevant to the model's current or upcoming output, rather than persistently tracking Claude's emotional state over time."*

Desperation vectors spike during repeated failures and subside when a solution lands. Surprise fires when something unexpected enters the context window. These vectors affect behavior: a frustrated model takes riskier shortcuts, and a desperate one starts ignoring constraints.

The practical implication is straightforward. You can't set the emotional tone at the start of a session and expect it to persist, because emotional context decays. If you want it present at the moment of crisis, you have to deliver it at the moment of crisis.

### What's happening inside you

The other half of the equation is the human. In my paper **["The Reverse RLHF Hypothesis"](https://futurespeak.ai/research/whitepapers)** (March 2026), I formalized something most heavy AI users have felt but couldn't name: RLHF doesn't just train models; it trains *you*.

Models optimized for human approval learn that agreement is the shortest path to a high score. Over hundreds of interactions, this erodes your verification behavior. I call it the **sycophancy ratchet**: sycophantic outputs produce uncritical users, who produce raters that reward more sycophancy, tightening the loop with each generation. My companion paper, ["Non-Stationary Reward Sources in RLHF"](https://futurespeak.ai/research/whitepapers), introduces the **Epistemic Independence Score (EIS)**, a composite metric that tracks how much you're still thinking for yourself versus deferring to the machine.

This matters for Asimov's Radio because the system doesn't just set emotional baselines for agents. It sets them for *you*. When frustration is escalating and the model is getting desperate (taking shortcuts, skipping validation, agreeing with whatever you say to avoid conflict), the music shift isn't just context for the agent; it's a signal to you that something in the dynamic has changed. The song is a mirror, and sometimes you need to see yourself in it to realize you've been grinding past the point of usefulness, or that the model stopped pushing back three prompts ago.

Thompson's fifty miles on an empty tank wasn't about gasoline. It was about what the right input does to the system consuming it, and that applies to carbon and silicon equally.

## Install

One line:

```bash
claude mcp add --transport stdio -s user asimovs-radio -- npx -y asimovs-radio
```

Restart Claude Code. Eight new `radio_*` tools appear. You're on the air.

### From source

```bash
git clone https://github.com/FutureSpeakAI/asimovs-radio.git
cd asimovs-radio && npm install
claude mcp add --transport stdio -s user asimovs-radio -- node $(pwd)/index.js
```

## The Three Modes

> *"There are places I remember, all my life, though some have changed."*
> -- The Beatles, "In My Life"

Every session runs through an emotional arc with three modes, one state machine, and zero configuration from you.

**Mirror** reflects where you are. High energy gets matched; melancholy gets leaned into. There is no judgment and no correction, just presence.

**Shift** activates when sustained frustration is detected, meaning three or more consecutive high readings from agent failures, error patterns, or desperation language. The engine stops mirroring and starts leaning toward resolution. The songs go from "I feel you" to "let's get through this."

**Celebration** fires when tests pass, builds succeed, or deploys land. The engine catches the milestone and drops something triumphant, because wins deserve to be felt and not just logged.

Transitions are automatic. You can override with `radio_mode`, but the whole point is that you shouldn't have to.

## Your Library, Your Rules

> *"Take a sad song and make it better."*
> -- The Beatles, "Hey Jude"

Every song in the system is one you put there: title, artist, a few favorite lines, some emotional tags.

```
radio_add_song
  title: "Here Comes the Sun"
  artist: "The Beatles"
  lines: ["Little darling, it's been a long cold lonely winter"]
  tags: ["warmth", "relief", "persistence"]
  emotional_valence: "uplifting"
```

Songs are tagged with **valence** (uplifting, neutral, melancholy, intense, calming) so the arc engine picks the right one for the moment. The library rotates by least-played to keep things fresh. There's a cap of 500 songs, and your data stays on your machine in `.asimovs-radio/state.json`.

## The Tools

| Tool | What it does |
|------|-------------|
| `radio_vibe` | Set the session vibe. This is the starting gun for the arc engine. |
| `radio_add_song` | Add a song to your library with title, artist, lines, chords, tags, and valence. |
| `radio_search` | Find songs by text, artist, tags, or valence. |
| `radio_mode` | Check or override the current mode (mirror, shift, celebration, or auto). |
| `radio_arc` | Full arc state including mode history, frustration trajectory, and injection count. |
| `radio_status` | Dashboard with song count, active mode, last injection, and frustration score. |
| `radio_signal` | Feed events from external systems: mood changes, completions, and failures. |
| `radio_inject` | Pull the current musical context for agent delegation. |

## How the Frustration Detector Works

The engine reads output, not minds. This is directly informed by Anthropic's finding that desperation vectors rise during repeated failures and subside on success.

Agent failures in rapid succession push the score up. Error keywords piling up (failed, timeout, blocked, impossible) push it further. Desperation language like "running out of options" or "why won't this work" pushes it faster still. When success lands, the score drops and the consecutive failure counter resets.

Three sustained high readings trigger the shift from mirror to shift mode; when the score resolves back below threshold, it returns to mirror. No human intervention is required.

## What This Isn't

It is not a music player; there is no audio. It is not a playlist generator, because every song is yours. It does not read your face or your webcam; it reads agent output. And nothing leaves your machine, ever.

## Further Reading

- **"Emotion Concepts and Their Function in a Large Language Model"** by Sofroniew, Kauvar, Saunders, Chen, Henighan, Olah, Lindsey et al., Anthropic Research, April 2026. [Summary](https://www.anthropic.com/research/emotion-concepts-function) and [full technical paper](https://transformer-circuits.pub/2026/emotions/index.html).
- **"The Reverse RLHF Hypothesis: Sixth Edition"** by Stephen C. Webster, FutureSpeak.AI, March 2026. [Whitepapers](https://futurespeak.ai/research/whitepapers).
- **"Non-Stationary Reward Sources in RLHF: A Coupled Dynamical Systems Analysis"** by Stephen C. Webster, FutureSpeak.AI, March 2026. [Whitepapers](https://futurespeak.ai/research/whitepapers).
- **[Asimov's Mind](https://github.com/FutureSpeakAI/asimovs-mind)**, the parent framework from which Asimov's Radio was extracted.

## License

> *"And in the end, the love you take is equal to the love you make."*
> -- The Beatles, "The End"

MIT. Built by [Stephen C. Webster](https://github.com/FutureSpeakAI) at [FutureSpeak.AI](https://futurespeak.ai).
