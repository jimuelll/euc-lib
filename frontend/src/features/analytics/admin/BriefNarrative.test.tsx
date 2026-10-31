// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {BriefNarrative,briefHtml,parseBrief} from './BriefNarrative';
const brief='No prior data to compare.\n\n## Performance assessment\n\nActivity was steady from 3 Oct 2026 to 9 Oct 2026.\n\n## Key findings\n\n- **12** books borrowed\n- ₱1,260.00 collected\n1. Review overdue loans';
it('parses headings, mixed lists and paragraphs, including legacy bare headings',()=>{
 expect(parseBrief(brief)).toEqual([{kind:'paragraph',lines:['No prior data to compare.']},{kind:'heading',text:'Performance assessment'},{kind:'paragraph',lines:['Activity was steady from 3 Oct 2026 to 9 Oct 2026.']},{kind:'heading',text:'Key findings'},{kind:'list',ordered:false,items:['**12** books borrowed','₱1,260.00 collected']},{kind:'list',ordered:true,items:['Review overdue loans']}]);
 expect(parseBrief('What changed:\nBorrowing rose.')[0]).toEqual({kind:'heading',text:'What changed'});
});
it('renders brief sections with emphasized figures and escapes print markup',()=>{
 render(<BriefNarrative text={brief}/>);
 expect(screen.getByRole('heading',{name:'Key findings'})).toBeInTheDocument();expect(screen.getAllByRole('list')).toHaveLength(2);expect(screen.getByText('₱1,260.00').tagName).toBe('STRONG');cleanup();
 const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
 expect(briefHtml('## Notes\n- **<b>5</b>** loans',escape)).toBe('<h2>Notes</h2><ul><li><strong>&lt;b&gt;5&lt;/b&gt;</strong> loans</li></ul>');
});
