import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";

interface Category {
  id: string;
  nome: string;
  ordem: number;
}

export const CategoriesManager = () => {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newOrdem, setNewOrdem] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOrdem, setEditOrdem] = useState(0);

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
    const { error } = await supabase.from("gallery_categories").insert({ nome: name, ordem: newOrdem });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setNewName(""); setNewOrdem(0);
    toast({ title: "Categoria criada" });
    load();
  };

  const handleSaveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const { error } = await supabase.from("gallery_categories").update({ nome: name, ordem: editOrdem }).eq("id", id);
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

  return (
    <div className="space-y-8">
      <div className="border border-border/50 bg-card p-6 space-y-4">
        <h3 className="font-display text-xl">Nova categoria</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-3">
          <div>
            <Label htmlFor="cat-name" className="text-xs uppercase tracking-wider">Nome</Label>
            <Input id="cat-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
          </div>
          <div>
            <Label htmlFor="cat-ordem" className="text-xs uppercase tracking-wider">Ordem</Label>
            <Input id="cat-ordem" type="number" value={newOrdem} onChange={(e) => setNewOrdem(Number(e.target.value) || 0)} />
          </div>
          <Button onClick={handleAdd} className="self-end rounded-none font-accent tracking-[0.15em] uppercase text-xs">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      <div className="border border-border/50 bg-card">
        {loading ? (
          <div className="p-6 text-muted-foreground text-sm">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-muted-foreground text-sm">Nenhuma categoria.</div>
        ) : (
          <ul className="divide-y divide-border/50">
            {items.map((c) => (
              <li key={c.id} className="p-4 flex items-center gap-3">
                {editing === c.id ? (
                  <>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" maxLength={60} />
                    <Input type="number" value={editOrdem} onChange={(e) => setEditOrdem(Number(e.target.value) || 0)} className="w-24" />
                    <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(c.id)}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{c.nome}</span>
                    <span className="text-xs text-muted-foreground w-16 text-right">#{c.ordem}</span>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c.id); setEditName(c.nome); setEditOrdem(c.ordem); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
