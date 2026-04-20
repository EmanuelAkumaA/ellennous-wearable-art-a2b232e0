import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  ExternalLink,
  GripVertical,
  Instagram,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Star,
  Trash2,
  Check,
  X as XIcon,
  Clock,
  ShieldAlert,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Invite {
  id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  revoked: boolean;
  note: string | null;
  created_at: string;
}

interface Review {
  id: string;
  client_name: string;
  client_role: string | null;
  rating: number;
  content: string;
  photo_url: string | null;
  status: "pending" | "approved" | "rejected";
  ordem: number;
  created_at: string;
  city: string | null;
  state: string | null;
  instagram: string | null;
}

const generateToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const buildPublicUrl = (token: string) =>
  `${window.location.origin}/avaliar/${token}`;

const formatRemaining = (expires_at: string) => {
  const ms = new Date(expires_at).getTime() - Date.now();
  if (ms <= 0) return "expirado";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const StarsRow = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`h-3.5 w-3.5 ${i <= rating ? "fill-primary-glow text-primary-glow" : "text-muted-foreground/30"}`}
      />
    ))}
  </div>
);

interface ReviewCardProps {
  r: Review;
  tab: "pending" | "approved" | "rejected";
  onStatus: (id: string, status: Review["status"]) => void;
  onDelete: (id: string) => void;
  draggable?: boolean;
}

