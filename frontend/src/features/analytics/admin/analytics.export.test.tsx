// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {DailyChart} from './AnalyticsCharts';
import {analyticsRows} from './analytics.export';
import type {DashboardResponse} from './analytics.types';
it('replaces empty arrivals with a range-specific message and no plot',()=>{
 render(<DailyChart title="Library arrivals" periodLabel="Oct 3 – Oct 9" emptyMessage="No check-ins in this range" data={[{label:'2026-10-03',library_entries:0}]} metrics={[{key:'library_entries',label:'Check-ins',color:'#000'}]}/>);
 expect(screen.getByText('No check-ins in this range')).toBeInTheDocument();expect(screen.getByText('Oct 3 – Oct 9')).toBeInTheDocument();expect(screen.queryByRole('img')).not.toBeInTheDocument();cleanup();
});
it('exports only the selected tab, with explicit current snapshot scopes',()=>{
 const data={stats:{total_book_copies:61,active_accessioned_copies:4,needs_accession_copies:57,available_book_copies:1,borrowed_book_copies:4},charts:{catalogByCategory:[{name:'History',titles:2,copies:61}],copyCondition:[{name:'Good',value:61}],attendanceTrend:[{label:'2026-10-03',entry_exit_count:3}],visitTrend:[],userRoles:[]}} as unknown as DashboardResponse;
 const collection=analyticsRows(data,'collection','Oct 3 – Oct 9',null);expect(collection.every(row=>row[4]==='Current snapshot')).toBe(true);expect(collection.some(row=>row[0]==='attendanceTrend')).toBe(false);
 const visitors=analyticsRows(data,'visitors','Oct 3 – Oct 9',null);expect(visitors[0].slice(2)).toEqual([3,'2026-10-03','Oct 3 – Oct 9']);expect(visitors.some(row=>row[0]==='catalogByCategory')).toBe(false);
});
