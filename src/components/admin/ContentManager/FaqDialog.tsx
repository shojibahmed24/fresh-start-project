import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type EditFaq } from "./types";

type Props = {
  editFaq: EditFaq | null;
  setEditFaq: (v: EditFaq | null) => void;
  onSave: () => void;
};

export const FaqDialog = ({ editFaq, setEditFaq, onSave }: Props) => (
  <Dialog open={!!editFaq} onOpenChange={(o) => !o && setEditFaq(null)}>
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editFaq?._new ? "New FAQ" : "Edit FAQ"}</DialogTitle>
      </DialogHeader>
      {editFaq && (
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label className="text-xs">Question</Label>
            <Input
              value={editFaq.question ?? ""}
              onChange={(e) => setEditFaq({ ...editFaq, question: e.target.value })}
              placeholder="How long does order approval take?"
            />
          </div>
          <div>
            <Label className="text-xs">Answer</Label>
            <Textarea
              rows={5}
              value={editFaq.answer ?? ""}
              onChange={(e) => setEditFaq({ ...editFaq, answer: e.target.value })}
              placeholder="Usually within 1-2 hours during business hours…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Input
                value={editFaq.category ?? "general"}
                onChange={(e) => setEditFaq({ ...editFaq, category: e.target.value })}
                placeholder="general, payment, credits…"
              />
            </div>
            <div>
              <Label className="text-xs">Sort order</Label>
              <Input
                type="number"
                value={editFaq.sort_order ?? 0}
                onChange={(e) => setEditFaq({ ...editFaq, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm pt-1">
            <Switch
              checked={editFaq.is_active ?? true}
              onCheckedChange={(v) => setEditFaq({ ...editFaq, is_active: v })}
            />
            Visible to users
          </label>
          <Button className="w-full" onClick={onSave}>Save FAQ</Button>
        </div>
      )}
    </DialogContent>
  </Dialog>
);
