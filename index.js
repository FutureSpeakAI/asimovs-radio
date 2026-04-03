#!/usr/bin/env node
/**
 * Asimov's Radio -- Standalone MCP Server
 *
 * Emotional arc orchestration through music. 6 MCP tools for session-aware
 * musical context injection into AI agent workflows.
 *
 * Tools:
 *   radio_vibe       -- Set session emotional baseline
 *   radio_add_song   -- Add a song to the operator's library
 *   radio_search     -- Search songs by text/valence
 *   radio_mode       -- View or override current arc mode
 *   radio_arc        -- Get full session emotional arc
 *   radio_status     -- System status dashboard
 *
 * Extracted from Asimov's Mind (github.com/FutureSpeakAI/asimovs-mind).
 * Runs independently as a Claude Code MCP server.
 */

import path from 'node:path';
import { EventEmitter } from 'node:events';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { JsonFileState } from './lib/state.js';
import { SongStore } from './lib/song-store.js';
import { EmotionalArcTracker } from './lib/arc-tracker.js';
import { FrustrationDetector } from './lib/frustration-detector.js';
import { InjectionComposer } from './lib/injection-composer.js';

// --- Configuration ---

const PROJECT_ROOT = process.env.CLAUDE_PROJECT_ROOT || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const DATA_DIR = path.join(PROJECT_ROOT, '.asimovs-radio');

const VIBE_VALUES = ['energized', 'focused', 'melancholy', 'chill', 'angry', 'joyful'];
const VALENCE_VALUES = ['uplifting', 'neutral', 'melancholy', 'intense', 'calming'];

// --- Core instances ---

const state = new JsonFileState(DATA_DIR);
const eventBus = new EventEmitter();
const songStore = new SongStore();
const arcTracker = new EmotionalArcTracker();
const frustrationDetector = new FrustrationDetector();
const injectionComposer = new InjectionComposer();

let active = false;
let lastInjection = null;

// --- Public API (for integration with other MCP servers) ---

function getActiveInjection() {
  if (!active || !arcTracker.isActive) return null;

  const mode = arcTracker.currentMode;
  const valence = arcTracker.currentValence;
  const song = songStore.selectForMode(mode, valence);
  if (!song) return null;

  const injection = injectionComposer.compose({
    mode,
    song,
    trigger: arcTracker.getArcState().escalationTrajectory,
    arcPosition: getArcPosition(),
  });

  if (injection) {
    songStore.incrementPlayCount(song.id);
    arcTracker.recordInjection();
    lastInjection = injection;
  }

  return injection;
}

function onMoodChange(data) {
  if (!active) return;
  const mood = data?.mood || data?.data?.mood;
  const energy = data?.energyLevel ?? data?.data?.energyLevel ?? 0.5;
  if (mood) {
    arcTracker.updateMood(mood, energy);
    frustrationDetector.recordMoodChange({ mood, energyLevel: energy });
    arcTracker.updateFrustration(frustrationDetector.score);
  }
}

function onAgentCompleted(data) {
  if (!active) return;
  const completionData = data?.data || data;
  const success = completionData?.success !== false;

  frustrationDetector.recordAgentCompletion({
    success,
    output: completionData?.summary || completionData?.description || '',
    error: completionData?.error || '',
  });

  arcTracker.updateFrustration(frustrationDetector.score);
  arcTracker.checkMilestone(completionData);
}

function onAgentFailed(data) {
  if (!active) return;
  frustrationDetector.recordAgentCompletion({
    success: false,
    output: '',
    error: data?.data?.error || data?.error || '',
  });
  arcTracker.updateFrustration(frustrationDetector.score);
}

function getArcPosition() {
  const arc = arcTracker.getArcState();
  const trajectory = arc.escalationTrajectory;
  if (trajectory === 'rising') return 'early';
  if (trajectory === 'sustained') return 'sustained';
  if (trajectory === 'de-escalating') return 'resolving';
  if (trajectory === 'resolved') return 'resolved';
  return 'developing';
}

function vibeToValence(vibe) {
  const map = {
    energized: 'uplifting', focused: 'neutral', melancholy: 'melancholy',
    chill: 'calming', angry: 'intense', joyful: 'uplifting',
  };
  return map[vibe] || 'neutral';
}

