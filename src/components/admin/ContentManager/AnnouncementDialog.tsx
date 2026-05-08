import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Announcement, type EditAnn, VARIANT_OPTIONS, toLocalInput, fromLocalInput } from "./types";

type Props = {
  editAnn: EditAnn | null;
  setEditAnn: (v: EditAnn | null) => void;
  onSave: () => void;
};

export const AnnouncementDialog = ({ editAnn, setEditAnn, onSave }: Props) => (
  <Dialog open={!!editAnn} onOpenChange={(o) => !o && setEditAnn(null)}>
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editAnn?._new ? "New announcement" : "Edit announcement"}</DialogTitle>
      </DialogHeader>
      {editAnn && (
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              value={editAnn.title ?? ""}
              onChange={(e) => setEditAnn({ ...editAnn, title: e.target.value })}
              placeholder="EID offer — 50% off all packages 🎉"
            />
          </div>
          <div>
            <Label className="text-xs">Body (optional)</Label>
            <Textarea
              rows={3}
              value={editAnn.body ?? ""}
              onChange={(e) => setEditAnn({ ...editAnn, body: e.target.value })}
              placeholder="Use code EID50 at checkout. Limited time only."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Variant</Label>
              <Select
                value={editAnn.variant ?? "info"}
                onValueChange={(v) => setEditAnn({ ...editAnn, variant: v as Announcement["variant"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VARIANT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="inline-flex items-center gap-2">{o.icon}{o.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sort order</Label>
              <Input
                type="number"
                value={editAnn.sort_order ?? 0}
                onChange={(e) => setEditAnn({ ...editAnn, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Link URL (optional)</Label>
              <Input
                value={editAnn.link_url ?? ""}
                onChange={(e) => setEditAnn({ ...editAnn, link_url: e.target.value })}
                placeholder="/shop or https://…"
              />
            </div>
            <div>
              <Label className="text-xs">Link label</Label>
              <Input
                value={editAnn.link_label ?? ""}
                onChange={(e) => setEditAnn({ ...editAnn, link_label: e.target.value })}
                placeholder="Claim now"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Starts at</Label>
              <Input
                type="datetime-local"
                value={toLocalInput(editAnn.starts_at)}
                onChange={(e) => setEditAnn({ ...editAnn, starts_at: fromLocalInput(e.target.value) ?? new Date().toISOString() })}
              />
            </div>
            <div>
              <Label className="text-xs">Expires at (optional)</Label>
              <Input
                type="datetime-local"
                value={toLocalInput(editAnn.expires_at)}
                onChange={(e) => setEditAnn({ ...editAnn, expires_at: fromLocalInput(e.target.value) })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm pt-1">
            <Switch
              checked={editAnn.is_active ?? true}
              onCheckedChange={(v) => setEditAnn({ ...editAnn, is_active: v })}
            />
            Active
          </label>
          <Button className="w-full" onClick={onSave}>Save announcement</Button>
        </div>
      )}
    </DialogContent>
  </Dialog>
);
