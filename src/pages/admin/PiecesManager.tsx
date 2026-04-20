import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cacheStaleWhileRevalidate, isOffline } from "@/lib/offlineCache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import {
  Pencil,
  Trash2,
  Plus,
  Upload,
  X,
  GripVertical,
  ImageIcon,
  Star,
  Search,
  Sparkles,
  Flame,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  cover_url?: string | null;
  cover_storage_path?: string | null;
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
};

// Sortable image card (in edit form)
const SortableImage = ({
  img,
  onRemove,
  onPromote,
}: {
  img: Image;
  onRemove: (img: Image) => void;
  onPromote: (img: Image) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: img.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative aspect-square bg-secondary/30 group touch-none rounded-md overflow-hidden ${
        isOver && !isDragging ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
    >
      <img src={img.url} alt="" className="w-full h-full object-cover pointer-events-none" />
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1.5 left-1.5 z-20 bg-background/80 hover:bg-background text-foreground p-1 cursor-grab active:cursor-grabbing rounded"
        title="Arrastar para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => onPromote(img)} title="Definir como capa">
          <Star className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onRemove(img)} title="Remover">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Sortable piece card (grid)
const SortablePieceCard = ({
  piece,
  onEdit,
  onDelete,
  disabled,
}: {
  piece: Piece;
  onEdit: (p: Piece) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: piece.id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const thumbUrl = piece.cover_url ?? piece.gallery_piece_images[0]?.url;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group glass-card overflow-hidden touch-none transition-all duration-300 hover:border-primary-glow/40 hover:shadow-[0_0_30px_-8px_hsl(var(--primary-glow)/0.5)] ${
        isOver && !isDragging ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
    >
      {/* Cover */}
      <div className="relative aspect-[4/3] bg-secondary/30 overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={piece.nome}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent opacity-90 pointer-events-none" />

        {/* Drag handle pill */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="absolute top-3 left-3 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-primary-glow cursor-grab active:cursor-grabbing disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={disabled ? "Reordenação desativada com filtros" : "Arrastar para reordenar"}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Tags top-right */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
          {piece.novo && (
            <span className="text-[9px] font-accent tracking-[0.2em] uppercase bg-primary/20 backdrop-blur text-primary-glow px-2 py-1 rounded shadow-[0_0_15px_hsl(var(--primary)/0.4)] flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" /> Novo
            </span>
          )}
          {piece.destaque && (
            <span className="text-[9px] font-accent tracking-[0.2em] uppercase bg-brand-red/25 backdrop-blur text-brand-red px-2 py-1 rounded shadow-[0_0_15px_hsl(var(--accent-red)/0.3)] flex items-center gap-1">
              <Flame className="h-2.5 w-2.5" /> Destaque
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <p className="font-display text-base leading-tight line-clamp-2">{piece.nome}</p>
          <p className="text-[11px] text-muted-foreground mt-1 font-accent tracking-[0.15em] uppercase">
            {piece.gallery_categories?.nome ?? "Sem categoria"} · {piece.gallery_piece_images.length} img
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
          <span className="text-[10px] font-accent tracking-[0.25em] uppercase text-muted-foreground/60">
            #{String(piece.ordem).padStart(2, "0")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onEdit(piece)}
              title="Editar"
              className="h-8 w-8 hover:bg-primary/15 hover:text-primary-glow"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDelete(piece.id)}
              title="Excluir"
              className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [coverUploading, setCoverUploading] = useState(false);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [activePieceId, setActivePieceId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = async () => {
    setLoading(true);
    await cacheStaleWhileRevalidate<{ pieces: Piece[]; categories: Category[] }>(
      "admin:pieces+categories",
      async () => {
        const [piecesRes, catsRes] = await Promise.all([
          supabase
            .from("gallery_pieces")
            .select("*, gallery_categories(nome), gallery_piece_images(id, url, storage_path, ordem)")
            .order("ordem", { ascending: true }),
          supabase.from("gallery_categories").select("id, nome").order("ordem", { ascending: true }),
        ]);
        if (piecesRes.error) throw piecesRes.error;
        const sorted = (piecesRes.data ?? []).map((p) => ({
          ...p,
          gallery_piece_images: [...(p.gallery_piece_images ?? [])].sort((a, b) => a.ordem - b.ordem),
        })) as Piece[];
        return { pieces: sorted, categories: (catsRes.data as Category[]) ?? [] };
      },
      {
        onCache: ({ pieces, categories }) => {
          setPieces(pieces);
          setCategories(categories);
          setLoading(false);
        },
        onFresh: ({ pieces, categories }) => {
          setPieces(pieces);
          setCategories(categories);
        },
        onError: (err) => {
          if (!isOffline()) {
            toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
          }
        },
      },
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const refreshEditing = async (id: string) => {
    const { data } = await supabase
      .from("gallery_pieces")
      .select("*, gallery_categories(nome), gallery_piece_images(id, url, storage_path, ordem)")
      .eq("id", id)
      .single();
    if (data) {
      setEditing({
        ...data,
        gallery_piece_images: [...data.gallery_piece_images].sort((a, b) => a.ordem - b.ordem),
      } as Piece);
    }
  };

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
      destaque: p.destaque, novo: p.novo,
    });
    setCreating(true);
  };

  const closeForm = () => { setCreating(false); setEditing(null); setForm(emptyForm); };

  const guardOffline = () => {
    if (isOffline()) {
      toast({ title: "Sem conexão", description: "Mudanças desabilitadas no modo offline.", variant: "destructive" });
      return true;
    }
    return false;
  };

  const handleSave = async () => {
    if (guardOffline()) return;
    if (!form.nome.trim()) return toast({ title: "Nome obrigatório", variant: "destructive" });
    if (!form.categoria_id) return toast({ title: "Selecione uma categoria", variant: "destructive" });
    setSaving(true);
    const basePayload = {
      nome: form.nome.trim().slice(0, 100),
      categoria_id: form.categoria_id,
      descricao: form.descricao.trim().slice(0, 500),
      conceito: form.conceito.trim().slice(0, 1000),
      historia: form.historia.trim().slice(0, 2000),
      tempo: form.tempo.trim().slice(0, 60),
      destaque: form.destaque,
      novo: form.novo,
    };
    const { error } = editing
      ? await supabase.from("gallery_pieces").update(basePayload).eq("id", editing.id)
      : await supabase.from("gallery_pieces").insert({ ...basePayload, ordem: pieces.length });
    setSaving(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Atualizada" : "Criada" });
    if (!editing) closeForm();
    load();
    if (editing) await refreshEditing(editing.id);
  };

  const handleDelete = async (id: string) => {
    if (guardOffline()) return;
    if (!confirm("Remover esta obra e todas as imagens?")) return;
    const piece = pieces.find((p) => p.id === id);
    if (piece) {
      const paths = piece.gallery_piece_images.map((i) => i.storage_path).filter(Boolean) as string[];
      if (piece.cover_storage_path) paths.push(piece.cover_storage_path);
      if (paths.length) await supabase.storage.from("gallery").remove(paths);
    }
    const { error } = await supabase.from("gallery_pieces").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Removida" });
    load();
  };

  const handleUpload = async (files: FileList | null) => {
    if (guardOffline()) return;
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
      await refreshEditing(editing.id);
      load();
    } catch (err) {
      toast({ title: "Erro no upload", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleCoverUpload = async (files: FileList | null) => {
    if (!files || !editing) return;
    const file = files[0];
    if (!file || !file.type.startsWith("image/")) return;
    setCoverUploading(true);
    try {
      if (editing.cover_storage_path) {
        await supabase.storage.from("gallery").remove([editing.cover_storage_path]);
      }
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `pieces/${editing.id}/cover-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("gallery").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("gallery_pieces")
        .update({ cover_url: pub.publicUrl, cover_storage_path: path })
        .eq("id", editing.id);
      if (updErr) throw updErr;
      toast({ title: "Capa atualizada" });
      await refreshEditing(editing.id);
      load();
    } catch (err) {
      toast({ title: "Erro no upload da capa", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setCoverUploading(false);
      if (coverRef.current) coverRef.current.value = "";
    }
  };

  const removeCover = async () => {
    if (!editing || !editing.cover_url) return;
    if (!confirm("Remover imagem capa?")) return;
    if (editing.cover_storage_path) {
      await supabase.storage.from("gallery").remove([editing.cover_storage_path]);
    }
    const { error } = await supabase
      .from("gallery_pieces")
      .update({ cover_url: null, cover_storage_path: null })
      .eq("id", editing.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Capa removida" });
    await refreshEditing(editing.id);
    load();
  };

  const promoteToCover = async (img: Image) => {
    if (!editing) return;
    try {
      if (editing.cover_url && editing.cover_storage_path) {
        const newOrdem = editing.gallery_piece_images.length;
        const { error: insErr } = await supabase.from("gallery_piece_images").insert({
          piece_id: editing.id,
          url: editing.cover_url,
          storage_path: editing.cover_storage_path,
          ordem: newOrdem,
        });
        if (insErr) throw insErr;
      }
      const { error: delErr } = await supabase.from("gallery_piece_images").delete().eq("id", img.id);
      if (delErr) throw delErr;
      const { error: updErr } = await supabase
        .from("gallery_pieces")
        .update({ cover_url: img.url, cover_storage_path: img.storage_path })
        .eq("id", editing.id);
      if (updErr) throw updErr;
      toast({ title: "Capa definida" });
      await refreshEditing(editing.id);
      load();
    } catch (err) {
      toast({ title: "Erro ao definir capa", description: err instanceof Error ? err.message : "", variant: "destructive" });
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

  const handleImageDragStart = (event: DragStartEvent) => {
    setActiveImageId(String(event.active.id));
  };

  const handleImageDragEnd = async (event: DragEndEvent) => {
    setActiveImageId(null);
    if (!editing) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = editing.gallery_piece_images;
    const oldIdx = list.findIndex((i) => i.id === active.id);
    const newIdx = list.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(list, oldIdx, newIdx).map((img, idx) => ({ ...img, ordem: idx }));
    setEditing({ ...editing, gallery_piece_images: reordered });
    const updates = reordered
      .filter((img, idx) => list[idx]?.id !== img.id || list[idx]?.ordem !== img.ordem)
      .map((img) => supabase.from("gallery_piece_images").update({ ordem: img.ordem }).eq("id", img.id));
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast({ title: "Erro ao reordenar", description: failed.error.message, variant: "destructive" });
      await refreshEditing(editing.id);
    }
  };

  const handlePieceDragStart = (event: DragStartEvent) => {
    setActivePieceId(String(event.active.id));
  };

  const handlePieceDragEnd = async (event: DragEndEvent) => {
    setActivePieceId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = pieces.findIndex((p) => p.id === active.id);
    const newIdx = pieces.findIndex((p) => p.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(pieces, oldIdx, newIdx).map((p, idx) => ({ ...p, ordem: idx }));
    setPieces(reordered);
    const updates = reordered
      .filter((p, idx) => pieces[idx]?.id !== p.id || pieces[idx]?.ordem !== p.ordem)
      .map((p) => supabase.from("gallery_pieces").update({ ordem: p.ordem }).eq("id", p.id));
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast({ title: "Erro ao reordenar", description: failed.error.message, variant: "destructive" });
      load();
    }
  };

  const handleAddCategoryInline = async () => {
    const name = newCategoryName.trim();
    if (!name) return toast({ title: "Nome obrigatório", variant: "destructive" });
    setSavingCategory(true);
    const { data, error } = await supabase
      .from("gallery_categories")
      .insert({ nome: name.slice(0, 60), ordem: categories.length })
      .select("id, nome")
      .single();
    setSavingCategory(false);
    if (error || !data) {
      return toast({ title: "Erro", description: error?.message ?? "Falha ao criar", variant: "destructive" });
    }
    setCategories([...categories, data]);
    setForm((f) => ({ ...f, categoria_id: data.id }));
    setNewCategoryName("");
    setCategoryPopoverOpen(false);
    toast({ title: "Categoria criada" });
  };

  const activeImage = activeImageId
    ? editing?.gallery_piece_images.find((i) => i.id === activeImageId)
    : null;
  const activePiece = activePieceId ? pieces.find((p) => p.id === activePieceId) : null;

  const isFiltering = search.trim() !== "" || filterCat !== "all";
  const filteredPieces = pieces.filter((p) => {
    if (filterCat !== "all" && p.categoria_id !== filterCat) return false;
    if (search.trim() && !p.nome.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top bar: count + new piece */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h3 className="font-accent text-sm tracking-[0.25em] uppercase text-muted-foreground">Catálogo</h3>
          <span className="font-display text-2xl text-gradient-light tabular-nums">{pieces.length}</span>
          {isFiltering && (
            <span className="text-[11px] text-muted-foreground">
              · exibindo {filteredPieces.length}
            </span>
          )}
        </div>
        <Button
          onClick={openCreate}
          className="rounded-none font-accent tracking-[0.25em] uppercase text-xs h-10 px-5 bg-gradient-purple-wine hover:opacity-90 shadow-glow"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Nova obra
        </Button>
      </div>

      {/* Filter bar — pill style */}
      <div className="glass-card rounded-full p-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome…"
            className="pl-11 rounded-full border-0 bg-transparent h-10 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="rounded-full border-border/40 bg-secondary/40 h-10 w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFiltering && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setFilterCat("all"); }}
            className="rounded-full font-accent tracking-[0.2em] uppercase text-[10px] hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {isFiltering && (
        <p className="text-[11px] text-muted-foreground -mt-2 px-2">
          Reordenação desativada enquanto há filtros ativos.
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aspect-[4/3] shimmer rounded-md" />
          ))}
        </div>
      ) : filteredPieces.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma obra encontrada.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handlePieceDragStart}
          onDragEnd={handlePieceDragEnd}
          onDragCancel={() => setActivePieceId(null)}
        >
          <SortableContext
            items={filteredPieces.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
            disabled={isFiltering}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredPieces.map((p) => (
                <SortablePieceCard
                  key={p.id}
                  piece={p}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  disabled={isFiltering}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activePiece ? (
              <div className="glass-panel p-3 flex items-center gap-3 glow-ring-primary max-w-xs">
                <div className="w-14 h-14 bg-secondary/30 flex-shrink-0 rounded overflow-hidden">
                  {(activePiece.cover_url ?? activePiece.gallery_piece_images[0]?.url) ? (
                    <img
                      src={activePiece.cover_url ?? activePiece.gallery_piece_images[0]?.url}
                      alt={activePiece.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <p className="font-display truncate">{activePiece.nome}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Editor Sheet */}
      <Sheet open={creating} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl p-0 bg-card/95 backdrop-blur-xl border-l border-border/40 overflow-y-auto"
        >
          {/* Header */}
          <SheetHeader className="sticky top-0 z-10 px-6 sm:px-8 py-5 bg-gradient-purple-wine border-b border-primary/30">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-accent text-[10px] tracking-[0.4em] uppercase text-white/70 mb-1">
                  {editing ? "Editar obra" : "Nova obra"}
                </p>
                <SheetTitle className="font-display text-xl text-white truncate">
                  {editing?.nome || form.nome || "Sem nome"}
                </SheetTitle>
              </div>
            </div>
          </SheetHeader>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Identidade */}
            <section className="space-y-4">
              <h4 className="font-accent text-[11px] tracking-[0.3em] uppercase text-primary-glow flex items-center gap-2">
                <span className="h-px w-6 bg-primary-glow" /> Identidade
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Nome</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    maxLength={100}
                    className="bg-secondary/40 border-border/40 focus-visible:border-primary-glow mt-1"
                  />
                </div>
                <div>
                  <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Categoria</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="flex-1">
                      <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                        <SelectTrigger className="bg-secondary/40 border-border/40">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="icon" title="Nova categoria" className="border-border/40">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 space-y-3 glass-panel">
                        <Label>Nova categoria</Label>
                        <Input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Nome"
                          maxLength={60}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCategoryInline();
                            }
                          }}
                        />
                        <Button
                          onClick={handleAddCategoryInline}
                          disabled={savingCategory}
                          className="w-full rounded-none font-accent tracking-[0.2em] uppercase text-xs"
                        >
                          {savingCategory ? "Salvando…" : "Salvar"}
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                    Tempo de produção
                  </Label>
                  <Input
                    value={form.tempo}
                    onChange={(e) => setForm({ ...form, tempo: e.target.value })}
                    maxLength={60}
                    className="bg-secondary/40 border-border/40 focus-visible:border-primary-glow mt-1"
                  />
                </div>
                <div className="flex items-center gap-3 glass-card p-3 rounded-md">
                  <Switch checked={form.novo} onCheckedChange={(v) => setForm({ ...form, novo: v })} />
                  <div>
                    <Label className="cursor-pointer">Novo</Label>
                    <p className="text-[10px] text-muted-foreground">Marca a obra como recém-adicionada</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 glass-card p-3 rounded-md">
                  <Switch checked={form.destaque} onCheckedChange={(v) => setForm({ ...form, destaque: v })} />
                  <div>
                    <Label className="cursor-pointer">Destaque</Label>
                    <p className="text-[10px] text-muted-foreground">Aparece em posição especial</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Conteúdo */}
            <section className="space-y-4">
              <h4 className="font-accent text-[11px] tracking-[0.3em] uppercase text-primary-glow flex items-center gap-2">
                <span className="h-px w-6 bg-primary-glow" /> Conteúdo
              </h4>
              <div className="space-y-4">
                <div>
                  <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Descrição</Label>
                  <Textarea
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    maxLength={500}
                    rows={2}
                    className="bg-secondary/40 border-border/40 focus-visible:border-primary-glow mt-1"
                  />
                </div>
                <div>
                  <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Conceito</Label>
                  <Textarea
                    value={form.conceito}
                    onChange={(e) => setForm({ ...form, conceito: e.target.value })}
                    maxLength={1000}
                    rows={3}
                    className="bg-secondary/40 border-border/40 focus-visible:border-primary-glow mt-1"
                  />
                </div>
                <div>
                  <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">História</Label>
                  <Textarea
                    value={form.historia}
                    onChange={(e) => setForm({ ...form, historia: e.target.value })}
                    maxLength={2000}
                    rows={4}
                    className="bg-secondary/40 border-border/40 focus-visible:border-primary-glow mt-1"
                  />
                </div>
              </div>
            </section>

            {editing && (
              <>
                {/* Capa */}
                <section className="space-y-4">
                  <h4 className="font-accent text-[11px] tracking-[0.3em] uppercase text-primary-glow flex items-center gap-2">
                    <span className="h-px w-6 bg-primary-glow" /> Capa
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Imagem usada como destaque nos cards. Você pode enviar uma capa dedicada ou clicar na ⭐ em uma
                    imagem da galeria para promovê-la.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="w-32 h-32 bg-secondary/30 flex items-center justify-center flex-shrink-0 border border-border/40 rounded overflow-hidden">
                      {editing.cover_url ? (
                        <img src={editing.cover_url} alt="Capa" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={coverRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => handleCoverUpload(e.target.files)}
                      />
                      <Button
                        onClick={() => coverRef.current?.click()}
                        disabled={coverUploading}
                        className="rounded-none font-accent tracking-[0.2em] uppercase text-xs"
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        {coverUploading ? "Enviando…" : editing.cover_url ? "Trocar capa" : "Enviar capa"}
                      </Button>
                      {editing.cover_url && (
                        <Button
                          variant="outline"
                          onClick={removeCover}
                          className="rounded-none font-accent tracking-[0.2em] uppercase text-xs"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Remover capa
                        </Button>
                      )}
                    </div>
                  </div>
                </section>

                {/* Galeria */}
                <section className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-accent text-[11px] tracking-[0.3em] uppercase text-primary-glow flex items-center gap-2">
                      <span className="h-px w-6 bg-primary-glow" /> Galeria
                    </h4>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(e) => handleUpload(e.target.files)}
                    />
                    <Button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      size="sm"
                      className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px]"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? "Enviando…" : "Adicionar"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Arraste para reordenar · Clique na estrela para definir como capa
                  </p>
                  {editing.gallery_piece_images.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhuma imagem ainda.</p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleImageDragStart}
                      onDragEnd={handleImageDragEnd}
                      onDragCancel={() => setActiveImageId(null)}
                    >
                      <SortableContext
                        items={editing.gallery_piece_images.map((i) => i.id)}
                        strategy={rectSortingStrategy}
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {editing.gallery_piece_images.map((img) => (
                            <SortableImage
                              key={img.id}
                              img={img}
                              onRemove={removeImage}
                              onPromote={promoteToCover}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      <DragOverlay>
                        {activeImage ? (
                          <div className="aspect-square w-32 shadow-2xl ring-2 ring-primary/60 rounded">
                            <img src={activeImage.url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  )}
                </section>
              </>
            )}
          </div>

          {/* Sticky save bar */}
          <div className="sticky bottom-0 z-10 px-6 sm:px-8 py-4 bg-card/95 backdrop-blur-xl border-t border-border/40 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={closeForm}
              className="rounded-none font-accent tracking-[0.2em] uppercase text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-none font-accent tracking-[0.2em] uppercase text-xs px-6 bg-gradient-purple-wine hover:opacity-90 shadow-glow"
            >
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar e gerenciar imagens"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
