import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

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

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period]);

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
    // Include orphan piece_ids (pieces deleted but events exist)
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "nome" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-50" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 inline ml-1" />
      : <ArrowDown className="h-3 w-3 inline ml-1" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-xl">Estatísticas das obras</h3>
          <p className="text-xs text-muted-foreground mt-1">Aberturas do modal, cliques no CTA e tempo médio assistido.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={period} onValueChange={(v: Period) => setPeriod(v)}>
            <SelectTrigger className="w-40 rounded-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={load} variant="outline" className="rounded-none font-accent tracking-[0.15em] uppercase text-xs">
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-border/50 bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Aberturas</p>
          <p className="font-display text-2xl mt-1">{totals.opens}</p>
        </div>
        <div className="border border-border/50 bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Cliques no CTA</p>
          <p className="font-display text-2xl mt-1">{totals.ctas}</p>
        </div>
        <div className="border border-border/50 bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Conversão</p>
          <p className="font-display text-2xl mt-1">{(totals.conversion * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="border border-border/50 bg-card overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum evento registrado neste período.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("nome")}>
                  Obra<SortIcon k="nome" />
                </TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("opens")}>
                  Aberturas<SortIcon k="opens" />
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("ctas")}>
                  CTA<SortIcon k="ctas" />
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("avgMs")}>
                  Tempo médio<SortIcon k="avgMs" />
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("conversion")}>
                  Conversão<SortIcon k="conversion" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => (
                <TableRow key={s.pieceId}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.categoria}</TableCell>
                  <TableCell className="text-right">{s.opens}</TableCell>
                  <TableCell className="text-right">{s.ctas}</TableCell>
                  <TableCell className="text-right">{formatMs(s.avgMs)}</TableCell>
                  <TableCell className="text-right">{s.opens ? `${(s.conversion * 100).toFixed(1)}%` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
