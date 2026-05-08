import { Plus, Pencil, Trash2, HelpCircle, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { type Faq } from "./types";

type Props = {
  faqs: Faq[];
  onNew: () => void;
  onEdit: (f: Faq) => void;
  onToggle: (f: Faq) => void;
  onRemove: (id: string) => void;
};

export const FaqList = ({ faqs, onNew, onEdit, onToggle, onRemove }: Props) => (
  <TabsContent value="faqs" className="mt-6 space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <p className="text-xs sm:text-sm text-muted-foreground">Shop page e bottom e dekhabe. Category diye group hobe.</p>
      <Button onClick={onNew} leftIcon={<Plus size={14} />} className="shrink-0 w-full sm:w-auto">New FAQ</Button>
    </div>

    {faqs.length === 0 ? (
      <div className="rounded-xl border border-dashed border-[hsl(0_0%_100%/0.1)] p-10 text-center text-sm text-muted-foreground">
        <HelpCircle size={28} className="mx-auto mb-3 opacity-50" />
        Kono FAQ nei. Common questions add korun.
      </div>
    ) : (
      <div className="space-y-2">
        {faqs.map((f) => (
          <div
            key={f.id}
            className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 rounded-lg bg-[hsl(var(--bg-elevated))] border border-[hsl(0_0%_100%/0.08)]"
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px] uppercase">{f.category}</Badge>
                {!f.is_active && <Badge variant="outline">Hidden</Badge>}
              </div>
              <div className="font-medium">{f.question}</div>
              <div className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                {f.answer}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon-sm" variant="ghost" onClick={() => onToggle(f)} aria-label="Toggle">
                {f.is_active ? <Eye size={14} /> : <EyeOff size={14} className="text-muted-foreground" />}
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => onEdit(f)} aria-label="Edit">
                <Pencil size={14} />
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => onRemove(f.id)} aria-label="Delete">
                <Trash2 size={14} className="text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    )}
  </TabsContent>
);