// --- MCP Server ---

const server = new McpServer({
  name: 'asimovs-radio',
  version: '1.0.0',
});

// -- radio_vibe --
server.tool(
  'radio_vibe',
  'Set the session\'s musical vibe baseline. This establishes the emotional starting point for the arc.',
  {
    vibe: z.enum(VIBE_VALUES).describe('Current emotional vibe'),
    song: z.object({
      title: z.string().max(200),
      artist: z.string().max(200),
      link: z.string().max(500).optional(),
      tags: z.array(z.string().max(50)).max(10).optional(),
    }).optional().describe('Optional song to associate with this vibe'),
  },
  async ({ vibe, song }) => {
    arcTracker.setSessionVibe(vibe, song?.tags);
    active = true;

    if (song) {
      songStore.add({
        title: song.title,
        artist: song.artist,
        link: song.link,
        tags: [...(song.tags || []), vibe],
        emotional_valence: vibeToValence(vibe),
      });
    }

    eventBus.emit('baseline-set', { vibe, songCount: songStore.size, timestamp: Date.now() });

    return { content: [{ type: 'text', text: JSON.stringify({
      vibeSet: vibe,
      mode: 'mirror',
      songCount: songStore.size,
      message: `Asimov's Radio activated. Starting in mirror mode, building from ${vibe} energy.`,
    }, null, 2) }] };
  }
);

// -- radio_add_song --
server.tool(
  'radio_add_song',
  'Add a song to the operator\'s personal music library.',
  {
    title: z.string().max(200).describe('Song title'),
    artist: z.string().max(200).describe('Artist or band name'),
    link: z.string().max(500).optional().describe('URL where the operator listens (Spotify, YouTube, etc.)'),
    lines: z.array(z.string().max(500)).max(20).optional().describe('Favorite lines from the song (operator-supplied)'),
    chords: z.string().max(2000).optional().describe('Chord progression'),
    tags: z.array(z.string().max(50)).max(20).optional().describe('Emotional tags (e.g. energy, calm, defiance, grit, joy)'),
    emotional_valence: z.enum(VALENCE_VALUES).optional().describe('Overall emotional character'),
  },
  async ({ title, artist, link, lines, chords, tags, emotional_valence }) => {
    const song = songStore.add({ title, artist, link, lines, chords, tags, emotional_valence });
    if (!song) {
      return { content: [{ type: 'text', text: JSON.stringify({ added: false, reason: 'Title and artist are required' }) }] };
    }

    if (active && tags?.length) {
      const dominantVibe = tags[0];
      if (VIBE_VALUES.includes(dominantVibe)) {
        arcTracker.recalibrate(dominantVibe);
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify({
      added: true,
      song: { id: song.id, title: song.title, artist: song.artist, tags: song.tags },
      librarySize: songStore.size,
    }, null, 2) }] };
  }
);

// -- radio_search --
server.tool(
  'radio_search',
  'Search the operator\'s music library.',
  {
    query: z.string().max(500).optional().describe('Text to search for in titles, artists, tags'),
    valence: z.enum(VALENCE_VALUES).optional().describe('Filter by emotional valence'),
    limit: z.number().int().min(1).max(50).default(5).describe('Max results'),
  },
  async ({ query, valence, limit }) => {
    const results = songStore.search(query, valence, limit);
    return { content: [{ type: 'text', text: JSON.stringify({
      count: results.length,
      results: results.map(s => ({
        id: s.id, title: s.title, artist: s.artist,
        tags: s.tags, valence: s.emotional_valence,
        link: s.link, playCount: s.playCount,
      })),
    }, null, 2) }] };
  }
);

// -- radio_mode --
server.tool(
  'radio_mode',
  'View or override the current arc mode. Modes: mirror (reflect state), shift (lean toward resolution), celebration (milestone reinforcement), auto (let the system decide).',
  {
    action: z.enum(['get', 'force_mirror', 'force_shift', 'force_celebration', 'auto'])
      .default('get').describe('Action to perform'),
  },
  async ({ action }) => {
    if (action === 'get') {
      return { content: [{ type: 'text', text: JSON.stringify({
        currentMode: arcTracker.currentMode || 'inactive',
        currentValence: arcTracker.currentValence,
        active,
      }, null, 2) }] };
    }

    const modeMap = {
      force_mirror: 'mirror', force_shift: 'shift', force_celebration: 'celebration', auto: 'auto',
    };
    const newMode = arcTracker.forceMode(modeMap[action]);
    return { content: [{ type: 'text', text: JSON.stringify({
      mode: newMode,
      forced: action !== 'auto',
    }, null, 2) }] };
  }
);

