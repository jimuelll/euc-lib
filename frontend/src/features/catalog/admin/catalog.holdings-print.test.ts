import {expect,it} from 'vitest';
import {holdingPrintRows,holdingCardPdf} from './catalog.holdings-print';
import type {CatalogHolding} from './catalog.api';
it('includes saved holding data as plain text',()=>{
 const rows=holdingPrintRows({title:'<script>alert(1)</script>',copy_id:11,barcode:'COPY-11',accession_number:'ACC-11',condition:'weeded',is_active:1,circulation_status:'available',location:'Shelf A',price:'0.00'} as CatalogHolding);
 expect(rows).toContainEqual(['Title','<script>alert(1)</script>']);
 for(const row of [['Accession number','ACC-11'],['Barcode','COPY-11'],['Condition','weeded'],['Location','Shelf A'],['Price (PHP)','0.00']])expect(rows).toContainEqual(row);
});
it('creates one normal sheet with the compact card anchored at the top left',async()=>{
 const canvas={width:1056,height:1600,toDataURL:()=>"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC"} as HTMLCanvasElement;
 const pdf=await holdingCardPdf(canvas);
 expect(pdf.getNumberOfPages()).toBe(1);
 expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210,1);
 expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(297,1);
});
