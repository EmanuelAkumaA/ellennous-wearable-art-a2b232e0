import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Check, X, GripVertical, Tags } from "lucide-react";
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
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Category {
  id: string;
  nome: string;
  ordem: number;
}

const SortableCategoryRow = ({
  cat,
  index,
  editing,
  editName,
  setEditName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  cat: Category;
  index: number;
  editing: boolean;
  editName: string;
  setEditName: (v: string) => void;
  onStartEdit: (c: Category) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: cat.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group glass-card p-4 flex items-center gap-3 touch-none transition-all duration-300 hover:border-primary-glow/40 hover:shadow-[0_0_25px_-10px_hsl(var(--primary-glow)/0.5)] relative ${
        isOver && !isDragging
          ? "before:content-[''] before:absolute before:left-0 before:right-0 before:-top-1 before:h-0.5 before:bg-primary before:shadow-[0_0_12px_hsl(var(--primary-glow))]"
          : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex-shrink-0 h-8 w-8 rounded-md bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-primary-glow hover:bg-secondary/70 cursor-grab active:cursor-grabbing transition-colors"
        title="Arrastar para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="font-accent text-[10px] tracking-[0.2em] text-muted-foreground/60 w-8 tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </span>

      {editing ? (
        <>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 bg-secondary/40 border-border/40 focus-visible:border-primary-glow"
            maxLength={60}
            autoFocus
          />
          <Button size="icon" variant="ghost" onClick={() => onSaveEdit(cat.id)} className="hover:bg-primary/15 hover:text-primary-glow">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onCancelEdit}>
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 font-display text-base truncate">{cat.nome}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onStartEdit(cat)}
            className="opacity-60 group-hover:opacity-100 hover:bg-primary/15 hover:text-primary-glow transition-opacity"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(cat.id)}
            className="opacity-60 group-hover:opacity-100 hover:bg-destructive/15 hover:text-destructive transition-opacity"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </li>
  );
};

export const CategoriesManager = () => {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gallery_categories")
      .select("id, nome, ordem")
      .order("ordem", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (name.length > 60) return toast({ title: "Nome muito longo", variant: "destructive" });
    const { error } = await supabase.from("gallery_categories").insert({ nome: name, ordem: items.length });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setNewName("");
    toast({ title: "Categoria criada" });
    load();
  };

  const handleSaveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const { error } = await supabase.from("gallery_categories").update({ nome: name }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setEditing(null);
    toast({ title: "Atualizada" });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta categoria? Obras associadas precisam ser movidas antes.")) return;
    const { error } = await supabase.from("gallery_categories").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Removida" });
    load();
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((c) => c.id === active.id);
    const newIdx = items.findIndex((c) => c.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(items, oldIdx, newIdx).map((c, idx) => ({ ...c, ordem: idx }));
    setItems(reordered);
    const updates = reordered
      .filter((c, idx) => items[idx]?.id !== c.id || items[idx]?.ordem !== c.ordem)
      .map((c) => supabase.from("gallery_categories").update({ ordem: c.ordem }).eq("id", c.id));
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast({ title: "Erro ao reordenar", description: failed.error.message, variant: "destructive" });
      load();
    }
  };

  const activeCat = activeId ? items.find((c) => c.id === activeId) : null;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* New category panel */}
      <div className="glass-panel p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/15 blur-[60px] pointer-events-none" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-gradient-purple-wine flex items-center justify-center shadow-glow">
              <Plus className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-display text-lg">Nova categoria</h3>
              <p className="text-xs text-muted-foreground">A ordem é controlada arrastando os cards abaixo</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div>
              <Label htmlFor="cat-name" className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                Nome
              </Label>
              <Input
                id="cat-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={60}
                placeholder="Ex.: Cardigans, Joias…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                className="bg-secondary/40 border-border/40 focus-visible:border-primary-glow mt-1"
              />
            </div>
            <Button
              onClick={handleAdd}
              className="self-end rounded-none font-accent tracking-[0.2em] uppercase text-xs h-10 px-5 bg-gradient-purple-wine hover:opacity-90 shadow-glow"
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Tags className="h-4 w-4 text-primary-glow" />
          <h3 className="font-accent text-sm tracking-[0.25em] uppercase text-muted-foreground">
            Coleções · {items.length}
          </h3>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 shimmer rounded-md" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Tags className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma categoria ainda.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {items.map((c, idx) => (
                  <SortableCategoryRow
                    key={c.id}
                    cat={c}
                    index={idx}
                    editing={editing === c.id}
                    editName={editName}
                    setEditName={setEditName}
                    onStartEdit={(cat) => {
                      setEditing(cat.id);
                      setEditName(cat.nome);
                    }}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditing(null)}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay>
              {activeCat ? (
                <div className="glass-panel p-4 flex items-center gap-3 glow-ring-primary">
                  <GripVertical className="h-4 w-4 text-primary-glow" />
                  <span className="font-display">{activeCat.nome}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
};
