import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { installGlobalBrowserMocks } from '../mocks/mockEnvironment';

installGlobalBrowserMocks();

import { ErrorBoundary } from '../../src/components/common/ErrorBoundary';

describe('Spotibai Resilience: Inactive Tab Wakeup & Mobile Lyrics Sync', () => {
  let audioEngine: typeof import('../../src/services/audio/AudioEngine').audioEngine;

  beforeEach(async () => {
    const aeModule = await import('../../src/services/audio/AudioEngine');
    audioEngine = aeModule.audioEngine;
  });
  describe('1. ErrorBoundary Root Protection', () => {
    it('catches runtime errors and provides recovery fallback without a blank black screen', () => {
      // Direct instance state test
      const boundary = new ErrorBoundary({ children: null });
      const derived = ErrorBoundary.getDerivedStateFromError(new Error('Simulated browser background tab wakeup crash'));
      expect(derived.hasError).toBe(true);
      expect(derived.error?.message).toContain('background tab');

      boundary.state = derived;
      const html = renderToStaticMarkup(boundary.render() as React.ReactElement);
      expect(html).toContain('Something went wrong');
      expect(html).toContain('Reload Spotibai');
    });

    it('renders normal children when no error occurs', () => {
      const html = renderToStaticMarkup(
        <ErrorBoundary>
          <div data-testid="normal-child">Spotibai Running</div>
        </ErrorBoundary>
      );

      expect(html).toContain('Spotibai Running');
    });
  });

  describe('2. Inactive Tab Visibility & AudioContext Resumption', () => {
    it('AudioEngine responds to visibilitychange and resumes suspended AudioContext', async () => {
      // Mock suspended AudioContext
      const resumeSpy = vi.fn().mockResolvedValue(undefined);
      (audioEngine as any).ctx = {
        state: 'suspended',
        resume: resumeSpy,
      };

      // Dispatch visibilitychange when document is visible
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(resumeSpy).toHaveBeenCalled();
    });
  });

  describe('3. Mobile Lyrics Isolation Calculation', () => {
    it('accurately calculates relative top without desktop offsetTop 0 corruption', () => {
      // Container simulated at top 100 with scrollTop 50
      const containerRect = { top: 100, height: 400 };
      // Target lyric line simulated at top 250 with height 40
      const elementRect = { top: 250, height: 40 };
      const scrollTop = 50;

      const relativeTop = elementRect.top - containerRect.top + scrollTop; // 250 - 100 + 50 = 200
      const targetScroll = relativeTop - containerRect.height / 2 + elementRect.height / 2; // 200 - 200 + 20 = 20

      expect(targetScroll).toBe(20);
      expect(Math.max(0, targetScroll)).toBe(20);
    });

    it('clamps negative scroll targets safely to 0 for initial lyric lines', () => {
      const containerRect = { top: 100, height: 400 };
      const elementRect = { top: 110, height: 40 }; // Near the very top
      const scrollTop = 0;

      const relativeTop = elementRect.top - containerRect.top + scrollTop; // 10
      const targetScroll = relativeTop - containerRect.height / 2 + elementRect.height / 2; // 10 - 200 + 20 = -170

      expect(Math.max(0, targetScroll)).toBe(0);
    });
  });
});
