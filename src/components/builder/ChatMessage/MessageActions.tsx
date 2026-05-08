import { forwardRef, useState } from "react";
import { Copy, RotateCcw, Check, Pencil, ThumbsUp, ThumbsDown, MoreHorizontal, Trash2, Share2, GitBranch } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Feedback = "up" | "down" | null;

export const MessageActions = forwardRef<HTMLDivElement, {
  content: string;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onBranch?: () => void;
  isUser: boolean;
}>(({ content, onRegenerate, onEdit, onDelete, onBranch, isUser }, ref) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  };

  const handleShare = async () => {
    const shareData = { title: "Chat message", text: content.slice(0, 4000) };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Message copied to clipboard");
    } catch {
      toast.error("Could not share message");
    }
  };

  const btn =
    "inline-flex items-center justify-center min-h-[40px] min-w-[40px] md:min-h-0 md:min-w-0 p-2 md:p-1.5 rounded-md text-[hsl(var(--foreground-muted))] hover:text-foreground hover:bg-[hsl(0_0%_100%/0.06)] active:bg-[hsl(0_0%_100%/0.1)] transition-colors duration-150";

  return (
    <>
      <div ref={ref} className="mt-2 -ml-1 flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-150">
        <button onClick={handleCopy} className={btn} aria-label="Copy" title="Copy">
          {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
        </button>
        {onRegenerate && (
          <button onClick={onRegenerate} className={btn} aria-label="Regenerate" title="Regenerate">
            <RotateCcw size={13} />
          </button>
        )}
        {onEdit && (
          <button onClick={onEdit} className={btn} aria-label="Edit" title="Edit">
            <Pencil size={13} />
          </button>
        )}
        {!isUser && (
          <>
            <div className="mx-1 h-4 w-px bg-[hsl(0_0%_100%/0.08)]" />
            <button
              onClick={() => setFeedback((f) => (f === "up" ? null : "up"))}
              className={cn(btn, feedback === "up" && "text-primary bg-primary/10 hover:text-primary")}
              aria-label="Good response"
              aria-pressed={feedback === "up"}
              title="Good response"
            >
              <ThumbsUp size={13} />
            </button>
            <button
              onClick={() => setFeedback((f) => (f === "down" ? null : "down"))}
              className={cn(
                btn,
                feedback === "down" && "text-destructive bg-destructive/10 hover:text-destructive",
              )}
              aria-label="Bad response"
              aria-pressed={feedback === "down"}
              title="Bad response"
            >
              <ThumbsDown size={13} />
            </button>
          </>
        )}

        <div className="mx-1 h-4 w-px bg-[hsl(0_0%_100%/0.08)]" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={btn} aria-label="More actions" title="More">
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={handleCopy}>
              <Copy size={13} className="mr-2" />
              Copy text
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShare}>
              <Share2 size={13} className="mr-2" />
              Share message
            </DropdownMenuItem>
            {onRegenerate && (
              <DropdownMenuItem onClick={onRegenerate}>
                <RotateCcw size={13} className="mr-2" />
                Regenerate
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil size={13} className="mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {onBranch && (
              <DropdownMenuItem onClick={onBranch}>
                <GitBranch size={13} className="mr-2" />
                Branch from here
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 size={13} className="mr-2" />
                  Delete message
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {onDelete && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this message?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the message from this conversation.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete();
                  setConfirmDelete(false);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
});
MessageActions.displayName = "MessageActions";
