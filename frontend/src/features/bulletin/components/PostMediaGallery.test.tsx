// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it} from 'vitest';
import PostMediaGallery from './PostMediaGallery';
afterEach(cleanup);
const images=Array.from({length:7},(_,i)=>({url:`https://example.test/image-${i+1}.jpg`,alt:`Poster ${i+1}`}));
it('opens every tile at its own position and navigates the entire collection',async()=>{
 render(<PostMediaGallery images={images} title="Notice"/>);
 expect(screen.getAllByRole('button',{name:/Open image/})).toHaveLength(5);
 fireEvent.click(screen.getByRole('button',{name:'Open image 3 of 7: Poster 3'}));
 const viewer=within(await screen.findByRole('dialog'));
 expect(viewer.getByText('Image 3 of 7')).toBeInTheDocument();
 expect(viewer.getByRole('link',{name:'Download selected image'})).toHaveAttribute('href',images[2].url);
 fireEvent.click(viewer.getByRole('button',{name:'Zoom in'}));expect(viewer.getByRole('button',{name:'Zoom out'})).toBeInTheDocument();
 fireEvent.click(viewer.getByRole('button',{name:'Next image'}));expect(viewer.getByText('Image 4 of 7')).toBeInTheDocument();expect(viewer.getByRole('button',{name:'Zoom in'})).toBeInTheDocument();
 fireEvent.click(viewer.getByRole('button',{name:'View image 7'}));expect(viewer.getByText('Image 7 of 7')).toBeInTheDocument();
 fireEvent.keyDown(screen.getByRole('dialog'),{key:'ArrowRight'});expect(viewer.getByText('Image 1 of 7')).toBeInTheDocument();
 fireEvent.touchStart(viewer.getByRole('img',{name:'Poster 1'}),{touches:[{clientX:300,clientY:200}],changedTouches:[{clientX:300,clientY:200}]});fireEvent.touchEnd(viewer.getByRole('img',{name:'Poster 1'}),{changedTouches:[{clientX:100,clientY:205}]});expect(viewer.getByText('Image 2 of 7')).toBeInTheDocument();
 fireEvent.click(viewer.getByRole('button',{name:'Close image viewer'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Open image 3 of 7: Poster 3'})).toHaveFocus());
},15000);
it('offers recovery when a selected image fails',async()=>{
 render(<PostMediaGallery images={images.slice(0,2)} title="Notice"/>);fireEvent.click(screen.getByRole('button',{name:'Open image 2 of 2: Poster 2'}));
 const viewer=within(await screen.findByRole('dialog'));fireEvent.error(viewer.getByRole('img',{name:'Poster 2'}));
 expect(viewer.getByRole('alert')).toHaveTextContent('could not be loaded');expect(viewer.getByRole('link',{name:'Open original image'})).toHaveAttribute('href',images[1].url);
});

it('reaches every image in a maximum-size gallery, including images beyond the grid',async()=>{
 const all=Array.from({length:9},(_,i)=>({url:`https://example.test/full-${i+1}.jpg`,alt:`Page ${i+1}`}));
 render(<PostMediaGallery images={all} title="Notice"/>);fireEvent.click(screen.getByRole('button',{name:'Open image 5 of 9: Page 5'}));const viewer=within(await screen.findByRole('dialog'));
 for(let i=0;i<all.length;i++){fireEvent.click(viewer.getByRole('button',{name:`View image ${i+1}`}));expect(viewer.getByRole('img',{name:all[i].alt})).toHaveAttribute('src',all[i].url);expect(viewer.getByRole('link',{name:'Download selected image'})).toHaveAttribute('href',all[i].url);}
},15000);

it('uses a quiet compact row for long posts without per-image instruction labels',()=>{
 render(<PostMediaGallery images={images} title="Notice" compact/>);
 expect(screen.getAllByRole('button',{name:/Open image/})).toHaveLength(4);expect(screen.getByText('+3')).toBeInTheDocument();expect(screen.queryByText('View image')).not.toBeInTheDocument();
});
