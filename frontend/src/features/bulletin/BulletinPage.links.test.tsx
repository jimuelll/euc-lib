// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {afterEach,expect,it,vi} from "vitest";
import {MemoryRouter,useLocation} from "react-router-dom";
import {BulletinPage} from "./BulletinPage";
import {fetchBulletinPost} from "./api";
vi.mock("./api",()=>({fetchBulletinPost:vi.fn()}));
vi.mock("@/context/AuthContext",()=>({useAuth:()=>({user:null})}));
vi.mock("@/components/layout/Navbar",()=>({default:()=>null}));
vi.mock("@/components/layout/Footer",()=>({default:()=>null}));
vi.mock("./hooks/useBulletinPosts",()=>({useBulletinPosts:()=>({posts:[],loading:false,error:null,currentPage:1,totalPages:1,search:"",setSearch:vi.fn(),fetchPosts:vi.fn(),setCurrentPage:vi.fn(),updatePost:vi.fn(),setPinnedPost:vi.fn(),removePost:vi.fn()})}));
vi.mock("./components/PostModal",()=>({PostModal:({post,onClose}:any)=>post?<div role="dialog" aria-label={post.title}><p>{post.content}</p><button onClick={onClose}>Close post</button></div>:null}));
vi.mock("./components/CreatePostModal",()=>({CreatePostModal:()=>null}));
vi.mock("./components/BulletinSidebar",()=>({BulletinSidebar:()=>null}));
const post={id:42,title:"Linked announcement",content:"The full post",created_at:"2026-10-20T00:00:00Z",author_name:"Librarian",author_id:1,author_role:"admin",likes:0,liked_by_me:0,comment_count:0,is_pinned:0,post_type:"announcement" as const,comments:[]};
function Location(){const {pathname,search}=useLocation();return <output aria-label="Current location">{pathname+search}</output>;}
function mount(){render(<MemoryRouter initialEntries={["/bulletin?post=42"]}><BulletinPage/><Location/></MemoryRouter>);}
afterEach(()=>{cleanup();vi.resetAllMocks();});
it("opens the exact post even when it is not in the current page of results",async()=>{
 vi.mocked(fetchBulletinPost).mockResolvedValue(post);
 mount();expect(await screen.findByRole("dialog",{name:"Linked announcement"})).toHaveTextContent("The full post");
 expect(fetchBulletinPost).toHaveBeenCalledWith(42);fireEvent.click(screen.getByRole("button",{name:"Close post"}));
 await waitFor(()=>expect(screen.getByLabelText("Current location")).toHaveTextContent("/bulletin"));
 expect(screen.getByLabelText("Current location")).not.toHaveTextContent("post=");
});
it("explains when the linked post is unavailable",async()=>{
 vi.mocked(fetchBulletinPost).mockRejectedValue({response:{status:404}});mount();
 expect(await screen.findByRole("alert")).toHaveTextContent("unavailable or has been archived");
});
