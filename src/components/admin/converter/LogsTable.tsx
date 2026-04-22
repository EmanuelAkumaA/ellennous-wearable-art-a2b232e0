import { useEffect, useMemo, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, Search, Download, RefreshCw, AlertCircle, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  listConversionLogs,
  type ConversionLogRow,
  type ConversionStatus,
  type ConversionSource,
} from "@/lib/conversionLogs";
import { formatBytes } from "@/lib/imageSnippet";

const SOURCE_LABEL: Record<ConversionSource, string> = {
  converter: "Conversor",
  piece_upload: "Cadastro de obra",
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
};

const csvEscape = (v: unknown): string => {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export const LogsTable = () => {
  const [rows, setRows] = useState<ConversionLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ConversionStatus | "all">("all");
  const [source, setSource] = useState<ConversionSource | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ConversionLogRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listConversionLogs({ status, source, search, limit: 500 });
      setRows(data);
    } catch (e) {
      toast({ title: "Erro ao carregar logs", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, source]);

  // Local search filter (server already filters too — this keeps UI snappy)
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.filename.toLowerCase().includes(q));
  }, [rows, search]);

  const exportCsv = () => {
    const header = [
      "data", "origem", "arquivo", "status", "formato",
      "tamanho_original_bytes", "tamanho_otimizado_bytes",
      "duracao_ms", "piece_id", "desktop_path", "erro",
    ];
    const lines = [header.join(",")].concat(
      filtered.map((r) => [
        r.created_at,
        r.source,
        r.filename,
        r.status,
        r.original_format ?? "",
        r.original_size,
        r.optimized_size,
        r.duration_ms,
        r.piece_id ?? "",
        r.desktop_path ?? "",
        r.error_message ?? "",
      ].map(csvEscape).join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversion-logs-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1.5">Buscar arquivo</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="nome.jpg"
              className="pl-9 h-9 bg-secondary/40 border-border/40"
            />
          </div>
        </div>
        <div>
          <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1.5">Status</p>
          <Select value={status} onValueChange={(v) => setStatus(v as ConversionStatus | "all")}>
            <SelectTrigger className="w-36 h-9 bg-secondary/40 border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="error">Falha</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1.5">Origem</p>
          <Select value={source} onValueChange={(v) => setSource(v as ConversionSource | "all")}>
            <SelectTrigger className="w-44 h-9 bg-secondary/40 border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="converter">Conversor</SelectItem>
              <SelectItem value="piece_upload">Cadastro de obra</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px] h-9"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>
        <Button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          size="sm"
          className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px] h-9 bg-gradient-purple-wine"
        >
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
        </Button>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-sm text-muted-foreground">
          Nenhum log encontrado.
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="font-accent text-[10px] tracking-[0.3em] uppercase">Data</TableHead>
                <TableHead className="font-accent text-[10px] tracking-[0.3em] uppercase">Origem</TableHead>
                <TableHead className="font-accent text-[10px] tracking-[0.3em] uppercase">Arquivo</TableHead>
                <TableHead className="font-accent text-[10px] tracking-[0.3em] uppercase">Status</TableHead>
                <TableHead className="font-accent text-[10px] tracking-[0.3em] uppercase text-right">Tamanho</TableHead>
                <TableHead className="font-accent text-[10px] tracking-[0.3em] uppercase text-right">Tempo</TableHead>
                <TableHead className="font-accent text-[10px] tracking-[0.3em] uppercase">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const reduction = r.original_size > 0
                  ? Math.max(0, Math.round((1 - r.optimized_size / r.original_size) * 100))
                  : 0;
                return (
                  <TableRow key={r.id} className="border-border/30">
                    <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                        {SOURCE_LABEL[r.source]}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs max-w-[280px] truncate" title={r.filename}>
                      {r.filename}
                    </TableCell>
                    <TableCell>
                      {r.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-accent tracking-[0.2em] uppercase text-emerald-400">
                          <Check className="h-3 w-3" /> Sucesso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-accent tracking-[0.2em] uppercase text-destructive">
                          <AlertCircle className="h-3 w-3" /> Falha
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-right whitespace-nowrap">
                      {r.status === "success" ? (
                        <>
                          {formatBytes(r.optimized_size)}
                          {reduction > 0 && (
                            <span className="ml-1 text-emerald-400/80">−{reduction}%</span>
                          )}
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-right whitespace-nowrap">
                      {(r.duration_ms / 1000).toFixed(1)}s
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(r)}
                        className="h-7 px-2 font-accent text-[10px] tracking-[0.2em] uppercase"
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card/95 backdrop-blur-xl border-border/40">
          <SheetHeader>
            <SheetTitle className="font-display">Detalhes do log</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-4 text-sm">
              <Field label="Data" value={formatDate(selected.created_at)} />
              <Field label="Origem" value={SOURCE_LABEL[selected.source]} />
              <Field label="Arquivo" value={selected.filename} />
              <Field label="Formato" value={selected.original_format ?? "—"} />
              <Field label="Status" value={selected.status === "success" ? "Sucesso" : "Falha"} />
              <Field label="Tamanho original" value={formatBytes(selected.original_size)} />
              <Field label="Tamanho otimizado" value={formatBytes(selected.optimized_size)} />
              <Field label="Duração" value={`${(selected.duration_ms / 1000).toFixed(2)}s`} />
              {selected.piece_id && <Field label="ID da obra" value={selected.piece_id} mono />}
              {selected.desktop_path && <Field label="Caminho desktop" value={selected.desktop_path} mono />}
              {selected.error_message && (
                <div>
                  <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-destructive mb-1">Erro</p>
                  <pre className="text-xs whitespace-pre-wrap break-words bg-destructive/10 border border-destructive/30 rounded p-3 text-destructive">
                    {selected.error_message}
                  </pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">{label}</p>
    <p className={`text-xs ${mono ? "font-mono break-all" : ""}`}>{value}</p>
  </div>
);
