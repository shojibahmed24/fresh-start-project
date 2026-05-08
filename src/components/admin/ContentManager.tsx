import { useEffect, useMemo, useState } from "react";
import { Megaphone, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { type Announcement, type Faq, type EditAnn, type EditFaq } from "./ContentManager/types";
import { AnnouncementList } from "./ContentManager/AnnouncementList";
import { FaqList } from "./ContentManager/FaqList";
import { AnnouncementDialog } from "./ContentManager/AnnouncementDialog";
import { FaqDialog } from "./ContentManager/FaqDialog";

export const ContentManager = () => {
  const [tab, setTab] = useState<"announcements" | "faqs">("announcements");

  const [anns, setAnns] = useState<Announcement[]>([]);
  const [editAnn, setEditAnn] = useState<EditAnn | null>(null);

  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [editFaq, setEditFaq] = useState<EditFaq | null>(null);

  const refresh = async () => {
    const [{ data: a }, { data: f }] = await Promise.all([
      (supabase as any).from("announcements").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
      (supabase as any).from("faqs").select("*").order("category", { ascending: true }).order("sort_order", { ascending: true }),
    ]);
    setAnns((a ?? []) as Announcement[]);
    setFaqs((f ?? []) as Faq[]);
  };

  useEffect(() => {
    refresh();
  }, []);

  // ---------- Announcement actions ----------
  const newAnn = () =>
    setEditAnn({
      _new: true,
      title: "",
      body: "",
      variant: "promo",
      link_url: "",
      link_label: "",
      is_active: true,
      starts_at: new Date().toISOString(),
      expires_at: null,
      sort_order: 0,
    });

  const saveAnn = async () => {
    if (!editAnn) return;
    if (!editAnn.title?.trim()) return toast.error("Title required");
    const payload = {
      title: editAnn.title,
      body: editAnn.body ?? "",
      variant: editAnn.variant ?? "info",
      link_url: editAnn.link_url ?? "",
      link_label: editAnn.link_label ?? "",
      is_active: editAnn.is_active ?? true,
      starts_at: editAnn.starts_at ?? new Date().toISOString(),
      expires_at: editAnn.expires_at ?? null,
      sort_order: editAnn.sort_order ?? 0,
    };
    const q = editAnn._new
      ? (supabase as any).from("announcements").insert(payload)
      : (supabase as any).from("announcements").update(payload).eq("id", editAnn.id);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditAnn(null);
    refresh();
  };

  const removeAnn = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await (supabase as any).from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  };

  const toggleAnnActive = async (a: Announcement) => {
    const { error } = await (supabase as any)
      .from("announcements")
      .update({ is_active: !a.is_active })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  // ---------- FAQ actions ----------
  const newFaq = () =>
    setEditFaq({ _new: true, question: "", answer: "", category: "general", is_active: true, sort_order: 0 });

  const saveFaq = async () => {
    if (!editFaq) return;
    if (!editFaq.question?.trim() || !editFaq.answer?.trim())
      return toast.error("Question & answer required");
    const payload = {
      question: editFaq.question,
      answer: editFaq.answer,
      category: editFaq.category || "general",
      is_active: editFaq.is_active ?? true,
      sort_order: editFaq.sort_order ?? 0,
    };
    const q = editFaq._new
      ? (supabase as any).from("faqs").insert(payload)
      : (supabase as any).from("faqs").update(payload).eq("id", editFaq.id);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditFaq(null);
    refresh();
  };

  const removeFaq = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    const { error } = await (supabase as any).from("faqs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  };

  const toggleFaqActive = async (f: Faq) => {
    const { error } = await (supabase as any).from("faqs").update({ is_active: !f.is_active }).eq("id", f.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const stats = useMemo(() => {
    const now = new Date();
    const liveAnn = anns.filter(
      (a) => a.is_active && new Date(a.starts_at) <= now && (!a.expires_at || new Date(a.expires_at) > now),
    ).length;
    const activeFaq = faqs.filter((f) => f.is_active).length;
    return { liveAnn, totalAnn: anns.length, activeFaq, totalFaq: faqs.length };
  }, [anns, faqs]);

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "announcements" | "faqs")}>
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="announcements" className="gap-1.5 flex-1 sm:flex-none">
            <Megaphone size={14} /> <span className="hidden xs:inline">Announcements</span><span className="xs:hidden">News</span>
            <Badge variant="outline" className="ml-1 text-[10px]">{stats.liveAnn}/{stats.totalAnn}</Badge>
          </TabsTrigger>
          <TabsTrigger value="faqs" className="gap-1.5 flex-1 sm:flex-none">
            <HelpCircle size={14} /> FAQs
            <Badge variant="outline" className="ml-1 text-[10px]">{stats.activeFaq}/{stats.totalFaq}</Badge>
          </TabsTrigger>
        </TabsList>

        <AnnouncementList
          anns={anns}
          onNew={newAnn}
          onEdit={(a) => setEditAnn(a)}
          onToggle={toggleAnnActive}
          onRemove={removeAnn}
        />

        <FaqList
          faqs={faqs}
          onNew={newFaq}
          onEdit={(f) => setEditFaq(f)}
          onToggle={toggleFaqActive}
          onRemove={removeFaq}
        />
      </Tabs>

      <AnnouncementDialog editAnn={editAnn} setEditAnn={setEditAnn} onSave={saveAnn} />
      <FaqDialog editFaq={editFaq} setEditFaq={setEditFaq} onSave={saveFaq} />
    </div>
  );
};
