// voice_coach_test.dart
// Tests rate limiting, goodBreath consecutive count, and priority interruption.

import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import '../../lib/features/breathing/breathing_fsm.dart';
import '../../lib/features/breathing/voice_coach.dart';

// ─── Testable VoiceCoach ──────────────────────────────────────────────────────

/// Exposes internal state for testing without actual TTS hardware.
class _TestableVoiceCoach {
  static const Duration rateLimit = Duration(seconds: 8);
  static const int goodBreathRequired = 5;

  final Map<BreathingState, DateTime> lastSpokenAt = {};
  final List<BreathingState> spokenStates = [];
  int consecutiveGoodBreaths = 0;
  BreathingState? currentlyPlaying;

  final Map<BreathingState, int> _priority = {
    BreathingState.monitoring:    1,
    BreathingState.positioning:   2,
    BreathingState.calibrating:   3,
    BreathingState.goodBreath:    4,
    BreathingState.plbFault:      5,
    BreathingState.faultShoulder: 6,
    BreathingState.noPerson:      7,
  };

  bool onState(BreathingState state) {
    // Track goodBreath streak
    if (state == BreathingState.goodBreath) {
      consecutiveGoodBreaths++;
    } else {
      consecutiveGoodBreaths = 0;
    }

    // Skip if no cue for this state
    const hasCue = {
      BreathingState.positioning,
      BreathingState.calibrating,
      BreathingState.monitoring,
      BreathingState.faultShoulder,
      BreathingState.plbFault,
      BreathingState.goodBreath,
      BreathingState.noPerson,
    };
    if (!hasCue.contains(state)) return false;

    // goodBreath: require 5 consecutive
    if (state == BreathingState.goodBreath && consecutiveGoodBreaths < goodBreathRequired) {
      return false;
    }

    // Rate limit
    final last = lastSpokenAt[state];
    if (last != null && DateTime.now().difference(last) < rateLimit) {
      return false;
    }

    // Priority interrupt
    if (currentlyPlaying != null) {
      final currentPri = _priority[currentlyPlaying] ?? 0;
      final newPri     = _priority[state] ?? 0;
      if (newPri <= currentPri) return false;
      // Interrupt — stop current
    }

    _speak(state);
    return true;
  }

  void _speak(BreathingState state) {
    currentlyPlaying    = state;
    lastSpokenAt[state] = DateTime.now();
    spokenStates.add(state);
    if (state == BreathingState.goodBreath) consecutiveGoodBreaths = 0;
    currentlyPlaying = null; // Sync simulation
  }

