import type { QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { getApiErrorMessage } from "@/utils/apiError";
import { restoreBulletinPost } from "./api";
import { bulletinKeys } from "./bulletin.keys";

// Restoring is administrator-only on the server, so only administrators get Undo.
export function announcePostArchived(client: QueryClient, postId: number, canRestore: boolean) {
  toast.success("Post archived.", canRestore ? {
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          await restoreBulletinPost(postId);
          await client.invalidateQueries({ queryKey: bulletinKeys.lists() });
          toast.success("Post restored.");
        } catch (error) {
          toast.error(getApiErrorMessage(error, "Could not restore the post. Restore it from Website content."));
        }
      },
    },
  } : undefined);
}
