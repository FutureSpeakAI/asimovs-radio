/**
 * Asimov's Radio Tests
 *
 * Covers: SongStore CRUD, ArcTracker mode transitions, FrustrationDetector
 * pattern matching, InjectionComposer output formatting, and event integration.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { SongStore } from '../lib/song-store.js';
import { EmotionalArcTracker } from '../lib/arc-tracker.js';
import { FrustrationDetector } from '../lib/frustration-detector.js';
import { InjectionComposer } from '../lib/injection-composer.js';

// -- Mock helpers --

function createMockState() {
  const store = new Map();
  return {
    async read(key) { return { success: true, data: store.get(key) ?? null }; },
    async write(key, data) { store.set(key, data); return { success: true }; },
    async delete(key) { store.delete(key); return { success: true }; },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SONG STORE
// ═══════════════════════════════════════════════════════════════════════

describe('SongStore: CRUD operations', () => {
  it('adds a song and returns it with an ID', async () => {
    const store = new SongStore();
    await store.initialize(createMockState());

    const song = store.add({ title: "Don't Stop Me Now", artist: 'Queen', tags: ['energy', 'joy'] });
    assert.ok(song.id, 'song should have an ID');
    assert.equal(song.title, "Don't Stop Me Now");
    assert.equal(song.artist, 'Queen');
    assert.equal(song.playCount, 0);
    assert.equal(store.size, 1);
  });

  it('deduplicates by title+artist (case insensitive)', async () => {
    const store = new SongStore();
    await store.initialize(createMockState());

    store.add({ title: 'Bohemian Rhapsody', artist: 'Queen', tags: ['epic'] });
    const dup = store.add({ title: 'bohemian rhapsody', artist: 'queen', tags: ['opera'] });
    assert.equal(store.size, 1, 'should not create a duplicate');
    assert.ok(dup.tags.includes('epic'), 'original tags preserved');
    assert.ok(dup.tags.includes('opera'), 'new tags merged');
  });

  it('removes a song by ID', async () => {
    const store = new SongStore();
    await store.initialize(createMockState());

    const song = store.add({ title: 'Test', artist: 'Artist' });
    assert.equal(store.size, 1);
    assert.ok(store.remove(song.id));
    assert.equal(store.size, 0);
    assert.ok(!store.remove('nonexistent'));
  });

  it('returns null when title or artist missing', async () => {
    const store = new SongStore();
    await store.initialize(createMockState());

    assert.equal(store.add({ title: '', artist: 'X' }), null);
    assert.equal(store.add({ title: 'X', artist: '' }), null);
    assert.equal(store.add({}), null);
  });

  it('searches by query across title, artist, and tags', async () => {
    const store = new SongStore();
    await store.initialize(createMockState());

    store.add({ title: 'Thunderstruck', artist: 'AC/DC', tags: ['energy', 'rock'] });
    store.add({ title: 'Stairway to Heaven', artist: 'Led Zeppelin', tags: ['epic'] });
    store.add({ title: 'Back in Black', artist: 'AC/DC', tags: ['swagger'] });

    assert.equal(store.search('AC/DC').length, 2);
    assert.equal(store.search('energy').length, 1);
    assert.equal(store.search('heaven').length, 1);
    assert.equal(store.search('nonexistent').length, 0);
  });

  it('filters by valence', async () => {
    const store = new SongStore();
    await store.initialize(createMockState());

    store.add({ title: 'Happy', artist: 'Pharrell', emotional_valence: 'uplifting' });
    store.add({ title: 'Creep', artist: 'Radiohead', emotional_valence: 'melancholy' });

    assert.equal(store.getByValence('uplifting').length, 1);
    assert.equal(store.getByValence('melancholy').length, 1);
    assert.equal(store.getByValence('intense').length, 0);
  });

  it('selectForMode returns least-played matching song', async () => {
    const store = new SongStore();
    await store.initialize(createMockState());

    const s1 = store.add({ title: 'Song A', artist: 'X', emotional_valence: 'uplifting' });
    store.add({ title: 'Song B', artist: 'X', emotional_valence: 'uplifting' });
    store.incrementPlayCount(s1.id);

    const selected = store.selectForMode('celebration', 'neutral');
    assert.equal(selected.title, 'Song B', 'should pick least-played');
  });

  it('getByTags returns matching songs', async () => {
    const store = new SongStore();
    await store.initialize(createMockState());

    store.add({ title: 'A', artist: 'X', tags: ['grit', 'determination'] });
    store.add({ title: 'B', artist: 'X', tags: ['joy', 'celebration'] });
    store.add({ title: 'C', artist: 'X', tags: ['grit', 'anger'] });

    assert.equal(store.getByTags(['grit']).length, 2);
    assert.equal(store.getByTags(['celebration']).length, 1);
    assert.equal(store.getByTags(['nonexistent']).length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ARC TRACKER
// ═══════════════════════════════════════════════════════════════════════

describe('EmotionalArcTracker: mode transitions', () => {
  it('starts inactive (no mode) until vibe is set', () => {
    const tracker = new EmotionalArcTracker();
    assert.equal(tracker.currentMode, null);
    assert.equal(tracker.isActive, false);
  });

  it('enters mirror mode when vibe is set', () => {
    const tracker = new EmotionalArcTracker();
    tracker.initialize(new EventEmitter());
    tracker.setSessionVibe('energized', ['rock']);
    assert.equal(tracker.currentMode, 'mirror');
    assert.equal(tracker.isActive, true);
    assert.equal(tracker.currentValence, 'uplifting');
  });

  it('transitions to shift on sustained frustration', () => {
    const tracker = new EmotionalArcTracker();
    tracker.initialize(new EventEmitter());
    tracker.setSessionVibe('focused');

    for (let i = 0; i < 4; i++) {
      tracker.updateFrustration(0.7);
    }
    assert.equal(tracker.currentMode, 'shift');
  });

  it('returns to mirror when frustration resolves', () => {
    const tracker = new EmotionalArcTracker();
    tracker.initialize(new EventEmitter());
    tracker.setSessionVibe('focused');

    for (let i = 0; i < 4; i++) tracker.updateFrustration(0.7);
    assert.equal(tracker.currentMode, 'shift');

    for (let i = 0; i < 4; i++) tracker.updateFrustration(0.1);
    assert.equal(tracker.currentMode, 'mirror');
  });

  it('transitions to celebration on milestone', () => {
    const tracker = new EmotionalArcTracker();
    tracker.initialize(new EventEmitter());
    tracker.setSessionVibe('focused');

    const isMilestone = tracker.checkMilestone({ summary: 'All tests pass, zero failures' });
    assert.ok(isMilestone);
    assert.equal(tracker.currentMode, 'celebration');
    assert.equal(tracker.milestoneCount, 1);
  });

  it('forced mode overrides automatic transitions', () => {
    const tracker = new EmotionalArcTracker();
    tracker.initialize(new EventEmitter());
    tracker.setSessionVibe('focused');

    tracker.forceMode('celebration');
    assert.equal(tracker.currentMode, 'celebration');

    for (let i = 0; i < 5; i++) tracker.updateFrustration(0.9);
    assert.equal(tracker.currentMode, 'celebration', 'forced mode must be sticky');

    tracker.forceMode('auto');
    for (let i = 0; i < 4; i++) tracker.updateFrustration(0.8);
    assert.equal(tracker.currentMode, 'shift', 'auto mode re-enables transitions');
  });

  it('reset clears all state', () => {
    const tracker = new EmotionalArcTracker();
    tracker.initialize(new EventEmitter());
    tracker.setSessionVibe('angry');
    tracker.reset();
    assert.equal(tracker.currentMode, null);
    assert.equal(tracker.isActive, false);
    assert.equal(tracker.sessionVibe, null);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FRUSTRATION DETECTOR
// ═══════════════════════════════════════════════════════════════════════

describe('FrustrationDetector: scoring', () => {
  it('starts at zero frustration', () => {
    const detector = new FrustrationDetector();
    assert.equal(detector.score, 0);
  });

  it('increases on agent failure', () => {
    const detector = new FrustrationDetector();
    detector.recordAgentCompletion({ success: false, output: 'Test failed' });
    assert.ok(detector.score > 0);
  });

  it('decreases on agent success', () => {
    const detector = new FrustrationDetector();
    detector.recordAgentCompletion({ success: false, output: 'Error' });
    detector.recordAgentCompletion({ success: false, output: 'Error' });
    const frustrated = detector.score;

    detector.recordAgentCompletion({ success: true, output: 'All good' });
    assert.ok(detector.score < frustrated);
  });

  it('escalates on consecutive failures', () => {
    const detector = new FrustrationDetector();
    detector.recordAgentCompletion({ success: false, output: 'fail 1' });
    const score1 = detector.score;
    detector.recordAgentCompletion({ success: false, output: 'fail 2' });
    assert.ok(detector.score > score1);
  });

  it('detects desperation language', () => {
    const detector = new FrustrationDetector();
    detector.recordAgentCompletion({
      success: false,
      output: "I'm running out of options. Why won't this work? This is my last resort.",
    });
    assert.ok(detector.score > 0.2);
  });

  it('responds to mood changes', () => {
    const detector = new FrustrationDetector();
    detector.recordMoodChange({ mood: 'frustrated', energyLevel: 0.2 });
    assert.ok(detector.score > 0);
  });

  it('reset clears score and history', () => {
    const detector = new FrustrationDetector();
    detector.recordAgentCompletion({ success: false, output: 'Error' });
    detector.reset();
    assert.equal(detector.score, 0);
    assert.equal(detector.consecutiveFailures, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// INJECTION COMPOSER
// ═══════════════════════════════════════════════════════════════════════

describe('InjectionComposer: output formatting', () => {
  const composer = new InjectionComposer();

  const testSong = {
    title: "Don't Stop Me Now",
    artist: 'Queen',
    link: 'https://youtube.com/watch?v=HgzGwKwLmgM',
    lines: ['I\'m a shooting star leaping through the sky', 'Two hundred degrees, that\'s why they call me Mr. Fahrenheit'],
    chords: 'F Am Dm Gm C',
  };

  it('returns null when no song or mode', () => {
    assert.equal(composer.compose({ mode: null, song: testSong }), null);
    assert.equal(composer.compose({ mode: 'mirror', song: null }), null);
  });

  it('composes mirror mode injection', () => {
    const result = composer.compose({ mode: 'mirror', song: testSong, trigger: 'session_baseline' });
    assert.ok(result);
    assert.equal(result.mode, 'mirror');
    assert.ok(result.injectionText.includes("Don't Stop Me Now"));
    assert.ok(result.injectionText.includes('Queen'));
    assert.ok(result.operatorText.includes('Queen'));
  });

  it('composes shift mode injection with reframe language', () => {
    const result = composer.compose({ mode: 'shift', song: testSong, trigger: 'sustained_frustration' });
    assert.ok(result.injectionText.includes('resolution'));
    assert.ok(result.injectionText.includes('fresh angle'));
  });

  it('composes celebration mode injection', () => {
    const result = composer.compose({ mode: 'celebration', song: testSong, trigger: 'milestone' });
    assert.ok(result.injectionText.includes('milestone'));
  });

  it('selects lyric lines based on arc position', () => {
    const early = composer.compose({ mode: 'mirror', song: testSong, trigger: 'test', arcPosition: 'early' });
    assert.ok(early.operatorText.includes('shooting star'));

    const resolved = composer.compose({ mode: 'mirror', song: testSong, trigger: 'test', arcPosition: 'resolved' });
    assert.ok(resolved.operatorText.includes('Fahrenheit'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// EVENT INTEGRATION
// ═══════════════════════════════════════════════════════════════════════

describe('Event integration', () => {
  it('mood change updates arc tracker and frustration detector', () => {
    const tracker = new EmotionalArcTracker();
    const detector = new FrustrationDetector();
    tracker.initialize(new EventEmitter());
    tracker.setSessionVibe('focused');

    const mood = 'frustrated';
    const energy = 0.2;
    tracker.updateMood(mood, energy);
    detector.recordMoodChange({ mood, energyLevel: energy });
    tracker.updateFrustration(detector.score);

    assert.ok(detector.score > 0);
    assert.equal(tracker.currentValence, 'intense');
  });

  it('milestone in agent completion triggers celebration', () => {
    const tracker = new EmotionalArcTracker();
    tracker.initialize(new EventEmitter());
    tracker.setSessionVibe('focused');

    const result = tracker.checkMilestone({ summary: 'deployed to production, all tests pass' });
    assert.ok(result);
    assert.equal(tracker.currentMode, 'celebration');
  });
});