  void simulateTimePassed(BreathingState state, Duration elapsed) {
    lastSpokenAt[state] = DateTime.now().subtract(elapsed);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

void main() {
  group('VoiceCoach — Rate Limiting', () {
    test('same state cue not spoken twice within 8 seconds', () {
      final coach = _TestableVoiceCoach();

      // First speak — should go through
      final first = coach.onState(BreathingState.positioning);
      expect(first, isTrue, reason: 'First cue should be spoken');
      expect(coach.spokenStates, contains(BreathingState.positioning));

      // Immediately again — should be blocked
      final second = coach.onState(BreathingState.positioning);
      expect(second, isFalse, reason: 'Same cue within 8s should be skipped');
      expect(coach.spokenStates.length, 1);
    });

    test('same state cue spoken again after 8 seconds', () {
      final coach = _TestableVoiceCoach();

      coach.onState(BreathingState.faultShoulder);
      // Simulate 9 seconds have passed
      coach.simulateTimePassed(BreathingState.faultShoulder, const Duration(seconds: 9));

      final second = coach.onState(BreathingState.faultShoulder);
      expect(second, isTrue, reason: 'Cue after rate limit window should be spoken');
      expect(coach.spokenStates.length, 2);
    });

    test('different states do not share rate limit', () {
      final coach = _TestableVoiceCoach();

      coach.onState(BreathingState.positioning);
      // positioning is blocked, but faultShoulder should be fine
      final result = coach.onState(BreathingState.faultShoulder);
      expect(result, isTrue, reason: 'Different state should not be rate-limited');
    });
  });

  group('VoiceCoach — GoodBreath Consecutive Count', () {
    test('goodBreath cue not triggered before 5 consecutive states', () {
      final coach = _TestableVoiceCoach();

      for (int i = 0; i < 4; i++) {
        final spoken = coach.onState(BreathingState.goodBreath);
        expect(spoken, isFalse, reason: 'Should not speak before 5 consecutive (i=$i)');
      }
      expect(coach.spokenStates, isEmpty);
    });

    test('goodBreath cue triggered exactly on 5th consecutive state', () {
      final coach = _TestableVoiceCoach();

      for (int i = 0; i < 5; i++) {
        coach.onState(BreathingState.goodBreath);
      }
      expect(coach.spokenStates, contains(BreathingState.goodBreath));
      expect(coach.spokenStates.length, 1);
    });

    test('goodBreath streak resets on any other state', () {
      final coach = _TestableVoiceCoach();

      for (int i = 0; i < 4; i++) {
        coach.onState(BreathingState.goodBreath);
      }
      // Interruption
      coach.onState(BreathingState.monitoring);
      expect(coach.consecutiveGoodBreaths, 0);

      // Need 5 more again — won't trigger on 1
      coach.onState(BreathingState.goodBreath);
      expect(coach.spokenStates.where((s) => s == BreathingState.goodBreath).length, 0);
    });

    test('goodBreath counter resets after speaking', () {
      final coach = _TestableVoiceCoach();
      for (int i = 0; i < 5; i++) coach.onState(BreathingState.goodBreath);
      // After speaking, counter should be 0
      expect(coach.consecutiveGoodBreaths, 0);
    });
  });

  group('VoiceCoach — Priority Interruption', () {
    test('high-priority noPerson interrupts lower-priority monitoring', () {
      final coach = _TestableVoiceCoach();
      // Simulate monitoring is currently playing
      coach.currentlyPlaying = BreathingState.monitoring;

      final interrupted = coach.onState(BreathingState.noPerson);
      expect(interrupted, isTrue,
        reason: 'noPerson (priority 7) should interrupt monitoring (priority 1)');
    });

    test('low-priority cue does not interrupt higher-priority one', () {
      final coach = _TestableVoiceCoach();
      coach.currentlyPlaying = BreathingState.noPerson; // highest priority

      final result = coach.onState(BreathingState.positioning);
      expect(result, isFalse,
        reason: 'positioning (priority 2) should not interrupt noPerson (priority 7)');
    });

    test('priority order is correct', () {
      final coach = _TestableVoiceCoach();
      // Verify full priority chain
      const expected = [
        BreathingState.monitoring,   // 1
        BreathingState.positioning,  // 2
        BreathingState.calibrating,  // 3
        BreathingState.goodBreath,   // 4
        BreathingState.plbFault,     // 5
        BreathingState.faultShoulder,// 6
        BreathingState.noPerson,     // 7
      ];
      final priorities = expected.map((s) => coach._priority[s]!).toList();
      for (int i = 0; i < priorities.length - 1; i++) {
        expect(priorities[i], lessThan(priorities[i + 1]),
          reason: '${expected[i]} should have lower priority than ${expected[i + 1]}');
      }
    });

    test('faultShoulder (priority 6) interrupts goodBreath (priority 4)', () {
      final coach = _TestableVoiceCoach();
      coach.currentlyPlaying = BreathingState.goodBreath;
      // Also reset rate limit for faultShoulder
      coach.simulateTimePassed(BreathingState.faultShoulder, const Duration(seconds: 30));

      final result = coach.onState(BreathingState.faultShoulder);
      expect(result, isTrue,
        reason: 'faultShoulder should interrupt goodBreath');
    });
  });
}
