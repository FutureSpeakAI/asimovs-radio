/**
 * Injection Composer -- Composes musical context for inter-agent messaging.
 *
 * Given the current arc mode and a selected song, produces structured
 * injection objects that the orchestrator weaves into agent delegation
 * context. The output serves two channels simultaneously:
 *
 * 1. For agents: emotionally contextual content at failure boundaries
 * 2. For the operator: song selections that function as emotional telemetry
 *
 * The injection text is natural language, not bracketed off. It blends
 * into the orchestrator's communication.
 */

export class InjectionComposer {
  /**
   * Compose a musical injection for the given mode and song.
   *
   * @param {{ mode: string, song: object, trigger: string, arcPosition?: string }} opts
   * @returns {{ mode: string, songReference: object, injectionText: string, operatorText: string, composedAt: number } | null}
   */
  compose({ mode, song, trigger, arcPosition }) {
    if (!song || !mode) return null;

    const songRef = {
      title: song.title,
      artist: song.artist,
      link: song.link || null,
    };

    const injectionText = this.#buildAgentContext(mode, song, trigger);
    const operatorText = this.#buildOperatorDisplay(mode, song, trigger, arcPosition);

    return {
      mode,
      songReference: songRef,
      injectionText,
      operatorText,
      composedAt: Date.now(),
    };
  }

  #buildAgentContext(mode, song, trigger) {
    switch (mode) {
      case 'mirror':
        return `[Musical context: The operator's current energy aligns with "${song.title}" by ${song.artist}. Match this intensity in your approach. ${trigger === 'frustration_detected' ? 'Acknowledge the difficulty before pushing forward.' : ''}]`;

      case 'shift':
        return `[Musical context: Think "${song.title}" by ${song.artist} -- the work is shifting toward resolution. Lean into forward momentum. ${trigger === 'sustained_frustration' ? 'Take a fresh angle rather than retrying the same approach.' : ''}]`;

      case 'celebration':
        return `[Musical context: "${song.title}" by ${song.artist} -- milestone energy. Reinforce the win and carry the momentum forward.]`;

      default:
        return `[Musical context: "${song.title}" by ${song.artist}.]`;
    }
  }

  #buildOperatorDisplay(mode, song, trigger, arcPosition) {
    const parts = [];

    if (song.lines?.length > 0) {
      const lineIdx = this.#selectLineIndex(song.lines, arcPosition);
      parts.push(`"${song.lines[lineIdx]}" -- ${song.artist}, "${song.title}"`);
    } else {
      parts.push(`"${song.title}" -- ${song.artist}`);
    }

    if (song.chords) {
      parts.push(`   ${song.chords}`);
    }

    if (song.link) {
      parts.push(`   ${song.link}`);
    }

    return parts.join('\n');
  }

  #selectLineIndex(lines, arcPosition) {
    if (lines.length <= 1) return 0;

    switch (arcPosition) {
      case 'early':
        return 0;
      case 'developing':
        return Math.min(1, lines.length - 1);
      case 'sustained':
        return Math.floor(lines.length / 2);
      case 'resolving':
        return Math.max(0, lines.length - 2);
      case 'resolved':
        return lines.length - 1;
      default:
        return Math.floor(Math.random() * lines.length);
    }
  }
}
