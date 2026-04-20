import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, MousePointerClick, TrendingUp, RefreshCw, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EventRow {
  piece_id: string;
  event_type: "modal_open" | "cta_click" | "modal_close";
  duration_ms: number | null;
  created_at: string;
}

interface PieceRow {
  id: string;
  nome: string;
  gallery_categories: { nome: string } | null;
}

interface Stat {
  pieceId: string;
  nome: string;
  categoria: string;
  opens: number;
  ctas: number;
  avgMs: number;
  conversion: number;
}

type Period = "7d" | "30d" | "90d" | "all";
type SortKey = "nome" | "opens" | "ctas" | "avgMs" | "conversion";

const periodToDate = (p: Period): string | null => {
  if (p === "all") return null;
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const formatMs = (ms: number) => {
  if (!ms || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
};

export const StatsManager = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");
  const [sortKey, setSortKey] = useState<SortKey>("opens");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = async () => {
    setLoading(true);
    const since = periodToDate(period);
    let q = supabase
      .from("gallery_piece_events")
      .select("piece_id, event_type, duration_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (since) q = q.gte("created_at", since);
    const [evRes, pcRes] = await Promise.all([
      q,
      supabase.from("gallery_pieces").select("id, nome, gallery_categories(nome)"),
    ]);
    if (evRes.error) toast({ title: "Erro ao carregar eventos", description: evRes.error.message, variant: "destructive" });
    else setEvents((evRes.data ?? []) as EventRow[]);
    if (pcRes.data) setPieces(pcRes.data as PieceRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [period]);

  const stats = useMemo<Stat[]>(() => {
    const byPiece = new Map<string, { opens: number; ctas: number; durSum: number; durCount: number }>();
    for (const ev of events) {
      const cur = byPiece.get(ev.piece_id) ?? { opens: 0, ctas: 0, durSum: 0, durCount: 0 };
      if (ev.event_type === "modal_open") cur.opens++;
      else if (ev.event_type === "cta_click") cur.ctas++;
      else if (ev.event_type === "modal_close" && ev.duration_ms && ev.duration_ms > 0) {
        cur.durSum += ev.duration_ms;
        cur.durCount++;
      }
      byPiece.set(ev.piece_id, cur);
    }
    const list: Stat[] = pieces.map((p) => {
      const s = byPiece.get(p.id) ?? { opens: 0, ctas: 0, durSum: 0, durCount: 0 };
      return {
        pieceId: p.id,
        nome: p.nome,
        categoria: p.gallery_categories?.nome ?? "—",
        opens: s.opens,
        ctas: s.ctas,
        avgMs: s.durCount ? s.durSum / s.durCount : 0,
        conversion: s.opens ? s.ctas / s.opens : 0,
      };
    });
    for (const [pid, s] of byPiece.entries()) {
      if (!pieces.find((p) => p.id === pid)) {
        list.push({
          pieceId: pid,
          nome: "(obra removida)",
          categoria: "—",
          opens: s.opens,
          ctas: s.ctas,
          avgMs: s.durCount ? s.durSum / s.durCount : 0,
          conversion: s.opens ? s.ctas / s.opens : 0,
        });
      }
    }
    return list;
  }, [events, pieces]);

  const sorted = useMemo(() => {
    const arr = [...stats];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "nome") cmp = a.nome.localeCompare(b.nome);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [stats, sortKey, sortDir]);

  const totals = useMemo(() => {
    const opens = stats.reduce((s, x) => s + x.opens, 0);
    const ctas = stats.reduce((s, x) => s + x.ctas, 0);
    return { opens, ctas, conversion: opens ? ctas / opens : 0 };
  }, [stats]);

  const maxOpens = useMemo(() => Math.max(1, ...stats.map((s) => s.opens)), [stats]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "nome" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 inline ml-1 text-primary-glow" />
    ) : (
      <ArrowDown className="h-3 w-3 inline ml-1 text-primary-glow" />
    );
  };

  const KPI = ({
    label,
    value,
    icon: Icon,
    accent = "purple",
  }: {
    label: string;
    value: string;
    icon: typeof Eye;
    accent?: "purple" | "red" | "ice";
  }) => {
    const accentBg =
      accent === "red"
        ? "bg-brand-red/15 text-brand-red"
        : accent === "ice"
        ? "bg-brand-ice/15 text-brand-ice"
        : "bg-gradient-purple-wine text-white shadow-glow";
    return (
      <div className="glass-panel p-4 sm:p-6 relative overflow-hidden group hover:border-primary-glow/40 transition-colors">
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/10 blur-[60px] group-hover:bg-primary/20 transition-colors" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2 sm:mb-3">{label}</p>
            <p className="font-display text-2xl sm:text-4xl text-gradient-light tabular-nums">{value}</p>
          </div>
          <div className={`shrink-0 h-9 w-9 sm:h-11 sm:w-11 rounded-md flex items-center justify-center ${accentBg}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Filters bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(v) => v && setPeriod(v as Period)}
          className="glass-card p-1 rounded-full w-full sm:w-auto justify-center"
        >
          {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
            <ToggleGroupItem
              key={p}
              value={p}
              className="flex-1 sm:flex-none rounded-full px-4 py-1.5 font-accent text-[10px] tracking-[0.2em] uppercase data-[state=on]:bg-gradient-purple-wine data-[state=on]:text-white data-[state=on]:shadow-glow"
            >
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : p === "90d" ? "90 dias" : "Tudo"}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          onClick={load}
          variant="ghost"
          size="sm"
          className="w-full sm:w-auto justify-center rounded-full font-accent tracking-[0.2em] uppercase text-[10px] hover:bg-primary/10 hover:text-primary-glow"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPI label="Aberturas de modal" value={String(totals.opens)} icon={Eye} accent="purple" />
        <KPI label="Cliques no CTA" value={String(totals.ctas)} icon={MousePointerClick} accent="red" />
        <KPI
          label="Taxa de conversão"
          value={`${(totals.conversion * 100).toFixed(1)}%`}
          icon={TrendingUp}
          accent="ice"
        />
      </div>

      {/* Detail table */}
      <div className="glass-panel overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 flex items-center gap-3">
          <Clock className="h-4 w-4 text-primary-glow" />
          <h3 className="font-accent text-sm tracking-[0.25em] uppercase">Performance por obra</h3>
        </div>

        {loading ? (
          <div className="p-6 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 shimmer rounded-md" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center">
            <Eye className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum evento registrado neste período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 bg-secondary/20 hover:bg-secondary/20">
                  <TableHead
                    className="cursor-pointer select-none font-accent text-[10px] tracking-[0.25em] uppercase text-muted-foreground"
                    onClick={() => toggleSort("nome")}
                  >
                    Obra
                    <SortIcon k="nome" />
                  </TableHead>
                  <TableHead className="font-accent text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                    Categoria
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none font-accent text-[10px] tracking-[0.25em] uppercase text-muted-foreground min-w-[160px]"
                    onClick={() => toggleSort("opens")}
                  >
                    Aberturas
                    <SortIcon k="opens" />
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none font-accent text-[10px] tracking-[0.25em] uppercase text-muted-foreground"
                    onClick={() => toggleSort("ctas")}
                  >
                    CTA
                    <SortIcon k="ctas" />
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none font-accent text-[10px] tracking-[0.25em] uppercase text-muted-foreground"
                    onClick={() => toggleSort("avgMs")}
                  >
                    Tempo médio
                    <SortIcon k="avgMs" />
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none font-accent text-[10px] tracking-[0.25em] uppercase text-muted-foreground"
                    onClick={() => toggleSort("conversion")}
                  >
                    Conversão
                    <SortIcon k="conversion" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((s) => {
                  const pct = (s.opens / maxOpens) * 100;
                  return (
                    <TableRow key={s.pieceId} className="border-border/20 hover:bg-primary/5">
                      <TableCell className="font-display">{s.nome}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{s.categoria}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="relative h-1.5 w-20 bg-primary/10 rounded-full overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary-glow rounded-full shadow-[0_0_8px_hsl(var(--primary-glow))]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="tabular-nums font-medium text-foreground/90 min-w-[2ch]">{s.opens}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.ctas}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatMs(s.avgMs)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.opens ? (
                          <span
                            className={`font-medium ${
                              s.conversion >= 0.2
                                ? "text-primary-glow"
                                : s.conversion >= 0.05
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {(s.conversion * 100).toFixed(1)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};