// -- radio_arc --
server.tool(
  'radio_arc',
  'Get the full session emotional arc: mode history, current mode, injection count, frustration level, trajectory.',
  {},
  async () => {
    const arc = arcTracker.getArcState();
    const frustration = frustrationDetector.getState();
    return { content: [{ type: 'text', text: JSON.stringify({
      ...arc,
      frustration,
      lastInjection: lastInjection ? {
        mode: lastInjection.mode,
        song: lastInjection.songReference,
        composedAt: lastInjection.composedAt,
      } : null,
    }, null, 2) }] };
  }
);

// -- radio_status --
server.tool(
  'radio_status',
  'Asimov\'s Radio system status: song count, arc state, active mode, last injection.',
  {},
  async () => {
    return { content: [{ type: 'text', text: JSON.stringify({
      active,
      songCount: songStore.size,
      currentMode: arcTracker.currentMode || 'inactive',
      currentValence: arcTracker.currentValence,
      injectionCount: arcTracker.injectionCount,
      milestoneCount: arcTracker.milestoneCount,
      frustrationScore: frustrationDetector.score,
      sessionVibe: arcTracker.sessionVibe,
      lastInjection: lastInjection ? {
        mode: lastInjection.mode,
        song: lastInjection.songReference?.title,
        at: lastInjection.composedAt,
      } : null,
    }, null, 2) }] };
  }
);

// -- radio_signal (event ingestion for external integrations) --
server.tool(
  'radio_signal',
  'Send an event signal to the Radio arc engine. Use this to feed mood changes, agent completions, and failures from external systems.',
  {
    type: z.enum(['mood_change', 'agent_completed', 'agent_failed']).describe('Event type'),
    mood: z.string().max(50).optional().describe('Mood label (for mood_change)'),
    energyLevel: z.number().min(0).max(1).optional().describe('Energy level 0-1 (for mood_change)'),
    success: z.boolean().optional().describe('Whether agent succeeded (for agent_completed)'),
    summary: z.string().max(5000).optional().describe('Agent output summary'),
    error: z.string().max(5000).optional().describe('Error message (for agent_failed)'),
  },
  async (args) => {
    switch (args.type) {
      case 'mood_change':
        onMoodChange({ mood: args.mood, energyLevel: args.energyLevel });
        break;
      case 'agent_completed':
        onAgentCompleted({ success: args.success, summary: args.summary, error: args.error });
        break;
      case 'agent_failed':
        onAgentFailed({ error: args.error });
        break;
    }
    return { content: [{ type: 'text', text: JSON.stringify({
      processed: true,
      type: args.type,
      arcMode: arcTracker.currentMode,
      frustration: frustrationDetector.score,
    }, null, 2) }] };
  }
);

// -- radio_inject (get current injection for agent context) --
server.tool(
  'radio_inject',
  'Get the current musical context injection for an agent. Returns the injection text and operator display, or null if inactive.',
  {},
  async () => {
    const injection = getActiveInjection();
    return { content: [{ type: 'text', text: JSON.stringify(injection, null, 2) }] };
  }
);

// --- Startup ---

async function main() {
  await state.load();
  await songStore.initialize(state);
  arcTracker.initialize(eventBus);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[radio] Asimov's Radio online. ${songStore.size} songs in library.\n`);
}

async function cleanup() {
  await songStore.stop();
  await state.stop();
  arcTracker.reset();
  frustrationDetector.reset();
}

process.on('SIGINT', () => { cleanup().finally(() => process.exit(0)); });
process.on('SIGTERM', () => { cleanup().finally(() => process.exit(0)); });

process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[radio] Unhandled rejection: ${reason}\n`);
  cleanup().finally(() => process.exit(1));
});

main().catch((err) => {
  process.stderr.write(`[radio] Fatal: ${err.message}\n`);
  process.exit(1);
});
