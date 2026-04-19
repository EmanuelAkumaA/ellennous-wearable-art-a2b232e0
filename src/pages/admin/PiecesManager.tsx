import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Upload, X, ChevronUp, ChevronDown, Star } from "lucide-react";

interface Category { id: string; nome: string; }
interface Image { id: string; url: string; storage_path: string | null; ordem: number; }
interface Piece {
  id: string;
  nome: string;
  categoria_id: string;
  descricao: string;
  conceito: string;
  historia: string;
  tempo: string;
  destaque: boolean;
  novo: boolean;
  ordem: number;
  cover_image_id?: string | null;
  gallery_categories: { nome: string } | null;
  gallery_piece_images: Image[];
}

const emptyForm = {
  nome: "",
  categoria_id: "",
  descricao: "",
  conceito: "",
  historia: "",
  tempo: "",
  destaque: false,
  novo: false,
  ordem: 0,
};

export const PiecesManager = () => {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Piece | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [piecesRes, catsRes] = await Promise.all([
      supabase
        .from("gallery_pieces")
        .select("*, gallery_categories(nome), gallery_piece_images(id, url, storage_path, ordem)")
        .order("ordem", { ascending: true }),
      supabase.from("gallery_categories").select("id, nome").order("ordem", { ascending: true }),
    ]);
    if (piecesRes.error) toast({ title: "Erro", description: piecesRes.error.message, variant: "destructive" });
    else {
      const sorted = (piecesRes.data ?? []).map((p) => ({
        ...p,
        gallery_piece_images: [...(p.gallery_piece_images ?? [])].sort((a, b) => a.ordem - b.ordem),
      })) as Piece[];
      setPieces(sorted);
    }
    if (catsRes.data) setCategories(catsRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, categoria_id: categories[0]?.id ?? "" });
    setCreating(true);
  };

  const openEdit = (p: Piece) => {
    setEditing(p);
    setForm({
      nome: p.nome, categoria_id: p.categoria_id, descricao: p.descricao,
      conceito: p.conceito, historia: p.historia, tempo: p.tempo,
      destaque: p.destaque, novo: p.novo, ordem: p.ordem,
    });
    setCreating(true);
  };

  const closeForm = () => { setCreating(false); setEditing(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.nome.trim()) return toast({ title: "Nome obrigatório", variant: "destructive" });
    if (!form.categoria_id) return toast({ title: "Selecione uma categoria", variant: "destructive" });
    setSaving(true);
    const payload = {
      nome: form.nome.trim().slice(0, 100),
      categoria_id: form.categoria_id,
      descricao: form.descricao.trim().slice(0, 500),
      conceito: form.conceito.trim().slice(0, 1000),
      historia: form.historia.trim().slice(0, 2000),
      tempo: form.tempo.trim().slice(0, 60),
      destaque: form.destaque,
      novo: form.novo,
      ordem: form.ordem,
    };
    const { error } = editing
      ? await supabase.from("gallery_pieces").update(payload).eq("id", editing.id)
      : await supabase.from("gallery_pieces").insert(payload);
    setSaving(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Atualizada" : "Criada" });
    if (!editing) closeForm();
    load();
    if (editing) {
      // refresh editing with fresh data
      const { data } = await supabase
        .from("gallery_pieces")
        .select("*, gallery_categories(nome), gallery_piece_images(id, url, storage_path, ordem)")
        .eq("id", editing.id)
        .single();
      if (data) setEditing({ ...data, gallery_piece_images: [...data.gallery_piece_images].sort((a, b) => a.ordem - b.ordem) } as Piece);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta obra e todas as imagens?")) return;
    const piece = pieces.find((p) => p.id === id);
    if (piece) {
      const paths = piece.gallery_piece_images.map((i) => i.storage_path).filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from("gallery").remove(paths);
    }
    const { error } = await supabase.from("gallery_pieces").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Removida" });
    load();
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !editing) return;
    setUploading(true);
    try {
      const baseOrdem = editing.gallery_piece_images.length;
      let i = 0;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `pieces/${editing.id}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("gallery").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);
        const { error: insErr } = await supabase
          .from("gallery_piece_images")
          .insert({ piece_id: editing.id, url: pub.publicUrl, storage_path: path, ordem: baseOrdem + i });
        if (insErr) throw insErr;
        i++;
      }
      toast({ title: "Upload concluído" });
      // refresh editing
      const { data } = await supabase
        .from("gallery_pieces")
        .select("*, gallery_categories(nome), gallery_piece_images(id, url, storage_path, ordem)")
        .eq("id", editing.id)
        .single();
      if (data) setEditing({ ...data, gallery_piece_images: [...data.gallery_piece_images].sort((a, b) => a.ordem - b.ordem) } as Piece);
      load();
    } catch (err) {
      toast({ title: "Erro no upload", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = async (img: Image) => {
    if (!confirm("Remover esta imagem?")) return;
    if (img.storage_path) await supabase.storage.from("gallery").remove([img.storage_path]);
    const { error } = await supabase.from("gallery_piece_images").delete().eq("id", img.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    if (editing) {
      setEditing({ ...editing, gallery_piece_images: editing.gallery_piece_images.filter((i) => i.id !== img.id) });
    }
    load();
  };

  const moveImage = async (img: Image, dir: -1 | 1) => {
    if (!editing) return;
    const list = editing.gallery_piece_images;
    const idx = list.findIndex((i) => i.id === img.id);
    const swap = list[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("gallery_piece_images").update({ ordem: swap.ordem }).eq("id", img.id),
      supabase.from("gallery_piece_images").update({ ordem: img.ordem }).eq("id", swap.id),
    ]);
    const fresh = [...list];
    fresh[idx] = { ...swap, ordem: img.ordem };
    fresh[idx + dir] = { ...img, ordem: swap.ordem };
    fresh.sort((a, b) => a.ordem - b.ordem);
    setEditing({ ...editing, gallery_piece_images: fresh });
  };

  const setCover = async (img: Image) => {
    if (!editing) return;
    const { error } = await supabase
      .from("gallery_pieces")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ cover_image_id: img.id } as any)
      .eq("id", editing.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setEditing({ ...editing, cover_image_id: img.id });
    toast({ title: "Capa definida" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-display text-xl">Obras ({pieces.length})</h3>
        <Button onClick={openCreate} className="rounded-none font-accent tracking-[0.15em] uppercase text-xs">
          <Plus className="h-4 w-4 mr-1" /> Nova obra
        </Button>
      </div>

      {creating && (
        <div className="border border-primary/40 bg-card p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-display text-lg">{editing ? "Editar" : "Nova"} obra</h4>
            <Button variant="ghost" size="icon" onClick={closeForm}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={100} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tempo de produção</Label>
              <Input value={form.tempo} onChange={(e) => setForm({ ...form, tempo: e.target.value })} maxLength={60} />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={500} rows={2} />
            </div>
            <div className="md:col-span-2">
              <Label>Conceito</Label>
              <Textarea value={form.conceito} onChange={(e) => setForm({ ...form, conceito: e.target.value })} maxLength={1000} rows={3} />
            </div>
            <div className="md:col-span-2">
              <Label>História</Label>
              <Textarea value={form.historia} onChange={(e) => setForm({ ...form, historia: e.target.value })} maxLength={2000} rows={4} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.destaque} onCheckedChange={(v) => setForm({ ...form, destaque: v })} />
              <Label>Destaque</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.novo} onCheckedChange={(v) => setForm({ ...form, novo: v })} />
              <Label>Novo</Label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="rounded-none font-accent tracking-[0.15em] uppercase text-xs">
              {saving ? "Salvando…" : editing ? "Salvar" : "Criar e gerenciar imagens"}
            </Button>
            <Button variant="outline" onClick={closeForm} className="rounded-none font-accent tracking-[0.15em] uppercase text-xs">Cancelar</Button>
          </div>

          {editing && (
            <div className="pt-6 border-t border-border/50 space-y-4">
              <div className="flex justify-between items-center">
                <h5 className="font-accent text-sm tracking-[0.15em] uppercase">Imagens</h5>
                <div>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
                  <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-none font-accent tracking-[0.15em] uppercase text-xs">
                    <Upload className="h-4 w-4 mr-1" /> {uploading ? "Enviando…" : "Adicionar"}
                  </Button>
                </div>
              </div>
              {editing.gallery_piece_images.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma imagem ainda.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {editing.gallery_piece_images.map((img, idx) => (
                    <div key={img.id} className="relative aspect-square bg-secondary/30 group">
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => moveImage(img, -1)}><ChevronUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" disabled={idx === editing.gallery_piece_images.length - 1} onClick={() => moveImage(img, 1)}><ChevronDown className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => removeImage(img)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground text-sm">Carregando…</div>
      ) : (
        <div className="border border-border/50 bg-card divide-y divide-border/50">
          {pieces.map((p) => (
            <div key={p.id} className="p-4 flex items-center gap-4">
              <div className="w-16 h-16 bg-secondary/30 flex-shrink-0">
                {p.gallery_piece_images[0] && <img src={p.gallery_piece_images[0].url} alt={p.nome} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display truncate">{p.nome}</p>
                <p className="text-xs text-muted-foreground">{p.gallery_categories?.nome ?? "—"} · {p.gallery_piece_images.length} img · #{p.ordem}</p>
              </div>
              {p.destaque && <span className="text-[10px] font-accent tracking-[0.15em] uppercase bg-brand-red/20 text-brand-red px-2 py-1">Destaque</span>}
              {p.novo && <span className="text-[10px] font-accent tracking-[0.15em] uppercase bg-primary/20 text-primary-glow px-2 py-1">Novo</span>}
              <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
