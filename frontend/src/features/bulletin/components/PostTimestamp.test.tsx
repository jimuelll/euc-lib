// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import PostTimestamp from './PostTimestamp';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('uses a short date and relative time with complete publication and edit timestamps',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
 render(<PostTimestamp value="2026-10-11T10:00:00Z" editedAt="2026-10-12T10:00:00Z"/>);
 expect(screen.getByText('2w')).toHaveTextContent('2w');expect(screen.getByText('2w')).toHaveAttribute('datetime','2026-10-11T10:00:00.000Z');expect(screen.getByText('(edited)')).toHaveAttribute('title',expect.stringContaining('Oct 12, 2026'));
});

it('reveals complete dates and edit time on tap',async()=>{
 render(<PostTimestamp value="2026-10-11T10:00:00Z" editedAt="2026-10-12T10:00:00Z"/>);fireEvent.click(screen.getByRole('button',{name:/Show full timestamp/}));const detail=await screen.findByRole('dialog',{name:'Full timestamp'});expect(detail).toHaveTextContent('Published');expect(detail).toHaveTextContent('Oct 11, 2026');expect(detail).toHaveTextContent('Last edited');expect(detail).toHaveTextContent('Oct 12, 2026');
});
it('stays non-interactive when rendered inside a post card button',()=>{
 render(<button type="button">Read post<PostTimestamp interactive={false} value="2026-10-11T10:00:00Z"/></button>);expect(screen.getAllByRole('button')).toHaveLength(1);
});
