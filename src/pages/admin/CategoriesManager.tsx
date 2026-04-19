import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Check, X, GripVertical } from "lucide-react";
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
  editing,
  editName,
  setEditName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  cat: Category;
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
      className={`p-4 flex items-center gap-3 touch-none bg-card relative ${
        isOver && !isDragging ? "before:content-[''] before:absolute before:left-0 before:right-0 before:-top-px before:h-0.5 before:bg-primary" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1"
        title="Arrastar para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {editing ? (
        <>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" maxLength={60} />
          <Button size="icon" variant="ghost" onClick={() => onSaveEdit(cat.id)}><Check className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onCancelEdit}><X className="h-4 w-4" /></Button>
        </>
      ) : (
        <>
          <span className="flex-1">{cat.nome}</span>
          <Button size="icon" variant="ghost" onClick={() => onStartEdit(cat)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(cat.id)}>
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
    <div className="space-y-8">
      <div className="border border-border/50 bg-card p-6 space-y-4">
        <h3 className="font-display text-xl">Nova categoria</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div>
            <Label htmlFor="cat-name" className="text-xs uppercase tracking-wider">Nome</Label>
            <Input
              id="cat-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            />
          </div>
          <Button onClick={handleAdd} className="self-end rounded-none font-accent tracking-[0.15em] uppercase text-xs">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">A ordem é controlada arrastando as categorias na lista abaixo.</p>
      </div>

      <div className="border border-border/50 bg-card">
        {loading ? (
          <div className="p-6 text-muted-foreground text-sm">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-muted-foreground text-sm">Nenhuma categoria.</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-border/50">
                {items.map((c) => (
                  <SortableCategoryRow
                    key={c.id}
                    cat={c}
                    editing={editing === c.id}
                    editName={editName}
                    setEditName={setEditName}
                    onStartEdit={(cat) => { setEditing(cat.id); setEditName(cat.nome); }}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditing(null)}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay>
              {activeCat ? (
                <div className="p-4 flex items-center gap-3 bg-card border border-primary/60 shadow-2xl">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{activeCat.nome}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
};