const ReviewCard = ({ r, tab, onStatus, onDelete, draggable }: ReviewCardProps) => {
  const sortable = useSortable({ id: r.id, disabled: !draggable });
  const style = draggable
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={draggable ? sortable.setNodeRef : undefined}
      style={style}
      className="flex flex-col sm:flex-row gap-4 p-4 rounded-md border border-border/40 bg-background/40"
    >
      {draggable && (
        <button
          {...sortable.attributes}
          {...sortable.listeners}
          className="hidden sm:flex items-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}
      {r.photo_url ? (
        <img
          src={r.photo_url}
          alt={r.client_name}
          className="h-16 w-16 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="h-16 w-16 rounded-full bg-secondary/40 flex items-center justify-center shrink-0 font-display text-lg">
          {r.client_name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{r.client_name}</p>
          {r.client_role && (
            <span className="text-xs text-muted-foreground">· {r.client_role}</span>
          )}
          <StarsRow rating={r.rating} />
        </div>
        {(r.city || r.state || r.instagram) && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {(r.city || r.state) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-primary-glow/70" />
                {[r.city, r.state].filter(Boolean).join(" · ")}
              </span>
            )}
            {r.instagram && (
              <span className="inline-flex items-center gap-1 text-primary-glow/80">
                <Instagram className="h-3 w-3" />
                {r.instagram.startsWith("@") ? r.instagram : `@${r.instagram}`}
              </span>
            )}
          </div>
        )}
        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{r.content}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {new Date(r.created_at).toLocaleString("pt-BR")}
        </p>
      </div>
      <div className="flex sm:flex-col gap-2 shrink-0">
        {tab !== "approved" && (
          <Button size="sm" variant="default" onClick={() => onStatus(r.id, "approved")}>
            <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
          </Button>
        )}
        {tab !== "rejected" && (
          <Button size="sm" variant="outline" onClick={() => onStatus(r.id, "rejected")}>
            <XIcon className="h-3.5 w-3.5 mr-1" /> Recusar
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(r.id)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export const ReviewsManager = () => {
  const { toast } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [validity, setValidity] = useState(24);
  const [unit, setUnit] = useState<"hours" | "days">("hours");
  const [note, setNote] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeInvites = useMemo(
    () =>
      invites.filter(
        (i) =>
          !i.used_at &&
          !i.revoked &&
          new Date(i.expires_at).getTime() > Date.now(),
      ),
    [invites],
  );

  const load = async () => {
    setLoading(true);
    const [inv, rev] = await Promise.all([
      supabase.from("review_invites").select("*").order("created_at", { ascending: false }),
      supabase
        .from("reviews")
        .select("*")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);
    if (inv.data) setInvites(inv.data as Invite[]);
    if (rev.data) setReviews(rev.data as Review[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (validity <= 0) {
      toast({ title: "Validade inválida", variant: "destructive" });
      return;
    }
    setCreating(true);
    const hours = unit === "days" ? validity * 24 : validity;
    const expires = new Date(Date.now() + hours * 3_600_000).toISOString();
    const token = generateToken();

    const { error } = await supabase.from("review_invites").insert({
      token,
      expires_at: expires,
      note: note.trim() || null,
    });
    setCreating(false);

    if (error) {
      toast({ title: "Erro ao gerar link", description: error.message, variant: "destructive" });
      return;
    }
    setNote("");
    toast({ title: "Link gerado", description: "Pronto para enviar ao cliente." });
    load();
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(buildPublicUrl(token));
    toast({ title: "Link copiado" });
  };

  const openWhatsApp = (token: string, who: string | null) => {
    const url = buildPublicUrl(token);
    const greeting = who ? `Olá ${who}!` : "Olá!";
    const text = encodeURIComponent(
      `${greeting} Adoraria saber sua opinião sobre sua peça Ellennous. Pode deixar seu depoimento aqui (válido por tempo limitado): ${url}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from("review_invites").update({ revoked: true }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao revogar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Link revogado" });
    load();
  };

  const setReviewStatus = async (id: string, status: Review["status"]) => {
    const { error } = await supabase.from("reviews").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title:
        status === "approved" ? "Avaliação aprovada" : status === "rejected" ? "Avaliação recusada" : "Atualizado",
    });
    load();
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Excluir esta avaliação? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Avaliação excluída" });
    load();
  };

  const grouped = {
    pending: reviews.filter((r) => r.status === "pending"),
    approved: reviews.filter((r) => r.status === "approved"),
    rejected: reviews.filter((r) => r.status === "rejected"),
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const approved = grouped.approved;
    const oldIndex = approved.findIndex((r) => r.id === active.id);
    const newIndex = approved.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(approved, oldIndex, newIndex);
    // Optimistic update
    setReviews((prev) => {
      const others = prev.filter((r) => r.status !== "approved");
      return [...reordered.map((r, i) => ({ ...r, ordem: i })), ...others];
    });

    try {
      await Promise.all(
        reordered.map((r, i) =>
          supabase.from("reviews").update({ ordem: i }).eq("id", r.id),
        ),
      );
      toast({ title: "Ordem atualizada" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar ordem", description: err.message, variant: "destructive" });
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-glow" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Gerar link */}
      <Card className="bg-card/40 border-border/40 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary-glow" />
            Gerar link de avaliação
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <a href="/avaliar/preview" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-2" /> Ver página base
            </a>
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {activeInvites.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-md border border-primary/30 bg-primary/5">
              <ShieldAlert className="h-4 w-4 text-primary-glow mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Já existe {activeInvites.length === 1 ? "um link ativo" : `${activeInvites.length} links ativos`}.
                Você pode gerar outro, mas considere revogar os antigos abaixo para evitar confusão.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_180px_auto] gap-3 items-end">
            <div>
              <Label htmlFor="note" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Nota interna (opcional)
              </Label>
              <Input
                id="note"
                placeholder="Ex: Maria – vestido de noiva"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="validity" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Validade
              </Label>
              <Input
                id="validity"
                type="number"
                min={1}
                max={365}
                value={validity}
                onChange={(e) => setValidity(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Unidade</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as "hours" | "days")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="h-10">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar link"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Links ativos */}
      <Card className="bg-card/40 border-border/40 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-glow" />
            Links ativos
            <Badge variant="secondary" className="ml-2">{activeInvites.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {activeInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum link ativo no momento.</p>
          ) : (
            <div className="space-y-2">
              {activeInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-md border border-border/40 bg-background/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{inv.note ?? "Sem nota"}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {buildPublicUrl(inv.token)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] tracking-widest uppercase shrink-0">
                    Expira em {formatRemaining(inv.expires_at)}
                  </Badge>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => copyLink(inv.token)} title="Copiar link">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openWhatsApp(inv.token, inv.note)}
                      title="Enviar via WhatsApp"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => revokeInvite(inv.id)}
                      title="Revogar link"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Avaliações recebidas */}
      <Card className="bg-card/40 border-border/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <Star className="h-5 w-5 text-primary-glow" />
            Avaliações recebidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                Pendentes <Badge variant="secondary" className="ml-2">{grouped.pending.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="approved">
                Aprovadas <Badge variant="secondary" className="ml-2">{grouped.approved.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Recusadas <Badge variant="secondary" className="ml-2">{grouped.rejected.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4 space-y-3">
              {grouped.pending.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nada por aqui ainda.</p>
              ) : (
                grouped.pending.map((r) => (
                  <ReviewCard
                    key={r.id}
                    r={r}
                    tab="pending"
                    onStatus={setReviewStatus}
                    onDelete={deleteReview}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="approved" className="mt-4 space-y-3">
              {grouped.approved.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nada por aqui ainda.</p>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground tracking-wider mb-2">
                    Arraste pelo ícone <GripVertical className="inline h-3 w-3" /> para reordenar como aparecem no site.
                  </p>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={grouped.approved.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                      {grouped.approved.map((r) => (
                        <ReviewCard
                          key={r.id}
                          r={r}
                          tab="approved"
                          onStatus={setReviewStatus}
                          onDelete={deleteReview}
                          draggable
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </>
              )}
            </TabsContent>

            <TabsContent value="rejected" className="mt-4 space-y-3">
              {grouped.rejected.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nada por aqui ainda.</p>
              ) : (
                grouped.rejected.map((r) => (
                  <ReviewCard
                    key={r.id}
                    r={r}
                    tab="rejected"
                    onStatus={setReviewStatus}
                    onDelete={deleteReview}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
