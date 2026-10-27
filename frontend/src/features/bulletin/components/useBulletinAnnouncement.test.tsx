// @vitest-environment jsdom
import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useBulletinAnnouncement} from './useBulletinAnnouncement';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('clears status after three seconds and restarts the timer for repeated messages',()=>{
 vi.useFakeTimers();const {result}=renderHook(()=>useBulletinAnnouncement());act(()=>result.current[1]('Comment pinned.'));expect(result.current[0]).toBe('Comment pinned.');act(()=>vi.advanceTimersByTime(2000));act(()=>result.current[1]('Comment pinned.'));act(()=>vi.advanceTimersByTime(2000));expect(result.current[0]).toBe('Comment pinned.');act(()=>vi.advanceTimersByTime(1000));expect(result.current[0]).toBe('');
});
