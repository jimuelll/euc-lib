// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {afterEach,expect,it,vi} from "vitest";
import {PublicationNotificationOption} from "./PublicationNotificationOption";
afterEach(cleanup);
it("explains both delivery channels and shows a recipient preview",()=>{
 const onChange=vi.fn();
 const preview={inAppCount:10,emailCount:7,skippedCount:3,enabled:true,reason:null} as any;
 const {rerender}=render(<PublicationNotificationOption checked={false} onChange={onChange} loading={false} error={false} onRetry={()=>{}} draft/>);
 expect(screen.getByText(/Saving a draft does not send/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole("checkbox",{name:/Notify users/}));expect(onChange).toHaveBeenCalledWith(true);
 rerender(<PublicationNotificationOption checked onChange={onChange} preview={preview} loading={false} error={false} onRetry={()=>{}}/>);
 expect(screen.getByRole("status")).toHaveTextContent("10 in-app · 7 by email · 3 in-app only");
});
